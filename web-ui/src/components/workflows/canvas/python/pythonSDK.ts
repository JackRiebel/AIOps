/**
 * Python Workflow SDK Definition
 *
 * Defines the Python API available to workflow scripts.
 * These stubs are shown in the editor and used for autocomplete.
 */

// ============================================================================
// SDK Module Definitions
// ============================================================================

export interface SDKMethod {
  name: string;
  signature: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    description: string;
    optional?: boolean;
    default?: string;
  }>;
  returns: {
    type: string;
    description: string;
  };
  example: string;
  isAsync: boolean;
}

export interface SDKModule {
  name: string;
  description: string;
  methods: SDKMethod[];
}

// ============================================================================
// Meraki SDK
// ============================================================================

export const MERAKI_SDK: SDKModule = {
  name: 'meraki',
  description: 'Meraki Dashboard API client for network operations',
  methods: [
    {
      name: 'get_organizations',
      signature: 'async get_organizations() -> List[Organization]',
      description: 'List all organizations the API key has access to',
      params: [],
      returns: { type: 'List[Organization]', description: 'List of organization objects' },
      example: 'orgs = await meraki.get_organizations()',
      isAsync: true,
    },
    {
      name: 'get_networks',
      signature: 'async get_networks(org_id: str) -> List[Network]',
      description: 'List all networks in an organization',
      params: [
        { name: 'org_id', type: 'str', description: 'Organization ID' },
      ],
      returns: { type: 'List[Network]', description: 'List of network objects' },
      example: 'networks = await meraki.get_networks(org_id)',
      isAsync: true,
    },
    {
      name: 'get_devices',
      signature: 'async get_devices(network_id: str) -> List[Device]',
      description: 'List all devices in a network',
      params: [
        { name: 'network_id', type: 'str', description: 'Network ID' },
      ],
      returns: { type: 'List[Device]', description: 'List of device objects' },
      example: 'devices = await meraki.get_devices(network_id)',
      isAsync: true,
    },
    {
      name: 'get_device',
      signature: 'async get_device(serial: str) -> Device',
      description: 'Get details for a specific device',
      params: [
        { name: 'serial', type: 'str', description: 'Device serial number' },
      ],
      returns: { type: 'Device', description: 'Device object with full details' },
      example: 'device = await meraki.get_device("Q2XX-XXXX-XXXX")',
      isAsync: true,
    },
    {
      name: 'update_device',
      signature: 'async update_device(serial: str, **kwargs) -> Device',
      description: 'Update device settings',
      params: [
        { name: 'serial', type: 'str', description: 'Device serial number' },
        { name: 'name', type: 'str', description: 'Device name', optional: true },
        { name: 'tags', type: 'List[str]', description: 'Device tags', optional: true },
        { name: 'address', type: 'str', description: 'Physical address', optional: true },
      ],
      returns: { type: 'Device', description: 'Updated device object' },
      example: 'await meraki.update_device(serial, name="New Name", tags=["production"])',
      isAsync: true,
    },
    {
      name: 'get_clients',
      signature: 'async get_clients(network_id: str, timespan: int = 86400) -> List[Client]',
      description: 'List clients that have connected to the network',
      params: [
        { name: 'network_id', type: 'str', description: 'Network ID' },
        { name: 'timespan', type: 'int', description: 'Timespan in seconds', optional: true, default: '86400' },
      ],
      returns: { type: 'List[Client]', description: 'List of client objects' },
      example: 'clients = await meraki.get_clients(network_id, timespan=3600)',
      isAsync: true,
    },
    {
      name: 'get_network_health',
      signature: 'async get_network_health(network_id: str) -> HealthScore',
      description: 'Get overall network health score',
      params: [
        { name: 'network_id', type: 'str', description: 'Network ID' },
      ],
      returns: { type: 'HealthScore', description: 'Health score object with breakdown' },
      example: 'health = await meraki.get_network_health(network_id)',
      isAsync: true,
    },
    {
      name: 'reboot_device',
      signature: 'async reboot_device(serial: str) -> bool',
      description: 'Reboot a device (requires approval for production)',
      params: [
        { name: 'serial', type: 'str', description: 'Device serial number' },
      ],
      returns: { type: 'bool', description: 'True if reboot initiated successfully' },
      example: 'await meraki.reboot_device(serial)',
      isAsync: true,
    },
    {
      name: 'quarantine_client',
      signature: 'async quarantine_client(network_id: str, mac: str) -> bool',
      description: 'Add a client to the quarantine list',
      params: [
        { name: 'network_id', type: 'str', description: 'Network ID' },
        { name: 'mac', type: 'str', description: 'Client MAC address' },
      ],
      returns: { type: 'bool', description: 'True if client quarantined' },
      example: 'await meraki.quarantine_client(network_id, "AA:BB:CC:DD:EE:FF")',
      isAsync: true,
    },
  ],
};

