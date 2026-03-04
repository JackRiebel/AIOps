"""API routes for Network Topology & Infrastructure."""

from fastapi import APIRouter, HTTPException, Query, Depends
from src.api.dependencies import get_async_dashboard, require_viewer
from typing import List, Optional, Dict, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/topology/graph", dependencies=[Depends(require_viewer)])
async def get_network_topology(
    organization: str = Query(..., description="Organization name"),
    network_id: str = Query(..., description="Network ID"),
    include_clients: bool = Query(False, description="Include clients in topology")
):
    """Get network topology graph for visualization."""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        try:
            # 1. Fetch L2 topology (links + discovered nodes)
            l2_topology = await aiomeraki.networks.getNetworkTopologyLinkLayer(network_id)

            # 2. Fetch managed devices
            devices = await aiomeraki.networks.getNetworkDevices(network_id)

            # 3. Fetch device statuses for the org
            device_statuses: Dict[str, str] = {}
            try:
                network_info = await aiomeraki.networks.getNetwork(network_id)
                org_id = network_info.get("organizationId")
                if org_id:
                    statuses = await aiomeraki.organizations.getOrganizationDevicesStatuses(
                        org_id, networkIds=[network_id], total_pages=-1
                    )
                    for s in statuses:
                        device_statuses[s["serial"]] = s.get("status", "online")
            except Exception:
                pass  # Fall back to default "online"

            # 4. Build derivedId→serial mapping from L2 topology nodes
            derived_to_serial: Dict[str, str] = {}
            if l2_topology and "nodes" in l2_topology:
                for topo_node in l2_topology["nodes"]:
                    derived_id = topo_node.get("derivedId")
                    dev_info = topo_node.get("device")
                    if derived_id and dev_info and dev_info.get("serial"):
                        derived_to_serial[derived_id] = dev_info["serial"]

            def _resolve_id(raw_id: str) -> str:
                """Resolve a derivedId to serial if possible."""
                return derived_to_serial.get(raw_id, raw_id)

            # 5. Process managed device nodes
            nodes = []
            device_map: Dict[str, dict] = {}
            for dev in devices:
                serial = dev["serial"]
                model = dev.get("model", "")

                group = 'switch'
                if model.startswith(('MX', 'Z')): group = 'hub'
                elif model.startswith('MR') or model.startswith('CW'): group = 'ap'
                elif model.startswith('MV'): group = 'camera'
                elif model.startswith('MT'): group = 'sensor'
                elif model.startswith('MG'): group = 'gateway'

                node = {
                    "id": serial,
                    "serial": serial,
                    "name": dev.get("name") or model,
                    "group": group,
                    "model": model,
                    "lanIp": dev.get("lanIp", ""),
                    "wan1Ip": dev.get("wan1Ip", ""),
                    "mac": dev.get("mac", ""),
                    "firmware": dev.get("firmware", ""),
                    "networkId": dev.get("networkId", network_id),
                    "status": device_statuses.get(serial, "online"),
                    "val": 20 if group == 'hub' else (15 if group == 'switch' else 10),
                }
                nodes.append(node)
                device_map[serial] = node

            # 6. Process L2 topology links — resolve derivedId to serial
            links = []
            if l2_topology and "links" in l2_topology:
                for link in l2_topology["links"]:
                    ends = link.get("ends", [])
                    if len(ends) != 2:
                        continue
                    src, dst = ends[0], ends[1]

                    src_id = src.get("device", {}).get("serial") or src.get("node", {}).get("derivedId")
                    dst_id = dst.get("device", {}).get("serial") or dst.get("node", {}).get("derivedId")
                    if not src_id or not dst_id:
                        continue

                    # Resolve derivedIds to device serials
                    src_id = _resolve_id(src_id)
                    dst_id = _resolve_id(dst_id)

                    # Create placeholder node for discovered (non-managed) endpoints
                    for end_id, end_data in [(src_id, src), (dst_id, dst)]:
                        if end_id not in device_map:
                            disc = end_data.get("discovered", {})
                            lldp = disc.get("lldp", {})
                            cdp = disc.get("cdp", {})
                            disc_name = lldp.get("systemName") or cdp.get("deviceId") or end_id[:12]
                            disc_model = cdp.get("platform") or ""
                            node = {
                                "id": end_id,
                                "serial": end_id,
                                "name": disc_name,
                                "group": "switch",
                                "model": disc_model,
                                "lanIp": lldp.get("managementAddress") or cdp.get("address") or "",
                                "wan1Ip": "",
                                "mac": end_data.get("node", {}).get("mac", ""),
                                "firmware": "",
                                "networkId": network_id,
                                "status": "online",
                                "val": 12,
                            }
                            nodes.append(node)
                            device_map[end_id] = node

                    links.append({
                        "source": src_id,
                        "target": dst_id,
                        "type": "wired",
                        "status": "active",
                    })

            return {"nodes": nodes, "links": links}

        except Exception as e:
            logger.error(f"Topology fetch error: {e}")
            return {"nodes": [], "links": []}


@router.get("/api/topology/switch/{serial}/ports", dependencies=[Depends(require_viewer)])
async def get_switch_ports_status(
    serial: str,
    organization: str = Query(..., description="Organization name"),
):
    """Get detailed status for all ports on a switch."""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Get standard port statuses (includes traffic, connection status)
        try:
            statuses = await aiomeraki.switch.getDeviceSwitchPortsStatuses(serial)
            # Get port configs for names/tags? (Optional, adds latency)
            
            ports = []
            for s in statuses:
                port_id = s.get("portId")
                status_str = s.get("status", "Disconnected").lower()
                
                # Normalize status for frontend
                mapped_status = "disconnected"
                if status_str == "connected": mapped_status = "connected"
                if not s.get("enabled", True): mapped_status = "disabled"
                if len(s.get("errors", [])) > 0: mapped_status = "alerting"
                
                ports.append({
                    "portId": port_id,
                    "number": int(port_id) if port_id.isdigit() else port_id,
                    "status": mapped_status,
                    "speed": s.get("speed"),
                    "usageMbps": (s.get("usageInKb",{}).get("total",0) / 1000) * 8, # Approx
                    "clientCount": s.get("clientCount", 0),
                    "poeUsage": 0 # Not in Status endpoint, needs getDeviceSwitchPortsStatusesPackets or Power?
                                  # Usually separate call per port or overall power budget
                })
                
            return {
                "deviceName": serial, # Todo: fetch name
                "ports": ports
            }
        except Exception as e:
            logger.error(f"Switch port fetch error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
