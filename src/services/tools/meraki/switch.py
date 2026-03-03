"""
Meraki Switch Tools

Provides tools for managing Meraki switches including:
- Switch ports configuration and status
- Switch stacks
- Layer 3 routing interfaces and static routes
- OSPF and multicast routing
- Access policies and ACLs
- QoS rules
- DHCP server policy
- Link aggregations
- STP, MTU, and storm control

All paths follow the official Meraki Dashboard API v1 specification.
Total tools: 64
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)


def _validate_context(context: Any) -> Dict:
    """Validate that context has a Meraki client configured."""
    if not hasattr(context, 'client') or context.client is None:
        return {
            "success": False,
            "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
        }
    return None


# =============================================================================
# HANDLERS - Port Operations
# =============================================================================

async def handle_switch_list_ports(params: Dict, context: Any) -> Dict:
    """List the switch ports for a switch."""
    try:
        if err := _validate_context(context): return err

        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/ports"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_port(params: Dict, context: Any) -> Dict:
    """Get a specific switch port configuration."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        port_id = params.get("port_id") or params.get("portId")
        if not serial or not port_id:
            return {"success": False, "error": "serial and port_id are required"}

        path = f"/devices/{serial}/switch/ports/{port_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_port(params: Dict, context: Any) -> Dict:
    """Update a switch port configuration."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        port_id = params.get("port_id") or params.get("portId")
        if not serial or not port_id:
            return {"success": False, "error": "serial and port_id are required"}

        path = f"/devices/{serial}/switch/ports/{port_id}"
        body = {k: v for k, v in params.items() if k not in ["serial", "port_id", "portId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_cycle_ports(params: Dict, context: Any) -> Dict:
    """Cycle (power off then on) switch ports on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/ports/cycle"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_ports_statuses(params: Dict, context: Any) -> Dict:
    """Get the status of all switch ports on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/ports/statuses"
        query_params = {k: v for k, v in params.items() if k != "serial" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_ports_statuses_packets(params: Dict, context: Any) -> Dict:
    """Get the packet counters for all switch ports."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/ports/statuses/packets"
        query_params = {k: v for k, v in params.items() if k != "serial" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Stack Operations
# =============================================================================

async def handle_switch_list_stacks(params: Dict, context: Any) -> Dict:
    """List the switch stacks in a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stacks"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_stack(params: Dict, context: Any) -> Dict:
    """Create a switch stack in a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stacks"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_stack(params: Dict, context: Any) -> Dict:
    """Get a specific switch stack."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        stack_id = params.get("stack_id") or params.get("stackId")
        if not network_id or not stack_id:
            return {"success": False, "error": "network_id and stack_id are required"}

        path = f"/networks/{network_id}/switch/stacks/{stack_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_stack(params: Dict, context: Any) -> Dict:
    """Delete a switch stack."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        stack_id = params.get("stack_id") or params.get("stackId")
        if not network_id or not stack_id:
            return {"success": False, "error": "network_id and stack_id are required"}

        path = f"/networks/{network_id}/switch/stacks/{stack_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_add_to_stack(params: Dict, context: Any) -> Dict:
    """Add a switch to an existing stack."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        stack_id = params.get("stack_id") or params.get("stackId")
        serial = params.get("serial")
        if not network_id or not stack_id or not serial:
            return {"success": False, "error": "network_id, stack_id, and serial are required"}

        path = f"/networks/{network_id}/switch/stacks/{stack_id}/add"
        body = {"serial": serial}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_remove_from_stack(params: Dict, context: Any) -> Dict:
    """Remove a switch from a stack."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        stack_id = params.get("stack_id") or params.get("stackId")
        serial = params.get("serial")
        if not network_id or not stack_id or not serial:
            return {"success": False, "error": "network_id, stack_id, and serial are required"}

        path = f"/networks/{network_id}/switch/stacks/{stack_id}/remove"
        body = {"serial": serial}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Routing Interfaces
# =============================================================================

async def handle_switch_list_routing_interfaces(params: Dict, context: Any) -> Dict:
    """List layer 3 routing interfaces on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/routing/interfaces"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_routing_interface(params: Dict, context: Any) -> Dict:
    """Create a layer 3 routing interface on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/routing/interfaces"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_routing_interface(params: Dict, context: Any) -> Dict:
    """Get a specific layer 3 routing interface."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        interface_id = params.get("interface_id") or params.get("interfaceId")
        if not serial or not interface_id:
            return {"success": False, "error": "serial and interface_id are required"}

        path = f"/devices/{serial}/switch/routing/interfaces/{interface_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_routing_interface(params: Dict, context: Any) -> Dict:
    """Update a layer 3 routing interface."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        interface_id = params.get("interface_id") or params.get("interfaceId")
        if not serial or not interface_id:
            return {"success": False, "error": "serial and interface_id are required"}

        path = f"/devices/{serial}/switch/routing/interfaces/{interface_id}"
        body = {k: v for k, v in params.items() if k not in ["serial", "interface_id", "interfaceId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_routing_interface(params: Dict, context: Any) -> Dict:
    """Delete a layer 3 routing interface."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        interface_id = params.get("interface_id") or params.get("interfaceId")
        if not serial or not interface_id:
            return {"success": False, "error": "serial and interface_id are required"}

        path = f"/devices/{serial}/switch/routing/interfaces/{interface_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Static Routes
# =============================================================================

async def handle_switch_list_static_routes(params: Dict, context: Any) -> Dict:
    """List layer 3 static routes on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/routing/staticRoutes"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_static_route(params: Dict, context: Any) -> Dict:
    """Create a layer 3 static route on a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/routing/staticRoutes"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_static_route(params: Dict, context: Any) -> Dict:
    """Get a specific layer 3 static route."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        static_route_id = params.get("static_route_id") or params.get("staticRouteId")
        if not serial or not static_route_id:
            return {"success": False, "error": "serial and static_route_id are required"}

        path = f"/devices/{serial}/switch/routing/staticRoutes/{static_route_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_static_route(params: Dict, context: Any) -> Dict:
    """Update a layer 3 static route."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        static_route_id = params.get("static_route_id") or params.get("staticRouteId")
        if not serial or not static_route_id:
            return {"success": False, "error": "serial and static_route_id are required"}

        path = f"/devices/{serial}/switch/routing/staticRoutes/{static_route_id}"
        body = {k: v for k, v in params.items() if k not in ["serial", "static_route_id", "staticRouteId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_static_route(params: Dict, context: Any) -> Dict:
    """Delete a layer 3 static route."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        static_route_id = params.get("static_route_id") or params.get("staticRouteId")
        if not serial or not static_route_id:
            return {"success": False, "error": "serial and static_route_id are required"}

        path = f"/devices/{serial}/switch/routing/staticRoutes/{static_route_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - OSPF & Multicast
# =============================================================================

async def handle_switch_get_ospf(params: Dict, context: Any) -> Dict:
    """Get the OSPF routing settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/routing/ospf"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_ospf(params: Dict, context: Any) -> Dict:
    """Update the OSPF routing settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/routing/ospf"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_multicast(params: Dict, context: Any) -> Dict:
    """Get the multicast settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/routing/multicast"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_multicast(params: Dict, context: Any) -> Dict:
    """Update the multicast settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/routing/multicast"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Access Policies
# =============================================================================

async def handle_switch_list_access_policies(params: Dict, context: Any) -> Dict:
    """List the access policies for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/accessPolicies"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_access_policy(params: Dict, context: Any) -> Dict:
    """Create an access policy for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/accessPolicies"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_access_policy(params: Dict, context: Any) -> Dict:
    """Get a specific access policy."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        access_policy_number = params.get("access_policy_number") or params.get("accessPolicyNumber")
        if not network_id or not access_policy_number:
            return {"success": False, "error": "network_id and access_policy_number are required"}

        path = f"/networks/{network_id}/switch/accessPolicies/{access_policy_number}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_access_policy(params: Dict, context: Any) -> Dict:
    """Update an access policy."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        access_policy_number = params.get("access_policy_number") or params.get("accessPolicyNumber")
        if not network_id or not access_policy_number:
            return {"success": False, "error": "network_id and access_policy_number are required"}

        path = f"/networks/{network_id}/switch/accessPolicies/{access_policy_number}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId", "access_policy_number", "accessPolicyNumber"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_access_policy(params: Dict, context: Any) -> Dict:
    """Delete an access policy."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        access_policy_number = params.get("access_policy_number") or params.get("accessPolicyNumber")
        if not network_id or not access_policy_number:
            return {"success": False, "error": "network_id and access_policy_number are required"}

        path = f"/networks/{network_id}/switch/accessPolicies/{access_policy_number}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - ACLs
# =============================================================================

async def handle_switch_get_acls(params: Dict, context: Any) -> Dict:
    """Get the access control lists for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/accessControlLists"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_acls(params: Dict, context: Any) -> Dict:
    """Update the access control lists for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/accessControlLists"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - QoS Rules
# =============================================================================

async def handle_switch_list_qos_rules(params: Dict, context: Any) -> Dict:
    """List the QoS rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/qosRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_qos_rule(params: Dict, context: Any) -> Dict:
    """Create a QoS rule for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/qosRules"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_qos_rule(params: Dict, context: Any) -> Dict:
    """Get a specific QoS rule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        qos_rule_id = params.get("qos_rule_id") or params.get("qosRuleId")
        if not network_id or not qos_rule_id:
            return {"success": False, "error": "network_id and qos_rule_id are required"}

        path = f"/networks/{network_id}/switch/qosRules/{qos_rule_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_qos_rule(params: Dict, context: Any) -> Dict:
    """Update a QoS rule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        qos_rule_id = params.get("qos_rule_id") or params.get("qosRuleId")
        if not network_id or not qos_rule_id:
            return {"success": False, "error": "network_id and qos_rule_id are required"}

        path = f"/networks/{network_id}/switch/qosRules/{qos_rule_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId", "qos_rule_id", "qosRuleId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_qos_rule(params: Dict, context: Any) -> Dict:
    """Delete a QoS rule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        qos_rule_id = params.get("qos_rule_id") or params.get("qosRuleId")
        if not network_id or not qos_rule_id:
            return {"success": False, "error": "network_id and qos_rule_id are required"}

        path = f"/networks/{network_id}/switch/qosRules/{qos_rule_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_qos_rules_order(params: Dict, context: Any) -> Dict:
    """Get the order of QoS rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/qosRules/order"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_qos_rules_order(params: Dict, context: Any) -> Dict:
    """Update the order of QoS rules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/qosRules/order"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - DHCP
# =============================================================================

async def handle_switch_get_dhcp_servers_seen(params: Dict, context: Any) -> Dict:
    """Get the DHCP servers seen by switches in a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/dhcp/serversSeen"
        query_params = {k: v for k, v in params.items() if k not in ["network_id", "networkId"] and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_dhcp_server_policy(params: Dict, context: Any) -> Dict:
    """Get the DHCP server policy for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/dhcpServerPolicy"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_dhcp_server_policy(params: Dict, context: Any) -> Dict:
    """Update the DHCP server policy for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/dhcpServerPolicy"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Link Aggregations
# =============================================================================

async def handle_switch_list_link_aggregations(params: Dict, context: Any) -> Dict:
    """List the link aggregations for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/linkAggregations"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_link_aggregation(params: Dict, context: Any) -> Dict:
    """Create a link aggregation group in a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/linkAggregations"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_get_link_aggregation(params: Dict, context: Any) -> Dict:
    """Get a specific link aggregation group."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        link_aggregation_id = params.get("link_aggregation_id") or params.get("linkAggregationId")
        if not network_id or not link_aggregation_id:
            return {"success": False, "error": "network_id and link_aggregation_id are required"}

        path = f"/networks/{network_id}/switch/linkAggregations/{link_aggregation_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_link_aggregation(params: Dict, context: Any) -> Dict:
    """Update a link aggregation group."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        link_aggregation_id = params.get("link_aggregation_id") or params.get("linkAggregationId")
        if not network_id or not link_aggregation_id:
            return {"success": False, "error": "network_id and link_aggregation_id are required"}

        path = f"/networks/{network_id}/switch/linkAggregations/{link_aggregation_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId", "link_aggregation_id", "linkAggregationId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_link_aggregation(params: Dict, context: Any) -> Dict:
    """Delete a link aggregation group."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        link_aggregation_id = params.get("link_aggregation_id") or params.get("linkAggregationId")
        if not network_id or not link_aggregation_id:
            return {"success": False, "error": "network_id and link_aggregation_id are required"}

        path = f"/networks/{network_id}/switch/linkAggregations/{link_aggregation_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - MTU
# =============================================================================

async def handle_switch_get_mtu(params: Dict, context: Any) -> Dict:
    """Get the MTU configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/mtu"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_mtu(params: Dict, context: Any) -> Dict:
    """Update the MTU configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/mtu"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Port Schedules
# =============================================================================

async def handle_switch_list_port_schedules(params: Dict, context: Any) -> Dict:
    """List the port schedules for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/portSchedules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_create_port_schedule(params: Dict, context: Any) -> Dict:
    """Create a port schedule for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/portSchedules"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_port_schedule(params: Dict, context: Any) -> Dict:
    """Update a port schedule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        port_schedule_id = params.get("port_schedule_id") or params.get("portScheduleId")
        if not network_id or not port_schedule_id:
            return {"success": False, "error": "network_id and port_schedule_id are required"}

        path = f"/networks/{network_id}/switch/portSchedules/{port_schedule_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId", "port_schedule_id", "portScheduleId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_delete_port_schedule(params: Dict, context: Any) -> Dict:
    """Delete a port schedule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        port_schedule_id = params.get("port_schedule_id") or params.get("portScheduleId")
        if not network_id or not port_schedule_id:
            return {"success": False, "error": "network_id and port_schedule_id are required"}

        path = f"/networks/{network_id}/switch/portSchedules/{port_schedule_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Settings
# =============================================================================

async def handle_switch_get_settings(params: Dict, context: Any) -> Dict:
    """Get the switch settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_settings(params: Dict, context: Any) -> Dict:
    """Update the switch settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/settings"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Warm Spare
# =============================================================================

async def handle_switch_get_warm_spare(params: Dict, context: Any) -> Dict:
    """Get the warm spare configuration for a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/warmSpare"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_warm_spare(params: Dict, context: Any) -> Dict:
    """Update the warm spare configuration for a switch."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/switch/warmSpare"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - DSCP to CoS Mappings
# =============================================================================

async def handle_switch_get_dscp_cos_mappings(params: Dict, context: Any) -> Dict:
    """Get the DSCP to CoS mappings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/dscpToCosMappings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_dscp_cos_mappings(params: Dict, context: Any) -> Dict:
    """Update the DSCP to CoS mappings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/dscpToCosMappings"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - STP
# =============================================================================

async def handle_switch_get_stp(params: Dict, context: Any) -> Dict:
    """Get the STP settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stp"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_stp(params: Dict, context: Any) -> Dict:
    """Update the STP settings for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stp"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# HANDLERS - Storm Control
# =============================================================================

async def handle_switch_get_storm_control(params: Dict, context: Any) -> Dict:
    """Get the storm control configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stormControl"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_switch_update_storm_control(params: Dict, context: Any) -> Dict:
    """Update the storm control configuration for a network."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id") or params.get("networkId")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/switch/stormControl"
        body = {k: v for k, v in params.items() if k not in ["network_id", "networkId"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_SWITCH_TOOLS = [
    create_tool(
        name="meraki_switch_list_ports",
        description="""List the switch ports for a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"}
        },
        required=["serial"],
        tags=["meraki", "switch", "ports", "list"],
        requires_write=False,
        handler=handle_switch_list_ports,
    ),
    create_tool(
        name="meraki_switch_get_port",
        description="""Get a specific switch port configuration""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID"}
        },
        required=["serial", "port_id"],
        tags=["meraki", "switch", "ports", "get"],
        requires_write=False,
        handler=handle_switch_get_port,
    ),
    create_tool(
        name="meraki_switch_update_port",
        description="""Update a switch port configuration""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID"},
            "name": {"type": "string", "description": "Port name"},
            "enabled": {"type": "boolean", "description": "Enable or disable port"},
            "poe_enabled": {"type": "boolean", "description": "Enable or disable PoE"},
            "type": {"type": "string", "description": "Port type: access or trunk"},
            "vlan": {"type": "integer", "description": "VLAN ID for access port"},
            "voice_vlan": {"type": "integer", "description": "Voice VLAN ID"},
            "allowed_vlans": {"type": "string", "description": "Allowed VLANs for trunk"}
        },
        required=["serial", "port_id"],
        tags=["meraki", "switch", "ports", "update", "configure"],
        requires_write=True,
        handler=handle_switch_update_port,
    ),
    create_tool(
        name="meraki_switch_cycle_ports",
        description="""Cycle (power off then on) switch ports on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "ports": {"type": "array", "items": {"type": "string"}, "description": "Ports to cycle"}
        },
        required=["serial", "ports"],
        tags=["meraki", "switch", "ports", "cycle", "poe", "reset"],
        requires_write=True,
        handler=handle_switch_cycle_ports,
    ),
    create_tool(
        name="meraki_switch_get_ports_statuses",
        description="""Get the status of all switch ports on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "t0": {"type": "string", "description": "Start time"},
            "timespan": {"type": "number", "description": "Timespan in seconds"}
        },
        required=["serial"],
        tags=["meraki", "switch", "ports", "status"],
        requires_write=False,
        handler=handle_switch_get_ports_statuses,
    ),
    create_tool(
        name="meraki_switch_get_ports_statuses_packets",
        description="""Get the packet counters for all switch ports""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "t0": {"type": "string", "description": "Start time"},
            "timespan": {"type": "number", "description": "Timespan in seconds"}
        },
        required=["serial"],
        tags=["meraki", "switch", "ports", "packets", "counters"],
        requires_write=False,
        handler=handle_switch_get_ports_statuses_packets,
    ),
    create_tool(
        name="meraki_switch_list_stacks",
        description="""List the switch stacks in a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "stacks", "list"],
        requires_write=False,
        handler=handle_switch_list_stacks,
    ),
    create_tool(
        name="meraki_switch_create_stack",
        description="""Create a switch stack in a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "name": {"type": "string", "description": "Stack name"},
            "serials": {"type": "array", "items": {"type": "string"}, "description": "Switch serials"}
        },
        required=["network_id", "name", "serials"],
        tags=["meraki", "switch", "stacks", "create"],
        requires_write=True,
        handler=handle_switch_create_stack,
    ),
    create_tool(
        name="meraki_switch_get_stack",
        description="""Get a specific switch stack""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "stack_id": {"type": "string", "description": "Stack ID"}
        },
        required=["network_id", "stack_id"],
        tags=["meraki", "switch", "stacks", "get"],
        requires_write=False,
        handler=handle_switch_get_stack,
    ),
    create_tool(
        name="meraki_switch_delete_stack",
        description="""Delete a switch stack""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "stack_id": {"type": "string", "description": "Stack ID"}
        },
        required=["network_id", "stack_id"],
        tags=["meraki", "switch", "stacks", "delete"],
        requires_write=True,
        handler=handle_switch_delete_stack,
    ),
    create_tool(
        name="meraki_switch_add_to_stack",
        description="""Add a switch to an existing stack""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "stack_id": {"type": "string", "description": "Stack ID"},
            "serial": {"type": "string", "description": "Switch serial to add"}
        },
        required=["network_id", "stack_id", "serial"],
        tags=["meraki", "switch", "stacks", "add"],
        requires_write=True,
        handler=handle_switch_add_to_stack,
    ),
    create_tool(
        name="meraki_switch_remove_from_stack",
        description="""Remove a switch from a stack""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "stack_id": {"type": "string", "description": "Stack ID"},
            "serial": {"type": "string", "description": "Switch serial to remove"}
        },
        required=["network_id", "stack_id", "serial"],
        tags=["meraki", "switch", "stacks", "remove"],
        requires_write=True,
        handler=handle_switch_remove_from_stack,
    ),
    create_tool(
        name="meraki_switch_list_routing_interfaces",
        description="""List layer 3 routing interfaces on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"}
        },
        required=["serial"],
        tags=["meraki", "switch", "routing", "interfaces", "l3"],
        requires_write=False,
        handler=handle_switch_list_routing_interfaces,
    ),
    create_tool(
        name="meraki_switch_create_routing_interface",
        description="""Create a layer 3 routing interface on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "name": {"type": "string", "description": "Interface name"},
            "vlan_id": {"type": "integer", "description": "VLAN ID"},
            "subnet": {"type": "string", "description": "Interface subnet"},
            "interface_ip": {"type": "string", "description": "Interface IP address"}
        },
        required=["serial", "name", "vlan_id"],
        tags=["meraki", "switch", "routing", "interfaces", "create"],
        requires_write=True,
        handler=handle_switch_create_routing_interface,
    ),
    create_tool(
        name="meraki_switch_get_routing_interface",
        description="""Get a specific layer 3 routing interface""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "interface_id": {"type": "string", "description": "Interface ID"}
        },
        required=["serial", "interface_id"],
        tags=["meraki", "switch", "routing", "interfaces", "get"],
        requires_write=False,
        handler=handle_switch_get_routing_interface,
    ),
    create_tool(
        name="meraki_switch_update_routing_interface",
        description="""Update a layer 3 routing interface""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "interface_id": {"type": "string", "description": "Interface ID"},
            "name": {"type": "string", "description": "Interface name"},
            "subnet": {"type": "string", "description": "Interface subnet"},
            "interface_ip": {"type": "string", "description": "Interface IP address"}
        },
        required=["serial", "interface_id"],
        tags=["meraki", "switch", "routing", "interfaces", "update"],
        requires_write=True,
        handler=handle_switch_update_routing_interface,
    ),
    create_tool(
        name="meraki_switch_delete_routing_interface",
        description="""Delete a layer 3 routing interface""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "interface_id": {"type": "string", "description": "Interface ID"}
        },
        required=["serial", "interface_id"],
        tags=["meraki", "switch", "routing", "interfaces", "delete"],
        requires_write=True,
        handler=handle_switch_delete_routing_interface,
    ),
    create_tool(
        name="meraki_switch_list_static_routes",
        description="""List layer 3 static routes on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"}
        },
        required=["serial"],
        tags=["meraki", "switch", "routing", "static-routes", "list"],
        requires_write=False,
        handler=handle_switch_list_static_routes,
    ),
    create_tool(
        name="meraki_switch_create_static_route",
        description="""Create a layer 3 static route on a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "subnet": {"type": "string", "description": "Destination subnet"},
            "next_hop_ip": {"type": "string", "description": "Next hop IP address"}
        },
        required=["serial", "subnet", "next_hop_ip"],
        tags=["meraki", "switch", "routing", "static-routes", "create"],
        requires_write=True,
        handler=handle_switch_create_static_route,
    ),
    create_tool(
        name="meraki_switch_get_static_route",
        description="""Get a specific layer 3 static route""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "static_route_id": {"type": "string", "description": "Static route ID"}
        },
        required=["serial", "static_route_id"],
        tags=["meraki", "switch", "routing", "static-routes", "get"],
        requires_write=False,
        handler=handle_switch_get_static_route,
    ),
    create_tool(
        name="meraki_switch_update_static_route",
        description="""Update a layer 3 static route""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "static_route_id": {"type": "string", "description": "Static route ID"},
            "subnet": {"type": "string", "description": "Destination subnet"},
            "next_hop_ip": {"type": "string", "description": "Next hop IP address"}
        },
        required=["serial", "static_route_id"],
        tags=["meraki", "switch", "routing", "static-routes", "update"],
        requires_write=True,
        handler=handle_switch_update_static_route,
    ),
    create_tool(
        name="meraki_switch_delete_static_route",
        description="""Delete a layer 3 static route""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "static_route_id": {"type": "string", "description": "Static route ID"}
        },
        required=["serial", "static_route_id"],
        tags=["meraki", "switch", "routing", "static-routes", "delete"],
        requires_write=True,
        handler=handle_switch_delete_static_route,
    ),
    create_tool(
        name="meraki_switch_get_ospf",
        description="""Get the OSPF routing settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "routing", "ospf"],
        requires_write=False,
        handler=handle_switch_get_ospf,
    ),
    create_tool(
        name="meraki_switch_update_ospf",
        description="""Update the OSPF routing settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "enabled": {"type": "boolean", "description": "Enable or disable OSPF"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "routing", "ospf", "update"],
        requires_write=True,
        handler=handle_switch_update_ospf,
    ),
    create_tool(
        name="meraki_switch_get_multicast",
        description="""Get the multicast settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "routing", "multicast"],
        requires_write=False,
        handler=handle_switch_get_multicast,
    ),
    create_tool(
        name="meraki_switch_update_multicast",
        description="""Update the multicast settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "routing", "multicast", "update"],
        requires_write=True,
        handler=handle_switch_update_multicast,
    ),
    create_tool(
        name="meraki_switch_list_access_policies",
        description="""List the access policies for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "access-policies", "802.1x", "list"],
        requires_write=False,
        handler=handle_switch_list_access_policies,
    ),
    create_tool(
        name="meraki_switch_create_access_policy",
        description="""Create an access policy for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "name": {"type": "string", "description": "Policy name"},
            "radius_servers": {"type": "array", "items": {"type": "object"}, "description": "RADIUS servers"}
        },
        required=["network_id", "name", "radius_servers"],
        tags=["meraki", "switch", "access-policies", "802.1x", "create"],
        requires_write=True,
        handler=handle_switch_create_access_policy,
    ),
    create_tool(
        name="meraki_switch_get_access_policy",
        description="""Get a specific access policy""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "access_policy_number": {"type": "string", "description": "Access policy number"}
        },
        required=["network_id", "access_policy_number"],
        tags=["meraki", "switch", "access-policies", "802.1x", "get"],
        requires_write=False,
        handler=handle_switch_get_access_policy,
    ),
    create_tool(
        name="meraki_switch_update_access_policy",
        description="""Update an access policy""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "access_policy_number": {"type": "string", "description": "Access policy number"},
            "name": {"type": "string", "description": "Policy name"}
        },
        required=["network_id", "access_policy_number"],
        tags=["meraki", "switch", "access-policies", "802.1x", "update"],
        requires_write=True,
        handler=handle_switch_update_access_policy,
    ),
    create_tool(
        name="meraki_switch_delete_access_policy",
        description="""Delete an access policy""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "access_policy_number": {"type": "string", "description": "Access policy number"}
        },
        required=["network_id", "access_policy_number"],
        tags=["meraki", "switch", "access-policies", "802.1x", "delete"],
        requires_write=True,
        handler=handle_switch_delete_access_policy,
    ),
    create_tool(
        name="meraki_switch_get_acls",
        description="""Get the access control lists for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "acls", "security"],
        requires_write=False,
        handler=handle_switch_get_acls,
    ),
    create_tool(
        name="meraki_switch_update_acls",
        description="""Update the access control lists for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "rules": {"type": "array", "description": "ACL rules"}
        },
        required=["network_id", "rules"],
        tags=["meraki", "switch", "acls", "security", "update"],
        requires_write=True,
        handler=handle_switch_update_acls,
    ),
    create_tool(
        name="meraki_switch_list_qos_rules",
        description="""List the QoS rules for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "qos", "list"],
        requires_write=False,
        handler=handle_switch_list_qos_rules,
    ),
    create_tool(
        name="meraki_switch_create_qos_rule",
        description="""Create a QoS rule for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "vlan": {"type": "integer", "description": "VLAN ID"},
            "dscp": {"type": "integer", "description": "DSCP value"}
        },
        required=["network_id", "vlan"],
        tags=["meraki", "switch", "qos", "create"],
        requires_write=True,
        handler=handle_switch_create_qos_rule,
    ),
    create_tool(
        name="meraki_switch_get_qos_rule",
        description="""Get a specific QoS rule""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "qos_rule_id": {"type": "string", "description": "QoS rule ID"}
        },
        required=["network_id", "qos_rule_id"],
        tags=["meraki", "switch", "qos", "get"],
        requires_write=False,
        handler=handle_switch_get_qos_rule,
    ),
    create_tool(
        name="meraki_switch_update_qos_rule",
        description="""Update a QoS rule""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "qos_rule_id": {"type": "string", "description": "QoS rule ID"}
        },
        required=["network_id", "qos_rule_id"],
        tags=["meraki", "switch", "qos", "update"],
        requires_write=True,
        handler=handle_switch_update_qos_rule,
    ),
    create_tool(
        name="meraki_switch_delete_qos_rule",
        description="""Delete a QoS rule""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "qos_rule_id": {"type": "string", "description": "QoS rule ID"}
        },
        required=["network_id", "qos_rule_id"],
        tags=["meraki", "switch", "qos", "delete"],
        requires_write=True,
        handler=handle_switch_delete_qos_rule,
    ),
    create_tool(
        name="meraki_switch_get_qos_rules_order",
        description="""Get the order of QoS rules for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "qos", "order"],
        requires_write=False,
        handler=handle_switch_get_qos_rules_order,
    ),
    create_tool(
        name="meraki_switch_update_qos_rules_order",
        description="""Update the order of QoS rules for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "rule_ids": {"type": "array", "items": {"type": "string"}, "description": "Ordered rule IDs"}
        },
        required=["network_id", "rule_ids"],
        tags=["meraki", "switch", "qos", "order", "update"],
        requires_write=True,
        handler=handle_switch_update_qos_rules_order,
    ),
    create_tool(
        name="meraki_switch_get_dhcp_servers_seen",
        description="""Get the DHCP servers seen by switches in a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "t0": {"type": "string", "description": "Start time"},
            "timespan": {"type": "number", "description": "Timespan in seconds"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "dhcp", "servers"],
        requires_write=False,
        handler=handle_switch_get_dhcp_servers_seen,
    ),
    create_tool(
        name="meraki_switch_get_dhcp_server_policy",
        description="""Get the DHCP server policy for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "dhcp", "policy"],
        requires_write=False,
        handler=handle_switch_get_dhcp_server_policy,
    ),
    create_tool(
        name="meraki_switch_update_dhcp_server_policy",
        description="""Update the DHCP server policy for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "default_policy": {"type": "string", "description": "Default policy: allow or block"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "dhcp", "policy", "update"],
        requires_write=True,
        handler=handle_switch_update_dhcp_server_policy,
    ),
    create_tool(
        name="meraki_switch_list_link_aggregations",
        description="""List the link aggregations for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "link-aggregation", "lag", "list"],
        requires_write=False,
        handler=handle_switch_list_link_aggregations,
    ),
    create_tool(
        name="meraki_switch_create_link_aggregation",
        description="""Create a link aggregation group in a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "switch_ports": {"type": "array", "description": "Ports to aggregate"}
        },
        required=["network_id", "switch_ports"],
        tags=["meraki", "switch", "link-aggregation", "lag", "create"],
        requires_write=True,
        handler=handle_switch_create_link_aggregation,
    ),
    create_tool(
        name="meraki_switch_get_link_aggregation",
        description="""Get a specific link aggregation group""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "link_aggregation_id": {"type": "string", "description": "Link aggregation ID"}
        },
        required=["network_id", "link_aggregation_id"],
        tags=["meraki", "switch", "link-aggregation", "lag", "get"],
        requires_write=False,
        handler=handle_switch_get_link_aggregation,
    ),
    create_tool(
        name="meraki_switch_update_link_aggregation",
        description="""Update a link aggregation group""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "link_aggregation_id": {"type": "string", "description": "Link aggregation ID"}
        },
        required=["network_id", "link_aggregation_id"],
        tags=["meraki", "switch", "link-aggregation", "lag", "update"],
        requires_write=True,
        handler=handle_switch_update_link_aggregation,
    ),
    create_tool(
        name="meraki_switch_delete_link_aggregation",
        description="""Delete a link aggregation group""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "link_aggregation_id": {"type": "string", "description": "Link aggregation ID"}
        },
        required=["network_id", "link_aggregation_id"],
        tags=["meraki", "switch", "link-aggregation", "lag", "delete"],
        requires_write=True,
        handler=handle_switch_delete_link_aggregation,
    ),
    create_tool(
        name="meraki_switch_get_mtu",
        description="""Get the MTU configuration for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "mtu"],
        requires_write=False,
        handler=handle_switch_get_mtu,
    ),
    create_tool(
        name="meraki_switch_update_mtu",
        description="""Update the MTU configuration for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "default_mtu_size": {"type": "integer", "description": "Default MTU size"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "mtu", "update"],
        requires_write=True,
        handler=handle_switch_update_mtu,
    ),
    create_tool(
        name="meraki_switch_list_port_schedules",
        description="""List the port schedules for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "port-schedules", "list"],
        requires_write=False,
        handler=handle_switch_list_port_schedules,
    ),
    create_tool(
        name="meraki_switch_create_port_schedule",
        description="""Create a port schedule for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "name": {"type": "string", "description": "Schedule name"}
        },
        required=["network_id", "name"],
        tags=["meraki", "switch", "port-schedules", "create"],
        requires_write=True,
        handler=handle_switch_create_port_schedule,
    ),
    create_tool(
        name="meraki_switch_update_port_schedule",
        description="""Update a port schedule""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "port_schedule_id": {"type": "string", "description": "Port schedule ID"}
        },
        required=["network_id", "port_schedule_id"],
        tags=["meraki", "switch", "port-schedules", "update"],
        requires_write=True,
        handler=handle_switch_update_port_schedule,
    ),
    create_tool(
        name="meraki_switch_delete_port_schedule",
        description="""Delete a port schedule""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "port_schedule_id": {"type": "string", "description": "Port schedule ID"}
        },
        required=["network_id", "port_schedule_id"],
        tags=["meraki", "switch", "port-schedules", "delete"],
        requires_write=True,
        handler=handle_switch_delete_port_schedule,
    ),
    create_tool(
        name="meraki_switch_get_settings",
        description="""Get the switch settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "settings"],
        requires_write=False,
        handler=handle_switch_get_settings,
    ),
    create_tool(
        name="meraki_switch_update_settings",
        description="""Update the switch settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "vlan": {"type": "integer", "description": "Management VLAN"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "settings", "update"],
        requires_write=True,
        handler=handle_switch_update_settings,
    ),
    create_tool(
        name="meraki_switch_get_warm_spare",
        description="""Get the warm spare configuration for a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"}
        },
        required=["serial"],
        tags=["meraki", "switch", "warm-spare", "ha"],
        requires_write=False,
        handler=handle_switch_get_warm_spare,
    ),
    create_tool(
        name="meraki_switch_update_warm_spare",
        description="""Update the warm spare configuration for a switch""",
        platform="meraki",
        category="switch",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "enabled": {"type": "boolean", "description": "Enable warm spare"},
            "spare_serial": {"type": "string", "description": "Spare switch serial"}
        },
        required=["serial", "enabled"],
        tags=["meraki", "switch", "warm-spare", "ha", "update"],
        requires_write=True,
        handler=handle_switch_update_warm_spare,
    ),
    create_tool(
        name="meraki_switch_get_dscp_cos_mappings",
        description="""Get the DSCP to CoS mappings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "dscp", "cos", "qos"],
        requires_write=False,
        handler=handle_switch_get_dscp_cos_mappings,
    ),
    create_tool(
        name="meraki_switch_update_dscp_cos_mappings",
        description="""Update the DSCP to CoS mappings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "mappings": {"type": "array", "description": "DSCP to CoS mappings"}
        },
        required=["network_id", "mappings"],
        tags=["meraki", "switch", "dscp", "cos", "qos", "update"],
        requires_write=True,
        handler=handle_switch_update_dscp_cos_mappings,
    ),
    create_tool(
        name="meraki_switch_get_stp",
        description="""Get the STP settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "stp", "spanning-tree"],
        requires_write=False,
        handler=handle_switch_get_stp,
    ),
    create_tool(
        name="meraki_switch_update_stp",
        description="""Update the STP settings for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "rstp_enabled": {"type": "boolean", "description": "Enable RSTP"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "stp", "spanning-tree", "update"],
        requires_write=True,
        handler=handle_switch_update_stp,
    ),
    create_tool(
        name="meraki_switch_get_storm_control",
        description="""Get the storm control configuration for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "storm-control", "security"],
        requires_write=False,
        handler=handle_switch_get_storm_control,
    ),
    create_tool(
        name="meraki_switch_update_storm_control",
        description="""Update the storm control configuration for a network""",
        platform="meraki",
        category="switch",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "broadcast_threshold": {"type": "integer", "description": "Broadcast threshold (pps)"}
        },
        required=["network_id"],
        tags=["meraki", "switch", "storm-control", "security", "update"],
        requires_write=True,
        handler=handle_switch_update_storm_control,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_switch_tools():
    """Register all switch tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_SWITCH_TOOLS)
    logger.info(f"Registered {len(MERAKI_SWITCH_TOOLS)} meraki switch tools")


# Auto-register on import
register_switch_tools()
