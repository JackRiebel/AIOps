'use client';

/**
 * HealthGauge Widget - Circular progress gauge for health scores
 *
 * Features:
 * - Animated circular progress
 * - Color thresholds (healthy/warning/critical)
 * - Trend indicators
 * - Multiple sizes
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// Types
// =============================================================================

export interface HealthGaugeProps {
  /** Health value 0-100 */
  value: number;
  /** Label displayed below the gauge */
  label: string;
  /** Optional trend indicator */
  trend?: 'up' | 'down' | 'stable';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom thresholds for color coding */
  thresholds?: {
    warning: number;
    critical: number;
  };
  /** Whether to show the numeric value */
  showValue?: boolean;
  /** Animation enabled */
  animate?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SIZE_CONFIG = {
  sm: { width: 72, height: 72, strokeWidth: 6, fontSize: 14, labelSize: 9 },
  md: { width: 100, height: 100, strokeWidth: 8, fontSize: 20, labelSize: 11 },
  lg: { width: 140, height: 140, strokeWidth: 10, fontSize: 28, labelSize: 12 },
};

const COLORS = {
  healthy: '#10b981',  // emerald-500
  warning: '#f59e0b',  // amber-500
  critical: '#ef4444', // red-500
  background: 'rgba(148, 163, 184, 0.15)',
};

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const TREND_COLORS = {
  up: '#10b981',
  down: '#ef4444',
  stable: '#6b7280',
};

// =============================================================================
// Component
// =============================================================================

export const HealthGauge = memo(({
  value,
  label,
  trend,
  size = 'md',
  thresholds = { warning: 80, critical: 50 },
  showValue = true,
  animate = true,
}: HealthGaugeProps) => {
  const config = SIZE_CONFIG[size];

  // Calculate arc properties
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value)) / 100;
  const strokeDashoffset = circumference * (1 - progress);

  // Determine color based on value and thresholds
  const color = useMemo(() => {
    if (value >= thresholds.warning) return COLORS.healthy;
    if (value >= thresholds.critical) return COLORS.warning;
    return COLORS.critical;
  }, [value, thresholds]);

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <svg
          width={config.width}
          height={config.height}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke={COLORS.background}
            strokeWidth={config.strokeWidth}
          />

          {/* Progress circle */}
          <motion.circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>

        {/* Center content */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              className="flex items-center gap-0.5"
              initial={animate ? { opacity: 0, scale: 0.8 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <span
                className="font-bold tabular-nums"
                style={{ fontSize: config.fontSize, color }}
              >
                {Math.round(value)}
              </span>
              {trend && (
                <span
                  className="font-medium"
                  style={{
                    fontSize: config.fontSize * 0.6,
                    color: TREND_COLORS[trend],
                  }}
                >
                  {TREND_ICONS[trend]}
                </span>
              )}
            </motion.div>
          </div>
        )}
      </div>

      {/* Label */}
      <span
        className="mt-1.5 text-slate-500 dark:text-slate-400 text-center leading-tight"
        style={{ fontSize: config.labelSize }}
      >
        {label}
      </span>
    </div>
  );
});

HealthGauge.displayName = 'HealthGauge';

// =============================================================================
// Grid Layout Component
// =============================================================================

export interface GaugeGridProps {
  gauges: Array<{
    value: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  size?: 'sm' | 'md' | 'lg';
  columns?: number;
}

export const GaugeGrid = memo(({ gauges, size = 'sm', columns = 4 }: GaugeGridProps) => {
  return (
    <div
      className="grid gap-3 justify-items-center"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {gauges.map((gauge, index) => (
        <HealthGauge
          key={`gauge-${index}-${gauge.label}`}
          value={gauge.value}
          label={gauge.label}
          trend={gauge.trend}
          size={size}
        />
      ))}
    </div>
  );
});

GaugeGrid.displayName = 'GaugeGrid';

export default HealthGauge;
