"""
Error Handler Service

Provides intelligent error responses with actionable suggestions.
Per Anthropic best practices: "send a clear and informative error message back to Claude
within the content of the tool_result block" with suggestions for next steps.
"""

import re
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ErrorContext:
    """Context information for generating helpful error suggestions."""
    known_networks: List[Dict] = None
    known_devices: List[Dict] = None
    known_ssids: List[Dict] = None
    known_vlans: List[Dict] = None
    current_org_id: str = None


class ErrorHandler:
    """
    Generates helpful error responses with actionable suggestions.

    Based on Anthropic best practices:
    - Return clear, informative error messages
    - Include suggestions for next steps
    - Provide available options when applicable
    - Set is_error: true to help Claude understand the failure
    """

    # Error patterns and their suggested tools/actions
    ERROR_PATTERNS = {
        # Network errors
        r"network.*not found|invalid.*network|network_id.*invalid": {
            "suggestion": "The network ID may be incorrect. Try listing available networks first.",
            "suggested_tool": "meraki_networks_list",
            "category": "network"
        },
        r"network.*required|missing.*network_id": {
            "suggestion": "A network ID is required. List networks to find the correct ID.",
            "suggested_tool": "meraki_networks_list",
            "category": "network"
        },

        # Organization errors
        r"organization.*not found|invalid.*organization|org.*not found": {
            "suggestion": "The organization ID may be incorrect. Try listing available organizations.",
            "suggested_tool": "meraki_organizations_list",
            "category": "organization"
        },
        r"organization.*required|missing.*organization_id|org_id.*required": {
            "suggestion": "An organization ID is required. List organizations to find the correct ID.",
            "suggested_tool": "meraki_organizations_list",
            "category": "organization"
        },

        # Device errors
        r"device.*not found|serial.*not found|invalid.*serial": {
            "suggestion": "The device serial may be incorrect. Try listing devices in the network.",
            "suggested_tool": "meraki_networks_list_devices",
            "category": "device"
        },
        r"serial.*required|missing.*serial": {
            "suggestion": "A device serial number is required. List devices to find available serials.",
            "suggested_tool": "meraki_networks_list_devices",
            "category": "device"
        },

        # VLAN errors
        r"vlan.*not found|invalid.*vlan|vlan_id.*not found": {
            "suggestion": "The VLAN ID may not exist. Try listing VLANs to see available IDs.",
            "suggested_tool": "meraki_appliance_list_vlans",
            "category": "vlan"
        },

        # SSID errors
        r"ssid.*not found|invalid.*ssid|ssid.*number.*invalid": {
            "suggestion": "The SSID number may be invalid (0-14). List SSIDs to see configured ones.",
            "suggested_tool": "meraki_wireless_list_ssids",
            "category": "ssid"
        },

        # Client errors
        r"client.*not found|invalid.*client|mac.*not found": {
            "suggestion": "The client MAC may be incorrect. Try listing clients in the network.",
            "suggested_tool": "meraki_networks_list_clients",
            "category": "client"
        },

        # Rate limiting
        r"429|rate limit|too many requests|throttl": {
            "suggestion": "API rate limit reached. Wait a few seconds before retrying.",
            "retry_after_seconds": 5,
            "category": "rate_limit"
        },

        # Authentication/Permission errors
        r"401|unauthorized|invalid.*api.*key": {
            "suggestion": "API key is invalid or expired. Check your Meraki API key configuration.",
            "category": "auth"
        },
        r"403|forbidden|permission.*denied|access.*denied": {
            "suggestion": "Permission denied. This operation may require edit mode to be enabled, or your API key may not have access to this resource.",
            "category": "permission"
        },

        # Edit mode errors
        r"edit.*mode.*disabled|read.*only|write.*not.*allowed": {
            "suggestion": "This operation requires edit mode to be enabled. Enable edit mode in settings.",
            "category": "edit_mode"
        },

        # Timeout errors
        r"timeout|timed out|connection.*timeout": {
            "suggestion": "The request timed out. The Meraki API may be slow. Try again or reduce the scope of your request.",
            "retry_after_seconds": 3,
            "category": "timeout"
        },

        # Connection errors
        r"connection.*refused|unable.*to.*connect|network.*unreachable": {
            "suggestion": "Unable to connect to the Meraki API. Check your network connection.",
            "category": "connection"
        },

        # Invalid parameter errors
        r"invalid.*parameter|bad.*request|malformed": {
            "suggestion": "One or more parameters are invalid. Check the parameter format and try again.",
            "category": "parameter"
        },
    }

    @classmethod
    def handle_error(
        cls,
        error: Exception,
        tool_name: str,
        params: Dict[str, Any],
        context: Optional[ErrorContext] = None
    ) -> Dict[str, Any]:
        """
        Generate a helpful error response with suggestions.

        Args:
            error: The exception that occurred
            tool_name: Name of the tool that failed
            params: Parameters that were passed to the tool
            context: Optional context with known entities

        Returns:
            Dict with error details, suggestions, and available options
        """
        error_str = str(error).lower()

        response = {
            "success": False,
            "error": str(error),
            "is_error": True,
            "tool": tool_name,
            "suggestion": None,
            "suggested_tool": None,
            "available_options": None,
            "retry_after_seconds": None
        }

        # Match error against patterns
        for pattern, info in cls.ERROR_PATTERNS.items():
            if re.search(pattern, error_str, re.IGNORECASE):
                response["suggestion"] = info.get("suggestion")
                response["suggested_tool"] = info.get("suggested_tool")
                response["retry_after_seconds"] = info.get("retry_after_seconds")

                # Add available options from context if we have them
                if context:
                    category = info.get("category")
                    if category == "network" and context.known_networks:
                        response["available_options"] = [
                            f"{n.get('name', 'Unknown')} ({n.get('id', '')})"
                            for n in context.known_networks[:5]
                        ]
                    elif category == "device" and context.known_devices:
                        response["available_options"] = [
                            f"{d.get('name', 'Unknown')} ({d.get('serial', '')})"
                            for d in context.known_devices[:5]
                        ]
                    elif category == "vlan" and context.known_vlans:
                        response["available_options"] = [
                            f"VLAN {v.get('id')} - {v.get('name', 'Unknown')}"
                            for v in context.known_vlans[:5]
                        ]
                    elif category == "ssid" and context.known_ssids:
                        response["available_options"] = [
                            f"SSID {s.get('number')} - {s.get('name', 'Unknown')}"
                            for s in context.known_ssids[:5]
                        ]

                break

        # If no pattern matched, provide generic suggestion
        if not response["suggestion"]:
            response["suggestion"] = cls._get_generic_suggestion(tool_name, error_str)

        # Log the error for debugging
        logger.warning(
            f"Tool error: {tool_name} - {error} | Suggestion: {response['suggestion']}"
        )

        return response

    @classmethod
    def _get_generic_suggestion(cls, tool_name: str, error_str: str) -> str:
        """Generate a generic suggestion based on tool name."""
        if "list" in tool_name:
            return "Check that the parent resource (org/network) exists and you have access to it."
        elif "get" in tool_name:
            return "Verify the resource ID is correct. Try listing resources first to find valid IDs."
        elif "update" in tool_name or "create" in tool_name:
            return "Check that all required parameters are provided and valid. Ensure edit mode is enabled."
        elif "delete" in tool_name:
            return "Verify the resource exists and edit mode is enabled before deleting."
        else:
            return "An error occurred. Check the parameters and try again."

    @classmethod
    def format_error_for_display(cls, error_response: Dict[str, Any]) -> str:
        """
        Format error response as a readable message for the AI to include in its response.

        Returns a markdown-formatted error message.
        """
        parts = [f"**Error:** {error_response['error']}"]

        if error_response.get("suggestion"):
            parts.append(f"\n**Suggestion:** {error_response['suggestion']}")

        if error_response.get("suggested_tool"):
            parts.append(f"\n**Try:** Use `{error_response['suggested_tool']}` to find valid options")

        if error_response.get("available_options"):
            options = error_response["available_options"]
            parts.append("\n**Available options:**")
            for opt in options:
                parts.append(f"  - {opt}")

        if error_response.get("retry_after_seconds"):
            parts.append(f"\n**Retry after:** {error_response['retry_after_seconds']} seconds")

        return "\n".join(parts)


def create_error_response(
    error: Exception,
    tool_name: str,
    params: Dict[str, Any] = None,
    context: ErrorContext = None
) -> Dict[str, Any]:
    """
    Convenience function to create an error response.

    Usage:
        return create_error_response(e, "meraki_networks_list", {"organization_id": "123"})
    """
    return ErrorHandler.handle_error(
        error,
        tool_name,
        params or {},
        context
    )
