'use client';

/**
 * DonutChart Visualization
 *
 * Displays a donut/pie chart for distributions.
 * Used for network health, severity breakdowns, etc.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { STATUS_COLORS } from '../types';

interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutSegment[] | Record<string, number>;
  showLegend?: boolean;
  showValues?: boolean;
  showCenter?: boolean;
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
  colors?: Record<string, string>;
}

export const DonutChart = memo(({
  data,
  showLegend = true,
  showValues = true,
  showCenter = true,
  centerLabel,
  size = 140,
  strokeWidth = 24,
  colors = STATUS_COLORS,
}: DonutChartProps) => {
  // Normalize data to segments array
  const segments = useMemo((): DonutSegment[] => {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data.map(d => ({
        ...d,
        color: d.color ?? colors[d.label.toLowerCase()] ?? getDefaultColor(d.label),
      }));
    }

    // Convert object to segments
    return Object.entries(data)
      .filter(([key]) => key !== 'total')
      .map(([label, value]) => ({
        label,
        value,
        color: colors[label.toLowerCase()] ?? getDefaultColor(label),
      }));
  }, [data, colors]);

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.value, 0),
    [segments]
  );

  // Calculate arc paths
  const arcs = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let currentAngle = -90; // Start at top

    return segments.map(segment => {
      const percentage = total > 0 ? segment.value / total : 0;
      const arcLength = percentage * circumference;
      const startAngle = currentAngle;

      currentAngle += percentage * 360;

      return {
        ...segment,
        percentage,
        arcLength,
        startAngle,
        radius,
        circumference,
      };
    });
  }, [segments, size, strokeWidth, total]);

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  return (
    <div className="flex items-center justify-center gap-4 h-full py-2">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.1)"
            strokeWidth={strokeWidth}
          />

          {/* Segments */}
          {arcs.map((arc, index) => (
            <motion.circle
              key={arc.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.arcLength} ${arc.circumference}`}
              strokeDashoffset={-arcs
                .slice(0, index)
                .reduce((sum, a) => sum + a.arcLength, 0)}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${arc.circumference}` }}
              animate={{ strokeDasharray: `${arc.arcLength} ${arc.circumference}` }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
            />
          ))}
        </svg>

        {/* Center text */}
        {showCenter && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-slate-900 dark:text-white"
            >
              {total}
            </motion.span>
            {centerLabel && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-1.5 min-w-0">
          {segments.map((segment, index) => (
            <motion.div
              key={segment.label}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-slate-700 dark:text-slate-300 capitalize truncate">
                {formatLabel(segment.label)}
              </span>
              {showValues && (
                <span className="text-slate-500 ml-auto tabular-nums">
                  {segment.value}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
});

DonutChart.displayName = 'DonutChart';

// =============================================================================
// Helper Functions
// =============================================================================

function formatLabel(label: string): string {
  return label
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

function getDefaultColor(label: string): string {
  // Generate consistent color based on label hash
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}
