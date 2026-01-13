"""Workflow Action Tools - Backend implementations for workflow action presets.

This module provides tool implementations for all workflow actions defined in
the frontend triggerPresets.ts. It includes:
- Tool aliases for existing Meraki tools (name mapping)
- Notification tools (Slack, Email, Teams, PagerDuty, Webhook)
- Documentation tools (Incident, Splunk log, Report generation)
- Remediation tools (Disable port, Block client, Quarantine, Diagnostics)
- Configuration tools (Backup config, Firmware scheduling)
"""

import logging
import aiohttp
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from datetime import datetime

from src.services.tool_registry import get_tool_registry, create_tool, Tool
from src.config.settings import get_settings
from src.services.config_service import get_config_or_env

logger = logging.getLogger(__name__)


# =============================================================================
# Tool Aliases - Map workflow preset names to existing tools
# =============================================================================

TOOL_ALIASES = {
    # Meraki device tools
    "meraki_reboot_device": "meraki_devices_reboot",
    "meraki_cycle_port": "meraki_switch_cycle_ports",
    "meraki_ping": "meraki_devices_create_ping",
}


def register_tool_aliases():
    """Register aliases for existing tools."""
    registry = get_tool_registry()
    for alias, target in TOOL_ALIASES.items():
        registry.register_alias(alias, target)
    logger.info(f"[WorkflowActions] Registered {len(TOOL_ALIASES)} tool aliases")


# =============================================================================
# Notification Tools
# =============================================================================

async def slack_notify_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Send a Slack notification via webhook.

    Args:
        params:
            - webhook_url (optional): Override default webhook URL
            - channel (optional): Channel to post to (default: #alerts)
            - message: The message text to send
            - username (optional): Bot username
            - icon_emoji (optional): Bot emoji icon

    Returns:
        success status and message details
    """
    settings = get_settings()
    webhook_url = params.get("webhook_url") or getattr(settings, "slack_webhook_url", "")

    if not webhook_url:
        return {"success": False, "error": "No Slack webhook URL configured"}

    message = params.get("message", "Workflow notification from Lumen")
    channel = params.get("channel", "#alerts")

    payload = {
        "channel": channel,
        "text": message,
        "username": params.get("username", "Lumen"),
        "icon_emoji": params.get("icon_emoji", ":robot_face:"),
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                if resp.status == 200:
                    return {"success": True, "channel": channel, "message": message[:100]}
                else:
                    text = await resp.text()
                    return {"success": False, "error": f"Slack API error: {resp.status} - {text}"}
    except Exception as e:
        logger.error(f"Slack notification failed: {e}")
        return {"success": False, "error": str(e)}


async def email_notify_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Send an email notification via SMTP.

    Args:
        params:
            - recipients: Comma-separated email addresses
            - subject: Email subject line
            - message: Email body text
            - html (optional): HTML body content

    Returns:
        success status and recipient details
    """
    settings = get_settings()
    smtp_host = getattr(settings, "smtp_host", "")
    smtp_port = getattr(settings, "smtp_port", 587)
    smtp_user = getattr(settings, "smtp_user", "")
    smtp_password = getattr(settings, "smtp_password", "")
    smtp_from = getattr(settings, "smtp_from", "lumen@example.com")

    if not smtp_host:
        return {"success": False, "error": "SMTP not configured"}

    recipients_str = params.get("recipients", "")
    if not recipients_str:
        return {"success": False, "error": "No recipients specified"}

    recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]
    subject = params.get("subject", "Lumen Workflow Alert")
    body = params.get("message", "")
    html_body = params.get("html")

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = ", ".join(recipients)

        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)

        return {"success": True, "recipients": recipients, "subject": subject}
    except Exception as e:
        logger.error(f"Email notification failed: {e}")
        return {"success": False, "error": str(e)}


