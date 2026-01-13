"""Meraki background tasks for pre-fetching bandwidth and traffic data."""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

from src.services.network_cache_service import NetworkCacheService
from src.services.meraki_api import MerakiAPIClient
from src.api.dependencies import credential_manager

logger = logging.getLogger(__name__)


async def ingest_meraki_traffic() -> Dict[str, Any]:
    """Ingest Meraki traffic data for all MX appliances.

    Pre-fetches bandwidth data for uplink devices so cards display instantly.
    This task:
    1. Lists active networks from cache
    2. Identifies uplink devices (MX series)
    3. Fetches uplink loss/latency and usage history
    4. Stores results in metrics cache (TTL: 5 minutes)

    Returns:
        Dict with ingestion statistics
    """
    logger.info("=" * 60)
    logger.info("STARTING MERAKI TRAFFIC INGESTION")
    logger.info("=" * 60)

    start_time = datetime.utcnow()
    stats = {
        "organizations_processed": 0,
        "devices_processed": 0,
        "devices_cached": 0,
        "errors": [],
    }

    cache_service = NetworkCacheService()

    try:
        # Get all organizations
        orgs = await credential_manager.list_organizations()

        for org in orgs:
            org_name = org.get("name")
            base_url = org.get("url", "")

            # Skip non-Meraki organizations
            if "thousandeyes.com" in base_url.lower() or ":8089" in base_url.lower() or "splunk" in base_url.lower():
                continue

            stats["organizations_processed"] += 1
            logger.info(f"Processing organization: {org_name}")

            try:
                # Get credentials
                creds = await credential_manager.get_credentials(org_name)
                if not creds or not creds.get("api_key"):
                    logger.warning(f"No API key for {org_name}, skipping")
                    continue

                # Create Meraki client
                client = MerakiAPIClient(
                    api_key=creds["api_key"],
                    base_url=creds.get("base_url", "https://api.meraki.com/api/v1"),
                    verify_ssl=creds.get("verify_ssl", True),
                )

                try:
                    # Get cached devices for this org
                    cached_devices = await cache_service.get_cached_devices(org_name)

                    # Filter to MX (appliance) devices
                    mx_devices = [
                        d for d in cached_devices
                        if d.get("model", "").upper().startswith("MX")
                        or d.get("model", "").upper().startswith("Z")  # Z-series (teleworker)
                    ]

                    if not mx_devices:
                        logger.debug(f"No MX devices in {org_name}")
                        continue

                    logger.info(f"Found {len(mx_devices)} MX devices in {org_name}")

                    # Fetch metrics for each device
                    for device in mx_devices:
                        stats["devices_processed"] += 1
                        serial = device.get("serial")
                        network_id = device.get("networkId")

                        if not serial:
                            continue

                        try:
                            # Fetch uplink loss and latency
                            loss_latency = await client.get_device_uplink_loss_and_latency(
                                serial,
                                timespan=900,  # 15 minutes
                                resolution=60,  # 1-minute intervals
                            )

                            # Fetch uplink usage history if we have network ID
                            usage_history = []
                            if network_id:
                                usage_history = await client.get_network_appliance_uplinks_usage_history(
                                    network_id,
                                    timespan=3600,  # 1 hour
                                    resolution=300,  # 5-minute intervals
                                )

                            # Build bandwidth data structure
                            bandwidth_data = _build_bandwidth_data(
                                serial=serial,
                                loss_latency=loss_latency,
                                usage_history=usage_history,
                            )

                            # Cache the data
                            await cache_service.set_metrics(
                                serial=serial,
                                metrics_type="bandwidth",
                                data=bandwidth_data,
                                ttl_seconds=300,  # 5 minutes
                            )

                            stats["devices_cached"] += 1
                            logger.debug(f"Cached bandwidth data for {serial}")

                        except Exception as e:
                            error_msg = f"Error fetching metrics for {serial}: {e}"
                            logger.error(error_msg)
                            stats["errors"].append(error_msg)

                finally:
                    await client.close()

            except Exception as e:
                error_msg = f"Error processing org {org_name}: {e}"
                logger.error(error_msg)
                stats["errors"].append(error_msg)

        # Clear expired cache entries
        expired_count = await cache_service.clear_expired_metrics()
        stats["expired_cleared"] = expired_count

    except Exception as e:
        error_msg = f"Error in ingest_meraki_traffic: {e}"
        logger.error(error_msg, exc_info=True)
        stats["errors"].append(error_msg)

    duration = (datetime.utcnow() - start_time).total_seconds()
    stats["duration_seconds"] = duration

    logger.info("=" * 60)
    logger.info("MERAKI TRAFFIC INGESTION COMPLETE")
    logger.info(f"  Organizations: {stats['organizations_processed']}")
    logger.info(f"  Devices processed: {stats['devices_processed']}")
    logger.info(f"  Devices cached: {stats['devices_cached']}")
    logger.info(f"  Errors: {len(stats['errors'])}")
    logger.info(f"  Duration: {duration:.2f}s")
    logger.info("=" * 60)

    return stats


