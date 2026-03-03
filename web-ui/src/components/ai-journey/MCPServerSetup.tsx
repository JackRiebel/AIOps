'use client';

import { memo, useState, useCallback } from 'react';
import { X, Loader2, Server } from 'lucide-react';

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
  const [name, setName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [authType, setAuthType] = useState<AuthTypeValue>('none');
  const [authToken, setAuthToken] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim() || !endpointUrl.trim()) return;

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
    [name, endpointUrl, authType, authToken, description, onRegister, onClose, resetForm],
  );

  if (!open) return null;

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
              Register MCP Server
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
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
                placeholder="My MCP Server"
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
                placeholder="https://mcp-server.example.com/mcp"
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono"
              />
            </div>

            {/* Auth Type */}
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

            {/* Auth Token (conditional — hidden for OAuth and None) */}
            {authType !== 'none' && authType !== 'oauth' && (
              <div>
                <label
                  htmlFor="mcp-auth-token"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  {authType === 'bearer' ? 'Bearer Token' : 'API Key'}
                </label>
                <input
                  id="mcp-auth-token"
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder={authType === 'bearer' ? 'eyJ...' : 'sk-...'}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono"
                />
              </div>
            )}

            {/* OAuth info message */}
            {authType === 'oauth' && (
              <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700/50 rounded-xl px-4 py-3">
                <p className="text-sm text-cyan-700 dark:text-cyan-300">
                  After registration, you&apos;ll be redirected to authorize with the provider (e.g. Cloudflare).
                  No token needed — OAuth handles authentication automatically.
                </p>
              </div>
            )}

            {/* Description */}
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
      </div>
    </div>
  );
});

MCPServerSetup.displayName = 'MCPServerSetup';

export default MCPServerSetup;
