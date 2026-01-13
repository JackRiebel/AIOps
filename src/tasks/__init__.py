"""Background tasks for scheduled data ingestion."""

from src.tasks.meraki_tasks import ingest_meraki_traffic

__all__ = ["ingest_meraki_traffic"]
