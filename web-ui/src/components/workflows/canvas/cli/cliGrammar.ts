/**
 * CLI Workflow Grammar Definition
 *
 * Defines the syntax and tokens for the CLI workflow language.
 * Used by Monaco editor for syntax highlighting and the parser for validation.
 */

// ============================================================================
// Token Types
// ============================================================================

export type CLITokenType =
  | 'comment'
  | 'keyword'
  | 'command'
  | 'subcommand'
  | 'flag'
  | 'string'
  | 'number'
  | 'variable'
  | 'operator'
  | 'identifier'
  | 'whitespace'
  | 'newline'
  | 'error';

export interface CLIToken {
  type: CLITokenType;
  value: string;
  line: number;
  column: number;
  length: number;
}

// ============================================================================
// Keywords and Commands
// ============================================================================

export const CLI_KEYWORDS = [
  'if', 'then', 'else', 'end', 'elif',
  'loop', 'as', 'in',
  'wait', 'set', 'return',
  'true', 'false', 'null',
  'and', 'or', 'not',
] as const;

export type CLIKeyword = typeof CLI_KEYWORDS[number];

// Platform commands
export const CLI_COMMANDS = {
  meraki: {
    description: 'Meraki Dashboard API operations',
    subcommands: [
      { name: 'get-organizations', description: 'List all organizations', params: [] },
      { name: 'get-networks', description: 'List networks in an organization', params: ['--org'] },
      { name: 'get-devices', description: 'List devices in a network', params: ['--network'] },
      { name: 'get-device', description: 'Get device details', params: ['--serial'] },
      { name: 'update-device', description: 'Update device settings', params: ['--serial', '--name', '--tags'] },
      { name: 'get-clients', description: 'List clients in a network', params: ['--network', '--timespan'] },
      { name: 'get-health', description: 'Get network health score', params: ['--network'] },
      { name: 'get-alerts', description: 'Get network alerts', params: ['--network'] },
      { name: 'quarantine-client', description: 'Quarantine a client MAC', params: ['--network', '--mac'] },
      { name: 'unquarantine-client', description: 'Remove client from quarantine', params: ['--network', '--mac'] },
      { name: 'blink-led', description: 'Blink device LEDs', params: ['--serial', '--duration'] },
      { name: 'reboot-device', description: 'Reboot a device', params: ['--serial'] },
      { name: 'get-uplinks', description: 'Get uplink status', params: ['--network'] },
      { name: 'get-vpn-status', description: 'Get VPN tunnel status', params: ['--network'] },
      { name: 'get-traffic', description: 'Get traffic analysis', params: ['--network', '--timespan'] },
    ],
  },
  splunk: {
    description: 'Splunk search and alerting',
    subcommands: [
      { name: 'search', description: 'Execute a Splunk search', params: ['--query', '--earliest', '--latest'] },
      { name: 'get-alerts', description: 'Get triggered alerts', params: ['--search-name'] },
      { name: 'create-alert', description: 'Create a new alert', params: ['--name', '--query', '--threshold'] },
    ],
  },
  thousandeyes: {
    description: 'ThousandEyes monitoring operations',
    subcommands: [
      { name: 'get-tests', description: 'List all tests', params: [] },
      { name: 'get-results', description: 'Get test results', params: ['--test-id', '--window'] },
      { name: 'get-agents', description: 'List available agents', params: [] },
      { name: 'create-test', description: 'Create a new test', params: ['--type', '--target', '--interval'] },
      { name: 'run-instant', description: 'Run an instant test', params: ['--test-id'] },
    ],
  },
  catalyst: {
    description: 'Cisco Catalyst Center operations',
    subcommands: [
      { name: 'get-devices', description: 'List managed devices', params: [] },
      { name: 'get-device', description: 'Get device details', params: ['--id'] },
      { name: 'get-health', description: 'Get network health', params: [] },
      { name: 'get-issues', description: 'Get active issues', params: ['--priority'] },
      { name: 'run-command', description: 'Run CLI command on device', params: ['--device-id', '--command'] },
    ],
  },
  notify: {
    description: 'Send notifications',
    subcommands: [
      { name: 'slack', description: 'Send Slack message', params: ['--channel', '--message'] },
      { name: 'email', description: 'Send email', params: ['--to', '--subject', '--body'] },
      { name: 'teams', description: 'Send Teams message', params: ['--channel', '--message'] },
      { name: 'webhook', description: 'Call webhook URL', params: ['--url', '--method', '--body'] },
      { name: 'pagerduty', description: 'Create PagerDuty incident', params: ['--service', '--severity', '--message'] },
    ],
  },
  ai: {
    description: 'AI-powered analysis',
    subcommands: [
      { name: 'analyze', description: 'Analyze data with AI', params: ['--prompt', '--context'] },
      { name: 'decide', description: 'Make AI-powered decision', params: ['--question', '--options'] },
      { name: 'summarize', description: 'Summarize data', params: ['--data', '--format'] },
    ],
  },
} as const;

