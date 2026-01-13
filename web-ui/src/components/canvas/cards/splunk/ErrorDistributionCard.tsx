'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface ErrorCategory {
  name: string;
  count: number;
  percentage?: number;
  source?: string;
  sourcetype?: string;
  trend?: 'up' | 'down' | 'stable';
  subCategories?: Array<{
    name: string;
    count: number;
  }>;
}

interface ErrorDistributionCardData {
  categories?: ErrorCategory[];
  errors?: ErrorCategory[];
  totalErrors?: number;
  timeRange?: string;
  index?: string;
}

interface ErrorDistributionCardProps {
  data: ErrorDistributionCardData;
  config?: {
    showSources?: boolean;
  };
}

const CATEGORY_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * ErrorDistributionCard - Errors by source/type (treemap-like)
 *
 * Shows:
 * - Horizontal bar chart of error categories
 * - Source/sourcetype breakdown
 * - Trend indicators
 */
export const ErrorDistributionCard = memo(({ data, config }: ErrorDistributionCardProps) => {
  const showSources = config?.showSources ?? true;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if ((!data || !data.categories?.length && !data.errors?.length) && demoMode) {
      const mockCategories: ErrorCategory[] = [
        { name: 'Authentication Failed', count: 2450, source: 'auth_service', trend: 'up' },
        { name: 'Connection Timeout', count: 1890, source: 'network', trend: 'stable' },
        { name: 'Permission Denied', count: 1245, source: 'access_control', trend: 'down' },
        { name: 'Invalid Input', count: 890, source: 'api_gateway', trend: 'up' },
        { name: 'Service Unavailable', count: 456, source: 'microservices', trend: 'stable' },
        { name: 'Database Error', count: 234, source: 'database', trend: 'down' },
      ];
      const totalErrors = mockCategories.reduce((sum, c) => sum + c.count, 0);
      const sorted = mockCategories.map((cat, idx) => ({
        ...cat,
        percentage: (cat.count / totalErrors) * 100,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }));
      return { categories: sorted, totalErrors, maxCount: sorted[0]?.count || 1 };
    }

    if (!data) return null;

    const categories = data.categories || data.errors || [];
    if (categories.length === 0) return null;

    const totalErrors = data.totalErrors ?? categories.reduce((sum, c) => sum + c.count, 0);

    // Sort by count and calculate percentages
    const sorted = [...categories]
      .sort((a, b) => b.count - a.count)
      .map((cat, idx) => ({
        ...cat,
        percentage: cat.percentage ?? (totalErrors > 0 ? (cat.count / totalErrors) * 100 : 0),
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }));

    const maxCount = sorted[0]?.count || 1;

    return {
      categories: sorted,
      totalErrors,
      maxCount,
    };
  }, [data]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No error data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Error Distribution
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {processedData.categories.length} types
          </span>
        </div>
      </div>

      {/* Total errors summary */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {formatNumber(processedData.totalErrors)}
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Errors</div>
          </div>

          {/* Mini treemap visualization */}
          <div className="flex-1 h-6 flex rounded overflow-hidden">
            {processedData.categories.slice(0, 6).map((cat, idx) => (
              <div
                key={cat.name}
                className={`${cat.color} transition-all duration-300`}
                style={{ width: `${cat.percentage}%` }}
                title={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          {processedData.categories.slice(0, 8).map((category) => (
            <div key={category.name}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-sm ${category.color} flex-shrink-0`} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {category.name}
                  </span>
                  {category.trend && (
                    <span className={`text-[10px] ${
                      category.trend === 'up'
                        ? 'text-red-500'
                        : category.trend === 'down'
                        ? 'text-emerald-500'
                        : 'text-slate-400'
                    }`}>
                      {category.trend === 'up' ? '↑' : category.trend === 'down' ? '↓' : '→'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatNumber(category.count)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums w-12 text-right">
                    {category.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${category.color}`}
                  style={{ width: `${(category.count / processedData.maxCount) * 100}%` }}
                />
              </div>

              {/* Source/sourcetype info */}
              {showSources && (category.source || category.sourcetype) && (
                <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                  {category.source && (
                    <span className="truncate">Source: {category.source}</span>
                  )}
                  {category.sourcetype && (
                    <span className="truncate">Type: {category.sourcetype}</span>
                  )}
                </div>
              )}

              {/* Subcategories preview */}
              {category.subCategories && category.subCategories.length > 0 && (
                <div className="mt-1 pl-4 space-y-0.5">
                  {category.subCategories.slice(0, 2).map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">└ {sub.name}</span>
                      <span className="tabular-nums">{formatNumber(sub.count)}</span>
                    </div>
                  ))}
                  {category.subCategories.length > 2 && (
                    <div className="text-[9px] text-slate-400 dark:text-slate-500">
                      +{category.subCategories.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {processedData.categories.length > 8 && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-3">
            +{processedData.categories.length - 8} more categories
          </div>
        )}
      </div>

      {/* Time range */}
      {data.timeRange && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            {data.timeRange}
          </div>
        </div>
      )}
    </div>
  );
});

ErrorDistributionCard.displayName = 'ErrorDistributionCard';

export default ErrorDistributionCard;
