'use client';

/**
 * Gauge Visualization
 *
 * Displays a gauge meter for single values with thresholds.
 * Used for health scores, utilization, quality metrics.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ThresholdConfig } from '../types';

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  thresholds?: ThresholdConfig[];
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const DEFAULT_THRESHOLDS: ThresholdConfig[] = [
  { value: 33, color: '#ef4444', label: 'Poor' },
  { value: 66, color: '#f59e0b', label: 'Fair' },
  { value: 100, color: '#10b981', label: 'Good' },
];

export const Gauge = memo(({
  value,
  min = 0,
  max = 100,
  label,
  unit = '%',
  thresholds = DEFAULT_THRESHOLDS,
  size = 'md',
  showValue = true,
}: GaugeProps) => {
  // Normalize value to 0-100 range (guard against division by zero when max === min)
  const normalizedValue = useMemo(() => {
    if (max === min) return value >= max ? 100 : 0;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  }, [value, min, max]);

  // Get color based on thresholds
  const color = useMemo(() => {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    for (const threshold of sorted) {
      if (normalizedValue <= threshold.value) {
        return threshold.color;
      }
    }
    return sorted[sorted.length - 1]?.color ?? '#10b981';
  }, [normalizedValue, thresholds]);

  // Get status label based on thresholds
  const statusLabel = useMemo(() => {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    for (const threshold of sorted) {
      if (normalizedValue <= threshold.value) {
        return threshold.label;
      }
    }
    return sorted[sorted.length - 1]?.label;
  }, [normalizedValue, thresholds]);

  const sizeConfig = {
    sm: { diameter: 80, strokeWidth: 8, fontSize: 'text-lg' },
    md: { diameter: 120, strokeWidth: 10, fontSize: 'text-2xl' },
    lg: { diameter: 160, strokeWidth: 12, fontSize: 'text-3xl' },
  };

  const config = sizeConfig[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;
  const center = config.diameter / 2;

  return (
    <div className="flex flex-col items-center justify-center h-full py-2">
      <div className="relative" style={{ width: config.diameter, height: config.diameter / 2 + 20 }}>
        <svg
          width={config.diameter}
          height={config.diameter / 2 + config.strokeWidth}
          className="overflow-visible"
        >
          {/* Background arc */}
          <path
            d={describeArc(center, center, radius, -180, 0)}
            fill="none"
            stroke="rgba(148, 163, 184, 0.15)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />

          {/* Threshold segments (optional background indicators) */}
          {thresholds.map((threshold, index) => {
            const prevValue = index > 0 ? thresholds[index - 1].value : 0;
            const startAngle = -180 + (prevValue / 100) * 180;
            const endAngle = -180 + (threshold.value / 100) * 180;

            return (
              <path
                key={index}
                d={describeArc(center, center, radius, startAngle, endAngle)}
                fill="none"
                stroke={`${threshold.color}20`}
                strokeWidth={config.strokeWidth}
                strokeLinecap="round"
              />
            );
          })}

          {/* Value arc */}
          <motion.path
            d={describeArc(center, center, radius, -180, 0)}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center"
          >
            <span className={`font-bold text-slate-900 dark:text-white ${config.fontSize} tabular-nums`}>
              {Math.round(value)}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm ml-0.5">{unit}</span>
          </motion.div>
        )}
      </div>

      {/* Labels */}
      <div className="flex flex-col items-center mt-1">
        {label && (
          <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        )}
        {statusLabel && (
          <span className="text-xs font-medium" style={{ color }}>
            {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
});

Gauge.displayName = 'Gauge';

// =============================================================================
// Multi-Gauge Component
// =============================================================================

interface MultiGaugeData {
  value: number;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  inverted?: boolean; // If true, lower values are better (e.g., packet loss, latency)
  thresholds?: ThresholdConfig[]; // Per-item thresholds
}

// Thresholds for metrics where lower is better (latency, packet loss, jitter)
const INVERTED_THRESHOLDS: ThresholdConfig[] = [
  { value: 33, color: '#10b981', label: 'Good' },   // Low values = Good
  { value: 66, color: '#f59e0b', label: 'Fair' },   // Mid values = Fair
  { value: 100, color: '#ef4444', label: 'Poor' },  // High values = Poor
];

interface MultiGaugeProps {
  data: MultiGaugeData[];
  thresholds?: ThresholdConfig[];
}

export const MultiGauge = memo(({
  data,
  thresholds = DEFAULT_THRESHOLDS,
}: MultiGaugeProps) => {
  return (
    <div className="flex items-center justify-around h-full py-2 gap-4">
      {data.map((item, index) => {
        // Determine which thresholds to use:
        // 1. Item-specific thresholds
        // 2. Inverted thresholds if item.inverted is true
        // 3. Global thresholds passed to MultiGauge
        // 4. Default thresholds
        const itemThresholds = item.thresholds
          ?? (item.inverted ? INVERTED_THRESHOLDS : thresholds);

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex-1 min-w-0"
          >
            <Gauge
              value={item.value}
              label={item.label}
              unit={item.unit ?? '%'}
              min={item.min ?? 0}
              max={item.max ?? 100}
              thresholds={itemThresholds}
              size="sm"
            />
          </motion.div>
        );
      })}
    </div>
  );
});

MultiGauge.displayName = 'MultiGauge';

// =============================================================================
// Helper Functions
// =============================================================================

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}
