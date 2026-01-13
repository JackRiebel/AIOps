"""
Meraki Networks Tools

Auto-generated from archived A2A skills.
Total tools: 56
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_networks_list(params: Dict, context: Any) -> Dict:
    """Handler for List Networks."""
    try:
        # Build API path
        path = "/organizations/{organization_id}/networks"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get(params: Dict, context: Any) -> Dict:
    """Handler for Get Network."""
    try:
        # Validate required parameter
        network_id = params.get("network_id", "")
        if not network_id:
            return {"success": False, "error": "network_id is required. Use meraki_organizations_networks_list first to get network IDs."}

        # Build API path - Meraki API: GET /networks/{networkId}
        path = f"/networks/{network_id}"

        # Make API request
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_create(params: Dict, context: Any) -> Dict:
    """Handler for Create Network."""
    try:
        # Build API path - create network in organization
        path = "/organizations/{organization_id}/networks"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Network."""
    try:
        # Build API path - update network by ID
        path = "/networks/{network_id}"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Network."""
    try:
        # Build API path - delete network by ID
        path = "/networks/{network_id}"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_bind_to_template(params: Dict, context: Any) -> Dict:
    """Handler for Bind Network to Template."""
    try:
        # Build API path
        path = "/networks/{network_id}/bind"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_unbind_from_template(params: Dict, context: Any) -> Dict:
    """Handler for Unbind Network from Template."""
    try:
        # Build API path
        path = "/networks/{network_id}/unbind"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_split(params: Dict, context: Any) -> Dict:
    """Handler for Split Combined Network."""
    try:
        # Build API path
        path = "/networks/{network_id}/split"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_devices(params: Dict, context: Any) -> Dict:
    """Handler for List Network Devices."""
    try:
        # Build API path
        path = "/networks/{network_id}/devices"
        path = path.replace("{network_id}", params.get("network_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_combine(params: Dict, context: Any) -> Dict:
    """Handler for Combine Networks."""
    try:
        # Build API path
        path = "/networks/{network_id}/combine"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_clients(params: Dict, context: Any) -> Dict:
    """Handler for List Network Clients."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/clients
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/clients"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_client(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Client."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/clients/{clientId}
        network_id = params.pop("network_id", "")
        client_id = params.pop("client_id", "")
        path = f"/networks/{network_id}/clients/{client_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_client_policy(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Policy."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/clients/{clientId}/policy
        network_id = params.pop("network_id", "")
        client_id = params.pop("client_id", "")
        path = f"/networks/{network_id}/clients/{client_id}/policy"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_client_policy(params: Dict, context: Any) -> Dict:
    """Handler for Update Client Policy."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/clients/{clientId}/policy
        network_id = params.pop("network_id", "")
        client_id = params.pop("client_id", "")
        path = f"/networks/{network_id}/clients/{client_id}/policy"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_provision_clients(params: Dict, context: Any) -> Dict:
    """Handler for Provision Clients."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/clients/provision
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/clients/provision"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_client_traffic(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Traffic History."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/clients/{clientId}/trafficHistory
        network_id = params.pop("network_id", "")
        client_id = params.pop("client_id", "")
        path = f"/networks/{network_id}/clients/{client_id}/trafficHistory"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_client_usage(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Usage History."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/clients/{clientId}/usageHistory
        network_id = params.pop("network_id", "")
        client_id = params.pop("client_id", "")
        path = f"/networks/{network_id}/clients/{client_id}/usageHistory"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_events(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Events."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/events
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/events"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_event_types(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Event Types."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/events/eventTypes
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/events/eventTypes"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_alerts_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Alerts History."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/alerts/history
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/alerts/history"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_alerts_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Alerts Settings."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/alerts/settings
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/alerts/settings"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_alerts_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Alerts Settings."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/alerts/settings
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/alerts/settings"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_health_alerts(params: Dict, context: Any) -> Dict:
    """Handler for Get Health Alerts."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/health/alerts
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/health/alerts"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_firmware_upgrades(params: Dict, context: Any) -> Dict:
    """Handler for Get Firmware Upgrades."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/firmwareUpgrades
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/firmwareUpgrades"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_firmware_upgrades(params: Dict, context: Any) -> Dict:
    """Handler for Update Firmware Upgrades."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/firmwareUpgrades
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/firmwareUpgrades"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_create_firmware_rollback(params: Dict, context: Any) -> Dict:
    """Handler for Rollback Firmware."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/firmwareUpgrades/rollbacks
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/firmwareUpgrades/rollbacks"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_firmware_staged_events(params: Dict, context: Any) -> Dict:
    """Handler for Get Staged Firmware Events."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/firmwareUpgrades/staged/events
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/firmwareUpgrades/staged/events"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_group_policies(params: Dict, context: Any) -> Dict:
    """Handler for List Group Policies."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/groupPolicies
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/groupPolicies"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_create_group_policy(params: Dict, context: Any) -> Dict:
    """Handler for Create Group Policy."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/groupPolicies
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/groupPolicies"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_group_policy(params: Dict, context: Any) -> Dict:
    """Handler for Get Group Policy."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/groupPolicies/{groupPolicyId}
        network_id = params.pop("network_id", "")
        group_policy_id = params.pop("group_policy_id", "")
        path = f"/networks/{network_id}/groupPolicies/{group_policy_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_group_policy(params: Dict, context: Any) -> Dict:
    """Handler for Update Group Policy."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/groupPolicies/{groupPolicyId}
        network_id = params.pop("network_id", "")
        group_policy_id = params.pop("group_policy_id", "")
        path = f"/networks/{network_id}/groupPolicies/{group_policy_id}"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_delete_group_policy(params: Dict, context: Any) -> Dict:
    """Handler for Delete Group Policy."""
    try:
        # Build API path - Meraki API: DELETE /networks/{networkId}/groupPolicies/{groupPolicyId}
        network_id = params.pop("network_id", "")
        group_policy_id = params.pop("group_policy_id", "")
        path = f"/networks/{network_id}/groupPolicies/{group_policy_id}"

        # Make API request
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_meraki_auth_users(params: Dict, context: Any) -> Dict:
    """Handler for List Meraki Auth Users."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/merakiAuthUsers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/merakiAuthUsers"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_create_meraki_auth_user(params: Dict, context: Any) -> Dict:
    """Handler for Create Meraki Auth User."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/merakiAuthUsers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/merakiAuthUsers"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_meraki_auth_user(params: Dict, context: Any) -> Dict:
    """Handler for Get Meraki Auth User."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/merakiAuthUsers/{merakiAuthUserId}
        network_id = params.pop("network_id", "")
        meraki_auth_user_id = params.pop("meraki_auth_user_id", "")
        path = f"/networks/{network_id}/merakiAuthUsers/{meraki_auth_user_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_meraki_auth_user(params: Dict, context: Any) -> Dict:
    """Handler for Update Meraki Auth User."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/merakiAuthUsers/{merakiAuthUserId}
        network_id = params.pop("network_id", "")
        meraki_auth_user_id = params.pop("meraki_auth_user_id", "")
        path = f"/networks/{network_id}/merakiAuthUsers/{meraki_auth_user_id}"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_delete_meraki_auth_user(params: Dict, context: Any) -> Dict:
    """Handler for Delete Meraki Auth User."""
    try:
        # Build API path - Meraki API: DELETE /networks/{networkId}/merakiAuthUsers/{merakiAuthUserId}
        network_id = params.pop("network_id", "")
        meraki_auth_user_id = params.pop("meraki_auth_user_id", "")
        path = f"/networks/{network_id}/merakiAuthUsers/{meraki_auth_user_id}"

        # Make API request
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_webhooks(params: Dict, context: Any) -> Dict:
    """Handler for List Webhooks."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/webhooks/httpServers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/webhooks/httpServers"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_create_webhook(params: Dict, context: Any) -> Dict:
    """Handler for Create Webhook."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/webhooks/httpServers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/webhooks/httpServers"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_webhook(params: Dict, context: Any) -> Dict:
    """Handler for Get Webhook."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/webhooks/httpServers/{httpServerId}
        network_id = params.pop("network_id", "")
        http_server_id = params.pop("http_server_id", "")
        path = f"/networks/{network_id}/webhooks/httpServers/{http_server_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_webhook(params: Dict, context: Any) -> Dict:
    """Handler for Update Webhook."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/webhooks/httpServers/{httpServerId}
        network_id = params.pop("network_id", "")
        http_server_id = params.pop("http_server_id", "")
        path = f"/networks/{network_id}/webhooks/httpServers/{http_server_id}"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_delete_webhook(params: Dict, context: Any) -> Dict:
    """Handler for Delete Webhook."""
    try:
        # Build API path - Meraki API: DELETE /networks/{networkId}/webhooks/httpServers/{httpServerId}
        network_id = params.pop("network_id", "")
        http_server_id = params.pop("http_server_id", "")
        path = f"/networks/{network_id}/webhooks/httpServers/{http_server_id}"

        # Make API request
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_test_webhook(params: Dict, context: Any) -> Dict:
    """Handler for Test Webhook."""
    try:
        # Build API path - Meraki API: POST /networks/{networkId}/webhooks/webhookTests
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/webhooks/webhookTests"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_list_floor_plans(params: Dict, context: Any) -> Dict:
    """Handler for List Floor Plans."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/floorPlans
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/floorPlans"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_floor_plan(params: Dict, context: Any) -> Dict:
    """Handler for Get Floor Plan."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/floorPlans/{floorPlanId}
        network_id = params.pop("network_id", "")
        floor_plan_id = params.pop("floor_plan_id", "")
        path = f"/networks/{network_id}/floorPlans/{floor_plan_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_floor_plan(params: Dict, context: Any) -> Dict:
    """Handler for Update Floor Plan."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/floorPlans/{floorPlanId}
        network_id = params.pop("network_id", "")
        floor_plan_id = params.pop("floor_plan_id", "")
        path = f"/networks/{network_id}/floorPlans/{floor_plan_id}"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_delete_floor_plan(params: Dict, context: Any) -> Dict:
    """Handler for Delete Floor Plan."""
    try:
        # Build API path - Meraki API: DELETE /networks/{networkId}/floorPlans/{floorPlanId}
        network_id = params.pop("network_id", "")
        floor_plan_id = params.pop("floor_plan_id", "")
        path = f"/networks/{network_id}/floorPlans/{floor_plan_id}"

        # Make API request
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_traffic_analysis(params: Dict, context: Any) -> Dict:
    """Handler for Get Traffic Analysis Settings."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/trafficAnalysis
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/trafficAnalysis"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_traffic_analysis(params: Dict, context: Any) -> Dict:
    """Handler for Update Traffic Analysis."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/trafficAnalysis
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/trafficAnalysis"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_traffic(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Traffic."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/traffic
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/traffic"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Network Settings."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/settings
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/settings"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Network Settings."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/settings
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/settings"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_snmp(params: Dict, context: Any) -> Dict:
    """Handler for Get SNMP Settings."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/snmp
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/snmp"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_snmp(params: Dict, context: Any) -> Dict:
    """Handler for Update SNMP Settings."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/snmp
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/snmp"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_get_syslog_servers(params: Dict, context: Any) -> Dict:
    """Handler for Get Syslog Servers."""
    try:
        # Build API path - Meraki API: GET /networks/{networkId}/syslogServers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/syslogServers"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_networks_update_syslog_servers(params: Dict, context: Any) -> Dict:
    """Handler for Update Syslog Servers."""
    try:
        # Build API path - Meraki API: PUT /networks/{networkId}/syslogServers
        network_id = params.pop("network_id", "")
        path = f"/networks/{network_id}/syslogServers"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_NETWORKS_TOOLS = [
    create_tool(
        name="meraki_networks_list",
        description="""List all networks in an organization. Returns network IDs, names, product types (appliance, switch, wireless), time zones, and tags.""",
        platform="meraki",
        category="networks",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "configTemplateId": {
                        "type": "string",
                        "description": "Filter by config template"
            },
            "isBoundToConfigTemplate": {
                        "type": "boolean",
                        "description": "Filter by template binding"
            },
            "tags": {
                        "type": "array",
                        "description": "Filter by tags",
                        "items": {
                                    "type": "string"
                        }
            },
            "tagsFilterType": {
                        "type": "string",
                        "description": "Tag filter type"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            }
},
        required=["organization_id"],
        tags=["networks", "list", "read"],
        requires_write=False,
        handler=handle_networks_list,
        examples=[
            {"query": "List all networks in org 549236", "params": {"organization_id": "549236"}},
            {"query": "Show me the networks", "params": {"organization_id": "549236"}},
            {"query": "What networks do we have?", "params": {"organization_id": "549236"}},
        ],
    ),
    create_tool(
        name="meraki_networks_get",
        description="""Get details of a specific network including name, product types, time zone, tags, and enrollment string""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "get", "read", "details"],
        requires_write=False,
        handler=handle_networks_get,
        examples=[
            {"query": "Get details for network N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "Show me the Office network details", "params": {"network_id": "L_636983396225539102"}},
        ],
    ),
    create_tool(
        name="meraki_networks_create",
        description="""Create a new network in an organization""",
        platform="meraki",
        category="networks",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "Network name"
            },
            "productTypes": {
                        "type": "array",
                        "description": "Product types (appliance, switch, wireless, camera, etc.)",
                        "items": {
                                    "type": "string"
                        }
            },
            "tags": {
                        "type": "array",
                        "description": "Network tags",
                        "items": {
                                    "type": "string"
                        }
            },
            "timeZone": {
                        "type": "string",
                        "description": "Time zone"
            },
            "copyFromNetworkId": {
                        "type": "string",
                        "description": "Network to copy from"
            },
            "notes": {
                        "type": "string",
                        "description": "Notes"
            }
},
        required=["organization_id", "name", "productTypes"],
        tags=["networks", "create", "write"],
        requires_write=True,
        handler=handle_networks_create,
    ),
    create_tool(
        name="meraki_networks_update",
        description="""Update a network's settings""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "New network name"
            },
            "timeZone": {
                        "type": "string",
                        "description": "Time zone"
            },
            "tags": {
                        "type": "array",
                        "description": "Network tags",
                        "items": {
                                    "type": "string"
                        }
            },
            "enrollmentString": {
                        "type": "string",
                        "description": "Enrollment string"
            },
            "notes": {
                        "type": "string",
                        "description": "Notes"
            }
},
        required=["network_id"],
        tags=["networks", "update", "write"],
        requires_write=True,
        handler=handle_networks_update,
    ),
    create_tool(
        name="meraki_networks_delete",
        description="""Delete a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "delete", "write", "dangerous"],
        requires_write=True,
        handler=handle_networks_delete,
    ),
    create_tool(
        name="meraki_networks_bind_to_template",
        description="""Bind a network to a configuration template""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "configTemplateId": {
                        "type": "string",
                        "description": "Config template ID"
            },
            "autoBind": {
                        "type": "boolean",
                        "description": "Auto bind settings"
            }
},
        required=["network_id", "configTemplateId"],
        tags=["networks", "template", "bind", "write"],
        requires_write=True,
        handler=handle_networks_bind_to_template,
    ),
    create_tool(
        name="meraki_networks_unbind_from_template",
        description="""Unbind a network from its configuration template""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "retainConfigs": {
                        "type": "boolean",
                        "description": "Retain configuration settings"
            }
},
        required=["network_id"],
        tags=["networks", "template", "unbind", "write"],
        requires_write=True,
        handler=handle_networks_unbind_from_template,
    ),
    create_tool(
        name="meraki_networks_split",
        description="""Split a combined network into individual product networks""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "split", "write"],
        requires_write=True,
        handler=handle_networks_split,
    ),
    create_tool(
        name="meraki_networks_list_devices",
        description="""List all devices in a specific network by network name or ID. Returns device serials, names, models, MAC addresses, firmware versions, and status for each device (MX, MR, MS, MV, MT, MG).""",
        platform="meraki",
        category="networks",
        properties={
            "network_name": {
                        "type": "string",
                        "description": "Network name to search for"
            },
            "network_id": {
                        "type": "string",
                        "description": "Network ID (if known)"
            },
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID (optional)"
            }
},
        required=[],
        tags=["networks", "devices", "list", "read", "inventory", "mx", "mr", "ms", "mv", "mt", "mg", "appliance", "switch", "ap", "camera", "sensor"],
        requires_write=False,
        handler=handle_networks_list_devices,
        examples=[
            {"query": "List devices in the Office network", "params": {"network_name": "Office"}},
            {"query": "Show all devices in network N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "What devices are in San Francisco?", "params": {"network_name": "San Francisco"}},
            {"query": "Show me the switches and APs", "params": {"network_id": "L_636983396225539102"}},
        ],
    ),
    create_tool(
        name="meraki_networks_combine",
        description="""Combine multiple networks into a single combined network""",
        platform="meraki",
        category="networks",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "Name for combined network"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Network IDs to combine",
                        "items": {
                                    "type": "string"
                        }
            },
            "enrollmentString": {
                        "type": "string",
                        "description": "Enrollment string"
            }
},
        required=["organization_id", "name", "networkIds"],
        tags=["networks", "combine", "write"],
        requires_write=True,
        handler=handle_networks_combine,
    ),
    create_tool(
        name="meraki_networks_list_clients",
        description="""List clients connected to a network. Returns MAC addresses, IP addresses, device descriptions, OS types, VLAN assignments, usage data, and connection status for each client.""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds (max 2592000)"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "statuses": {
                        "type": "array",
                        "description": "Filter by status",
                        "items": {
                                    "type": "string"
                        }
            },
            "ip": {
                        "type": "string",
                        "description": "Filter by IP"
            },
            "ip6": {
                        "type": "string",
                        "description": "Filter by IPv6"
            },
            "ip6Local": {
                        "type": "string",
                        "description": "Filter by local IPv6"
            },
            "mac": {
                        "type": "string",
                        "description": "Filter by MAC"
            },
            "os": {
                        "type": "string",
                        "description": "Filter by OS"
            },
            "pskGroup": {
                        "type": "string",
                        "description": "Filter by PSK group"
            },
            "description": {
                        "type": "string",
                        "description": "Filter by description"
            },
            "vlan": {
                        "type": "string",
                        "description": "Filter by VLAN"
            },
            "recentDeviceConnections": {
                        "type": "array",
                        "description": "Filter by recent connections",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["network_id"],
        tags=["networks", "clients", "list", "read"],
        requires_write=False,
        handler=handle_networks_list_clients,
        examples=[
            {"query": "Show clients in network N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "List connected devices", "params": {"network_id": "L_636983396225539102"}},
            {"query": "Who is connected to the network?", "params": {"network_id": "N_123456789012345678", "timespan": 86400}},
            {"query": "Show Windows clients", "params": {"network_id": "N_123456789012345678", "os": "Windows"}},
        ],
    ),
    create_tool(
        name="meraki_networks_get_client",
        description="""Get details of a specific client""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID or MAC address"
            }
},
        required=["network_id", "client_id"],
        tags=["networks", "clients", "get", "read", "details"],
        requires_write=False,
        handler=handle_networks_get_client,
    ),
    create_tool(
        name="meraki_networks_get_client_policy",
        description="""Get the policy assigned to a client""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID or MAC"
            }
},
        required=["network_id", "client_id"],
        tags=["networks", "clients", "policy", "read"],
        requires_write=False,
        handler=handle_networks_get_client_policy,
    ),
    create_tool(
        name="meraki_networks_update_client_policy",
        description="""Update the policy for a client""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID or MAC"
            },
            "devicePolicy": {
                        "type": "string",
                        "description": "Device policy (Group policy, Allowed, Blocked, Normal)"
            },
            "groupPolicyId": {
                        "type": "string",
                        "description": "Group policy ID"
            }
},
        required=["network_id", "client_id", "devicePolicy"],
        tags=["networks", "clients", "policy", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_client_policy,
    ),
    create_tool(
        name="meraki_networks_provision_clients",
        description="""Provision clients with policies""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "clients": {
                        "type": "array",
                        "description": "Clients to provision",
                        "items": {
                                    "type": "object"
                        }
            },
            "devicePolicy": {
                        "type": "string",
                        "description": "Device policy"
            },
            "groupPolicyId": {
                        "type": "string",
                        "description": "Group policy ID"
            },
            "policiesBySecurityAppliance": {
                        "type": "object",
                        "description": "Security appliance policies"
            },
            "policiesBySsid": {
                        "type": "object",
                        "description": "SSID policies"
            }
},
        required=["network_id", "clients", "devicePolicy"],
        tags=["networks", "clients", "provision", "write"],
        requires_write=True,
        handler=handle_networks_provision_clients,
    ),
    create_tool(
        name="meraki_networks_get_client_traffic",
        description="""Get traffic history for a specific client""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID or MAC"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            }
},
        required=["network_id", "client_id"],
        tags=["networks", "clients", "traffic", "read", "history"],
        requires_write=False,
        handler=handle_networks_get_client_traffic,
    ),
    create_tool(
        name="meraki_networks_get_client_usage",
        description="""Get data usage history for a specific client""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID or MAC"
            }
},
        required=["network_id", "client_id"],
        tags=["networks", "clients", "usage", "read", "bandwidth"],
        requires_write=False,
        handler=handle_networks_get_client_usage,
    ),
    create_tool(
        name="meraki_networks_get_events",
        description="""Get events log for a network. Returns timestamps, event types, device info, client info, and event details. Useful for troubleshooting connectivity issues, tracking configuration changes, and security auditing.""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "productType": {
                        "type": "string",
                        "description": "Filter by product type"
            },
            "includedEventTypes": {
                        "type": "array",
                        "description": "Event types to include",
                        "items": {
                                    "type": "string"
                        }
            },
            "excludedEventTypes": {
                        "type": "array",
                        "description": "Event types to exclude",
                        "items": {
                                    "type": "string"
                        }
            },
            "deviceMac": {
                        "type": "string",
                        "description": "Filter by device MAC"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Filter by device serial"
            },
            "deviceName": {
                        "type": "string",
                        "description": "Filter by device name"
            },
            "clientIp": {
                        "type": "string",
                        "description": "Filter by client IP"
            },
            "clientMac": {
                        "type": "string",
                        "description": "Filter by client MAC"
            },
            "clientName": {
                        "type": "string",
                        "description": "Filter by client name"
            },
            "smDeviceMac": {
                        "type": "string",
                        "description": "Filter by SM device MAC"
            },
            "smDeviceName": {
                        "type": "string",
                        "description": "Filter by SM device name"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "endingBefore": {
                        "type": "string",
                        "description": "End pagination cursor"
            }
},
        required=["network_id"],
        tags=["networks", "events", "logs", "read", "audit"],
        requires_write=False,
        handler=handle_networks_get_events,
        examples=[
            {"query": "Show network events for N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "What happened on the network recently?", "params": {"network_id": "L_636983396225539102", "perPage": 50}},
            {"query": "Show events for device Q2HP-XXXX-XXXX", "params": {"network_id": "N_123456789012345678", "deviceSerial": "Q2HP-XXXX-XXXX"}},
            {"query": "Get wireless events", "params": {"network_id": "N_123456789012345678", "productType": "wireless"}},
        ],
    ),
    create_tool(
        name="meraki_networks_get_event_types",
        description="""Get list of event types for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "events", "types", "read"],
        requires_write=False,
        handler=handle_networks_get_event_types,
    ),
    create_tool(
        name="meraki_networks_get_alerts_history",
        description="""Get alert history for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            }
},
        required=["network_id"],
        tags=["networks", "alerts", "history", "read"],
        requires_write=False,
        handler=handle_networks_get_alerts_history,
    ),
    create_tool(
        name="meraki_networks_get_alerts_settings",
        description="""Get alert settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "alerts", "settings", "read"],
        requires_write=False,
        handler=handle_networks_get_alerts_settings,
    ),
    create_tool(
        name="meraki_networks_update_alerts_settings",
        description="""Update alert settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "defaultDestinations": {
                        "type": "object",
                        "description": "Default alert destinations"
            },
            "alerts": {
                        "type": "array",
                        "description": "Alert configurations",
                        "items": {
                                    "type": "object"
                        }
            },
            "muting": {
                        "type": "object",
                        "description": "Muting settings"
            }
},
        required=["network_id"],
        tags=["networks", "alerts", "settings", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_alerts_settings,
    ),
    create_tool(
        name="meraki_networks_get_health_alerts",
        description="""Get health alerts for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "health", "alerts", "read"],
        requires_write=False,
        handler=handle_networks_get_health_alerts,
    ),
    create_tool(
        name="meraki_networks_get_firmware_upgrades",
        description="""Get firmware upgrade information for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "firmware", "upgrades", "read"],
        requires_write=False,
        handler=handle_networks_get_firmware_upgrades,
    ),
    create_tool(
        name="meraki_networks_update_firmware_upgrades",
        description="""Update firmware upgrade settings""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "upgradeWindow": {
                        "type": "object",
                        "description": "Upgrade window settings"
            },
            "timezone": {
                        "type": "string",
                        "description": "Timezone"
            },
            "products": {
                        "type": "object",
                        "description": "Product-specific settings"
            }
},
        required=["network_id"],
        tags=["networks", "firmware", "upgrades", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_firmware_upgrades,
    ),
    create_tool(
        name="meraki_networks_create_firmware_rollback",
        description="""Rollback firmware to a previous version""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "product": {
                        "type": "string",
                        "description": "Product type"
            },
            "time": {
                        "type": "string",
                        "description": "Scheduled time"
            },
            "reasons": {
                        "type": "array",
                        "description": "Rollback reasons",
                        "items": {
                                    "type": "object"
                        }
            },
            "toVersion": {
                        "type": "object",
                        "description": "Target version"
            }
},
        required=["network_id", "product"],
        tags=["networks", "firmware", "rollback", "write"],
        requires_write=True,
        handler=handle_networks_create_firmware_rollback,
    ),
    create_tool(
        name="meraki_networks_get_firmware_staged_events",
        description="""Get staged firmware upgrade events""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "firmware", "staged", "read"],
        requires_write=False,
        handler=handle_networks_get_firmware_staged_events,
    ),
    create_tool(
        name="meraki_networks_list_group_policies",
        description="""List group policies for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "policies", "group", "list", "read"],
        requires_write=False,
        handler=handle_networks_list_group_policies,
    ),
    create_tool(
        name="meraki_networks_create_group_policy",
        description="""Create a new group policy""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Policy name"
            },
            "scheduling": {
                        "type": "object",
                        "description": "Scheduling settings"
            },
            "bandwidth": {
                        "type": "object",
                        "description": "Bandwidth limits"
            },
            "firewallAndTrafficShaping": {
                        "type": "object",
                        "description": "Firewall and traffic shaping"
            },
            "contentFiltering": {
                        "type": "object",
                        "description": "Content filtering"
            },
            "splashAuthSettings": {
                        "type": "string",
                        "description": "Splash auth settings"
            },
            "vlanTagging": {
                        "type": "object",
                        "description": "VLAN tagging"
            },
            "bonjourForwarding": {
                        "type": "object",
                        "description": "Bonjour forwarding"
            }
},
        required=["network_id", "name"],
        tags=["networks", "policies", "group", "create", "write"],
        requires_write=True,
        handler=handle_networks_create_group_policy,
    ),
    create_tool(
        name="meraki_networks_get_group_policy",
        description="""Get details of a group policy""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "group_policy_id": {
                        "type": "string",
                        "description": "Group policy ID"
            }
},
        required=["network_id", "group_policy_id"],
        tags=["networks", "policies", "group", "get", "read"],
        requires_write=False,
        handler=handle_networks_get_group_policy,
    ),
    create_tool(
        name="meraki_networks_update_group_policy",
        description="""Update a group policy""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "group_policy_id": {
                        "type": "string",
                        "description": "Group policy ID"
            },
            "name": {
                        "type": "string",
                        "description": "Policy name"
            },
            "scheduling": {
                        "type": "object",
                        "description": "Scheduling settings"
            },
            "bandwidth": {
                        "type": "object",
                        "description": "Bandwidth limits"
            },
            "firewallAndTrafficShaping": {
                        "type": "object",
                        "description": "Firewall and traffic shaping"
            },
            "contentFiltering": {
                        "type": "object",
                        "description": "Content filtering"
            },
            "splashAuthSettings": {
                        "type": "string",
                        "description": "Splash auth settings"
            },
            "vlanTagging": {
                        "type": "object",
                        "description": "VLAN tagging"
            },
            "bonjourForwarding": {
                        "type": "object",
                        "description": "Bonjour forwarding"
            }
},
        required=["network_id", "group_policy_id"],
        tags=["networks", "policies", "group", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_group_policy,
    ),
    create_tool(
        name="meraki_networks_delete_group_policy",
        description="""Delete a group policy""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "group_policy_id": {
                        "type": "string",
                        "description": "Group policy ID to delete"
            }
},
        required=["network_id", "group_policy_id"],
        tags=["networks", "policies", "group", "delete", "write"],
        requires_write=True,
        handler=handle_networks_delete_group_policy,
    ),
    create_tool(
        name="meraki_networks_list_meraki_auth_users",
        description="""List Meraki authentication users for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "auth", "users", "list", "read"],
        requires_write=False,
        handler=handle_networks_list_meraki_auth_users,
    ),
    create_tool(
        name="meraki_networks_create_meraki_auth_user",
        description="""Create a new Meraki authentication user""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "email": {
                        "type": "string",
                        "description": "User email"
            },
            "name": {
                        "type": "string",
                        "description": "User name"
            },
            "password": {
                        "type": "string",
                        "description": "User password"
            },
            "authorizations": {
                        "type": "array",
                        "description": "Authorization settings",
                        "items": {
                                    "type": "object"
                        }
            },
            "accountType": {
                        "type": "string",
                        "description": "Account type (802.1X, Guest)"
            },
            "emailPasswordToUser": {
                        "type": "boolean",
                        "description": "Email password to user"
            },
            "isAdmin": {
                        "type": "boolean",
                        "description": "Is admin user"
            }
},
        required=["network_id", "email", "authorizations"],
        tags=["networks", "auth", "users", "create", "write"],
        requires_write=True,
        handler=handle_networks_create_meraki_auth_user,
    ),
    create_tool(
        name="meraki_networks_get_meraki_auth_user",
        description="""Get details of a Meraki auth user""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "meraki_auth_user_id": {
                        "type": "string",
                        "description": "Meraki auth user ID"
            }
},
        required=["network_id", "meraki_auth_user_id"],
        tags=["networks", "auth", "users", "get", "read"],
        requires_write=False,
        handler=handle_networks_get_meraki_auth_user,
    ),
    create_tool(
        name="meraki_networks_update_meraki_auth_user",
        description="""Update a Meraki auth user""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "meraki_auth_user_id": {
                        "type": "string",
                        "description": "Meraki auth user ID"
            },
            "name": {
                        "type": "string",
                        "description": "User name"
            },
            "password": {
                        "type": "string",
                        "description": "New password"
            },
            "authorizations": {
                        "type": "array",
                        "description": "Authorization settings",
                        "items": {
                                    "type": "object"
                        }
            },
            "emailPasswordToUser": {
                        "type": "boolean",
                        "description": "Email password"
            }
},
        required=["network_id", "meraki_auth_user_id"],
        tags=["networks", "auth", "users", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_meraki_auth_user,
    ),
    create_tool(
        name="meraki_networks_delete_meraki_auth_user",
        description="""Delete a Meraki auth user""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "meraki_auth_user_id": {
                        "type": "string",
                        "description": "Meraki auth user ID to delete"
            }
},
        required=["network_id", "meraki_auth_user_id"],
        tags=["networks", "auth", "users", "delete", "write"],
        requires_write=True,
        handler=handle_networks_delete_meraki_auth_user,
    ),
    create_tool(
        name="meraki_networks_list_webhooks",
        description="""List webhook HTTP servers for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "webhooks", "list", "read"],
        requires_write=False,
        handler=handle_networks_list_webhooks,
    ),
    create_tool(
        name="meraki_networks_create_webhook",
        description="""Create a new webhook HTTP server""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Webhook name"
            },
            "url": {
                        "type": "string",
                        "description": "Webhook URL"
            },
            "sharedSecret": {
                        "type": "string",
                        "description": "Shared secret for validation"
            },
            "payloadTemplate": {
                        "type": "object",
                        "description": "Payload template settings"
            }
},
        required=["network_id", "name", "url"],
        tags=["networks", "webhooks", "create", "write"],
        requires_write=True,
        handler=handle_networks_create_webhook,
    ),
    create_tool(
        name="meraki_networks_get_webhook",
        description="""Get details of a webhook HTTP server""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "http_server_id": {
                        "type": "string",
                        "description": "HTTP server ID"
            }
},
        required=["network_id", "http_server_id"],
        tags=["networks", "webhooks", "get", "read"],
        requires_write=False,
        handler=handle_networks_get_webhook,
    ),
    create_tool(
        name="meraki_networks_update_webhook",
        description="""Update a webhook HTTP server""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "http_server_id": {
                        "type": "string",
                        "description": "HTTP server ID"
            },
            "name": {
                        "type": "string",
                        "description": "Webhook name"
            },
            "url": {
                        "type": "string",
                        "description": "Webhook URL"
            },
            "sharedSecret": {
                        "type": "string",
                        "description": "Shared secret"
            },
            "payloadTemplate": {
                        "type": "object",
                        "description": "Payload template"
            }
},
        required=["network_id", "http_server_id"],
        tags=["networks", "webhooks", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_webhook,
    ),
    create_tool(
        name="meraki_networks_delete_webhook",
        description="""Delete a webhook HTTP server""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "http_server_id": {
                        "type": "string",
                        "description": "HTTP server ID to delete"
            }
},
        required=["network_id", "http_server_id"],
        tags=["networks", "webhooks", "delete", "write"],
        requires_write=True,
        handler=handle_networks_delete_webhook,
    ),
    create_tool(
        name="meraki_networks_test_webhook",
        description="""Send a test webhook payload""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "url": {
                        "type": "string",
                        "description": "URL to test"
            },
            "sharedSecret": {
                        "type": "string",
                        "description": "Shared secret"
            },
            "payloadTemplate": {
                        "type": "object",
                        "description": "Payload template"
            },
            "alertTypeId": {
                        "type": "string",
                        "description": "Alert type to simulate"
            }
},
        required=["network_id", "url"],
        tags=["networks", "webhooks", "test", "write"],
        requires_write=True,
        handler=handle_networks_test_webhook,
    ),
    create_tool(
        name="meraki_networks_list_floor_plans",
        description="""List floor plans for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "floor", "plans", "list", "read"],
        requires_write=False,
        handler=handle_networks_list_floor_plans,
    ),
    create_tool(
        name="meraki_networks_get_floor_plan",
        description="""Get details of a floor plan""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "floor_plan_id": {
                        "type": "string",
                        "description": "Floor plan ID"
            }
},
        required=["network_id", "floor_plan_id"],
        tags=["networks", "floor", "plans", "get", "read"],
        requires_write=False,
        handler=handle_networks_get_floor_plan,
    ),
    create_tool(
        name="meraki_networks_update_floor_plan",
        description="""Update a floor plan""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "floor_plan_id": {
                        "type": "string",
                        "description": "Floor plan ID"
            },
            "name": {
                        "type": "string",
                        "description": "Floor plan name"
            },
            "center": {
                        "type": "object",
                        "description": "Center coordinates"
            },
            "bottomLeftCorner": {
                        "type": "object",
                        "description": "Bottom left corner"
            },
            "bottomRightCorner": {
                        "type": "object",
                        "description": "Bottom right corner"
            },
            "topLeftCorner": {
                        "type": "object",
                        "description": "Top left corner"
            },
            "topRightCorner": {
                        "type": "object",
                        "description": "Top right corner"
            }
},
        required=["network_id", "floor_plan_id"],
        tags=["networks", "floor", "plans", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_floor_plan,
    ),
    create_tool(
        name="meraki_networks_delete_floor_plan",
        description="""Delete a floor plan""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "floor_plan_id": {
                        "type": "string",
                        "description": "Floor plan ID to delete"
            }
},
        required=["network_id", "floor_plan_id"],
        tags=["networks", "floor", "plans", "delete", "write"],
        requires_write=True,
        handler=handle_networks_delete_floor_plan,
    ),
    create_tool(
        name="meraki_networks_get_traffic_analysis",
        description="""Get traffic analysis settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "traffic", "analysis", "settings", "read"],
        requires_write=False,
        handler=handle_networks_get_traffic_analysis,
    ),
    create_tool(
        name="meraki_networks_update_traffic_analysis",
        description="""Update traffic analysis settings""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "mode": {
                        "type": "string",
                        "description": "Traffic analysis mode (disabled, basic, detailed)"
            },
            "customPieChartItems": {
                        "type": "array",
                        "description": "Custom pie chart items",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["network_id"],
        tags=["networks", "traffic", "analysis", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_traffic_analysis,
    ),
    create_tool(
        name="meraki_networks_get_traffic",
        description="""Get traffic data for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            },
            "deviceType": {
                        "type": "string",
                        "description": "Filter by device type"
            }
},
        required=["network_id"],
        tags=["networks", "traffic", "data", "read"],
        requires_write=False,
        handler=handle_networks_get_traffic,
    ),
    create_tool(
        name="meraki_networks_get_settings",
        description="""Get general settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "settings", "read"],
        requires_write=False,
        handler=handle_networks_get_settings,
    ),
    create_tool(
        name="meraki_networks_update_settings",
        description="""Update general network settings""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "localStatusPageEnabled": {
                        "type": "boolean",
                        "description": "Enable local status page"
            },
            "remoteStatusPageEnabled": {
                        "type": "boolean",
                        "description": "Enable remote status page"
            },
            "localStatusPage": {
                        "type": "object",
                        "description": "Local status page settings"
            },
            "securePort": {
                        "type": "object",
                        "description": "Secure port settings"
            },
            "fips": {
                        "type": "object",
                        "description": "FIPS settings"
            },
            "namedVlans": {
                        "type": "object",
                        "description": "Named VLANs settings"
            }
},
        required=["network_id"],
        tags=["networks", "settings", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_settings,
    ),
    create_tool(
        name="meraki_networks_get_snmp",
        description="""Get SNMP settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "snmp", "settings", "read"],
        requires_write=False,
        handler=handle_networks_get_snmp,
    ),
    create_tool(
        name="meraki_networks_update_snmp",
        description="""Update SNMP settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "access": {
                        "type": "string",
                        "description": "SNMP access (none, community, users)"
            },
            "communityString": {
                        "type": "string",
                        "description": "SNMP community string"
            },
            "users": {
                        "type": "array",
                        "description": "SNMP v3 users",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["network_id"],
        tags=["networks", "snmp", "settings", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_snmp,
    ),
    create_tool(
        name="meraki_networks_get_syslog_servers",
        description="""Get syslog server settings for a network""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["networks", "syslog", "servers", "read"],
        requires_write=False,
        handler=handle_networks_get_syslog_servers,
    ),
    create_tool(
        name="meraki_networks_update_syslog_servers",
        description="""Update syslog server settings""",
        platform="meraki",
        category="networks",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "servers": {
                        "type": "array",
                        "description": "Syslog servers",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["network_id", "servers"],
        tags=["networks", "syslog", "servers", "update", "write"],
        requires_write=True,
        handler=handle_networks_update_syslog_servers,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_networks_tools():
    """Register all networks tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_NETWORKS_TOOLS)
    logger.info(f"Registered {len(MERAKI_NETWORKS_TOOLS)} meraki networks tools")


# Auto-register on import
register_networks_tools()
