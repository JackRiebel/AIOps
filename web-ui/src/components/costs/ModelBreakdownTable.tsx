'use client';

import { memo } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { type ModelBreakdown, getModelDisplayName, CHART_COLORS } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ModelBreakdownTableProps {
  models: ModelBreakdown[];
  totalCost: number;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// ModelBreakdownTable Component
// ============================================================================

export const ModelBreakdownTable = memo(({
  models,
  totalCost,
  loading = false,
  className = '',
}: ModelBreakdownTableProps) => {
  // Loading state
  if (loading) {
    return (
      <DashboardCard
        title="Cost by Model"
        icon={<Cpu className="w-4 h-4" />}
        accent="purple"
        compact
        className={className}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading model data...</p>
        </div>
      </DashboardCard>
    );
  }

  // Empty state
  if (models.length === 0) {
    return (
      <DashboardCard
        title="Cost by Model"
        icon={<Cpu className="w-4 h-4" />}
        accent="purple"
        compact
        className={className}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 mb-3 bg-purple-100 dark:bg-purple-500/10 rounded-full flex items-center justify-center">
            <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No model data</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Model breakdown will appear here</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Cost by Model"
      icon={<Cpu className="w-4 h-4" />}
      accent="purple"
      compact
      className={className}
    >
      <div className="overflow-x-auto -mx-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Model
              </th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Queries
              </th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Tokens
              </th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Share
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {models.map((model, idx) => {
              const pct = totalCost > 0 ? (model.cost_usd / totalCost) * 100 : 0;
              const color = CHART_COLORS[idx % CHART_COLORS.length];

              return (
                <tr
                  key={model.model}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {getModelDisplayName(model.model)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                    {model.queries.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                    {(model.total_tokens / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                    ${model.cost_usd.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
});

ModelBreakdownTable.displayName = 'ModelBreakdownTable';

export default ModelBreakdownTable;