export type CLIPlatform = keyof typeof CLI_COMMANDS;

// ============================================================================
// Operators
// ============================================================================

export const CLI_OPERATORS = [
  '==', '!=', '>', '<', '>=', '<=',
  '&&', '||', '!',
  '=', '|', '->',
] as const;

export type CLIOperator = typeof CLI_OPERATORS[number];

// ============================================================================
// Monaco Language Configuration
// ============================================================================

export const CLI_LANGUAGE_ID = 'lumen-cli';

export const CLI_LANGUAGE_CONFIG = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '${', close: '}' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: /^\s*(if|loop)\b/,
      end: /^\s*end\b/,
    },
  },
};

// Monaco tokenizer rules
export const CLI_MONARCH_TOKENS = {
  defaultToken: '',
  tokenPostfix: '.lumen-cli',

  keywords: CLI_KEYWORDS,
  commands: Object.keys(CLI_COMMANDS),

  operators: CLI_OPERATORS,

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // Variables ${...}
      [/\$\{[^}]+\}/, 'variable'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // Numbers
      [/\d+(\.\d+)?/, 'number'],

      // Keywords and commands
      [/[a-zA-Z_][\w-]*/, {
        cases: {
          '@keywords': 'keyword',
          '@commands': 'type.identifier',
          '@default': 'identifier',
        },
      }],

      // Flags
      [/--[a-zA-Z][\w-]*/, 'attribute.name'],
      [/-[a-zA-Z]/, 'attribute.name'],

      // Operators
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': '',
        },
      }],

      // Whitespace
      [/[ \t\r\n]+/, 'white'],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],
  },
};

// ============================================================================
// Theme Configuration
// ============================================================================

export const CLI_THEME_RULES = [
  { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'C586C0' },
  { token: 'type.identifier', foreground: '4EC9B0', fontStyle: 'bold' }, // Commands
  { token: 'identifier', foreground: '9CDCFE' },
  { token: 'variable', foreground: 'DCDCAA' },
  { token: 'string', foreground: 'CE9178' },
  { token: 'number', foreground: 'B5CEA8' },
  { token: 'operator', foreground: 'D4D4D4' },
  { token: 'attribute.name', foreground: '9CDCFE', fontStyle: 'italic' }, // Flags
  { token: 'string.invalid', foreground: 'F44747' },
  { token: 'string.escape', foreground: 'D7BA7D' },
];

// ============================================================================
// Completion Items
// ============================================================================

export interface CLICompletionItem {
  label: string;
  kind: 'keyword' | 'command' | 'subcommand' | 'flag' | 'variable' | 'snippet';
  detail?: string;
  documentation?: string;
  insertText: string;
  insertTextRules?: number; // InsertTextRule.InsertAsSnippet
}

