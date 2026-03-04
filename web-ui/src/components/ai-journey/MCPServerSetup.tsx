'use client';

import { memo, useState, useCallback } from 'react';
import { X, Loader2, Server, Database, Globe, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface MCPServerSetupProps {
  open: boolean;
  onClose: () => void;
  onRegister: (config: {
    name: string;
    endpoint_url: string;
    auth_type?: string;
    auth_token?: string;
    description?: string;
  }) => Promise<void>;
}

// ============================================================================
// Predefined server templates
// ============================================================================

interface ServerTemplate {
  id: string;
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  endpointPlaceholder: string;
  defaultEndpoint: string;
  authType: AuthTypeValue;
  authLabel: string;
  authPlaceholder: string;
  authRequired: boolean;
  serverDescription: string;
}

const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: 'splunk',
    name: 'Splunk MCP Server',
    label: 'Splunk',
    icon: Database,
    color: 'bg-orange-500',
    description: 'Connect to Splunk MCP Server for log analytics, search, and SIEM capabilities',
    endpointPlaceholder: 'https://localhost:8089/services/mcp',
    defaultEndpoint: 'https://localhost:8089/services/mcp',
    authType: 'bearer',
    authLabel: 'MCP Encrypted Token',
    authPlaceholder: 'Encrypted token from Splunk > MCP Server > Create Encrypted Token',
    authRequired: true,
    serverDescription: 'Splunk Enterprise MCP Server — provides search, alerting, KV Store, and knowledge object tools',
  },
  {
    id: 'custom',
    name: '',
    label: 'Custom Server',
    icon: Server,
    color: 'bg-slate-500',
    description: 'Register any MCP-compatible server with custom endpoint and authentication',
    endpointPlaceholder: 'https://mcp-server.example.com/mcp',
    defaultEndpoint: '',
    authType: 'none',
    authLabel: '',
    authPlaceholder: '',
    authRequired: false,
    serverDescription: '',
  },
];

// ============================================================================
// Auth type options
// ============================================================================

const AUTH_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth (Cloudflare, etc.)' },
] as const;

type AuthTypeValue = (typeof AUTH_OPTIONS)[number]['value'];

// ============================================================================
// MCPServerSetup Component
// ============================================================================

export const MCPServerSetup = memo(({ open, onClose, onRegister }: MCPServerSetupProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [authType, setAuthType] = useState<AuthTypeValue>('none');
  const [authToken, setAuthToken] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedTemplate(null);
    setName('');
    setEndpointUrl('');
    setAuthType('none');
    setAuthToken('');
    setDescription('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    resetForm();
    onClose();
  }, [submitting, resetForm, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleSelectTemplate = useCallback((template: ServerTemplate) => {
    setSelectedTemplate(template.id);
    setError(null);
    if (template.id !== 'custom') {
      setName(template.name);
      setEndpointUrl(template.defaultEndpoint);
      setAuthType(template.authType);
      setDescription(template.serverDescription);
    } else {
      setName('');
      setEndpointUrl('');
      setAuthType('none');
      setDescription('');
    }
    setAuthToken('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim() || !endpointUrl.trim()) return;

      const template = SERVER_TEMPLATES.find(t => t.id === selectedTemplate);
      if (template?.authRequired && !authToken.trim()) {
        setError(`${template.authLabel} is required for ${template.label}`);
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        await onRegister({
          name: name.trim(),
          endpoint_url: endpointUrl.trim(),
          auth_type: authType !== 'none' ? authType : undefined,
          auth_token: authType !== 'none' && authType !== 'oauth' && authToken.trim() ? authToken.trim() : undefined,
          description: description.trim() || undefined,
        });
        resetForm();
        onClose();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to register server';
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [name, endpointUrl, authType, authToken, description, selectedTemplate, onRegister, onClose, resetForm],
  );

  if (!open) return null;

  const activeTemplate = SERVER_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {selectedTemplate ? 'Configure MCP Server' : 'Register MCP Server'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedTemplate ? (
          /* Template Selection */
          <div className="p-6 space-y-3">
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4">
              Choose a server type to get started:
            </p>
            {SERVER_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-600/50 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10 transition-all text-left group"
                >
                  <div className={`w-10 h-10 rounded-lg ${template.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                        {template.label}
                      </span>
                      {template.id === 'splunk' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {template.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          /* Configuration Form */
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              {/* Back button */}
              <button
                type="button"
                onClick={() => { setSelectedTemplate(null); setError(null); }}
                className="text-[12px] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium"
              >
                &larr; Back to server types
              </button>

              {/* Template info banner */}
              {activeTemplate && activeTemplate.id !== 'custom' && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/40">
                  <div className={`w-8 h-8 rounded-lg ${activeTemplate.color} flex items-center justify-center flex-shrink-0`}>
                    <activeTemplate.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-[12px] font-semibold text-slate-900 dark:text-white">{activeTemplate.label} MCP Server</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{activeTemplate.description}</p>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="mcp-server-name"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Server Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="mcp-server-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeTemplate?.id === 'custom' ? 'My MCP Server' : activeTemplate?.name || 'My MCP Server'}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                />
              </div>

              {/* Endpoint URL */}
              <div>
                <label
                  htmlFor="mcp-endpoint-url"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Endpoint URL <span className="text-red-500">*</span>
                </label>
                <input
                  id="mcp-endpoint-url"
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder={activeTemplate?.endpointPlaceholder || 'https://mcp-server.example.com/mcp'}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono"
                />
                {activeTemplate?.id === 'splunk' && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Default: https://localhost:8089/services/mcp. For Splunk Cloud: https://your-instance.splunkcloud.com:8089/services/mcp
                  </p>
                )}
              </div>

              {/* Auth Type — only show full select for custom servers */}
              {activeTemplate?.id === 'custom' ? (
                <div>
                  <label
                    htmlFor="mcp-auth-type"
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Authentication
                  </label>
                  <select
                    id="mcp-auth-type"
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as AuthTypeValue)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white text-sm"
                  >
                    {AUTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Auth Token */}
              {authType !== 'none' && authType !== 'oauth' && (
                <div>
                  <label
                    htmlFor="mcp-auth-token"
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    {activeTemplate?.authLabel || (authType === 'bearer' ? 'Bearer Token' : 'API Key')}
                    {activeTemplate?.authRequired && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    id="mcp-auth-token"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder={activeTemplate?.authPlaceholder || (authType === 'bearer' ? 'eyJ...' : 'sk-...')}
                    required={activeTemplate?.authRequired}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono"
                  />
                  {activeTemplate?.id === 'splunk' && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Created in Splunk &gt; Settings &gt; MCP Server &gt; Create Encrypted Token
                    </p>
                  )}
                </div>
              )}

              {/* OAuth info */}
              {authType === 'oauth' && (
                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/50 rounded-xl px-4 py-3">
                  <p className="text-sm text-cyan-700 dark:text-cyan-300">
                    After registration, you&apos;ll be redirected to authorize with the provider.
                  </p>
                </div>
              )}

              {/* Description — only for custom */}
              {activeTemplate?.id === 'custom' && (
                <div>
                  <label
                    htmlFor="mcp-description"
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                  >
                    Description{' '}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="mcp-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this MCP server provide?"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm resize-none"
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
              <button
                type="submit"
                disabled={submitting || !name.trim() || !endpointUrl.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Server'
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/50 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
});

MCPServerSetup.displayName = 'MCPServerSetup';

export default MCPServerSetup;
