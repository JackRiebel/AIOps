"""
Meraki Wireless Tools

Auto-generated from archived A2A skills.
Total tools: 41
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.meraki_api import MerakiAPIClient


logger = logging.getLogger(__name__)


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

# Meraki network IDs start with L_ or N_ followed by digits
MERAKI_NETWORK_ID_PATTERN = re.compile(r'^[LN]_\d+$')


def validate_network_id(network_id: Optional[str]) -> Tuple[bool, Optional[str]]:
    """Validate that network_id looks like a valid Meraki network ID.

    Meraki network IDs have the format: L_123456789012345678 or N_123456789012345678

    Args:
        network_id: The network_id value to validate

    Returns:
        Tuple of (is_valid, error_message). If valid, error_message is None.
    """
    if not network_id:
        return False, "network_id is required"

    if not isinstance(network_id, str):
        return False, f"network_id must be a string, got {type(network_id).__name__}"

    # Check if it matches the Meraki network ID pattern
    if MERAKI_NETWORK_ID_PATTERN.match(network_id):
        return True, None

    # If it doesn't match, it might be a network name instead of an ID
    # Provide a helpful error message
    if network_id and not network_id.startswith(('L_', 'N_')):
        return False, (
            f"Invalid network_id format: '{network_id}'. "
            f"This looks like a network name, not a network ID. "
            f"Meraki network IDs start with 'L_' or 'N_' followed by digits (e.g., 'L_123456789012345678'). "
            f"Please look up the network ID from the AVAILABLE PLATFORM DATA section in the session context, "
            f"or use meraki_list_organization_networks to find the network ID for this network name."
        )

    return False, (
        f"Invalid network_id format: '{network_id}'. "
        f"Expected format: L_123456789012345678 or N_123456789012345678"
    )


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

async def handle_wireless_list_ssids(params: Dict, context: Any) -> Dict:
    """Handler for List SSIDs."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/ssids"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"List SSIDs failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_ssid(params: Dict, context: Any) -> Dict:
    """Handler for Get SSID."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get SSID failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_ssid(params: Dict, context: Any) -> Dict:
    """Handler for Update SSID."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}"
        # Remove path params from body
        body = {k: v for k, v in params.items() if k not in ["network_id", "number"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update SSID failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_ssid_splash_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get SSID Splash Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/splash/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get SSID splash settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_ssid_splash_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update SSID Splash Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/splash/settings"
        body = {k: v for k, v in params.items() if k not in ["network_id", "number"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update SSID splash settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_ssid_firewall_rules(params: Dict, context: Any) -> Dict:
    """Handler for Get SSID Firewall Rules."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/firewall/l3FirewallRules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get SSID firewall rules failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_ssid_firewall_rules(params: Dict, context: Any) -> Dict:
    """Handler for Update SSID Firewall Rules."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/firewall/l3FirewallRules"
        body = {k: v for k, v in params.items() if k not in ["network_id", "number"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update SSID firewall rules failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_ssid_traffic_shaping(params: Dict, context: Any) -> Dict:
    """Handler for Get SSID Traffic Shaping."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/trafficShaping/rules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get SSID traffic shaping failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_ssid_traffic_shaping(params: Dict, context: Any) -> Dict:
    """Handler for Update SSID Traffic Shaping."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        number = params.get("number")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if number is None:
            return {"success": False, "error": "number is required"}

        path = f"/networks/{network_id}/wireless/ssids/{number}/trafficShaping/rules"
        body = {k: v for k, v in params.items() if k not in ["network_id", "number"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update SSID traffic shaping failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_list_rf_profiles(params: Dict, context: Any) -> Dict:
    """Handler for List RF Profiles."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/rfProfiles"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"List RF profiles failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_create_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Create RF Profile."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/rfProfiles"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Create RF profile failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Get RF Profile."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        rf_profile_id = params.get("rf_profile_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if not rf_profile_id:
            return {"success": False, "error": "rf_profile_id is required"}

        path = f"/networks/{network_id}/wireless/rfProfiles/{rf_profile_id}"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get RF profile failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Update RF Profile."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        rf_profile_id = params.get("rf_profile_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if not rf_profile_id:
            return {"success": False, "error": "rf_profile_id is required"}

        path = f"/networks/{network_id}/wireless/rfProfiles/{rf_profile_id}"
        body = {k: v for k, v in params.items() if k not in ["network_id", "rf_profile_id"]}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update RF profile failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_delete_rf_profile(params: Dict, context: Any) -> Dict:
    """Handler for Delete RF Profile."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        rf_profile_id = params.get("rf_profile_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}
        if not rf_profile_id:
            return {"success": False, "error": "rf_profile_id is required"}

        path = f"/networks/{network_id}/wireless/rfProfiles/{rf_profile_id}"
        result = await context.client.request("DELETE", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Delete RF profile failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_bluetooth_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Bluetooth Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/bluetooth/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get bluetooth settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_bluetooth_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Bluetooth Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/bluetooth/settings"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update bluetooth settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_device_bluetooth(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Bluetooth Settings."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/wireless/bluetooth/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get device bluetooth failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_device_bluetooth(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Bluetooth Settings."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/wireless/bluetooth/settings"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update device bluetooth failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_air_marshal(params: Dict, context: Any) -> Dict:
    """Handler for Get Air Marshal Data."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/airMarshal"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get air marshal failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_air_marshal_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Air Marshal Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/airMarshal/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get air marshal settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_air_marshal_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Air Marshal Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/airMarshal/settings"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update air marshal settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_list_air_marshal_rules(params: Dict, context: Any) -> Dict:
    """Handler for List Air Marshal Rules."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/airMarshal/rules"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"List air marshal rules failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_create_air_marshal_rule(params: Dict, context: Any) -> Dict:
    """Handler for Create Air Marshal Rule."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/airMarshal/rules"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("POST", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Create air marshal rule failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_connection_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Connection Stats."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        logger.info(f"[Wireless] get_connection_stats called with network_id={network_id}")

        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            logger.warning(f"[Wireless] Invalid network_id: {error_msg}")
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/connectionStats"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        # Default to last 24 hours if no time params provided
        if not any(k in query_params for k in ["t0", "t1", "timespan"]):
            query_params["timespan"] = 86400  # 24 hours
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        error_str = str(e)
        logger.error(f"Get connection stats failed for network_id={params.get('network_id')}: {e}")
        # Provide more helpful error message for 400 errors
        if "400" in error_str:
            return {
                "success": False,
                "error": f"Meraki API returned 400 Bad Request. This usually means the network '{params.get('network_id')}' "
                         "does not have wireless capability (no MR access points). "
                         "Please verify the network has wireless devices configured."
            }
        return {"success": False, "error": error_str}


async def handle_wireless_get_clients_connection_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Clients Connection Stats."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/clients/connectionStats"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get clients connection stats failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_device_connection_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Connection Stats."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/wireless/connectionStats"
        query_params = {k: v for k, v in params.items() if k != "serial" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get device connection stats failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_failed_connections(params: Dict, context: Any) -> Dict:
    """Handler for Get Failed Connections."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        logger.info(f"[Wireless] get_failed_connections called with network_id={network_id}")

        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            logger.warning(f"[Wireless] Invalid network_id: {error_msg}")
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/failedConnections"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        error_str = str(e)
        logger.error(f"Get failed connections failed for network_id={params.get('network_id')}: {e}")
        if "400" in error_str:
            return {
                "success": False,
                "error": f"Meraki API returned 400 Bad Request. This usually means the network '{params.get('network_id')}' "
                         "does not have wireless capability (no MR access points). "
                         "Please verify the network has wireless devices configured."
            }
        return {"success": False, "error": error_str}


async def handle_wireless_get_latency_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Latency Stats."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        logger.info(f"[Wireless] get_latency_stats called with network_id={network_id}")

        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            logger.warning(f"[Wireless] Invalid network_id: {error_msg}")
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/latencyStats"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        # Default to last 24 hours if no time params provided
        if not any(k in query_params for k in ["t0", "t1", "timespan"]):
            query_params["timespan"] = 86400  # 24 hours
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        error_str = str(e)
        logger.error(f"Get latency stats failed for network_id={params.get('network_id')}: {e}")
        if "400" in error_str:
            return {
                "success": False,
                "error": f"Meraki API returned 400 Bad Request. This usually means the network '{params.get('network_id')}' "
                         "does not have wireless capability (no MR access points). "
                         "Please verify the network has wireless devices configured."
            }
        return {"success": False, "error": error_str}


async def handle_wireless_get_latency_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Latency History."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/latencyHistory"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get latency history failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_client_latency_stats(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Latency Stats."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        client_id = params.get("client_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}
        if not client_id:
            return {"success": False, "error": "client_id is required"}

        path = f"/networks/{network_id}/wireless/clients/{client_id}/latencyStats"
        query_params = {k: v for k, v in params.items() if k not in ["network_id", "client_id"] and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get client latency stats failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_device_radio_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Radio Settings."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/wireless/radio/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get device radio settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_device_radio_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Device Radio Settings."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        path = f"/devices/{serial}/wireless/radio/settings"
        body = {k: v for k, v in params.items() if k != "serial"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update device radio settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_channel_utilization(params: Dict, context: Any) -> Dict:
    """Handler for Get Channel Utilization."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        # Build query params (exclude network_id)
        query_params = {k: v for k, v in params.items()
                       if k != "network_id" and v is not None}
        # Default to last 24 hours if no time params provided
        if not any(k in query_params for k in ["t0", "t1", "timespan"]):
            query_params["timespan"] = 86400  # 24 hours

        # Make API request to correct endpoint
        path = f"/networks/{network_id}/wireless/channelUtilizationHistory"
        result = await context.client.request("GET", path, params=query_params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_device_channel_utilization(params: Dict, context: Any) -> Dict:
    """Handler for Get Device Channel Utilization."""
    try:
        if err := _validate_context(context): return err
        serial = params.get("serial")
        if not serial:
            return {"success": False, "error": "serial is required"}

        # Build query params (exclude serial)
        query_params = {k: v for k, v in params.items()
                       if k != "serial" and v is not None}

        # Make API request to correct endpoint
        path = f"/devices/{serial}/wireless/channelUtilization"
        result = await context.client.request("GET", path, params=query_params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_wireless_get_mesh_statuses(params: Dict, context: Any) -> Dict:
    """Handler for Get Mesh Statuses."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/meshStatuses"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get mesh statuses failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_settings(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/settings"
        result = await context.client.request("GET", path)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get wireless settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_update_settings(params: Dict, context: Any) -> Dict:
    """Handler for Update Wireless Settings."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/settings"
        body = {k: v for k, v in params.items() if k != "network_id"}
        result = await context.client.request("PUT", path, json_data=body)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Update wireless settings failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_signal_quality_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Signal Quality History."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/signalQualityHistory"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get signal quality history failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_usage_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Usage History."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/usageHistory"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get usage history failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_data_rate_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Wireless Data Rate History."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        if not network_id:
            return {"success": False, "error": "network_id is required"}

        path = f"/networks/{network_id}/wireless/dataRateHistory"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get data rate history failed: {e}")
        return {"success": False, "error": str(e)}


async def handle_wireless_get_client_count_history(params: Dict, context: Any) -> Dict:
    """Handler for Get Client Count History."""
    try:
        if err := _validate_context(context): return err
        network_id = params.get("network_id")
        is_valid, error_msg = validate_network_id(network_id)
        if not is_valid:
            return {"success": False, "error": error_msg}

        path = f"/networks/{network_id}/wireless/clientCountHistory"
        query_params = {k: v for k, v in params.items() if k != "network_id" and v is not None}
        result = await context.client.request("GET", path, params=query_params if query_params else None)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Get client count history failed: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

MERAKI_WIRELESS_TOOLS = [
    create_tool(
        name="meraki_wireless_list_ssids",
        description="""List all SSIDs (0-14) configured for a wireless network. Returns SSID names, enabled status, authentication modes, encryption settings, VLAN assignments, and band selection for each SSID.""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["wireless", "ssids", "list", "read", "wifi"],
        requires_write=False,
        handler=handle_wireless_list_ssids,
        examples=[
            {"query": "Show SSIDs for network N_123456", "params": {"network_id": "N_123456789012345678"}},
            {"query": "List wifi networks", "params": {"network_id": "L_636983396225539102"}},
            {"query": "What SSIDs are configured?", "params": {"network_id": "N_123456789012345678"}},
        ],
    ),
    create_tool(
        name="meraki_wireless_get_ssid",
        description="""Get details of a specific SSID including name, enabled status, auth mode, encryption, VLAN, band selection, and splash page settings. SSID numbers range from 0-14.""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number (0-14)"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "get", "read", "wifi"],
        requires_write=False,
        handler=handle_wireless_get_ssid,
        examples=[
            {"query": "Get SSID 0 details", "params": {"network_id": "N_123456789012345678", "number": 0}},
            {"query": "Show Guest WiFi settings (SSID 1)", "params": {"network_id": "L_636983396225539102", "number": 1}},
        ],
    ),
    create_tool(
        name="meraki_wireless_update_ssid",
        description="""Update SSID settings like name, enabled state, authentication""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number (0-14)"
            },
            "name": {
                        "type": "string",
                        "description": "SSID name"
            },
            "enabled": {
                        "type": "boolean",
                        "description": "Enable/disable SSID"
            },
            "authMode": {
                        "type": "string",
                        "description": "Authentication mode"
            },
            "encryptionMode": {
                        "type": "string",
                        "description": "Encryption mode"
            },
            "psk": {
                        "type": "string",
                        "description": "Pre-shared key"
            },
            "wpaEncryptionMode": {
                        "type": "string",
                        "description": "WPA encryption mode"
            },
            "ipAssignmentMode": {
                        "type": "string",
                        "description": "IP assignment mode"
            },
            "useVlanTagging": {
                        "type": "boolean",
                        "description": "Use VLAN tagging"
            },
            "defaultVlanId": {
                        "type": "integer",
                        "description": "Default VLAN ID"
            },
            "visible": {
                        "type": "boolean",
                        "description": "SSID visibility"
            },
            "availableOnAllAps": {
                        "type": "boolean",
                        "description": "Available on all APs"
            },
            "availabilityTags": {
                        "type": "array",
                        "description": "AP tags for availability",
                        "items": {
                                    "type": "string"
                        }
            },
            "bandSelection": {
                        "type": "string",
                        "description": "Band selection"
            },
            "minBitrate": {
                        "type": "number",
                        "description": "Minimum bitrate"
            },
            "perClientBandwidthLimitUp": {
                        "type": "integer",
                        "description": "Upload limit per client"
            },
            "perClientBandwidthLimitDown": {
                        "type": "integer",
                        "description": "Download limit per client"
            },
            "perSsidBandwidthLimitUp": {
                        "type": "integer",
                        "description": "Upload limit per SSID"
            },
            "perSsidBandwidthLimitDown": {
                        "type": "integer",
                        "description": "Download limit per SSID"
            },
            "splashPage": {
                        "type": "string",
                        "description": "Splash page type"
            },
            "radiusServers": {
                        "type": "array",
                        "description": "RADIUS servers",
                        "items": {
                                    "type": "object"
                        }
            },
            "radiusAccountingEnabled": {
                        "type": "boolean",
                        "description": "Enable RADIUS accounting"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "update", "write", "wifi"],
        requires_write=True,
        handler=handle_wireless_update_ssid,
    ),
    create_tool(
        name="meraki_wireless_get_ssid_splash_settings",
        description="""Get splash page settings for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "splash", "read"],
        requires_write=False,
        handler=handle_wireless_get_ssid_splash_settings,
    ),
    create_tool(
        name="meraki_wireless_update_ssid_splash_settings",
        description="""Update splash page settings for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "splashUrl": {
                        "type": "string",
                        "description": "Splash URL"
            },
            "useCustomUrl": {
                        "type": "boolean",
                        "description": "Use custom URL"
            },
            "splashTimeout": {
                        "type": "integer",
                        "description": "Splash timeout"
            },
            "redirectUrl": {
                        "type": "string",
                        "description": "Redirect URL"
            },
            "useRedirectUrl": {
                        "type": "boolean",
                        "description": "Use redirect URL"
            },
            "welcomeMessage": {
                        "type": "string",
                        "description": "Welcome message"
            },
            "splashLogo": {
                        "type": "object",
                        "description": "Splash logo settings"
            },
            "splashImage": {
                        "type": "object",
                        "description": "Splash image settings"
            },
            "splashPrepaidFront": {
                        "type": "object",
                        "description": "Prepaid front settings"
            },
            "blockAllTrafficBeforeSignOn": {
                        "type": "boolean",
                        "description": "Block traffic before sign-on"
            },
            "controllerDisconnectionBehavior": {
                        "type": "string",
                        "description": "Disconnection behavior"
            },
            "allowSimultaneousLogins": {
                        "type": "boolean",
                        "description": "Allow simultaneous logins"
            },
            "guestSponsorship": {
                        "type": "object",
                        "description": "Guest sponsorship settings"
            },
            "billing": {
                        "type": "object",
                        "description": "Billing settings"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "splash", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_ssid_splash_settings,
    ),
    create_tool(
        name="meraki_wireless_get_ssid_firewall_rules",
        description="""Get L3 firewall rules for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "firewall", "rules", "read", "security"],
        requires_write=False,
        handler=handle_wireless_get_ssid_firewall_rules,
    ),
    create_tool(
        name="meraki_wireless_update_ssid_firewall_rules",
        description="""Update L3 firewall rules for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "rules": {
                        "type": "array",
                        "description": "Firewall rules",
                        "items": {
                                    "type": "object"
                        }
            },
            "allowLanAccess": {
                        "type": "boolean",
                        "description": "Allow LAN access"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "firewall", "rules", "update", "write", "security"],
        requires_write=True,
        handler=handle_wireless_update_ssid_firewall_rules,
    ),
    create_tool(
        name="meraki_wireless_get_ssid_traffic_shaping",
        description="""Get traffic shaping rules for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "traffic", "shaping", "read", "qos"],
        requires_write=False,
        handler=handle_wireless_get_ssid_traffic_shaping,
    ),
    create_tool(
        name="meraki_wireless_update_ssid_traffic_shaping",
        description="""Update traffic shaping rules for an SSID""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "number": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "trafficShapingEnabled": {
                        "type": "boolean",
                        "description": "Enable traffic shaping"
            },
            "defaultRulesEnabled": {
                        "type": "boolean",
                        "description": "Enable default rules"
            },
            "rules": {
                        "type": "array",
                        "description": "Traffic shaping rules",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["network_id", "number"],
        tags=["wireless", "ssids", "traffic", "shaping", "update", "write", "qos"],
        requires_write=True,
        handler=handle_wireless_update_ssid_traffic_shaping,
    ),
    create_tool(
        name="meraki_wireless_list_rf_profiles",
        description="""List RF profiles for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "includeTemplateProfiles": {
                        "type": "boolean",
                        "description": "Include template profiles"
            }
},
        required=["network_id"],
        tags=["wireless", "rf", "profiles", "list", "read", "radio"],
        requires_write=False,
        handler=handle_wireless_list_rf_profiles,
    ),
    create_tool(
        name="meraki_wireless_create_rf_profile",
        description="""Create a new RF profile""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "bandSelectionType": {
                        "type": "string",
                        "description": "Band selection type"
            },
            "clientBalancingEnabled": {
                        "type": "boolean",
                        "description": "Enable client balancing"
            },
            "minBitrateType": {
                        "type": "string",
                        "description": "Minimum bitrate type"
            },
            "apBandSettings": {
                        "type": "object",
                        "description": "AP band settings"
            },
            "twoFourGhzSettings": {
                        "type": "object",
                        "description": "2.4 GHz settings"
            },
            "fiveGhzSettings": {
                        "type": "object",
                        "description": "5 GHz settings"
            },
            "sixGhzSettings": {
                        "type": "object",
                        "description": "6 GHz settings"
            },
            "transmission": {
                        "type": "object",
                        "description": "Transmission settings"
            },
            "perSsidSettings": {
                        "type": "object",
                        "description": "Per-SSID settings"
            }
},
        required=["network_id", "name", "bandSelectionType"],
        tags=["wireless", "rf", "profiles", "create", "write", "radio"],
        requires_write=True,
        handler=handle_wireless_create_rf_profile,
    ),
    create_tool(
        name="meraki_wireless_get_rf_profile",
        description="""Get details of an RF profile""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "rf_profile_id": {
                        "type": "string",
                        "description": "RF profile ID"
            }
},
        required=["network_id", "rf_profile_id"],
        tags=["wireless", "rf", "profiles", "get", "read"],
        requires_write=False,
        handler=handle_wireless_get_rf_profile,
    ),
    create_tool(
        name="meraki_wireless_update_rf_profile",
        description="""Update an RF profile""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "rf_profile_id": {
                        "type": "string",
                        "description": "RF profile ID"
            },
            "name": {
                        "type": "string",
                        "description": "Profile name"
            },
            "bandSelectionType": {
                        "type": "string",
                        "description": "Band selection type"
            },
            "clientBalancingEnabled": {
                        "type": "boolean",
                        "description": "Enable client balancing"
            },
            "minBitrateType": {
                        "type": "string",
                        "description": "Minimum bitrate type"
            },
            "apBandSettings": {
                        "type": "object",
                        "description": "AP band settings"
            },
            "twoFourGhzSettings": {
                        "type": "object",
                        "description": "2.4 GHz settings"
            },
            "fiveGhzSettings": {
                        "type": "object",
                        "description": "5 GHz settings"
            },
            "sixGhzSettings": {
                        "type": "object",
                        "description": "6 GHz settings"
            },
            "transmission": {
                        "type": "object",
                        "description": "Transmission settings"
            },
            "perSsidSettings": {
                        "type": "object",
                        "description": "Per-SSID settings"
            }
},
        required=["network_id", "rf_profile_id"],
        tags=["wireless", "rf", "profiles", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_rf_profile,
    ),
    create_tool(
        name="meraki_wireless_delete_rf_profile",
        description="""Delete an RF profile""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "rf_profile_id": {
                        "type": "string",
                        "description": "RF profile ID"
            }
},
        required=["network_id", "rf_profile_id"],
        tags=["wireless", "rf", "profiles", "delete", "write"],
        requires_write=True,
        handler=handle_wireless_delete_rf_profile,
    ),
    create_tool(
        name="meraki_wireless_get_bluetooth_settings",
        description="""Get Bluetooth settings for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["wireless", "bluetooth", "settings", "read", "ble"],
        requires_write=False,
        handler=handle_wireless_get_bluetooth_settings,
    ),
    create_tool(
        name="meraki_wireless_update_bluetooth_settings",
        description="""Update Bluetooth settings for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "scanningEnabled": {
                        "type": "boolean",
                        "description": "Enable scanning"
            },
            "advertisingEnabled": {
                        "type": "boolean",
                        "description": "Enable advertising"
            },
            "uuid": {
                        "type": "string",
                        "description": "UUID"
            },
            "majorMinorAssignmentMode": {
                        "type": "string",
                        "description": "Major/minor assignment mode"
            },
            "major": {
                        "type": "integer",
                        "description": "Major value"
            },
            "minor": {
                        "type": "integer",
                        "description": "Minor value"
            }
},
        required=["network_id"],
        tags=["wireless", "bluetooth", "settings", "update", "write", "ble"],
        requires_write=True,
        handler=handle_wireless_update_bluetooth_settings,
    ),
    create_tool(
        name="meraki_wireless_get_device_bluetooth",
        description="""Get Bluetooth settings for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={},
        required=[],
        tags=["wireless", "bluetooth", "device", "read"],
        requires_write=False,
        handler=handle_wireless_get_device_bluetooth,
    ),
    create_tool(
        name="meraki_wireless_update_device_bluetooth",
        description="""Update Bluetooth settings for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "uuid": {
                        "type": "string",
                        "description": "UUID"
            },
            "major": {
                        "type": "integer",
                        "description": "Major value"
            },
            "minor": {
                        "type": "integer",
                        "description": "Minor value"
            }
},
        required=["serial"],
        tags=["wireless", "bluetooth", "device", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_device_bluetooth,
    ),
    create_tool(
        name="meraki_wireless_get_air_marshal",
        description="""Get Air Marshal data for rogue APs and SSIDs""",
        platform="meraki",
        category="wireless",
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
            }
},
        required=["network_id"],
        tags=["wireless", "air", "marshal", "rogue", "read", "security"],
        requires_write=False,
        handler=handle_wireless_get_air_marshal,
    ),
    create_tool(
        name="meraki_wireless_get_air_marshal_settings",
        description="""Get Air Marshal settings""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["wireless", "air", "marshal", "settings", "read"],
        requires_write=False,
        handler=handle_wireless_get_air_marshal_settings,
    ),
    create_tool(
        name="meraki_wireless_update_air_marshal_settings",
        description="""Update Air Marshal settings""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "defaultPolicy": {
                        "type": "string",
                        "description": "Default policy (allow, block)"
            }
},
        required=["network_id"],
        tags=["wireless", "air", "marshal", "settings", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_air_marshal_settings,
    ),
    create_tool(
        name="meraki_wireless_list_air_marshal_rules",
        description="""List Air Marshal containment rules""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["wireless", "air", "marshal", "rules", "list", "read"],
        requires_write=False,
        handler=handle_wireless_list_air_marshal_rules,
    ),
    create_tool(
        name="meraki_wireless_create_air_marshal_rule",
        description="""Create an Air Marshal containment rule""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "type": {
                        "type": "string",
                        "description": "Rule type"
            },
            "match": {
                        "type": "object",
                        "description": "Match criteria"
            }
},
        required=["network_id", "type", "match"],
        tags=["wireless", "air", "marshal", "rules", "create", "write"],
        requires_write=True,
        handler=handle_wireless_create_air_marshal_rule,
    ),
    create_tool(
        name="meraki_wireless_get_connection_stats",
        description="""Get connection statistics for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "band": {
                        "type": "string",
                        "description": "Band filter (2.4, 5, 6)"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag filter"
            }
},
        required=["network_id"],
        tags=["wireless", "connection", "stats", "read", "performance"],
        requires_write=False,
        handler=handle_wireless_get_connection_stats,
    ),
    create_tool(
        name="meraki_wireless_get_clients_connection_stats",
        description="""Get connection statistics for wireless clients""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag filter"
            }
},
        required=["network_id"],
        tags=["wireless", "clients", "connection", "stats", "read"],
        requires_write=False,
        handler=handle_wireless_get_clients_connection_stats,
    ),
    create_tool(
        name="meraki_wireless_get_device_connection_stats",
        description="""Get connection statistics for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial"
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
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag filter"
            }
},
        required=["serial"],
        tags=["wireless", "device", "connection", "stats", "read"],
        requires_write=False,
        handler=handle_wireless_get_device_connection_stats,
    ),
    create_tool(
        name="meraki_wireless_get_failed_connections",
        description="""Get list of failed wireless connections""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag filter"
            },
            "serial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            }
},
        required=["network_id"],
        tags=["wireless", "failed", "connections", "read", "troubleshooting"],
        requires_write=False,
        handler=handle_wireless_get_failed_connections,
    ),
    create_tool(
        name="meraki_wireless_get_latency_stats",
        description="""Get latency statistics for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag filter"
            },
            "fields": {
                        "type": "string",
                        "description": "Fields to return"
            }
},
        required=["network_id"],
        tags=["wireless", "latency", "stats", "read", "performance"],
        requires_write=False,
        handler=handle_wireless_get_latency_stats,
    ),
    create_tool(
        name="meraki_wireless_get_latency_history",
        description="""Get latency history for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "accessCategory": {
                        "type": "string",
                        "description": "Access category"
            }
},
        required=["network_id"],
        tags=["wireless", "latency", "history", "read"],
        requires_write=False,
        handler=handle_wireless_get_latency_history,
    ),
    create_tool(
        name="meraki_wireless_get_client_latency_stats",
        description="""Get latency statistics for a specific client""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "client_id": {
                        "type": "string",
                        "description": "Client ID"
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
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            },
            "vlan": {
                        "type": "integer",
                        "description": "VLAN ID"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "fields": {
                        "type": "string",
                        "description": "Fields to return"
            }
},
        required=["network_id", "client_id"],
        tags=["wireless", "client", "latency", "stats", "read"],
        requires_write=False,
        handler=handle_wireless_get_client_latency_stats,
    ),
    create_tool(
        name="meraki_wireless_get_device_radio_settings",
        description="""Get radio settings for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={},
        required=[],
        tags=["wireless", "device", "radio", "settings", "read"],
        requires_write=False,
        handler=handle_wireless_get_device_radio_settings,
    ),
    create_tool(
        name="meraki_wireless_update_device_radio_settings",
        description="""Update radio settings for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "rfProfileId": {
                        "type": "string",
                        "description": "RF profile ID"
            },
            "twoFourGhzSettings": {
                        "type": "object",
                        "description": "2.4 GHz settings"
            },
            "fiveGhzSettings": {
                        "type": "object",
                        "description": "5 GHz settings"
            }
},
        required=["serial"],
        tags=["wireless", "device", "radio", "settings", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_device_radio_settings,
    ),
    create_tool(
        name="meraki_wireless_get_channel_utilization",
        description="""Get channel utilization history for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            }
},
        required=["network_id"],
        tags=["wireless", "channel", "utilization", "read", "performance"],
        requires_write=False,
        handler=handle_wireless_get_channel_utilization,
    ),
    create_tool(
        name="meraki_wireless_get_device_channel_utilization",
        description="""Get channel utilization for a specific AP""",
        platform="meraki",
        category="wireless",
        properties={
            "serial": {
                        "type": "string",
                        "description": "Device serial"
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
        required=["serial"],
        tags=["wireless", "device", "channel", "utilization", "read"],
        requires_write=False,
        handler=handle_wireless_get_device_channel_utilization,
    ),
    create_tool(
        name="meraki_wireless_get_mesh_statuses",
        description="""Get mesh networking status for all APs""",
        platform="meraki",
        category="wireless",
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
        tags=["wireless", "mesh", "status", "read"],
        requires_write=False,
        handler=handle_wireless_get_mesh_statuses,
    ),
    create_tool(
        name="meraki_wireless_get_settings",
        description="""Get wireless settings for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            }
},
        required=["network_id"],
        tags=["wireless", "settings", "read"],
        requires_write=False,
        handler=handle_wireless_get_settings,
    ),
    create_tool(
        name="meraki_wireless_update_settings",
        description="""Update wireless settings for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
            },
            "meshingEnabled": {
                        "type": "boolean",
                        "description": "Enable meshing"
            },
            "ipv6BridgeEnabled": {
                        "type": "boolean",
                        "description": "Enable IPv6 bridge"
            },
            "locationAnalyticsEnabled": {
                        "type": "boolean",
                        "description": "Enable location analytics"
            },
            "upgradeStrategy": {
                        "type": "string",
                        "description": "Upgrade strategy"
            },
            "ledLightsOn": {
                        "type": "boolean",
                        "description": "LED lights on"
            },
            "namedVlans": {
                        "type": "object",
                        "description": "Named VLANs settings"
            }
},
        required=["network_id"],
        tags=["wireless", "settings", "update", "write"],
        requires_write=True,
        handler=handle_wireless_update_settings,
    ),
    create_tool(
        name="meraki_wireless_get_signal_quality_history",
        description="""Get signal quality history for a network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id"],
        tags=["wireless", "signal", "quality", "history", "read"],
        requires_write=False,
        handler=handle_wireless_get_signal_quality_history,
    ),
    create_tool(
        name="meraki_wireless_get_usage_history",
        description="""Get data usage history for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id"],
        tags=["wireless", "usage", "history", "read", "bandwidth"],
        requires_write=False,
        handler=handle_wireless_get_usage_history,
    ),
    create_tool(
        name="meraki_wireless_get_data_rate_history",
        description="""Get data rate history for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id"],
        tags=["wireless", "data", "rate", "history", "read"],
        requires_write=False,
        handler=handle_wireless_get_data_rate_history,
    ),
    create_tool(
        name="meraki_wireless_get_client_count_history",
        description="""Get client count history for a wireless network""",
        platform="meraki",
        category="wireless",
        properties={
            "network_id": {
                        "type": "string",
                        "description": "Network ID"
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
            "resolution": {
                        "type": "integer",
                        "description": "Data resolution"
            },
            "autoResolution": {
                        "type": "boolean",
                        "description": "Auto resolution"
            },
            "clientId": {
                        "type": "string",
                        "description": "Client ID"
            },
            "deviceSerial": {
                        "type": "string",
                        "description": "Device serial"
            },
            "apTag": {
                        "type": "string",
                        "description": "AP tag"
            },
            "band": {
                        "type": "string",
                        "description": "Band filter"
            },
            "ssid": {
                        "type": "integer",
                        "description": "SSID number"
            }
},
        required=["network_id"],
        tags=["wireless", "clients", "count", "history", "read"],
        requires_write=False,
        handler=handle_wireless_get_client_count_history,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_wireless_tools():
    """Register all wireless tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(MERAKI_WIRELESS_TOOLS)
    logger.info(f"Registered {len(MERAKI_WIRELESS_TOOLS)} meraki wireless tools")


# Auto-register on import
register_wireless_tools()
