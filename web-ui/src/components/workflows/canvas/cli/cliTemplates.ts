/**
 * CLI Workflow Templates
 *
 * Pre-built workflow scripts demonstrating CLI syntax patterns.
 * These templates can be loaded into the CLI editor as starting points.
 */

// ============================================================================
// Types
// ============================================================================

export interface CLITemplate {
  id: string;
  name: string;
  description: string;
  category: 'monitoring' | 'automation' | 'security' | 'operations' | 'integration';
  tags: string[];
  code: string;
}

// ============================================================================
// Templates
// ============================================================================

export const CLI_TEMPLATES: CLITemplate[] = [
  // ---------------------------------------------------------------------------
  // Monitoring Templates
  // ---------------------------------------------------------------------------
  {
    id: 'device-health-check',
    name: 'Device Health Check',
    description: 'Check health status of all devices and alert on issues',
    category: 'monitoring',
    tags: ['meraki', 'health', 'monitoring'],
    code: `# Device Health Check Workflow
# Checks all devices and alerts on unhealthy ones

# Get all devices in the network
meraki get-devices --network \${network_id}

# Store device count
set device_count = \${result.length}

# Loop through each device
loop devices as device
  # Check if device is offline
  if \${device.status} != "online" then
    # Send alert for offline device
    notify slack --channel "#network-alerts" --message "Device \${device.name} is offline"
  end
end

# Log completion
notify webhook --url "/api/logs" --message "Health check complete: \${device_count} devices checked"
`,
  },
  {
    id: 'bandwidth-monitor',
    name: 'Bandwidth Usage Monitor',
    description: 'Monitor bandwidth usage and alert when thresholds are exceeded',
    category: 'monitoring',
    tags: ['meraki', 'bandwidth', 'alerts'],
    code: `# Bandwidth Usage Monitor
# Alerts when bandwidth usage exceeds threshold

# Set threshold (percentage)
set threshold = 85

# Get bandwidth usage stats
meraki get-network-traffic --network \${network_id} --timespan 3600

# Check if usage exceeds threshold
if \${result.total_usage_percent} > \${threshold} then
  # Alert network team
  notify slack --channel "#network-ops" --message "HIGH BANDWIDTH: Usage at \${result.total_usage_percent}%"

  # Get top consumers for detail
  meraki get-clients --network \${network_id} --timespan 3600

  # Send detailed report
  notify email --to "network-team@company.com" --subject "Bandwidth Alert" --body "Top consumers: \${result}"
end
`,
  },
  {
    id: 'client-count-monitor',
    name: 'Client Count Monitor',
    description: 'Monitor client connections and alert on unusual activity',
    category: 'monitoring',
    tags: ['meraki', 'clients', 'security'],
    code: `# Client Count Monitor
# Tracks client connections and alerts on anomalies

# Set thresholds
set max_clients = 500
set min_expected = 50

# Get current client count
meraki get-clients --network \${network_id} --timespan 300

# Store count
set current_count = \${result.length}

# Check for too many clients (potential attack)
if \${current_count} > \${max_clients} then
  notify slack --channel "#security-alerts" --message "WARNING: Unusual client count: \${current_count}"
  notify pagerduty --service "network-security" --message "High client count detected"
end

# Check for too few clients (potential outage)
if \${current_count} < \${min_expected} then
  notify slack --channel "#network-ops" --message "WARNING: Low client count: \${current_count} (expected > \${min_expected})"
end

# Log the check
splunk log --index "client_monitoring" --event "client_count=\${current_count}"
`,
  },

  // ---------------------------------------------------------------------------
  // Automation Templates
  // ---------------------------------------------------------------------------
  {
    id: 'device-provisioning',
    name: 'New Device Provisioning',
    description: 'Automatically configure new devices with standard settings',
    category: 'automation',
    tags: ['meraki', 'provisioning', 'automation'],
    code: `# New Device Provisioning
# Configures new devices with standard settings

# Get device info from trigger
set serial = \${trigger.serial}
set device_type = \${trigger.device_type}

# Get device details
meraki get-device --serial \${serial}

# Generate device name based on type
if \${device_type} == "MR" then
  set name_prefix = "AP"
  set tags = "access-point,auto-provisioned"
end

if \${device_type} == "MS" then
  set name_prefix = "SW"
  set tags = "switch,auto-provisioned"
end

if \${device_type} == "MX" then
  set name_prefix = "FW"
  set tags = "firewall,auto-provisioned"
end

# Update device with standard config
meraki update-device --serial \${serial} --name "\${name_prefix}-\${serial}" --tags "\${tags}"

# Wait for config to apply
wait 30s

# Verify device is online
meraki get-device --serial \${serial}

if \${result.status} == "online" then
  notify slack --channel "#network-ops" --message "Device \${serial} provisioned successfully"
else
  notify slack --channel "#network-alerts" --message "Device \${serial} provisioning may have failed - status: \${result.status}"
end
`,
  },
  {
    id: 'bulk-tag-update',
    name: 'Bulk Device Tag Update',
    description: 'Update tags on multiple devices matching criteria',
    category: 'automation',
    tags: ['meraki', 'bulk', 'tags'],
    code: `# Bulk Device Tag Update
# Updates tags on devices matching specified criteria

# Set the filter criteria and new tags
set model_filter = "MR"
set new_tag = "upgraded-firmware"

# Get all devices
meraki get-devices --network \${network_id}

# Track count
set updated_count = 0

# Loop through devices
loop devices as device
  # Check if device matches filter
  if \${device.model} contains \${model_filter} then
    # Update device tags
    meraki update-device --serial \${device.serial} --tags "\${device.tags},\${new_tag}"
    set updated_count = \${updated_count} + 1
  end
end

# Log results
notify slack --channel "#network-ops" --message "Bulk tag update complete: \${updated_count} devices updated"
`,
  },
  {
    id: 'scheduled-reboot',
    name: 'Scheduled Device Reboot',
    description: 'Reboot devices on a schedule during maintenance window',
    category: 'automation',
    tags: ['meraki', 'reboot', 'maintenance'],
    code: `# Scheduled Device Reboot
# Reboots devices during maintenance window

# Get devices with maintenance tag
meraki get-devices --network \${network_id}

# Filter for devices needing reboot
loop devices as device
  if \${device.tags} contains "needs-reboot" then
    # Log before reboot
    notify slack --channel "#maintenance" --message "Rebooting \${device.name} (\${device.serial})"

    # Reboot the device
    meraki reboot-device --serial \${device.serial}

    # Wait before next reboot (stagger them)
    wait 60s

    # Remove the needs-reboot tag
    meraki update-device --serial \${device.serial} --tags "\${device.tags}" --remove-tag "needs-reboot"
  end
end

notify slack --channel "#maintenance" --message "Scheduled reboot cycle complete"
`,
  },

  // ---------------------------------------------------------------------------
  // Security Templates
  // ---------------------------------------------------------------------------
  {
    id: 'security-event-response',
    name: 'Security Event Response',
    description: 'Automatically respond to security alerts',
    category: 'security',
    tags: ['security', 'meraki', 'automation'],
    code: `# Security Event Response
# Responds to security threats automatically

# Get event details from trigger
set threat_type = \${trigger.threat_type}
set client_mac = \${trigger.client_mac}
set severity = \${trigger.severity}

# Log the event
splunk log --index "security_events" --event "threat=\${threat_type},client=\${client_mac},severity=\${severity}"

# Check severity level
if \${severity} == "critical" then
  # Immediately quarantine the client
  meraki update-client-policy --network \${network_id} --client \${client_mac} --policy "Blocked"

  # Send urgent alert
  notify pagerduty --service "security-critical" --message "Critical threat: \${threat_type} from \${client_mac}"
  notify slack --channel "#security-critical" --message "CRITICAL: Client \${client_mac} quarantined - \${threat_type}"
end

if \${severity} == "high" then
  # Alert security team for investigation
  notify slack --channel "#security-ops" --message "HIGH: Security event - \${threat_type} from \${client_mac}"

  # Get more context about the client
  meraki get-client --network \${network_id} --client \${client_mac}

  # Log additional context
  splunk log --index "security_context" --event "client_details=\${result}"
end

if \${severity} == "medium" then
  # Log for review
  notify slack --channel "#security-logs" --message "Medium security event: \${threat_type}"
end
`,
  },
  {
    id: 'compliance-audit',
    name: 'Compliance Audit Check',
    description: 'Verify network configuration against compliance requirements',
    category: 'security',
    tags: ['compliance', 'audit', 'security'],
    code: `# Compliance Audit Check
# Verifies configurations against security policies

# Initialize counters
set violations = 0
set checks = 0

# Check firewall rules
meraki get-firewall-rules --network \${network_id}
set checks = \${checks} + 1

# Verify no "allow any" rules exist
loop rules as rule
  if \${rule.policy} == "allow" then
    if \${rule.srcPort} == "any" then
      if \${rule.destPort} == "any" then
        set violations = \${violations} + 1
        notify slack --channel "#compliance" --message "VIOLATION: Overly permissive firewall rule found"
      end
    end
  end
end

# Check SSID configurations
meraki get-ssids --network \${network_id}
set checks = \${checks} + 1

loop ssids as ssid
  # Check for open networks
  if \${ssid.authMode} == "open" then
    if \${ssid.enabled} == true then
      set violations = \${violations} + 1
      notify slack --channel "#compliance" --message "VIOLATION: Open SSID '\${ssid.name}' is enabled"
    end
  end
end

# Generate report
if \${violations} > 0 then
  notify email --to "compliance@company.com" --subject "Compliance Audit: \${violations} violations found" --body "Completed \${checks} checks with \${violations} violations"
else
  notify slack --channel "#compliance" --message "Compliance audit passed: \${checks} checks, 0 violations"
end
`,
  },

  // ---------------------------------------------------------------------------
  // Operations Templates
  // ---------------------------------------------------------------------------
  {
    id: 'config-backup',
    name: 'Configuration Backup',
    description: 'Backup device configurations to external storage',
    category: 'operations',
    tags: ['backup', 'config', 'operations'],
    code: `# Configuration Backup
# Backs up all device configurations

# Get all devices
meraki get-devices --network \${network_id}

# Track backup status
set success_count = 0
set fail_count = 0

loop devices as device
  # Backup each device config
  meraki backup-device-config --serial \${device.serial}

  if \${result.success} == true then
    set success_count = \${success_count} + 1
  else
    set fail_count = \${fail_count} + 1
    notify slack --channel "#network-ops" --message "Backup failed for \${device.name}"
  end
end

# Send summary
notify slack --channel "#backups" --message "Backup complete: \${success_count} succeeded, \${fail_count} failed"

# Log to Splunk for audit
splunk log --index "backup_logs" --event "backup_run,success=\${success_count},failed=\${fail_count}"
`,
  },
  {
    id: 'firmware-check',
    name: 'Firmware Version Check',
    description: 'Check and report on firmware versions across devices',
    category: 'operations',
    tags: ['firmware', 'audit', 'operations'],
    code: `# Firmware Version Check
# Reports on firmware versions and identifies outdated devices

# Set the target firmware versions
set target_mr = "MR 29.6"
set target_ms = "MS 15.21"
set target_mx = "MX 18.107"

# Get all devices
meraki get-devices --network \${network_id}

# Track outdated devices
set outdated_count = 0

loop devices as device
  # Check firmware based on model
  if \${device.model} contains "MR" then
    if \${device.firmware} != \${target_mr} then
      set outdated_count = \${outdated_count} + 1
      notify slack --channel "#firmware" --message "\${device.name}: Current \${device.firmware}, Target \${target_mr}"
    end
  end

  if \${device.model} contains "MS" then
    if \${device.firmware} != \${target_ms} then
      set outdated_count = \${outdated_count} + 1
    end
  end

  if \${device.model} contains "MX" then
    if \${device.firmware} != \${target_mx} then
      set outdated_count = \${outdated_count} + 1
    end
  end
end

# Send summary
if \${outdated_count} > 0 then
  notify email --to "network-ops@company.com" --subject "Firmware Report: \${outdated_count} devices need updates" --body "See #firmware channel for details"
else
  notify slack --channel "#firmware" --message "All devices running target firmware versions"
end
`,
  },

  // ---------------------------------------------------------------------------
  // Integration Templates
  // ---------------------------------------------------------------------------
  {
    id: 'splunk-integration',
    name: 'Splunk Alert Handler',
    description: 'Process Splunk alerts and take network actions',
    category: 'integration',
    tags: ['splunk', 'integration', 'automation'],
    code: `# Splunk Alert Handler
# Processes incoming Splunk alerts and takes actions

# Get alert details from trigger
set alert_name = \${trigger.alert_name}
set severity = \${trigger.severity}
set results = \${trigger.results}

# Route based on alert type
if \${alert_name} contains "network" then
  # Network-related alert - gather Meraki context
  meraki get-network-health --network \${network_id}

  # Enrich Splunk event with network data
  splunk log --index "enriched_alerts" --event "alert=\${alert_name},network_health=\${result.score}"
end

if \${alert_name} contains "security" then
  # Security alert - check for affected clients
  if \${trigger.client_mac} != "" then
    meraki get-client --network \${network_id} --client \${trigger.client_mac}

    # Log client context
    splunk log --index "security_context" --event "alert=\${alert_name},client=\${result}"
  end
end

# Route notifications based on severity
if \${severity} == "critical" then
  notify pagerduty --service "splunk-alerts" --message "\${alert_name}: \${results}"
end

if \${severity} == "high" then
  notify slack --channel "#high-priority" --message "Splunk Alert: \${alert_name}"
end

notify slack --channel "#splunk-alerts" --message "[\${severity}] \${alert_name}"
`,
  },
  {
    id: 'webhook-dispatcher',
    name: 'Webhook Event Dispatcher',
    description: 'Dispatch network events to external systems',
    category: 'integration',
    tags: ['webhook', 'integration', 'api'],
    code: `# Webhook Event Dispatcher
# Sends network events to external systems

# Collect network data
meraki get-network-health --network \${network_id}
set health = \${result}

meraki get-devices --network \${network_id}
set devices = \${result}

meraki get-clients --network \${network_id} --timespan 3600
set clients = \${result}

# Build payload
set payload = {
  "timestamp": "\${now}",
  "network_id": "\${network_id}",
  "health_score": \${health.score},
  "device_count": \${devices.length},
  "client_count": \${clients.length}
}

# Send to primary webhook
notify webhook --url "\${primary_webhook_url}" --method POST --body "\${payload}"

# Check if we need to send to secondary
if \${health.score} < 80 then
  # Alert webhook for degraded health
  notify webhook --url "\${alert_webhook_url}" --method POST --body "\${payload}"
end

# Log the dispatch
splunk log --index "webhook_logs" --event "dispatched,health=\${health.score}"
`,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getTemplateById(id: string): CLITemplate | undefined {
  return CLI_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: CLITemplate['category']): CLITemplate[] {
  return CLI_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByTag(tag: string): CLITemplate[] {
  return CLI_TEMPLATES.filter((t) => t.tags.includes(tag));
}

export function searchTemplates(query: string): CLITemplate[] {
  const lower = query.toLowerCase();
  return CLI_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.description.toLowerCase().includes(lower) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}

export default CLI_TEMPLATES;
