'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configKey: string;
  testEndpoint: string;
}

interface PlatformOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  fields: { key: string; label: string; type: 'text' | 'password' | 'url'; placeholder: string }[];
  testEndpoint: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS: WizardStep[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with Lumen' },
  { id: 'admin', title: 'Admin Account', description: 'Create your administrator account' },
  { id: 'ai', title: 'AI Provider', description: 'Configure an AI assistant' },
  { id: 'network', title: 'Network Platform', description: 'Connect your network management' },
  { id: 'complete', title: 'Complete', description: 'Setup finished' },
];

const AI_PROVIDERS: ProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude AI for intelligent network analysis',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: 'bg-orange-600',
    configKey: 'anthropic_api_key',
    testEndpoint: 'anthropic',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models for AI assistance',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: 'bg-emerald-600',
    configKey: 'openai_api_key',
    testEndpoint: 'openai',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini AI models',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: 'bg-blue-600',
    configKey: 'google_api_key',
    testEndpoint: 'google',
  },
];

const NETWORK_PLATFORMS: PlatformOption[] = [
  {
    id: 'meraki',
    name: 'Cisco Meraki',
    description: 'Cloud-managed networking',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'bg-green-500',
    fields: [
      { key: 'meraki_api_key', label: 'API Key', type: 'password', placeholder: 'Enter your Meraki Dashboard API key' },
    ],
    testEndpoint: 'meraki',
  },
  {
    id: 'catalyst',
    name: 'Catalyst Center',
    description: 'Enterprise network management',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'bg-amber-500',
    fields: [
      { key: 'catalyst_center_host', label: 'Host URL', type: 'url', placeholder: 'https://your-catalyst-center.example.com' },
      { key: 'catalyst_center_username', label: 'Username', type: 'text', placeholder: 'admin' },
      { key: 'catalyst_center_password', label: 'Password', type: 'password', placeholder: 'Enter password' },
    ],
    testEndpoint: 'catalyst',
  },
  {
    id: 'thousandeyes',
    name: 'ThousandEyes',
    description: 'Network intelligence monitoring',
    icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    color: 'bg-purple-500',
    fields: [
      { key: 'thousandeyes_oauth_token', label: 'OAuth Token', type: 'password', placeholder: 'Bearer token from ThousandEyes' },
    ],
    testEndpoint: 'thousandeyes',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [adminForm, setAdminForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [selectedAI, setSelectedAI] = useState<string | null>(null);
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformFields, setPlatformFields] = useState<Record<string, string>>({});
  const [platformTestStatus, setPlatformTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [configuredItems, setConfiguredItems] = useState<string[]>([]);

  // Navigation
  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      setError(null);
      setSuccess(null);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setError(null);
      setSuccess(null);
    }
  }, [currentStep]);

  // Admin account creation
  const handleCreateAdmin = useCallback(async () => {
    if (!adminForm.username || !adminForm.email || !adminForm.password) {
      setError('Please fill in all fields');
      return;
    }
    if (adminForm.password !== adminForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (adminForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.createSetupAdmin({
        username: adminForm.username,
        email: adminForm.email,
        password: adminForm.password,
      });
      setSuccess('Admin account created successfully');
      setConfiguredItems((prev) => [...prev, 'Admin Account']);
      setTimeout(goNext, 1000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create admin account';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [adminForm, goNext]);

  // AI provider setup
  const handleTestAI = useCallback(async () => {
    if (!selectedAI || !aiApiKey) {
      setError('Please select a provider and enter your API key');
      return;
    }

    const provider = AI_PROVIDERS.find((p) => p.id === selectedAI);
    if (!provider) return;

    setAiTestStatus('testing');
    setError(null);
    try {
      // First save the API key
      await apiClient.updateSystemConfig(provider.configKey, aiApiKey);
      // Then test the connection
      const result = await apiClient.testIntegration(provider.testEndpoint as 'anthropic' | 'openai' | 'google');
      if (result.success) {
        setAiTestStatus('success');
        setSuccess(result.message);
        setConfiguredItems((prev) => [...prev, provider.name]);
      } else {
        setAiTestStatus('error');
        setError(result.message);
      }
    } catch (err: unknown) {
      setAiTestStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(errorMessage);
    }
  }, [selectedAI, aiApiKey]);

  // Network platform setup
  const handleTestPlatform = useCallback(async () => {
    if (!selectedPlatform) {
      setError('Please select a platform');
      return;
    }

    const platform = NETWORK_PLATFORMS.find((p) => p.id === selectedPlatform);
    if (!platform) return;

    // Check required fields
    const missingFields = platform.fields.filter((f) => !platformFields[f.key]);
    if (missingFields.length > 0) {
      setError(`Please fill in: ${missingFields.map((f) => f.label).join(', ')}`);
      return;
    }

    setPlatformTestStatus('testing');
    setError(null);
    try {
      // Save all platform fields
      for (const field of platform.fields) {
        await apiClient.updateSystemConfig(field.key, platformFields[field.key]);
      }
      // Test the connection
      const result = await apiClient.testIntegration(platform.testEndpoint as 'meraki' | 'catalyst' | 'thousandeyes');
      if (result.success) {
        setPlatformTestStatus('success');
        setSuccess(result.message);
        setConfiguredItems((prev) => [...prev, platform.name]);
      } else {
        setPlatformTestStatus('error');
        setError(result.message);
      }
    } catch (err: unknown) {
      setPlatformTestStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      setError(errorMessage);
    }
  }, [selectedPlatform, platformFields]);

  const handleSkipPlatform = useCallback(() => {
    goNext();
  }, [goNext]);

  const handleFinish = useCallback(() => {
    router.push('/');
  }, [router]);

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderWelcome = () => (
    <div className="text-center max-w-xl mx-auto">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center" aria-hidden="true">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
        Welcome to Lumen
      </h2>
      <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
        Let&apos;s get you set up in just a few steps. We&apos;ll configure your admin account,
        connect an AI provider, and optionally set up your network management platform.
      </p>
      <div className="grid grid-cols-3 gap-4 mb-8" role="list" aria-label="Setup steps overview">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg" role="listitem">
          <div className="text-2xl font-bold text-cyan-600" aria-hidden="true">1</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Admin Account</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg" role="listitem">
          <div className="text-2xl font-bold text-cyan-600" aria-hidden="true">2</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">AI Provider</div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg" role="listitem">
          <div className="text-2xl font-bold text-cyan-600" aria-hidden="true">3</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Network Platform</div>
        </div>
      </div>
      <button
        onClick={goNext}
        className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
      >
        Get Started
      </button>
    </div>
  );

  const renderAdminStep = () => (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Create Admin Account
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Set up your administrator account to manage the dashboard.
      </p>
      <form className="space-y-4" aria-label="Create admin account" onSubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }}>
        <div>
          <label htmlFor="wizard-admin-username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Username
          </label>
          <input
            id="wizard-admin-username"
            type="text"
            value={adminForm.username}
            onChange={(e) => setAdminForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="admin"
            autoComplete="username"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="wizard-admin-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Email
          </label>
          <input
            id="wizard-admin-email"
            type="email"
            value={adminForm.email}
            onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="admin@example.com"
            autoComplete="email"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="wizard-admin-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Password
          </label>
          <input
            id="wizard-admin-password"
            type="password"
            value={adminForm.password}
            onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="wizard-admin-confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Confirm Password
          </label>
          <input
            id="wizard-admin-confirm-password"
            type="password"
            value={adminForm.confirmPassword}
            onChange={(e) => setAdminForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="Confirm your password"
            autoComplete="new-password"
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={goBack}
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            aria-label={loading ? 'Creating account' : 'Create admin account'}
            className="flex-1 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Create Account
          </button>
        </div>
      </form>
    </div>
  );

  const renderAIStep = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Configure AI Provider
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        Select an AI provider to power intelligent network analysis and chat assistance.
      </p>

      {/* Provider Selection */}
      <div className="grid grid-cols-3 gap-4 mb-6" role="group" aria-label="Select AI provider">
        {AI_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              setSelectedAI(provider.id);
              setAiTestStatus('idle');
              setError(null);
            }}
            aria-pressed={selectedAI === provider.id}
            aria-label={`${provider.name}: ${provider.description}${selectedAI === provider.id ? ' (selected)' : ''}`}
            className={`p-4 rounded-lg border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${
              selectedAI === provider.id
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`w-10 h-10 ${provider.color} rounded-lg flex items-center justify-center mb-3`} aria-hidden="true">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={provider.icon} />
              </svg>
            </div>
            <div className="font-medium text-slate-900 dark:text-white">{provider.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{provider.description}</div>
          </button>
        ))}
      </div>

      {/* API Key Input */}
      {selectedAI && (
        <div className="mb-6">
          <label htmlFor="wizard-ai-api-key" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            API Key
          </label>
          <div className="flex gap-3">
            <input
              id="wizard-ai-api-key"
              type="password"
              value={aiApiKey}
              onChange={(e) => {
                setAiApiKey(e.target.value);
                setAiTestStatus('idle');
              }}
              placeholder="Enter your API key"
              autoComplete="off"
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleTestAI}
              disabled={aiTestStatus === 'testing' || !aiApiKey}
              aria-label={aiTestStatus === 'testing' ? 'Testing connection' : aiTestStatus === 'success' ? 'Connection successful' : aiTestStatus === 'error' ? 'Retry connection test' : 'Test API connection'}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${
                aiTestStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : aiTestStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {aiTestStatus === 'testing' && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {aiTestStatus === 'success' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {aiTestStatus === 'idle' ? 'Test Connection' : aiTestStatus === 'testing' ? 'Testing...' : aiTestStatus === 'success' ? 'Connected' : 'Retry'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={goBack}
          className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={aiTestStatus !== 'success'}
          className="flex-1 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderNetworkStep = () => {
    const currentPlatform = NETWORK_PLATFORMS.find((p) => p.id === selectedPlatform);

    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Connect Network Platform
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Connect your network management platform for monitoring and automation. You can skip this step and configure later.
        </p>

        {/* Platform Selection */}
        <div className="grid grid-cols-3 gap-4 mb-6" role="group" aria-label="Select network platform">
          {NETWORK_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => {
                setSelectedPlatform(platform.id);
                setPlatformTestStatus('idle');
                setPlatformFields({});
                setError(null);
              }}
              aria-pressed={selectedPlatform === platform.id}
              aria-label={`${platform.name}: ${platform.description}${selectedPlatform === platform.id ? ' (selected)' : ''}`}
              className={`p-4 rounded-lg border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${
                selectedPlatform === platform.id
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center mb-3`} aria-hidden="true">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={platform.icon} />
                </svg>
              </div>
              <div className="font-medium text-slate-900 dark:text-white">{platform.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{platform.description}</div>
            </button>
          ))}
        </div>

        {/* Platform Fields */}
        {currentPlatform && (
          <div className="space-y-4 mb-6">
            {currentPlatform.fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`wizard-platform-${field.key}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {field.label}
                </label>
                <input
                  id={`wizard-platform-${field.key}`}
                  type={field.type}
                  value={platformFields[field.key] || ''}
                  onChange={(e) => {
                    setPlatformFields((f) => ({ ...f, [field.key]: e.target.value }));
                    setPlatformTestStatus('idle');
                  }}
                  placeholder={field.placeholder}
                  autoComplete={field.type === 'password' ? 'off' : field.type === 'url' ? 'url' : 'off'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={handleTestPlatform}
              disabled={platformTestStatus === 'testing'}
              aria-label={platformTestStatus === 'testing' ? 'Testing connection' : platformTestStatus === 'success' ? 'Connection successful' : platformTestStatus === 'error' ? 'Retry connection test' : 'Test platform connection'}
              className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${
                platformTestStatus === 'success'
                  ? 'bg-green-600 text-white'
                  : platformTestStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {platformTestStatus === 'testing' && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {platformTestStatus === 'success' && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {platformTestStatus === 'idle' ? 'Test Connection' : platformTestStatus === 'testing' ? 'Testing...' : platformTestStatus === 'success' ? 'Connected' : 'Retry'}
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={goBack}
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSkipPlatform}
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
          >
            Skip for Now
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={Boolean(selectedPlatform && platformTestStatus !== 'success')}
            className="flex-1 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  const renderComplete = () => (
    <div className="text-center max-w-xl mx-auto">
      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center" aria-hidden="true">
        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
        Setup Complete!
      </h2>
      <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
        Your Lumen is ready to use. You can always adjust settings later from the Admin panel.
      </p>

      {configuredItems.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 mb-8 text-left">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3">Configured Items</h3>
          <ul className="space-y-2" role="list">
            {configuredItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleFinish}
        className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
      >
        Go to Dashboard
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return renderWelcome();
      case 'admin':
        return renderAdminStep();
      case 'ai':
        return renderAIStep();
      case 'network':
        return renderNetworkStep();
      case 'complete':
        return renderComplete();
      default:
        return null;
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Progress Bar */}
      <nav aria-label="Setup wizard progress" className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <ol className="flex items-center justify-between mb-2" role="list">
            {STEPS.map((step, index) => (
              <li key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStep
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                  aria-label={`Step ${index + 1}: ${step.title}${index < currentStep ? ' (completed)' : index === currentStep ? ' (current)' : ''}`}
                  aria-current={index === currentStep ? 'step' : undefined}
                >
                  {index < currentStep ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span aria-hidden="true">{index + 1}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 sm:w-24 h-1 mx-2 rounded ${
                      index < currentStep ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">
            {STEPS.map((step) => (
              <span key={step.id} className="w-8 text-center">
                {step.title}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full">
          {/* Error/Success Messages */}
          {error && (
            <div role="alert" className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}
          {success && (
            <div role="status" className="max-w-2xl mx-auto mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </div>
            </div>
          )}

          {renderCurrentStep()}
        </div>
      </div>
    </div>
  );
}
