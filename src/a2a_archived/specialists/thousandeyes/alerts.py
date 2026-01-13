"""ThousandEyes Alerts skill module.

This module provides skills for alert management including:
- Active alerts
- Alert rules
- Alert suppression windows
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    ALERT_ID_SCHEMA, RULE_ID_SCHEMA, TEST_ID_SCHEMA, WINDOW_ID_SCHEMA, START_DATE_SCHEMA, END_DATE_SCHEMA,
)

ALERTS_SKILLS: List[SkillDefinition] = [
    # Active Alerts
    {"id": "alerts_get_list", "name": "List Active Alerts", "description": "Get all active alerts.", "tags": ["thousandeyes", "alerts", "active", "list"], "examples": ["List alerts", "Show active alerts"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "window": {"type": "string"}, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "alert_state": {"type": "string", "enum": ["ACTIVE", "CLEARED"]}}, "required": []}},
    {"id": "alerts_get_by_id", "name": "Get Alert by ID", "description": "Get details of a specific alert.", "tags": ["thousandeyes", "alerts", "details"], "examples": ["Get alert details"], "input_schema": {"type": "object", "properties": {"alert_id": ALERT_ID_SCHEMA}, "required": ["alert_id"]}},
    {"id": "alerts_get_by_test", "name": "Get Alerts by Test", "description": "Get alerts for a specific test.", "tags": ["thousandeyes", "alerts", "test"], "examples": ["Get test alerts"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "window": {"type": "string"}, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA}, "required": ["test_id"]}},

    # Alert Rules
    {"id": "alerts_get_rules", "name": "List Alert Rules", "description": "Get all alert rules.", "tags": ["thousandeyes", "alerts", "rules", "list"], "examples": ["List alert rules"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "alerts_get_rule", "name": "Get Alert Rule", "description": "Get details of a specific alert rule.", "tags": ["thousandeyes", "alerts", "rule", "details"], "examples": ["Get alert rule"], "input_schema": {"type": "object", "properties": {"rule_id": RULE_ID_SCHEMA}, "required": ["rule_id"]}},
    {"id": "alerts_create_rule", "name": "Create Alert Rule", "description": "Create a new alert rule.", "tags": ["thousandeyes", "alerts", "rule", "create"], "examples": ["Create alert rule"], "input_schema": {"type": "object", "properties": {"rule_name": {"type": "string"}, "alert_type": {"type": "string", "enum": ["http-server", "page-load", "network", "dns-server", "dns-trace", "voice", "sip-server", "bgp", "ftp-server", "web-transactions", "api"]}, "expression": {"type": "string", "description": "Alert expression"}, "minimum_sources": {"type": "integer", "default": 1}, "minimum_sources_pct": {"type": "integer"}, "rounds_violating_required": {"type": "integer", "default": 1}, "rounds_violating_out_of": {"type": "integer", "default": 1}, "notifications": {"type": "object", "properties": {"email": {"type": "object"}, "webhook": {"type": "object"}, "pagerDuty": {"type": "object"}, "slack": {"type": "object"}}}, "severity": {"type": "string", "enum": ["INFO", "MINOR", "MAJOR", "CRITICAL"], "default": "MAJOR"}, "direction": {"type": "string", "enum": ["TO_TARGET", "FROM_TARGET", "BIDIRECTIONAL"]}}, "required": ["rule_name", "alert_type", "expression"]}},
    {"id": "alerts_update_rule", "name": "Update Alert Rule", "description": "Update an existing alert rule.", "tags": ["thousandeyes", "alerts", "rule", "update"], "examples": ["Update alert rule"], "input_schema": {"type": "object", "properties": {"rule_id": RULE_ID_SCHEMA, "rule_name": {"type": "string"}, "expression": {"type": "string"}, "minimum_sources": {"type": "integer"}, "rounds_violating_required": {"type": "integer"}, "rounds_violating_out_of": {"type": "integer"}, "notifications": {"type": "object"}, "severity": {"type": "string", "enum": ["INFO", "MINOR", "MAJOR", "CRITICAL"]}}, "required": ["rule_id"]}},
    {"id": "alerts_delete_rule", "name": "Delete Alert Rule", "description": "Delete an alert rule.", "tags": ["thousandeyes", "alerts", "rule", "delete"], "examples": ["Delete alert rule"], "input_schema": {"type": "object", "properties": {"rule_id": RULE_ID_SCHEMA}, "required": ["rule_id"]}},

    # Alert Suppression Windows
    {"id": "alerts_get_suppression_windows", "name": "List Alert Suppression Windows", "description": "Get all alert suppression windows.", "tags": ["thousandeyes", "alerts", "suppression", "windows", "list"], "examples": ["List suppression windows"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "alerts_get_suppression_window", "name": "Get Alert Suppression Window", "description": "Get details of a specific suppression window.", "tags": ["thousandeyes", "alerts", "suppression", "window", "details"], "examples": ["Get suppression window"], "input_schema": {"type": "object", "properties": {"window_id": WINDOW_ID_SCHEMA}, "required": ["window_id"]}},
    {"id": "alerts_create_suppression_window", "name": "Create Alert Suppression Window", "description": "Create a new alert suppression window.", "tags": ["thousandeyes", "alerts", "suppression", "window", "create"], "examples": ["Create suppression window"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "repeat": {"type": "object", "properties": {"type": {"type": "string", "enum": ["DAY", "WEEK", "MONTH"]}, "interval_length": {"type": "integer"}}}, "tests": {"type": "array", "items": {"type": "object", "properties": {"testId": {"type": "string"}}}}, "status": {"type": "string", "enum": ["ENABLED", "DISABLED"], "default": "ENABLED"}}, "required": ["name", "start_date", "end_date"]}},
    {"id": "alerts_delete_suppression_window", "name": "Delete Alert Suppression Window", "description": "Delete an alert suppression window.", "tags": ["thousandeyes", "alerts", "suppression", "window", "delete"], "examples": ["Delete suppression window"], "input_schema": {"type": "object", "properties": {"window_id": WINDOW_ID_SCHEMA}, "required": ["window_id"]}},
]


class AlertsModule(ThousandEyesSkillModule):
    """Alerts skill module for alert management."""

    MODULE_NAME = "alerts"
    MODULE_PREFIX = "alerts_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in ALERTS_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any]) -> SkillResult:
        # Active Alerts
        if skill_id == "alerts_get_list":
            qp = {k: v for k, v in {"aid": params.get("aid"), "window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date"), "alertState": params.get("alert_state")}.items() if v}
            r = await client.get("alerts", qp)
            if r.get("success"):
                alerts = r.get("data", {}).get("alerts", [])
                return success_result(data={"alerts": alerts, "count": len(alerts)})
            return error_result(r.get("error"))

        if skill_id == "alerts_get_by_id":
            r = await client.get(f"alerts/{params.get('alert_id')}")
            return success_result(data={"alert": r.get("data", {}).get("alerts", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "alerts_get_by_test":
            qp = {k: v for k, v in {"testId": params.get("test_id"), "window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date")}.items() if v}
            r = await client.get("alerts", qp)
            if r.get("success"):
                alerts = r.get("data", {}).get("alerts", [])
                return success_result(data={"alerts": alerts, "count": len(alerts)})
            return error_result(r.get("error"))

        # Alert Rules
        if skill_id == "alerts_get_rules":
            r = await client.get("alerts/rules", {"aid": params.get("aid")})
            if r.get("success"):
                rules = r.get("data", {}).get("alertRules", [])
                return success_result(data={"alert_rules": rules, "count": len(rules)})
            return error_result(r.get("error"))

        if skill_id == "alerts_get_rule":
            r = await client.get(f"alerts/rules/{params.get('rule_id')}")
            return success_result(data={"alert_rule": r.get("data", {}).get("alertRules", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "alerts_create_rule":
            payload = {k: v for k, v in {
                "ruleName": params.get("rule_name"),
                "alertType": params.get("alert_type"),
                "expression": params.get("expression"),
                "minimumSources": params.get("minimum_sources", 1),
                "minimumSourcesPct": params.get("minimum_sources_pct"),
                "roundsViolatingRequired": params.get("rounds_violating_required", 1),
                "roundsViolatingOutOf": params.get("rounds_violating_out_of", 1),
                "notifications": params.get("notifications"),
                "severity": params.get("severity", "MAJOR"),
                "direction": params.get("direction"),
            }.items() if v is not None}
            r = await client.post("alerts/rules", payload)
            if r.get("success"):
                rule = r.get("data", {}).get("alertRules", [{}])[0] if isinstance(r.get("data", {}).get("alertRules"), list) else r.get("data", {})
                return success_result(data={"message": "Alert rule created", "alert_rule": rule})
            return error_result(r.get("error"))

        if skill_id == "alerts_update_rule":
            rule_id = params.pop("rule_id", None)
            payload = {k: v for k, v in {
                "ruleName": params.get("rule_name"),
                "expression": params.get("expression"),
                "minimumSources": params.get("minimum_sources"),
                "roundsViolatingRequired": params.get("rounds_violating_required"),
                "roundsViolatingOutOf": params.get("rounds_violating_out_of"),
                "notifications": params.get("notifications"),
                "severity": params.get("severity"),
            }.items() if v is not None}
            r = await client.put(f"alerts/rules/{rule_id}", payload)
            return success_result(data={"message": "Alert rule updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "alerts_delete_rule":
            r = await client.delete(f"alerts/rules/{params.get('rule_id')}")
            return success_result(data={"message": "Alert rule deleted"}) if r.get("success") else error_result(r.get("error"))

        # Alert Suppression Windows
        if skill_id == "alerts_get_suppression_windows":
            r = await client.get("alert-suppression-windows", {"aid": params.get("aid")})
            if r.get("success"):
                windows = r.get("data", {}).get("alertSuppressionWindows", [])
                return success_result(data={"suppression_windows": windows, "count": len(windows)})
            return error_result(r.get("error"))

        if skill_id == "alerts_get_suppression_window":
            r = await client.get(f"alert-suppression-windows/{params.get('window_id')}")
            return success_result(data={"suppression_window": r.get("data", {}).get("alertSuppressionWindows", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "alerts_create_suppression_window":
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "startDate": params.get("start_date"),
                "endDate": params.get("end_date"),
                "repeat": params.get("repeat"),
                "tests": params.get("tests"),
                "status": params.get("status", "ENABLED"),
            }.items() if v is not None}
            r = await client.post("alert-suppression-windows", payload)
            if r.get("success"):
                window = r.get("data", {}).get("alertSuppressionWindows", [{}])[0] if isinstance(r.get("data", {}).get("alertSuppressionWindows"), list) else r.get("data", {})
                return success_result(data={"message": "Suppression window created", "suppression_window": window})
            return error_result(r.get("error"))

        if skill_id == "alerts_delete_suppression_window":
            r = await client.delete(f"alert-suppression-windows/{params.get('window_id')}")
            return success_result(data={"message": "Suppression window deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
