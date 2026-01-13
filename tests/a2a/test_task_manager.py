"""Tests for A2A Task Manager."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from src.a2a.types import TaskState, A2AMessage, TextPart
from src.a2a.task_manager import (
    TaskManager,
    TaskTransitionError,
    VALID_TRANSITIONS,
)


class TestTaskManager:
    """Tests for TaskManager class."""

    @pytest.fixture
    def task_manager(self):
        """Create a fresh task manager instance."""
        return TaskManager()

    @pytest.mark.asyncio
    async def test_create_task(self, task_manager):
        """Test creating a new task."""
        task = await task_manager.create_task(
            context_id="ctx-123",
            initial_message=A2AMessage(
                role="user",
                parts=[TextPart(text="Test query")],
            ),
        )
        assert task is not None
        assert task.id is not None
        assert task.contextId == "ctx-123"
        assert task.status.state == TaskState.SUBMITTED
        assert len(task.history) == 1

    @pytest.mark.asyncio
    async def test_get_task(self, task_manager):
        """Test retrieving a task by ID."""
        task = await task_manager.create_task()
        retrieved = await task_manager.get_task(task.id)
        assert retrieved is not None
        assert retrieved.id == task.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_task(self, task_manager):
        """Test retrieving a non-existent task returns None."""
        result = await task_manager.get_task("nonexistent-id")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_task_state_valid(self, task_manager):
        """Test valid state transitions."""
        task = await task_manager.create_task()

        # SUBMITTED -> WORKING
        updated = await task_manager.update_state(task.id, TaskState.WORKING)
        assert updated.status.state == TaskState.WORKING

        # WORKING -> COMPLETED
        updated = await task_manager.update_state(task.id, TaskState.COMPLETED)
        assert updated.status.state == TaskState.COMPLETED

    @pytest.mark.asyncio
    async def test_update_task_state_invalid(self, task_manager):
        """Test invalid state transitions raise errors."""
        task = await task_manager.create_task()

        # SUBMITTED -> COMPLETED (invalid, must go through WORKING)
        with pytest.raises(TaskTransitionError):
            await task_manager.update_state(task.id, TaskState.COMPLETED)

    @pytest.mark.asyncio
    async def test_update_terminal_state(self, task_manager):
        """Test that terminal states cannot be changed."""
        task = await task_manager.create_task()
        await task_manager.update_state(task.id, TaskState.WORKING)
        await task_manager.update_state(task.id, TaskState.COMPLETED)

        # COMPLETED is terminal, cannot change
        with pytest.raises(TaskTransitionError):
            await task_manager.update_state(task.id, TaskState.WORKING)

    @pytest.mark.asyncio
    async def test_cancel_task(self, task_manager):
        """Test canceling a task."""
        task = await task_manager.create_task()
        await task_manager.update_state(task.id, TaskState.WORKING)

        success = await task_manager.cancel_task(task.id)
        assert success is True

        updated = await task_manager.get_task(task.id)
        assert updated.status.state == TaskState.CANCELED

    @pytest.mark.asyncio
    async def test_cancel_terminal_task(self, task_manager):
        """Test that terminal tasks cannot be canceled."""
        task = await task_manager.create_task()
        await task_manager.update_state(task.id, TaskState.WORKING)
        await task_manager.update_state(task.id, TaskState.COMPLETED)

        success = await task_manager.cancel_task(task.id)
        assert success is False

    @pytest.mark.asyncio
    async def test_add_message_to_task(self, task_manager):
        """Test adding messages to task history."""
        task = await task_manager.create_task(
            initial_message=A2AMessage(
                role="user",
                parts=[TextPart(text="Initial message")],
            ),
        )

        await task_manager.add_message(
            task.id,
            A2AMessage(
                role="agent",
                parts=[TextPart(text="Response message")],
            ),
        )

        updated = await task_manager.get_task(task.id)
        assert len(updated.history) == 2
        assert updated.history[1].role == "agent"

    @pytest.mark.asyncio
    async def test_list_tasks_pagination(self, task_manager):
        """Test listing tasks with pagination."""
        # Create multiple tasks
        for i in range(15):
            await task_manager.create_task(context_id=f"ctx-{i}")

        # Get first page
        tasks, total = await task_manager.list_tasks(page=1, page_size=10)
        assert len(tasks) == 10
        assert total == 15

        # Get second page
        tasks, total = await task_manager.list_tasks(page=2, page_size=10)
        assert len(tasks) == 5

    @pytest.mark.asyncio
    async def test_list_tasks_filter_by_state(self, task_manager):
        """Test filtering tasks by state."""
        # Create tasks with different states
        t1 = await task_manager.create_task()
        t2 = await task_manager.create_task()
        t3 = await task_manager.create_task()

        await task_manager.update_state(t2.id, TaskState.WORKING)
        await task_manager.update_state(t3.id, TaskState.WORKING)
        await task_manager.update_state(t3.id, TaskState.COMPLETED)

        # Filter by SUBMITTED
        tasks, total = await task_manager.list_tasks(state=TaskState.SUBMITTED)
        assert len(tasks) == 1

        # Filter by COMPLETED
        tasks, total = await task_manager.list_tasks(state=TaskState.COMPLETED)
        assert len(tasks) == 1

    @pytest.mark.asyncio
    async def test_list_tasks_filter_by_context(self, task_manager):
        """Test filtering tasks by context ID."""
        await task_manager.create_task(context_id="ctx-A")
        await task_manager.create_task(context_id="ctx-A")
        await task_manager.create_task(context_id="ctx-B")

        tasks, total = await task_manager.list_tasks(context_id="ctx-A")
        assert len(tasks) == 2

    @pytest.mark.asyncio
    async def test_add_artifact(self, task_manager):
        """Test adding artifacts to a task."""
        task = await task_manager.create_task()

        await task_manager.add_artifact(
            task.id,
            {
                "type": "data",
                "name": "result.json",
                "data": {"key": "value"},
            },
        )

        updated = await task_manager.get_task(task.id)
        assert len(updated.artifacts) == 1
        assert updated.artifacts[0]["name"] == "result.json"

    @pytest.mark.asyncio
    async def test_update_metadata(self, task_manager):
        """Test updating task metadata."""
        task = await task_manager.create_task()

        await task_manager.update_metadata(
            task.id,
            {"tokens": 150, "model": "claude-3"},
        )

        updated = await task_manager.get_task(task.id)
        assert updated.metadata["tokens"] == 150
        assert updated.metadata["model"] == "claude-3"

    @pytest.mark.asyncio
    async def test_task_cleanup(self, task_manager):
        """Test cleaning up old tasks."""
        # Create tasks
        for _ in range(5):
            task = await task_manager.create_task()
            await task_manager.update_state(task.id, TaskState.WORKING)
            await task_manager.update_state(task.id, TaskState.COMPLETED)

        # Cleanup completed tasks
        cleaned = await task_manager.cleanup(max_age_hours=0)
        assert cleaned >= 5


class TestValidTransitions:
    """Tests for state transition validation."""

    def test_submitted_valid_transitions(self):
        """Test valid transitions from SUBMITTED."""
        valid = VALID_TRANSITIONS[TaskState.SUBMITTED]
        assert TaskState.WORKING in valid
        assert TaskState.REJECTED in valid
        assert TaskState.CANCELED in valid
        assert TaskState.COMPLETED not in valid

    def test_working_valid_transitions(self):
        """Test valid transitions from WORKING."""
        valid = VALID_TRANSITIONS[TaskState.WORKING]
        assert TaskState.INPUT_REQUIRED in valid
        assert TaskState.AUTH_REQUIRED in valid
        assert TaskState.COMPLETED in valid
        assert TaskState.FAILED in valid
        assert TaskState.CANCELED in valid

    def test_input_required_transitions(self):
        """Test valid transitions from INPUT_REQUIRED."""
        valid = VALID_TRANSITIONS[TaskState.INPUT_REQUIRED]
        assert TaskState.WORKING in valid
        assert TaskState.CANCELED in valid

    def test_terminal_states_no_transitions(self):
        """Test that terminal states have no valid transitions."""
        for state in TaskState.terminal_states():
            assert state in VALID_TRANSITIONS
            assert len(VALID_TRANSITIONS[state]) == 0


class TestTaskTransitionError:
    """Tests for TaskTransitionError exception."""

    def test_error_message(self):
        """Test error message formatting."""
        error = TaskTransitionError(
            task_id="task-123",
            from_state=TaskState.SUBMITTED,
            to_state=TaskState.COMPLETED,
        )
        assert "task-123" in str(error)
        assert "submitted" in str(error)
        assert "completed" in str(error)

    def test_error_attributes(self):
        """Test error has correct attributes."""
        error = TaskTransitionError(
            task_id="task-456",
            from_state=TaskState.WORKING,
            to_state=TaskState.SUBMITTED,
        )
        assert error.task_id == "task-456"
        assert error.from_state == TaskState.WORKING
        assert error.to_state == TaskState.SUBMITTED