// ============================================================================
// Splunk SDK
// ============================================================================

export const SPLUNK_SDK: SDKModule = {
  name: 'splunk',
  description: 'Splunk search and alerting client',
  methods: [
    {
      name: 'search',
      signature: 'async search(query: str, earliest: str = "-24h", latest: str = "now") -> SearchResults',
      description: 'Execute a Splunk search query',
      params: [
        { name: 'query', type: 'str', description: 'SPL search query' },
        { name: 'earliest', type: 'str', description: 'Start time', optional: true, default: '"-24h"' },
        { name: 'latest', type: 'str', description: 'End time', optional: true, default: '"now"' },
      ],
      returns: { type: 'SearchResults', description: 'Search results with events' },
      example: 'results = await splunk.search("index=main | stats count by host")',
      isAsync: true,
    },
    {
      name: 'get_alerts',
      signature: 'async get_alerts(search_name: str = None) -> List[Alert]',
      description: 'Get triggered alerts',
      params: [
        { name: 'search_name', type: 'str', description: 'Filter by saved search name', optional: true },
      ],
      returns: { type: 'List[Alert]', description: 'List of triggered alerts' },
      example: 'alerts = await splunk.get_alerts("Security Alerts")',
      isAsync: true,
    },
    {
      name: 'create_event',
      signature: 'async create_event(index: str, event: dict, sourcetype: str = "json") -> bool',
      description: 'Send an event to Splunk',
      params: [
        { name: 'index', type: 'str', description: 'Target index' },
        { name: 'event', type: 'dict', description: 'Event data' },
        { name: 'sourcetype', type: 'str', description: 'Source type', optional: true, default: '"json"' },
      ],
      returns: { type: 'bool', description: 'True if event created' },
      example: 'await splunk.create_event("main", {"action": "workflow_run"})',
      isAsync: true,
    },
  ],
};

// ============================================================================
// ThousandEyes SDK
// ============================================================================

export const THOUSANDEYES_SDK: SDKModule = {
  name: 'thousandeyes',
  description: 'ThousandEyes monitoring and testing client',
  methods: [
    {
      name: 'get_tests',
      signature: 'async get_tests() -> List[Test]',
      description: 'List all configured tests',
      params: [],
      returns: { type: 'List[Test]', description: 'List of test configurations' },
      example: 'tests = await thousandeyes.get_tests()',
      isAsync: true,
    },
    {
      name: 'get_test_results',
      signature: 'async get_test_results(test_id: str, window: str = "1h") -> TestResults',
      description: 'Get results for a specific test',
      params: [
        { name: 'test_id', type: 'str', description: 'Test ID' },
        { name: 'window', type: 'str', description: 'Time window', optional: true, default: '"1h"' },
      ],
      returns: { type: 'TestResults', description: 'Test results with metrics' },
      example: 'results = await thousandeyes.get_test_results(test_id)',
      isAsync: true,
    },
    {
      name: 'run_instant_test',
      signature: 'async run_instant_test(test_id: str) -> TestResults',
      description: 'Run an instant test and wait for results',
      params: [
        { name: 'test_id', type: 'str', description: 'Test ID to run' },
      ],
      returns: { type: 'TestResults', description: 'Instant test results' },
      example: 'results = await thousandeyes.run_instant_test(test_id)',
      isAsync: true,
    },
    {
      name: 'get_agents',
      signature: 'async get_agents() -> List[Agent]',
      description: 'List available test agents',
      params: [],
      returns: { type: 'List[Agent]', description: 'List of agents' },
      example: 'agents = await thousandeyes.get_agents()',
      isAsync: true,
    },
  ],
};

// ============================================================================
// Notify SDK
// ============================================================================

