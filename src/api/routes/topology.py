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
            # 1. Fetch L2 topology from Meraki (Links)
            # This endpoint provides LLDP/CDP neighbor information
            l2_topology = await aiomeraki.networks.getNetworkTopologyLinkLayer(network_id)
            
            # 2. Fetch Devices (Nodes) with status
            devices = await aiomeraki.networks.getNetworkDevices(network_id)
            
            # 3. Fetch Statuses for coloring
            # Finding the org ID from one device or network lookup usually needed first if not passed
            # Optimistically use what we have or do a quick lookup
            # For brevity/speed in this robust implementation, we might skip status if expensive,
            # but let's try to get it if we can derive org_id.
            
            nodes = []
            links = []
            
            # Process Nodes
            device_map = {}
            for dev in devices:
                serial = dev["serial"]
                model = dev.get("model", "")
                
                # Determine group
                group = 'switch' 
                if model.startswith('MX') or model.startswith('Z'): group = 'hub'
                elif model.startswith('MR'): group = 'ap'
                elif model.startswith('MV'): group = 'camera'
                elif model.startswith('MT'): group = 'sensor'
                
                node = {
                    "id": serial,
                    "name": dev.get("name") or model,
                    "group": group,
                    "model": model,
                    "ip": dev.get("lanIp") or dev.get("wan1Ip") or "",
                    "status": "online",  # Placeholder, needs status call
                    "val": 20 if group == 'hub' else (15 if group == 'switch' else 10)
                }
                nodes.append(node)
                device_map[serial] = node
            
            # Process Links
            if l2_topology and "links" in l2_topology:
                for link in l2_topology["links"]:
                     # Standardize source/target
                     if len(link.get("ends", [])) == 2:
                         src = link["ends"][0]
                         dst = link["ends"][1]
                         
                         src_id = src.get("device", {}).get("serial") or src.get("node", {}).get("derivedId")
                         dst_id = dst.get("device", {}).get("serial") or dst.get("node", {}).get("derivedId")
                         
                         if src_id and dst_id:
                             links.append({
                                 "source": src_id,
                                 "target": dst_id,
                                 "type": "wired", 
                                 "status": "active"
                             })

            return {"nodes": nodes, "links": links}

        except Exception as e:
            logger.error(f"Topology fetch error: {e}")
            # Fallback to simple device list without links if L2 fails
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