export function getCompletionItems(context: {
  lineContent: string;
  wordBefore: string;
}): CLICompletionItem[] {
  const items: CLICompletionItem[] = [];
  const { lineContent, wordBefore } = context;

  // Check if we're after a platform command
  const platformMatch = lineContent.match(/^\s*(\w+)\s+/);
  if (platformMatch) {
    const platform = platformMatch[1] as CLIPlatform;
    if (CLI_COMMANDS[platform]) {
      // Suggest subcommands
      CLI_COMMANDS[platform].subcommands.forEach(sub => {
        items.push({
          label: sub.name,
          kind: 'subcommand',
          detail: sub.description,
          documentation: `Parameters: ${sub.params.join(', ') || 'none'}`,
          insertText: sub.name,
        });
      });

      // Check if subcommand is present, suggest flags
      const subMatch = lineContent.match(/^\s*\w+\s+([\w-]+)/);
      if (subMatch) {
        const subcommand = CLI_COMMANDS[platform].subcommands.find(
          s => s.name === subMatch[1]
        );
        if (subcommand) {
          subcommand.params.forEach(param => {
            items.push({
              label: param,
              kind: 'flag',
              detail: `Flag for ${subcommand.name}`,
              insertText: `${param} `,
            });
          });
        }
      }
      return items;
    }
  }

  // Suggest platform commands at the start of a line
  if (lineContent.trim() === '' || lineContent.trim() === wordBefore) {
    Object.entries(CLI_COMMANDS).forEach(([platform, config]) => {
      items.push({
        label: platform,
        kind: 'command',
        detail: config.description,
        insertText: platform + ' ',
      });
    });

    // Add keywords
    CLI_KEYWORDS.forEach(keyword => {
      items.push({
        label: keyword,
        kind: 'keyword',
        insertText: keyword + ' ',
      });
    });

    // Add common snippets
    items.push({
      label: 'if-then-end',
      kind: 'snippet',
      detail: 'Conditional block',
      insertText: 'if ${1:condition} then\n  ${2:# actions}\nend',
      insertTextRules: 4, // InsertTextRule.InsertAsSnippet
    });

    items.push({
      label: 'loop-as-end',
      kind: 'snippet',
      detail: 'Loop over collection',
      insertText: 'loop ${1:items} as ${2:item}\n  ${3:# actions}\nend',
      insertTextRules: 4,
    });

    items.push({
      label: 'wait',
      kind: 'snippet',
      detail: 'Wait for duration',
      insertText: 'wait ${1:30}s',
      insertTextRules: 4,
    });
  }

  return items;
}

// ============================================================================
// Example Templates
// ============================================================================

export const CLI_TEMPLATES = {
  'health-check': `# Network Health Check Workflow
# Checks network health and alerts if degraded

meraki get-health --network \${network.id}

if health_score < 80 then
  notify slack --channel "#alerts" --message "Network health degraded: \${health_score}%"
end
`,

  'device-reboot': `# Device Reboot with Verification
# Reboots a device and verifies it comes back online

set device_serial = \${device.serial}

notify slack --channel "#ops" --message "Rebooting device \${device_serial}"

meraki reboot-device --serial \${device_serial}

wait 120s

meraki get-device --serial \${device_serial}

if device.status == "online" then
  notify slack --channel "#ops" --message "Device \${device_serial} back online"
else
  notify pagerduty --service "network" --severity "high" --message "Device \${device_serial} failed to reboot"
end
`,

  'security-response': `# Security Alert Response
# Analyzes security alerts and takes automated action

splunk search --query "index=security sourcetype=firewall action=blocked"

loop results as alert
  ai analyze --prompt "Analyze this security event and determine severity" --context \${alert}

  if ai_result.severity == "critical" then
    meraki quarantine-client --network \${alert.network_id} --mac \${alert.src_mac}
    notify pagerduty --service "security" --severity "critical" --message "Quarantined \${alert.src_mac}"
  elif ai_result.severity == "high" then
    notify slack --channel "#security" --message "High severity alert: \${alert.description}"
  end
end
`,

  'bulk-update': `# Bulk Device Update
# Updates tags on multiple devices

meraki get-devices --network \${network.id}

loop devices as device
  if device.model contains "MR" then
    meraki update-device --serial \${device.serial} --tags "wireless,production"
  end
end

notify slack --channel "#ops" --message "Updated \${devices.length} devices"
`,
};

export type CLITemplateId = keyof typeof CLI_TEMPLATES;
