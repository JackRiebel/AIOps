'use client';

import type { MetricColor } from './types';

interface MetricBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: MetricColor;
  onClick?: () => void;
}

const colorMap: Record<MetricColor, string> = {
  slate: 'text-slate-600 dark:text-slate-400',
  green: 'text-green-600 dark:text-green-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  cyan: 'text-cyan-600 dark:text-cyan-400',
};

export function MetricBadge({ icon, label, value, color = 'slate', onClick }: MetricBadgeProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors' : ''
      }`}
    >
      <span className={colorMap[color]}>{icon}</span>
      <span className="text-xs text-slate-500 dark:text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${colorMap[color]}`}>{value}</span>
    </Component>
  );
}
