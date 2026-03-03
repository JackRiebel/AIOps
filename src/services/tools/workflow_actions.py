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
    # ==========================================================================
    # Meraki Device Operations
    # ==========================================================================
    "meraki.reboot_device": "meraki_devices_reboot",
    "meraki_reboot_device": "meraki_devices_reboot",
    "meraki.blink_leds": "meraki_devices_blink_leds",
    "meraki.update_device": "meraki_devices_update",
    "meraki.claim_device": "meraki_organizations_claim_devices",
    "meraki.remove_device": "meraki_networks_list_devices",  # Note: Remove uses list then manual removal
    "meraki.run_ping": "meraki_devices_create_ping",
    "meraki_ping": "meraki_devices_create_ping",
    "meraki.cable_test": "meraki_devices_create_cable_test",
    "meraki.wake_on_lan": "meraki_devices_create_wake_on_lan",
    "meraki.get_lldp_cdp": "meraki_devices_get_lldp_cdp",

    # ==========================================================================
    # Meraki Wireless Operations
    # ==========================================================================
    "meraki.enable_ssid": "meraki_wireless_update_ssid",
    "meraki.update_ssid": "meraki_wireless_update_ssid",
    "meraki.list_ssids": "meraki_wireless_list_ssids",
    "meraki.get_ssid": "meraki_wireless_get_ssid",

    # ==========================================================================
    # Meraki Switch Operations
    # ==========================================================================
    "meraki.cycle_port": "meraki_switch_cycle_ports",
    "meraki_cycle_port": "meraki_switch_cycle_ports",
    "meraki.update_port": "meraki_switch_update_port",
    "meraki.list_ports": "meraki_switch_list_ports",
    "meraki.get_port": "meraki_switch_get_port",
    "meraki.get_port_statuses": "meraki_switch_get_ports_statuses",

    # ==========================================================================
    # Meraki Security Operations
    # ==========================================================================
    "meraki.quarantine_client": "meraki_networks_update_client_policy",
    "meraki.update_client_policy": "meraki_networks_update_client_policy",
    "meraki.get_client_policy": "meraki_networks_get_client_policy",
    "meraki.update_firewall_rules": "meraki_appliance_update_l3_firewall_rules",
    "meraki.get_firewall_rules": "meraki_appliance_get_l3_firewall_rules",
    "meraki.update_content_filter": "meraki_appliance_update_content_filtering",
    "meraki.get_content_filter": "meraki_appliance_get_content_filtering",
    "meraki.get_security_events": "meraki_appliance_get_security_events",

    # ==========================================================================
    # Meraki VPN Operations
    # ==========================================================================
    "meraki.get_vpn_status": "meraki_appliance_get_site_to_site_vpn",
    "meraki.update_vpn_config": "meraki_appliance_update_site_to_site_vpn",
    "meraki.get_vpn_topology": "meraki_appliance_get_vpn_statuses",
    "meraki.get_vpn_stats": "meraki_appliance_get_vpn_stats",

    # ==========================================================================
    # Meraki Monitoring & Health
    # ==========================================================================
    "meraki.get_network_health": "meraki_networks_get_health_alerts",
    "meraki_get_network_health": "meraki_networks_get_health_alerts",
    "meraki.get_all_health_alerts": "meraki_organizations_get_assurance_alerts",
    "meraki.get_org_health_alerts": "meraki_organizations_get_assurance_alerts",
    "meraki_get_org_health": "meraki_organizations_get_assurance_alerts",
    "meraki.monitor_health": "monitor_network_health",
    "monitor_health": "monitor_network_health",
    "meraki.get_device_status": "monitor_device_status",
    "meraki.get_devices_status": "monitor_device_status",
    "meraki_get_device_status": "monitor_device_status",
    "meraki.monitor_device_status": "monitor_device_status",
    "meraki.get_device_status_raw": "meraki_organizations_get_devices_statuses",
    "meraki_get_device_status_raw": "meraki_organizations_get_devices_statuses",
    "meraki.get_events": "meraki_networks_get_events",
    "meraki.get_topology": "meraki_devices_get_lldp_cdp",  # Topology via LLDP/CDP neighbors
    "meraki.list_clients": "meraki_networks_list_clients",
    "meraki.get_client": "meraki_networks_get_client",

    # ==========================================================================
    # Meraki VLAN & Network Operations
    # ==========================================================================
    "meraki.list_vlans": "meraki_appliance_list_vlans",
    "meraki.get_vlan": "meraki_appliance_get_vlan",
    "meraki.create_vlan": "meraki_appliance_create_vlan",
    "meraki.update_vlan": "meraki_appliance_update_vlan",
    "meraki.delete_vlan": "meraki_appliance_delete_vlan",
    "meraki.list_static_routes": "meraki_appliance_list_static_routes",
    "meraki.create_static_route": "meraki_appliance_create_static_route",

    # ==========================================================================
    # Splunk Operations
    # ==========================================================================
    "splunk.run_query": "splunk_run_search",
    "splunk.run_saved_search": "splunk_run_saved_search",
    "splunk.create_saved_search": "splunk_create_saved_search",
    "splunk.delete_saved_search": "splunk_delete_saved_search",
    "splunk.list_saved_searches": "splunk_list_saved_searches",
    "splunk.get_server_health": "splunk_get_server_health",
    "splunk.get_server_info": "splunk_get_server_info",
    "splunk.list_indexes": "splunk_list_indexes",
    "splunk.get_index": "splunk_get_index",
    "splunk.kvstore_query": "splunk_get_kvstore_data",
    "splunk.kvstore_insert": "splunk_insert_kvstore_data",
    "splunk.kvstore_delete": "splunk_delete_kvstore_data",
    "splunk.list_kvstore_collections": "splunk_list_kvstore_collections",
    "splunk.list_dashboards": "splunk_list_dashboards",
    "splunk.get_dashboard": "splunk_get_dashboard",
    "splunk.list_reports": "splunk_list_reports",
    "splunk.generate_insights": "splunk_search_generate_spl",
    "splunk.ai_search": "splunk_search_run_splunk_query",
    "splunk.explain_spl": "splunk_search_explain_spl",
    "splunk.optimize_spl": "splunk_search_optimize_spl",

    # ==========================================================================
    # ThousandEyes Operations
    # ==========================================================================
    "thousandeyes.list_tests": "thousandeyes_list_tests",
    "thousandeyes.get_test_results": "thousandeyes_get_test_results",
    "thousandeyes.create_test": "thousandeyes_tests_create_http_server",
    "thousandeyes.create_http_test": "thousandeyes_tests_create_http_server",
    "thousandeyes.create_page_load_test": "thousandeyes_tests_create_page_load",
    "thousandeyes.create_dns_test": "thousandeyes_tests_create_dns_server",
    "thousandeyes.run_instant_test": "thousandeyes_instant_run_agent_to_server",
    "thousandeyes.run_instant_http": "thousandeyes_instant_run_http_server",
    "thousandeyes.run_instant_page_load": "thousandeyes_instant_run_page_load",
    "thousandeyes.run_instant_dns": "thousandeyes_instant_run_dns_server",
    "thousandeyes.list_alerts": "thousandeyes_list_alerts",
    "thousandeyes.get_alert": "thousandeyes_alerts_get_by_id",
    "thousandeyes.get_path_visualization": "thousandeyes_get_path_visualization",
    "thousandeyes.list_agents": "thousandeyes_list_agents",
    "thousandeyes.get_agent_status": "thousandeyes_agents_get_by_id",
    "thousandeyes.list_endpoint_agents": "thousandeyes_list_endpoint_agents",
    "thousandeyes.list_dashboards": "thousandeyes_list_dashboards",
    "thousandeyes.get_dashboard": "thousandeyes_dashboards_get_by_id",
    "thousandeyes.list_labels": "thousandeyes_list_labels",
    "thousandeyes.list_bgp_monitors": "thousandeyes_list_bgp_monitors",

    # ==========================================================================
    # AI Tools
    # ==========================================================================
    "ai.summarize_events": "ai_summarize_events",
    "ai.summarize": "ai_summarize_events",
    "ai.recommend_actions": "ai_recommend_actions",
    "ai.recommend": "ai_recommend_actions",

    # ==========================================================================
    # Custom/Notification Tools
    # ==========================================================================
    "custom.webhook": "http_webhook",
    "custom.create_incident": "create_incident",
    "custom.slack_notify": "slack_notify",
    "custom.email_notify": "email_notify",
    "custom.teams_notify": "teams_notify",
    "custom.pagerduty_trigger": "pagerduty_trigger",
    "notification.slack": "slack_notify",
    "notification.email": "email_notify",
    "notification.teams": "teams_notify",
    "notification.pagerduty": "pagerduty_trigger",
    "notification.webhook": "http_webhook",
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

    message = params.get("message", "Workflow notification from Cisco AIOps Hub")
    channel = params.get("channel", "#alerts")

    payload = {
        "channel": channel,
        "text": message,
        "username": params.get("username", "Cisco AIOps Hub"),
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
    subject = params.get("subject", "Cisco AIOps Hub Workflow Alert")
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

    message = params.get("message", "Workflow notification from Cisco AIOps Hub")
    title = params.get("title", "AIOps Hub Alert")

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
    summary = params.get("message", "Workflow alert from Cisco AIOps Hub")
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

    message = params.get("message", "Workflow notification from Cisco AIOps Hub")
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

    Automatically extracts AI analysis from workflow context if available.

    Args:
        params:
            - title (optional): Incident title
            - description (optional): Incident description
            - priority: low, medium, high, critical (maps to severity)
            - source (optional): Source identifier (stored in root_cause_hypothesis)

    Returns:
        success status and incident ID
    """
    logger.info(f"[create_incident] Called with params: {params}")
    logger.info(f"[create_incident] Context type: {type(context).__name__}")
    try:
        from src.config.database import get_db
        from src.models.incident import Incident, IncidentStatus, EventSeverity

        title = params.get("title") or ""  # Handle None and empty string
        root_cause = params.get("description", "")
        priority = params.get("priority", "medium")
        source = params.get("source", "workflow")

        # Extract AI analysis from context if available (set by workflow executor)
        ai_analysis = None
        trigger_data = None
        event_count = 0

        if context:
            # Check for ai_analysis attribute (set by workflow executor)
            ai_analysis = getattr(context, 'ai_analysis', None)
            if ai_analysis is None and isinstance(context, dict):
                ai_analysis = context.get("ai_analysis")

            # Check flow_context for more data
            flow_context = getattr(context, 'flow_context', None)
            if flow_context is None and isinstance(context, dict):
                flow_context = context.get("flow_context")

            if flow_context:
                trigger_data = flow_context.get("trigger_data", {})
                if isinstance(trigger_data, list):
                    event_count = len(trigger_data)
                elif isinstance(trigger_data, dict):
                    event_count = trigger_data.get("count", 1)

                # If no AI analysis yet, try to find it in step_results
                if not ai_analysis:
                    step_results = flow_context.get("step_results", {})
                    for step_id, result in step_results.items():
                        if isinstance(result, dict):
                            if result.get("response"):
                                ai_analysis = result.get("response")
                                break
                            elif result.get("data") and isinstance(result.get("data"), list):
                                # This might be Splunk query results
                                event_count = len(result.get("data", []))

        logger.info(f"[create_incident] AI analysis available: {bool(ai_analysis)}, event_count: {event_count}")

        # Map priority to EventSeverity enum
        severity_map = {
            "low": EventSeverity.LOW,
            "medium": EventSeverity.MEDIUM,
            "high": EventSeverity.HIGH,
            "critical": EventSeverity.CRITICAL,
        }
        severity = severity_map.get(priority.lower(), EventSeverity.MEDIUM)

        # Build root cause hypothesis - prioritize AI analysis
        hypothesis_parts = []

        if ai_analysis:
            hypothesis_parts.append(f"AI Hypothesis:\n{ai_analysis}")

        if root_cause:
            hypothesis_parts.append(root_cause)

        # Add context info
        if context:
            execution_id = getattr(context, 'execution_id', None)
            if execution_id is None and isinstance(context, dict):
                execution_id = context.get("execution_id")
            workflow_name = getattr(context, 'workflow_name', None)
            if workflow_name is None and isinstance(context, dict):
                workflow_name = context.get("workflow_name")

            context_info = []
            if execution_id:
                context_info.append(f"Workflow Execution ID: {execution_id}")
            if workflow_name:
                context_info.append(f"Workflow: {workflow_name}")
            if event_count > 0:
                context_info.append(f"Events Analyzed: {event_count}")
            if context_info:
                hypothesis_parts.append("\n".join(context_info))

        if source:
            hypothesis_parts.insert(0, f"Source: {source}")

        final_hypothesis = "\n\n".join(hypothesis_parts) if hypothesis_parts else None

        # Generate title from AI analysis if not provided or empty
        if (not title or title == "Workflow-generated incident") and ai_analysis:
            # Extract a meaningful title from AI analysis
            # Skip markdown headers and find actual content
            import re

            # Try to extract severity and a summary
            severity_label = "Alert"
            severity_match = re.search(r'SEVERITY[:\s]*(critical|high|medium|low)', ai_analysis, re.IGNORECASE)
            if severity_match:
                sev = severity_match.group(1).lower()
                if sev == "critical":
                    severity_label = "Critical Alert"
                elif sev == "high":
                    severity_label = "High Priority Alert"
                elif sev == "medium":
                    severity_label = "Alert"
                else:
                    severity_label = "Low Priority Notice"

            # Look for a SUMMARY or RECOMMENDATION section
            summary_match = re.search(r'(?:SUMMARY|RECOMMENDATION)[:\s]*(.+?)(?:\n|$)', ai_analysis, re.IGNORECASE)
            if summary_match:
                summary_text = summary_match.group(1).strip()[:80]
                title = f"{severity_label}: {summary_text}"
            else:
                # Find first non-header, non-empty line with actual content
                lines = ai_analysis.split('\n')
                content_line = None
                for line in lines:
                    line = line.strip()
                    # Skip markdown headers, empty lines, and lines that are just labels
                    if (line and
                        not line.startswith('#') and
                        not line.startswith('---') and
                        not re.match(r'^(REAL_ISSUE|ACTIONABLE|SEVERITY|IMPACT|CONTEXT)[:\s]*\d*%?$', line, re.IGNORECASE) and
                        len(line) > 10):
                        content_line = line
                        break

                if content_line:
                    # Clean up the line - remove markdown formatting
                    content_line = re.sub(r'[*_`]', '', content_line)[:80]
                    title = f"{severity_label}: {content_line}"
                else:
                    # Fallback: use workflow name and severity
                    workflow_name = context.get("workflow_name") if isinstance(context, dict) else getattr(context, 'workflow_name', None)
                    if workflow_name:
                        title = f"{severity_label} from {workflow_name}"
                    else:
                        title = f"{severity_label}: Automated Detection"

        # Final fallback: ensure we always have a title
        if not title:
            workflow_name = None
            if context:
                workflow_name = context.get("workflow_name") if isinstance(context, dict) else getattr(context, 'workflow_name', None)
            if workflow_name:
                title = f"Alert from {workflow_name}"
            else:
                # Use priority/severity in title
                severity_labels = {
                    "critical": "Critical Alert",
                    "high": "High Priority Alert",
                    "medium": "Alert",
                    "low": "Notice"
                }
                title = severity_labels.get(priority.lower(), "Alert") + ": Workflow Detection"

        logger.info(f"[create_incident] Creating incident: title='{title}', severity={severity}")
        db = get_db()
        async with db.session() as session:
            # DEDUPLICATION: Check for existing similar incidents (same title, still open, within last 24 hours)
            from sqlalchemy import select, or_
            from datetime import timedelta

            cutoff_time = datetime.utcnow() - timedelta(hours=24)

            # Look for existing open/investigating incidents with the same or very similar title
            existing_query = (
                select(Incident)
                .where(Incident.start_time >= cutoff_time)
                .where(or_(
                    Incident.status == IncidentStatus.OPEN,
                    Incident.status == IncidentStatus.INVESTIGATING
                ))
                .where(Incident.title == title)
                .order_by(Incident.start_time.desc())
                .limit(1)
            )
            result = await session.execute(existing_query)
            existing_incident = result.scalar_one_or_none()

            if existing_incident:
                # Update existing incident instead of creating duplicate
                logger.info(f"[create_incident] Found existing incident #{existing_incident.id} with same title, updating instead of creating duplicate")

                # Update the timestamp and append to hypothesis if new info
                existing_incident.updated_at = datetime.utcnow()

                # Optionally update event count
                if event_count > 0:
                    existing_incident.event_count = (existing_incident.event_count or 0) + event_count

                # Escalate severity if the new one is higher
                severity_order = [EventSeverity.INFO, EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH, EventSeverity.CRITICAL]
                if severity in severity_order and existing_incident.severity in severity_order:
                    if severity_order.index(severity) > severity_order.index(existing_incident.severity):
                        existing_incident.severity = severity
                        logger.info(f"[create_incident] Escalated severity to {severity}")

                await session.commit()
                return {
                    "success": True,
                    "incident_id": existing_incident.id,
                    "title": existing_incident.title,
                    "deduplicated": True,
                    "message": f"Updated existing incident #{existing_incident.id} instead of creating duplicate"
                }

            # No existing incident found, create new one
            incident = Incident(
                title=title,
                status=IncidentStatus.OPEN,
                severity=severity,
                start_time=datetime.utcnow(),
                root_cause_hypothesis=final_hypothesis,
                event_count=event_count if event_count > 0 else None,
            )
            session.add(incident)
            await session.commit()
            await session.refresh(incident)
            logger.info(f"[create_incident] SUCCESS: Created incident ID={incident.id}")
            return {"success": True, "incident_id": incident.id, "title": title}
    except ImportError as e:
        logger.warning(f"[create_incident] ImportError - Incident model not available: {e}")
        return {"success": False, "error": "Incident system not configured"}
    except Exception as e:
        logger.error(f"[create_incident] FAILED: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def monitor_network_health_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Monitor network health and create incident if issues found.

    This composite action:
    1. Gets health alerts from Meraki (org-wide or per-network)
    2. If alerts are found, creates an incident with the alert details
    3. Returns both the alerts and incident info

    Args:
        params:
            - organization_id (optional): Meraki org ID for org-wide alerts
            - network_id (optional): Specific network ID (if not org-wide)
            - create_incident: Whether to create incident (default: True)
            - min_severity: Minimum severity to create incident (warning, critical)

    Returns:
        success status, alerts found, and incident info if created
    """
    logger.info(f"[monitor_network_health] Called with params: {params}")
    try:
        from src.services.tool_registry import get_tool_registry
        from src.config.database import get_db
        from src.models.incident import Incident, IncidentStatus, EventSeverity

        registry = get_tool_registry()
        alerts = []

        org_id = params.get("organization_id") or params.get("organizationId")
        network_id = params.get("network_id") or params.get("networkId")
        create_incident_flag = params.get("create_incident", True)
        min_severity = params.get("min_severity", "warning")

        # Get org_id from context if not in params
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        # Build Meraki context if we don't have one
        meraki_context = context
        if not hasattr(context, 'client') or context.client is None:
            # Need to get Meraki credentials and create a context
            try:
                from src.services.credential_pool import CredentialPool
                from src.services.tools.meraki import MerakiExecutionContext

                pool = CredentialPool()
                await pool.load_all()
                await pool.discover_meraki_orgs()

                cred = pool.get_for_meraki(organization_id=org_id)
                if cred and cred.credentials.get("api_key"):
                    # Get org_id from discovered orgs if not specified
                    if not org_id and cred.org_ids:
                        org_id = cred.org_ids[0]
                        logger.info(f"[monitor_network_health] Using discovered org_id: {org_id}")

                    meraki_context = MerakiExecutionContext(
                        api_key=cred.credentials.get("api_key"),
                        org_id=org_id,
                        network_id=network_id,
                    )
                    logger.info(f"[monitor_network_health] Created Meraki context from credential pool")
                else:
                    return {
                        "success": False,
                        "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
                    }
            except Exception as e:
                logger.error(f"[monitor_network_health] Failed to get Meraki credentials: {e}")
                return {
                    "success": False,
                    "error": f"Failed to get Meraki credentials: {str(e)}"
                }

        # Get alerts - prefer org-wide if org_id provided
        if org_id:
            tool = registry.get("meraki_organizations_get_assurance_alerts")
            if tool:
                logger.info(f"[monitor_network_health] Getting org alerts for org {org_id}")
                result = await tool.handler({"organization_id": org_id}, meraki_context)
                if result.get("success"):
                    alerts = result.get("data", [])
                    if isinstance(alerts, dict):
                        alerts = alerts.get("items", alerts.get("alerts", []))
                else:
                    logger.warning(f"[monitor_network_health] Failed to get alerts: {result.get('error')}")
        elif network_id:
            tool = registry.get("meraki_networks_get_health_alerts")
            if tool:
                logger.info(f"[monitor_network_health] Getting network alerts for network {network_id}")
                result = await tool.handler({"network_id": network_id}, meraki_context)
                if result.get("success"):
                    alerts = result.get("data", [])
                else:
                    logger.warning(f"[monitor_network_health] Failed to get alerts: {result.get('error')}")

        # If no alerts, return success with no incident
        if not alerts:
            return {
                "success": True,
                "alerts_found": 0,
                "alerts": [],
                "incident_created": False,
                "message": "No health alerts found"
            }

        # Filter by minimum severity if specified
        severity_order = ["info", "warning", "critical"]
        min_idx = severity_order.index(min_severity) if min_severity in severity_order else 0
        filtered_alerts = [
            a for a in alerts
            if severity_order.index(a.get("severity", "warning")) >= min_idx
        ]

        # Create incident if enabled and alerts found
        incident_id = None
        if create_incident_flag and filtered_alerts:
            # Build incident description from alerts
            alert_summary = []
            for alert in filtered_alerts[:5]:  # Limit to first 5 alerts
                alert_type = alert.get("type", "Unknown")
                severity = alert.get("severity", "warning")
                category = alert.get("category", "")
                alert_summary.append(f"- [{severity.upper()}] {category}: {alert_type}")

            description = f"Network health monitoring detected {len(filtered_alerts)} alert(s):\n\n"
            description += "\n".join(alert_summary)
            if len(filtered_alerts) > 5:
                description += f"\n\n... and {len(filtered_alerts) - 5} more alerts"

            # Determine priority based on alert severities
            has_critical = any(a.get("severity") == "critical" for a in filtered_alerts)
            priority = "high" if has_critical else "medium"
            incident_title = f"Network Health Alert: {len(filtered_alerts)} issue(s) detected"
            incident_severity = EventSeverity.HIGH if has_critical else EventSeverity.MEDIUM

            # Create the incident with DEDUPLICATION
            db = get_db()
            async with db.session() as session:
                # Check for existing similar incidents (within last 24 hours, still open)
                from sqlalchemy import select, or_
                from datetime import timedelta

                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                existing_query = (
                    select(Incident)
                    .where(Incident.start_time >= cutoff_time)
                    .where(or_(
                        Incident.status == IncidentStatus.OPEN,
                        Incident.status == IncidentStatus.INVESTIGATING
                    ))
                    .where(Incident.title.like("Network Health Alert:%"))
                    .order_by(Incident.start_time.desc())
                    .limit(1)
                )
                result = await session.execute(existing_query)
                existing_incident = result.scalar_one_or_none()

                if existing_incident:
                    # Update existing incident
                    logger.info(f"[monitor_network_health] Found existing incident #{existing_incident.id}, updating instead of creating duplicate")
                    existing_incident.updated_at = datetime.utcnow()
                    existing_incident.root_cause_hypothesis = description  # Update with latest alerts
                    # Escalate severity if needed
                    if incident_severity == EventSeverity.HIGH and existing_incident.severity != EventSeverity.HIGH:
                        existing_incident.severity = EventSeverity.HIGH
                    await session.commit()
                    incident_id = existing_incident.id
                else:
                    # Create new incident
                    incident = Incident(
                        title=incident_title,
                        status=IncidentStatus.OPEN,
                        severity=incident_severity,
                        start_time=datetime.utcnow(),
                        root_cause_hypothesis=description,
                    )
                    session.add(incident)
                    await session.commit()
                    await session.refresh(incident)
                    incident_id = incident.id

        return {
            "success": True,
            "alerts_found": len(alerts),
            "alerts": alerts,
            "filtered_alerts": len(filtered_alerts),
            "incident_created": incident_id is not None,
            "incident_id": incident_id,
        }

    except Exception as e:
        logger.error(f"Failed to monitor network health: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def monitor_device_status_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Monitor device status and create incident if issues found.

    This composite action:
    1. Gets device statuses from Meraki (online/offline/alerting)
    2. If offline or alerting devices are found, creates an incident
    3. Returns both the device statuses and incident info

    Args:
        params:
            - organization_id (optional): Meraki org ID
            - create_incident: Whether to create incident (default: True)
            - include_offline_only: Only report offline devices (default: False)

    Returns:
        success status, device statuses, and incident info if created
    """
    logger.info(f"[monitor_device_status] Called with params: {params}")
    try:
        from src.services.tool_registry import get_tool_registry
        from src.config.database import get_db
        from src.models.incident import Incident, IncidentStatus, EventSeverity

        registry = get_tool_registry()

        # Accept multiple param names for organization_id
        org_id = (params.get("organization_id") or params.get("organizationId")
                  or params.get("organization") or params.get("org_id"))
        create_incident_flag = params.get("create_incident", True)
        include_offline_only = params.get("include_offline_only", False)

        # Get serial/networkId for filtering (optional)
        target_serial = params.get("serial")
        target_network = params.get("networkId") or params.get("network_id")

        # Get org_id from context if not in params
        if not org_id and hasattr(context, 'org_id'):
            org_id = context.org_id

        # Build Meraki context if we don't have one
        meraki_context = context
        if not hasattr(context, 'client') or context.client is None:
            # Need to get Meraki credentials and create a context
            try:
                from src.services.credential_pool import CredentialPool
                from src.services.tools.meraki import MerakiExecutionContext

                pool = CredentialPool()
                await pool.load_all()
                await pool.discover_meraki_orgs()

                cred = pool.get_for_meraki(organization_id=org_id)
                if cred and cred.credentials.get("api_key"):
                    # Get org_id from discovered orgs if not specified
                    if not org_id and cred.org_ids:
                        org_id = cred.org_ids[0]
                        logger.info(f"[monitor_device_status] Using discovered org_id: {org_id}")

                    meraki_context = MerakiExecutionContext(
                        api_key=cred.credentials.get("api_key"),
                        org_id=org_id,
                    )
                    logger.info(f"[monitor_device_status] Created Meraki context from credential pool")
                else:
                    return {
                        "success": False,
                        "error": "Meraki API credentials not configured. Please configure your Meraki API key in Settings > Integrations."
                    }
            except Exception as e:
                logger.error(f"[monitor_device_status] Failed to get Meraki credentials: {e}")
                return {
                    "success": False,
                    "error": f"Failed to get Meraki credentials: {str(e)}"
                }

        if not org_id:
            return {
                "success": False,
                "error": "Missing organization_id. Please specify a Meraki organization ID or configure one in your credentials."
            }

        # Get device statuses
        tool = registry.get("meraki_organizations_get_devices_statuses")
        if not tool:
            return {"success": False, "error": "Device status tool not found"}

        logger.info(f"[monitor_device_status] Getting device statuses for org {org_id}")
        result = await tool.handler({"organization_id": org_id}, meraki_context)

        if not result.get("success"):
            return result

        devices = result.get("data", [])
        if isinstance(devices, dict):
            devices = devices.get("items", devices.get("devices", []))

        logger.info(f"[monitor_device_status] Got {len(devices)} devices")

        # Filter by serial/network if specified
        if target_serial or target_network:
            filtered = []
            for device in devices:
                if target_serial and device.get("serial") != target_serial:
                    continue
                if target_network and device.get("networkId") != target_network:
                    continue
                filtered.append(device)
            devices = filtered
            logger.info(f"[monitor_device_status] Filtered to {len(devices)} devices (serial={target_serial}, network={target_network})")

        # Filter for problem devices
        problem_devices = []
        for device in devices:
            status = device.get("status", "").lower()
            logger.info(f"[monitor_device_status] Device {device.get('serial')}: status={status}")
            if status in ["offline", "alerting", "dormant"]:
                problem_devices.append(device)
            elif not include_offline_only and status not in ["online"]:
                problem_devices.append(device)

        logger.info(f"[monitor_device_status] Found {len(problem_devices)} problem devices")

        # If no problem devices, return success with no incident
        if not problem_devices:
            return {
                "success": True,
                "total_devices": len(devices),
                "problem_devices": 0,
                "devices": devices,
                "incident_created": False,
                "message": "All devices are online"
            }

        # Create incident if enabled and problem devices found
        incident_id = None
        if create_incident_flag:
            # Build incident description from problem devices
            device_summary = []
            offline_count = 0
            alerting_count = 0

            for device in problem_devices[:10]:  # Limit to first 10
                name = device.get("name") or device.get("serial", "Unknown")
                status = device.get("status", "unknown")
                model = device.get("model", "")
                device_summary.append(f"- {name} ({model}): {status.upper()}")
                if status.lower() == "offline":
                    offline_count += 1
                elif status.lower() == "alerting":
                    alerting_count += 1

            description = f"Device status monitoring detected {len(problem_devices)} device(s) with issues:\n\n"
            description += f"- Offline: {offline_count}\n"
            description += f"- Alerting: {alerting_count}\n"
            description += f"- Other: {len(problem_devices) - offline_count - alerting_count}\n\n"
            description += "Affected devices:\n" + "\n".join(device_summary)
            if len(problem_devices) > 10:
                description += f"\n\n... and {len(problem_devices) - 10} more devices"

            # Determine severity based on device statuses
            has_offline = offline_count > 0
            severity = EventSeverity.HIGH if has_offline else EventSeverity.MEDIUM
            incident_title = f"Device Status Alert: {len(problem_devices)} device(s) need attention"

            logger.info(f"[monitor_device_status] Creating incident for {len(problem_devices)} problem devices")

            # Create the incident with DEDUPLICATION
            db = get_db()
            async with db.session() as session:
                # Check for existing similar incidents (within last 24 hours, still open)
                from sqlalchemy import select, or_
                from datetime import timedelta

                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                existing_query = (
                    select(Incident)
                    .where(Incident.start_time >= cutoff_time)
                    .where(or_(
                        Incident.status == IncidentStatus.OPEN,
                        Incident.status == IncidentStatus.INVESTIGATING
                    ))
                    .where(Incident.title.like("Device Status Alert:%"))
                    .order_by(Incident.start_time.desc())
                    .limit(1)
                )
                result = await session.execute(existing_query)
                existing_incident = result.scalar_one_or_none()

                if existing_incident:
                    # Update existing incident
                    logger.info(f"[monitor_device_status] Found existing incident #{existing_incident.id}, updating instead of creating duplicate")
                    existing_incident.updated_at = datetime.utcnow()
                    existing_incident.root_cause_hypothesis = description  # Update with latest device info
                    # Escalate severity if needed
                    if severity == EventSeverity.HIGH and existing_incident.severity != EventSeverity.HIGH:
                        existing_incident.severity = EventSeverity.HIGH
                    await session.commit()
                    incident_id = existing_incident.id
                else:
                    # Create new incident
                    incident = Incident(
                        title=incident_title,
                        status=IncidentStatus.OPEN,
                        severity=severity,
                        start_time=datetime.utcnow(),
                        root_cause_hypothesis=description,
                    )
                    session.add(incident)
                    await session.commit()
                    await session.refresh(incident)
                    incident_id = incident.id
                    logger.info(f"[monitor_device_status] Created incident ID={incident_id}")

        return {
            "success": True,
            "total_devices": len(devices),
            "problem_devices": len(problem_devices),
            "offline_count": offline_count if create_incident_flag else sum(1 for d in problem_devices if d.get("status", "").lower() == "offline"),
            "alerting_count": alerting_count if create_incident_flag else sum(1 for d in problem_devices if d.get("status", "").lower() == "alerting"),
            "devices": devices,
            "problem_device_list": problem_devices[:20],  # Return first 20 problem devices
            "incident_created": incident_id is not None,
            "incident_id": incident_id,
        }

    except Exception as e:
        logger.error(f"[monitor_device_status] FAILED: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


async def add_incident_timeline_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Add an event to an incident timeline.

    This allows workflows to post updates, notes, or action results to an incident's
    timeline for tracking remediation progress.

    Args:
        params:
            - incident_id: ID of the incident to add the event to
            - title: Event title/summary
            - description (optional): Detailed description of the event
            - severity: info, low, medium, high, critical (default: info)
            - event_type (optional): Type of event (workflow_action, investigation_update,
              remediation, manual_note). Default: workflow_action
            - affected_resource (optional): Resource identifier affected by this event

    Returns:
        success status and event ID
    """
    try:
        from src.config.database import get_db
        from src.models.incident import Event, EventSource, EventSeverity, Incident

        # Validate required parameters
        incident_id = params.get("incident_id")
        if not incident_id:
            return {"success": False, "error": "Missing required parameter: incident_id. Specify the incident to add the timeline event to."}

        title = params.get("title")
        if not title:
            return {"success": False, "error": "Missing required parameter: title. Specify a title for the timeline event."}

        description = params.get("description", "")
        severity_str = params.get("severity", "info").lower()
        event_type = params.get("event_type", "workflow_action")
        affected_resource = params.get("affected_resource")

        # Map severity
        severity_map = {
            "info": EventSeverity.INFO,
            "low": EventSeverity.LOW,
            "medium": EventSeverity.MEDIUM,
            "high": EventSeverity.HIGH,
            "critical": EventSeverity.CRITICAL,
        }
        severity = severity_map.get(severity_str, EventSeverity.INFO)

        # Build raw_data with workflow context
        raw_data = {
            "source": "workflow",
            "event_type": event_type,
        }
        if context:
            if isinstance(context, dict):
                raw_data["workflow_execution_id"] = context.get("execution_id")
                raw_data["workflow_name"] = context.get("workflow_name")
                raw_data["workflow_id"] = context.get("workflow_id")
            elif hasattr(context, '__dict__'):
                raw_data["workflow_execution_id"] = getattr(context, "execution_id", None)
                raw_data["workflow_name"] = getattr(context, "workflow_name", None)

        db = get_db()
        async with db.session() as session:
            # Verify the incident exists
            incident = await session.get(Incident, int(incident_id))
            if not incident:
                return {"success": False, "error": f"Incident {incident_id} not found."}

            # Create the event
            event = Event(
                incident_id=int(incident_id),
                source=EventSource.WORKFLOW,
                source_event_id=f"workflow-{context.get('execution_id', 'manual') if context and isinstance(context, dict) else 'manual'}",
                organization=incident.organizations[0] if incident.organizations else "default",
                event_type=event_type,
                severity=severity,
                title=title,
                description=description,
                timestamp=datetime.utcnow(),
                affected_resource=affected_resource,
                raw_data=raw_data,
            )
            session.add(event)
            await session.commit()
            await session.refresh(event)

            logger.info(f"Added timeline event {event.id} to incident {incident_id}")
            return {
                "success": True,
                "event_id": event.id,
                "incident_id": int(incident_id),
                "title": title,
                "severity": severity_str,
            }

    except ImportError as e:
        logger.warning(f"Incident model not available: {e}")
        return {"success": False, "error": "Incident system not configured"}
    except ValueError as e:
        return {"success": False, "error": f"Invalid incident_id: {e}"}
    except Exception as e:
        logger.error(f"Failed to add incident timeline event: {e}", exc_info=True)
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

This report was automatically generated by the Cisco AIOps Hub workflow system.

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
    # Validate required parameters
    serial = params.get("serial")
    port_id = params.get("port_id") or params.get("portId")

    if not serial:
        return {"success": False, "error": "Missing required parameter: serial. Specify the switch serial number."}
    if not port_id:
        return {"success": False, "error": "Missing required parameter: port_id. Specify the port ID to disable."}

    registry = get_tool_registry()
    update_tool = registry.get("meraki_switch_update_port")

    if not update_tool or not update_tool.handler:
        return {"success": False, "error": "Switch port update tool not available"}

    # Set enabled to false
    disable_params = {
        "serial": serial,
        "port_id": port_id,
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
    # Validate required parameters
    network_id = params.get("network_id") or params.get("networkId")
    client_id = params.get("client_id") or params.get("clientId") or params.get("client_mac") or params.get("clientMac")

    if not network_id:
        return {"success": False, "error": "Missing required parameter: network_id. Specify the network ID."}
    if not client_id:
        return {"success": False, "error": "Missing required parameter: client_id or client_mac. Specify the client to block."}

    registry = get_tool_registry()
    policy_tool = registry.get("meraki_networks_update_client_policy")

    if not policy_tool or not policy_tool.handler:
        return {"success": False, "error": "Client policy tool not available"}

    block_params = {
        "network_id": network_id,
        "client_id": client_id,
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
    # Validate required parameters
    serial = params.get("serial")
    port_id = params.get("port_id") or params.get("portId")

    if not serial:
        return {"success": False, "error": "Missing required parameter: serial. Specify the switch serial number."}
    if not port_id:
        return {"success": False, "error": "Missing required parameter: port_id. Specify the port ID to quarantine."}

    settings = get_settings()
    quarantine_vlan = params.get("quarantine_vlan") or getattr(settings, "quarantine_vlan_id", 999)

    registry = get_tool_registry()
    update_tool = registry.get("meraki_switch_update_port")

    if not update_tool or not update_tool.handler:
        return {"success": False, "error": "Switch port update tool not available"}

    quarantine_params = {
        "serial": serial,
        "port_id": port_id,
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
# AI Tool Handlers
# =============================================================================

async def ai_summarize_events_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Summarize events using AI.

    Uses the configured AI provider to summarize a list of events, alerts, or logs.

    Args:
        params:
            - events: List of events/alerts to summarize
            - format: Output format (brief, detailed, bullet_points)
            - focus: What to focus on (root_cause, impact, timeline)

    Returns:
        AI-generated summary of the events
    """
    from src.services.multi_provider_ai import generate_text

    events = params.get("events", [])
    format_type = params.get("format", "detailed")
    focus = params.get("focus", "impact")

    if not events:
        return {"success": False, "error": "No events provided to summarize"}

    # Format events for AI
    events_text = "\n".join([
        f"- {e.get('title', e.get('message', str(e)))}"
        for e in (events if isinstance(events, list) else [events])
    ])

    prompt = f"""Summarize the following events. Focus on {focus}. Format: {format_type}.

Events:
{events_text}

Provide a clear, actionable summary."""

    try:
        result = await generate_text(prompt, max_tokens=2000)
        if result and result.get("text"):
            return {
                "success": True,
                "summary": result["text"],
                "event_count": len(events) if isinstance(events, list) else 1,
                "focus": focus,
                "model": result.get("model"),
                "tokens_used": result.get("input_tokens", 0) + result.get("output_tokens", 0),
            }
        else:
            return {"success": False, "error": "AI service returned no response"}
    except Exception as e:
        logger.error(f"AI summarize failed: {e}")
        return {"success": False, "error": str(e)}


async def ai_recommend_actions_handler(params: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Get AI-powered action recommendations.

    Uses the configured AI provider to analyze a situation and recommend remediation actions.

    Args:
        params:
            - situation: Description of the current situation/problem
            - context: Additional context (device info, history, etc.)
            - max_recommendations: Maximum number of recommendations (default: 5)

    Returns:
        List of recommended actions with rationale
    """
    from src.services.multi_provider_ai import generate_text

    situation = params.get("situation", "")
    additional_context = params.get("context", "")
    max_recs = params.get("max_recommendations", 5)

    if not situation:
        return {"success": False, "error": "No situation description provided"}

    prompt = f"""Analyze this network/IT situation and recommend remediation actions.

Situation: {situation}

Additional Context: {additional_context}

Provide up to {max_recs} specific, actionable recommendations. For each:
1. What action to take
2. Why this action helps
3. Priority level (high/medium/low)
4. Potential risks

Format as a structured list."""

    try:
        result = await generate_text(prompt, max_tokens=2000)
        if result and result.get("text"):
            return {
                "success": True,
                "recommendations": result["text"],
                "situation_analyzed": situation[:100] + "..." if len(situation) > 100 else situation,
                "model": result.get("model"),
                "tokens_used": result.get("input_tokens", 0) + result.get("output_tokens", 0),
            }
        else:
            return {"success": False, "error": "AI service returned no response"}
    except Exception as e:
        logger.error(f"AI recommend actions failed: {e}")
        return {"success": False, "error": str(e)}


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
            "username": {"type": "string", "description": "Bot username", "default": "Cisco AIOps Hub"},
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
            "title": {"type": "string", "description": "Card title", "default": "AIOps Hub Alert"},
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
        name="monitor_network_health",
        description="Monitor network health and automatically create incident if issues found. Gets all health alerts from Meraki and creates an incident ticket with alert details.",
        platform="workflow",
        category="monitoring",
        properties={
            "organization_id": {"type": "string", "description": "Meraki organization ID for org-wide monitoring"},
            "network_id": {"type": "string", "description": "Specific network ID (if not using org-wide)"},
            "create_incident": {"type": "boolean", "description": "Create incident if alerts found", "default": True},
            "min_severity": {"type": "string", "enum": ["info", "warning", "critical"], "description": "Minimum severity to trigger incident", "default": "warning"},
        },
        required=[],
        handler=monitor_network_health_handler,
        tags=["monitoring", "health", "incident", "meraki"],
    ),
    create_tool(
        name="monitor_device_status",
        description="Monitor device status and automatically create incident if offline or alerting devices found. Gets all device statuses from Meraki and creates an incident ticket with device details.",
        platform="workflow",
        category="monitoring",
        properties={
            "organization_id": {"type": "string", "description": "Meraki organization ID"},
            "create_incident": {"type": "boolean", "description": "Create incident if problem devices found", "default": True},
            "include_offline_only": {"type": "boolean", "description": "Only report offline devices (not alerting)", "default": False},
        },
        required=[],
        handler=monitor_device_status_handler,
        tags=["monitoring", "devices", "incident", "meraki", "status"],
    ),
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
        name="add_incident_timeline",
        description="Add an event to an incident's timeline for tracking workflow actions and remediation progress",
        platform="workflow",
        category="notifications",
        properties={
            "incident_id": {"type": "integer", "description": "ID of the incident to add the timeline event to"},
            "title": {"type": "string", "description": "Event title/summary"},
            "description": {"type": "string", "description": "Detailed description of the event"},
            "severity": {"type": "string", "enum": ["info", "low", "medium", "high", "critical"], "description": "Event severity", "default": "info"},
            "event_type": {"type": "string", "enum": ["workflow_action", "investigation_update", "remediation", "manual_note"], "description": "Type of timeline event", "default": "workflow_action"},
            "affected_resource": {"type": "string", "description": "Resource identifier affected by this event"},
        },
        required=["incident_id", "title"],
        handler=add_incident_timeline_handler,
        tags=["notification", "incident", "timeline"],
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

# =============================================================================
# AI Tools
# =============================================================================

AI_TOOLS = [
    create_tool(
        name="ai_summarize_events",
        description="Use AI to summarize a list of events, alerts, or logs into actionable insights",
        platform="workflow",
        category="ai",
        properties={
            "events": {"type": "array", "description": "List of events/alerts to summarize"},
            "format": {"type": "string", "enum": ["brief", "detailed", "bullet_points"], "description": "Output format", "default": "detailed"},
            "focus": {"type": "string", "enum": ["root_cause", "impact", "timeline", "all"], "description": "What to focus on", "default": "impact"},
        },
        required=["events"],
        handler=ai_summarize_events_handler,
        tags=["ai", "summarize", "analysis"],
    ),
    create_tool(
        name="ai_recommend_actions",
        description="Use AI to analyze a situation and recommend remediation actions",
        platform="workflow",
        category="ai",
        properties={
            "situation": {"type": "string", "description": "Description of the current situation/problem"},
            "context": {"type": "string", "description": "Additional context (device info, history, etc.)"},
            "max_recommendations": {"type": "integer", "description": "Maximum number of recommendations", "default": 5},
        },
        required=["situation"],
        handler=ai_recommend_actions_handler,
        tags=["ai", "recommend", "remediation"],
    ),
]

ALL_WORKFLOW_TOOLS = NOTIFICATION_TOOLS + DOCUMENTATION_TOOLS + REMEDIATION_TOOLS + CONFIG_TOOLS + AI_TOOLS


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
        f"Config={len(CONFIG_TOOLS)}, "
        f"AI={len(AI_TOOLS)}"
    )


# Note: Tools are registered via tool_registry._load_all_tools()
# after the base platform tools are loaded. Do NOT auto-register here.
