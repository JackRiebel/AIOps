"""Workflow Scheduler - Manages polling schedules for active workflows.

Uses APScheduler to schedule and manage workflow polling jobs based on their
configured poll_interval_seconds or schedule_cron expressions.
"""

import logging
from datetime import datetime
from typing import Dict, Optional, Set
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from src.config.database import get_db
from src.models.workflow import Workflow, WorkflowStatus, TriggerType
from src.services.workflow_service import get_workflow_service

logger = logging.getLogger(__name__)


class WorkflowScheduler:
    """Manages polling schedules for active workflows.

    This scheduler:
    - Loads all active workflows on startup
    - Schedules jobs based on poll_interval_seconds or schedule_cron
    - Dynamically adds/removes jobs when workflows are activated/paused
    - Triggers the WorkflowEngine to evaluate conditions
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.active_jobs: Dict[int, str] = {}  # workflow_id -> job_id
        self._engine = None  # Will be set when starting
        self._started = False
        self._lock = asyncio.Lock()

    @property
    def engine(self):
        """Get the workflow engine (lazy import to avoid circular deps)."""
        if self._engine is None:
            from src.services.workflow_engine import get_workflow_engine
            self._engine = get_workflow_engine()
        return self._engine

    async def start(self):
        """Start the scheduler and load all active workflows."""
        if self._started:
            logger.warning("Workflow scheduler already started")
            return

        async with self._lock:
            try:
                # Load all active workflows
                db = get_db()
                async with db.session() as session:
                    service = get_workflow_service(session)
                    workflows = await service.get_active_workflows()

                    for workflow in workflows:
                        await self.schedule_workflow(workflow)

                # Start the scheduler
                self.scheduler.start()
                self._started = True
                logger.info(f"Workflow scheduler started with {len(workflows)} active workflows")

            except Exception as e:
                logger.error(f"Failed to start workflow scheduler: {e}")
                raise

    async def stop(self):
        """Stop the scheduler."""
        if not self._started:
            return

        async with self._lock:
            try:
                self.scheduler.shutdown(wait=False)
                self.active_jobs.clear()
                self._started = False
                logger.info("Workflow scheduler stopped")
            except Exception as e:
                logger.error(f"Error stopping scheduler: {e}")

    async def schedule_workflow(self, workflow: Workflow) -> bool:
        """Add or update a workflow's polling job.

        Args:
            workflow: The workflow to schedule

        Returns:
            True if successfully scheduled
        """
        if workflow.status != WorkflowStatus.ACTIVE:
            logger.debug(f"Skipping non-active workflow {workflow.id}")
            return False

        job_id = f"workflow_{workflow.id}"

        try:
            # Remove existing job if any
            if workflow.id in self.active_jobs:
                await self.unschedule_workflow(workflow.id)

            # Create trigger based on workflow configuration
            if workflow.trigger_type == TriggerType.SCHEDULE and workflow.schedule_cron:
                # Cron-based schedule
                trigger = CronTrigger.from_crontab(workflow.schedule_cron)
                trigger_desc = f"cron: {workflow.schedule_cron}"
            elif workflow.trigger_type == TriggerType.SPLUNK_QUERY:
                # Interval-based polling for Splunk queries
                trigger = IntervalTrigger(seconds=workflow.poll_interval_seconds)
                trigger_desc = f"every {workflow.poll_interval_seconds}s"
            else:
                # Manual trigger - no scheduling needed
                logger.debug(f"Workflow {workflow.id} is manual trigger, not scheduling")
                return False

            # Add job to scheduler
            self.scheduler.add_job(
                self._execute_poll,
                trigger=trigger,
                args=[workflow.id],
                id=job_id,
                name=f"Workflow: {workflow.name}",
                replace_existing=True,
                misfire_grace_time=60,  # Allow 60s grace for misfires
            )

            self.active_jobs[workflow.id] = job_id
            logger.info(f"Scheduled workflow {workflow.id} ({workflow.name}) - {trigger_desc}")
            return True

        except Exception as e:
            logger.error(f"Failed to schedule workflow {workflow.id}: {e}")
            return False

    async def unschedule_workflow(self, workflow_id: int) -> bool:
        """Remove a workflow's polling job.

        Args:
            workflow_id: ID of the workflow to unschedule

        Returns:
            True if successfully unscheduled
        """
        if workflow_id not in self.active_jobs:
            return False

        try:
            job_id = self.active_jobs[workflow_id]
            self.scheduler.remove_job(job_id)
            del self.active_jobs[workflow_id]
            logger.info(f"Unscheduled workflow {workflow_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to unschedule workflow {workflow_id}: {e}")
            return False

    async def refresh_workflow(self, workflow_id: int) -> bool:
        """Refresh a workflow's schedule (after update).

        Args:
            workflow_id: ID of the workflow to refresh

        Returns:
            True if successfully refreshed
        """
        db = get_db()
        async with db.session() as session:
            service = get_workflow_service(session)
            workflow = await service.get_workflow(workflow_id)

            if not workflow:
                # Workflow deleted, unschedule it
                return await self.unschedule_workflow(workflow_id)

            if workflow.status == WorkflowStatus.ACTIVE:
                return await self.schedule_workflow(workflow)
            else:
                return await self.unschedule_workflow(workflow_id)

    async def _execute_poll(self, workflow_id: int):
        """Execute a polling job for a workflow.

        This is called by APScheduler when a job fires.

        Args:
            workflow_id: ID of the workflow to poll
        """
        try:
            logger.debug(f"Polling workflow {workflow_id}")
            await self.engine.evaluate_workflow(workflow_id)
        except Exception as e:
            logger.error(f"Error polling workflow {workflow_id}: {e}")
            # Don't re-raise - APScheduler will handle job failures

    def get_scheduled_workflows(self) -> Set[int]:
        """Get the set of currently scheduled workflow IDs."""
        return set(self.active_jobs.keys())

    def get_job_info(self, workflow_id: int) -> Optional[Dict]:
        """Get information about a workflow's scheduled job.

        Args:
            workflow_id: Workflow ID

        Returns:
            Job info dict or None if not scheduled
        """
        if workflow_id not in self.active_jobs:
            return None

        job_id = self.active_jobs[workflow_id]
        job = self.scheduler.get_job(job_id)

        if not job:
            return None

        return {
            "job_id": job_id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        }

    def is_running(self) -> bool:
        """Check if the scheduler is running."""
        return self._started and self.scheduler.running


# ============================================================================
# Global Scheduler Instance
# ============================================================================

_scheduler: Optional[WorkflowScheduler] = None


def get_workflow_scheduler() -> WorkflowScheduler:
    """Get the global workflow scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = WorkflowScheduler()
    return _scheduler


async def start_workflow_scheduler():
    """Start the global workflow scheduler."""
    scheduler = get_workflow_scheduler()
    await scheduler.start()


async def stop_workflow_scheduler():
    """Stop the global workflow scheduler."""
    global _scheduler
    if _scheduler:
        await _scheduler.stop()
        _scheduler = None
