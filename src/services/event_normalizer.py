"""Event normalizer for webhook payloads.

Normalizes events from Meraki, ThousandEyes, and Splunk into a common format
for broadcasting via WebSocket hub.
"""

from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class NormalizedEvent:
    """Normalized event for broadcasting to subscribers."""
    source: str  # "meraki", "thousandeyes", "splunk", "catalyst"
    event_type: str  # "device_status", "alert", "metric", "health"
    topic: str  # WebSocket topic to broadcast to
    data: Dict[str, Any]
    timestamp: datetime
    org_id: Optional[str] = None
    severity: Optional[str] = None


def normalize_meraki_event(payload: Dict[str, Any]) -> NormalizedEvent:
    """Normalize a Meraki webhook payload into a standard event.

    Meraki webhook payload fields:
    - organizationId: The org ID
    - networkId: The network ID
    - alertType: Type of alert (e.g., "Gateway goes down")
    - alertTypeId: Machine-readable type (e.g., "gateway_down")
    - alertLevel: Severity level (e.g., "critical", "warning")
    - deviceSerial: Device serial number
    - deviceName: Device name
    - occurredAt: When the event occurred
    - alertData: Additional alert-specific data
    """
    org_id = payload.get("organizationId", "")
    alert_type_id = payload.get("alertTypeId", "unknown")

    # Determine event type and topic based on alert type
    if alert_type_id in ["device_offline", "device_online", "gateway_down", "gateway_up"]:
        event_type = "device_status"
        topic = f"meraki:devices:{org_id}"
    elif "alert" in alert_type_id.lower() or payload.get("alertId"):
        event_type = "alert"
        topic = f"meraki:alerts:{org_id}"
    else:
        event_type = "event"
        topic = f"meraki:events:{org_id}"

    # Map Meraki alert levels to standard severity
    alert_level = payload.get("alertLevel", "").lower()
    severity_map = {
        "critical": "critical",
        "warning": "warning",
        "informational": "info",
        "info": "info"
    }
    severity = severity_map.get(alert_level, "info")

    # Parse timestamp
    occurred_at = payload.get("occurredAt") or payload.get("sentAt")
    if occurred_at:
        try:
            # Handle Meraki's timestamp format
            if occurred_at.endswith("Z"):
                timestamp = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
            else:
                timestamp = datetime.fromisoformat(occurred_at)
        except Exception:
            timestamp = datetime.utcnow()
    else:
        timestamp = datetime.utcnow()

    # Build normalized data
    data = {
        "alert_type": payload.get("alertType", "Unknown"),
        "alert_type_id": alert_type_id,
        "network_id": payload.get("networkId"),
        "network_name": payload.get("networkName"),
        "device_serial": payload.get("deviceSerial"),
        "device_name": payload.get("deviceName"),
        "device_mac": payload.get("deviceMac"),
        "message": payload.get("alertType", "Meraki event"),
        "details": payload.get("alertData", {}),
        "links": {
            "organization": payload.get("organizationUrl"),
            "network": payload.get("networkUrl"),
            "device": payload.get("deviceUrl")
        }
    }

    return NormalizedEvent(
        source="meraki",
        event_type=event_type,
        topic=topic,
        data=data,
        timestamp=timestamp,
        org_id=org_id,
        severity=severity
    )


def normalize_thousandeyes_event(payload: Dict[str, Any]) -> NormalizedEvent:
    """Normalize a ThousandEyes webhook payload into a standard event.

    ThousandEyes webhook payload fields:
    - eventId: Unique event ID
    - eventType: Type of event (ALERT_NOTIFICATION_TRIGGER, ALERT_NOTIFICATION_CLEAR)
    - dateStart: When the alert started
    - dateEnd: When the alert cleared (if applicable)
    - severity: Severity level (MAJOR, MINOR, INFO)
    - summary: Alert summary
    - alert: Alert details including testId, testName, ruleName
    - agents: List of affected agents
    """
    event_type_raw = payload.get("eventType", "")

    # Determine event type
    if "TRIGGER" in event_type_raw:
        event_type = "alert"
    elif "CLEAR" in event_type_raw:
        event_type = "alert_cleared"
    else:
        event_type = "event"

    # ThousandEyes doesn't have org_id in the same way, use account group if available
    account_group = payload.get("accountGroupName", "")

    topic = "thousandeyes:alerts"

    # Map ThousandEyes severity
    severity_raw = payload.get("severity", "").upper()
    severity_map = {
        "CRITICAL": "critical",
        "MAJOR": "warning",
        "MINOR": "info",
        "INFO": "info"
    }
    severity = severity_map.get(severity_raw, "info")

    # Parse timestamp
    date_start = payload.get("dateStart")
    if date_start:
        try:
            timestamp = datetime.fromisoformat(date_start.replace("Z", "+00:00"))
        except Exception:
            timestamp = datetime.utcnow()
    else:
        timestamp = datetime.utcnow()

    # Extract alert details
    alert = payload.get("alert", {})
    agents = payload.get("agents", [])

    data = {
        "event_id": payload.get("eventId"),
        "event_type": event_type_raw,
        "test_id": alert.get("testId"),
        "test_name": alert.get("testName"),
        "test_type": alert.get("type"),
        "rule_name": alert.get("ruleName"),
        "summary": payload.get("summary", "ThousandEyes alert"),
        "message": payload.get("summary", "ThousandEyes alert"),
        "affected_agents": [
            {
                "agent_id": a.get("agentId"),
                "agent_name": a.get("agentName"),
                "location": a.get("location")
            }
            for a in agents
        ],
        "date_start": date_start,
        "date_end": payload.get("dateEnd"),
        "links": payload.get("links", {})
    }

    return NormalizedEvent(
        source="thousandeyes",
        event_type=event_type,
        topic=topic,
        data=data,
        timestamp=timestamp,
        org_id=account_group,
        severity=severity
    )


