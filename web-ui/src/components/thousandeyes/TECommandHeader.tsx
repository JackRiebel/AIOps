'use client';

import { memo, useState, useCallback } from 'react';
import Image from 'next/image';
import { Sparkles, RefreshCw } from 'lucide-react';
import { HealthGauge } from '@/app/chat-v2/cards/widgets/HealthGauge';

// ============================================================================
// Types
// ============================================================================

export interface TECommandHeaderProps {
  healthScore: number;
  lastSyncTime: Date | null;
  loading: boolean;
  onRefresh: () => void;
  onCommandSubmit: (query: string) => void;
  aiStreaming?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const TECommandHeader = memo(({
  healthScore,
  lastSyncTime,
  loading,
  onRefresh,
  onCommandSubmit,
  aiStreaming,
}: TECommandHeaderProps) => {
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
        <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm overflow-hidden">
          <Image src="/te-logo.png" alt="ThousandEyes" width={28} height={28} className="object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Network Intelligence</h1>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">ThousandEyes Command Center</p>
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
            placeholder="Ask about network health, tests, alerts..."
            disabled={aiStreaming}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-300 dark:focus:border-cyan-500/40 transition disabled:opacity-50"
          />
        </div>
      </form>

      {/* Health gauge + refresh */}
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

TECommandHeader.displayName = 'TECommandHeader';
export default TECommandHeader;
