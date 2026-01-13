"""Catalyst Center Events skill module.

This module provides skills for event management including:
- Event queries
- Subscriptions (email, syslog, webhook)
- Notifications
- Artifacts and connectors
"""

from typing import Any, Dict, List
from src.a2a.types import AgentSkill
from .base import (
    CatalystSkillModule, CatalystAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    OFFSET_SCHEMA, LIMIT_SCHEMA,
)

EVENTS_SKILLS: List[SkillDefinition] = [
    {"id": "events_get_all", "name": "Get All Events", "description": "Get list of events.", "tags": ["catalyst", "events", "list"], "examples": ["List events", "Show all events"], "input_schema": {"type": "object", "properties": {"event_id": {"type": "string"}, "tags": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "sort_by": {"type": "string"}, "order": {"type": "string", "enum": ["asc", "desc"]}}, "required": []}},
    {"id": "events_get_count", "name": "Get Events Count", "description": "Get count of events.", "tags": ["catalyst", "events", "count"], "examples": ["Count events"], "input_schema": {"type": "object", "properties": {"event_id": {"type": "string"}, "tags": {"type": "string"}}, "required": []}},
    {"id": "events_get_by_id", "name": "Get Event by ID", "description": "Get details of a specific event.", "tags": ["catalyst", "events", "details"], "examples": ["Get event details"], "input_schema": {"type": "object", "properties": {"event_id": {"type": "string"}}, "required": ["event_id"]}},
    {"id": "events_get_subscriptions", "name": "Get Event Subscriptions", "description": "Get list of event subscriptions.", "tags": ["catalyst", "events", "subscriptions", "list"], "examples": ["List subscriptions"], "input_schema": {"type": "object", "properties": {"event_ids": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "sort_by": {"type": "string"}, "order": {"type": "string"}}, "required": []}},
    {"id": "events_create_subscription", "name": "Create Event Subscription", "description": "Create a new event subscription.", "tags": ["catalyst", "events", "subscription", "create"], "examples": ["Create subscription"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "subscription_endpoints": {"type": "array", "items": {"type": "object", "properties": {"subscription_details": {"type": "object"}, "subscription_type": {"type": "string"}}}}, "filter": {"type": "object", "properties": {"event_ids": {"type": "array", "items": {"type": "string"}}}}}, "required": ["name", "subscription_endpoints"]}},
    {"id": "events_update_subscription", "name": "Update Event Subscription", "description": "Update an existing event subscription.", "tags": ["catalyst", "events", "subscription", "update"], "examples": ["Update subscription"], "input_schema": {"type": "object", "properties": {"subscription_id": {"type": "string"}, "name": {"type": "string"}, "subscription_endpoints": {"type": "array", "items": {"type": "object"}}, "filter": {"type": "object"}}, "required": ["subscription_id"]}},
    {"id": "events_delete_subscription", "name": "Delete Event Subscription", "description": "Delete an event subscription.", "tags": ["catalyst", "events", "subscription", "delete"], "examples": ["Delete subscription"], "input_schema": {"type": "object", "properties": {"subscriptions": {"type": "string", "description": "Comma-separated subscription IDs"}}, "required": ["subscriptions"]}},
    {"id": "events_get_email_subscriptions", "name": "Get Email Subscriptions", "description": "Get email event subscriptions.", "tags": ["catalyst", "events", "subscription", "email"], "examples": ["Get email subscriptions"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "instance_id": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "order": {"type": "string"}}, "required": []}},
    {"id": "events_get_syslog_subscriptions", "name": "Get Syslog Subscriptions", "description": "Get syslog event subscriptions.", "tags": ["catalyst", "events", "subscription", "syslog"], "examples": ["Get syslog subscriptions"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "instance_id": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "order": {"type": "string"}}, "required": []}},
    {"id": "events_get_webhook_subscriptions", "name": "Get Webhook Subscriptions", "description": "Get REST/webhook event subscriptions.", "tags": ["catalyst", "events", "subscription", "webhook", "rest"], "examples": ["Get webhook subscriptions"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "instance_id": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "order": {"type": "string"}}, "required": []}},
    {"id": "events_get_notifications", "name": "Get Event Notifications", "description": "Get event notifications/series.", "tags": ["catalyst", "events", "notifications"], "examples": ["Get notifications", "Show event series"], "input_schema": {"type": "object", "properties": {"event_ids": {"type": "string"}, "start_time": {"type": "integer"}, "end_time": {"type": "integer"}, "category": {"type": "string"}, "type": {"type": "string"}, "severity": {"type": "string"}, "domain": {"type": "string"}, "sub_domain": {"type": "string"}, "source": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "sort_by": {"type": "string"}, "order": {"type": "string"}}, "required": []}},
    {"id": "events_get_artifacts", "name": "Get Event Artifacts", "description": "Get event artifacts.", "tags": ["catalyst", "events", "artifacts"], "examples": ["Get event artifacts"], "input_schema": {"type": "object", "properties": {"event_ids": {"type": "string"}, "tags": {"type": "string"}, "offset": OFFSET_SCHEMA, "limit": LIMIT_SCHEMA, "sort_by": {"type": "string"}, "order": {"type": "string"}, "search": {"type": "string"}}, "required": []}},
    {"id": "events_get_artifact_by_id", "name": "Get Artifact by ID", "description": "Get a specific event artifact.", "tags": ["catalyst", "events", "artifact", "details"], "examples": ["Get artifact details"], "input_schema": {"type": "object", "properties": {"artifact_id": {"type": "string"}}, "required": ["artifact_id"]}},
    {"id": "events_get_connectors", "name": "Get Event Connectors", "description": "Get event API/connector status.", "tags": ["catalyst", "events", "connectors", "status"], "examples": ["Get connector status"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "events_test_connector", "name": "Test Event Connector", "description": "Test an event subscription connector.", "tags": ["catalyst", "events", "connector", "test"], "examples": ["Test connector"], "input_schema": {"type": "object", "properties": {"subscription_id": {"type": "string"}}, "required": ["subscription_id"]}},
]