def normalize_splunk_event(payload: Dict[str, Any]) -> NormalizedEvent:
    """Normalize a Splunk webhook payload into a standard event.

    Splunk alert action webhook payload fields:
    - sid: Search ID
    - search_name: Name of the saved search/alert
    - app: Splunk app name
    - owner: Search owner
    - results_link: Link to results in Splunk
    - result: Single result (for per-result alerts)
    - results: Multiple results (for digest alerts)
    """
    search_name = payload.get("search_name", "Unknown Alert")

    # Determine severity based on search name patterns
    search_lower = search_name.lower()
    if "critical" in search_lower or "emergency" in search_lower:
        severity = "critical"
    elif "warning" in search_lower or "high" in search_lower:
        severity = "warning"
    else:
        severity = "info"

    topic = "splunk:events"

    # Get results - could be single result or array
    result = payload.get("result", {})
    results = payload.get("results", [result] if result else [])

    # Parse timestamp from first result if available
    timestamp = datetime.utcnow()
    if result and "_time" in result:
        try:
            timestamp = datetime.fromisoformat(result["_time"])
        except Exception:
            pass

    data = {
        "search_id": payload.get("sid"),
        "search_name": search_name,
        "app": payload.get("app"),
        "owner": payload.get("owner"),
        "message": f"Splunk Alert: {search_name}",
        "result_count": len(results),
        "results": results[:10],  # Limit to first 10 results
        "links": {
            "results": payload.get("results_link")
        }
    }

    return NormalizedEvent(
        source="splunk",
        event_type="alert",
        topic=topic,
        data=data,
        timestamp=timestamp,
        org_id=None,
        severity=severity
    )


def normalize_catalyst_event(payload: Dict[str, Any]) -> NormalizedEvent:
    """Normalize a Catalyst Center event into a standard event.

    Catalyst Center can send events for:
    - Device health changes
    - Client connectivity issues
    - Configuration changes
    - Assurance alerts
    """
    event_type = payload.get("eventType", "event")

    # Determine topic based on event type
    if "device" in event_type.lower():
        topic = "catalyst:devices"
    elif "client" in event_type.lower():
        topic = "catalyst:clients"
    elif "assurance" in event_type.lower():
        topic = "catalyst:assurance"
    else:
        topic = "catalyst:events"

    # Map severity
    severity_raw = payload.get("severity", "").upper()
    severity_map = {
        "CRITICAL": "critical",
        "MAJOR": "warning",
        "MINOR": "info",
        "WARNING": "warning",
        "INFO": "info"
    }
    severity = severity_map.get(severity_raw, "info")

    timestamp = datetime.utcnow()
    if payload.get("timestamp"):
        try:
            timestamp = datetime.fromisoformat(payload["timestamp"])
        except Exception:
            pass

    data = {
        "event_id": payload.get("eventId"),
        "event_type": event_type,
        "message": payload.get("message", "Catalyst Center event"),
        "device_id": payload.get("deviceId"),
        "device_name": payload.get("deviceName"),
        "site": payload.get("siteName"),
        "details": payload.get("details", {})
    }

    return NormalizedEvent(
        source="catalyst",
        event_type=event_type,
        topic=topic,
        data=data,
        timestamp=timestamp,
        org_id=payload.get("siteId"),
        severity=severity
    )
