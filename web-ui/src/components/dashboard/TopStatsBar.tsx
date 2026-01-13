'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Server,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { HelpTooltip, AnimatedCounter } from '@/components/common';

// ============================================================================
// Types
// ============================================================================

export interface StatItem {
  id: string;
  label: string;
  value: string | number;
  change?: number; // percentage change
  changeLabel?: string;
  status?: 'normal' | 'success' | 'warning' | 'critical';
  href?: string;
  icon?: 'activity' | 'alert' | 'server' | 'cost';
  tooltip?: string; // Help tooltip explaining this metric
}

export interface TopStatsBarProps {
  stats: StatItem[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Icon Map
// ============================================================================

const iconMap = {
  activity: Activity,
  alert: AlertTriangle,
  server: Server,
  cost: DollarSign,
};

// ============================================================================
// StatCard Component
// ============================================================================

function StatCard({ stat, loading }: { stat: StatItem; loading?: boolean }) {
  const Icon = stat.icon ? iconMap[stat.icon] : Activity;

  const statusColors = {
    normal: 'text-slate-900 dark:text-white',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
  };

  const statusBg = {
    normal: 'bg-slate-100 dark:bg-slate-700/50',
    success: 'bg-green-100 dark:bg-green-500/20',
    warning: 'bg-amber-100 dark:bg-amber-500/20',
    critical: 'bg-red-100 dark:bg-red-500/20',
  };

  const statusIconColor = {
    normal: 'text-slate-500 dark:text-slate-400',
    success: 'text-green-500 dark:text-green-400',
    warning: 'text-amber-500 dark:text-amber-400',
    critical: 'text-red-500 dark:text-red-400',
  };

  const content = (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div className={`p-2 rounded-lg ${statusBg[stat.status || 'normal']}`}>
        <Icon className={`w-4 h-4 ${statusIconColor[stat.status || 'normal']}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {stat.label}
          </p>
          {stat.tooltip && <HelpTooltip content={stat.tooltip} size="xs" />}
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ) : (
            <>
              <span className={`text-lg font-bold ${statusColors[stat.status || 'normal']}`}>
                {typeof stat.value === 'number' ? (
                  <AnimatedCounter
                    value={stat.value}
                    duration={400}
                    useLocale={true}
                    animateOnMount={false}
                  />
                ) : (
                  stat.value
                )}
              </span>
              {stat.change !== undefined && (
                <span
                  className={`flex items-center text-xs font-medium ${
                    stat.change >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {stat.change >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  <AnimatedCounter
                    value={Math.abs(stat.change)}
                    duration={400}
                    suffix="%"
                    animateOnMount={false}
                  />
                </span>
              )}
            </>
          )}
        </div>
        {stat.changeLabel && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{stat.changeLabel}</p>
        )}
      </div>
    </div>
  );

  if (stat.href) {
    return (
      <Link
        href={stat.href}
        className="block px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all group"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
      {content}
    </div>
  );
}

// ============================================================================
// TopStatsBar Component
// ============================================================================

export const TopStatsBar = memo(({ stats, loading, className = '' }: TopStatsBarProps) => {
  // Dynamically set columns based on number of stats
  const colsClass = stats.length === 5
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
    : 'grid-cols-2 md:grid-cols-4';

  return (
    <div className={`grid ${colsClass} gap-3 ${className}`}>
      {stats.map((stat) => (
        <StatCard key={stat.id} stat={stat} loading={loading} />
      ))}
    </div>
  );
});

TopStatsBar.displayName = 'TopStatsBar';

export default TopStatsBar;
