"""
Catalyst Events Tools

Auto-generated from archived A2A skills.
Total tools: 15
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_events_get_all(params: Dict, context: Any) -> Dict:
    """Handler for Get All Events."""
    try:
        # Build API path
        path = "/events/get/all"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_count(params: Dict, context: Any) -> Dict:
    """Handler for Get Events Count."""
    try:
        # Build API path
        path = "/events/get/count"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Event by ID."""
    try:
        # Build API path
        path = "/events/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_subscriptions(params: Dict, context: Any) -> Dict:
    """Handler for Get Event Subscriptions."""
    try:
        # Build API path
        path = "/events/get/subscriptions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_create_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Create Event Subscription."""
    try:
        # Build API path
        path = "/events/create/subscription"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_update_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Update Event Subscription."""
    try:
        # Build API path
        path = "/events/update/subscription"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_delete_subscription(params: Dict, context: Any) -> Dict:
    """Handler for Delete Event Subscription."""
    try:
        # Build API path
        path = "/events/delete/subscription"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_email_subscriptions(params: Dict, context: Any) -> Dict:
    """Handler for Get Email Subscriptions."""
    try:
        # Build API path
        path = "/events/get/email/subscriptions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_syslog_subscriptions(params: Dict, context: Any) -> Dict:
    """Handler for Get Syslog Subscriptions."""
    try:
        # Build API path
        path = "/events/get/syslog/subscriptions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_webhook_subscriptions(params: Dict, context: Any) -> Dict:
    """Handler for Get Webhook Subscriptions."""
    try:
        # Build API path
        path = "/events/get/webhook/subscriptions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_notifications(params: Dict, context: Any) -> Dict:
    """Handler for Get Event Notifications."""
    try:
        # Build API path
        path = "/events/get/notifications"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_artifacts(params: Dict, context: Any) -> Dict:
    """Handler for Get Event Artifacts."""
    try:
        # Build API path
        path = "/events/get/artifacts"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_artifact_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Artifact by ID."""
    try:
        # Build API path
        path = "/events/get/artifact/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_get_connectors(params: Dict, context: Any) -> Dict:
    """Handler for Get Event Connectors."""
    try:
        # Build API path
        path = "/events/get/connectors"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_events_test_connector(params: Dict, context: Any) -> Dict:
    """Handler for Test Event Connector."""
    try:
        # Build API path
        path = "/events/test/connector"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_EVENTS_TOOLS = [
    create_tool(
        name="catalyst_events_get_all",
        description="""Get list of events.""",
        platform="catalyst",
        category="events",
        properties={
            "event_id": {
                        "type": "string"
            },
            "tags": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "sort_by": {
                        "type": "string"
            },
            "order": {
                        "type": "string",
                        "enum": [
                                    "asc",
                                    "desc"
                        ]
            }
},
        required=[],
        tags=["catalyst", "events", "list"],
        requires_write=False,
        handler=handle_events_get_all,
    ),
    create_tool(
        name="catalyst_events_get_count",
        description="""Get count of events.""",
        platform="catalyst",
        category="events",
        properties={
            "event_id": {
                        "type": "string"
            },
            "tags": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "count"],
        requires_write=False,
        handler=handle_events_get_count,
    ),
    create_tool(
        name="catalyst_events_get_by_id",
        description="""Get details of a specific event.""",
        platform="catalyst",
        category="events",
        properties={
            "event_id": {
                        "type": "string"
            }
},
        required=["event_id"],
        tags=["catalyst", "events", "details"],
        requires_write=False,
        handler=handle_events_get_by_id,
    ),
    create_tool(
        name="catalyst_events_get_subscriptions",
        description="""Get list of event subscriptions.""",
        platform="catalyst",
        category="events",
        properties={
            "event_ids": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "sort_by": {
                        "type": "string"
            },
            "order": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "subscriptions", "list"],
        requires_write=False,
        handler=handle_events_get_subscriptions,
    ),
    create_tool(
        name="catalyst_events_create_subscription",
        description="""Create a new event subscription.""",
        platform="catalyst",
        category="events",
        properties={
            "name": {
                        "type": "string"
            },
            "subscription_endpoints": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "subscription_details": {
                                                            "type": "object"
                                                },
                                                "subscription_type": {
                                                            "type": "string"
                                                }
                                    }
                        }
            },
            "filter": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["name", "subscription_endpoints"],
        tags=["catalyst", "events", "subscription", "create"],
        requires_write=True,
        handler=handle_events_create_subscription,
    ),
    create_tool(
        name="catalyst_events_update_subscription",
        description="""Update an existing event subscription.""",
        platform="catalyst",
        category="events",
        properties={
            "subscription_id": {
                        "type": "string"
            },
            "name": {
                        "type": "string"
            },
            "subscription_endpoints": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            },
            "filter": {
                        "type": "object"
            }
},
        required=["subscription_id"],
        tags=["catalyst", "events", "subscription", "update"],
        requires_write=True,
        handler=handle_events_update_subscription,
    ),
    create_tool(
        name="catalyst_events_delete_subscription",
        description="""Delete an event subscription.""",
        platform="catalyst",
        category="events",
        properties={
            "subscriptions": {
                        "type": "string",
                        "description": "Comma-separated subscription IDs"
            }
},
        required=["subscriptions"],
        tags=["catalyst", "events", "subscription", "delete"],
        requires_write=True,
        handler=handle_events_delete_subscription,
    ),
    create_tool(
        name="catalyst_events_get_email_subscriptions",
        description="""Get email event subscriptions.""",
        platform="catalyst",
        category="events",
        properties={
            "name": {
                        "type": "string"
            },
            "instance_id": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "order": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "subscription", "email"],
        requires_write=False,
        handler=handle_events_get_email_subscriptions,
    ),
    create_tool(
        name="catalyst_events_get_syslog_subscriptions",
        description="""Get syslog event subscriptions.""",
        platform="catalyst",
        category="events",
        properties={
            "name": {
                        "type": "string"
            },
            "instance_id": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "order": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "subscription", "syslog"],
        requires_write=False,
        handler=handle_events_get_syslog_subscriptions,
    ),
    create_tool(
        name="catalyst_events_get_webhook_subscriptions",
        description="""Get REST/webhook event subscriptions.""",
        platform="catalyst",
        category="events",
        properties={
            "name": {
                        "type": "string"
            },
            "instance_id": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "order": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "subscription", "webhook", "rest"],
        requires_write=False,
        handler=handle_events_get_webhook_subscriptions,
    ),
    create_tool(
        name="catalyst_events_get_notifications",
        description="""Get event notifications/series.""",
        platform="catalyst",
        category="events",
        properties={
            "event_ids": {
                        "type": "string"
            },
            "start_time": {
                        "type": "integer"
            },
            "end_time": {
                        "type": "integer"
            },
            "category": {
                        "type": "string"
            },
            "type": {
                        "type": "string"
            },
            "severity": {
                        "type": "string"
            },
            "domain": {
                        "type": "string"
            },
            "sub_domain": {
                        "type": "string"
            },
            "source": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "sort_by": {
                        "type": "string"
            },
            "order": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "notifications"],
        requires_write=False,
        handler=handle_events_get_notifications,
    ),
    create_tool(
        name="catalyst_events_get_artifacts",
        description="""Get event artifacts.""",
        platform="catalyst",
        category="events",
        properties={
            "event_ids": {
                        "type": "string"
            },
            "tags": {
                        "type": "string"
            },
            "offset": {
                        "type": "string",
                        "description": "Offset"
            },
            "limit": {
                        "type": "string",
                        "description": "Limit"
            },
            "sort_by": {
                        "type": "string"
            },
            "order": {
                        "type": "string"
            },
            "search": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "events", "artifacts"],
        requires_write=False,
        handler=handle_events_get_artifacts,
    ),
    create_tool(
        name="catalyst_events_get_artifact_by_id",
        description="""Get a specific event artifact.""",
        platform="catalyst",
        category="events",
        properties={
            "artifact_id": {
                        "type": "string"
            }
},
        required=["artifact_id"],
        tags=["catalyst", "events", "artifact", "details"],
        requires_write=False,
        handler=handle_events_get_artifact_by_id,
    ),
    create_tool(
        name="catalyst_events_get_connectors",
        description="""Get event API/connector status.""",
        platform="catalyst",
        category="events",
        properties={},
        required=[],
        tags=["catalyst", "events", "connectors", "status"],
        requires_write=False,
        handler=handle_events_get_connectors,
    ),
    create_tool(
        name="catalyst_events_test_connector",
        description="""Test an event subscription connector.""",
        platform="catalyst",
        category="events",
        properties={
            "subscription_id": {
                        "type": "string"
            }
},
        required=["subscription_id"],
        tags=["catalyst", "events", "connector", "test"],
        requires_write=False,
        handler=handle_events_test_connector,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_events_tools():
    """Register all events tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_EVENTS_TOOLS)
    logger.info(f"Registered {len(CATALYST_EVENTS_TOOLS)} catalyst events tools")


# Auto-register on import
register_events_tools()