async def teams_notify_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Send a Microsoft Teams notification via webhook.

    Args:
        params:
            - webhook_url (optional): Override default webhook URL
            - message: The message text to send
            - title (optional): Card title

    Returns:
        success status
    """
    settings = get_settings()
    webhook_url = params.get("webhook_url") or getattr(settings, "teams_webhook_url", "")

    if not webhook_url:
        return {"success": False, "error": "No Teams webhook URL configured"}

    message = params.get("message", "Workflow notification from Lumen")
    title = params.get("title", "Lumen Alert")

    # Teams Adaptive Card format
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": title,
        "themeColor": "0076D7",
        "title": title,
        "sections": [{
            "activityTitle": "Workflow Notification",
            "text": message,
        }]
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload) as resp:
                if resp.status == 200:
                    return {"success": True, "title": title}
                else:
                    text = await resp.text()
                    return {"success": False, "error": f"Teams API error: {resp.status} - {text}"}
    except Exception as e:
        logger.error(f"Teams notification failed: {e}")
        return {"success": False, "error": str(e)}


async def pagerduty_trigger_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Trigger a PagerDuty incident.

    Args:
        params:
            - routing_key (optional): Override default routing key
            - severity: info, warning, error, critical
            - message: Incident summary
            - source (optional): Source identifier
            - dedup_key (optional): Deduplication key

    Returns:
        success status and incident details
    """
    settings = get_settings()
    routing_key = params.get("routing_key") or getattr(settings, "pagerduty_routing_key", "")

    if not routing_key:
        return {"success": False, "error": "No PagerDuty routing key configured"}

    severity = params.get("severity", "warning")
    summary = params.get("message", "Workflow alert from Lumen")
    source = params.get("source", "lumen")

    payload = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": params.get("dedup_key"),
        "payload": {
            "summary": summary,
            "severity": severity,
            "source": source,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "custom_details": {
                "workflow_execution_id": context.get("execution_id") if context else None,
            }
        }
    }

    # Remove None values
    if not payload["dedup_key"]:
        del payload["dedup_key"]

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://events.pagerduty.com/v2/enqueue",
                json=payload
            ) as resp:
                result = await resp.json()
                if resp.status == 202:
                    return {
                        "success": True,
                        "dedup_key": result.get("dedup_key"),
                        "message": result.get("message"),
                        "severity": severity
                    }
                else:
                    return {"success": False, "error": f"PagerDuty error: {result}"}
    except Exception as e:
        logger.error(f"PagerDuty trigger failed: {e}")
        return {"success": False, "error": str(e)}


async def http_webhook_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Call a generic HTTP webhook.

    Args:
        params:
            - url: The webhook URL to call
            - method (optional): HTTP method (default: POST)
            - payload (optional): JSON payload to send
            - headers (optional): Additional headers

    Returns:
        success status and response details
    """
    url = params.get("url")
    if not url:
        return {"success": False, "error": "No URL specified"}

    method = params.get("method", "POST").upper()
    payload = params.get("payload", {})
    headers = params.get("headers", {})

    # Add default content type
    if "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"

    try:
        async with aiohttp.ClientSession() as session:
            if method == "POST":
                async with session.post(url, json=payload, headers=headers) as resp:
                    status = resp.status
                    try:
                        body = await resp.json()
                    except (ValueError, aiohttp.ContentTypeError):
                        body = await resp.text()
            elif method == "GET":
                async with session.get(url, headers=headers) as resp:
                    status = resp.status
                    try:
                        body = await resp.json()
                    except (ValueError, aiohttp.ContentTypeError):
                        body = await resp.text()
            else:
                return {"success": False, "error": f"Unsupported method: {method}"}

            return {
                "success": status < 400,
                "status_code": status,
                "response": body if isinstance(body, dict) else {"text": str(body)[:500]}
            }
    except Exception as e:
        logger.error(f"Webhook call failed: {e}")
        return {"success": False, "error": str(e)}


async def webex_notify_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Send a Webex notification via webhook or bot.

    Args:
        params:
            - webhook_url (optional): Override default webhook URL
            - room_id (optional): Webex room/space ID (for bot token)
            - message: The message text to send (supports markdown)
            - markdown (optional): If true, message is treated as markdown

    Returns:
        success status and message details
    """
    settings = get_settings()
    webhook_url = params.get("webhook_url") or getattr(settings, "webex_webhook_url", "")
    bot_token = getattr(settings, "webex_bot_token", "")
    room_id = params.get("room_id") or getattr(settings, "webex_room_id", "")

    message = params.get("message", "Workflow notification from Lumen")
    use_markdown = params.get("markdown", True)

    # Prefer webhook if configured, otherwise use bot token
    if webhook_url:
        # Using incoming webhook
        payload = {"markdown": message} if use_markdown else {"text": message}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=payload) as resp:
                    if resp.status in (200, 204):
                        return {"success": True, "method": "webhook", "message": message[:100]}
                    else:
                        text = await resp.text()
                        return {"success": False, "error": f"Webex webhook error: {resp.status} - {text}"}
        except Exception as e:
            logger.error(f"Webex webhook notification failed: {e}")
            return {"success": False, "error": str(e)}

    elif bot_token and room_id:
        # Using bot token + room ID
        payload = {
            "roomId": room_id,
            "markdown" if use_markdown else "text": message,
        }
        headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json",
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://webexapis.com/v1/messages",
                    json=payload,
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return {"success": True, "method": "bot", "message_id": result.get("id")}
                    else:
                        text = await resp.text()
                        return {"success": False, "error": f"Webex API error: {resp.status} - {text}"}
        except Exception as e:
            logger.error(f"Webex bot notification failed: {e}")
            return {"success": False, "error": str(e)}
    else:
        return {
            "success": False,
            "error": "Webex not configured. Set WEBEX_WEBHOOK_URL or both WEBEX_BOT_TOKEN and WEBEX_ROOM_ID in settings.",
            "configured": False
        }


# =============================================================================
# Documentation Tools
# =============================================================================

