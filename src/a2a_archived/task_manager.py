"""A2A Task Manager.

Handles task persistence, lifecycle management, and state transitions
according to the A2A Protocol v0.3 specification.

Tasks can be stored in memory (default) or persisted to database.
"""

import logging
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import uuid

from src.a2a.types import (
    TaskState,
    TaskStatus,
    A2ATask,
    A2AMessage,
)

logger = logging.getLogger(__name__)


# Valid state transitions per A2A spec
VALID_TRANSITIONS: Dict[TaskState, set] = {
    TaskState.SUBMITTED: {
        TaskState.WORKING,
        TaskState.REJECTED,
        TaskState.CANCELED,
    },
    TaskState.WORKING: {
        TaskState.INPUT_REQUIRED,
        TaskState.AUTH_REQUIRED,
        TaskState.COMPLETED,
        TaskState.FAILED,
        TaskState.CANCELED,
    },
    TaskState.INPUT_REQUIRED: {
        TaskState.WORKING,
        TaskState.CANCELED,
        TaskState.FAILED,
    },
    TaskState.AUTH_REQUIRED: {
        TaskState.WORKING,
        TaskState.CANCELED,
        TaskState.FAILED,
    },
    # Terminal states - no transitions allowed
    TaskState.COMPLETED: set(),
    TaskState.FAILED: set(),
    TaskState.CANCELED: set(),
    TaskState.REJECTED: set(),
}


class TaskTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""

    def __init__(self, task_id: str, from_state: TaskState, to_state: TaskState):
        self.task_id = task_id
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(
            f"Invalid state transition for task {task_id}: {from_state.value} -> {to_state.value}"
        )


@dataclass
class TaskHistoryEntry:
    """Entry in task state history."""
    state: TaskState
    timestamp: datetime
    message: Optional[str] = None
    triggered_by: Optional[str] = None  # Agent or system that triggered transition


