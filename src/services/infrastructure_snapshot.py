"""Infrastructure snapshot service.

Builds and maintains a local JSON file with all infrastructure data
(Meraki networks/devices with WAN IPs, ThousandEyes agents) so that
AI test creation can read from disk instead of making live API calls.

Refreshed every 15 minutes by the background job scheduler, or manually
via the /api/infrastructure/snapshot/refresh endpoint.
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Snapshot file path — sits next to the source code in src/data/
SNAPSHOT_DIR = Path(__file__).parent.parent / "data"
SNAPSHOT_PATH = SNAPSHOT_DIR / "infrastructure_snapshot.json"


async def build_snapshot() -> Dict[str, Any]:
    """Aggregate all infrastructure data into a single snapshot dict.

    Sources:
    - Meraki networks + devices (from DB cache, no API call)
    - ThousandEyes agents (live API call, cached here for reuse)
    """
    from src.services.network_service import get_aggregated_cache_data

    snapshot: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "networks": [],
        "agents": [],
    }

    # --- Meraki networks + devices ---
    try:
        cache_data = await get_aggregated_cache_data()
        networks = cache_data.get("networks", [])
        devices = cache_data.get("devices", [])

        # Build networkId -> devices map
        net_devices: Dict[str, List[dict]] = {}
        for d in devices:
            nid = d.get("networkId")
            if nid:
                net_devices.setdefault(nid, []).append(d)

        for net in networks:
            net_id = net.get("id", "")
            devs = net_devices.get(net_id, [])

            # Extract WAN IPs from devices in this network
            # wan1Ip comes from raw_data via CachedDevice.to_dict()
            device_list = []
            for d in devs:
                device_list.append({
                    "name": d.get("name") or d.get("model", ""),
                    "model": d.get("model", ""),
                    "serial": d.get("serial", ""),
                    "wan1Ip": d.get("wan1Ip") or "",
                    "wan2Ip": d.get("wan2Ip") or "",
                    "publicIp": d.get("publicIp") or "",
                    "lanIp": d.get("lanIp") or "",
                    "status": d.get("status", ""),
                })

            # Pick the primary WAN IP for this network
            # Priority: wan1Ip > publicIp (wan1Ip is the actual interface IP)
            primary_wan = ""
            for dd in device_list:
                if dd["wan1Ip"]:
                    primary_wan = dd["wan1Ip"]
                    break
                elif dd["publicIp"]:
                    primary_wan = dd["publicIp"]
                    break

            snapshot["networks"].append({
                "name": net.get("name", ""),
                "id": net_id,
                "productTypes": net.get("productTypes", []),
                "tags": net.get("tags", []),
                "primaryWanIp": primary_wan,
                "devices": device_list,
            })

        logger.info(f"Snapshot: {len(snapshot['networks'])} networks, "
                     f"{sum(len(n['devices']) for n in snapshot['networks'])} devices")
    except Exception as e:
        logger.warning(f"Snapshot: failed to load Meraki data: {e}")

    # --- ThousandEyes agents ---
    try:
        from src.api.routes.thousandeyes import make_api_request
        data = await make_api_request("GET", "agents")
        agents_raw = data.get("agents", [])
        for a in agents_raw:
            if not a.get("enabled", True):
                continue
            snapshot["agents"].append({
                "agentId": a.get("agentId"),
                "agentName": a.get("agentName", ""),
                "agentType": a.get("agentType", ""),
                "location": a.get("location", ""),
                "countryId": a.get("countryId", ""),
                "ipAddresses": a.get("ipAddresses", []),
                "publicIpAddresses": a.get("publicIpAddresses", []),
            })
        logger.info(f"Snapshot: {len(snapshot['agents'])} TE agents")
    except Exception as e:
        logger.warning(f"Snapshot: failed to load TE agents: {e}")

    return snapshot


async def refresh_snapshot() -> Dict[str, Any]:
    """Build a fresh snapshot and write it to disk. Returns the snapshot."""
    snapshot = await build_snapshot()

    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(SNAPSHOT_PATH, "w") as f:
            json.dump(snapshot, f, indent=2, default=str)
        logger.info(f"Snapshot written to {SNAPSHOT_PATH} "
                     f"({len(snapshot['networks'])} networks, {len(snapshot['agents'])} agents)")
    except Exception as e:
        logger.error(f"Failed to write snapshot: {e}")

    return snapshot


def load_snapshot() -> Optional[Dict[str, Any]]:
    """Load the snapshot from disk. Returns None if file doesn't exist."""
    try:
        if SNAPSHOT_PATH.exists():
            with open(SNAPSHOT_PATH, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to read snapshot: {e}")
    return None


def get_snapshot_age_seconds() -> Optional[float]:
    """Return the age of the snapshot in seconds, or None if missing."""
    snapshot = load_snapshot()
    if not snapshot or "generated_at" not in snapshot:
        return None
    try:
        gen = datetime.fromisoformat(snapshot["generated_at"])
        return (datetime.now(timezone.utc) - gen).total_seconds()
    except Exception:
        return None