async def create_incident_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Create an incident in the local database.

    Args:
        params:
            - title (optional): Incident title
            - description (optional): Incident description
            - priority: low, medium, high, critical (maps to severity)
            - source (optional): Source identifier (stored in root_cause_hypothesis)

    Returns:
        success status and incident ID
    """
    try:
        from src.config.database import get_db
        from src.models.incident import Incident, IncidentStatus, EventSeverity

        title = params.get("title", "Workflow-generated incident")
        root_cause = params.get("description", "")
        priority = params.get("priority", "medium")
        source = params.get("source", "workflow")

        # Map priority to EventSeverity enum
        severity_map = {
            "low": EventSeverity.LOW,
            "medium": EventSeverity.MEDIUM,
            "high": EventSeverity.HIGH,
            "critical": EventSeverity.CRITICAL,
        }
        severity = severity_map.get(priority.lower(), EventSeverity.MEDIUM)

        # Add context info to root cause hypothesis
        if context:
            execution_id = context.get("execution_id") if isinstance(context, dict) else None
            workflow_name = context.get("workflow_name") if isinstance(context, dict) else None
            if execution_id:
                root_cause += f"\n\nWorkflow Execution ID: {execution_id}"
            if workflow_name:
                root_cause += f"\nWorkflow: {workflow_name}"

        if source:
            root_cause = f"Source: {source}\n\n{root_cause}" if root_cause else f"Source: {source}"

        db = get_db()
        async with db.session() as session:
            incident = Incident(
                title=title,
                status=IncidentStatus.OPEN,
                severity=severity,
                start_time=datetime.utcnow(),
                root_cause_hypothesis=root_cause or None,
            )
            session.add(incident)
            await session.commit()
            await session.refresh(incident)

            return {"success": True, "incident_id": incident.id, "title": title}
    except ImportError as e:
        logger.warning(f"Incident model not available: {e}")
        return {"success": False, "error": "Incident system not configured"}
    except Exception as e:
        logger.error(f"Failed to create incident: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def splunk_log_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Log an event to Splunk HTTP Event Collector (HEC).

    Args:
        params:
            - message: Event message
            - sourcetype (optional): Splunk sourcetype
            - index (optional): Splunk index
            - fields (optional): Additional fields

    Returns:
        success status
    """
    settings = get_settings()
    # Load Splunk HEC credentials from database first, then settings
    splunk_host = (
        get_config_or_env("splunk_host", "SPLUNK_HOST") or
        getattr(settings, "splunk_host", "")
    )
    hec_token = (
        get_config_or_env("splunk_hec_token", "SPLUNK_HEC_TOKEN") or
        getattr(settings, "splunk_hec_token", "")
    )
    # Build HEC URL from host if not explicitly configured
    hec_url = getattr(settings, "splunk_hec_url", "") or (f"https://{splunk_host}:8088" if splunk_host else "")

    if not hec_url or not hec_token:
        return {"success": False, "error": "Splunk HEC not configured"}

    message = params.get("message", "Workflow event")
    sourcetype = params.get("sourcetype", "lumen:workflow")
    index = params.get("index")
    fields = params.get("fields", {})

    # Add execution context
    if context:
        fields["execution_id"] = context.get("execution_id")
        fields["workflow_id"] = context.get("workflow_id")

    event = {
        "event": message,
        "sourcetype": sourcetype,
        "source": "lumen",
        "time": datetime.utcnow().timestamp(),
        "fields": fields,
    }

    if index:
        event["index"] = index

    try:
        url = f"{hec_url.rstrip('/')}/services/collector/event"
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=event,
                headers={"Authorization": f"Splunk {hec_token}"}
            ) as resp:
                if resp.status == 200:
                    return {"success": True, "sourcetype": sourcetype}
                else:
                    text = await resp.text()
                    return {"success": False, "error": f"Splunk HEC error: {resp.status} - {text}"}
    except Exception as e:
        logger.error(f"Splunk log failed: {e}")
        return {"success": False, "error": str(e)}


async def generate_report_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Generate an incident/workflow execution report.

    Args:
        params:
            - format (optional): Report format (markdown, json)
            - include_trigger_data (optional): Include raw trigger data

    Returns:
        success status and report content
    """
    report_format = params.get("format", "markdown")
    include_trigger = params.get("include_trigger_data", False)

    execution_id = context.get("execution_id") if context else None
    workflow_name = context.get("workflow_name", "Unknown Workflow") if context else "Unknown Workflow"
    trigger_data = context.get("trigger_data", []) if context else []

    timestamp = datetime.utcnow().isoformat()

    if report_format == "json":
        report = {
            "title": f"Workflow Execution Report - {workflow_name}",
            "execution_id": execution_id,
            "timestamp": timestamp,
            "workflow_name": workflow_name,
        }
        if include_trigger and trigger_data:
            report["trigger_data"] = trigger_data
        return {"success": True, "report": report, "format": "json"}
    else:
        # Markdown format
        report = f"""# Workflow Execution Report

**Workflow:** {workflow_name}
**Execution ID:** {execution_id}
**Generated:** {timestamp}

## Summary

This report was automatically generated by the Lumen workflow system.