def _build_bandwidth_data(
    serial: str,
    loss_latency: List[Dict[str, Any]],
    usage_history: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build bandwidth data structure from API responses.

    Args:
        serial: Device serial
        loss_latency: Loss/latency history from API
        usage_history: Uplink usage history from API

    Returns:
        Structured bandwidth data for caching
    """
    # Process loss/latency data
    latency_points = []
    loss_points = []
    avg_latency = 0
    avg_loss = 0

    if loss_latency:
        for point in loss_latency:
            ts = point.get("startTs") or point.get("ts")
            latency = point.get("latencyMs") or 0
            loss = point.get("lossPercent") or 0

            if ts:
                latency_points.append({"timestamp": ts, "value": latency})
                loss_points.append({"timestamp": ts, "value": loss})

        if latency_points:
            avg_latency = sum(p["value"] for p in latency_points) / len(latency_points)
        if loss_points:
            avg_loss = sum(p["value"] for p in loss_points) / len(loss_points)

    # Process usage history
    interfaces = {}
    total_sent = 0
    total_recv = 0
    history = []

    if usage_history:
        for entry in usage_history:
            ts = entry.get("startTime") or entry.get("ts")
            by_interface = entry.get("byInterface", [])

            entry_sent = 0
            entry_recv = 0

            for iface in by_interface:
                iface_name = iface.get("interface", "wan1")

                if iface_name not in interfaces:
                    interfaces[iface_name] = {
                        "interface": iface_name,
                        "name": iface_name.upper(),
                        "currentBandwidth": {"sent": 0, "recv": 0},
                        "capacity": 1000000000,  # 1 Gbps default
                        "history": [],
                    }

                sent = iface.get("sent") or 0
                recv = iface.get("received") or 0

                interfaces[iface_name]["history"].append({
                    "timestamp": ts,
                    "sent": sent,
                    "recv": recv,
                })
                interfaces[iface_name]["currentBandwidth"]["sent"] = sent
                interfaces[iface_name]["currentBandwidth"]["recv"] = recv

                entry_sent += sent
                entry_recv += recv

            total_sent += entry_sent
            total_recv += entry_recv

            if ts:
                history.append({
                    "timestamp": ts,
                    "sent": entry_sent,
                    "recv": entry_recv,
                })

    return {
        "deviceSerial": serial,
        "sent": total_sent,
        "recv": total_recv,
        "history": history,
        "interfaces": list(interfaces.values()) if interfaces else [],
        "latency": {
            "avg_ms": round(avg_latency, 2),
            "history": latency_points[-10:] if latency_points else [],  # Last 10 points
        },
        "loss": {
            "avg_percent": round(avg_loss, 2),
            "history": loss_points[-10:] if loss_points else [],  # Last 10 points
        },
        "cached_at": datetime.utcnow().isoformat() + "Z",
    }
