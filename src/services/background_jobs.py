"""Background job scheduler for continuous alert monitoring and KB maintenance."""

import asyncio
import logging
import os
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from src.config.database import get_async_session
from src.services.alert_fetcher_service import AlertFetcherService
from src.services.incident_correlation_service import IncidentCorrelationService
from src.services.splunk_driven_correlation_service import SplunkDrivenCorrelationService
from src.services.post_ingestion_hooks import get_post_ingestion_hooks
from src.tasks.meraki_tasks import ingest_meraki_traffic
from src.services.network_service import sync_all_organizations

logger = logging.getLogger(__name__)

# Valid correlation interval values (in minutes, 0 = disabled)
CORRELATION_INTERVALS = {
    "off": 0,
    "5min": 5,
    "30min": 30,
    "1hr": 60,
    "2hr": 120,
    "3hr": 180,
}


class BackgroundJobScheduler:
    """Scheduler for background jobs."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.alert_fetcher = AlertFetcherService()

        # Initialize correlation services - they now use multi-provider AI
        # and get the provider at runtime from system config
        self.splunk_correlator = SplunkDrivenCorrelationService()
        self.incident_correlator = IncidentCorrelationService()

        # Track current correlation interval setting
        self._correlation_interval: str = "off"

    async def get_correlation_interval(self) -> str:
        """Get the current correlation interval setting from database."""
        try:
            from src.services.config_service import ConfigService
            config = ConfigService()
            interval = await config.get_config("incident_correlation_interval")
            if interval and interval in CORRELATION_INTERVALS:
                return interval
            return "off"  # Default to disabled
        except Exception as e:
            logger.warning(f"Failed to get correlation interval: {e}")
            return "off"

    async def set_correlation_interval(self, interval: str) -> bool:
        """Set the correlation interval and update the scheduled job.

        Args:
            interval: One of 'off', '5min', '30min', '1hr', '2hr', '3hr'

        Returns:
            True if successful
        """
        if interval not in CORRELATION_INTERVALS:
            logger.error(f"Invalid correlation interval: {interval}")
            return False

        try:
            # Save to database
            from src.services.config_service import ConfigService
            config = ConfigService()
            await config.set_config("incident_correlation_interval", interval)

            # Update the scheduled job
            self._correlation_interval = interval
            self._update_correlation_job()

            logger.info(f"Correlation interval set to: {interval}")
            return True
        except Exception as e:
            logger.error(f"Failed to set correlation interval: {e}")
            return False

    def _update_correlation_job(self):
        """Update or remove the correlation job based on current interval."""
        job_id = "fetch_and_correlate_alerts"

        # Remove existing job if present
        try:
            existing_job = self.scheduler.get_job(job_id)
            if existing_job:
                self.scheduler.remove_job(job_id)
                logger.info(f"Removed existing correlation job")
        except Exception:
            pass

        # Add new job if interval is not "off"
        minutes = CORRELATION_INTERVALS.get(self._correlation_interval, 0)
        if minutes > 0:
            self.scheduler.add_job(
                self.fetch_and_correlate_alerts,
                trigger=IntervalTrigger(minutes=minutes),
                id=job_id,
                name=f"Fetch and correlate alerts (every {self._correlation_interval})",
                replace_existing=True,
            )
            logger.info(f"Scheduled correlation job to run every {minutes} minutes")
        else:
            logger.info("Correlation auto-polling disabled (manual only)")

    async def fetch_and_correlate_alerts(self) -> Dict[str, Any]:
        """Fetch alerts from Splunk and enrich with Meraki/ThousandEyes context.

        Returns:
            Dict with events_found, events_filtered, incidents_created, incident_ids
        """
        result = {
            "events_found": 0,
            "events_filtered": 0,
            "incidents_created": 0,
            "incident_ids": [],
        }
        try:
            logger.info("=" * 60)
            logger.info("STARTING SPLUNK-DRIVEN INCIDENT ANALYSIS")
            logger.info("=" * 60)

            # Use the new Splunk-driven correlation workflow
            correlation_result = await self.splunk_correlator.analyze_and_create_incidents(hours=24)

            # analyze_and_create_incidents returns List[int] of incident IDs
            incident_ids = correlation_result if isinstance(correlation_result, list) else []

            if incident_ids:
                logger.info(f"✓ Created {len(incident_ids)} enriched incidents")
                logger.info(f"  Incident IDs: {incident_ids}")
            else:
                logger.info("✓ No new incidents to create")

            result["incidents_created"] = len(incident_ids)
            result["incident_ids"] = incident_ids

            # Pull counts from the correlator's last run stats if available
            if hasattr(self.splunk_correlator, '_last_run_stats'):
                stats = self.splunk_correlator._last_run_stats
                result["events_found"] = stats.get("events_found", 0)
                result["events_filtered"] = stats.get("events_filtered", 0)

            logger.info("=" * 60)
            logger.info("SPLUNK-DRIVEN INCIDENT ANALYSIS COMPLETE")
            logger.info("=" * 60)

            return result

        except Exception as e:
            logger.error(f"❌ Error in fetch_and_correlate_alerts job: {e}", exc_info=True)
            raise

    async def run_scheduled_kb_hygiene(self):
        """Run scheduled knowledge base hygiene maintenance.

        This job runs every 6 hours to:
        - Remove duplicate chunks across the KB
        - Clean up low-quality content
        - Remove orphaned chunks
        - Rescore chunks without quality scores
        """
        try:
            logger.info("=" * 60)
            logger.info("STARTING SCHEDULED KB HYGIENE")
            logger.info("=" * 60)

            hooks = get_post_ingestion_hooks()

            # Get a database session
            async with get_async_session() as session:
                try:
                    stats = await hooks.run_scheduled_hygiene(session)

                    logger.info(f"✓ KB Hygiene complete:")
                    logger.info(f"  - Chunks rescored: {stats.get('chunks_rescored', 0)}")
                    logger.info(f"  - Duplicates removed: {stats.get('duplicates_removed', 0)}")
                    logger.info(f"  - Documents affected: {stats.get('documents_affected', 0)}")
                    logger.info(f"  - Duration: {stats.get('duration_ms', 0)}ms")

                    if stats.get('error'):
                        logger.warning(f"  - Error: {stats['error']}")
                except Exception as e:
                    logger.error(f"Hygiene job failed: {e}")

            logger.info("=" * 60)
            logger.info("SCHEDULED KB HYGIENE COMPLETE")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"❌ Error in run_scheduled_kb_hygiene job: {e}", exc_info=True)

    async def run_meraki_traffic_ingestion(self):
        """Run Meraki traffic data ingestion."""
        try:
            stats = await ingest_meraki_traffic()
            logger.info(f"Meraki traffic ingestion completed: {stats['devices_cached']} devices cached")
        except Exception as e:
            logger.error(f"Error in Meraki traffic ingestion: {e}", exc_info=True)

    async def run_te_metrics_collection(self):
        """Collect latest ThousandEyes test metrics."""
        try:
            from src.services.te_metrics_service import get_te_metrics_service
            svc = get_te_metrics_service()
            stats = await svc.collect_all_tests()
            logger.info(f"TE metrics collection: {stats['inserted']} new rows, {stats['tests_processed']} tests processed")
        except Exception as e:
            logger.error(f"Error in TE metrics collection: {e}", exc_info=True)

    async def run_te_metrics_cleanup(self):
        """Remove ThousandEyes metrics older than 7 days."""
        try:
            from src.services.te_metrics_service import get_te_metrics_service
            svc = get_te_metrics_service()
            deleted = await svc.cleanup_old_metrics(days=7)
            logger.info(f"TE metrics cleanup: {deleted} old rows removed")
        except Exception as e:
            logger.error(f"Error in TE metrics cleanup: {e}", exc_info=True)

    async def run_network_cache_sync(self):
        """Sync network and device data from all configured integrations."""
        try:
            logger.info("=" * 60)
            logger.info("STARTING NETWORK CACHE SYNC")
            logger.info("=" * 60)

            result = await sync_all_organizations(force=True)

            logger.info(f"✓ Network cache sync complete:")
            logger.info(f"  - Organizations synced: {result.get('synced', 0)}/{result.get('total', 0)}")

            for org_result in result.get("results", []):
                org_name = org_result.get("organization", "unknown")
                if org_result.get("success"):
                    logger.info(f"  - {org_name}: {org_result.get('networks_count', 0)} networks, {org_result.get('devices_count', 0)} devices")
                else:
                    logger.warning(f"  - {org_name}: FAILED - {org_result.get('error', 'unknown error')}")

            logger.info("=" * 60)
            logger.info("NETWORK CACHE SYNC COMPLETE")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"❌ Error in network cache sync: {e}", exc_info=True)

    def start(self):
        """Start the background job scheduler."""
        # Note: Correlation job is configured separately via start_async()
        # which reads the interval setting from database.
        # Default is "off" (manual only) to save AI costs.

        # Run KB hygiene every 6 hours
        self.scheduler.add_job(
            self.run_scheduled_kb_hygiene,
            trigger=IntervalTrigger(hours=6),
            id="kb_hygiene",
            name="Knowledge base hygiene maintenance",
            replace_existing=True,
        )

        # Run Meraki traffic ingestion every 5 minutes
        self.scheduler.add_job(
            self.run_meraki_traffic_ingestion,
            trigger=IntervalTrigger(minutes=5),
            id="meraki_traffic_ingestion",
            name="Meraki traffic data ingestion",
            replace_existing=True,
            max_instances=1,
        )

        # Also run Meraki ingestion once on startup (after 30 seconds)
        self.scheduler.add_job(
            self.run_meraki_traffic_ingestion,
            trigger=DateTrigger(run_date=datetime.now() + timedelta(seconds=30)),
            id="meraki_traffic_ingestion_startup",
            name="Meraki traffic data ingestion (startup)",
        )

        # Run ThousandEyes metrics collection every 5 minutes
        self.scheduler.add_job(
            self.run_te_metrics_collection,
            trigger=IntervalTrigger(minutes=5),
            id="te_metrics_collection",
            name="ThousandEyes test metrics collection",
            replace_existing=True,
            max_instances=1,
        )

        # Run ThousandEyes metrics cleanup every 6 hours (7-day retention)
        self.scheduler.add_job(
            self.run_te_metrics_cleanup,
            trigger=IntervalTrigger(hours=6),
            id="te_metrics_cleanup",
            name="ThousandEyes metrics cleanup (7-day retention)",
            replace_existing=True,
        )

        # Run network cache sync every 15 minutes
        self.scheduler.add_job(
            self.run_network_cache_sync,
            trigger=IntervalTrigger(minutes=15),
            id="network_cache_sync",
            name="Network cache sync",
            replace_existing=True,
            max_instances=1,
        )

        # Also run network sync once on startup (after 10 seconds)
        self.scheduler.add_job(
            self.run_network_cache_sync,
            trigger=DateTrigger(run_date=datetime.now() + timedelta(seconds=10)),
            id="network_cache_sync_startup",
            name="Network cache sync (startup)",
        )

        self.scheduler.start()
        logger.info("Background job scheduler started - network sync every 15 min, KB hygiene every 6 hours, Meraki traffic every 5 min, TE metrics every 5 min")

    async def start_async(self):
        """Async initialization that loads settings from database.

        Call this after start() to configure jobs that depend on database settings.
        """
        # Load and apply correlation interval setting from database
        self._correlation_interval = await self.get_correlation_interval()
        self._update_correlation_job()

        if self._correlation_interval == "off":
            logger.info("Incident correlation: manual only (use 'Refresh & Correlate' button)")
        else:
            logger.info(f"Incident correlation: auto-polling every {self._correlation_interval}")

    def shutdown(self):
        """Shutdown the scheduler."""
        self.scheduler.shutdown()
        logger.info("Background job scheduler shut down")


# Global scheduler instance
_scheduler_instance = None


def get_scheduler() -> BackgroundJobScheduler:
    """Get or create the global scheduler instance."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = BackgroundJobScheduler()
    return _scheduler_instance
