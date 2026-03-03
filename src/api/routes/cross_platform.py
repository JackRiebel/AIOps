"""Cross-platform IP correlation endpoint — shared by Splunk and ThousandEyes pages."""

from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any, Optional, List
import httpx
import logging

from src.api.dependencies import require_viewer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cross-platform", tags=["cross-platform"])


@router.post("/correlate-ips", dependencies=[Depends(require_viewer)])
async def correlate_ips(request: Dict[str, Any] = Body(...)):
    """Match IPs across Meraki, Catalyst, ThousandEyes, and Splunk.

    Accepts a list of IPs and returns matched devices from all configured platforms.
    """
    ips = request.get("ips", [])
    hostnames = request.get("hostnames", [])

    if not ips and not hostnames:
        return {"correlatedDevices": [], "platforms": {}}

    search_terms = set(ip.lower() for ip in ips) | set(h.lower() for h in hostnames)
    correlated = []
    platforms = {"meraki": False, "catalyst": False, "thousandeyes": False, "splunk": False}

    # 1. Fetch network cache for Meraki/Catalyst matches
    try:
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            cache_response = await client.get(
                "https://localhost:8002/api/network/cache",
                headers={"Content-Type": "application/json"},
            )
            if cache_response.status_code == 200:
                cache_data = cache_response.json()

                for org in cache_data.get("organizations", []):
                    for net in org.get("networks", []):
                        for dev in net.get("devices", []):
                            dev_ips = [
                                (dev.get("lanIp") or "").lower(),
                                (dev.get("wan1Ip") or "").lower(),
                                (dev.get("wan2Ip") or "").lower(),
                                (dev.get("managementIpAddress") or "").lower(),
                                (dev.get("ipAddress") or "").lower(),
                            ]
                            dev_names = [
                                (dev.get("name") or "").lower(),
                                (dev.get("hostname") or "").lower(),
                            ]

                            matched_ip = next((ip for ip in dev_ips if ip and ip in search_terms), None)
                            matched_name = next((n for n in dev_names if n and n in search_terms), None)

                            if matched_ip or matched_name:
                                is_catalyst = dev.get("platform") == "catalyst" or dev.get("source") == "catalyst"
                                platform = "catalyst" if is_catalyst else "meraki"
                                platforms[platform] = True

                                entry = {
                                    "ip": matched_ip or matched_name,
                                    "hostname": dev.get("name") or dev.get("hostname"),
                                    "platforms": [platform],
                                    "networkName": net.get("name"),
                                }

                                if platform == "meraki":
                                    entry["merakiDevice"] = {
                                        "serial": dev.get("serial"),
                                        "name": dev.get("name"),
                                        "model": dev.get("model"),
                                        "status": dev.get("status"),
                                        "networkName": net.get("name"),
                                    }
                                else:
                                    entry["catalystDevice"] = {
                                        "serial": dev.get("serialNumber"),
                                        "name": dev.get("hostname"),
                                        "model": dev.get("platformId"),
                                        "reachabilityStatus": dev.get("reachabilityStatus"),
                                    }

                                # Check if already exists, merge
                                existing = next((c for c in correlated if c["ip"] == entry["ip"]), None)
                                if existing:
                                    for key in ["merakiDevice", "catalystDevice"]:
                                        if key in entry and key not in existing:
                                            existing[key] = entry[key]
                                    if platform not in existing["platforms"]:
                                        existing["platforms"].append(platform)
                                else:
                                    correlated.append(entry)

    except Exception as e:
        logger.warning(f"Network cache fetch failed: {e}")

    # 2. Fetch ThousandEyes agents for agent IP matches
    try:
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            te_response = await client.get(
                "https://localhost:8002/api/thousandeyes/agents",
                params={"organization": "default"},
                headers={"Content-Type": "application/json"},
            )
            if te_response.status_code == 200:
                te_data = te_response.json()
                agents = te_data.get("_embedded", {}).get("agents", te_data.get("agents", []))

                for agent in agents:
                    agent_ips = [ip.lower() for ip in (agent.get("ipAddresses") or [])]
                    agent_name = (agent.get("agentName") or "").lower()

                    matched = any(ip in search_terms for ip in agent_ips) or (agent_name and agent_name in search_terms)
                    if matched:
                        platforms["thousandeyes"] = True
                        matched_ip = next((ip for ip in agent_ips if ip in search_terms), agent_name)

                        existing = next((c for c in correlated if c["ip"] == matched_ip), None)
                        te_info = {
                            "agentId": agent.get("agentId"),
                            "agentName": agent.get("agentName"),
                            "agentType": agent.get("agentType"),
                        }

                        if existing:
                            existing["teAgent"] = te_info
                            if "thousandeyes" not in existing["platforms"]:
                                existing["platforms"].append("thousandeyes")
                        else:
                            correlated.append({
                                "ip": matched_ip,
                                "hostname": agent.get("agentName"),
                                "teAgent": te_info,
                                "platforms": ["thousandeyes"],
                            })

    except Exception as e:
        logger.warning(f"ThousandEyes agent fetch failed: {e}")

    return {"correlatedDevices": correlated, "platforms": platforms}