export const NOTIFY_SDK: SDKModule = {
  name: 'notify',
  description: 'Notification service for alerts and messages',
  methods: [
    {
      name: 'slack',
      signature: 'async slack(channel: str, message: str, **kwargs) -> bool',
      description: 'Send a Slack message',
      params: [
        { name: 'channel', type: 'str', description: 'Slack channel (e.g., "#alerts")' },
        { name: 'message', type: 'str', description: 'Message text' },
        { name: 'blocks', type: 'List[dict]', description: 'Slack blocks for rich formatting', optional: true },
      ],
      returns: { type: 'bool', description: 'True if sent successfully' },
      example: 'await notify.slack("#alerts", "Network issue detected")',
      isAsync: true,
    },
    {
      name: 'email',
      signature: 'async email(to: str, subject: str, body: str, html: bool = False) -> bool',
      description: 'Send an email notification',
      params: [
        { name: 'to', type: 'str', description: 'Recipient email address' },
        { name: 'subject', type: 'str', description: 'Email subject' },
        { name: 'body', type: 'str', description: 'Email body' },
        { name: 'html', type: 'bool', description: 'Send as HTML', optional: true, default: 'False' },
      ],
      returns: { type: 'bool', description: 'True if sent successfully' },
      example: 'await notify.email("admin@example.com", "Alert", "Check the network")',
      isAsync: true,
    },
    {
      name: 'teams',
      signature: 'async teams(channel: str, message: str, **kwargs) -> bool',
      description: 'Send a Microsoft Teams message',
      params: [
        { name: 'channel', type: 'str', description: 'Teams channel or webhook URL' },
        { name: 'message', type: 'str', description: 'Message text' },
      ],
      returns: { type: 'bool', description: 'True if sent successfully' },
      example: 'await notify.teams("ops-channel", "Deployment complete")',
      isAsync: true,
    },
    {
      name: 'pagerduty',
      signature: 'async pagerduty(service: str, severity: str, message: str) -> str',
      description: 'Create a PagerDuty incident',
      params: [
        { name: 'service', type: 'str', description: 'Service name or ID' },
        { name: 'severity', type: 'str', description: 'Severity: critical, error, warning, info' },
        { name: 'message', type: 'str', description: 'Incident description' },
      ],
      returns: { type: 'str', description: 'Incident ID' },
      example: 'incident_id = await notify.pagerduty("network", "critical", "Major outage")',
      isAsync: true,
    },
    {
      name: 'webhook',
      signature: 'async webhook(url: str, data: dict, method: str = "POST") -> dict',
      description: 'Call a webhook URL',
      params: [
        { name: 'url', type: 'str', description: 'Webhook URL' },
        { name: 'data', type: 'dict', description: 'Request body data' },
        { name: 'method', type: 'str', description: 'HTTP method', optional: true, default: '"POST"' },
      ],
      returns: { type: 'dict', description: 'Response data' },
      example: 'response = await notify.webhook("https://api.example.com/hook", {"event": "alert"})',
      isAsync: true,
    },
  ],
};

// ============================================================================
// AI SDK
// ============================================================================

export const AI_SDK: SDKModule = {
  name: 'ai',
  description: 'AI-powered analysis and decision making',
  methods: [
    {
      name: 'analyze',
      signature: 'async analyze(prompt: str, context: Any = None) -> AnalysisResult',
      description: 'Analyze data using AI',
      params: [
        { name: 'prompt', type: 'str', description: 'Analysis prompt' },
        { name: 'context', type: 'Any', description: 'Additional context data', optional: true },
      ],
      returns: { type: 'AnalysisResult', description: 'Analysis result with insights' },
      example: 'result = await ai.analyze("What is causing the latency?", network_data)',
      isAsync: true,
    },
    {
      name: 'decide',
      signature: 'async decide(question: str, options: List[str], context: Any = None) -> Decision',
      description: 'Make an AI-powered decision',
      params: [
        { name: 'question', type: 'str', description: 'Decision question' },
        { name: 'options', type: 'List[str]', description: 'Available options' },
        { name: 'context', type: 'Any', description: 'Context data', optional: true },
      ],
      returns: { type: 'Decision', description: 'Decision with reasoning' },
      example: 'decision = await ai.decide("Should we scale?", ["yes", "no", "wait"], metrics)',
      isAsync: true,
    },
    {
      name: 'summarize',
      signature: 'async summarize(data: Any, format: str = "text") -> str',
      description: 'Generate a summary of data',
      params: [
        { name: 'data', type: 'Any', description: 'Data to summarize' },
        { name: 'format', type: 'str', description: 'Output format: text, markdown, json', optional: true, default: '"text"' },
      ],
      returns: { type: 'str', description: 'Summary text' },
      example: 'summary = await ai.summarize(events, format="markdown")',
      isAsync: true,
    },
  ],
};

