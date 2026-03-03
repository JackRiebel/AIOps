'use client';

/**
 * BigNumber Visualization
 *
 * Displays a single large metric with optional trend indicator.
 * Used for client counts, totals, key metrics.
 * Enhanced with contextual icons and visual polish.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface BigNumberProps {
  value: number | string;
  label?: string;
  unit?: string;
  trend?: number; // Positive = up, negative = down
  trendLabel?: string;
  precision?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  icon?: string;
}

// Infer icon and color from label
function inferStyle(label?: string): { icon: React.FC<{ className?: string }>; color: string; bgColor: string } {
  const lower = (label || '').toLowerCase();

  if (lower.includes('client') || lower.includes('user') || lower.includes('device')) {
    return { icon: UsersIcon, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' };
  }
  if (lower.includes('online') || lower.includes('active') || lower.includes('up')) {
    return { icon: CheckIcon, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' };
  }
  if (lower.includes('offline') || lower.includes('down') || lower.includes('error')) {
    return { icon: XIcon, color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
  }
  if (lower.includes('alert') || lower.includes('warning')) {
    return { icon: AlertIcon, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' };
  }
  if (lower.includes('network') || lower.includes('connection')) {
    return { icon: NetworkIcon, color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.1)' };
  }
  if (lower.includes('event') || lower.includes('log')) {
    return { icon: EventIcon, color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' };
  }

  // Default
  return { icon: ChartIcon, color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.1)' };
}

export const BigNumber = memo(({
  value,
  label,
  unit,
  trend,
  trendLabel,
  precision = 0,
  size = 'md',
  color,
}: BigNumberProps) => {
  const formattedValue = typeof value === 'number'
    ? formatNumber(value, precision)
    : value;

  const style = useMemo(() => inferStyle(label), [label]);
  const effectiveColor = color || style.color;

  const sizeConfig = {
    sm: { text: 'text-3xl', icon: 'w-10 h-10', iconInner: 'w-5 h-5' },
    md: { text: 'text-5xl', icon: 'w-14 h-14', iconInner: 'w-7 h-7' },
    lg: { text: 'text-6xl', icon: 'w-16 h-16', iconInner: 'w-8 h-8' },
  };

  const config = sizeConfig[size];
  const IconComponent = style.icon;

  const trendColor = trend !== undefined
    ? trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'
    : undefined;

  const TrendIcon = trend !== undefined
    ? trend > 0 ? TrendUpIcon : trend < 0 ? TrendDownIcon : TrendNeutralIcon
    : null;

  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`${config.icon} rounded-2xl flex items-center justify-center mb-3`}
        style={{ backgroundColor: style.bgColor, color: effectiveColor }}
      >
        <IconComponent className={config.iconInner} />
      </motion.div>

      {/* Value */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-baseline gap-1"
      >
        <span
          className={`font-bold tabular-nums ${config.text}`}
          style={{ color: effectiveColor }}
        >
          {formattedValue}
        </span>
        {unit && (
          <span className="text-slate-500 dark:text-slate-400 text-lg font-medium">{unit}</span>
        )}
      </motion.div>

      {/* Label */}
      {label && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium"
        >
          {label}
        </motion.span>
      )}

      {/* Trend */}
      {trend !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`flex items-center gap-1 mt-2 ${trendColor}`}
        >
          {TrendIcon && <TrendIcon />}
          <span className="text-sm font-medium">
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && (
            <span className="text-slate-500 text-xs">{trendLabel}</span>
          )}
        </motion.div>
      )}
    </div>
  );
});

BigNumber.displayName = 'BigNumber';

// =============================================================================
// Helper Functions
// =============================================================================

function formatNumber(value: number, precision: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return value.toFixed(precision);
}

// =============================================================================
// Icons
// =============================================================================

// Contextual icons for different metric types
const UsersIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const NetworkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);

const EventIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const ChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Trend icons
const TrendUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const TrendDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

const TrendNeutralIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
  </svg>
);
