/**
 * Python Workflow Templates
 *
 * Pre-built workflow scripts demonstrating SDK usage patterns.
 */

import { PYTHON_IMPORTS } from './pythonSDK';

// ============================================================================
// Types
// ============================================================================

export interface PythonTemplate {
  id: string;
  name: string;
  description: string;
  category: 'monitoring' | 'automation' | 'analysis' | 'integration' | 'reporting';
  tags: string[];
  code: string;
}

// ============================================================================
// Templates
// ============================================================================

export const PYTHON_TEMPLATES: PythonTemplate[] = [
  // ---------------------------------------------------------------------------
  // Monitoring Templates
  // ---------------------------------------------------------------------------
  {
    id: 'network-health-check',
    name: 'Network Health Check',
    description: 'Monitor network health across all devices and alert on issues',
    category: 'monitoring',
    tags: ['meraki', 'health', 'alerts'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Network Health Check Workflow

    Monitors all devices in a network and sends alerts for any unhealthy devices.
    """
    network_id = context.get("network_id")
    alert_threshold = context.get("health_threshold", 80)

    logger.info(f"Starting health check for network {network_id}")

    # Get all devices in the network
    devices = await meraki.get_devices(network_id)
    logger.info(f"Found {len(devices)} devices")

    # Check health for each device
    unhealthy_devices = []
    for device in devices:
        health = await meraki.get_network_health(network_id)
        if health.score < alert_threshold:
            unhealthy_devices.append({
                "serial": device.serial,
                "name": device.name,
                "score": health.score,
                "issues": health.issues
            })

    # Send alert if any unhealthy devices found
    if unhealthy_devices:
        message = f"Found {len(unhealthy_devices)} devices below health threshold:\\n"
        for d in unhealthy_devices:
            message += f"- {d['name']} ({d['serial']}): {d['score']}%\\n"

        await notify.slack("#network-alerts", message)
        logger.warning(f"Alert sent for {len(unhealthy_devices)} unhealthy devices")
    else:
        logger.info("All devices healthy")

    return {
        "status": "success",
        "total_devices": len(devices),
        "unhealthy_count": len(unhealthy_devices),
        "unhealthy_devices": unhealthy_devices
    }
`,
  },
  {
    id: 'client-monitoring',
    name: 'Client Activity Monitor',
    description: 'Track client connections and identify unusual patterns',
    category: 'monitoring',
    tags: ['meraki', 'clients', 'security'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Client Activity Monitor

    Monitors client connections and flags unusual activity patterns.
    """
    network_id = context.get("network_id")
    max_clients_threshold = context.get("max_clients", 100)

    # Get current clients
    clients = await meraki.get_clients(network_id, timespan=3600)

    logger.info(f"Current client count: {len(clients)}")

    # Analyze client patterns
    analysis = await ai.analyze(
        "Analyze these client connections for unusual patterns",
        context={"clients": clients, "timespan": "1 hour"}
    )

    # Check thresholds
    alerts = []

    if len(clients) > max_clients_threshold:
        alerts.append(f"High client count: {len(clients)} (threshold: {max_clients_threshold})")

    if analysis.anomalies:
        alerts.append(f"AI detected anomalies: {analysis.summary}")

    # Send alerts if any issues
    if alerts:
        await notify.slack("#security-alerts", "\\n".join(alerts))

    return {
        "status": "success",
        "client_count": len(clients),
        "alerts": alerts,
        "ai_analysis": analysis.summary
    }
`,
  },

  // ---------------------------------------------------------------------------
  // Automation Templates
  // ---------------------------------------------------------------------------
  {
    id: 'device-provisioning',
    name: 'Device Auto-Provisioning',
    description: 'Automatically configure new devices with standard settings',
    category: 'automation',
    tags: ['meraki', 'provisioning', 'automation'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Device Auto-Provisioning Workflow

    Automatically configures new devices with standard settings based on device type.
    """
    # Get trigger data (new device event)
    trigger = context.trigger_data
    serial = trigger.get("device_serial")
    device_type = trigger.get("device_type", "unknown")

    logger.info(f"Provisioning new device: {serial} (type: {device_type})")

    # Define standard configurations by device type
    configs = {
        "MR": {  # Access Point
            "name_prefix": "AP-",
            "tags": ["access-point", "auto-provisioned"],
        },
        "MS": {  # Switch
            "name_prefix": "SW-",
            "tags": ["switch", "auto-provisioned"],
        },
        "MX": {  # Security Appliance
            "name_prefix": "FW-",
            "tags": ["firewall", "auto-provisioned"],
        }
    }

    # Get config for device type
    config = configs.get(device_type[:2], {
        "name_prefix": "DEV-",
        "tags": ["auto-provisioned"]
    })

    # Get device details
    device = await meraki.get_device(serial)

    # Generate new name
    new_name = f"{config['name_prefix']}{serial[-4:]}"

    # Apply configuration
    updated = await meraki.update_device(
        serial,
        name=new_name,
        tags=config["tags"]
    )

    logger.info(f"Device configured: {new_name}")

    # Notify team
    await notify.slack(
        "#network-ops",
        f"New device auto-provisioned:\\n"
        f"- Serial: {serial}\\n"
        f"- Name: {new_name}\\n"
        f"- Type: {device_type}"
    )

    return {
        "status": "success",
        "device_serial": serial,
        "new_name": new_name,
        "tags_applied": config["tags"]
    }
`,
  },
  {
    id: 'bulk-tag-update',
    name: 'Bulk Device Tag Update',
    description: 'Update tags on multiple devices based on criteria',
    category: 'automation',
    tags: ['meraki', 'bulk', 'tags'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Bulk Device Tag Update

    Updates tags on devices matching specified criteria.
    """
    network_id = context.get("network_id")
    filter_criteria = context.get("filter", {})
    tags_to_add = context.get("tags_to_add", [])
    tags_to_remove = context.get("tags_to_remove", [])

    logger.info(f"Starting bulk tag update on network {network_id}")

    # Get all devices
    devices = await meraki.get_devices(network_id)
    updated_count = 0

    for device in devices:
        # Check filter criteria
        should_update = True

        if "model_prefix" in filter_criteria:
            if not device.model.startswith(filter_criteria["model_prefix"]):
                should_update = False

        if "has_tag" in filter_criteria:
            if filter_criteria["has_tag"] not in device.tags:
                should_update = False

        if not should_update:
            continue

        # Calculate new tags
        current_tags = set(device.tags or [])
        new_tags = current_tags.union(set(tags_to_add)) - set(tags_to_remove)

        # Update if changed
        if new_tags != current_tags:
            await meraki.update_device(device.serial, tags=list(new_tags))
            updated_count += 1
            logger.debug(f"Updated tags on {device.serial}")

    logger.info(f"Updated {updated_count} devices")

    return {
        "status": "success",
        "total_devices": len(devices),
        "updated_count": updated_count,
        "tags_added": tags_to_add,
        "tags_removed": tags_to_remove
    }
`,
  },

  // ---------------------------------------------------------------------------
  // Analysis Templates
  // ---------------------------------------------------------------------------
  {
    id: 'incident-correlation',
    name: 'Incident Correlation Analysis',
    description: 'Correlate events from multiple sources to identify root cause',
    category: 'analysis',
    tags: ['splunk', 'ai', 'incidents'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Incident Correlation Analysis

    Correlates events from Splunk and network data to identify root cause.
    """
    incident_id = context.get("incident_id")
    time_window = context.get("time_window", "-1h")

    logger.info(f"Starting correlation analysis for incident {incident_id}")

    # Gather data from multiple sources

    # 1. Get Splunk events around incident time
    splunk_results = await splunk.search(
        f'index=main incident_id="{incident_id}" | stats count by source, severity',
        earliest=time_window
    )

    # 2. Get network health data
    network_id = context.get("network_id")
    devices = await meraki.get_devices(network_id)

    device_health = []
    for device in devices[:10]:  # Sample first 10 devices
        health = await meraki.get_network_health(network_id)
        device_health.append({
            "serial": device.serial,
            "name": device.name,
            "health": health.score
        })

    # 3. Get ThousandEyes test results if available
    te_results = None
    try:
        tests = await thousandeyes.get_tests()
        if tests:
            te_results = await thousandeyes.get_test_results(tests[0].id)
    except Exception as e:
        logger.warning(f"Could not fetch ThousandEyes data: {e}")

    # 4. Use AI to correlate all data
    correlation = await ai.analyze(
        prompt="""Analyze these data sources to identify the root cause of the incident.
        Look for patterns, timing correlations, and cascading failures.
        Provide a summary and recommended actions.""",
        context={
            "splunk_events": splunk_results.events,
            "device_health": device_health,
            "thousandeyes": te_results,
            "incident_id": incident_id
        }
    )

    # Generate summary report
    summary = await ai.summarize(correlation, format="markdown")

    # Send report
    await notify.slack(
        "#incident-response",
        f"Correlation analysis complete for incident {incident_id}:\\n{summary}"
    )

    return {
        "status": "success",
        "incident_id": incident_id,
        "correlation_summary": summary,
        "data_sources_analyzed": ["splunk", "meraki", "thousandeyes"],
        "root_cause": correlation.insights
    }
`,
  },
  {
    id: 'ai-decision-workflow',
    name: 'AI-Powered Decision Workflow',
    description: 'Use AI to make intelligent decisions based on network state',
    category: 'analysis',
    tags: ['ai', 'automation', 'decisions'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    AI-Powered Decision Workflow

    Analyzes current state and makes intelligent decisions about actions.
    """
    network_id = context.get("network_id")

    logger.info("Gathering network state for AI analysis")

    # Gather current state
    devices = await meraki.get_devices(network_id)
    clients = await meraki.get_clients(network_id, timespan=3600)
    health = await meraki.get_network_health(network_id)

    # Build context for AI
    state = {
        "device_count": len(devices),
        "client_count": len(clients),
        "health_score": health.score,
        "health_issues": health.issues,
        "time_of_day": "business_hours",  # Would be calculated
    }

    # Ask AI to decide on action
    decision = await ai.decide(
        question="Based on the current network state, what action should we take?",
        options=[
            "no_action - Network is healthy, no intervention needed",
            "alert_team - Issues detected, notify the network team",
            "auto_remediate - Minor issues that can be auto-fixed",
            "escalate - Critical issues requiring immediate attention"
        ],
        context=state
    )

    logger.info(f"AI decision: {decision.choice} (confidence: {decision.confidence})")

    # Execute based on decision
    action_taken = None

    if decision.choice == "alert_team":
        await notify.slack("#network-ops", f"AI Alert: {decision.reasoning}")
        action_taken = "Team notified via Slack"

    elif decision.choice == "auto_remediate":
        # Example: restart unhealthy devices
        for issue in health.issues[:3]:  # Max 3 auto-remediations
            if issue.type == "device_offline":
                await meraki.reboot_device(issue.device_serial)
                logger.info(f"Rebooted device {issue.device_serial}")
        action_taken = "Auto-remediation executed"

    elif decision.choice == "escalate":
        await notify.pagerduty("network-critical", "critical", decision.reasoning)
        action_taken = "Escalated to PagerDuty"

    else:
        action_taken = "No action needed"

    return {
        "status": "success",
        "ai_decision": decision.choice,
        "confidence": decision.confidence,
        "reasoning": decision.reasoning,
        "action_taken": action_taken
    }
`,
  },

  // ---------------------------------------------------------------------------
  // Integration Templates
  // ---------------------------------------------------------------------------
  {
    id: 'splunk-alert-handler',
    name: 'Splunk Alert Handler',
    description: 'Process Splunk alerts and take automated actions',
    category: 'integration',
    tags: ['splunk', 'alerts', 'automation'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Splunk Alert Handler

    Processes incoming Splunk alerts and takes appropriate actions.
    """
    # Get alert from trigger
    trigger = context.trigger_data
    alert_name = trigger.get("alert_name")
    severity = trigger.get("severity", "info")
    results = trigger.get("results", [])

    logger.info(f"Processing Splunk alert: {alert_name} (severity: {severity})")

    # Log the event
    await splunk.create_event(
        index="workflow_logs",
        event={
            "workflow_id": context.workflow_id,
            "alert_name": alert_name,
            "action": "processing"
        }
    )

    # Route based on severity
    if severity == "critical":
        # Immediate escalation
        await notify.pagerduty(
            service="network-critical",
            severity="critical",
            message=f"Critical Alert: {alert_name}"
        )

        # Also notify Slack
        await notify.slack(
            "#critical-alerts",
            f"CRITICAL: {alert_name}\\n"
            f"Results: {len(results)} events\\n"
            f"Escalated to PagerDuty"
        )

    elif severity == "high":
        # High priority notification
        await notify.slack(
            "#high-priority-alerts",
            f"HIGH: {alert_name}\\n"
            f"Results: {len(results)} events"
        )

    else:
        # Standard notification
        await notify.slack(
            "#alerts",
            f"{severity.upper()}: {alert_name}"
        )

    # Use AI to analyze alert pattern
    analysis = await ai.analyze(
        "Analyze this alert and its results to identify patterns and suggest actions",
        context={"alert": alert_name, "results": results}
    )

    return {
        "status": "success",
        "alert_name": alert_name,
        "severity": severity,
        "events_processed": len(results),
        "ai_insights": analysis.summary
    }
`,
  },
  {
    id: 'webhook-integration',
    name: 'External Webhook Integration',
    description: 'Send network data to external systems via webhooks',
    category: 'integration',
    tags: ['webhook', 'integration', 'api'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    External Webhook Integration

    Gathers network data and sends to external systems.
    """
    network_id = context.get("network_id")
    webhook_url = context.get("webhook_url")
    include_clients = context.get("include_clients", False)

    logger.info(f"Preparing data for webhook: {webhook_url}")

    # Gather network data
    devices = await meraki.get_devices(network_id)
    health = await meraki.get_network_health(network_id)

    payload = {
        "timestamp": "now",  # Would use actual timestamp
        "network_id": network_id,
        "summary": {
            "device_count": len(devices),
            "health_score": health.score,
            "issues_count": len(health.issues)
        },
        "devices": [
            {
                "serial": d.serial,
                "name": d.name,
                "model": d.model,
                "status": d.status
            }
            for d in devices
        ]
    }

    # Optionally include client data
    if include_clients:
        clients = await meraki.get_clients(network_id, timespan=3600)
        payload["clients"] = {
            "count": len(clients),
            "summary": {
                "wired": len([c for c in clients if c.connection_type == "wired"]),
                "wireless": len([c for c in clients if c.connection_type == "wireless"])
            }
        }

    # Send to webhook
    response = await notify.webhook(webhook_url, payload)

    logger.info(f"Webhook response: {response.get('status', 'unknown')}")

    return {
        "status": "success",
        "webhook_url": webhook_url,
        "payload_size": len(str(payload)),
        "response": response
    }
`,
  },

  // ---------------------------------------------------------------------------
  // Reporting Templates
  // ---------------------------------------------------------------------------
  {
    id: 'daily-health-report',
    name: 'Daily Health Report',
    description: 'Generate and distribute daily network health reports',
    category: 'reporting',
    tags: ['reporting', 'email', 'health'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Daily Health Report

    Generates comprehensive daily network health report.
    """
    network_id = context.get("network_id")
    recipients = context.get("recipients", [])

    logger.info("Generating daily health report")

    # Gather metrics
    devices = await meraki.get_devices(network_id)
    clients = await meraki.get_clients(network_id, timespan=86400)
    health = await meraki.get_network_health(network_id)

    # Get Splunk metrics
    splunk_results = await splunk.search(
        'index=main | stats count by severity | sort -count',
        earliest="-24h"
    )

    # Build report data
    report_data = {
        "network_id": network_id,
        "period": "24 hours",
        "metrics": {
            "total_devices": len(devices),
            "online_devices": len([d for d in devices if d.status == "online"]),
            "offline_devices": len([d for d in devices if d.status == "offline"]),
            "total_clients": len(clients),
            "health_score": health.score,
            "open_issues": len(health.issues)
        },
        "splunk_summary": splunk_results.events
    }

    # Generate AI summary
    summary = await ai.summarize(report_data, format="markdown")

    # Build HTML report
    html_report = f"""
    <html>
    <body>
    <h1>Daily Network Health Report</h1>
    <h2>Summary</h2>
    <p>{summary}</p>
    <h2>Key Metrics</h2>
    <ul>
        <li>Total Devices: {report_data['metrics']['total_devices']}</li>
        <li>Online: {report_data['metrics']['online_devices']}</li>
        <li>Offline: {report_data['metrics']['offline_devices']}</li>
        <li>Clients (24h): {report_data['metrics']['total_clients']}</li>
        <li>Health Score: {report_data['metrics']['health_score']}%</li>
    </ul>
    </body>
    </html>
    """

    # Send report
    for recipient in recipients:
        await notify.email(
            to=recipient,
            subject=f"Daily Network Report - Health: {health.score}%",
            body=html_report,
            html=True
        )
        logger.info(f"Report sent to {recipient}")

    # Also post to Slack
    await notify.slack(
        "#daily-reports",
        f"Daily Health Report Generated\\n"
        f"Health Score: {health.score}%\\n"
        f"Devices: {report_data['metrics']['online_devices']}/{report_data['metrics']['total_devices']} online\\n"
        f"Clients: {report_data['metrics']['total_clients']}"
    )

    return {
        "status": "success",
        "report_generated": True,
        "recipients_count": len(recipients),
        "health_score": health.score
    }
`,
  },
  {
    id: 'capacity-planning',
    name: 'Capacity Planning Analysis',
    description: 'Analyze trends and project future capacity needs',
    category: 'reporting',
    tags: ['analysis', 'planning', 'ai'],
    code: `${PYTHON_IMPORTS}

async def workflow(context):
    """
    Capacity Planning Analysis

    Analyzes historical data and projects future capacity needs.
    """
    network_id = context.get("network_id")
    projection_days = context.get("projection_days", 30)

    logger.info(f"Running capacity analysis for {projection_days} day projection")

    # Gather historical data from Splunk
    historical = await splunk.search(
        '''index=metrics network_id="{network_id}"
        | timechart span=1d avg(client_count), avg(bandwidth_usage), max(device_count)
        | sort _time''',
        earliest="-90d"
    )

    # Current state
    devices = await meraki.get_devices(network_id)
    clients = await meraki.get_clients(network_id)

    # Use AI for trend analysis and projection
    analysis = await ai.analyze(
        prompt=f"""Analyze these historical metrics and project capacity needs for the next {projection_days} days.
        Consider growth trends, seasonal patterns, and current utilization.
        Identify potential bottlenecks and recommended actions.""",
        context={
            "historical_data": historical.events,
            "current_devices": len(devices),
            "current_clients": len(clients),
            "projection_period": f"{projection_days} days"
        }
    )

    # Generate recommendations
    recommendations = await ai.decide(
        question="Based on the capacity analysis, what should be the primary focus?",
        options=[
            "expand_infrastructure - Current capacity nearing limits",
            "optimize_existing - Room for optimization before expansion",
            "maintain_current - Capacity is sufficient for projected growth",
            "reduce_capacity - Current infrastructure is over-provisioned"
        ],
        context=analysis
    )

    report = {
        "analysis_summary": analysis.summary,
        "projections": analysis.insights,
        "recommendation": recommendations.choice,
        "confidence": recommendations.confidence,
        "reasoning": recommendations.reasoning
    }

    # Send to leadership
    await notify.email(
        to="network-leadership@company.com",
        subject="Network Capacity Planning Report",
        body=await ai.summarize(report, format="text")
    )

    return {
        "status": "success",
        **report
    }
`,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getTemplateById(id: string): PythonTemplate | undefined {
  return PYTHON_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PythonTemplate['category']): PythonTemplate[] {
  return PYTHON_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByTag(tag: string): PythonTemplate[] {
  return PYTHON_TEMPLATES.filter((t) => t.tags.includes(tag));
}

export function searchTemplates(query: string): PythonTemplate[] {
  const lower = query.toLowerCase();
  return PYTHON_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}