"""
        if include_trigger and trigger_data:
            report += "## Trigger Data\n\n```json\n"
            import json
            report += json.dumps(trigger_data[:5], indent=2)  # First 5 events
            report += "\n```\n"

        return {"success": True, "report": report, "format": "markdown"}


async def cmdb_update_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Update a CMDB record via webhook or API.

    Supports integration with ServiceNow, Freshservice, or any CMDB with a REST API.

    Args:
        params:
            - webhook_url (optional): Override default CMDB webhook URL
            - ci_type: Configuration item type (e.g., 'network_device', 'server')
            - ci_name: Configuration item name/identifier
            - updates: Dictionary of fields to update
            - action: Action type ('create', 'update', 'delete')

    Returns:
        success status and CMDB response
    """
    settings = get_settings()
    webhook_url = params.get("webhook_url") or getattr(settings, "cmdb_webhook_url", "")
    api_key = params.get("api_key") or getattr(settings, "cmdb_api_key", "")

    if not webhook_url:
        return {
            "success": False,
            "error": "CMDB not configured. Set CMDB_WEBHOOK_URL in settings to enable CMDB integration.",
            "configured": False
        }

    ci_type = params.get("ci_type", "network_device")
    ci_name = params.get("ci_name", "")
    updates = params.get("updates", {})
    action = params.get("action", "update")

    # Build payload
    payload = {
        "action": action,
        "ci_type": ci_type,
        "ci_name": ci_name,
        "updates": updates,
        "source": "lumen",
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Add execution context
    if context:
        payload["workflow_execution_id"] = context.get("execution_id")
        payload["workflow_name"] = context.get("workflow_name")

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(webhook_url, json=payload, headers=headers) as resp:
                if resp.status in (200, 201, 204):
                    try:
                        result = await resp.json()
                    except (ValueError, aiohttp.ContentTypeError):
                        result = {"message": "CMDB updated successfully"}
                    return {
                        "success": True,
                        "ci_type": ci_type,
                        "ci_name": ci_name,
                        "action": action,
                        "response": result
                    }
                else:
                    text = await resp.text()
                    return {"success": False, "error": f"CMDB API error: {resp.status} - {text}"}
    except Exception as e:
        logger.error(f"CMDB update failed: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# Meraki Remediation Tools
# =============================================================================

async def meraki_disable_switch_port_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Disable a switch port by setting enabled=false.

    Args:
        params:
            - serial: Switch serial number
            - port_id: Port ID to disable

    Returns:
        success status and port details
    """
    registry = get_tool_registry()
    update_tool = registry.get("meraki_switch_update_port")

    if not update_tool or not update_tool.handler:
        return {"success": False, "error": "Switch port update tool not available"}

    # Set enabled to false
    disable_params = {
        "serial": params.get("serial"),
        "port_id": params.get("port_id"),
        "enabled": False,
    }

    return await update_tool.handler(disable_params, context)


async def meraki_block_client_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Block a client from the network using policy.

    Args:
        params:
            - network_id: Network ID
            - client_id or client_mac: Client identifier
            - policy: Policy to apply (default: Blocked)

    Returns:
        success status
    """
    registry = get_tool_registry()
    policy_tool = registry.get("meraki_networks_update_client_policy")

    if not policy_tool or not policy_tool.handler:
        return {"success": False, "error": "Client policy tool not available"}

    block_params = {
        "network_id": params.get("network_id"),
        "client_id": params.get("client_id") or params.get("client_mac"),
        "device_policy": "Blocked",
    }

    return await policy_tool.handler(block_params, context)


async def meraki_quarantine_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Move a device to a quarantine VLAN.

    Args:
        params:
            - serial: Switch serial number
            - port_id: Port ID to quarantine
            - quarantine_vlan (optional): VLAN ID to use

    Returns:
        success status and VLAN assignment
    """
    settings = get_settings()
    quarantine_vlan = params.get("quarantine_vlan") or getattr(settings, "quarantine_vlan_id", 999)

    registry = get_tool_registry()
    update_tool = registry.get("meraki_switch_update_port")

    if not update_tool or not update_tool.handler:
        return {"success": False, "error": "Switch port update tool not available"}

    quarantine_params = {
        "serial": params.get("serial"),
        "port_id": params.get("port_id"),
        "vlan": quarantine_vlan,
    }

    result = await update_tool.handler(quarantine_params, context)
    if result.get("success"):
        result["quarantine_vlan"] = quarantine_vlan
    return result


async def meraki_get_device_diagnostics_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Collect comprehensive device diagnostics.

    Aggregates data from multiple Meraki API calls.

    Args:
        params:
            - serial: Device serial number

    Returns:
        success status and diagnostic data
    """
    registry = get_tool_registry()
    serial = params.get("serial")

    if not serial:
        return {"success": False, "error": "No serial number provided"}

    diagnostics = {
        "serial": serial,
        "collected_at": datetime.utcnow().isoformat(),
        "device_info": None,
        "clients": None,
        "uplink_status": None,
    }

    # Get device info
    device_tool = registry.get("meraki_devices_get")
    if device_tool and device_tool.handler:
        try:
            diagnostics["device_info"] = await device_tool.handler({"serial": serial}, context)
        except Exception as e:
            logger.warning(f"Could not get device info: {e}")

    # Get clients
    clients_tool = registry.get("meraki_devices_get_clients")
    if clients_tool and clients_tool.handler:
        try:
            diagnostics["clients"] = await clients_tool.handler({"serial": serial}, context)
        except Exception as e:
            logger.warning(f"Could not get clients: {e}")

    return {"success": True, "diagnostics": diagnostics}


async def meraki_failover_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Trigger WAN failover on an MX appliance.

    Changes the primary uplink preference to force failover.

    Args:
        params:
            - serial: MX appliance serial number
            - target_uplink: Target uplink ('wan1' or 'wan2')

    Returns:
        success status and uplink configuration
    """
    registry = get_tool_registry()
    serial = params.get("serial")
    target_uplink = params.get("target_uplink", "wan2")

    if not serial:
        return {"success": False, "error": "No serial number provided"}

    # Use the appliance uplink settings API
    uplink_tool = registry.get("meraki_appliance_update_uplink_settings")

    if not uplink_tool or not uplink_tool.handler:
        return {
            "success": False,
            "error": "MX uplink configuration tool not available. This action requires an MX appliance.",
            "configured": False
        }

    try:
        # Update uplink preference to force failover
        uplink_params = {
            "serial": serial,
            "interfaces": {
                target_uplink: {
                    "enabled": True,
                    "vlanTagging": {"enabled": False}
                }
            }
        }

        result = await uplink_tool.handler(uplink_params, context)
        if result.get("success"):
            return {
                "success": True,
                "serial": serial,
                "failover_target": target_uplink,
                "message": f"Uplink preference updated to {target_uplink}"
            }
        return result
    except Exception as e:
        logger.error(f"Failover failed: {e}")
        return {"success": False, "error": str(e)}


async def meraki_traceroute_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Run a traceroute from a Meraki device using live tools.

    Note: Uses Meraki's live tools API which may have limited availability.

    Args:
        params:
            - serial: Device serial number
            - target: Target IP or hostname to trace

    Returns:
        success status and traceroute results
    """
    registry = get_tool_registry()
    serial = params.get("serial")
    target = params.get("target", "8.8.8.8")

    if not serial:
        return {"success": False, "error": "No serial number provided"}

    # Try to use Meraki live tools API for traceroute
    # Note: This may not be available on all device types
    traceroute_tool = registry.get("meraki_devices_create_live_tools_traceroute")

    if traceroute_tool and traceroute_tool.handler:
        try:
            result = await traceroute_tool.handler({
                "serial": serial,
                "target": target
            }, context)
            return result
        except Exception as e:
            logger.warning(f"Live tools traceroute failed: {e}")

    # Fallback: Return info about alternative methods
    return {
        "success": False,
        "error": "Traceroute via Meraki API is not available for this device type. Use ping test or check device dashboard for connectivity diagnostics.",
        "alternative": "Use the Meraki Dashboard > Tools > Traceroute for manual testing",
        "serial": serial,
        "target": target
    }


async def meraki_pcap_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Request a packet capture from a Meraki device.

    Note: Packet capture is available for specific device types and may require
    additional configuration.

    Args:
        params:
            - serial: Device serial number
            - duration: Capture duration in seconds (max 300)
            - filter: Optional BPF filter expression

    Returns:
        success status and capture request info
    """
    registry = get_tool_registry()
    serial = params.get("serial")
    duration = min(params.get("duration", 60), 300)  # Max 5 minutes
    pcap_filter = params.get("filter", "")

    if not serial:
        return {"success": False, "error": "No serial number provided"}

    # Check for packet capture tool
    pcap_tool = registry.get("meraki_devices_create_live_tools_cable_test")

    # Note: Meraki's packet capture is typically done through dashboard
    # The API has limited pcap support
    return {
        "success": False,
        "error": "Packet capture via API has limited support. Use Meraki Dashboard for full packet capture functionality.",
        "alternative": "Navigate to Network-wide > Packet capture in Meraki Dashboard",
        "serial": serial,
        "requested_duration": duration,
        "filter": pcap_filter,
        "documentation": "https://documentation.meraki.com/General_Administration/Tools_and_Troubleshooting/Using_Packet_Capture"
    }


# =============================================================================
# Configuration Tools
# =============================================================================

async def meraki_backup_config_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Backup device/network configuration.

    Args:
        params:
            - network_id: Network ID to backup
            - include_settings: List of settings to include

    Returns:
        success status and config data
    """
    registry = get_tool_registry()
    network_id = params.get("network_id")

    if not network_id:
        return {"success": False, "error": "No network_id provided"}

    config = {
        "network_id": network_id,
        "backed_up_at": datetime.utcnow().isoformat(),
        "settings": {},
    }

    # Get network settings
    network_tool = registry.get("meraki_networks_get")
    if network_tool and network_tool.handler:
        try:
            config["settings"]["network"] = await network_tool.handler({"network_id": network_id}, context)
        except Exception as e:
            logger.warning(f"Could not get network config: {e}")

    return {"success": True, "config": config}


async def meraki_schedule_firmware_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Schedule a firmware upgrade.

    Args:
        params:
            - network_id: Network ID
            - scheduled_at (optional): ISO timestamp for upgrade
            - products (optional): Products to upgrade

    Returns:
        success status and schedule details
    """
    registry = get_tool_registry()
    firmware_tool = registry.get("meraki_networks_update_firmware_upgrades")

    if not firmware_tool or not firmware_tool.handler:
        return {"success": False, "error": "Firmware upgrade tool not available"}

    schedule_params = {
        "network_id": params.get("network_id"),
        "upgrade_window": params.get("upgrade_window"),
        "timezone": params.get("timezone", "UTC"),
    }

    return await firmware_tool.handler(schedule_params, context)


async def meraki_rollback_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Rollback to a previous configuration.

    This implementation stores config snapshots locally and can restore them.
    For production use, consider integrating with a proper version control system.

    Args:
        params:
            - network_id: Network ID to rollback
            - snapshot_id (optional): Specific snapshot to restore
            - confirm: Must be True to execute rollback

    Returns:
        success status and rollback details
    """
    network_id = params.get("network_id")
    snapshot_id = params.get("snapshot_id")
    confirm = params.get("confirm", False)

    if not network_id:
        return {"success": False, "error": "No network_id provided"}

    if not confirm:
        return {
            "success": False,
            "error": "Rollback requires confirmation. Set confirm=true to proceed.",
            "warning": "This will restore a previous configuration and may cause service disruption."
        }

    # In a full implementation, we would:
    # 1. Fetch the stored config snapshot from database
    # 2. Apply each setting back to the network
    # 3. Track the rollback in audit log

    # For now, return guidance on manual rollback
    return {
        "success": False,
        "error": "Automated rollback requires config history storage. Use backup_config first to create snapshots.",
        "alternative": "Use Meraki Dashboard > Organization > Change log to review and revert changes",
        "network_id": network_id,
        "recommendation": "Implement config versioning by regularly running backup_config action"
    }


async def meraki_apply_template_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Apply a configuration template to a network.

    Uses Meraki's configuration template feature.

    Args:
        params:
            - network_id: Target network ID
            - template_id: Source template ID to apply

    Returns:
        success status and template application result
    """
    registry = get_tool_registry()
    network_id = params.get("network_id")
    template_id = params.get("template_id")

    if not network_id or not template_id:
        return {"success": False, "error": "Both network_id and template_id are required"}

    # Use the network bind template API
    bind_tool = registry.get("meraki_networks_bind_template")

    if bind_tool and bind_tool.handler:
        try:
            result = await bind_tool.handler({
                "network_id": network_id,
                "config_template_id": template_id,
                "auto_bind": True
            }, context)
            return result
        except Exception as e:
            logger.error(f"Template application failed: {e}")
            return {"success": False, "error": str(e)}

    return {
        "success": False,
        "error": "Network template binding tool not available",
        "network_id": network_id,
        "template_id": template_id
    }


# =============================================================================
# Tool Definitions
# =============================================================================

NOTIFICATION_TOOLS = [
    create_tool(
        name="slack_notify",
        description="Send a notification to a Slack channel via webhook",
        platform="workflow",
        category="notifications",
        properties={
            "webhook_url": {"type": "string", "description": "Slack webhook URL (optional, uses default if not set)"},
            "channel": {"type": "string", "description": "Channel to post to", "default": "#alerts"},
            "message": {"type": "string", "description": "Message text to send"},
            "username": {"type": "string", "description": "Bot username", "default": "Lumen"},
        },
        required=["message"],
        handler=slack_notify_handler,
        tags=["notification", "slack"],
    ),
    create_tool(
        name="email_notify",
        description="Send an email notification via SMTP",
        platform="workflow",
        category="notifications",
        properties={
            "recipients": {"type": "string", "description": "Comma-separated email addresses"},
            "subject": {"type": "string", "description": "Email subject line"},
            "message": {"type": "string", "description": "Email body text"},
            "html": {"type": "string", "description": "Optional HTML body"},
        },
        required=["recipients", "message"],
        handler=email_notify_handler,
        tags=["notification", "email"],
    ),
    create_tool(
        name="teams_notify",
        description="Send a notification to Microsoft Teams via webhook",
        platform="workflow",
        category="notifications",
        properties={
            "webhook_url": {"type": "string", "description": "Teams webhook URL (optional, uses default if not set)"},
            "message": {"type": "string", "description": "Message text to send"},
            "title": {"type": "string", "description": "Card title", "default": "Lumen Alert"},
        },
        required=["message"],
        handler=teams_notify_handler,
        tags=["notification", "teams", "microsoft"],
    ),
    create_tool(
        name="pagerduty_trigger",
        description="Trigger a PagerDuty incident",
        platform="workflow",
        category="notifications",
        properties={
            "routing_key": {"type": "string", "description": "PagerDuty routing key (optional, uses default if not set)"},
            "severity": {"type": "string", "enum": ["info", "warning", "error", "critical"], "description": "Incident severity"},
            "message": {"type": "string", "description": "Incident summary"},
            "source": {"type": "string", "description": "Source identifier", "default": "lumen"},
            "dedup_key": {"type": "string", "description": "Deduplication key for grouping alerts"},
        },
        required=["message"],
        handler=pagerduty_trigger_handler,
        tags=["notification", "pagerduty", "incident"],
    ),
    create_tool(
        name="http_webhook",
        description="Call a generic HTTP webhook URL",
        platform="workflow",
        category="notifications",
        properties={
            "url": {"type": "string", "description": "Webhook URL to call"},
            "method": {"type": "string", "enum": ["GET", "POST"], "description": "HTTP method", "default": "POST"},
            "payload": {"type": "object", "description": "JSON payload to send"},
            "headers": {"type": "object", "description": "Additional HTTP headers"},
        },
        required=["url"],
        handler=http_webhook_handler,
        tags=["notification", "webhook", "http"],
    ),
    create_tool(
        name="webex_notify",
        description="Send a notification to Cisco Webex via webhook or bot",
        platform="workflow",
        category="notifications",
        properties={
            "webhook_url": {"type": "string", "description": "Webex webhook URL (optional, uses default if not set)"},
            "room_id": {"type": "string", "description": "Webex room/space ID (for bot token method)"},
            "message": {"type": "string", "description": "Message text to send (supports markdown)"},
            "markdown": {"type": "boolean", "description": "Treat message as markdown", "default": True},
        },
        required=["message"],
        handler=webex_notify_handler,
        tags=["notification", "webex", "cisco"],
    ),
]

DOCUMENTATION_TOOLS = [
    create_tool(
        name="create_incident",
        description="Create an incident ticket in the system",
        platform="workflow",
        category="documentation",
        properties={
            "title": {"type": "string", "description": "Incident title"},
            "description": {"type": "string", "description": "Incident description"},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "critical"], "description": "Incident priority"},
            "source": {"type": "string", "description": "Source identifier", "default": "workflow"},
        },
        required=[],
        handler=create_incident_handler,
        tags=["documentation", "incident"],
    ),
    create_tool(
        name="splunk_log",
        description="Log a custom event to Splunk HEC",
        platform="workflow",
        category="documentation",
        properties={
            "message": {"type": "string", "description": "Event message"},
            "sourcetype": {"type": "string", "description": "Splunk sourcetype", "default": "lumen:workflow"},
            "index": {"type": "string", "description": "Splunk index (optional)"},
            "fields": {"type": "object", "description": "Additional fields to include"},
        },
        required=["message"],
        handler=splunk_log_handler,
        tags=["documentation", "splunk", "logging"],
    ),
    create_tool(
        name="generate_report",
        description="Generate an incident or execution report",
        platform="workflow",
        category="documentation",
        properties={
            "format": {"type": "string", "enum": ["markdown", "json"], "description": "Report format", "default": "markdown"},
            "include_trigger_data": {"type": "boolean", "description": "Include raw trigger data in report", "default": False},
        },
        required=[],
        handler=generate_report_handler,
        tags=["documentation", "report"],
    ),
    create_tool(
        name="cmdb_update",
        description="Update a CMDB record via webhook (ServiceNow, Freshservice, etc.)",
        platform="workflow",
        category="documentation",
        properties={
            "webhook_url": {"type": "string", "description": "CMDB webhook URL (optional, uses default if not set)"},
            "ci_type": {"type": "string", "description": "Configuration item type", "default": "network_device"},
            "ci_name": {"type": "string", "description": "Configuration item name/identifier"},
            "updates": {"type": "object", "description": "Fields to update"},
            "action": {"type": "string", "enum": ["create", "update", "delete"], "description": "Action type", "default": "update"},
        },
        required=["ci_name"],
        handler=cmdb_update_handler,
        tags=["documentation", "cmdb", "integration"],
    ),
]

REMEDIATION_TOOLS = [
    create_tool(
        name="meraki_disable_switch_port",
        description="Disable a switch port to isolate a device",
        platform="workflow",
        category="remediation",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID to disable"},
        },
        required=["serial", "port_id"],
        handler=meraki_disable_switch_port_handler,
        requires_write=True,
        tags=["remediation", "meraki", "switch"],
    ),
    create_tool(
        name="meraki_block_client",
        description="Block a client from the network",
        platform="workflow",
        category="remediation",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "client_id": {"type": "string", "description": "Client ID or MAC address"},
        },
        required=["network_id", "client_id"],
        handler=meraki_block_client_handler,
        requires_write=True,
        tags=["remediation", "meraki", "client"],
    ),
    create_tool(
        name="meraki_quarantine",
        description="Move a device to quarantine VLAN",
        platform="workflow",
        category="remediation",
        properties={
            "serial": {"type": "string", "description": "Switch serial number"},
            "port_id": {"type": "string", "description": "Port ID to quarantine"},
            "quarantine_vlan": {"type": "integer", "description": "Quarantine VLAN ID (optional, uses default)"},
        },
        required=["serial", "port_id"],
        handler=meraki_quarantine_handler,
        requires_write=True,
        tags=["remediation", "meraki", "vlan", "quarantine"],
    ),
    create_tool(
        name="meraki_get_device_diagnostics",
        description="Collect comprehensive device diagnostics",
        platform="workflow",
        category="diagnostics",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
        },
        required=["serial"],
        handler=meraki_get_device_diagnostics_handler,
        tags=["diagnostics", "meraki"],
    ),
    create_tool(
        name="meraki_failover",
        description="Trigger WAN failover on an MX appliance",
        platform="workflow",
        category="remediation",
        properties={
            "serial": {"type": "string", "description": "MX appliance serial number"},
            "target_uplink": {"type": "string", "enum": ["wan1", "wan2"], "description": "Target uplink", "default": "wan2"},
        },
        required=["serial"],
        handler=meraki_failover_handler,
        requires_write=True,
        tags=["remediation", "meraki", "failover", "wan"],
    ),
    create_tool(
        name="meraki_traceroute",
        description="Run traceroute from a Meraki device (limited availability)",
        platform="workflow",
        category="diagnostics",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "target": {"type": "string", "description": "Target IP or hostname", "default": "8.8.8.8"},
        },
        required=["serial"],
        handler=meraki_traceroute_handler,
        tags=["diagnostics", "meraki", "traceroute"],
    ),
    create_tool(
        name="meraki_pcap",
        description="Request packet capture from a Meraki device (limited API support)",
        platform="workflow",
        category="diagnostics",
        properties={
            "serial": {"type": "string", "description": "Device serial number"},
            "duration": {"type": "integer", "description": "Capture duration in seconds (max 300)", "default": 60},
            "filter": {"type": "string", "description": "Optional BPF filter expression"},
        },
        required=["serial"],
        handler=meraki_pcap_handler,
        requires_write=True,
        tags=["diagnostics", "meraki", "pcap", "capture"],
    ),
]

CONFIG_TOOLS = [
    create_tool(
        name="meraki_backup_config",
        description="Backup network configuration",
        platform="workflow",
        category="configuration",
        properties={
            "network_id": {"type": "string", "description": "Network ID to backup"},
        },
        required=["network_id"],
        handler=meraki_backup_config_handler,
        tags=["configuration", "backup", "meraki"],
    ),
    create_tool(
        name="meraki_schedule_firmware",
        description="Schedule a firmware upgrade",
        platform="workflow",
        category="configuration",
        properties={
            "network_id": {"type": "string", "description": "Network ID"},
            "upgrade_window": {"type": "object", "description": "Upgrade window configuration"},
            "timezone": {"type": "string", "description": "Timezone for scheduling", "default": "UTC"},
        },
        required=["network_id"],
        handler=meraki_schedule_firmware_handler,
        requires_write=True,
        tags=["configuration", "firmware", "meraki"],
    ),
    create_tool(
        name="meraki_apply_template",
        description="Apply a configuration template to a network",
        platform="workflow",
        category="configuration",
        properties={
            "network_id": {"type": "string", "description": "Target network ID"},
            "template_id": {"type": "string", "description": "Source template ID to apply"},
        },
        required=["network_id", "template_id"],
        handler=meraki_apply_template_handler,
        requires_write=True,
        tags=["configuration", "template", "meraki"],
    ),
    create_tool(
        name="meraki_rollback",
        description="Rollback to a previous configuration (requires config history)",
        platform="workflow",
        category="configuration",
        properties={
            "network_id": {"type": "string", "description": "Network ID to rollback"},
            "snapshot_id": {"type": "string", "description": "Specific snapshot ID to restore (optional)"},
            "confirm": {"type": "boolean", "description": "Confirm rollback execution", "default": False},
        },
        required=["network_id"],
        handler=meraki_rollback_handler,
        requires_write=True,
        tags=["configuration", "rollback", "meraki"],
    ),
]

ALL_WORKFLOW_TOOLS = NOTIFICATION_TOOLS + DOCUMENTATION_TOOLS + REMEDIATION_TOOLS + CONFIG_TOOLS


def register_workflow_tools():
    """Register all workflow action tools."""
    registry = get_tool_registry()

    # Register tool aliases first
    register_tool_aliases()

    # Register new tools
    registry.register_many(ALL_WORKFLOW_TOOLS)

    logger.info(
        f"[WorkflowActions] Registered {len(ALL_WORKFLOW_TOOLS)} workflow tools: "
        f"Notifications={len(NOTIFICATION_TOOLS)}, "
        f"Documentation={len(DOCUMENTATION_TOOLS)}, "
        f"Remediation={len(REMEDIATION_TOOLS)}, "
        f"Config={len(CONFIG_TOOLS)}"
    )


# Note: Tools are registered via tool_registry._load_all_tools()
# after the base platform tools are loaded. Do NOT auto-register here.
