'use client';

/**
 * StatusGrid Visualization
 *
 * Displays a grid of status indicators.
 * Used for agent health, uplink status, device status grids.
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { STATUS_COLORS } from '../types';

interface StatusItem {
  id?: string;
  name: string;
  status: string;
  subtitle?: string;
  icon?: React.ReactNode;
  [key: string]: unknown;
}

interface StatusGridProps {
  data: StatusItem[];
  statusField?: string;
  nameField?: string;
  subtitleField?: string;
  statusColors?: Record<string, string>;
  compact?: boolean;
  columns?: number;
  onItemClick?: (item: StatusItem) => void;
}

export const StatusGrid = memo(({
  data,
  statusField = 'status',
  nameField = 'name',
  subtitleField,
  statusColors = STATUS_COLORS,
  compact = false,
  columns,
  onItemClick,
}: StatusGridProps) => {
  // Calculate optimal column count
  const itemCount = data.length;
  const cols = columns ?? (
    compact
      ? Math.min(6, Math.ceil(Math.sqrt(itemCount)))
      : itemCount <= 4 ? 2 : itemCount <= 9 ? 3 : 4
  );

  return (
    <div
      className={`grid gap-2 p-2`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {data.map((item, index) => {
        const status = String(item[statusField] ?? item.status ?? 'unknown').toLowerCase();
        const name = String(item[nameField] ?? item.name ?? 'Unknown');
        const subtitle = subtitleField ? String(item[subtitleField] ?? '') : item.subtitle;
        const color = statusColors[status] ?? STATUS_COLORS[status] ?? '#94a3b8';

        return (
          <motion.div
            key={item.id ?? index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onItemClick?.(item)}
            className={`
              relative rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30
              ${compact ? 'p-2' : 'p-3'}
              ${onItemClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600' : ''}
              transition-colors
            `}
          >
            {/* Status indicator */}
            <div
              className={`absolute ${compact ? 'top-1.5 right-1.5 w-2 h-2' : 'top-2 right-2 w-2.5 h-2.5'} rounded-full`}
              style={{ backgroundColor: color }}
            />

            {/* Content */}
            <div className="pr-4">
              <div className={`font-medium text-slate-900 dark:text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                {name}
              </div>
              {!compact && subtitle && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>

            {/* Status label (only when not compact) */}
            {!compact && (
              <div
                className="text-xs mt-2 font-medium capitalize"
                style={{ color }}
              >
                {status}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
});

StatusGrid.displayName = 'StatusGrid';

// =============================================================================
// Compact Status Dots
// =============================================================================

interface StatusDotsProps {
  data: StatusItem[];
  statusField?: string;
  statusColors?: Record<string, string>;
  size?: 'sm' | 'md';
}

export const StatusDots = memo(({
  data,
  statusField = 'status',
  statusColors = STATUS_COLORS,
  size = 'md',
}: StatusDotsProps) => {
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  const gap = size === 'sm' ? 'gap-1' : 'gap-1.5';

  return (
    <div className={`flex flex-wrap ${gap}`}>
      {data.map((item, index) => {
        const status = String(item[statusField] ?? item.status ?? 'unknown').toLowerCase();
        const color = statusColors[status] ?? STATUS_COLORS[status] ?? '#94a3b8';

        return (
          <motion.div
            key={item.id ?? index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.02 }}
            className={`${dotSize} rounded-full`}
            style={{ backgroundColor: color }}
            title={`${item.name}: ${status}`}
          />
        );
      })}
    </div>
  );
});

StatusDots.displayName = 'StatusDots';
