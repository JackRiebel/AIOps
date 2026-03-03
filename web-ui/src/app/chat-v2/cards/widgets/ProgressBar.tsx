'use client';

/**
 * ProgressBar Widget - Horizontal progress/utilization bar
 *
 * Features:
 * - Animated fill
 * - Color thresholds
 * - Label and value display
 * - Multiple segments support
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  thresholds?: {
    warning: number;
    critical: number;
  };
  color?: string;
  animate?: boolean;
}

export interface SegmentedProgressProps {
  segments: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  max?: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// =============================================================================
// Constants
// =============================================================================

const SIZE_CONFIG = {
  sm: { height: 'h-1', text: 'text-xs' },
  md: { height: 'h-1.5', text: 'text-sm' },
  lg: { height: 'h-2', text: 'text-sm' },
};

const COLORS = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  default: '#06b6d4',
};

// =============================================================================
// Component
// =============================================================================

export const ProgressBar = memo(({
  value,
  max = 100,
  label,
  showValue = true,
  unit = '%',
  size = 'md',
  thresholds,
  color,
  animate = true,
}: ProgressBarProps) => {
  const config = SIZE_CONFIG[size];
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Determine color based on value and thresholds
  const fillColor = useMemo(() => {
    if (color) return color;
    if (!thresholds) return COLORS.default;

    if (percentage >= thresholds.critical) return COLORS.critical;
    if (percentage >= thresholds.warning) return COLORS.warning;
    return COLORS.healthy;
  }, [color, percentage, thresholds]);

  return (
    <div className="space-y-1">
      {/* Header */}
      {(label || showValue) && (
        <div className={`flex items-center justify-between ${config.text}`}>
          {label && (
            <span className="text-slate-600 dark:text-slate-400 truncate">{label}</span>
          )}
          {showValue && (
            <span className="text-slate-900 dark:text-white font-medium tabular-nums ml-2">
              {value.toFixed(unit === '%' ? 0 : 1)}{unit}
            </span>
          )}
        </div>
      )}

      {/* Bar */}
      <div className={`w-full ${config.height} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        <motion.div
          className={`${config.height} rounded-full`}
          style={{ backgroundColor: fillColor }}
          initial={animate ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

// =============================================================================
// Segmented Progress Bar
// =============================================================================

export const SegmentedProgress = memo(({
  segments,
  max,
  showLabels = true,
  size = 'md',
}: SegmentedProgressProps) => {
  const config = SIZE_CONFIG[size];
  const total = max ?? segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className={`flex ${config.height} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        {segments.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          return (
            <motion.div
              key={`seg-${index}`}
              className={config.height}
              style={{ backgroundColor: segment.color }}
              initial={{ flex: 0 }}
              animate={{ flex: segment.value }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.1 }}
              title={segment.label ? `${segment.label}: ${percentage.toFixed(1)}%` : undefined}
            />
          );
        })}
      </div>

      {/* Legend */}
      {showLabels && (
        <div className="flex flex-wrap gap-3 text-xs">
          {segments.map((segment, index) => (
            <div key={`legend-${index}`} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-slate-600 dark:text-slate-400">
                {segment.label}
              </span>
              <span className="text-slate-900 dark:text-white font-medium tabular-nums">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SegmentedProgress.displayName = 'SegmentedProgress';

// =============================================================================
// Utilization Bar with Label
// =============================================================================

export interface UtilizationBarProps {
  label: string;
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const UtilizationBar = memo(({ label, value, max = 100, size = 'sm' }: UtilizationBarProps) => {
  const config = SIZE_CONFIG[size];
  const percentage = Math.min(100, (value / max) * 100);

  const color = useMemo(() => {
    if (percentage >= 80) return COLORS.critical;
    if (percentage >= 60) return COLORS.warning;
    return COLORS.healthy;
  }, [percentage]);

  return (
    <div className="flex items-center gap-2">
      <span className={`${config.text} text-slate-500 dark:text-slate-400 w-12 text-right`}>
        {label}
      </span>
      <div className={`flex-1 ${config.height} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        <motion.div
          className={`${config.height} rounded-full`}
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={`${config.text} text-slate-900 dark:text-white font-medium w-10 tabular-nums`}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
});

UtilizationBar.displayName = 'UtilizationBar';

export default ProgressBar;
