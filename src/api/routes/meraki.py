"""API routes for meraki."""

import logging
from fastapi import APIRouter, HTTPException, Query, Depends, Request, Body
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_admin, require_editor, require_operator, require_viewer, get_async_dashboard
from src.api.models import *
from src.api.utils.audit import log_audit
from src.services.meraki_proxy import get_meraki_proxy
from typing import List, Optional, Dict, Any
import meraki
import meraki.aio
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────

async def get_org_for_device(serial: str) -> Optional[str]:
    """Auto-discover which organization a device belongs to.

    Tries all Meraki organizations until it finds the device.

    Args:
        serial: Device serial number

    Returns:
        Organization name if found, None otherwise
    """
    clusters = await credential_manager.list_clusters(active_only=True)

    for cluster in clusters:
        # Skip non-Meraki organizations
        if "meraki" not in cluster.url.lower():
            continue

        try:
            credentials = await credential_manager.get_credentials(cluster.name)
            if not credentials:
                continue

            dashboard = meraki.DashboardAPI(
                api_key=credentials["api_key"],
                base_url=credentials.get("base_url", "https://api.meraki.com/api/v1"),
                suppress_logging=True,
                output_log=False
            )

            # Try to get the device - if it succeeds, this is the right org
            device = dashboard.devices.getDevice(serial)
            if device:
                return cluster.name
        except Exception:
            continue  # Device not in this org, try next

    return None


# ──────────────────────────────────────────────────────────────
# Dynamic Proxy Endpoints (Access to ALL 823+ Meraki SDK Functions)
# ──────────────────────────────────────────────────────────────

