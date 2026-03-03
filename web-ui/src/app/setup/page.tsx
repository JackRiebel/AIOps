'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SetupStatus {
  setup_required: boolean;
  setup_complete: boolean;
  current_step: string | null;
  steps: {
    database: { completed: boolean; message: string; type?: string };
    encryption: { completed: boolean; message: string; source?: string };
    admin: { completed: boolean; message: string; admin_count?: number };
    ai_provider: { completed: boolean; message: string; providers?: string[] };
  };
}

interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface StepConfigExtended extends StepConfig {
  optional?: boolean;
}

const STEPS: StepConfigExtended[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Set up AI Ops Center',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    id: 'admin',
    title: 'Create Admin',
    description: 'Create your administrator account',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    id: 'ai_provider',
    title: 'AI Provider',
    description: 'Configure AI (can skip)',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    optional: true,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'OAuth & integrations (optional)',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    optional: true,
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Setup complete!',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

const DATABASE_OPTIONS = [
  {
    id: 'sqlite',
    name: 'SQLite',
    badge: 'Recommended',
    badgeColor: 'bg-green-500/20 text-green-400',
    description: 'Zero configuration. Works out of the box.',
    icon: '✓',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    badge: 'Advanced',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    description: 'Requires external database server.',
    icon: '⚠',
  },
];

const CIRCUIT_PROVIDER = {
  id: 'cisco',
  name: 'Cisco Circuit',
  description: 'Cisco Circuit AI - Recommended for enterprise network management',
  placeholder: 'Client ID from Circuit console',
  color: 'bg-cyan-500',
  requiresSecret: true,
  requiresAppKey: true,
};

const THIRD_PARTY_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude AI models - Third party option',
    placeholder: 'sk-ant-api...',
    color: 'bg-orange-500',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and other models - Third party option',
    placeholder: 'sk-...',
    color: 'bg-emerald-500',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini AI models - Third party option',
    placeholder: 'AIza...',
    color: 'bg-blue-500',
  },
];

// Combined for lookups
const AI_PROVIDERS = [CIRCUIT_PROVIDER, ...THIRD_PARTY_PROVIDERS];