class TaskManager:
    """Manages A2A task lifecycle and persistence.

    Provides:
    - Task creation and storage
    - State transitions with validation
    - Task queries and filtering
    - History tracking
    - Automatic cleanup of old tasks
    """

    def __init__(
        self,
        max_tasks: int = 10000,
        task_ttl_hours: int = 24,
        cleanup_interval_seconds: int = 300,
    ):
        self._tasks: Dict[str, A2ATask] = {}
        self._history: Dict[str, List[TaskHistoryEntry]] = {}
        self._max_tasks = max_tasks
        self._task_ttl = timedelta(hours=task_ttl_hours)
        self._cleanup_interval = cleanup_interval_seconds
        self._cleanup_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self):
        """Start the task manager (including cleanup task)."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
            logger.info("[TaskManager] Started with cleanup interval %ds", self._cleanup_interval)

    async def stop(self):
        """Stop the task manager."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
            self._cleanup_task = None
            logger.info("[TaskManager] Stopped")

    async def _cleanup_loop(self):
        """Periodically clean up old tasks."""
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._cleanup_old_tasks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[TaskManager] Cleanup error: {e}")

    async def _cleanup_old_tasks(self):
        """Remove tasks older than TTL."""
        async with self._lock:
            now = datetime.utcnow()
            expired = []

            for task_id, task in self._tasks.items():
                # Only clean up terminal tasks
                if task.status.state.is_terminal():
                    age = now - task.status.timestamp
                    if age > self._task_ttl:
                        expired.append(task_id)

            for task_id in expired:
                del self._tasks[task_id]
                if task_id in self._history:
                    del self._history[task_id]

            if expired:
                logger.info(f"[TaskManager] Cleaned up {len(expired)} expired tasks")

    async def create_task(
        self,
        context_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> A2ATask:
        """Create a new task in SUBMITTED state."""
        async with self._lock:
            # Enforce max tasks limit
            if len(self._tasks) >= self._max_tasks:
                # Remove oldest terminal task
                oldest = None
                oldest_time = None
                for task_id, task in self._tasks.items():
                    if task.status.state.is_terminal():
                        if oldest_time is None or task.status.timestamp < oldest_time:
                            oldest = task_id
                            oldest_time = task.status.timestamp

                if oldest:
                    del self._tasks[oldest]
                    if oldest in self._history:
                        del self._history[oldest]
                else:
                    raise RuntimeError("Task limit reached and no terminal tasks to evict")

            task = A2ATask(
                id=str(uuid.uuid4()),
                contextId=context_id,
                status=TaskStatus(state=TaskState.SUBMITTED),
                metadata=metadata or {},
            )

            self._tasks[task.id] = task
            self._history[task.id] = [
                TaskHistoryEntry(
                    state=TaskState.SUBMITTED,
                    timestamp=datetime.utcnow(),
                    message="Task created",
                )
            ]

            logger.debug(f"[TaskManager] Created task {task.id}")
            return task

    async def get_task(self, task_id: str) -> Optional[A2ATask]:
        """Get a task by ID."""
        return self._tasks.get(task_id)

    async def update_task_state(
        self,
        task_id: str,
        new_state: TaskState,
        message: Optional[str] = None,
        triggered_by: Optional[str] = None,
    ) -> A2ATask:
        """Transition task to a new state with validation."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"Task not found: {task_id}")

            current_state = task.status.state

            # Validate transition
            if new_state not in VALID_TRANSITIONS.get(current_state, set()):
                raise TaskTransitionError(task_id, current_state, new_state)

            # Update state
            task.status = TaskStatus(
                state=new_state,
                timestamp=datetime.utcnow(),
                message=message,
            )

            # Record history
            self._history[task_id].append(
                TaskHistoryEntry(
                    state=new_state,
                    timestamp=datetime.utcnow(),
                    message=message,
                    triggered_by=triggered_by,
                )
            )

            logger.debug(
                f"[TaskManager] Task {task_id}: {current_state.value} -> {new_state.value}"
            )
            return task

    async def add_message(self, task_id: str, message: A2AMessage) -> A2ATask:
        """Add a message to task history."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"Task not found: {task_id}")

            task.history.append(message)
            return task

    async def add_artifact(
        self,
        task_id: str,
        artifact: Dict,
    ) -> A2ATask:
        """Add an artifact to a task."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"Task not found: {task_id}")

            task.artifacts.append(artifact)
            return task

    async def set_handled_by(
        self,
        task_id: str,
        agent_ids: List[str],
    ) -> A2ATask:
        """Set which agents handled this task."""
        async with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"Task not found: {task_id}")

            task.handledBy = agent_ids
            return task

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel an active task. Returns True if successful."""
        task = self._tasks.get(task_id)
        if task is None:
            return False

        if task.status.state.is_terminal():
            return False

        try:
            await self.update_task_state(
                task_id,
                TaskState.CANCELED,
                message="Task canceled by user",
            )
            return True
        except TaskTransitionError:
            return False

    async def list_tasks(
        self,
        page: int = 1,
        page_size: int = 20,
        state: Optional[TaskState] = None,
        context_id: Optional[str] = None,
    ) -> Tuple[List[A2ATask], int]:
        """List tasks with filtering and pagination."""
        # Filter tasks
        filtered = []
        for task in self._tasks.values():
            if state and task.status.state != state:
                continue
            if context_id and task.contextId != context_id:
                continue
            filtered.append(task)

        # Sort by timestamp (newest first)
        filtered.sort(key=lambda t: t.status.timestamp, reverse=True)

        total = len(filtered)

        # Paginate
        start = (page - 1) * page_size
        end = start + page_size
        page_tasks = filtered[start:end]

        return page_tasks, total

    async def get_task_history(self, task_id: str) -> List[TaskHistoryEntry]:
        """Get state transition history for a task."""
        return self._history.get(task_id, [])

    async def get_active_task_count(self) -> int:
        """Get count of active (non-terminal) tasks."""
        count = 0
        for task in self._tasks.values():
            if task.status.state.is_active():
                count += 1
        return count

    async def get_stats(self) -> Dict:
        """Get task manager statistics."""
        states = {}
        for task in self._tasks.values():
            state = task.status.state.value
            states[state] = states.get(state, 0) + 1

        return {
            "total_tasks": len(self._tasks),
            "active_tasks": await self.get_active_task_count(),
            "tasks_by_state": states,
            "max_tasks": self._max_tasks,
            "task_ttl_hours": self._task_ttl.total_seconds() / 3600,
        }


# Singleton instance
_task_manager: Optional[TaskManager] = None


def get_task_manager() -> TaskManager:
    """Get the singleton TaskManager instance."""
    global _task_manager
    if _task_manager is None:
        _task_manager = TaskManager()
    return _task_manager


async def init_task_manager():
    """Initialize and start the task manager."""
    manager = get_task_manager()
    await manager.start()
    return manager


async def shutdown_task_manager():
    """Shutdown the task manager."""
    global _task_manager
    if _task_manager:
        await _task_manager.stop()
        _task_manager = None
