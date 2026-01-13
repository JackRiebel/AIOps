'use client';

import { memo } from 'react';
import {
  Sparkles,
  MessageSquare,
  Zap,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface AgentPerformanceWidgetProps {
  totalQueries: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerQuery: number;
  queriesLast7Days: number;
  costLast7Days: number;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// ============================================================================
// AgentPerformanceWidget Component (AI Usage Stats)
// ============================================================================

export const AgentPerformanceWidget = memo(({
  totalQueries,
  totalTokens,
  totalCost,
  avgCostPerQuery,
  queriesLast7Days,
  costLast7Days,
  loading,
  className = '',
}: AgentPerformanceWidgetProps) => {
  const hasData = totalQueries > 0;

  return (
    <DashboardCard
      title="AI Usage"
      icon={<Sparkles className="w-4 h-4" />}
      href="/costs"
      accent="purple"
      loading={loading}
      className={className}
    >
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No AI usage yet</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Start chatting to see stats
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Total Queries */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Queries</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatNumber(totalQueries)}
            </p>
            <p className="text-[10px] text-slate-400">
              {queriesLast7Days} last 7 days
            </p>
          </div>

          {/* Total Tokens */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Zap className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Tokens</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatNumber(totalTokens)}
            </p>
            <p className="text-[10px] text-slate-400">
              total processed
            </p>
          </div>

          {/* Total Cost */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Total Cost</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCost(totalCost)}
            </p>
            <p className="text-[10px] text-slate-400">
              {formatCost(costLast7Days)} last 7 days
            </p>
          </div>

          {/* Avg Cost per Query */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Avg/Query</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCost(avgCostPerQuery)}
            </p>
            <p className="text-[10px] text-slate-400">
              per request
            </p>
          </div>
        </div>
      )}
    </DashboardCard>
  );
});

AgentPerformanceWidget.displayName = 'AgentPerformanceWidget';

export default AgentPerformanceWidget;
