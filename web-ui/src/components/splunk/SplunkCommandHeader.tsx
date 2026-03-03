'use client';

import { memo, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, Server } from 'lucide-react';
import { HealthGauge } from '@/app/chat-v2/cards/widgets/HealthGauge';

// ============================================================================
// Types
// ============================================================================

export interface SplunkCommandHeaderProps {
  serverName: string | null;
  lastSyncTime: Date | null;
  loading: boolean;
  isConfigured: boolean;
  healthScore: number;
  onRefresh: () => void;
  onCommandSubmit: (query: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkCommandHeader = memo(({
  serverName,
  lastSyncTime,
  loading,
  isConfigured,
  healthScore,
  onRefresh,
  onCommandSubmit,
}: SplunkCommandHeaderProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onCommandSubmit(query.trim());
    setQuery('');
  }, [query, onCommandSubmit]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      {/* Title */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
          <Server className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Splunk Intelligence Center</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {isConfigured && serverName ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected to {serverName}
                {lastSyncTime && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="tabular-nums">{lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </span>
            ) : (
              'AI-Powered Log Intelligence & Security Analytics'
            )}
          </p>
        </div>
      </div>

      {/* Command bar */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-lg">
        <div className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask about your Splunk environment..."
            disabled={!isConfigured}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-300 dark:focus:border-cyan-500/40 transition disabled:opacity-50"
          />
        </div>
      </form>

      {/* Health gauge + Refresh */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <HealthGauge value={healthScore} label="Health" size="sm" />
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? 'Refreshing...' : 'Refresh data'}
            className="p-2 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {lastSyncTime && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
              {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

SplunkCommandHeader.displayName = 'SplunkCommandHeader';
export default SplunkCommandHeader;
