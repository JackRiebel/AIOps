'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import AgenticRAGSettings from '@/components/settings/AgenticRAGSettings';

interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  cost_input_1k: number;
  cost_output_1k: number;
  speed: number;
  capability: number;
  context_window: number;
  best_for: string[];
  key_source?: string;
}

interface APIKeyStatus {
  anthropic: { user_key_set: boolean; admin_key_available: boolean };
  openai: { user_key_set: boolean; admin_key_available: boolean };
  google: { user_key_set: boolean; admin_key_available: boolean };
  cisco: { user_key_set: boolean; admin_key_available: boolean };
}

const providerLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  cisco: 'Cisco Circuit',
};

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  return `${(tokens / 1000).toFixed(0)}K`;
}

export default function AISettingsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [originalModel, setOriginalModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [originalTemperature, setOriginalTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [originalMaxTokens, setOriginalMaxTokens] = useState<number>(4096);
  const [apiKeyStatus, setApiKeyStatus] = useState<APIKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [modelsRes, currentRes, aiSettingsRes, keyStatusRes] = await Promise.allSettled([
        apiClient.getAvailableModels(),
        apiClient.getUserModel(),
        apiClient.getAISettings(),
        apiClient.getAPIKeyStatus(),
      ]);

      if (modelsRes.status === 'fulfilled') {
        setModels(modelsRes.value.models);
      }
      if (currentRes.status === 'fulfilled') {
        setSelectedModel(currentRes.value.model);
        setOriginalModel(currentRes.value.model);
      }
      if (aiSettingsRes.status === 'fulfilled') {
        setTemperature(aiSettingsRes.value.temperature);
        setOriginalTemperature(aiSettingsRes.value.temperature);
        setMaxTokens(aiSettingsRes.value.max_tokens);
        setOriginalMaxTokens(aiSettingsRes.value.max_tokens);
      }
      if (keyStatusRes.status === 'fulfilled') {
        setApiKeyStatus(keyStatusRes.value);
      }

      // Collect failures
      const results = [
        { name: 'models', result: modelsRes },
        { name: 'model', result: currentRes },
        { name: 'ai', result: aiSettingsRes },
        { name: 'api-keys', result: keyStatusRes },
      ];
      const failures = results.filter(r => r.result.status === 'rejected');

      if (failures.length > 0 && failures.length === results.length) {
        // All failed — show first error for context
        const firstErr = (failures[0].result as PromiseRejectedResult).reason;
        const msg = firstErr?.message || String(firstErr);
        setError(`Failed to load AI settings: ${msg}`);
      } else if (failures.length > 0) {
        // Partial failure — non-critical, clear error
        console.warn('Some AI settings endpoints failed:', failures.map(f => `${f.name}: ${(f.result as PromiseRejectedResult).reason?.message}`));
        setError(null);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const promises = [];
      if (selectedModel !== originalModel) {
        promises.push(apiClient.setUserModel(selectedModel));
      }
      if (temperature !== originalTemperature || maxTokens !== originalMaxTokens) {
        promises.push(apiClient.updateAISettings({ temperature, max_tokens: maxTokens }));
      }

      await Promise.all(promises);
      setOriginalModel(selectedModel);
      setOriginalTemperature(temperature);
      setOriginalMaxTokens(maxTokens);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selectedModel !== originalModel || temperature !== originalTemperature || maxTokens !== originalMaxTokens;
  const selectedModelData = models.find((m) => m.id === selectedModel);

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Configure AI model and API keys</p>
          </div>
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              aria-label={saving ? 'Saving changes' : 'Save changes'}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="mb-4 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-3">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="mb-4 px-4 py-3 bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg flex items-center gap-3">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-green-700 dark:text-green-400">{success}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true"></div>
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Loading settings...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Model Selection & Settings */}
            <div className="space-y-6">
              {/* Model Selection */}
              <div>
                <h2 id="model-section-label" className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Model</h2>
                <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none">
                  <label htmlFor="model-select" className="sr-only">Select AI model</label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    aria-labelledby="model-section-label"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({providerLabels[model.provider]})
                      </option>
                    ))}
                  </select>

                  {selectedModelData && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-2">{selectedModelData.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded">
                          {formatContextWindow(selectedModelData.context_window)} context
                        </span>
                        <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 rounded">
                          ${selectedModelData.cost_input_1k.toFixed(4)}/1K in
                        </span>
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded">
                          ${selectedModelData.cost_output_1k.toFixed(4)}/1K out
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Model Parameters */}
              <div>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Parameters</h2>
                <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none space-y-4">
                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="temperature-slider" className="text-sm font-medium text-slate-700 dark:text-slate-300">Temperature</label>
                      <span className="text-sm font-mono text-slate-500" aria-live="polite">{temperature.toFixed(1)}</span>
                    </div>
                    <input
                      id="temperature-slider"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={temperature}
                      aria-valuetext={`Temperature: ${temperature.toFixed(1)}`}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1" aria-hidden="true">
                      <span>Focused</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="max-tokens-slider" className="text-sm font-medium text-slate-700 dark:text-slate-300">Max Tokens</label>
                      <span className="text-sm font-mono text-slate-500" aria-live="polite">{maxTokens.toLocaleString()}</span>
                    </div>
                    <input
                      id="max-tokens-slider"
                      type="range"
                      min="256"
                      max="16384"
                      step="256"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      aria-valuemin={256}
                      aria-valuemax={16384}
                      aria-valuenow={maxTokens}
                      aria-valuetext={`Max tokens: ${maxTokens.toLocaleString()}`}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1" aria-hidden="true">
                      <span>256</span>
                      <span>16,384</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Saved Baselines */}
              <div>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Time Saved Baselines</h2>
                <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Baseline times represent how long tasks would take manually. These are used to calculate &quot;time saved&quot; estimates shown in chat responses.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30">
                      <div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Simple Lookup</span>
                        <p className="text-xs text-slate-400">Quick info retrieval</p>
                      </div>
                      <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">5-10 min</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30">
                      <div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Knowledge Search</span>
                        <p className="text-xs text-slate-400">Documentation lookup</p>
                      </div>
                      <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">15-30 min</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30">
                      <div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Platform Query</span>
                        <p className="text-xs text-slate-400">API data retrieval</p>
                      </div>
                      <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">20-45 min</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/30">
                      <div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Log Analysis</span>
                        <p className="text-xs text-slate-400">Splunk query & review</p>
                      </div>
                      <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">30-60 min</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">Incident Investigation</span>
                        <p className="text-xs text-slate-400">Multi-platform troubleshooting</p>
                      </div>
                      <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">45-90 min</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/30">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Based on industry research for network operations tasks. Customize in future updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Provider Status & Advanced Features */}
            <div className="space-y-6">
              {/* Agentic RAG Settings */}
              <div>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Knowledge Enhancement</h2>
                <AgenticRAGSettings />
              </div>

              {/* AI Providers */}
              <div>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">AI Providers</h2>
              <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none overflow-hidden">
                {apiKeyStatus && (['anthropic', 'openai', 'google', 'cisco'] as const).map((provider, idx) => {
                  const status = apiKeyStatus[provider];
                  const isConfigured = status.admin_key_available || status.user_key_set;
                  const isLast = idx === 3;

                  return (
                    <div
                      key={provider}
                      className={`p-4 ${!isLast ? 'border-b border-slate-200 dark:border-slate-700/30' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {providerLabels[provider]}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${isConfigured ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                          {isConfigured ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/30">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  AI provider API keys are managed in System Settings by administrators.
                </p>
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Go to System Settings
                </Link>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