export default function SetupPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [adminForm, setAdminForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [selectedProvider, setSelectedProvider] = useState<string>('cisco');
  const [apiKey, setApiKey] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [appKey, setAppKey] = useState('');
  const [showThirdParty, setShowThirdParty] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);

  // Database configuration
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<string>('sqlite');
  const [postgresUrl, setPostgresUrl] = useState('postgresql://lumen:password@localhost:5432/lumen');
  const [testingDb, setTestingDb] = useState(false);
  const [dbValid, setDbValid] = useState<boolean | null>(null);

  // OAuth / Integrations configuration
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [testingOAuth, setTestingOAuth] = useState(false);
  const [oauthValid, setOAuthValid] = useState<boolean | null>(null);

  // Network integrations
  const [merakiApiKey, setMerakiApiKey] = useState('');
  const [thousandeyesToken, setThousandeyesToken] = useState('');
  const [thousandeyesMcpEndpoint, setThousandeyesMcpEndpoint] = useState('');
  const [thousandeyesMcpToken, setThousandeyesMcpToken] = useState('');
  const [splunkHost, setSplunkHost] = useState('https://localhost:8089');
  const [splunkToken, setSplunkToken] = useState('');
  const [splunkBearerToken, setSplunkBearerToken] = useState('');
  const [catalystHost, setCatalystHost] = useState('');
  const [catalystUsername, setCatalystUsername] = useState('');
  const [catalystPassword, setCatalystPassword] = useState('');
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/setup/status');
      if (!res.ok) throw new Error('Failed to fetch setup status');
      const data = await res.json();
      setStatus(data);

      // If setup is complete, redirect to login
      if (data.setup_complete) {
        router.push('/login');
        return;
      }

      // Determine current step
      if (!data.steps.admin.completed) {
        setCurrentStepIndex(1); // Admin step
      } else if (!data.steps.ai_provider.completed) {
        setCurrentStepIndex(2); // AI provider step
      } else {
        setCurrentStepIndex(4); // Complete (skip integrations by default, user can go back)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setup status');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminForm.password !== adminForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (adminForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminForm.username,
          email: adminForm.email,
          password: adminForm.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create admin');

      // Move to next step
      setCurrentStepIndex(2);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setKeyValid(null);
    try {
      const payload: { provider: string; api_key: string; client_secret?: string; app_key?: string } = {
        provider: selectedProvider,
        api_key: apiKey,
      };
      if (selectedProvider === 'cisco') {
        payload.client_secret = clientSecret;
        payload.app_key = appKey;
      }
      const res = await fetch('/api/setup/test-ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setKeyValid(data.success);
      if (!data.success) {
        setError(data.message);
      }
    } catch (err) {
      setKeyValid(false);
      setError(err instanceof Error ? err.message : 'Failed to test API key');
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveAIKey = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: { provider: string; api_key: string; client_secret?: string; app_key?: string } = {
        provider: selectedProvider,
        api_key: apiKey,
      };
      if (selectedProvider === 'cisco') {
        payload.client_secret = clientSecret;
        payload.app_key = appKey;
      }

      console.log('[Setup] Saving AI key for provider:', selectedProvider);

      const res = await fetch('/api/setup/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[Setup] API response status:', res.status);

      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error('[Setup] Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response from server');
      }

      console.log('[Setup] API response data:', data);

      if (!res.ok) throw new Error(data.detail || 'Failed to save API key');

      // Move to integrations step (don't call fetchStatus - it would skip to complete)
      console.log('[Setup] Success! Moving to step 3 (Integrations)');
      setCurrentStepIndex(3);
    } catch (err) {
      console.error('[Setup] Error saving AI key:', err);
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep = () => {
    // Skip current step and move to next
    if (currentStepIndex === 2) {
      // Skipping AI provider, go to integrations
      setCurrentStepIndex(3);
    } else if (currentStepIndex === 3) {
      // Skipping integrations, go to complete
      setCurrentStepIndex(4);
    }
  };

  const handleSaveIntegrations = async () => {
    // Check if any integrations are configured
    const hasOAuth = googleClientId && googleClientSecret;
    const hasMeraki = merakiApiKey;
    const hasThousandeyes = thousandeyesToken;
    // Only consider Splunk configured if bearer token is provided (URL has a default)
    const hasSplunk = splunkBearerToken;
    const hasCatalyst = catalystHost && catalystUsername && catalystPassword;

    if (!hasOAuth && !hasMeraki && !hasThousandeyes && !hasSplunk && !hasCatalyst) {
      setCurrentStepIndex(4); // Just skip to complete if nothing configured
      return;
    }

    setError(null);
    setSaving(true);
    try {
      // Save all configured integrations
      const integrations: Record<string, string> = {};

      if (hasOAuth) {
        integrations.google_oauth_client_id = googleClientId;
        integrations.google_oauth_client_secret = googleClientSecret;
      }
      if (hasMeraki) {
        integrations.meraki_api_key = merakiApiKey;
      }
      if (hasThousandeyes) {
        integrations.thousandeyes_oauth_token = thousandeyesToken;
        if (thousandeyesMcpEndpoint) integrations.thousandeyes_mcp_endpoint = thousandeyesMcpEndpoint;
        if (thousandeyesMcpToken) integrations.thousandeyes_mcp_token = thousandeyesMcpToken;
      }
      if (hasSplunk) {
        // splunkHost is the REST API URL (port 8089), save as splunk_api_url
        if (splunkHost) integrations.splunk_api_url = splunkHost;
        if (splunkToken) integrations.splunk_hec_token = splunkToken;
        if (splunkBearerToken) integrations.splunk_bearer_token = splunkBearerToken;
      }
      if (hasCatalyst) {
        integrations.catalyst_center_host = catalystHost;
        integrations.catalyst_center_username = catalystUsername;
        integrations.catalyst_center_password = catalystPassword;
      }

      console.log('[Setup] Saving integrations:', Object.keys(integrations));

      const res = await fetch('/api/setup/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrations }),
      });

      console.log('[Setup] Integrations response status:', res.status);

      let data;
      try {
        data = await res.json();
        console.log('[Setup] Integrations response:', data);
      } catch (jsonErr) {
        console.error('[Setup] Failed to parse response:', jsonErr);
        throw new Error('Invalid response from server');
      }

      if (!res.ok) throw new Error(data.detail || 'Failed to save integrations');

      // Move to complete step
      setCurrentStepIndex(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save integrations');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);

    try {
      console.log('[Setup] Completing setup...');

      // First verify setup is complete
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Setup incomplete');

      console.log('[Setup] Setup complete, logging in...');

      // Auto-login with the admin credentials we just created
      if (adminForm.username && adminForm.password) {
        try {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: adminForm.username,
              password: adminForm.password,
            }),
          });

          if (loginRes.ok) {
            console.log('[Setup] Login successful, redirecting to dashboard...');
            // Use window.location for full page reload to trigger AuthContext re-check
            window.location.href = '/';
            return;
          } else {
            console.warn('[Setup] Auto-login failed, redirecting to login page');
          }
        } catch (loginErr) {
          console.warn('[Setup] Auto-login error:', loginErr);
        }
      }

      // Fallback: redirect to login page if auto-login fails
      window.location.href = '/login';
    } catch (err) {
      console.error('[Setup] Complete error:', err);
      setError(err instanceof Error ? err.message : 'Setup incomplete');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true" />
          <p className="mt-4 text-slate-400">Loading setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4" aria-hidden="true">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">AI Ops Center</h1>
          <p className="text-slate-400 mt-2">Intelligent Network Operations</p>
        </div>

        {/* Progress Steps */}
        <nav aria-label="Setup progress" className="flex items-center justify-center mb-8">
          <ol className="flex items-center" role="list">
            {STEPS.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    index < currentStepIndex
                      ? 'bg-cyan-500 border-cyan-500 text-white'
                      : index === currentStepIndex
                      ? 'border-cyan-500 text-cyan-500'
                      : 'border-slate-600 text-slate-600'
                  }`}
                  aria-label={`Step ${index + 1}: ${step.title}${index < currentStepIndex ? ' (completed)' : index === currentStepIndex ? ' (current)' : ''}`}
                  aria-current={index === currentStepIndex ? 'step' : undefined}
                >
                  {index < currentStepIndex ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium" aria-hidden="true">{index + 1}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      index < currentStepIndex ? 'bg-cyan-500' : 'bg-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
          {/* Step Header */}
          <div className="px-8 py-6 border-b border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10" aria-hidden="true">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={STEPS[currentStepIndex]?.icon || 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{STEPS[currentStepIndex]?.title || 'Setup'}</h2>
                <p className="text-slate-400 text-sm">{STEPS[currentStepIndex]?.description || 'Configuring your installation'}</p>
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="px-8 py-6">
            {error && (
              <div role="alert" className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            {/* Welcome Step */}
            {currentStepIndex === 0 && (
              <div className="py-6">
                <p className="text-slate-300 mb-6 text-center">
                  Welcome to AI Ops Center! Let&apos;s get you set up with your own instance.
                </p>
                <ul className="text-left text-slate-400 space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create your administrator account
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Add Circuit or choose a third party AI provider
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Start managing your network with AI
                  </li>
                </ul>

                {/* Advanced Configuration Toggle */}
                <div className="border-t border-slate-700/50 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors text-sm"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Advanced Configuration (Database)
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <p className="text-slate-500 text-sm">
                        Choose your database. SQLite works great for most users. PostgreSQL is recommended for production deployments with high traffic.
                      </p>

                      {/* Database Selection */}
                      <div className="grid grid-cols-2 gap-3">
                        {DATABASE_OPTIONS.map((db) => (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => {
                              setSelectedDatabase(db.id);
                              setDbValid(null);
                            }}
                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                              selectedDatabase === db.id
                                ? 'border-cyan-500 bg-cyan-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{db.icon}</span>
                              <span className="text-white font-medium">{db.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${db.badgeColor}`}>
                                {db.badge}
                              </span>
                            </div>
                            <p className="text-slate-500 text-xs">{db.description}</p>
                          </button>
                        ))}
                      </div>

                      {/* PostgreSQL Configuration */}
                      {selectedDatabase === 'postgresql' && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-4">
                          {/* Big Warning */}
                          <div className="flex items-start gap-3 bg-amber-500/10 rounded-lg p-3">
                            <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="text-sm">
                              <p className="font-semibold text-amber-300 mb-1">External Setup Required</p>
                              <p className="text-amber-200/80">
                                PostgreSQL cannot be auto-configured. You must install and set up the database server yourself before proceeding.
                              </p>
                            </div>
                          </div>

                          <div className="text-sm text-slate-400">
                            <p className="font-medium text-slate-300 mb-2">Before you continue, you need:</p>
                            <ol className="list-decimal list-inside space-y-2 text-xs">
                              <li>
                                <span className="text-slate-300">PostgreSQL 14+ installed and running</span>
                                <p className="ml-5 text-slate-500">Install from postgresql.org or via package manager</p>
                              </li>
                              <li>
                                <span className="text-slate-300">A database created for AI Ops Center</span>
                                <code className="ml-5 block bg-slate-800 px-2 py-1 rounded mt-1 text-cyan-400">createdb aiops_hub</code>
                              </li>
                              <li>
                                <span className="text-slate-300">A user with full permissions</span>
                                <code className="ml-5 block bg-slate-800 px-2 py-1 rounded mt-1 text-cyan-400">CREATE USER lumen WITH PASSWORD &apos;your_password&apos;;</code>
                                <code className="ml-5 block bg-slate-800 px-2 py-1 rounded mt-1 text-cyan-400">GRANT ALL PRIVILEGES ON DATABASE lumen TO lumen;</code>
                              </li>
                            </ol>
                          </div>

                          <div>
                            <label htmlFor="postgres-url" className="block text-sm font-medium text-slate-300 mb-2">
                              Database URL
                            </label>
                            <input
                              id="postgres-url"
                              type="text"
                              value={postgresUrl}
                              onChange={(e) => {
                                setPostgresUrl(e.target.value);
                                setDbValid(null);
                              }}
                              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                              placeholder="postgresql://user:password@localhost:5432/lumen"
                            />
                            <p className="text-slate-500 text-xs mt-1">
                              Format: postgresql://username:password@host:port/database
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              setTestingDb(true);
                              setDbValid(null);
                              try {
                                const res = await fetch('/api/setup/test-database', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ database_url: postgresUrl }),
                                });
                                const data = await res.json();
                                setDbValid(data.success);
                                if (!data.success) {
                                  setError(data.message);
                                }
                              } catch (err) {
                                setDbValid(false);
                                setError(err instanceof Error ? err.message : 'Failed to test database');
                              } finally {
                                setTestingDb(false);
                              }
                            }}
                            disabled={!postgresUrl || testingDb}
                            className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                          >
                            {testingDb ? 'Testing...' : 'Test Connection'}
                          </button>

                          {dbValid !== null && (
                            <div className={`text-sm ${dbValid ? 'text-green-400' : 'text-red-400'}`}>
                              {dbValid ? 'Database connection successful!' : 'Database connection failed'}
                            </div>
                          )}

                          <div className="border-t border-slate-700 pt-3 mt-3">
                            <p className="text-slate-500 text-xs">
                              <span className="text-slate-400 font-medium">Already using SQLite?</span> You can migrate later using:
                              <code className="block mt-1 bg-slate-800 px-2 py-1 rounded">
                                python scripts/migrate_to_postgres.py
                              </code>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-center mt-6">
                  <button
                    onClick={async () => {
                      if (selectedDatabase === 'postgresql' && postgresUrl) {
                        // Save database URL before proceeding
                        setSaving(true);
                        try {
                          const res = await fetch('/api/setup/database', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ database_url: postgresUrl }),
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.detail || 'Failed to configure database');
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to configure database');
                          setSaving(false);
                          return;
                        }
                        setSaving(false);
                      }
                      setCurrentStepIndex(1);
                    }}
                    disabled={saving || (selectedDatabase === 'postgresql' && !postgresUrl)}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                  >
                    {saving ? 'Configuring...' : 'Get Started'}
                  </button>
                </div>
              </div>
            )}

            {/* Admin Step */}
            {currentStepIndex === 1 && (
              <form onSubmit={handleCreateAdmin} className="space-y-4" aria-label="Create admin account">
                <div>
                  <label htmlFor="admin-username" className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                  <input
                    id="admin-username"
                    type="text"
                    value={adminForm.username}
                    onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    placeholder="admin"
                    required
                    minLength={3}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label htmlFor="admin-email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                  <input
                    id="admin-email"
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    placeholder="admin@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <input
                    id="admin-password"
                    type="password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="admin-confirm-password" className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                  <input
                    id="admin-confirm-password"
                    type="password"
                    value={adminForm.confirmPassword}
                    onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    placeholder="Confirm password"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  aria-label={saving ? 'Creating admin account' : 'Create admin account'}
                  className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  {saving ? 'Creating...' : 'Create Admin Account'}
                </button>
              </form>
            )}

            {/* AI Provider Step */}
            {currentStepIndex === 2 && (
              <div className="space-y-6">
                <p className="text-slate-400 text-sm">
                  Configure an AI provider to enable intelligent network analysis.
                </p>

                {/* Circuit Provider - Always Visible */}
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProvider('cisco');
                      setApiKey('');
                      setClientSecret('');
                      setAppKey('');
                      setKeyValid(null);
                      setShowThirdParty(false);
                    }}
                    aria-pressed={selectedProvider === 'cisco'}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                      selectedProvider === 'cisco'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${CIRCUIT_PROVIDER.color}`} aria-hidden="true" />
                      <div>
                        <div className="text-white font-medium flex items-center gap-2">
                          {CIRCUIT_PROVIDER.name}
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Recommended</span>
                        </div>
                        <div className="text-slate-400 text-sm mt-1">{CIRCUIT_PROVIDER.description}</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Third Party Toggle */}
                {!showThirdParty && selectedProvider === 'cisco' && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowThirdParty(true)}
                      className="text-slate-400 hover:text-slate-300 text-sm underline underline-offset-4 transition-colors"
                    >
                      Or use a third party AI provider
                    </button>
                  </div>
                )}

                {/* Third Party Providers */}
                {showThirdParty && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <div className="h-px flex-1 bg-slate-700"></div>
                      <span>Third Party Options</span>
                      <div className="h-px flex-1 bg-slate-700"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Select third party AI provider">
                      {THIRD_PARTY_PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => {
                            setSelectedProvider(provider.id);
                            setApiKey('');
                            setClientSecret('');
                            setAppKey('');
                            setKeyValid(null);
                          }}
                          aria-pressed={selectedProvider === provider.id}
                          aria-label={`${provider.name}${selectedProvider === provider.id ? ' (selected)' : ''}`}
                          className={`p-4 rounded-lg border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                            selectedProvider === provider.id
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${provider.color} mb-2`} aria-hidden="true" />
                          <div className="text-white font-medium text-sm">{provider.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* API Key Input */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-300 mb-2">
                      {selectedProvider === 'cisco' ? 'Client ID' : `${AI_PROVIDERS.find((p) => p.id === selectedProvider)?.name} API Key`}
                    </label>
                    <input
                      id="api-key-input"
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setKeyValid(null);
                      }}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                      placeholder={AI_PROVIDERS.find((p) => p.id === selectedProvider)?.placeholder}
                      autoComplete="off"
                    />
                  </div>

                  {/* Client Secret for Circuit */}
                  {selectedProvider === 'cisco' && (
                    <>
                      <div>
                        <label htmlFor="client-secret-input" className="block text-sm font-medium text-slate-300 mb-2">
                          Client Secret
                        </label>
                        <input
                          id="client-secret-input"
                          type="password"
                          value={clientSecret}
                          onChange={(e) => {
                            setClientSecret(e.target.value);
                            setKeyValid(null);
                          }}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                          placeholder="Client Secret from Circuit console"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label htmlFor="app-key-input" className="block text-sm font-medium text-slate-300 mb-2">
                          App Key
                        </label>
                        <input
                          id="app-key-input"
                          type="password"
                          value={appKey}
                          onChange={(e) => {
                            setAppKey(e.target.value);
                            setKeyValid(null);
                          }}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                          placeholder="App Key from Circuit console"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={!apiKey || (selectedProvider === 'cisco' && (!clientSecret || !appKey)) || testingKey}
                      aria-label={testingKey ? 'Testing credentials' : 'Test credentials'}
                      className="px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {testingKey ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                  {keyValid !== null && (
                    <div role="status" className={`text-sm ${keyValid ? 'text-green-400' : 'text-red-400'}`}>
                      {keyValid ? 'Credentials are valid!' : 'Credential test failed'}
                    </div>
                  )}
                </div>

                <p className="text-slate-500 text-xs">
                  {AI_PROVIDERS.find((p) => p.id === selectedProvider)?.description}
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSkipStep}
                    className="flex-1 px-6 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAIKey}
                    disabled={!apiKey || (selectedProvider === 'cisco' && (!clientSecret || !appKey)) || saving}
                    aria-label={saving ? 'Saving credentials' : 'Save credentials and continue'}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    {saving ? 'Saving...' : 'Save and Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Integrations Step */}
            {currentStepIndex === 3 && (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">
                  Configure optional integrations. Click to expand each section. You can always add these later in Settings.
                </p>

                {/* Meraki */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIntegration(expandedIntegration === 'meraki' ? null : 'meraki')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">Meraki Dashboard</h4>
                        <p className="text-slate-500 text-sm">Connect to Cisco Meraki networks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {merakiApiKey && <span className="text-xs text-green-400">Configured</span>}
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedIntegration === 'meraki' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedIntegration === 'meraki' && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
                        <input
                          type="password"
                          value={merakiApiKey}
                          onChange={(e) => setMerakiApiKey(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="Your Meraki API key"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ThousandEyes */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIntegration(expandedIntegration === 'thousandeyes' ? null : 'thousandeyes')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">ThousandEyes</h4>
                        <p className="text-slate-500 text-sm">Network monitoring and diagnostics</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {thousandeyesToken && <span className="text-xs text-green-400">Configured</span>}
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedIntegration === 'thousandeyes' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedIntegration === 'thousandeyes' && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">OAuth Bearer Token</label>
                        <input
                          type="password"
                          value={thousandeyesToken}
                          onChange={(e) => setThousandeyesToken(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="Your ThousandEyes OAuth token"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">MCP Endpoint (Optional)</label>
                        <input
                          type="url"
                          value={thousandeyesMcpEndpoint}
                          onChange={(e) => setThousandeyesMcpEndpoint(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="https://mcp.thousandeyes.com"
                        />
                        <p className="text-xs text-slate-500 mt-1">Enables dashboard access and AI-driven queries</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">MCP Token (Optional)</label>
                        <input
                          type="password"
                          value={thousandeyesMcpToken}
                          onChange={(e) => setThousandeyesMcpToken(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="Defaults to OAuth token if not set"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Splunk */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIntegration(expandedIntegration === 'splunk' ? null : 'splunk')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">Splunk</h4>
                        <p className="text-slate-500 text-sm">Log aggregation and SIEM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {splunkBearerToken && <span className="text-xs text-green-400">Configured</span>}
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedIntegration === 'splunk' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedIntegration === 'splunk' && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Splunk Host URL</label>
                        <input
                          type="text"
                          value={splunkHost}
                          onChange={(e) => setSplunkHost(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="https://splunk.example.com:8089"
                        />
                        <p className="text-slate-500 text-xs mt-1">Local: localhost:8089 | Cloud: https://your-instance.splunkcloud.com:8089</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Bearer Token</label>
                        <input
                          type="password"
                          value={splunkBearerToken}
                          onChange={(e) => setSplunkBearerToken(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="Your Splunk Bearer token for queries"
                        />
                        <p className="text-slate-500 text-xs mt-1">Required for querying Splunk data</p>
                      </div>
                      <div className="pt-2 border-t border-slate-700/30">
                        <p className="text-slate-500 text-xs mb-2">Optional: For sending events to Splunk</p>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">HEC Token (Optional)</label>
                          <input
                            type="password"
                            value={splunkToken}
                            onChange={(e) => setSplunkToken(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                            placeholder="HEC token for uploading events"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Catalyst Center */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIntegration(expandedIntegration === 'catalyst' ? null : 'catalyst')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">Catalyst Center (DNA-C)</h4>
                        <p className="text-slate-500 text-sm">Cisco enterprise network controller</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {catalystHost && catalystUsername && <span className="text-xs text-green-400">Configured</span>}
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedIntegration === 'catalyst' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedIntegration === 'catalyst' && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Host URL</label>
                        <input
                          type="text"
                          value={catalystHost}
                          onChange={(e) => setCatalystHost(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="https://catalyst.example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                        <input
                          type="text"
                          value={catalystUsername}
                          onChange={(e) => setCatalystUsername(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="admin"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <input
                          type="password"
                          value={catalystPassword}
                          onChange={(e) => setCatalystPassword(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="Your password"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Google OAuth */}
                <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedIntegration(expandedIntegration === 'oauth' ? null : 'oauth')}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <h4 className="text-white font-medium">Google OAuth (SSO)</h4>
                        <p className="text-slate-500 text-sm">Allow users to sign in with Google</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {googleClientId && googleClientSecret && <span className="text-xs text-green-400">Configured</span>}
                      <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedIntegration === 'oauth' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedIntegration === 'oauth' && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Client ID</label>
                        <input
                          type="text"
                          value={googleClientId}
                          onChange={(e) => setGoogleClientId(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="your-app.apps.googleusercontent.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Client Secret</label>
                        <input
                          type="password"
                          value={googleClientSecret}
                          onChange={(e) => setGoogleClientSecret(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          placeholder="GOCSPX-..."
                        />
                      </div>
                      <p className="text-slate-500 text-xs">
                        Create credentials at{' '}
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                          Google Cloud Console
                        </a>
                      </p>
                      <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-xs text-blue-200 space-y-1">
                            <p className="font-medium">Google Cloud Console Configuration:</p>
                            <p><span className="text-slate-400">Authorized JavaScript origins:</span> <code className="bg-slate-800 px-1 rounded">https://localhost:3000</code></p>
                            <p><span className="text-slate-400">Authorized redirect URI:</span> <code className="bg-slate-800 px-1 rounded text-[10px]">https://localhost:8002/api/auth/oauth/google/callback</code></p>
                            <p className="text-amber-300/80 mt-1">Note: It may take 5 minutes to a few hours for Google settings to take effect.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSkipStep}
                    className="flex-1 px-6 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:bg-slate-700/50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveIntegrations}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    {saving ? 'Saving...' : 'Save and Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Complete Step */}
            {currentStepIndex === 4 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4" aria-hidden="true">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Setup Complete!</h3>
                <p className="text-slate-400 mb-6">
                  AI Ops Center is ready to use.
                </p>
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6 text-left">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Quick Start:</h4>
                  <ol className="text-slate-400 text-sm space-y-2">
                    <li>1. Add your network integrations (Meraki, ThousandEyes, etc.)</li>
                    <li>2. Start a chat to analyze your network with AI</li>
                    <li>3. Configure additional settings in Admin &gt; Settings</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                >
                  {saving ? 'Starting...' : 'Go to Dashboard'}
                </button>
              </div>
            )}

            {/* Fallback for unexpected step index */}
            {(currentStepIndex < 0 || currentStepIndex > 4) && (
              <div className="text-center py-8">
                <p className="text-red-400 mb-4">Unexpected step index: {currentStepIndex}</p>
                <button
                  type="button"
                  onClick={() => setCurrentStepIndex(0)}
                  className="px-6 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Restart Setup
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          AI Ops Center v1.0.0
        </p>
      </div>
    </div>
  );
}