@router.post("/api/meraki/proxy/call", dependencies=[Depends(require_editor)])
async def meraki_proxy_call(
    organization: str = Query(..., description="Organization name"),
    module: str = Query(..., description="Meraki SDK module (e.g., 'organizations', 'networks', 'devices')"),
    function: str = Query(..., description="Function name (e.g., 'getOrganizations', 'getNetworkDevices')"),
    params: Optional[Dict[str, Any]] = Body(None, description="Function parameters")
):
    """Dynamic proxy to call ANY Meraki Dashboard API function.

    This endpoint provides access to ALL 823+ functions across all Meraki SDK modules including:
    - appliance (131 functions)
    - camera (46 functions)
    - cellularGateway (25 functions)
    - devices (28 functions)
    - networks (115 functions)
    - organizations (174 functions)
    - sensor (19 functions)
    - sm (50 functions)
    - switch (102 functions)
    - wireless (117 functions)
    - wirelessController (16 functions)
    - and more

    Examples:
        - Call organizations.getOrganizations():
          POST /api/meraki/proxy/call?organization=my-org&module=organizations&function=getOrganizations

        - Call networks.getNetworkDevices(networkId="N_123"):
          POST /api/meraki/proxy/call?organization=my-org&module=networks&function=getNetworkDevices
          Body: {"networkId": "N_123"}

        - Call devices.rebootDevice(serial="Q234-ABCD-5678"):
          POST /api/meraki/proxy/call?organization=my-org&module=devices&function=rebootDevice
          Body: {"serial": "Q234-ABCD-5678"}
    """
    try:
        proxy = get_meraki_proxy()
        result = await proxy.call_meraki_function(
            organization=organization,
            module_name=module,
            function_name=function,
            **(params or {})
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/proxy/functions", dependencies=[Depends(require_viewer)])
async def meraki_list_available_functions(
    module: Optional[str] = Query(None, description="Filter by specific module")
):
    """List all available Meraki Dashboard API functions.

    Returns a comprehensive list of all 823+ available functions organized by module.
    Optionally filter to a specific module to see only its functions.

    Examples:
        - List all functions: GET /api/meraki/proxy/functions
        - List only organizations functions: GET /api/meraki/proxy/functions?module=organizations
    """
    try:
        proxy = get_meraki_proxy()
        result = await proxy.get_available_functions(module_name=module)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────
# Original Static Endpoints (Preserved for Backwards Compatibility)
# ──────────────────────────────────────────────────────────────

@router.get("/api/meraki/get_organizations/", dependencies=[Depends(require_viewer)])
async def meraki_get_organizations(organization: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganizations()



@router.get("/api/meraki/organizations", dependencies=[Depends(require_viewer)])
async def meraki_get_organizations_v2(organization: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganizations()



@router.get("/api/meraki/organizations/{org_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_details(organization: str, org_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganization(org_id)



@router.get("/api/meraki/get_organization_devices/{organization_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_devices(organization: str, organization_id: str):
    """Get organization devices with status information merged in."""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Fetch both devices and their statuses
        devices = await aiomeraki.organizations.getOrganizationDevices(organization_id)
        statuses = await aiomeraki.organizations.getOrganizationDevicesStatuses(organization_id)

        # Create a lookup dict for statuses by serial number
        status_lookup = {}
        if statuses and isinstance(statuses, list):
            for status_item in statuses:
                serial = status_item.get('serial')
                if serial:
                    status_lookup[serial] = status_item.get('status', 'unknown')

        # Merge status into each device
        if devices and isinstance(devices, list):
            for device in devices:
                serial = device.get('serial')
                if serial and serial in status_lookup:
                    device['status'] = status_lookup[serial]
                else:
                    device['status'] = 'unknown'

        return devices



@router.get("/api/meraki/get_organization_networks/{organization_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_networks(organization: str, organization_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganizationNetworks(organization_id)



@router.get("/api/meraki/get_organization_uplinks_statuses/{organization_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_uplinks_statuses(organization: str, organization_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganizationUplinksStatuses(organization_id)



@router.get("/api/meraki/organizations/{organization_id}/devices/statuses/overview", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_devices_statuses_overview(organization: str, organization_id: str):
    """Get device statuses overview for an organization."""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.organizations.getOrganizationDevicesStatusesOverview(organization_id)



@router.get("/api/meraki/organizations/{org_id}/inventory", dependencies=[Depends(require_viewer)])
async def meraki_generate_network_inventory_report(
    organization: str,
    org_id: str,
    include_clients: bool = Query(False)
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        devices = await aiomeraki.organizations.getOrganizationDevices(org_id)
        if include_clients:
            # Add client count per network if needed — expand as required
            pass
        return devices


# ──────────────────────────────────────────────────────────────
# Devices
# ──────────────────────────────────────────────────────────────


@router.get("/api/meraki/devices/{serial}/health", dependencies=[Depends(require_viewer)])
async def meraki_analyze_device_health(
    organization: str,
    serial: str,
    time_span: int = Query(86400, ge=300, le=2592000),
    ip: str = Query(None, description="Destination IP for loss/latency test (defaults to 8.8.8.8)")
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Get uplink info first
        try:
            uplink = await aiomeraki.devices.getDeviceUplink(serial)
        except Exception:
            uplink = None

        # Get loss/latency history - requires a destination IP
        loss_latency = None
        test_ip = ip or "8.8.8.8"  # Default to Google DNS if no IP specified
        try:
            loss_latency = await aiomeraki.devices.getDeviceLossAndLatencyHistory(
                serial, test_ip, timespan=time_span
            )
        except Exception as e:
            # Some devices don't support loss/latency history
            loss_latency = {"timeSeries": [], "error": str(e)}

        return {"lossAndLatency": loss_latency, "uplink": uplink}


# ──────────────────────────────────────────────────────────────
# Networks
# ──────────────────────────────────────────────────────────────


@router.get("/api/meraki/networks", dependencies=[Depends(require_viewer)])
async def meraki_list_networks(organization: str):
    """List all networks for a Meraki organization.

    Args:
        organization: Organization name to get networks for

    Returns:
        List of networks with id, name, organizationId, productTypes, timeZone
    """
    # Try clusters table first
    credentials = await credential_manager.get_credentials(organization)

    # If not found, check credential_pool (includes system_config)
    if not credentials:
        try:
            from src.services.credential_pool import get_initialized_pool
            pool = await get_initialized_pool()
            # Pass organization as both org_id and org_name for flexible matching
            meraki_cred = pool.get_for_meraki(
                organization_id=organization,
                organization_name=organization
            )
            if meraki_cred:
                api_key = meraki_cred.credentials.get("api_key") or meraki_cred.credentials.get("meraki_api_key")
                if api_key:
                    credentials = {
                        "api_key": api_key,
                        "base_url": "https://api.meraki.com/api/v1",
                        "verify_ssl": False,
                    }
                    logger.info(f"Found Meraki credentials from credential_pool for org: {organization}")
        except Exception as e:
            logger.warning(f"Error checking credential_pool: {e}")

    if not credentials:
        raise HTTPException(
            status_code=400,
            detail=f"No credentials found for organization: {organization}. Please configure Meraki API key in Settings."
        )

    if "meraki" not in credentials.get("base_url", "").lower():
        raise HTTPException(
            status_code=400,
            detail="Not a valid Meraki organization"
        )

    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Determine the Meraki organization ID
        # The organization parameter could be:
        # 1. A Meraki org ID (e.g., "123456") - from system_config credentials
        # 2. A cluster name (e.g., "my-meraki") - from clusters table

        orgs = await aiomeraki.organizations.getOrganizations()
        org_id = None

        # Check if organization parameter is a Meraki org ID (numeric string)
        if organization.isdigit():
            # Verify this org ID exists in the accessible orgs
            for org in orgs:
                if str(org["id"]) == organization:
                    org_id = organization
                    break

        # If not found as org ID, try matching by name
        if not org_id:
            org_id = credentials.get("org_id")
            if not org_id:
                # Try to match org by name
                org_lower = organization.lower()
                for org in orgs:
                    if org.get("name", "").lower() == org_lower:
                        org_id = str(org["id"])
                        break

        # Fallback to first available org
        if not org_id and orgs:
            org_id = str(orgs[0]["id"])
            logger.info(f"Using first available Meraki org: {org_id}")

        if not org_id:
            raise HTTPException(status_code=404, detail="Organization not found")

        networks = await aiomeraki.organizations.getOrganizationNetworks(org_id)
        return networks


@router.get("/api/meraki/networks/{network_id}/clients", dependencies=[Depends(require_viewer)])
async def meraki_get_network_clients(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(2592000)
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.networks.getNetworkClients(network_id, timespan=timespan)



@router.get("/api/meraki/networks/{network_id}/settings", dependencies=[Depends(require_viewer)])
async def meraki_get_network_settings(organization: str, network_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.networks.getNetwork(network_id)



@router.get("/api/meraki/get_firewall_rules/{network_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_firewall_rules(organization: str, network_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.appliance.getNetworkApplianceFirewallL3FirewallRules(network_id)



@router.get("/api/meraki/get_network_topology/{network_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_network_topology(organization: str, network_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        return await aiomeraki.networks.getNetworkTopologyLinkLayer(network_id)


# ──────────────────────────────────────────────────────────────
# Switch Ports
# ──────────────────────────────────────────────────────────────


@router.get("/api/meraki/devices/{serial}/switch/ports/{port_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_port_config(organization: str, serial: str, port_id: str):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        ports = await aiomeraki.switch.getDeviceSwitchPorts(serial)
        port = next((p for p in ports if str(p["portId"]) == port_id), None)
        if not port:
            raise HTTPException(status_code=404, detail="Port not found")
        return port


# ──────────────────────────────────────────────────────────────
# Advanced / AI-Powered Endpoints (you can keep your custom logic)
# ──────────────────────────────────────────────────────────────


@router.get("/api/meraki/networks/{network_id}/topology/analyze", dependencies=[Depends(require_viewer)])
async def meraki_analyze_network_topology(
    organization: str,
    network_id: str,
    include_clients: bool = Query(False)
):
    """Return topology data for network visualization.
    Falls back to building from devices if link layer API unavailable."""
    credentials = await credential_manager.get_credentials(organization)
    if not credentials:
        raise HTTPException(status_code=400, detail=f"No credentials found for organization: {organization}")

    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Get org_id from credentials or fetch from API
        org_id = credentials.get("org_id")
        if not org_id:
            orgs = await aiomeraki.organizations.getOrganizations()
            if orgs:
                org_id = orgs[0]["id"]

        # Always fetch devices from the network to ensure we have all devices
        # (link layer topology may not include MT sensors, MV cameras, etc.)
        devices = await aiomeraki.networks.getNetworkDevices(network_id)

        # Get device statuses (only if we have org_id)
        statuses = []
        if org_id:
            try:
                statuses = await aiomeraki.organizations.getOrganizationDevicesStatuses(org_id)
            except Exception:
                pass  # Proceed without status data

        # Create status map by serial
        status_map = {s.get("serial"): s for s in statuses}

        # Build nodes from all devices in the network
        nodes = []
        for dev in devices:
            serial = dev.get("serial", "")
            status_info = status_map.get(serial, {})
            nodes.append({
                "id": serial,
                "serial": serial,
                "name": dev.get("name") or dev.get("model", "Unknown"),
                "model": dev.get("model", ""),
                "mac": dev.get("mac", ""),
                "lanIp": dev.get("lanIp"),
                "wan1Ip": dev.get("wan1Ip"),
                "lat": dev.get("lat"),
                "lng": dev.get("lng"),
                "firmware": dev.get("firmware"),
                "status": status_info.get("status", "unknown"),
                "networkId": network_id,
            })

        # Try to get link layer topology for more accurate edge connections
        link_layer_edges = []
        try:
            link_layer = await aiomeraki.networks.getNetworkTopologyLinkLayer(network_id)
            if link_layer and link_layer.get("links"):
                # Extract edges from link layer topology
                for link in link_layer.get("links", []):
                    if link.get("ends") and len(link["ends"]) >= 2:
                        end0 = link["ends"][0]
                        end1 = link["ends"][1]
                        source = end0.get("device", {}).get("serial") or end0.get("node", {}).get("derivedId")
                        target = end1.get("device", {}).get("serial") or end1.get("node", {}).get("derivedId")
                        if source and target:
                            link_layer_edges.append({"source": source, "target": target, "type": "ethernet"})
        except Exception:
            # Link layer not available - will build edges manually
            pass

        # Build edges - use link layer if available, otherwise build manually
        edges = []
        node_serials = {n["serial"] for n in nodes}

        if link_layer_edges:
            # Use link layer edges, but only for nodes we have
            for edge in link_layer_edges:
                if edge["source"] in node_serials and edge["target"] in node_serials:
                    edges.append(edge)

        # Build manual edges for device types not in link layer topology
        # Categorize devices by type for proper hierarchy
        mx_devices = [n for n in nodes if n["model"].upper().startswith("MX") or n["model"].upper().startswith("Z")]
        ms_devices = [n for n in nodes if n["model"].upper().startswith("MS")]
        mr_devices = [n for n in nodes if n["model"].upper().startswith("MR") or n["model"].upper().startswith("CW")]
        mt_devices = [n for n in nodes if n["model"].upper().startswith("MT")]  # IoT sensors - connect via wireless
        mv_devices = [n for n in nodes if n["model"].upper().startswith("MV")]  # Cameras - connect via ethernet
        mg_devices = [n for n in nodes if n["model"].upper().startswith("MG")]  # Cellular gateways

        # Track which devices have edges
        connected_devices = set()
        for edge in edges:
            connected_devices.add(edge["source"])
            connected_devices.add(edge["target"])

        # Connect unconnected MX to switches (if not already connected via link layer)
        for mx in mx_devices:
            if mx["serial"] not in connected_devices:
                for ms in ms_devices:
                    edges.append({"source": mx["serial"], "target": ms["serial"], "type": "ethernet"})
                # If no switches, connect MX directly to APs
                if not ms_devices:
                    for mr in mr_devices:
                        edges.append({"source": mx["serial"], "target": mr["serial"], "type": "ethernet"})

        # Connect unconnected switches to APs
        for ms in ms_devices:
            for mr in mr_devices:
                if mr["serial"] not in connected_devices:
                    edges.append({"source": ms["serial"], "target": mr["serial"], "type": "ethernet"})
                    connected_devices.add(mr["serial"])

        # Connect MT sensors (IoT) to APs via wireless - they communicate over BLE/WiFi to APs
        if mt_devices:
            if mr_devices:
                for mt in mt_devices:
                    if mt["serial"] not in connected_devices:
                        edges.append({"source": mr_devices[0]["serial"], "target": mt["serial"], "type": "wireless"})
                        connected_devices.add(mt["serial"])
            elif ms_devices:
                # Fallback to switch if no APs
                for mt in mt_devices:
                    if mt["serial"] not in connected_devices:
                        edges.append({"source": ms_devices[0]["serial"], "target": mt["serial"], "type": "ethernet"})
                        connected_devices.add(mt["serial"])

        # Connect MV cameras to switches via ethernet (they're wired devices)
        if mv_devices:
            if ms_devices:
                for mv in mv_devices:
                    if mv["serial"] not in connected_devices:
                        edges.append({"source": ms_devices[0]["serial"], "target": mv["serial"], "type": "ethernet"})
                        connected_devices.add(mv["serial"])
            elif mx_devices:
                for mv in mv_devices:
                    if mv["serial"] not in connected_devices:
                        edges.append({"source": mx_devices[0]["serial"], "target": mv["serial"], "type": "ethernet"})
                        connected_devices.add(mv["serial"])

        # Connect MG cellular gateways - typically at network edge
        if mg_devices:
            if mx_devices:
                for mg in mg_devices:
                    if mg["serial"] not in connected_devices:
                        edges.append({"source": mx_devices[0]["serial"], "target": mg["serial"], "type": "ethernet"})
                        connected_devices.add(mg["serial"])

        topology = {"nodes": nodes, "links": edges}

        # Optionally include client data as separate nodes
        client_nodes = []
        client_edges = []
        if include_clients:
            try:
                clients = await aiomeraki.networks.getNetworkClients(network_id, timespan=3600)

                # Build a lookup map of device serial -> device name from existing topology nodes
                topology_nodes = topology.get("nodes", [])
                device_name_map = {node.get("serial", node.get("id", "")): node.get("name", node.get("label", "Unknown")) for node in topology_nodes}

                # Group clients by the device they're connected to
                device_clients: dict = {}
                for client in clients:
                    device_serial = client.get("recentDeviceSerial")
                    if device_serial:
                        if device_serial not in device_clients:
                            device_clients[device_serial] = []
                        device_clients[device_serial].append(client)

                # Create client nodes (limit to top 20 per device to avoid clutter)
                for device_serial, device_client_list in device_clients.items():
                    # Sort by usage (most active first) and limit
                    sorted_clients = sorted(
                        device_client_list,
                        key=lambda c: c.get("usage", {}).get("sent", 0) + c.get("usage", {}).get("recv", 0),
                        reverse=True
                    )[:20]

                    # Get the connected device name
                    connected_device_name = device_name_map.get(device_serial, device_serial)

                    for client in sorted_clients:
                        client_id = client.get("id") or client.get("mac") or f"client-{len(client_nodes)}"
                        client_nodes.append({
                            "id": client_id,
                            "serial": client_id,  # Use ID as serial for consistency
                            "name": client.get("description") or client.get("dhcpHostname") or client.get("mac") or "Unknown Client",
                            "model": "Client",
                            "mac": client.get("mac", ""),
                            "lanIp": client.get("ip"),
                            "status": "online" if client.get("status") == "Online" else "offline",
                            "networkId": network_id,
                            "isClient": True,
                            "manufacturer": client.get("manufacturer"),
                            "os": client.get("os"),
                            "vlan": client.get("vlan"),
                            "ssid": client.get("ssid"),
                            "usage": client.get("usage"),
                            "connectedDeviceSerial": device_serial,
                            "connectedDeviceName": connected_device_name,
                            "recentDeviceName": client.get("recentDeviceName"),  # From API if available
                        })
                        # Create edge from device to client
                        client_edges.append({
                            "source": device_serial,
                            "target": client_id,
                            "type": "wireless" if client.get("ssid") else "ethernet"
                        })
            except Exception as e:
                # Log but don't fail
                pass

        # Merge client nodes and edges into topology
        if client_nodes:
            topology["nodes"] = topology.get("nodes", []) + client_nodes
            topology["links"] = topology.get("links", []) + client_edges

        return {"topology": topology, "includeClients": include_clients, "clientCount": len(client_nodes)}



@router.get("/api/meraki/networks/{network_id}/security-audit", dependencies=[Depends(require_viewer)])
async def meraki_audit_network_security(
    organization: str,
    network_id: str,
    include_recommendations: bool = Query(True)
):
    """Real security audit using actual Meraki endpoints"""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        tasks = [
            aiomeraki.appliance.getNetworkApplianceFirewallL3FirewallRules(network_id),
            aiomeraki.appliance.getNetworkApplianceFirewallL7FirewallRules(network_id),
            aiomeraki.appliance.getNetworkApplianceContentFiltering(network_id),
            aiomeraki.appliance.getNetworkApplianceSecurityEvents(network_id, timespan=604800),
            aiomeraki.switch.getNetworkSwitchAccessControlLists(network_id),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        return {
            "l3Rules": results[0] if not isinstance(results[0], Exception) else {"error": str(results[0])},
            "l7Rules": results[1] if not isinstance(results[1], Exception) else {"error": str(results[1])},
            "contentFiltering": results[2] if not isinstance(results[2], Exception) else {"error": str(results[2])},
            "securityEventsLast7Days": len(results[3]) if not isinstance(results[3], Exception) else 0,
            "switchAcls": results[4] if not isinstance(results[4], Exception) else {"error": str(results[4])},
            "recommendations": include_recommendations,
        }



@router.get("/api/meraki/networks/{network_id}/performance", dependencies=[Depends(require_viewer)])
async def meraki_analyze_network_performance(
    organization: str,
    network_id: str,
    time_span: int = Query(86400)
):
    """Get network performance metrics including traffic analysis, uplink performance, and channel utilization."""
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Define async helper functions that catch their own exceptions
        async def get_traffic():
            try:
                return await aiomeraki.networks.getNetworkTraffic(network_id, timespan=time_span)
            except Exception:
                return None

        async def get_uplink_loss_latency():
            try:
                # Get appliance uplink loss and latency history for MX devices
                return await aiomeraki.appliance.getNetworkApplianceUplinksUsageHistory(network_id, timespan=time_span)
            except Exception:
                return None

        async def get_channel_utilization():
            try:
                return await aiomeraki.wireless.getNetworkWirelessChannelUtilizationHistory(network_id, timespan=time_span)
            except Exception:
                return None

        # Run all tasks concurrently
        traffic, uplink, channel = await asyncio.gather(
            get_traffic(),
            get_uplink_loss_latency(),
            get_channel_utilization()
        )

        return {
            "trafficAnalysis": traffic if isinstance(traffic, (list, dict)) else None,
            "uplinkUsage": uplink if isinstance(uplink, (list, dict)) else None,
            "channelUtilization": channel if isinstance(channel, (list, dict)) else None,
            "timespan": time_span,
        }


@router.get("/api/meraki/organizations/{organization_id}/vpn/topology", dependencies=[Depends(require_viewer)])
async def meraki_get_org_vpn_topology(
    organization: str,
    organization_id: str
):
    """Get organization-wide VPN topology showing hub-spoke network connections.

    Returns networks as nodes and VPN tunnels as edges, with status information.
    """
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Fetch all networks and VPN statuses in parallel
        networks_task = aiomeraki.organizations.getOrganizationNetworks(organization_id)
        vpn_statuses_task = aiomeraki.appliance.getOrganizationApplianceVpnStatuses(organization_id)
        device_statuses_task = aiomeraki.organizations.getOrganizationDevicesStatuses(organization_id)

        networks, vpn_statuses, device_statuses = await asyncio.gather(
            networks_task, vpn_statuses_task, device_statuses_task, return_exceptions=True
        )

        if isinstance(networks, Exception):
            raise HTTPException(status_code=500, detail=f"Failed to fetch networks: {str(networks)}")

        vpn_statuses_list = vpn_statuses if not isinstance(vpn_statuses, Exception) else []
        device_statuses_list = device_statuses if not isinstance(device_statuses, Exception) else []

        # Build a map of network VPN status by networkId
        vpn_status_map = {}
        for status in vpn_statuses_list:
            net_id = status.get("networkId")
            if net_id:
                vpn_status_map[net_id] = status

        # Build a map of network -> device statuses to determine network online/offline
        network_device_status_map = {}
        for device in device_statuses_list:
            net_id = device.get("networkId")
            if net_id:
                if net_id not in network_device_status_map:
                    network_device_status_map[net_id] = []
                network_device_status_map[net_id].append(device.get("status", "unknown"))

        # Fetch VPN site-to-site configuration for each network with an MX
        # to determine hub/spoke mode
        vpn_configs = {}
        mx_networks = [n for n in networks if "appliance" in (n.get("productTypes") or [])]

        if mx_networks:
            config_tasks = []
            for net in mx_networks:
                config_tasks.append(
                    aiomeraki.appliance.getNetworkApplianceVpnSiteToSiteVpn(net["id"])
                )

            config_results = await asyncio.gather(*config_tasks, return_exceptions=True)

            for i, net in enumerate(mx_networks):
                result = config_results[i]
                if not isinstance(result, Exception):
                    vpn_configs[net["id"]] = result

        # Build topology nodes (networks)
        nodes = []
        hub_networks = set()

        for net in networks:
            net_id = net.get("id")
            vpn_config = vpn_configs.get(net_id, {})
            vpn_status = vpn_status_map.get(net_id, {})

            mode = vpn_config.get("mode", "none")
            is_hub = mode == "hub"
            is_spoke = mode == "spoke"

            if is_hub:
                hub_networks.add(net_id)

            # Determine node status based on actual device statuses (not VPN peer data)
            peers = vpn_status.get("vpnPeers", [])
            device_statuses_for_network = network_device_status_map.get(net_id, [])

            # Determine network status from device statuses
            has_online = any(s == "online" for s in device_statuses_for_network)
            has_alerting = any(s == "alerting" for s in device_statuses_for_network)
            all_offline = all(s == "offline" for s in device_statuses_for_network) if device_statuses_for_network else False

            # Priority: offline (all devices offline) > alerting > online
            if all_offline and device_statuses_for_network:
                node_status = "offline"
            elif has_alerting:
                node_status = "alerting"
            elif has_online:
                node_status = "online"
            else:
                # No device status data available, default to online (network exists)
                node_status = "online"

            # Extract hub connections for spokes
            hubs = vpn_config.get("hubs", [])

            nodes.append({
                "id": net_id,
                "name": net.get("name", "Unnamed Network"),
                "type": "hub" if is_hub else "spoke" if is_spoke else "standalone",
                "vpnMode": mode,
                "status": node_status,
                "productTypes": net.get("productTypes", []),
                "timeZone": net.get("timeZone"),
                "peerCount": len(peers),
                "connectedHubs": [h.get("hubId") for h in hubs],
                "subnets": vpn_config.get("subnets", []),
                "merakiVpnPeers": [
                    {
                        "networkId": p.get("networkId"),
                        "networkName": p.get("networkName"),
                        "reachability": p.get("reachability"),
                    }
                    for p in peers
                ],
            })

        # Build topology edges (VPN tunnels)
        edges = []
        seen_edges = set()

        for node in nodes:
            if node["type"] == "spoke" and node["connectedHubs"]:
                for hub_id in node["connectedHubs"]:
                    # Create a canonical edge key to avoid duplicates
                    edge_key = tuple(sorted([node["id"], hub_id]))
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)

                        # Find the VPN peer status for this connection
                        peer_status = next(
                            (p for p in node.get("merakiVpnPeers", []) if p.get("networkId") == hub_id),
                            {}
                        )

                        # Default to "reachable" for configured connections without status data
                        # (the VPN status API may not return data for all connections)
                        reachability = peer_status.get("reachability")
                        if not reachability:
                            # Check if both endpoints have online devices
                            spoke_status = node.get("status", "online")
                            hub_node = next((n for n in nodes if n["id"] == hub_id), {})
                            hub_status = hub_node.get("status", "online")
                            if spoke_status == "online" and hub_status == "online":
                                reachability = "reachable"
                            else:
                                reachability = "unknown"

                        edges.append({
                            "source": node["id"],
                            "target": hub_id,
                            "type": "vpn",
                            "status": reachability,
                        })

            # Also add edges from VPN peers that might not be explicit hub connections
            for peer in node.get("merakiVpnPeers", []):
                peer_id = peer.get("networkId")
                if peer_id:
                    edge_key = tuple(sorted([node["id"], peer_id]))
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)
                        edges.append({
                            "source": node["id"],
                            "target": peer_id,
                            "type": "vpn",
                            "status": peer.get("reachability", "unknown"),
                        })

        return {
            "organizationId": organization_id,
            "nodes": nodes,
            "edges": edges,
            "summary": {
                "totalNetworks": len(networks),
                "hubCount": len(hub_networks),
                "spokeCount": sum(1 for n in nodes if n["type"] == "spoke"),
                "standaloneCount": sum(1 for n in nodes if n["type"] == "standalone"),
                "totalVpnTunnels": len(edges),
            }
        }



@router.get("/api/meraki/organizations/{org_id}/configuration-drift", dependencies=[Depends(require_viewer)])
async def meraki_analyze_configuration_drift(
    organization: str,
    org_id: str,
    network_ids: Optional[List[str]] = Query(None)
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        networks = await aiomeraki.organizations.getOrganizationNetworks(org_id)
        if network_ids:
            networks = [n for n in networks if n["id"] in network_ids]

        # Simple drift: compare VLANs and SSIDs across networks
        drift_report = []
        for net in networks:
            vlans = await aiomeraki.switch.getNetworkSwitchVlans(net["id"])
            ssids = await aiomeraki.wireless.getNetworkWirelessSsids(net["id"])
            drift_report.append({
                "network": net["name"],
                "networkId": net["id"],
                "vlanCount": len(vlans),
                "ssidCount": len([s for s in ssids if s.get("enabled")]),
            })
        return {"driftReport": drift_report, "comparedNetworks": len(networks)}



@router.get("/api/meraki/connectivity/test", dependencies=[Depends(require_operator)])
async def meraki_troubleshoot_connectivity(
    organization: str,
    source_ip: str = Query(...),
    destination_ip: str = Query(...),
    network_id: str = Query(...)
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        # Find a device in the network to run ping from (prefer MX)
        devices = await aiomeraki.networks.getNetworkDevices(network_id)
        mx = next((d for d in devices if d["model"].startswith("MX")), devices[0])

        ping = await aiomeraki.liveTools.createDeviceLiveToolsPing(
            serial=mx["serial"],
            target=destination_ip,
            count=4
        )
        return {"pingRequestId": ping["requestId"], "fromDevice": mx["name"]}



@router.get("/api/meraki/networks/{network_id}/client-experience", dependencies=[Depends(require_viewer)])
async def meraki_analyze_client_experience(
    organization: str,
    network_id: str,
    time_span: int = Query(86400)
):
    async with (await get_async_dashboard(organization)) as aiomeraki:
        stats = await aiomeraki.wireless.getNetworkWirelessConnectionStats(network_id, timespan=time_span)
        failed = await aiomeraki.wireless.getNetworkWirelessFailedConnections(network_id, timespan=time_span)
        
        total = stats.get("connectionSuccess", 0) + stats.get("connectionFailure", 0)
        success_rate = (stats.get("connectionSuccess", 0) / total * 100) if total > 0 else 0

        return {
            "successRatePercent": round(success_rate, 2),
            "totalConnections": total,
            "failedConnections": len(failed),
            "score": "Excellent" if success_rate > 95 else "Good" if success_rate > 85 else "Poor",
        }


@router.get("/api/meraki/organizations/{org_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_details(
    organization: str,
    org_id: str
):
    """Get detailed information about a Meraki organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganization(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/networks", dependencies=[Depends(require_viewer)])
async def meraki_get_networks(
    organization: str,
    org_id: str
):
    """List all networks in an organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getOrganizationNetworks(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/devices", dependencies=[Depends(require_viewer)])
async def meraki_get_devices(
    organization: str,
    org_id: str
):
    """List all devices in an organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.getOrganizationDevices(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/organizations/{org_id}/networks", dependencies=[Depends(require_editor)])
async def meraki_create_network(
    organization: str,
    org_id: str,
    name: str = Query(..., description="Network name"),
    productTypes: List[str] = Query(..., description="Product types: wireless, appliance, switch, camera"),
    tags: Optional[List[str]] = Query(None),
    copyFromNetworkId: Optional[str] = Query(None)
):
    """Create a new network in the organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.createOrganizationNetwork(
            org_id,
            name=name,
            productTypes=productTypes,
            tags=tags,
            copyFromNetworkId=copyFromNetworkId
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/api/meraki/networks/{network_id}", dependencies=[Depends(require_editor)])
async def meraki_delete_network(
    organization: str,
    network_id: str
):
    """Delete a network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.deleteNetwork(network_id)
        return {"success": True, "message": "Network deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/status", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_status(
    organization: str,
    org_id: str
):
    """Get high-level status of the organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganization(org_id)
        return {
            "id": result["id"],
            "name": result["name"],
            "url": result["url"],
            "api": {"enabled": result.get("api", {}).get("enabled", False)}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/inventory", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_inventory(
    organization: str,
    org_id: str
):
    """Get full device inventory for the organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationInventoryDevices(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/licenses", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_license(
    organization: str,
    org_id: str
):
    """Get license overview for the organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationLicenseOverview(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/config-changes", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_conf_change(
    organization: str,
    org_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get recent configuration changes"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationConfigurationChanges(
            org_id, timespan=timespan
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_network_details(
    organization: str,
    network_id: str
):
    """Get full network object"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetwork(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/networks/{network_id}/devices", dependencies=[Depends(require_viewer)])
async def meraki_get_network_devices(
    organization: str,
    network_id: str
):
    """Get all devices in a network"""
    try:
        async with (await get_async_dashboard(organization)) as aiomeraki:
            devices = await aiomeraki.networks.getNetworkDevices(network_id)
            return devices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}", dependencies=[Depends(require_editor)])
async def meraki_update_network(
    organization: str,
    network_id: str,
    update_data: dict = Body(...)
):
    """Update network settings (name, timezone, tags, etc.)"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.updateNetwork(network_id, **update_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/clients", dependencies=[Depends(require_viewer)])
async def meraki_get_clients(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400, description="Timespan in seconds")
):
    """Get clients seen on the network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkClients(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/clients/{client_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_client_details(
    organization: str,
    network_id: str,
    client_id: str
):
    """Get detailed info about a specific client"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.clients.getClient(network_id, client_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/clients/{client_id}/usage", dependencies=[Depends(require_viewer)])
async def meraki_get_client_usage(
    organization: str,
    network_id: str,
    client_id: str
):
    """Get traffic usage history for a client"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.clients.getClientUsageHistory(network_id, client_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/clients/{client_id}/policy", dependencies=[Depends(require_viewer)])
async def meraki_get_client_policy(
    organization: str,
    network_id: str,
    client_id: str
):
    """Get current policy applied to a client"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.clients.getClientPolicy(network_id, client_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/clients/{client_id}/policy", dependencies=[Depends(require_editor)])
async def meraki_update_client_policy(
    organization: str,
    network_id: str,
    client_id: str,
    device_policy: str = Body(..., embed=True),
    group_policy_id: Optional[str] = Body(None, embed=True)
):
    """Update client policy (e.g., Normal, Blocked, Group Policy)"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.clients.updateClientPolicy(
            network_id,
            client_id,
            devicePolicy=device_policy,
            groupPolicyId=group_policy_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/traffic", dependencies=[Depends(require_viewer)])
async def meraki_get_network_traffic(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get network traffic analysis"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkTraffic(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}", dependencies=[Depends(require_viewer)])
async def meraki_get_device_details(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get full device information.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = dashboard.devices.getDevice(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/devices/{serial}", dependencies=[Depends(require_editor)])
async def meraki_update_device(
    organization: str,
    serial: str,
    device_settings: dict = Body(...)
):
    """Update device name, tags, address, etc."""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.updateDevice(serial, **device_settings)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/networks/{network_id}/claim", dependencies=[Depends(require_editor)])
async def meraki_claim_devices(
    organization: str,
    network_id: str,
    serials: List[str] = Body(..., embed=True)
):
    """Claim devices into a network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.claimNetworkDevices(network_id, serials=serials)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/remove", dependencies=[Depends(require_editor)])
async def meraki_remove_device(
    organization: str,
    serial: str
):
    """Remove device from organization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.removeDevice(serial)
        return {"success": True, "message": "Device removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/reboot", dependencies=[Depends(require_operator)])
async def meraki_reboot_device(
    organization: str,
    serial: str
):
    """Reboot a device"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.rebootDevice(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/clients", dependencies=[Depends(require_viewer)])
async def meraki_get_device_clients(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)"),
    timespan: Optional[int] = Query(86400)
):
    """Get clients connected to a specific device.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = dashboard.devices.getDeviceClients(serial, timespan=timespan)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/status", dependencies=[Depends(require_viewer)])
async def meraki_get_device_status(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get live status of a device.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = dashboard.devices.getDeviceStatus(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/uplink", dependencies=[Depends(require_viewer)])
async def meraki_get_device_uplink(
    organization: str,
    serial: str
):
    """Get uplink status and details"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.getDeviceUplink(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/ssids", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_ssids(
    organization: str,
    network_id: str
):
    """List all SSIDs in a wireless network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessSsids(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/wireless/ssids/{ssid_number}", dependencies=[Depends(require_editor)])
async def meraki_update_wireless_ssid(
    organization: str,
    network_id: str,
    ssid_number: int,
    ssid_settings: dict = Body(...)
):
    """Update SSID settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.updateNetworkWirelessSsid(network_id, ssid_number, **ssid_settings)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/settings", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_settings(
    organization: str,
    network_id: str
):
    """Get wireless settings for the network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessSettings(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/switch/ports", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_ports(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get all switch ports for a device.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.getDeviceSwitchPorts(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/devices/{serial}/switch/ports/{port_id}", dependencies=[Depends(require_editor)])
async def meraki_update_switch_port(
    organization: str,
    serial: str,
    port_id: str,
    name: Optional[str] = None,
    tags: Optional[List[str]] = None,
    enabled: Optional[bool] = None,
    vlan: Optional[int] = None
):
    """Update a switch port configuration"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        update_payload = {}
        if name is not None: update_payload["name"] = name
        if tags is not None: update_payload["tags"] = tags
        if enabled is not None: update_payload["enabled"] = enabled
        if vlan is not None: update_payload["vlan"] = vlan

        result = await dashboard.switch.updateDeviceSwitchPort(serial, port_id, **update_payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/switch/vlans", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_vlans(
    organization: str,
    network_id: str
):
    """List VLANs in a network"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.getNetworkSwitchVlans(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/networks/{network_id}/switch/vlans", dependencies=[Depends(require_editor)])
async def meraki_create_switch_vlan(
    organization: str,
    network_id: str,
    vlan_id: int = Body(..., embed=True),
    name: str = Body(..., embed=True),
    subnet: Optional[str] = Body(None, embed=True),
    appliance_ip: Optional[str] = Body(None, embed=True)
):
    """Create a new VLAN"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.createNetworkSwitchVlan(
            network_id,
            vlan_id,
            name=name,
            subnet=subnet,
            applianceIp=appliance_ip
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/networks/{network_id}/security/events", dependencies=[Depends(require_viewer)])
async def meraki_get_security_center(
    organization: str,
    network_id: str
):
    """Get security events (Security Center equivalent)"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceSecurityEvents(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/vpn/status", dependencies=[Depends(require_viewer)])
async def meraki_get_vpn_status(
    organization: str,
    network_id: str
):
    """Get Site-to-Site VPN status"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceVpnStatuses(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/firewall/l3/rules", dependencies=[Depends(require_viewer)])
async def meraki_get_firewall_rules(
    organization: str,
    network_id: str
):
    """Get L3 firewall rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceFirewallL3FirewallRules(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/firewall/l3/rules", dependencies=[Depends(require_editor)])
async def meraki_update_firewall_rules(
    organization: str,
    network_id: str,
    rules: List[Dict] = Body(...)
):
    """Update L3 firewall rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.updateNetworkApplianceFirewallL3FirewallRules(
            network_id, rules=rules
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/camera/video-settings", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_video_settings(
    organization: str,
    serial: str
):
    """Get video settings for a camera"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getDeviceCameraVideoSettings(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/camera/quality-retention", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_quality_settings(
    organization: str,
    network_id: str
):
    """Get camera quality and retention profiles"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getNetworkCameraQualityRetentionProfiles(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/admins", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_admins(
    organization: str,
    org_id: str
):
    """List organization administrators"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationAdmins(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/organizations/{org_id}/admins", dependencies=[Depends(require_admin)])
async def meraki_create_organization_admin(
    organization: str,
    org_id: str,
    email: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    org_access: str = Body(..., embed=True),
    tags: Optional[List[str]] = Body(None, embed=True),
    networks: Optional[List[Dict]] = Body(None, embed=True)
):
    """Create a new organization admin"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.createOrganizationAdmin(
            org_id, email=email, name=name, orgAccess=org_access, tags=tags, networks=networks
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/api-requests", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_api_requests(
    organization: str,
    org_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get recent API requests"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationApiRequests(org_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/webhook-logs", dependencies=[Depends(require_viewer)])
async def meraki_get_organization_webhook_logs(
    organization: str,
    org_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get webhook delivery logs"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationWebhookLogs(org_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/events", dependencies=[Depends(require_viewer)])
async def meraki_get_network_events(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400),
    per_page: Optional[int] = Query(100, le=1000)
):
    """Get network events"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkEvents(network_id, timespan=timespan, perPage=per_page)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/events/types", dependencies=[Depends(require_viewer)])
async def meraki_get_network_event_types(
    organization: str,
    network_id: str
):
    """Get available event types"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkEventsEventTypes(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/alerts/history", dependencies=[Depends(require_viewer)])
async def meraki_get_network_alerts_history(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get alert history"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkAlertsHistory(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/alerts/settings", dependencies=[Depends(require_viewer)])
async def meraki_get_network_alerts_settings(
    organization: str,
    network_id: str
):
    """Get alert settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.getNetworkAlertsSettings(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/alerts/settings", dependencies=[Depends(require_editor)])
async def meraki_update_network_alerts_settings(
    organization: str,
    network_id: str,
    default_destinations: Optional[Dict] = Body(None),
    alerts: Optional[List[Dict]] = Body(None)
):
    """Update alert settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.networks.updateNetworkAlertsSettings(
            network_id,
            defaultDestinations=default_destinations,
            alerts=alerts
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/live-tools/ping", dependencies=[Depends(require_operator)])
async def meraki_ping_device(
    organization: str,
    serial: str,
    target_ip: str = Body(..., embed=True),
    count: int = Body(5, ge=1, le=10, embed=True)
):
    """Run ping from device"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.liveTools.createDeviceLiveToolsPing(serial, target=target_ip, count=count)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/live-tools/ping/{ping_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_device_ping_results(
    organization: str,
    serial: str,
    ping_id: str
):
    """Get ping results"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.liveTools.getDeviceLiveToolsPing(ping_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/live-tools/cable-test", dependencies=[Depends(require_operator)])
async def meraki_cable_test_device(
    organization: str,
    serial: str,
    ports: List[str] = Body(..., embed=True)
):
    """Run cable test on switch ports"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.createDeviceSwitchCableTest(serial, ports=ports)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/live-tools/blink", dependencies=[Depends(require_operator)])
async def meraki_blink_device_leds(
    organization: str,
    serial: str,
    duration: int = Body(5, ge=1, le=60)
):
    """Blink device LEDs"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.blinkDeviceLeds(serial, duration=duration)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/wake-on-lan", dependencies=[Depends(require_operator)])
async def meraki_wake_on_lan_device(
    organization: str,
    serial: str,
    mac: str = Body(..., embed=True)
):
    """Send Wake-on-LAN packet"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.devices.wakeOnLan(serial, mac)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/rf-profiles", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_rf_profiles(
    organization: str,
    network_id: str
):
    """Get RF profiles"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessRfProfiles(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/channel-utilization", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_channel_utilization(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get channel utilization"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessChannelUtilizationHistory(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/signal-quality", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_signal_quality(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get signal quality history"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessSignalQualityHistory(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/wireless/connection-stats", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_connection_stats(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get connection statistics"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessConnectionStats(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/clients/{client_id}/connectivity", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_client_connectivity_events(
    organization: str,
    network_id: str,
    client_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get client connectivity events"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.wireless.getNetworkWirelessClientConnectivityEvents(network_id, client_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/switch/ports/status", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_port_statuses(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get live port statuses.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.getDeviceSwitchPortsStatuses(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/switch/ports/cycle", dependencies=[Depends(require_operator)])
async def meraki_cycle_switch_ports(
    organization: str,
    serial: str,
    ports: List[str] = Body(..., embed=True)
):
    """Cycle (power off/on) switch ports"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.cycleDeviceSwitchPorts(serial, ports=ports)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/devices/{serial}/appliance/uplinks", dependencies=[Depends(require_viewer)])
async def meraki_get_appliance_uplinks(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get MX/Z appliance uplink status.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        # Get uplink statuses for the appliance
        result = await dashboard.appliance.getDeviceApplianceUplinksSettings(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/devices/{serial}/wireless/status", dependencies=[Depends(require_viewer)])
async def meraki_get_wireless_status(
    serial: str,
    organization: Optional[str] = Query(None, description="Organization name (auto-discovered if not provided)")
):
    """Get MR access point RF status.

    If organization is not provided, will auto-discover which org the device belongs to.
    """
    try:
        # Auto-discover organization if not provided
        if not organization:
            organization = await get_org_for_device(serial)
            if not organization:
                raise HTTPException(status_code=404, detail=f"Device {serial} not found in any organization")

        credentials = await credential_manager.get_credentials(organization)
        if not credentials or "meraki" not in credentials.get("base_url", "").lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        # Get wireless radio settings (includes channel info)
        result = await dashboard.wireless.getDeviceWirelessStatus(serial)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/meraki/networks/{network_id}/switch/acl", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_access_control_lists(
    organization: str,
    network_id: str
):
    """Get switch ACL rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.getNetworkSwitchAccessControlLists(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/switch/acl", dependencies=[Depends(require_editor)])
async def meraki_update_switch_access_control_lists(
    organization: str,
    network_id: str,
    rules: List[Dict] = Body(...)
):
    """Update switch ACL rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.updateNetworkSwitchAccessControlLists(network_id, rules=rules)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/switch/qos/rules", dependencies=[Depends(require_viewer)])
async def meraki_get_switch_qos_rules(
    organization: str,
    network_id: str
):
    """Get QoS rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.getNetworkSwitchQosRules(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/networks/{network_id}/switch/qos/rules", dependencies=[Depends(require_editor)])
async def meraki_create_switch_qos_rule(
    organization: str,
    network_id: str,
    vlan: int = Body(...),
    protocol: str = Body(...),
    src_port: Optional[int] = Body(None),
    src_port_range: Optional[str] = Body(None),
    dst_port: Optional[int] = Body(None),
    dst_port_range: Optional[str] = Body(None),
    dscp: Optional[int] = Body(None)
):
    """Create QoS rule"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.switch.createNetworkSwitchQosRule(
            network_id,
            vlan=vlan,
            protocol=protocol,
            srcPort=src_port,
            srcPortRange=src_port_range,
            dstPort=dst_port,
            dstPortRange=dst_port_range,
            dscp=dscp
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/appliance/vpn/site-to-site", dependencies=[Depends(require_viewer)])
async def meraki_get_appliance_vpn_site_to_site(
    organization: str,
    network_id: str
):
    """Get Site-to-Site VPN config"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceVpnSiteToSiteVpn(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/appliance/vpn/site-to-site", dependencies=[Depends(require_editor)])
async def meraki_update_appliance_vpn_site_to_site(
    organization: str,
    network_id: str,
    mode: str = Body(...),
    hubs: Optional[List[Dict]] = Body(None),
    subnets: Optional[List[Dict]] = Body(None)
):
    """Update Site-to-Site VPN"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.updateNetworkApplianceVpnSiteToSiteVpn(
            network_id, mode=mode, hubs=hubs, subnets=subnets
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/appliance/content-filtering", dependencies=[Depends(require_viewer)])
async def meraki_get_appliance_content_filtering(
    organization: str,
    network_id: str
):
    """Get content filtering settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceContentFiltering(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/appliance/content-filtering", dependencies=[Depends(require_editor)])
async def meraki_update_appliance_content_filtering(
    organization: str,
    network_id: str,
    allowed_url_patterns: Optional[List[str]] = Body(None),
    blocked_url_patterns: Optional[List[str]] = Body(None),
    blocked_url_categories: Optional[List[str]] = Body(None),
    url_category_list_size: Optional[str] = Body(None)
):
    """Update content filtering"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.updateNetworkApplianceContentFiltering(
            network_id,
            allowedUrlPatterns=allowed_url_patterns,
            blockedUrlPatterns=blocked_url_patterns,
            blockedUrlCategories=blocked_url_categories,
            urlCategoryListSize=url_category_list_size
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/appliance/security-events", dependencies=[Depends(require_viewer)])
async def meraki_get_appliance_security_events(
    organization: str,
    network_id: str,
    timespan: Optional[int] = Query(86400)
):
    """Get security events"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceSecurityEvents(network_id, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/networks/{network_id}/appliance/traffic-shaping", dependencies=[Depends(require_viewer)])
async def meraki_get_appliance_traffic_shaping(
    organization: str,
    network_id: str
):
    """Get traffic shaping rules"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.getNetworkApplianceTrafficShaping(network_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/networks/{network_id}/appliance/traffic-shaping", dependencies=[Depends(require_operator)])
async def meraki_update_appliance_traffic_shaping(
    organization: str,
    network_id: str,
    global_bandwidth_limits: Optional[Dict] = Body(None)
):
    """Update global bandwidth limits"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.appliance.updateNetworkApplianceTrafficShaping(
            network_id, globalBandwidthLimits=global_bandwidth_limits
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/camera/analytics/live", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_analytics_live(
    organization: str,
    serial: str
):
    """Get live analytics"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getDeviceCameraAnalyticsLive(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/camera/analytics/overview", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_analytics_overview(
    organization: str,
    serial: str,
    timespan: Optional[int] = Query(86400)
):
    """Get analytics overview"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getDeviceCameraAnalyticsOverview(serial, timespan=timespan)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/camera/analytics/zones", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_analytics_zones(
    organization: str,
    serial: str
):
    """Get analytics zones"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getDeviceCameraAnalyticsZones(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/devices/{serial}/camera/snapshot", dependencies=[Depends(require_operator)])
async def meraki_generate_camera_snapshot(
    organization: str,
    serial: str,
    timestamp: Optional[str] = Body(None)
):
    """Generate snapshot"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.generateDeviceCameraSnapshot(serial, timestamp=timestamp)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/devices/{serial}/camera/sense", dependencies=[Depends(require_viewer)])
async def meraki_get_camera_sense(
    organization: str,
    serial: str
):
    """Get Sense settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.getDeviceCameraSense(serial)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.put("/api/meraki/devices/{serial}/camera/sense", dependencies=[Depends(require_editor)])
async def meraki_update_camera_sense(
    organization: str,
    serial: str,
    sense_enabled: Optional[bool] = Body(None),
    mqtt_broker_id: Optional[str] = Body(None),
    audio_detection: Optional[Dict] = Body(None)
):
    """Update Sense settings"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.camera.updateDeviceCameraSense(
            serial,
            senseEnabled=sense_enabled,
            mqttBrokerId=mqtt_broker_id,
            audioDetection=audio_detection
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/api/meraki/organizations/{org_id}/action-batches", dependencies=[Depends(require_editor)])
async def meraki_create_action_batch(
    organization: str,
    org_id: str,
    actions: List[Dict] = Body(...),
    confirmed: bool = Body(True),
    synchronous: bool = Body(False)
):
    """Create action batch"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.createOrganizationActionBatch(
            org_id, actions=actions, confirmed=confirmed, synchronous=synchronous
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/action-batches/{batch_id}", dependencies=[Depends(require_viewer)])
async def meraki_get_action_batch_status(
    organization: str,
    org_id: str,
    batch_id: str
):
    """Get action batch status"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationActionBatch(org_id, batch_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/meraki/organizations/{org_id}/action-batches", dependencies=[Depends(require_viewer)])
async def meraki_get_action_batches(
    organization: str,
    org_id: str
):
    """List action batches"""
    try:
        credentials = await credential_manager.get_credentials(organization)
        if "meraki" not in credentials["base_url"].lower():
            raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

        dashboard = meraki.DashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials["base_url"],
            suppress_logging=True,
            output_log=False
        )

        result = await dashboard.organizations.getOrganizationActionBatches(org_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


