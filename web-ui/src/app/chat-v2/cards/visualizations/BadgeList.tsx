'use client';

/**
 * BadgeList Visualization
 *
 * Displays a list of count badges (e.g., alert severity counts).
 * Used for alert summaries, issue counts by priority.
 * Enhanced with severity icons and visual polish.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { STATUS_COLORS } from '../types';

interface BadgeListProps {
  data: Record<string, number> | Array<{ label: string; value: number; color?: string }>;
  statusColors?: Record<string, string>;
  orientation?: 'horizontal' | 'vertical';
  showZero?: boolean;
  compact?: boolean;
}

// Severity icons
const SeverityIcons: Record<string, React.FC<{ className?: string }>> = {
  critical: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  high: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  major: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  medium: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  minor: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  low: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  p1: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  p2: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  p3: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  p4: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

export const BadgeList = memo(({
  data,
  statusColors = STATUS_COLORS,
  orientation = 'horizontal',
  showZero = false,
  compact = false,
}: BadgeListProps) => {
  // Normalize data
  const badges = useMemo(() => {
    if (Array.isArray(data)) {
      return data.map(item => ({
        label: item.label,
        value: item.value,
        color: item.color ?? statusColors[item.label.toLowerCase()] ?? '#6b7280',
      }));
    }

    // Filter out 'total' and optionally zeros
    return Object.entries(data)
      .filter(([key, value]) => key !== 'total' && (showZero || value > 0))
      .map(([label, value]) => ({
        label,
        value,
        color: statusColors[label.toLowerCase()] ?? '#6b7280',
      }));
  }, [data, statusColors, showZero]);

  // Calculate total
  const total = useMemo(
    () => badges.reduce((sum, b) => sum + b.value, 0),
    [badges]
  );

  if (badges.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No active alerts
      </div>
    );
  }

  // Use flex with wrap for better centering when there are few items
  const containerClass = orientation === 'horizontal'
    ? 'flex flex-wrap justify-center gap-3'
    : 'flex flex-col gap-2';

  return (
    <div className="h-full flex flex-col items-center justify-center p-3">
      <div className={containerClass}>
        {badges.map((badge, index) => {
          const IconComponent = SeverityIcons[badge.label.toLowerCase()] || DefaultIcon;

          return (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                flex flex-col items-center justify-center rounded-xl transition-all hover:scale-[1.02]
                ${compact ? 'p-2 min-w-[70px]' : 'p-3 min-w-[90px]'}
              `}
              style={{
                backgroundColor: `${badge.color}15`,
              }}
            >
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
              >
                <IconComponent className="w-4 h-4" />
              </div>

              {/* Count */}
              <span
                className={`font-bold tabular-nums ${compact ? 'text-xl' : 'text-2xl'}`}
                style={{ color: badge.color }}
              >
                {badge.value}
              </span>

              {/* Label */}
              <span className={`text-slate-600 dark:text-slate-400 capitalize text-center mt-1 ${compact ? 'text-[10px]' : 'text-xs'} font-medium`}>
                {formatLabel(badge.label)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Total */}
      {total > 0 && !compact && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-sm text-slate-500 dark:text-slate-400"
        >
          <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> total alerts
        </motion.div>
      )}
    </div>
  );
});

BadgeList.displayName = 'BadgeList';

// =============================================================================
// Inline Badge Row
// =============================================================================

interface BadgeRowProps {
  data: Record<string, number>;
  statusColors?: Record<string, string>;
}

export const BadgeRow = memo(({
  data,
  statusColors = STATUS_COLORS,
}: BadgeRowProps) => {
  const badges = useMemo(() => {
    return Object.entries(data)
      .filter(([key, value]) => key !== 'total' && value > 0)
      .map(([label, value]) => ({
        label,
        value,
        color: statusColors[label.toLowerCase()] ?? '#6b7280',
      }));
  }, [data, statusColors]);

  return (
    <div className="flex items-center gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${badge.color}20`,
            color: badge.color,
          }}
        >
          <span className="tabular-nums">{badge.value}</span>
          <span className="capitalize">{formatLabel(badge.label)}</span>
        </span>
      ))}
    </div>
  );
});

BadgeRow.displayName = 'BadgeRow';

// =============================================================================
// Helper Functions
// =============================================================================

function formatLabel(label: string): string {
  // Handle special cases
  if (label === 'p1') return 'P1';
  if (label === 'p2') return 'P2';
  if (label === 'p3') return 'P3';
  if (label === 'p4') return 'P4';

  return label
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}
