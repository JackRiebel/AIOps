'use client';

import { useMemo } from 'react';
import { Sparkles, Database, FileText, AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CostBreakdownItem {
  category: string;
  label: string;
  cost: number;
  count: number;
  icon: 'ai' | 'api' | 'summary' | 'other';
}

interface SessionCostBreakdownProps {
  totalCost: number;
  breakdown: CostBreakdownItem[];
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

function getIcon(type: CostBreakdownItem['icon']) {
  switch (type) {
    case 'ai':
      return <Sparkles className="w-3.5 h-3.5" />;
    case 'api':
      return <Database className="w-3.5 h-3.5" />;
    case 'summary':
      return <FileText className="w-3.5 h-3.5" />;
    default:
      return <AlertCircle className="w-3.5 h-3.5" />;
  }
}

function getCategoryColor(type: CostBreakdownItem['icon']): { bar: string; text: string; bg: string } {
  switch (type) {
    case 'ai':
      return { bar: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/10' };
    case 'api':
      return { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    case 'summary':
      return { bar: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' };
    default:
      return { bar: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/10' };
  }
}

// ============================================================================
// Component
// ============================================================================

export function SessionCostBreakdown({ totalCost, breakdown, className = '' }: SessionCostBreakdownProps) {
  const sortedBreakdown = useMemo(() => {
    return [...breakdown].sort((a, b) => b.cost - a.cost);
  }, [breakdown]);

  const maxCost = useMemo(() => {
    if (sortedBreakdown.length === 0) return 1;
    return Math.max(...sortedBreakdown.map(item => item.cost));
  }, [sortedBreakdown]);

  if (breakdown.length === 0 || totalCost === 0) {
    return (
      <div className={`bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          No cost breakdown available
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Cost Breakdown
        </h4>
        <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
          {formatCost(totalCost)}
        </span>
      </div>

      {/* Breakdown Items */}
      <div className="p-4 space-y-3">
        {sortedBreakdown.map((item, index) => {
          const colors = getCategoryColor(item.icon);
          const percentage = totalCost > 0 ? (item.cost / totalCost) * 100 : 0;
          const barWidth = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;

          return (
            <div key={`${item.category}-${index}`} className="space-y-1.5">
              {/* Label Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${colors.bg}`}>
                    <span className={colors.text}>{getIcon(item.icon)}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.label}
                  </span>
                  {item.count > 0 && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      ({item.count})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
                    {formatCost(item.cost)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 w-10 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700/30 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Total operations: {breakdown.reduce((sum, item) => sum + item.count, 0)}</span>
          <span>
            Avg: {formatCost(totalCost / Math.max(1, breakdown.reduce((sum, item) => sum + item.count, 0)))}/op
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper to build breakdown from session data
// ============================================================================

export function buildCostBreakdown(session: {
  ai_query_count?: number;
  api_call_count?: number;
  total_cost_usd?: number;
  cost_breakdown?: {
    ai_queries?: number;
    api_calls?: number;
    summary?: number;
    other?: number;
  };
}): CostBreakdownItem[] {
  const breakdown: CostBreakdownItem[] = [];
  const costData = session.cost_breakdown || {};

  // AI Queries
  if (session.ai_query_count && session.ai_query_count > 0) {
    breakdown.push({
      category: 'ai_queries',
      label: 'AI Queries',
      cost: costData.ai_queries || (session.total_cost_usd || 0) * 0.75,
      count: session.ai_query_count,
      icon: 'ai',
    });
  }

  // API Calls
  if (session.api_call_count && session.api_call_count > 0) {
    breakdown.push({
      category: 'api_calls',
      label: 'API Enrichment',
      cost: costData.api_calls || 0,
      count: session.api_call_count,
      icon: 'api',
    });
  }

  // Summary generation
  if (costData.summary && costData.summary > 0) {
    breakdown.push({
      category: 'summary',
      label: 'Session Summary',
      cost: costData.summary,
      count: 1,
      icon: 'summary',
    });
  }

  // Other costs
  if (costData.other && costData.other > 0) {
    breakdown.push({
      category: 'other',
      label: 'Other',
      cost: costData.other,
      count: 0,
      icon: 'other',
    });
  }

  return breakdown;
}

export default SessionCostBreakdown;