// ============================================================================
// Logger SDK
// ============================================================================

export const LOGGER_SDK: SDKModule = {
  name: 'logger',
  description: 'Workflow execution logging',
  methods: [
    {
      name: 'info',
      signature: 'info(message: str, **kwargs) -> None',
      description: 'Log an info message',
      params: [
        { name: 'message', type: 'str', description: 'Log message' },
      ],
      returns: { type: 'None', description: '' },
      example: 'logger.info("Processing started")',
      isAsync: false,
    },
    {
      name: 'warning',
      signature: 'warning(message: str, **kwargs) -> None',
      description: 'Log a warning message',
      params: [
        { name: 'message', type: 'str', description: 'Warning message' },
      ],
      returns: { type: 'None', description: '' },
      example: 'logger.warning("High memory usage detected")',
      isAsync: false,
    },
    {
      name: 'error',
      signature: 'error(message: str, **kwargs) -> None',
      description: 'Log an error message',
      params: [
        { name: 'message', type: 'str', description: 'Error message' },
      ],
      returns: { type: 'None', description: '' },
      example: 'logger.error("Failed to connect to API")',
      isAsync: false,
    },
    {
      name: 'debug',
      signature: 'debug(message: str, **kwargs) -> None',
      description: 'Log a debug message',
      params: [
        { name: 'message', type: 'str', description: 'Debug message' },
      ],
      returns: { type: 'None', description: '' },
      example: 'logger.debug(f"Device count: {len(devices)}")',
      isAsync: false,
    },
  ],
};

// ============================================================================
// Context SDK
// ============================================================================

export const CONTEXT_SDK: SDKModule = {
  name: 'context',
  description: 'Workflow execution context and variables',
  methods: [
    {
      name: 'get',
      signature: 'get(key: str, default: Any = None) -> Any',
      description: 'Get a context variable',
      params: [
        { name: 'key', type: 'str', description: 'Variable name' },
        { name: 'default', type: 'Any', description: 'Default value', optional: true },
      ],
      returns: { type: 'Any', description: 'Variable value' },
      example: 'network_id = context.get("network_id")',
      isAsync: false,
    },
    {
      name: 'set',
      signature: 'set(key: str, value: Any) -> None',
      description: 'Set a context variable',
      params: [
        { name: 'key', type: 'str', description: 'Variable name' },
        { name: 'value', type: 'Any', description: 'Variable value' },
      ],
      returns: { type: 'None', description: '' },
      example: 'context.set("processed_count", 10)',
      isAsync: false,
    },
    {
      name: 'trigger_data',
      signature: 'trigger_data -> dict',
      description: 'Data from the workflow trigger (property)',
      params: [],
      returns: { type: 'dict', description: 'Trigger payload data' },
      example: 'alert = context.trigger_data["alert"]',
      isAsync: false,
    },
    {
      name: 'workflow_id',
      signature: 'workflow_id -> str',
      description: 'Current workflow execution ID (property)',
      params: [],
      returns: { type: 'str', description: 'Workflow execution ID' },
      example: 'logger.info(f"Workflow: {context.workflow_id}")',
      isAsync: false,
    },
  ],
};

// ============================================================================
// All SDK Modules
// ============================================================================

export const ALL_SDK_MODULES: SDKModule[] = [
  MERAKI_SDK,
  SPLUNK_SDK,
  THOUSANDEYES_SDK,
  NOTIFY_SDK,
  AI_SDK,
  LOGGER_SDK,
  CONTEXT_SDK,
];

// ============================================================================
// Python Import Header
// ============================================================================

export const PYTHON_IMPORTS = `# Auto-imported modules (do not modify)
from lumen.sdk import meraki, splunk, thousandeyes, notify, ai, logger, context
from typing import List, Dict, Any, Optional
`;

export const PYTHON_FUNCTION_TEMPLATE = `
async def workflow(context):
    """
    Main workflow function.

    Args:
        context: Workflow context with trigger data and variables

    Returns:
        dict: Result data to pass to subsequent nodes
    """
    # Your workflow code here

    return {"status": "success"}
`;

export const FULL_PYTHON_TEMPLATE = PYTHON_IMPORTS + PYTHON_FUNCTION_TEMPLATE;
