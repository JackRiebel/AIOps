'use client';

import { memo, useMemo } from 'react';

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  unit?: string;
  showValue?: boolean;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  invertThresholds?: boolean; // For metrics where lower is worse
  colors?: {
    good?: string;
    warning?: string;
    critical?: string;
    background?: string;
  };
  className?: string;
}

/**
 * Gauge - Circular progress indicator for metrics
 *
 * Features:
 * - Semicircular or full circle options
 * - Threshold-based coloring
 * - Animated transitions
 * - Responsive sizing
 */
export const Gauge = memo(({
  value,
  min = 0,
  max = 100,
  size = 80,
  strokeWidth = 8,
  label,
  unit = '%',
  showValue = true,
  thresholds = { warning: 70, critical: 90 },
  invertThresholds = false,
  colors = {
    good: 'rgb(34, 197, 94)',      // green-500
    warning: 'rgb(245, 158, 11)',  // amber-500
    critical: 'rgb(239, 68, 68)',  // red-500
    background: 'rgb(226, 232, 240)', // slate-200
  },
  className = '',
}: GaugeProps) => {
  const { percentage, color, arcPath, valueArcPath } = useMemo(() => {
    const clampedValue = Math.max(min, Math.min(max, value));
    const pct = ((clampedValue - min) / (max - min)) * 100;

    // Determine color based on thresholds
    let gaugeColor = colors.good!;
    if (invertThresholds) {
      // Lower is worse (e.g., battery, SLA compliance)
      if (thresholds.critical !== undefined && pct <= thresholds.critical) {
        gaugeColor = colors.critical!;
      } else if (thresholds.warning !== undefined && pct <= thresholds.warning) {
        gaugeColor = colors.warning!;
      }
    } else {
      // Higher is worse (e.g., CPU usage, packet loss)
      if (thresholds.critical !== undefined && pct >= thresholds.critical) {
        gaugeColor = colors.critical!;
      } else if (thresholds.warning !== undefined && pct >= thresholds.warning) {
        gaugeColor = colors.warning!;
      }
    }

    // Calculate arc parameters (semicircle from -180 to 0 degrees)
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    // Start from left (-180 deg) to right (0 deg) at the bottom
    const startAngle = -180;
    const endAngle = 0;
    const angleRange = endAngle - startAngle;

    // Background arc (full semicircle)
    const bgStartRad = (startAngle * Math.PI) / 180;
    const bgEndRad = (endAngle * Math.PI) / 180;

    const bgStartX = center + radius * Math.cos(bgStartRad);
    const bgStartY = center + radius * Math.sin(bgStartRad);
    const bgEndX = center + radius * Math.cos(bgEndRad);
    const bgEndY = center + radius * Math.sin(bgEndRad);

    const bgArc = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 0 1 ${bgEndX} ${bgEndY}`;

    // Value arc
    const valueAngle = startAngle + (pct / 100) * angleRange;
    const valueRad = (valueAngle * Math.PI) / 180;
    const valueEndX = center + radius * Math.cos(valueRad);
    const valueEndY = center + radius * Math.sin(valueRad);

    const largeArc = pct > 50 ? 1 : 0;
    const valueArc = pct > 0
      ? `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${valueEndX} ${valueEndY}`
      : '';

    return {
      percentage: pct,
      color: gaugeColor,
      arcPath: bgArc,
      valueArcPath: valueArc,
    };
  }, [value, min, max, size, strokeWidth, thresholds, invertThresholds, colors]);

  const displayValue = typeof value === 'number' && !isNaN(value)
    ? value.toFixed(value % 1 === 0 ? 0 : 1)
    : '--';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={colors.background}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="dark:stroke-slate-700"
        />

        {/* Value arc */}
        {valueArcPath && (
          <path
            d={valueArcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>

      {/* Center value */}
      {showValue && (
        <div
          className="flex flex-col items-center -mt-2"
          style={{ marginTop: -(size / 4 + 4) }}
        >
          <span
            className="text-xl font-bold tabular-nums leading-none"
            style={{ color }}
          >
            {displayValue}
            <span className="text-xs font-medium ml-0.5 opacity-70">{unit}</span>
          </span>
        </div>
      )}

      {/* Label */}
      {label && (
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 text-center">
          {label}
        </span>
      )}
    </div>
  );
});

Gauge.displayName = 'Gauge';

export default Gauge;
