'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Cloud,
  Cpu,
  Globe,
  Plus,
  Trash2,
  Loader2,
  ShieldCheck,
  Network,
  X,
  Info,
  CheckCircle2,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import type { AIProvider } from '@/components/visualizations/hooks/useAIPathJourney';

// ---------------------------------------------------------------------------
// Provider icon/color mapping
// ---------------------------------------------------------------------------

const PROVIDER_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; gradient: string }> = {
  anthropic: { icon: Brain, color: 'text-amber-500', gradient: 'from-amber-500/15 to-orange-500/10' },
  openai: { icon: Cpu, color: 'text-emerald-500', gradient: 'from-emerald-500/15 to-teal-500/10' },
  google: { icon: Globe, color: 'text-blue-500', gradient: 'from-blue-500/15 to-indigo-500/10' },
  azure_openai: { icon: Cloud, color: 'text-sky-500', gradient: 'from-sky-500/15 to-blue-500/10' },
  cisco_circuit: { icon: Network, color: 'text-cyan-500', gradient: 'from-cyan-500/15 to-teal-500/10' },
  custom: { icon: Plus, color: 'text-slate-400', gradient: 'from-slate-500/10 to-slate-400/10' },
};

const ALL_PROVIDERS = [
  { key: 'anthropic', label: 'Anthropic Claude' },
  { key: 'openai', label: 'OpenAI GPT' },
  { key: 'google', label: 'Google Gemini' },
  { key: 'azure_openai', label: 'Azure OpenAI' },
  { key: 'cisco_circuit', label: 'Cisco Circuit' },
  { key: 'custom', label: 'Custom Endpoint' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIEndpointSetupProps {
  providers: AIProvider[];
  onSelect: (provider: string) => void;
  selectedProvider: string | null;
  onCreate: (provider: string, mode: string, customUrl?: string) => Promise<void>;
  onDelete: (provider: string) => Promise<void>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AIEndpointSetup = memo(function AIEndpointSetup({
  providers,
  onSelect,
  selectedProvider,
  onCreate,
  onDelete,
  open,
  onOpenChange,
}: AIEndpointSetupProps) {
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activeKeys = useMemo(() => new Set(providers.map(p => p.provider)), [providers]);

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const handleCreate = useCallback(async (providerKey: string, createMode?: string) => {
    setBusy(true);
    try {
      const effectiveMode = createMode || 'full_assurance';
      await onCreate(providerKey, effectiveMode, providerKey === 'custom' ? customUrl : undefined);
      setPendingProvider(null);
      setCustomUrl('');
      showFeedback('success', `Monitoring created for ${ALL_PROVIDERS.find(p => p.key === providerKey)?.label || providerKey}`);
    } catch {
      showFeedback('error', 'Failed to create monitoring. Check that ThousandEyes is configured with available agents.');
    } finally {
      setBusy(false);
    }
  }, [onCreate, customUrl, showFeedback]);

  const handleDelete = useCallback(async (providerKey: string) => {
    setBusy(true);
    try {
      await onDelete(providerKey);
      setConfirmDelete(null);
      showFeedback('success', 'Monitoring removed');
    } catch {
      showFeedback('error', 'Failed to remove monitoring');
    } finally {
      setBusy(false);
    }
  }, [onDelete, showFeedback]);

  return (
    <div>
      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mb-3 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline provider chips (always visible) */}
      <div className="flex items-center gap-2 flex-wrap">
        {providers.map(p => {
          const meta = PROVIDER_META[p.provider] || PROVIDER_META.custom;
          const Icon = meta.icon;
          const isSelected = selectedProvider === p.provider;
          return (
            <button
              key={p.provider}
              onClick={() => onSelect(p.provider)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-700 border-cyan-500/40 shadow-sm text-slate-900 dark:text-white'
                  : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              {p.display_name}
              {p.source === 'discovered' && (
                <span className="text-[9px] px-1 py-0 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium">TE</span>
              )}
              <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </button>
          );
        })}
        <button
          onClick={() => onOpenChange(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
            open
              ? 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
              : 'border-dashed border-cyan-400/60 dark:border-cyan-600/40 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20'
          }`}
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
          {open ? 'Close' : providers.length > 0 ? 'Manage Tests' : 'Setup Providers'}
        </button>
      </div>

      {/* Expanded setup panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Mode explanation */}
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30 text-[11px] text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                Each provider gets a <strong>2-test monitoring suite</strong>: an Agent-to-Server test (path trace, latency, loss every 2 min) plus an HTTP Server test (TLS, TTFB, availability every 5 min).
                Existing TE tests targeting AI providers are auto-discovered.
              </div>
            </div>

            {/* AI Providers */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {ALL_PROVIDERS.map(p => {
                const meta = PROVIDER_META[p.key] || PROVIDER_META.custom;
                const Icon = meta.icon;
                const isActive = activeKeys.has(p.key);
                const isDeleting = confirmDelete === p.key;
                const isPending = pendingProvider === p.key;

                return (
                  <div
                    key={p.key}
                    className={`relative rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'bg-gradient-to-br ' + meta.gradient + ' border-slate-200/80 dark:border-slate-700/60'
                        : isPending
                          ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-300/50 dark:border-cyan-700/40'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={`w-6 h-6 ${meta.color}`} />
                      {isActive && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-1">{p.label}</h4>

                    {p.key === 'custom' && isPending && (
                      <input
                        type="url"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder="https://api.example.com"
                        className="w-full mt-2 px-2 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    )}

                    <div className="mt-3">
                      {isActive && !isDeleting ? (
                        <button
                          onClick={() => setConfirmDelete(p.key)}
                          disabled={busy}
                          className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 font-medium disabled:opacity-50 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      ) : isDeleting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(p.key)}
                            disabled={busy}
                            className="flex items-center gap-1 text-[12px] text-red-600 hover:text-red-700 font-semibold disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Confirm
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-[12px] text-slate-400 hover:text-slate-600">
                            Cancel
                          </button>
                        </div>
                      ) : p.key === 'custom' && isPending ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreate(p.key, 'full_assurance')}
                            disabled={busy || !customUrl}
                            className="flex items-center gap-1 text-[11px] text-cyan-600 hover:text-cyan-700 font-semibold disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                            Create Tests
                          </button>
                          <button onClick={() => setPendingProvider(null)} className="text-[11px] text-slate-400 hover:text-slate-600">
                            Cancel
                          </button>
                        </div>
                      ) : p.key === 'custom' ? (
                        <button
                          onClick={() => setPendingProvider(p.key)}
                          className="flex items-center gap-1 text-[12px] text-cyan-500 hover:text-cyan-600 font-medium"
                        >
                          <Plus className="w-3 h-3" /> Monitor
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCreate(p.key, 'full_assurance')}
                          disabled={busy}
                          className="flex items-center gap-1 text-[12px] text-cyan-600 hover:text-cyan-700 font-semibold disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                          Start Monitoring
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
