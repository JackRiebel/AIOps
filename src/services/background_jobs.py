"""Background job scheduler for continuous alert monitoring and KB maintenance."""

import asyncio
import logging
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from src.config.database import get_async_session
from src.services.alert_fetcher_service import AlertFetcherService
from src.services.incident_correlation_service import IncidentCorrelationService
from src.services.splunk_driven_correlation_service import SplunkDrivenCorrelationService
from src.services.post_ingestion_hooks import get_post_ingestion_hooks
from src.tasks.meraki_tasks import ingest_meraki_traffic
from src.services.network_service import sync_all_organizations

logger = logging.getLogger(__name__)


class BackgroundJobScheduler:
    """Scheduler for background jobs."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.alert_fetcher = AlertFetcherService()

        # Initialize correlation services - they now use multi-provider AI
        # and get the provider at runtime from system config
        self.splunk_correlator = SplunkDrivenCorrelationService()
        self.incident_correlator = IncidentCorrelationService()

    async def fetch_and_correlate_alerts(self):
        """Fetch alerts from Splunk and enrich with Meraki/ThousandEyes context."""
        try:
            logger.info("=" * 60)
            logger.info("STARTING SPLUNK-DRIVEN INCIDENT ANALYSIS")
            logger.info("=" * 60)

            # Use the new Splunk-driven correlation workflow
            incident_ids = await self.splunk_correlator.analyze_and_create_incidents(hours=24)
            if incident_ids:
                logger.info(f"✓ Created {len(incident_ids)} enriched incidents")
                logger.info(f"  Incident IDs: {incident_ids}")
            else:
                logger.info("✓ No new incidents to create")

            logger.info("=" * 60)
            logger.info("SPLUNK-DRIVEN INCIDENT ANALYSIS COMPLETE")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"❌ Error in fetch_and_correlate_alerts job: {e}", exc_info=True)

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
        # Run fetch_and_correlate_alerts every 3 hours
        self.scheduler.add_job(
            self.fetch_and_correlate_alerts,
            trigger=IntervalTrigger(hours=3),
            id="fetch_and_correlate_alerts",
            name="Fetch and correlate alerts",
            replace_existing=True,
        )

        # Also run immediately on startup
        self.scheduler.add_job(
            self.fetch_and_correlate_alerts,
            id="fetch_and_correlate_alerts_startup",
            name="Fetch and correlate alerts (startup)",
        )

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
        )

        # Also run Meraki ingestion on startup (after 30 seconds to allow app initialization)
        self.scheduler.add_job(
            self.run_meraki_traffic_ingestion,
            trigger=IntervalTrigger(seconds=30),
            id="meraki_traffic_ingestion_startup",
            name="Meraki traffic data ingestion (startup)",
            max_instances=1,
        )

        # Run network cache sync every 15 minutes
        self.scheduler.add_job(
            self.run_network_cache_sync,
            trigger=IntervalTrigger(minutes=15),
            id="network_cache_sync",
            name="Network cache sync",
            replace_existing=True,
        )

        # Also run network sync on startup (after 10 seconds to allow app initialization)
        self.scheduler.add_job(
            self.run_network_cache_sync,
            trigger=IntervalTrigger(seconds=10),
            id="network_cache_sync_startup",
            name="Network cache sync (startup)",
            max_instances=1,
        )

        self.scheduler.start()
        logger.info("Background job scheduler started - network sync every 15 min, alert correlation every 3 hours, KB hygiene every 6 hours, Meraki traffic every 5 minutes")

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
