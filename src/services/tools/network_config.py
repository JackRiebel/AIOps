"""Network Configuration Tools - AI-controllable network change tools.

This module provides tools that allow the AI to apply network configuration
changes with automatic metric capture for before/after comparison.
"""

import logging
from typing import Dict, Any

from src.services.tool_registry import get_tool_registry, create_tool
from src.services.network_change_service import (
    get_network_change_service,
    ChangeType,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Handlers
# =============================================================================


async def apply_network_change_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Apply a network configuration change with automatic metric capture.

    This tool captures performance metrics before the change, applies the
    configuration change, and returns a change_id that can be used to create
    a network_change_comparison card.

    Args:
        params:
            - network_id: Meraki network ID
            - org_id: Organization/credential ID for API authentication
            - change_type: Type of change (ssid_config, rf_profile, traffic_shaping, etc.)
            - setting_path: Path to the setting being changed
            - new_value: New value to apply
            - resource_id: Optional resource identifier (e.g., SSID number)
            - description: Human-readable description of the change
            - capture_metrics: Whether to capture performance metrics (default: true)
        context: Execution context with session info

    Returns:
        Change result with change_id for card creation
    """
    network_id = params.get("network_id")
    org_id = params.get("org_id")
    change_type_str = params.get("change_type", "")
    setting_path = params.get("setting_path", "")
    new_value = params.get("new_value")
    resource_id = params.get("resource_id")
    description = params.get("description", "")
    capture_metrics = params.get("capture_metrics", True)

    # Validate required parameters
    if not network_id:
        return {
            "success": False,
            "error": "network_id is required",
        }

    if not org_id:
        return {
            "success": False,
            "error": "org_id is required for API authentication",
        }

    if not change_type_str:
        return {
            "success": False,
            "error": "change_type is required",
            "available_types": [t.value for t in ChangeType],
        }

    if not setting_path:
        return {
            "success": False,
            "error": "setting_path is required",
        }

    if new_value is None:
        return {
            "success": False,
            "error": "new_value is required",
        }

    # Parse change type
    try:
        change_type = ChangeType(change_type_str)
    except ValueError:
        return {
            "success": False,
            "error": f"Invalid change_type: {change_type_str}",
            "available_types": [t.value for t in ChangeType],
        }

    # Get user ID from context if available
    user_id = "ai-assistant"
    if context and hasattr(context, "user_id"):
        user_id = str(context.user_id)

    # Apply the change
    try:
        service = get_network_change_service()
        change = await service.apply_change(
            network_id=network_id,
            org_id=org_id,
            change_type=change_type,
            setting_path=setting_path,
            new_value=new_value,
            user_id=user_id,
            resource_id=resource_id,
            description=description,
            capture_metrics=capture_metrics,
        )

        logger.info(f"[NetworkConfigTool] Applied change {change.id}: {change_type.value} on {network_id}")

        # Return success with change details and card suggestion
        return {
            "success": True,
            "message": f"Configuration change applied successfully",
            "change_id": change.id,
            "change_details": {
                "network_id": change.network_id,
                "change_type": change.change_type.value,
                "setting_path": change.setting_path,
                "previous_value": change.previous_value,
                "new_value": change.new_value,
                "status": change.status.value,
                "applied_at": change.applied_at,
                "has_metrics_before": change.metrics_before is not None,
            },
            # Card suggestion for automatic visualization
            # Note: scope fields must match CardScope interface in frontend
            # testId is used for the change_id (reusing existing scope field)
            "card_suggestion": {
                "type": "network_change_comparison",
                "title": f"Change Impact: {description or change.setting_path}",
                "metadata": {
                    "source": "ai_network_config_tool",
                    "scope": {
                        "networkId": network_id,
                        "credentialOrg": org_id,
                        "testId": change.id,  # change_id mapped to testId for fetcher
                    },
                },
            },
            "next_steps": (
                "The change has been applied. A comparison card will show the before/after metrics. "
                "Wait 2-5 minutes for post-change metrics to stabilize, then the card will update "
                "automatically. If performance degrades, use the revert button on the card."
            ),
        }

    except Exception as e:
        logger.error(f"[NetworkConfigTool] Failed to apply change: {e}")
        return {
            "success": False,
            "error": f"Failed to apply change: {str(e)}",
        }


async def get_network_performance_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Get current network performance metrics.

    This tool captures a snapshot of current network performance metrics,
    useful for establishing a baseline before making configuration changes.

    Args:
        params:
            - network_id: Meraki network ID
            - org_id: Organization/credential ID for API authentication
        context: Execution context

    Returns:
        Current performance metrics snapshot
    """
    network_id = params.get("network_id")
    org_id = params.get("org_id")

    if not network_id:
        return {
            "success": False,
            "error": "network_id is required",
        }

    if not org_id:
        return {
            "success": False,
            "error": "org_id is required for API authentication",
        }

    try:
        service = get_network_change_service()
        metrics = await service.get_current_metrics(network_id, org_id)

        logger.info(f"[NetworkConfigTool] Captured performance metrics for {network_id}")

        return {
            "success": True,
            "metrics": metrics.to_dict(),
            "card_suggestion": {
                "type": "network_performance_overview",
                "title": "Current Performance",
                "metadata": {
                    "source": "ai_network_config_tool",
                    "scope": {
                        "networkId": network_id,
                        "credentialOrg": org_id,
                    },
                },
            },
        }

    except Exception as e:
        logger.error(f"[NetworkConfigTool] Failed to get metrics: {e}")
        return {
            "success": False,
            "error": f"Failed to get metrics: {str(e)}",
        }


async def get_change_history_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Get configuration change history for a network.

    Returns recent configuration changes made to the network,
    including their status and any impact metrics.

    Args:
        params:
            - network_id: Meraki network ID
            - limit: Maximum number of records to return (default: 10)
            - include_reverted: Whether to include reverted changes (default: true)
        context: Execution context

    Returns:
        List of recent configuration changes
    """
    network_id = params.get("network_id")
    limit = params.get("limit", 10)
    include_reverted = params.get("include_reverted", True)

    if not network_id:
        return {
            "success": False,
            "error": "network_id is required",
        }

    try:
        service = get_network_change_service()
        changes = await service.get_change_history(
            network_id=network_id,
            limit=limit,
            include_reverted=include_reverted,
        )

        logger.info(f"[NetworkConfigTool] Retrieved {len(changes)} changes for {network_id}")

        return {
            "success": True,
            "changes": [c.to_dict() for c in changes],
            "total": len(changes),
            "card_suggestion": {
                "type": "network_change_history",
                "title": "Configuration Changes",
                "metadata": {
                    "source": "ai_network_config_tool",
                    "scope": {
                        "networkId": network_id,
                    },
                },
            },
        }

    except Exception as e:
        logger.error(f"[NetworkConfigTool] Failed to get history: {e}")
        return {
            "success": False,
            "error": f"Failed to get change history: {str(e)}",
        }


async def revert_network_change_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Revert a previously applied network configuration change.

    This restores the previous configuration value and updates the
    change record status to 'reverted'.

    Args:
        params:
            - change_id: ID of the change to revert
        context: Execution context

    Returns:
        Revert result with updated change details
    """
    change_id = params.get("change_id")

    if not change_id:
        return {
            "success": False,
            "error": "change_id is required",
        }

    try:
        service = get_network_change_service()
        change = await service.revert_change(change_id)

        logger.info(f"[NetworkConfigTool] Reverted change {change_id}")

        return {
            "success": True,
            "message": "Configuration change reverted successfully",
            "change_details": {
                "id": change.id,
                "network_id": change.network_id,
                "change_type": change.change_type.value,
                "setting_path": change.setting_path,
                "restored_value": change.previous_value,
                "status": change.status.value,
                "reverted_at": change.reverted_at,
            },
        }

    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
        }
    except Exception as e:
        logger.error(f"[NetworkConfigTool] Failed to revert change: {e}")
        return {
            "success": False,
            "error": f"Failed to revert change: {str(e)}",
        }


