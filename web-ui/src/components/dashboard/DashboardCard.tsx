'use client';

import { memo, type ReactNode } from 'react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export type CardAccent = 'cyan' | 'purple' | 'amber' | 'green' | 'blue' | 'red' | 'slate';

export interface DashboardCardProps {
  title: string;
  icon: ReactNode;
  href?: string;
  linkText?: string;
  accent?: CardAccent;
  children: ReactNode;
  loading?: boolean;
  className?: string;
  badge?: ReactNode;
  compact?: boolean;
}

// ============================================================================
// Accent Color Mapping
// ============================================================================

const accentColors: Record<CardAccent, { border: string; iconBg: string }> = {
  cyan: {
    border: 'hover:border-cyan-300 dark:hover:border-cyan-500/30',
    iconBg: 'text-cyan-600 dark:text-cyan-400',
  },
  purple: {
    border: 'hover:border-purple-300 dark:hover:border-purple-500/30',
    iconBg: 'text-purple-600 dark:text-purple-400',
  },
  amber: {
    border: 'hover:border-amber-300 dark:hover:border-amber-500/30',
    iconBg: 'text-amber-600 dark:text-amber-400',
  },
  green: {
    border: 'hover:border-green-300 dark:hover:border-green-500/30',
    iconBg: 'text-green-600 dark:text-green-400',
  },
  blue: {
    border: 'hover:border-blue-300 dark:hover:border-blue-500/30',
    iconBg: 'text-blue-600 dark:text-blue-400',
  },
  red: {
    border: 'hover:border-red-300 dark:hover:border-red-500/30',
    iconBg: 'text-red-600 dark:text-red-400',
  },
  slate: {
    border: 'hover:border-slate-300 dark:hover:border-slate-500/30',
    iconBg: 'text-slate-600 dark:text-slate-400',
  },
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-slate-100 dark:bg-slate-700 rounded" />
          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-700 rounded" />
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded" />
      <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-700 rounded" />
    </div>
  );
}

// ============================================================================
// DashboardCard Component
// ============================================================================

export const DashboardCard = memo(({
  title,
  icon,
  href,
  linkText = 'Details →',
  accent = 'slate',
  children,
  loading,
  className = '',
  badge,
  compact = false,
}: DashboardCardProps) => {
  const colors = accentColors[accent];

  return (
    <div className={`flex flex-col ${className}`}>
      {/* External Title Row */}
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <div className="flex items-center gap-2">
          <span className={colors.iconBg}>{icon}</span>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </h3>
          {badge}
        </div>
        {href && (
          <Link
            href={href}
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
          >
            {linkText}
          </Link>
        )}
      </div>

      {/* Card Body - Fixed minimum height for consistency (unless compact) */}
      <div
        className={`
          flex-1 ${compact ? '' : 'min-h-[180px]'}
          bg-white dark:bg-slate-800/60
          rounded-xl border border-slate-200 dark:border-slate-700/50
          p-4 transition-colors
          ${colors.border}
        `}
      >
        {loading ? <LoadingSkeleton /> : children}
      </div>
    </div>
  );
});

DashboardCard.displayName = 'DashboardCard';

export default DashboardCard;
