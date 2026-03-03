'use client';

/**
 * StatusIndicator Widget - Status dot with optional label and count
 *
 * Features:
 * - Animated pulse effect for active alerts
 * - Color-coded status levels
 * - Flexible sizing
 * - Summary grid layout
 */

import { memo } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

export type StatusLevel = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface StatusIndicatorProps {
  status: StatusLevel;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  label?: string;
  count?: number;
  showLabel?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#10b981',  // emerald-500
  warning: '#f59e0b',  // amber-500
  critical: '#ef4444', // red-500
  offline: '#6b7280',  // gray-500
  unknown: '#94a3b8',  // slate-400
};

const SIZE_CONFIG = {
  sm: { dot: 'w-2 h-2', text: 'text-xs', gap: 'gap-1.5' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-sm', gap: 'gap-2' },
  lg: { dot: 'w-3 h-3', text: 'text-base', gap: 'gap-2' },
};

// =============================================================================
// Component
// =============================================================================

export const StatusIndicator = memo(({
  status,
  size = 'md',
  pulse = false,
  label,
  count,
  showLabel = true,
}: StatusIndicatorProps) => {
  const color = STATUS_COLORS[status];
  const config = SIZE_CONFIG[size];

  return (
    <div className={`flex items-center ${config.gap}`}>
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        <div
          className={`${config.dot} rounded-full`}
          style={{ backgroundColor: color }}
        />
        {pulse && (
          <motion.div
            className={`absolute inset-0 ${config.dot} rounded-full`}
            style={{ backgroundColor: color }}
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Label and count */}
      {showLabel && (label || count !== undefined) && (
        <div className={`flex items-center gap-1 ${config.text}`}>
          {label && (
            <span className="text-slate-600 dark:text-slate-400">{label}</span>
          )}
          {count !== undefined && (
            <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

// =============================================================================
// Summary Component
// =============================================================================

export interface StatusSummaryProps {
  summary: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  size?: 'sm' | 'md' | 'lg';
  wrap?: boolean;
}

export const StatusSummary = memo(({ summary, size = 'md', wrap = true }: StatusSummaryProps) => {
  return (
    <div className={`flex items-center gap-4 ${wrap ? 'flex-wrap' : ''}`}>
      {summary.map((item, index) => (
        <StatusIndicator
          key={`${item.status}-${index}`}
          status={item.status}
          label={item.label}
          count={item.count}
          pulse={item.pulse}
          size={size}
        />
      ))}
    </div>
  );
});

StatusSummary.displayName = 'StatusSummary';

// =============================================================================
// Badge Variant
// =============================================================================

export interface StatusBadgeProps {
  status: StatusLevel;
  label: string;
  count?: number;
  compact?: boolean;
}

export const StatusBadge = memo(({ status, label, count, compact = false }: StatusBadgeProps) => {
  const color = STATUS_COLORS[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}10`,
      }}
    >
      <div
        className={compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}
        style={{ backgroundColor: color, borderRadius: '50%' }}
      />
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      {count !== undefined && (
        <span
          className="font-semibold tabular-nums"
          style={{ color }}
        >
          {count}
        </span>
      )}
    </div>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusIndicator;