# =============================================================================
# Tool Definitions
# =============================================================================

NETWORK_CONFIG_TOOLS = [
    create_tool(
        name="apply_network_change",
        description="""Apply a network configuration change with automatic performance metric tracking.

This tool captures baseline metrics, applies the configuration change via Meraki API,
and creates a change record for potential rollback. Use this when the user wants to
optimize network performance by changing settings.

== SUPPORTED CHANGE TYPES ==
- ssid_config: SSID settings (band selection, min bitrate, client isolation)
- rf_profile: RF profile settings (channel width, power levels)
- traffic_shaping: Traffic shaping and bandwidth rules
- uplink_bandwidth: WAN uplink bandwidth limits

== WORKFLOW ==
1. This tool captures pre-change performance metrics automatically
2. Applies the configuration change via Meraki API
3. Returns a change_id - use it to create a network_change_comparison card
4. The card will show before/after metrics (metrics stabilize in 2-5 minutes)
5. User can click "Revert" on the card if performance degrades

== EXAMPLE CHANGES ==
Improve wireless performance:
  change_type: "ssid_config", setting_path: "bandSelection", new_value: "Dual band operation", resource_id: "0"

Reduce channel utilization:
  change_type: "rf_profile", setting_path: "minBitrate", new_value: 12, resource_id: "<profile_id>"

Always explain what the change will do before applying it.""",
        platform="meraki",
        category="configuration",
        properties={
            "network_id": {
                "type": "string",
                "description": "Meraki network ID (e.g., L_598415800486855153)",
            },
            "org_id": {
                "type": "string",
                "description": "Organization/credential ID for API authentication",
            },
            "change_type": {
                "type": "string",
                "description": "Type of configuration change",
                "enum": ["ssid_config", "rf_profile", "traffic_shaping", "uplink_bandwidth"],
            },
            "setting_path": {
                "type": "string",
                "description": "Path to the setting being changed (e.g., 'bandSelection', 'minBitrate')",
            },
            "new_value": {
                "type": ["string", "number", "boolean", "object"],
                "description": "New value to apply",
            },
            "resource_id": {
                "type": "string",
                "description": "Resource identifier (e.g., SSID number '0', RF profile ID)",
            },
            "description": {
                "type": "string",
                "description": "Human-readable description of the change",
            },
            "capture_metrics": {
                "type": "boolean",
                "description": "Whether to capture before/after performance metrics (default: true)",
            },
        },
        required=["network_id", "org_id", "change_type", "setting_path", "new_value"],
        handler=apply_network_change_handler,
        tags=["network", "configuration", "performance", "meraki"],
        examples=[
            {
                "query": "Change the SSID to dual band to improve wireless coverage",
                "params": {
                    "network_id": "L_598415800486855153",
                    "org_id": "Demo Networks",
                    "change_type": "ssid_config",
                    "setting_path": "bandSelection",
                    "new_value": "Dual band operation",
                    "resource_id": "0",
                    "description": "Enable dual band (2.4GHz + 5GHz) for better coverage",
                },
            },
        ],
    ),
    create_tool(
        name="get_network_performance",
        description="""Get current network performance metrics snapshot.

Use this to check baseline performance before making configuration changes,
or to monitor current network health. Returns metrics including latency,
packet loss, channel utilization, and connection success rate.

The tool will suggest adding a network_performance_overview card to visualize
the metrics as gauges.""",
        platform="meraki",
        category="monitoring",
        properties={
            "network_id": {
                "type": "string",
                "description": "Meraki network ID",
            },
            "org_id": {
                "type": "string",
                "description": "Organization/credential ID for API authentication",
            },
        },
        required=["network_id", "org_id"],
        handler=get_network_performance_handler,
        tags=["network", "performance", "monitoring", "meraki"],
        examples=[
            {
                "query": "What's the current network performance?",
                "params": {
                    "network_id": "L_598415800486855153",
                    "org_id": "Demo Networks",
                },
            },
        ],
    ),
    create_tool(
        name="get_network_change_history",
        description="""Get recent configuration change history for a network.

Returns a list of configuration changes that have been made to the network,
including their current status and whether metrics were captured.

The tool will suggest adding a network_change_history card to visualize
the changes as a timeline.""",
        platform="meraki",
        category="configuration",
        properties={
            "network_id": {
                "type": "string",
                "description": "Meraki network ID",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of records to return (default: 10)",
            },
            "include_reverted": {
                "type": "boolean",
                "description": "Whether to include reverted changes (default: true)",
            },
        },
        required=["network_id"],
        handler=get_change_history_handler,
        tags=["network", "configuration", "history", "meraki"],
        examples=[
            {
                "query": "Show me recent configuration changes",
                "params": {
                    "network_id": "L_598415800486855153",
                    "limit": 10,
                },
            },
        ],
    ),
    create_tool(
        name="revert_network_change",
        description="""Revert a previously applied network configuration change.

Use this when a configuration change caused performance degradation or
when the user wants to undo a recent change. The original value will
be restored via Meraki API.

Note: Users can also click the "Revert" button directly on a
network_change_comparison card to perform this action.""",
        platform="meraki",
        category="configuration",
        properties={
            "change_id": {
                "type": "string",
                "description": "ID of the change to revert (from apply_network_change result)",
            },
        },
        required=["change_id"],
        handler=revert_network_change_handler,
        tags=["network", "configuration", "rollback", "meraki"],
        examples=[
            {
                "query": "Revert that last change, performance got worse",
                "params": {
                    "change_id": "abc123-def456-...",
                },
            },
        ],
    ),
]


def register_network_config_tools():
    """Register all network configuration tools."""
    registry = get_tool_registry()
    registry.register_many(NETWORK_CONFIG_TOOLS)
    logger.info(f"[NetworkConfigTools] Registered {len(NETWORK_CONFIG_TOOLS)} network config tools")


# Auto-register when imported
# Note: Registration happens via tool_registry._load_all_tools()
