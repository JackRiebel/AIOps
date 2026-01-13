'use client';

import { memo } from 'react';
import { AIStatsGridData } from '@/types/session';
import {
  Wifi,
  Monitor,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Server,
  Signal,
  Zap,
  Clock,
  Shield,
} from 'lucide-react';

interface AIStatsGridCardProps {
  data: AIStatsGridData;
}

// Map icon names to components
const iconMap: Record<string, React.FC<{ className?: string }>> = {
  wifi: Wifi,
  device: Monitor,
  client: Users,
  clients: Users,
  alert: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle,
  check: CheckCircle,
  error: XCircle,
  offline: XCircle,
  activity: Activity,
  server: Server,
  signal: Signal,
  power: Zap,
  time: Clock,
  clock: Clock,
  security: Shield,
  shield: Shield,
};

/**
 * AIStatsGridCard - Display 2-6 related metrics in a grid
 *
 * Features:
 * - Responsive grid layout (2x2, 2x3, or 3x2)
 * - Optional icons per stat
 * - Status-based color coding
 */
export const AIStatsGridCard = memo(({ data }: AIStatsGridCardProps) => {
  if (!data || !data.stats || data.stats.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No stats data
      </div>
    );
  }

  const { title, stats } = data;

  // Status colors
  const getStatusColors = (status?: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-900/20',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
          icon: 'text-emerald-500',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
          icon: 'text-amber-500',
        };
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-600 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-500',
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-800/50',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-200 dark:border-slate-700',
          icon: 'text-slate-500',
        };
    }
  };

  // Determine grid columns based on stat count
  const gridCols = stats.length <= 2 ? 'grid-cols-2' :
                   stats.length <= 4 ? 'grid-cols-2' :
                   'grid-cols-3';

  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      {title && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div className={`flex-1 grid ${gridCols} gap-2 p-3`}>
        {stats.map((stat, index) => {
          const colors = getStatusColors(stat.status);
          const IconComponent = stat.icon ? iconMap[stat.icon.toLowerCase()] : null;

          return (
            <div
              key={index}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border ${colors.bg} ${colors.border}`}
            >
              {/* Icon */}
              {IconComponent && (
                <IconComponent className={`w-5 h-5 mb-1 ${colors.icon}`} />
              )}

              {/* Value */}
              <span className={`text-2xl font-bold tabular-nums ${colors.text}`}>
                {stat.value}
              </span>

              {/* Label */}
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 text-center mt-0.5 leading-tight">
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

AIStatsGridCard.displayName = 'AIStatsGridCard';

export default AIStatsGridCard;
