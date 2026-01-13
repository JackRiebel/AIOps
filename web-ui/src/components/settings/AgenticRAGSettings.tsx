'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface AgenticRAGSettings {
  enabled: boolean;
  max_iterations: number;
  timeout_seconds: number;
  query_analysis_enabled: boolean;
  document_grading_enabled: boolean;
  reflection_enabled: boolean;
  web_search_enabled: boolean;
  debug_mode: boolean;
}

interface AgenticRAGStatus {
  orchestrator_initialized: boolean;
  available_providers: string[];
  message?: string;
}

interface AgentStatus {
  enabled: boolean;
  name: string;
}

interface AgentsStatus {
  query_analyzer?: AgentStatus;
  retrieval_router?: AgentStatus;
  document_grader?: AgentStatus;
  corrective_rag?: AgentStatus;
  synthesizer?: AgentStatus;
  reflector?: AgentStatus;
}

// API Response types
interface AgenticRAGSettingsResponse {
  success: boolean;
  settings: AgenticRAGSettings;
  status: AgenticRAGStatus;
}

interface AgenticRAGStatusResponse {
  success: boolean;
  agents?: AgentsStatus;
}

interface AgenticRAGUpdateResponse {
  success: boolean;
  message?: string;
}

export default function AgenticRAGSettings() {
  const [settings, setSettings] = useState<AgenticRAGSettings>({
    enabled: false,
    max_iterations: 2,
    timeout_seconds: 15,
    query_analysis_enabled: true,
    document_grading_enabled: true,
    reflection_enabled: true,
    web_search_enabled: false,
    debug_mode: false,
  });
  const [originalSettings, setOriginalSettings] = useState<AgenticRAGSettings | null>(null);
  const [status, setStatus] = useState<AgenticRAGStatus | null>(null);
  const [agents, setAgents] = useState<AgentsStatus>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<AgenticRAGSettingsResponse>('/api/settings/agentic-rag');
      if (response.success) {
        setSettings(response.settings);
        setOriginalSettings(response.settings);
        setStatus(response.status);
      }

      // Also load detailed status
      const statusResponse = await apiClient.get<AgenticRAGStatusResponse>('/api/settings/agentic-rag/status');
      if (statusResponse.success) {
        setAgents(statusResponse.agents || {});
      }
    } catch (err) {
      console.error('Failed to load agentic RAG settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiClient.put<AgenticRAGUpdateResponse>('/api/settings/agentic-rag', settings);
      if (response.success) {
        setOriginalSettings(settings);
        setSuccess('Settings saved successfully');
        setTimeout(() => setSuccess(null), 3000);
        // Reload to get updated status
        await loadSettings();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof AgenticRAGSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-r-transparent" aria-hidden="true"></div>
          <span className="text-sm text-slate-500">Loading Agentic RAG settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none overflow-hidden">
        {/* Main Toggle */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings.enabled ? 'bg-cyan-100 dark:bg-cyan-500/20' : 'bg-slate-100 dark:bg-slate-700/50'}`} aria-hidden="true">
                <svg className={`w-5 h-5 ${settings.enabled ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Agentic RAG Pipeline</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Multi-agent retrieval with query analysis, grading, and reflection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status?.orchestrator_initialized ? 'bg-green-500' : 'bg-amber-500'}`} aria-hidden="true" />
                <span className="text-xs text-slate-500">
                  {status?.orchestrator_initialized ? 'Ready' : 'Not initialized'}
                </span>
              </div>
              {/* Toggle Switch */}
              <button
                onClick={() => handleToggle('enabled')}
                role="switch"
                aria-checked={settings.enabled}
                aria-label={`Agentic RAG Pipeline: ${settings.enabled ? 'enabled' : 'disabled'}`}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 ${
                  settings.enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide advanced settings' : 'Show advanced settings'}
            className="mt-3 flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Hide advanced settings' : 'Show advanced settings'}
          </button>
        </div>

        {/* Expanded Settings */}
        {expanded && (
          <div className="border-t border-slate-200 dark:border-slate-700/30 p-4 space-y-4 bg-slate-50 dark:bg-slate-900/30">
            {/* Alerts */}
            {error && (
              <div role="alert" className="px-3 py-2 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="px-3 py-2 bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg text-sm text-green-700 dark:text-green-400">
                {success}
              </div>
            )}

            {/* Agent Toggles */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Agents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleItem
                  label="Query Analysis"
                  description="Decompose complex queries"
                  enabled={settings.query_analysis_enabled}
                  onChange={() => handleToggle('query_analysis_enabled')}
                />
                <ToggleItem
                  label="Document Grading"
                  description="LLM relevance evaluation"
                  enabled={settings.document_grading_enabled}
                  onChange={() => handleToggle('document_grading_enabled')}
                />
                <ToggleItem
                  label="Reflection"
                  description="Self-evaluate quality"
                  enabled={settings.reflection_enabled}
                  onChange={() => handleToggle('reflection_enabled')}
                />
                <ToggleItem
                  label="Web Search Fallback"
                  description="Search web if KB insufficient"
                  enabled={settings.web_search_enabled}
                  onChange={() => handleToggle('web_search_enabled')}
                />
              </div>
            </div>

            {/* Performance Settings */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Performance</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="max-iterations-slider" className="text-sm text-slate-700 dark:text-slate-300">Max Iterations</label>
                    <span className="text-sm font-mono text-slate-500" aria-live="polite">{settings.max_iterations}</span>
                  </div>
                  <input
                    id="max-iterations-slider"
                    type="range"
                    min="1"
                    max="5"
                    value={settings.max_iterations}
                    onChange={(e) => setSettings((prev) => ({ ...prev, max_iterations: parseInt(e.target.value) }))}
                    aria-valuemin={1}
                    aria-valuemax={5}
                    aria-valuenow={settings.max_iterations}
                    aria-valuetext={`${settings.max_iterations} iterations`}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5" aria-hidden="true">
                    <span>1 (fast)</span>
                    <span>5 (thorough)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="timeout-slider" className="text-sm text-slate-700 dark:text-slate-300">Timeout (seconds)</label>
                    <span className="text-sm font-mono text-slate-500" aria-live="polite">{settings.timeout_seconds}s</span>
                  </div>
                  <input
                    id="timeout-slider"
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={settings.timeout_seconds}
                    onChange={(e) => setSettings((prev) => ({ ...prev, timeout_seconds: parseInt(e.target.value) }))}
                    aria-valuemin={5}
                    aria-valuemax={60}
                    aria-valuenow={settings.timeout_seconds}
                    aria-valuetext={`${settings.timeout_seconds} seconds timeout`}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5" aria-hidden="true">
                    <span>5s</span>
                    <span>60s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Debug Mode */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/30">
              <ToggleItem
                label="Debug Mode"
                description="Enable verbose logging"
                enabled={settings.debug_mode}
                onChange={() => handleToggle('debug_mode')}
              />
            </div>

            {/* Save Button */}
            {hasChanges && (
              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  aria-label={saving ? 'Saving Agentic RAG settings' : 'Save Agentic RAG settings'}
                  className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
                >
                  {saving ? 'Saving...' : 'Save Agentic RAG Settings'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Status (only shown when enabled) */}
      {settings.enabled && status?.orchestrator_initialized && Object.keys(agents).length > 0 && (
        <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Pipeline Status</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(agents).map(([key, agent]) => (
              <div
                key={key}
                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 ${
                  agent.enabled
                    ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500'
                }`}
                role="status"
                aria-label={`${agent.name}: ${agent.enabled ? 'enabled' : 'disabled'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${agent.enabled ? 'bg-green-500' : 'bg-slate-400'}`} aria-hidden="true" />
                {agent.name}
              </div>
            ))}
          </div>
          {status.available_providers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/30">
              <span className="text-xs text-slate-500">LLM Providers: </span>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {status.available_providers.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Toggle Item Component
function ToggleItem({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="checkbox"
      aria-checked={enabled}
      aria-label={`${label}: ${enabled ? 'enabled' : 'disabled'}. ${description}`}
      className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-left focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
        enabled
          ? 'bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20'
          : 'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/30'
      }`}
    >
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
        enabled
          ? 'border-cyan-500 bg-cyan-500'
          : 'border-slate-300 dark:border-slate-600'
      }`} aria-hidden="true">
        {enabled && (
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}