class EventsModule(CatalystSkillModule):
    MODULE_NAME = "events"
    MODULE_PREFIX = "events_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        return [create_skill(s) for s in EVENTS_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: CatalystAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        if skill_id == "events_get_all":
            qp = {k: v for k, v in {"eventId": params.get("event_id"), "tags": params.get("tags"), "offset": params.get("offset"), "limit": params.get("limit"), "sortBy": params.get("sort_by"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("events", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"events": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_count":
            qp = {k: v for k, v in {"eventId": params.get("event_id"), "tags": params.get("tags")}.items() if v}
            r = await client.get("events/count", qp)
            return success_result(data={"count": r.get("data", {}).get("response", 0)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_by_id":
            r = await client.get(f"events/{params.get('event_id')}")
            return success_result(data={"event": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_subscriptions":
            qp = {k: v for k, v in {"eventIds": params.get("event_ids"), "offset": params.get("offset"), "limit": params.get("limit"), "sortBy": params.get("sort_by"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("event/subscription", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"subscriptions": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_create_subscription":
            payload = [{k: v for k, v in {"name": params.get("name"), "subscriptionEndpoints": params.get("subscription_endpoints", []), "filter": params.get("filter", {})}.items() if v}]
            r = await client.post("event/subscription", payload)
            return success_result(data={"message": "Subscription created", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_update_subscription":
            payload = [{k: v for k, v in {"subscriptionId": params.get("subscription_id"), "name": params.get("name"), "subscriptionEndpoints": params.get("subscription_endpoints"), "filter": params.get("filter")}.items() if v}]
            r = await client.put("event/subscription", payload)
            return success_result(data={"message": "Subscription updated"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_delete_subscription":
            r = await client.delete("event/subscription", {"subscriptions": params.get("subscriptions")})
            return success_result(data={"message": "Subscription deleted"}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_email_subscriptions":
            qp = {k: v for k, v in {"name": params.get("name"), "instanceId": params.get("instance_id"), "offset": params.get("offset"), "limit": params.get("limit"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("event/subscription/email", qp)
            return success_result(data={"subscriptions": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_syslog_subscriptions":
            qp = {k: v for k, v in {"name": params.get("name"), "instanceId": params.get("instance_id"), "offset": params.get("offset"), "limit": params.get("limit"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("event/subscription/syslog", qp)
            return success_result(data={"subscriptions": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_webhook_subscriptions":
            qp = {k: v for k, v in {"name": params.get("name"), "instanceId": params.get("instance_id"), "offset": params.get("offset"), "limit": params.get("limit"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("event/subscription/rest", qp)
            return success_result(data={"subscriptions": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_notifications":
            qp = {k: v for k, v in {"eventIds": params.get("event_ids"), "startTime": params.get("start_time"), "endTime": params.get("end_time"), "category": params.get("category"), "type": params.get("type"), "severity": params.get("severity"), "domain": params.get("domain"), "subDomain": params.get("sub_domain"), "source": params.get("source"), "offset": params.get("offset"), "limit": params.get("limit"), "sortBy": params.get("sort_by"), "order": params.get("order")}.items() if v is not None}
            r = await client.get("event/event-series", qp)
            data = r.get("data", {}).get("response", [])
            return success_result(data={"notifications": data, "count": len(data)}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_artifacts":
            qp = {k: v for k, v in {"eventIds": params.get("event_ids"), "tags": params.get("tags"), "offset": params.get("offset"), "limit": params.get("limit"), "sortBy": params.get("sort_by"), "order": params.get("order"), "search": params.get("search")}.items() if v is not None}
            r = await client.get("event/artifact", qp)
            return success_result(data={"artifacts": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_artifact_by_id":
            r = await client.get(f"event/artifact/{params.get('artifact_id')}")
            return success_result(data={"artifact": r.get("data", {}).get("response", {})}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_get_connectors":
            r = await client.get("event/api-status")
            return success_result(data={"connectors": r.get("data", {}).get("response", [])}) if r.get("success") else error_result(r.get("error"))
        if skill_id == "events_test_connector":
            payload = [{"subscriptionId": params.get("subscription_id")}]
            r = await client.post("event/subscription/test", payload)
            return success_result(data={"message": "Connector test initiated", "response": r.get("data")}) if r.get("success") else error_result(r.get("error"))
        return error_result(f"Unknown skill: {skill_id}")
