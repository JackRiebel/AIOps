"""
Meraki Organizations Tools

Auto-generated from archived A2A skills.
Total tools: 42
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
# HANDLERS
# =============================================================================

async def handle_organizations_list(params: Dict, context: Any) -> Dict:
    """Handler for List Organizations."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Build API path
        path = "/organizations"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get(params: Dict, context: Any) -> Dict:
    """Handler for Get Organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify a Meraki organization ID."
            }

        # Build API path
        path = f"/organizations/{org_id}"

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_create(params: Dict, context: Any) -> Dict:
    """Handler for Create Organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Build API path
        path = "/organizations"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_update(params: Dict, context: Any) -> Dict:
    """Handler for Update Organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify a Meraki organization ID."
            }

        # Build API path
        path = f"/organizations/{org_id}"

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_delete(params: Dict, context: Any) -> Dict:
    """Handler for Delete Organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify a Meraki organization ID."
            }

        # Build API path
        path = f"/organizations/{org_id}"

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_clone(params: Dict, context: Any) -> Dict:
    """Handler for Clone Organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify a Meraki organization ID."
            }

        # Build API path
        path = f"/organizations/{org_id}/clone"

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_list_admins(params: Dict, context: Any) -> Dict:
    """Handler for List Organization Admins."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_create_admin(params: Dict, context: Any) -> Dict:
    """Handler for Create Organization Admin."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/create"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_update_admin(params: Dict, context: Any) -> Dict:
    """Handler for Update Organization Admin."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/update"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_delete_admin(params: Dict, context: Any) -> Dict:
    """Handler for Delete Organization Admin."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/delete"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_list_devices(params: Dict, context: Any) -> Dict:
    """Handler for List Organization Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations"
        path = path.replace("{organization_id}", params.get("organization_id", ""))
        path = path.replace("{serial}", params.get("serial", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_devices_statuses(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Statuses - returns status of all devices in an organization."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify a Meraki organization ID."
            }

        path = f"/organizations/{org_id}/devices/statuses"

        # Filter to valid query params only (exclude path params like organization_id)
        valid_params = ["perPage", "startingAfter", "networkIds", "serials",
                        "statuses", "productTypes", "models", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_devices_availabilities(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Availabilities."""
    try:
        if err := _validate_context(context): return err
        org_id = params.get("organization_id", "")
        path = f"/organizations/{org_id}/devices/availabilities"

        # Filter to valid query params only
        valid_params = ["perPage", "startingAfter", "networkIds", "serials",
                        "productTypes", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_devices_uplinks_addresses(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Uplink Addresses."""
    try:
        if err := _validate_context(context): return err
        org_id = params.get("organization_id", "")
        path = f"/organizations/{org_id}/devices/uplinks/addresses/byDevice"

        # Filter to valid query params only
        valid_params = ["perPage", "startingAfter", "networkIds", "serials", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_devices_power_modules_statuses(params: Dict, context: Any) -> Dict:
    """Handler for Get Power Module Statuses."""
    try:
        if err := _validate_context(context): return err
        org_id = params.get("organization_id", "")
        path = f"/organizations/{org_id}/devices/powerModules/statuses/byDevice"

        # Filter to valid query params only
        valid_params = ["perPage", "startingAfter", "networkIds", "serials", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_devices_provisioning_statuses(params: Dict, context: Any) -> Dict:
    """Handler for Get Provisioning Statuses."""
    try:
        if err := _validate_context(context): return err
        org_id = params.get("organization_id", "")
        path = f"/organizations/{org_id}/devices/provisioning/statuses"

        # Filter to valid query params only
        valid_params = ["perPage", "startingAfter", "networkIds", "serials",
                        "productTypes", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_list_alerts_profiles(params: Dict, context: Any) -> Dict:
    """Handler for List Alert Profiles."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_create_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create Alert Profile."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/create"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_update_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update Alert Profile."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/update"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_delete_alerts_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete Alert Profile."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/delete"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_assurance_alerts(params: Dict, context: Any) -> Dict:
    """Handler for Get Assurance Alerts - organization-wide health alerts."""
    try:
        # Validate execution context has a Meraki client
        if not hasattr(context, 'client') or context.client is None:
            return {
                "success": False,
                "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
            }

        # Get organization_id from params or context
        org_id = params.get("organization_id") or params.get("organizationId")
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        if not org_id:
            return {
                "success": False,
                "error": "Missing required parameter: organization_id. Please specify an organization ID."
            }

        # Build API path - Meraki API: GET /organizations/{organizationId}/assurance/alerts
        path = f"/organizations/{org_id}/assurance/alerts"

        # Filter out org_id params, pass rest as query params
        query_params = {k: v for k, v in params.items() if k not in ('organization_id', 'organizationId')}

        # Make API request
        result = await context.client.request("GET", path, params=query_params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_dismiss_assurance_alerts(params: Dict, context: Any) -> Dict:
    """Handler for Dismiss Assurance Alerts."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/dismiss"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_list_config_templates(params: Dict, context: Any) -> Dict:
    """Handler for List Config Templates."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_create_config_template(params: Dict, context: Any) -> Dict:
    """Handler for Create Config Template."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/create"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_config_template(params: Dict, context: Any) -> Dict:
    """Handler for Get Config Template."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_update_config_template(params: Dict, context: Any) -> Dict:
    """Handler for Update Config Template."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/update"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_delete_config_template(params: Dict, context: Any) -> Dict:
    """Handler for Delete Config Template."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/delete"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_inventory_devices(params: Dict, context: Any) -> Dict:
    """Handler for Get Inventory Devices."""
    try:
        if err := _validate_context(context): return err
        org_id = params.get("organization_id", "")
        path = f"/organizations/{org_id}/inventory/devices"

        # Filter to valid query params only
        valid_params = ["perPage", "startingAfter", "usedState", "search", "networkIds",
                        "productTypes", "serials", "models", "tags", "tagsFilterType"]
        query_params = {k: params[k] for k in valid_params if params.get(k)}

        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_claim_devices(params: Dict, context: Any) -> Dict:
    """Handler for Claim Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/claim"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_release_devices(params: Dict, context: Any) -> Dict:
    """Handler for Release Devices."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/release"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_inventory_onboarding_cloud_status(params: Dict, context: Any) -> Dict:
    """Handler for Get Cloud Onboarding Status."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_list_action_batches(params: Dict, context: Any) -> Dict:
    """Handler for List Action Batches."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_create_action_batch(params: Dict, context: Any) -> Dict:
    """Handler for Create Action Batch."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/create"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_action_batch(params: Dict, context: Any) -> Dict:
    """Handler for Get Action Batch."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_delete_action_batch(params: Dict, context: Any) -> Dict:
    """Handler for Delete Action Batch."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/delete"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_update_action_batch(params: Dict, context: Any) -> Dict:
    """Handler for Update Action Batch."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/update"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_api_requests(params: Dict, context: Any) -> Dict:
    """Handler for Get API Requests."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_api_requests_overview(params: Dict, context: Any) -> Dict:
    """Handler for Get API Requests Overview."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_api_requests_overview_response_codes(params: Dict, context: Any) -> Dict:
    """Handler for Get API Response Codes Overview."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_search_clients(params: Dict, context: Any) -> Dict:
    """Handler for Search Clients."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/search"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_clients_bandwidth_usage(params: Dict, context: Any) -> Dict:
    """Handler for Get Clients Bandwidth Usage."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_organizations_get_clients_overview(params: Dict, context: Any) -> Dict:
    """Handler for Get Clients Overview."""
    try:
        if err := _validate_context(context): return err
        # Build API path
        path = "/organizations/{organization_id}/get"
        path = path.replace("{organization_id}", params.get("organization_id", ""))

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_ORGANIZATIONS_TOOLS = [
    create_tool(
        name="meraki_organizations_list",
        description="""List all Meraki organizations accessible with the API key. Returns organization ID, name, and basic details for each org.""",
        platform="meraki",
        category="organizations",
        properties={},
        required=[],
        tags=["organizations", "list", "read"],
        requires_write=False,
        handler=handle_organizations_list,
        examples=[
            {"query": "Show me all my organizations", "params": {}},
            {"query": "What orgs do I have access to?", "params": {}},
            {"query": "List Meraki organizations", "params": {}},
        ],
    ),
    create_tool(
        name="meraki_organizations_get",
        description="""Get details of a specific organization by ID including name, licensing, and management settings""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["organizations", "get", "read", "details"],
        requires_write=False,
        handler=handle_organizations_get,
        examples=[
            {"query": "Get details for organization 123456", "params": {"organization_id": "123456"}},
            {"query": "Show org info", "params": {"organization_id": "549236"}},
        ],
    ),
    create_tool(
        name="meraki_organizations_create",
        description="""Create a new Meraki organization""",
        platform="meraki",
        category="organizations",
        properties={
            "name": {
                        "type": "string",
                        "description": "Organization name"
            },
            "management": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["name"],
        tags=["organizations", "create", "write"],
        requires_write=True,
        handler=handle_organizations_create,
    ),
    create_tool(
        name="meraki_organizations_update",
        description="""Update an organization's name or settings""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "New organization name"
            },
            "management": {
                        "type": "object",
                        "description": "Management settings"
            }
},
        required=["organization_id"],
        tags=["organizations", "update", "write"],
        requires_write=True,
        handler=handle_organizations_update,
    ),
    create_tool(
        name="meraki_organizations_delete",
        description="""Delete an organization (requires org to be empty)""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["organizations", "delete", "write", "dangerous"],
        requires_write=True,
        handler=handle_organizations_delete,
    ),
    create_tool(
        name="meraki_organizations_clone",
        description="""Clone an existing organization to create a new one""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Source organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "Name for the new organization"
            }
},
        required=["organization_id", "name"],
        tags=["organizations", "clone", "create", "write"],
        requires_write=True,
        handler=handle_organizations_clone,
    ),
    create_tool(
        name="meraki_organizations_list_admins",
        description="""List all administrators for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["organizations", "admins", "list", "read", "users"],
        requires_write=False,
        handler=handle_organizations_list_admins,
    ),
    create_tool(
        name="meraki_organizations_create_admin",
        description="""Create a new administrator for the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "email": {
                        "type": "string",
                        "description": "Admin email address"
            },
            "name": {
                        "type": "string",
                        "description": "Admin name"
            },
            "orgAccess": {
                        "type": "string",
                        "description": "Organization access level",
                        "enum": [
                                    "full",
                                    "read-only",
                                    "enterprise",
                                    "none"
                        ]
            },
            "tags": {
                        "type": "array",
                        "description": "Network tags for access control",
                        "items": {
                                    "type": "object"
                        }
            },
            "networks": {
                        "type": "array",
                        "description": "Network-specific access",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["organization_id", "email", "name", "orgAccess"],
        tags=["organizations", "admins", "create", "write", "users"],
        requires_write=True,
        handler=handle_organizations_create_admin,
    ),
    create_tool(
        name="meraki_organizations_update_admin",
        description="""Update an administrator's access or settings""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "admin_id": {
                        "type": "string",
                        "description": "Admin ID"
            },
            "name": {
                        "type": "string",
                        "description": "Admin name"
            },
            "orgAccess": {
                        "type": "string",
                        "description": "Organization access level"
            },
            "tags": {
                        "type": "array",
                        "description": "Network tags"
            },
            "networks": {
                        "type": "array",
                        "description": "Network access"
            }
},
        required=["organization_id", "admin_id"],
        tags=["organizations", "admins", "update", "write", "users"],
        requires_write=True,
        handler=handle_organizations_update_admin,
    ),
    create_tool(
        name="meraki_organizations_delete_admin",
        description="""Remove an administrator from the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "admin_id": {
                        "type": "string",
                        "description": "Admin ID to delete"
            }
},
        required=["organization_id", "admin_id"],
        tags=["organizations", "admins", "delete", "write", "users"],
        requires_write=True,
        handler=handle_organizations_delete_admin,
    ),
    create_tool(
        name="meraki_organizations_list_devices",
        description="""List all devices across all networks in an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number of entries per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "configurationUpdatedAfter": {
                        "type": "string",
                        "description": "Filter by config update time"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by network IDs",
                        "items": {
                                    "type": "string"
                        }
            },
            "productTypes": {
                        "type": "array",
                        "description": "Filter by product types",
                        "items": {
                                    "type": "string"
                        }
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
                        "description": "Tag filter logic (withAnyTags, withAllTags)"
            },
            "name": {
                        "type": "string",
                        "description": "Filter by device name"
            },
            "mac": {
                        "type": "string",
                        "description": "Filter by MAC address"
            },
            "serial": {
                        "type": "string",
                        "description": "Filter by serial number"
            },
            "model": {
                        "type": "string",
                        "description": "Filter by model"
            },
            "macs": {
                        "type": "array",
                        "description": "Filter by multiple MACs",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by multiple serials",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "list", "read", "inventory"],
        requires_write=False,
        handler=handle_organizations_list_devices,
    ),
    create_tool(
        name="meraki_organizations_get_devices_statuses",
        description="""Get the online/offline status of all devices in an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "statuses": {
                        "type": "array",
                        "description": "Filter by status (online, alerting, offline, dormant)",
                        "items": {
                                    "type": "string"
                        }
            },
            "productTypes": {
                        "type": "array",
                        "description": "Filter by product type",
                        "items": {
                                    "type": "string"
                        }
            },
            "models": {
                        "type": "array",
                        "description": "Filter by models",
                        "items": {
                                    "type": "string"
                        }
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
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "status", "read", "health", "monitoring"],
        requires_write=False,
        handler=handle_organizations_get_devices_statuses,
    ),
    create_tool(
        name="meraki_organizations_get_devices_availabilities",
        description="""Get device availability history for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "productTypes": {
                        "type": "array",
                        "description": "Filter by product type",
                        "items": {
                                    "type": "string"
                        }
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
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "availability", "read", "health", "uptime"],
        requires_write=False,
        handler=handle_organizations_get_devices_availabilities,
    ),
    create_tool(
        name="meraki_organizations_get_devices_uplinks_addresses",
        description="""Get uplink IP addresses for devices in an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "productTypes": {
                        "type": "array",
                        "description": "Filter by product type",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "uplinks", "read", "ip", "addresses"],
        requires_write=False,
        handler=handle_organizations_get_devices_uplinks_addresses,
    ),
    create_tool(
        name="meraki_organizations_get_devices_power_modules_statuses",
        description="""Get power module status for devices with redundant power""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "power", "read", "hardware", "status"],
        requires_write=False,
        handler=handle_organizations_get_devices_power_modules_statuses,
    ),
    create_tool(
        name="meraki_organizations_get_devices_provisioning_statuses",
        description="""Get provisioning status for devices in an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "status": {
                        "type": "string",
                        "description": "Filter by status"
            }
},
        required=["organization_id"],
        tags=["organizations", "devices", "provisioning", "read", "status"],
        requires_write=False,
        handler=handle_organizations_get_devices_provisioning_statuses,
    ),
    create_tool(
        name="meraki_organizations_list_alerts_profiles",
        description="""List all alert configuration profiles for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["organizations", "alerts", "list", "read", "notifications"],
        requires_write=False,
        handler=handle_organizations_list_alerts_profiles,
    ),
    create_tool(
        name="meraki_organizations_create_alerts_profile",
        description="""Create a new alert configuration profile""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "type": {
                        "type": "string",
                        "description": "Alert type"
            },
            "alertCondition": {
                        "type": "object",
                        "description": "Alert condition settings"
            },
            "recipients": {
                        "type": "object",
                        "description": "Alert recipients"
            },
            "networkTags": {
                        "type": "array",
                        "description": "Network tags to apply alert to",
                        "items": {
                                    "type": "string"
                        }
            },
            "description": {
                        "type": "string",
                        "description": "Alert description"
            }
},
        required=["organization_id", "type", "alertCondition", "recipients", "networkTags"],
        tags=["organizations", "alerts", "create", "write", "notifications"],
        requires_write=True,
        handler=handle_organizations_create_alerts_profile,
    ),
    create_tool(
        name="meraki_organizations_update_alerts_profile",
        description="""Update an existing alert configuration profile""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "alert_config_id": {
                        "type": "string",
                        "description": "Alert config ID"
            },
            "enabled": {
                        "type": "boolean",
                        "description": "Enable/disable alert"
            },
            "type": {
                        "type": "string",
                        "description": "Alert type"
            },
            "alertCondition": {
                        "type": "object",
                        "description": "Alert condition"
            },
            "recipients": {
                        "type": "object",
                        "description": "Recipients"
            },
            "networkTags": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            },
            "description": {
                        "type": "string",
                        "description": "Description"
            }
},
        required=["organization_id", "alert_config_id"],
        tags=["organizations", "alerts", "update", "write", "notifications"],
        requires_write=True,
        handler=handle_organizations_update_alerts_profile,
    ),
    create_tool(
        name="meraki_organizations_delete_alerts_profile",
        description="""Delete an alert configuration profile""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "alert_config_id": {
                        "type": "string",
                        "description": "Alert config ID to delete"
            }
},
        required=["organization_id", "alert_config_id"],
        tags=["organizations", "alerts", "delete", "write", "notifications"],
        requires_write=True,
        handler=handle_organizations_delete_alerts_profile,
    ),
    create_tool(
        name="meraki_organizations_get_assurance_alerts",
        description="""Get current assurance alerts for the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "sortOrder": {
                        "type": "string",
                        "description": "Sort order (ascending, descending)"
            },
            "networkId": {
                        "type": "string",
                        "description": "Filter by network"
            },
            "severity": {
                        "type": "string",
                        "description": "Filter by severity"
            },
            "types": {
                        "type": "array",
                        "description": "Filter by types",
                        "items": {
                                    "type": "string"
                        }
            },
            "tsStart": {
                        "type": "string",
                        "description": "Start time"
            },
            "tsEnd": {
                        "type": "string",
                        "description": "End time"
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "deviceTypes": {
                        "type": "array",
                        "description": "Filter by device types",
                        "items": {
                                    "type": "string"
                        }
            },
            "dismissed": {
                        "type": "boolean",
                        "description": "Include dismissed alerts"
            },
            "resolved": {
                        "type": "boolean",
                        "description": "Include resolved alerts"
            },
            "suppressAlertsForOfflineNodes": {
                        "type": "boolean",
                        "description": "Suppress offline alerts"
            }
},
        required=["organization_id"],
        tags=["organizations", "alerts", "assurance", "read", "health"],
        requires_write=False,
        handler=handle_organizations_get_assurance_alerts,
    ),
    create_tool(
        name="meraki_organizations_dismiss_assurance_alerts",
        description="""Dismiss assurance alerts""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "alertIds": {
                        "type": "array",
                        "description": "Alert IDs to dismiss",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id", "alertIds"],
        tags=["organizations", "alerts", "assurance", "write", "dismiss"],
        requires_write=True,
        handler=handle_organizations_dismiss_assurance_alerts,
    ),
    create_tool(
        name="meraki_organizations_list_config_templates",
        description="""List all configuration templates for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            }
},
        required=["organization_id"],
        tags=["organizations", "config", "templates", "list", "read"],
        requires_write=False,
        handler=handle_organizations_list_config_templates,
    ),
    create_tool(
        name="meraki_organizations_create_config_template",
        description="""Create a new configuration template""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "name": {
                        "type": "string",
                        "description": "Template name"
            },
            "timeZone": {
                        "type": "string",
                        "description": "Time zone"
            },
            "copyFromNetworkId": {
                        "type": "string",
                        "description": "Network to copy settings from"
            }
},
        required=["organization_id", "name"],
        tags=["organizations", "config", "templates", "create", "write"],
        requires_write=True,
        handler=handle_organizations_create_config_template,
    ),
    create_tool(
        name="meraki_organizations_get_config_template",
        description="""Get details of a configuration template""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "config_template_id": {
                        "type": "string",
                        "description": "Config template ID"
            }
},
        required=["organization_id", "config_template_id"],
        tags=["organizations", "config", "templates", "get", "read"],
        requires_write=False,
        handler=handle_organizations_get_config_template,
    ),
    create_tool(
        name="meraki_organizations_update_config_template",
        description="""Update a configuration template""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "config_template_id": {
                        "type": "string",
                        "description": "Config template ID"
            },
            "name": {
                        "type": "string",
                        "description": "New name"
            },
            "timeZone": {
                        "type": "string",
                        "description": "Time zone"
            }
},
        required=["organization_id", "config_template_id"],
        tags=["organizations", "config", "templates", "update", "write"],
        requires_write=True,
        handler=handle_organizations_update_config_template,
    ),
    create_tool(
        name="meraki_organizations_delete_config_template",
        description="""Delete a configuration template""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "config_template_id": {
                        "type": "string",
                        "description": "Config template ID to delete"
            }
},
        required=["organization_id", "config_template_id"],
        tags=["organizations", "config", "templates", "delete", "write"],
        requires_write=True,
        handler=handle_organizations_delete_config_template,
    ),
    create_tool(
        name="meraki_organizations_get_inventory_devices",
        description="""Get the device inventory for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "usedState": {
                        "type": "string",
                        "description": "Filter by state (used, unused)"
            },
            "search": {
                        "type": "string",
                        "description": "Search string"
            },
            "macs": {
                        "type": "array",
                        "description": "Filter by MACs",
                        "items": {
                                    "type": "string"
                        }
            },
            "networkIds": {
                        "type": "array",
                        "description": "Filter by networks",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Filter by serials",
                        "items": {
                                    "type": "string"
                        }
            },
            "models": {
                        "type": "array",
                        "description": "Filter by models",
                        "items": {
                                    "type": "string"
                        }
            },
            "orderNumbers": {
                        "type": "array",
                        "description": "Filter by order numbers",
                        "items": {
                                    "type": "string"
                        }
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
            "productTypes": {
                        "type": "array",
                        "description": "Filter by product types",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "inventory", "devices", "list", "read"],
        requires_write=False,
        handler=handle_organizations_get_inventory_devices,
    ),
    create_tool(
        name="meraki_organizations_claim_devices",
        description="""Claim devices into the organization inventory""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "orders": {
                        "type": "array",
                        "description": "Order numbers to claim",
                        "items": {
                                    "type": "string"
                        }
            },
            "serials": {
                        "type": "array",
                        "description": "Serial numbers to claim",
                        "items": {
                                    "type": "string"
                        }
            },
            "licenses": {
                        "type": "array",
                        "description": "License keys to claim",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "inventory", "claim", "write", "devices"],
        requires_write=True,
        handler=handle_organizations_claim_devices,
    ),
    create_tool(
        name="meraki_organizations_release_devices",
        description="""Release devices from the organization inventory""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "serials": {
                        "type": "array",
                        "description": "Serial numbers to release",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id", "serials"],
        tags=["organizations", "inventory", "release", "write", "devices"],
        requires_write=True,
        handler=handle_organizations_release_devices,
    ),
    create_tool(
        name="meraki_organizations_get_inventory_onboarding_cloud_status",
        description="""Get cloud onboarding status for inventory devices""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "serials": {
                        "type": "array",
                        "description": "Device serials",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id", "serials"],
        tags=["organizations", "inventory", "onboarding", "cloud", "read", "status"],
        requires_write=False,
        handler=handle_organizations_get_inventory_onboarding_cloud_status,
    ),
    create_tool(
        name="meraki_organizations_list_action_batches",
        description="""List all action batches for an organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "status": {
                        "type": "string",
                        "description": "Filter by status"
            }
},
        required=["organization_id"],
        tags=["organizations", "actions", "batches", "list", "read", "bulk"],
        requires_write=False,
        handler=handle_organizations_list_action_batches,
    ),
    create_tool(
        name="meraki_organizations_create_action_batch",
        description="""Create a new action batch for bulk operations""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "confirmed": {
                        "type": "boolean",
                        "description": "Confirm batch execution"
            },
            "synchronous": {
                        "type": "boolean",
                        "description": "Execute synchronously"
            },
            "actions": {
                        "type": "array",
                        "description": "Actions to execute",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["organization_id", "actions"],
        tags=["organizations", "actions", "batches", "create", "write", "bulk"],
        requires_write=True,
        handler=handle_organizations_create_action_batch,
    ),
    create_tool(
        name="meraki_organizations_get_action_batch",
        description="""Get status of an action batch""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "action_batch_id": {
                        "type": "string",
                        "description": "Action batch ID"
            }
},
        required=["organization_id", "action_batch_id"],
        tags=["organizations", "actions", "batches", "get", "read", "status"],
        requires_write=False,
        handler=handle_organizations_get_action_batch,
    ),
    create_tool(
        name="meraki_organizations_delete_action_batch",
        description="""Delete an action batch""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "action_batch_id": {
                        "type": "string",
                        "description": "Action batch ID to delete"
            }
},
        required=["organization_id", "action_batch_id"],
        tags=["organizations", "actions", "batches", "delete", "write"],
        requires_write=True,
        handler=handle_organizations_delete_action_batch,
    ),
    create_tool(
        name="meraki_organizations_update_action_batch",
        description="""Update an action batch (confirm execution)""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "action_batch_id": {
                        "type": "string",
                        "description": "Action batch ID"
            },
            "confirmed": {
                        "type": "boolean",
                        "description": "Confirm batch"
            },
            "synchronous": {
                        "type": "boolean",
                        "description": "Execute synchronously"
            }
},
        required=["organization_id", "action_batch_id"],
        tags=["organizations", "actions", "batches", "update", "write"],
        requires_write=True,
        handler=handle_organizations_update_action_batch,
    ),
    create_tool(
        name="meraki_organizations_get_api_requests",
        description="""Get API request log for the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            },
            "perPage": {
                        "type": "integer",
                        "description": "Number per page"
            },
            "startingAfter": {
                        "type": "string",
                        "description": "Pagination cursor"
            },
            "adminId": {
                        "type": "string",
                        "description": "Filter by admin"
            },
            "path": {
                        "type": "string",
                        "description": "Filter by API path"
            },
            "method": {
                        "type": "string",
                        "description": "Filter by HTTP method"
            },
            "responseCode": {
                        "type": "integer",
                        "description": "Filter by response code"
            },
            "sourceIp": {
                        "type": "string",
                        "description": "Filter by source IP"
            },
            "userAgent": {
                        "type": "string",
                        "description": "Filter by user agent"
            },
            "version": {
                        "type": "integer",
                        "description": "API version filter"
            },
            "operationIds": {
                        "type": "array",
                        "description": "Filter by operation IDs",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["organization_id"],
        tags=["organizations", "api", "requests", "read", "logs", "audit"],
        requires_write=False,
        handler=handle_organizations_get_api_requests,
    ),
    create_tool(
        name="meraki_organizations_get_api_requests_overview",
        description="""Get API request overview/summary for the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["organization_id"],
        tags=["organizations", "api", "requests", "overview", "read", "summary"],
        requires_write=False,
        handler=handle_organizations_get_api_requests_overview,
    ),
    create_tool(
        name="meraki_organizations_get_api_requests_overview_response_codes",
        description="""Get breakdown of API response codes""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["organization_id"],
        tags=["organizations", "api", "requests", "response", "codes", "read"],
        requires_write=False,
        handler=handle_organizations_get_api_requests_overview_response_codes,
    ),
    create_tool(
        name="meraki_organizations_search_clients",
        description="""Search for clients across the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "mac": {
                        "type": "string",
                        "description": "Client MAC address"
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
        required=["organization_id", "mac"],
        tags=["organizations", "clients", "search", "read"],
        requires_write=False,
        handler=handle_organizations_search_clients,
    ),
    create_tool(
        name="meraki_organizations_get_clients_bandwidth_usage",
        description="""Get bandwidth usage history for clients""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["organization_id"],
        tags=["organizations", "clients", "bandwidth", "usage", "read"],
        requires_write=False,
        handler=handle_organizations_get_clients_bandwidth_usage,
    ),
    create_tool(
        name="meraki_organizations_get_clients_overview",
        description="""Get overview of clients in the organization""",
        platform="meraki",
        category="organizations",
        properties={
            "organization_id": {
                        "type": "string",
                        "description": "Organization ID"
            },
            "t0": {
                        "type": "string",
                        "description": "Start time"
            },
            "t1": {
                        "type": "string",
                        "description": "End time"
            },
            "timespan": {
                        "type": "number",
                        "description": "Timespan in seconds"
            }
},
        required=["organization_id"],
        tags=["organizations", "clients", "overview", "read", "summary"],
        requires_write=False,
        handler=handle_organizations_get_clients_overview,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_organizations_tools():
    """Register all organizations tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_ORGANIZATIONS_TOOLS)
    logger.info(f"Registered {len(MERAKI_ORGANIZATIONS_TOOLS)} meraki organizations tools")


# Auto-register on import
register_organizations_tools()
