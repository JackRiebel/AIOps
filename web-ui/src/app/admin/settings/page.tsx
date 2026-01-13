'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IntegrationCard,
  IntegrationSection,
  QuickStatusBar,
  type IntegrationConfig,
  type FieldConfig,
} from '@/components/settings';

// ============================================================================
// INTEGRATION DEFINITIONS
// ============================================================================

// Field configurations for each integration
const INTEGRATION_FIELDS: Record<string, FieldConfig[]> = {
  // Network Platforms
  meraki: [
    { key: 'meraki_api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 'Enter your Meraki Dashboard API key', helpUrl: 'https://developer.cisco.com/meraki/api-v1/' },
  ],
  catalyst: [
    { key: 'catalyst_center_host', displayName: 'Host URL', type: 'url', required: true, placeholder: 'https://your-catalyst-center.example.com', description: 'Your Catalyst Center instance URL' },
    { key: 'catalyst_center_username', displayName: 'Username', type: 'text', required: true, placeholder: 'admin' },
    { key: 'catalyst_center_password', displayName: 'Password', type: 'password', required: true, placeholder: 'Enter password' },
  ],
  thousandeyes: [
    { key: 'thousandeyes_oauth_token', displayName: 'OAuth Token', type: 'password', required: true, placeholder: 'Bearer token from ThousandEyes', helpUrl: 'https://developer.thousandeyes.com/' },
  ],

  // AI Providers
  anthropic: [
    { key: 'anthropic_api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys' },
  ],
  openai: [
    { key: 'openai_api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys' },
  ],
  google: [
    { key: 'google_api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 'Enter Google AI API key', helpUrl: 'https://aistudio.google.com/app/apikey' },
  ],
  'cisco-circuit': [
    { key: 'cisco_circuit_client_id', displayName: 'Client ID', type: 'password', required: true, placeholder: 'OAuth Client ID' },
    { key: 'cisco_circuit_client_secret', displayName: 'Client Secret', type: 'password', required: true, placeholder: 'OAuth Client Secret' },
    { key: 'cisco_circuit_app_key', displayName: 'App Key', type: 'password', required: true, placeholder: 'Application Key' },
  ],

  // Monitoring
  splunk: [
    { key: 'splunk_api_url', displayName: 'Splunk API URL', type: 'url', required: true, defaultValue: 'https://localhost:8089', placeholder: 'https://localhost:8089', description: 'Local: localhost:8089 | Cloud: https://your-instance.splunkcloud.com:8089' },
    { key: 'splunk_bearer_token', displayName: 'Bearer Token', type: 'password', required: true, placeholder: 'eyJraWQi...', description: 'JWT token from Splunk Settings > Tokens', helpUrl: 'https://docs.splunk.com/Documentation/Splunk/latest/Security/UseAuthTokens' },
    { key: 'splunk_host', displayName: 'HEC Host (Optional)', type: 'url', required: false, defaultValue: 'http://localhost:8088', placeholder: 'http://localhost:8088', description: 'Local: localhost:8088 | Cloud: https://http-inputs-your-instance.splunkcloud.com:443' },
    { key: 'splunk_hec_token', displayName: 'HEC Token (Optional)', type: 'password', required: false, placeholder: 'HEC token', helpUrl: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector' },
  ],

  // Notifications
  slack: [
    { key: 'slack_webhook_url', displayName: 'Webhook URL', type: 'url', required: true, placeholder: 'https://hooks.slack.com/services/...', helpUrl: 'https://api.slack.com/messaging/webhooks' },
  ],
  teams: [
    { key: 'teams_webhook_url', displayName: 'Webhook URL', type: 'url', required: true, placeholder: 'https://outlook.office.com/webhook/...' },
  ],
  webex: [
    { key: 'webex_webhook_url', displayName: 'Webhook URL', type: 'url', placeholder: 'Incoming webhook URL' },
    { key: 'webex_bot_token', displayName: 'Bot Token', type: 'password', placeholder: 'Bot access token' },
    { key: 'webex_room_id', displayName: 'Room ID', type: 'text', placeholder: 'Target room/space ID' },
  ],
  pagerduty: [
    { key: 'pagerduty_routing_key', displayName: 'Routing Key', type: 'password', required: true, placeholder: 'Events API v2 routing key' },
  ],
  email: [
    { key: 'smtp_host', displayName: 'SMTP Server', type: 'text', required: true, placeholder: 'smtp.example.com' },
    { key: 'smtp_port', displayName: 'Port', type: 'number', required: true, placeholder: '587' },
    { key: 'smtp_user', displayName: 'Username', type: 'text', placeholder: 'user@example.com' },
    { key: 'smtp_password', displayName: 'Password', type: 'password', placeholder: 'SMTP password' },
    { key: 'smtp_from', displayName: 'From Address', type: 'text', required: true, placeholder: 'noreply@example.com' },
  ],

  // Authentication
  'google-oauth': [
    { key: 'google_oauth_client_id', displayName: 'Client ID', type: 'password', required: true, placeholder: 'OAuth 2.0 Client ID' },
    { key: 'google_oauth_client_secret', displayName: 'Client Secret', type: 'password', required: true, placeholder: 'OAuth 2.0 Client Secret' },
    { key: 'oauth_redirect_uri', displayName: 'Redirect URI', type: 'url', placeholder: 'https://yourdomain.com/api/auth/callback' },
  ],
  'duo-mfa': [
    { key: 'duo_integration_key', displayName: 'Integration Key', type: 'password', required: true, placeholder: 'Duo integration key' },
    { key: 'duo_secret_key', displayName: 'Secret Key', type: 'password', required: true, placeholder: 'Duo secret key' },
    { key: 'duo_api_hostname', displayName: 'API Hostname', type: 'text', required: true, placeholder: 'api-xxxxxxxx.duosecurity.com' },
  ],

  // Security
  security: [
    { key: 'session_timeout_minutes', displayName: 'Session Timeout', type: 'number', placeholder: '60', description: 'Minutes before session expires' },
    { key: 'edit_mode_enabled', displayName: 'Write Operations', type: 'boolean', description: 'Allow changes to network devices' },
    { key: 'mfa_enabled', displayName: 'Require MFA', type: 'boolean', description: 'Require multi-factor authentication' },
    { key: 'verify_ssl', displayName: 'Verify SSL Globally', type: 'boolean', description: 'Verify SSL certificates for all API calls' },
  ],

  // Server
  server: [
    { key: 'log_level', displayName: 'Log Level', type: 'select', options: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'], description: 'Application logging verbosity' },
    { key: 'api_timeout', displayName: 'API Timeout', type: 'number', placeholder: '30', description: 'Seconds before API calls timeout' },
    { key: 'api_retry_attempts', displayName: 'Retry Attempts', type: 'number', placeholder: '3', description: 'Number of retry attempts for failed calls' },
  ],
};

// Integration configurations
const INTEGRATIONS: Record<string, IntegrationConfig[]> = {
  'network-platforms': [
    { id: 'meraki', name: 'Cisco Meraki', description: 'Cloud-managed networking dashboard', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'bg-green-500', fields: INTEGRATION_FIELDS.meraki, testable: true, docUrl: 'https://developer.cisco.com/meraki/' },
    { id: 'catalyst', name: 'Catalyst Center', description: 'Enterprise network management', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-amber-500', fields: INTEGRATION_FIELDS.catalyst, testable: true },
    { id: 'thousandeyes', name: 'ThousandEyes', description: 'Network intelligence and monitoring', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', color: 'bg-purple-500', fields: INTEGRATION_FIELDS.thousandeyes, testable: true },
  ],
  'ai-providers': [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Claude AI models for analysis', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'bg-orange-600', fields: INTEGRATION_FIELDS.anthropic, testable: true },
    { id: 'openai', name: 'OpenAI', description: 'GPT models for AI assistance', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'bg-emerald-600', fields: INTEGRATION_FIELDS.openai, testable: true },
    { id: 'google', name: 'Google Gemini', description: 'Gemini AI models', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'bg-blue-600', fields: INTEGRATION_FIELDS.google, testable: true },
    { id: 'cisco-circuit', name: 'Cisco Circuit', description: 'Cisco AI assistant platform', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'bg-cyan-600', fields: INTEGRATION_FIELDS['cisco-circuit'], testable: true },
  ],
  monitoring: [
    { id: 'splunk', name: 'Splunk', description: 'Log analytics and SIEM platform', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'bg-orange-500', fields: INTEGRATION_FIELDS.splunk, testable: true },
  ],
  notifications: [
    { id: 'slack', name: 'Slack', description: 'Send workflow notifications to Slack channels', icon: 'M7 8a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1V9a1 1 0 00-1-1H7zm7-4a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1V5a1 1 0 00-1-1h-3zm0 10a1 1 0 00-1 1v4a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 00-1-1h-3z', color: 'bg-purple-500', fields: INTEGRATION_FIELDS.slack, testable: true },
    { id: 'teams', name: 'Microsoft Teams', description: 'Send alerts to Teams channels', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0', color: 'bg-blue-600', fields: INTEGRATION_FIELDS.teams, testable: true },
    { id: 'webex', name: 'Cisco Webex', description: 'Send messages via Webex bot or webhook', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'bg-cyan-500', fields: INTEGRATION_FIELDS.webex, testable: true },
    { id: 'pagerduty', name: 'PagerDuty', description: 'Trigger incidents and alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'bg-green-600', fields: INTEGRATION_FIELDS.pagerduty, testable: true },
    { id: 'email', name: 'Email (SMTP)', description: 'Send email alerts via SMTP server', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'bg-red-500', fields: INTEGRATION_FIELDS.email, testable: true },
  ],
  authentication: [
    { id: 'google-oauth', name: 'Google OAuth', description: 'Sign in with Google accounts', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', color: 'bg-red-500', fields: INTEGRATION_FIELDS['google-oauth'], testable: false, configNote: {
      title: 'Google Cloud Console Configuration:',
      lines: [
        'Authorized JavaScript origins: https://localhost:3000',
        'Authorized redirect URI: https://localhost:8002/api/auth/oauth/google/callback',
      ],
      warning: 'Note: It may take 5 minutes to a few hours for Google settings to take effect.',
    }},
    { id: 'duo-mfa', name: 'Duo MFA', description: 'Multi-factor authentication via Duo', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', color: 'bg-green-600', fields: INTEGRATION_FIELDS['duo-mfa'], testable: false },
  ],
  security: [
    { id: 'security', name: 'Security Settings', description: 'Session and access controls', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'bg-slate-600', fields: INTEGRATION_FIELDS.security, testable: false },
  ],
  server: [
    { id: 'server', name: 'Server Settings', description: 'Logging and API configuration', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01', color: 'bg-slate-500', fields: INTEGRATION_FIELDS.server, testable: false },
  ],
};

// Section metadata
const SECTIONS = [
  { id: 'network-platforms', title: 'Network Platforms', description: 'Connect to Cisco network management platforms', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', defaultExpanded: true },
  { id: 'ai-providers', title: 'AI Providers', description: 'Configure AI model providers for intelligent analysis', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', defaultExpanded: true },
  { id: 'monitoring', title: 'Monitoring & Logging', description: 'Log analytics and observability platforms', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', defaultExpanded: false },
  { id: 'notifications', title: 'Notifications', description: 'Alert routing and messaging integrations', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', defaultExpanded: false },
  { id: 'authentication', title: 'Authentication', description: 'SSO and multi-factor authentication', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', defaultExpanded: false },
  { id: 'security', title: 'Security & Access', description: 'Session security and feature toggles', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', defaultExpanded: false },
  { id: 'server', title: 'Server Settings', description: 'Application and API configuration', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01', defaultExpanded: false },
];

// Testable integration mapping (config key -> API test endpoint name)
const TESTABLE_INTEGRATIONS: Record<string, string> = {
  meraki_api_key: 'meraki',
  anthropic_api_key: 'anthropic',
  openai_api_key: 'openai',
  google_api_key: 'google',
  cisco_circuit_client_id: 'cisco',
  splunk_api_url: 'splunk-api',  // Test REST API for queries
  splunk_host: 'splunk',          // Test HEC for events
  thousandeyes_oauth_token: 'thousandeyes',
  catalyst_center_host: 'catalyst',
  slack_webhook_url: 'slack',
  teams_webhook_url: 'teams',
  smtp_host: 'email',
};

// ============================================================================
// PAGE COMPONENT
// ============================================================================

interface ConfigValue {
  has_value: boolean;
  source: 'database' | 'env' | 'default' | 'none';
  current_value?: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, ConfigValue>>({});

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // Fetch all config
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSystemConfig();
      const values: Record<string, ConfigValue> = {};
      Object.entries(response.configs).forEach(([key, config]: [string, { has_value: boolean; source: 'database' | 'env' | 'default' | 'none'; current_value?: string }]) => {
        values[key] = {
          has_value: config.has_value,
          source: config.source,
          current_value: config.current_value,
        };
      });
      setConfigValues(values);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Get values for an integration
  const getIntegrationValues = useCallback((integration: IntegrationConfig) => {
    const values: Record<string, string> = {};
    integration.fields.forEach((field) => {
      const config = configValues[field.key];
      // Use current_value if exists, otherwise use defaultValue, otherwise empty
      values[field.key] = config?.current_value || field.defaultValue || '';
    });
    return values;
  }, [configValues]);

  // Get sources for an integration
  const getIntegrationSources = useCallback((integration: IntegrationConfig) => {
    const sources: Record<string, 'database' | 'env' | 'default' | 'none'> = {};
    integration.fields.forEach((field) => {
      const config = configValues[field.key];
      sources[field.key] = config?.source || 'none';
    });
    return sources;
  }, [configValues]);

  // Check if integration is configured
  const isIntegrationConfigured = useCallback((integration: IntegrationConfig) => {
    return integration.fields.some((field) => {
      const config = configValues[field.key];
      return config?.has_value;
    });
  }, [configValues]);

  // Save integration values
  const handleSave = useCallback(async (integration: IntegrationConfig, values: Record<string, string>) => {
    setError(null);
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value) {
          await apiClient.updateSystemConfig(key, value);
        }
      }
      setSuccess(`${integration.name} saved successfully`);
      await fetchConfig();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${integration.name}`);
      throw err;
    }
  }, [fetchConfig]);

  // Test integration
  const handleTest = useCallback(async (integration: IntegrationConfig) => {
    const testKey = integration.fields.find((f) => TESTABLE_INTEGRATIONS[f.key])?.key;
    if (!testKey) return { success: false, message: 'Test not available' };

    const integrationName = TESTABLE_INTEGRATIONS[testKey];
    try {
      const result = await apiClient.testIntegration(integrationName as Parameters<typeof apiClient.testIntegration>[0]);
      return result;
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Test failed' };
    }
  }, []);

  // Calculate section stats
  const getSectionStats = useCallback((sectionId: string) => {
    const integrations = INTEGRATIONS[sectionId] || [];
    let configured = 0;
    integrations.forEach((integration) => {
      if (isIntegrationConfigured(integration)) {
        configured++;
      }
    });
    return { configured, total: integrations.length };
  }, [isIntegrationConfigured]);

  // Quick status categories
  const quickStatusCategories = useMemo(() => {
    return SECTIONS.map((section) => {
      const stats = getSectionStats(section.id);
      return {
        id: section.id,
        name: section.title.split(' ')[0], // First word only for compact display
        icon: section.icon,
        color: INTEGRATIONS[section.id]?.[0]?.color || 'bg-slate-500',
        configured: stats.configured,
        total: stats.total,
      };
    });
  }, [getSectionStats]);

  // Handle section scroll
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!user || user.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900" role="status" aria-live="polite">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true"></div>
          <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Configuration</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure integrations and system settings. All settings are stored securely in the database.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/setup/wizard"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Setup Wizard
            </Link>
            <button
              onClick={fetchConfig}
              disabled={loading}
              aria-label={loading ? 'Refreshing configuration' : 'Refresh configuration'}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            </div>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-600 dark:text-red-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div role="status" className="px-4 py-3 bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700 dark:text-green-400">{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} aria-label="Dismiss message" className="text-green-600 dark:text-green-400 hover:text-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Quick Status Bar */}
        {!loading && (
          <QuickStatusBar
            categories={quickStatusCategories}
            onCategoryClick={scrollToSection}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true"></div>
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Loading configuration...</p>
            </div>
          </div>
        )}

        {/* Sections */}
        {!loading && (
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const integrations = INTEGRATIONS[section.id] || [];
              const stats = getSectionStats(section.id);

              return (
                <div key={section.id} id={`section-${section.id}`}>
                  <IntegrationSection
                    id={section.id}
                    title={section.title}
                    description={section.description}
                    icon={section.icon}
                    configuredCount={stats.configured}
                    totalCount={stats.total}
                    defaultExpanded={section.defaultExpanded}
                  >
                    {integrations.map((integration) => (
                      <IntegrationCard
                        key={integration.id}
                        config={integration}
                        values={getIntegrationValues(integration)}
                        sources={getIntegrationSources(integration)}
                        onSave={(values) => handleSave(integration, values)}
                        onTest={integration.testable ? () => handleTest(integration) : undefined}
                      />
                    ))}
                  </IntegrationSection>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Configuration values are stored encrypted in the database.{' '}
            <Link href="/admin/knowledge" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
              Manage Knowledge Base
            </Link>
            {' | '}
            <Link href="/organizations" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
              Manage Organizations
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
