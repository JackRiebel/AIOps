'use client';

/**
 * StatCards Visualization
 *
 * Renders statistics as visually appealing mini-cards with:
 * - Contextual icons based on stat type
 * - Color coding (green for positive, red for issues, blue for neutral)
 * - Subtle gradients and backgrounds
 * - Optional ring/donut indicator for percentages
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface StatItem {
  label: string;
  value: number | string;
  icon?: string;
  color?: string;
  subtext?: string;
  percentage?: number; // 0-100 for ring indicator
}

interface StatCardsProps {
  data: StatItem[];
  compact?: boolean;
}

// Infer icon and color from label keywords
function inferStatStyle(label: string, value: number | string): { icon: string; color: string; bgColor: string } {
  const lowerLabel = label.toLowerCase();
  const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);

  // Online/Active states - Green
  if (lowerLabel.includes('online') || lowerLabel.includes('active') || lowerLabel.includes('up') || lowerLabel.includes('success')) {
    return {
      icon: 'check-circle',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
    };
  }

  // Offline/Down/Error states - Red
  if (lowerLabel.includes('offline') || lowerLabel.includes('down') || lowerLabel.includes('error') || lowerLabel.includes('fail')) {
    return {
      icon: 'x-circle',
      color: numValue === 0 ? '#10b981' : '#ef4444', // Green if zero errors
      bgColor: numValue === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
    };
  }

  // Warning/Alert states - Amber
  if (lowerLabel.includes('warning') || lowerLabel.includes('alert') || lowerLabel.includes('pending')) {
    return {
      icon: 'alert-triangle',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
    };
  }

  // Network/WiFi related - Cyan
  if (lowerLabel.includes('ap') || lowerLabel.includes('access point') || lowerLabel.includes('wifi') || lowerLabel.includes('wireless')) {
    return {
      icon: 'wifi',
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.1)',
    };
  }

  // SSID/Network names - Purple
  if (lowerLabel.includes('ssid') || lowerLabel.includes('network')) {
    return {
      icon: 'broadcast',
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.1)',
    };
  }

  // Client/User related - Blue
  if (lowerLabel.includes('client') || lowerLabel.includes('user') || lowerLabel.includes('device')) {
    return {
      icon: 'users',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
    };
  }

  // Totals/Counts - Slate
  if (lowerLabel.includes('total') || lowerLabel.includes('count') || lowerLabel.includes('all')) {
    return {
      icon: 'hash',
      color: '#64748b',
      bgColor: 'rgba(100, 116, 139, 0.1)',
    };
  }

  // Default - Slate blue
  return {
    icon: 'info',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
  };
}

// Icon components
const Icons: Record<string, React.FC<{ className?: string }>> = {
  'check-circle': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'x-circle': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'alert-triangle': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  'wifi': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  'broadcast': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
  'users': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  'hash': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  'info': ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Single stat card component
const StatCard = memo(({ stat, index, total }: { stat: StatItem; index: number; total: number }) => {
  const style = useMemo(() => {
    if (stat.icon && stat.color) {
      return { icon: stat.icon, color: stat.color, bgColor: `${stat.color}15` };
    }
    return inferStatStyle(stat.label, stat.value);
  }, [stat.label, stat.value, stat.icon, stat.color]);

  const IconComponent = Icons[style.icon] || Icons['info'];
  const formattedValue = typeof stat.value === 'number'
    ? stat.value.toLocaleString()
    : stat.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex flex-col items-center justify-center p-3 rounded-xl transition-all hover:scale-[1.02]"
      style={{ backgroundColor: style.bgColor }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${style.color}20`, color: style.color }}
      >
        <IconComponent className="w-4 h-4" />
      </div>

      {/* Value */}
      <div
        className="text-2xl font-bold tabular-nums"
        style={{ color: style.color }}
      >
        {formattedValue}
      </div>

      {/* Label */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 font-medium">
        {stat.label}
      </div>

      {/* Optional subtext */}
      {stat.subtext && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
          {stat.subtext}
        </div>
      )}

      {/* Ring indicator for percentages */}
      {stat.percentage !== undefined && (
        <svg className="absolute top-2 right-2 w-6 h-6 -rotate-90">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-slate-200 dark:text-slate-700"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke={style.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${stat.percentage * 0.628} 62.8`}
          />
        </svg>
      )}
    </motion.div>
  );
});

StatCard.displayName = 'StatCard';

export const StatCards = memo(({ data, compact }: StatCardsProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-sm">
        No statistics available
      </div>
    );
  }

  // Determine grid columns based on item count
  const gridCols = data.length <= 2 ? 'grid-cols-2'
    : data.length === 3 ? 'grid-cols-3'
    : data.length === 4 ? 'grid-cols-4'
    : data.length <= 6 ? 'grid-cols-3'
    : 'grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-3 h-full w-full p-2 content-center`}>
      {data.map((stat, index) => (
        <StatCard
          key={`${stat.label}-${index}`}
          stat={stat}
          index={index}
          total={data.length}
        />
      ))}
    </div>
  );
});

StatCards.displayName = 'StatCards';
