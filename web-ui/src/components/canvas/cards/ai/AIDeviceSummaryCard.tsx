'use client';

import { memo } from 'react';
import { AIDeviceSummaryData } from '@/types/session';
import { Monitor, Router, Wifi, Server, HardDrive } from 'lucide-react';

interface AIDeviceSummaryCardProps {
  data: AIDeviceSummaryData;
}

// Map device types to icons
const deviceTypeIcons: Record<string, React.FC<{ className?: string }>> = {
  'access point': Wifi,
  'ap': Wifi,
  'wireless': Wifi,
  'switch': Router,
  'router': Router,
  'mx': Router,
  'firewall': Router,
  'server': Server,
  'camera': Monitor,
  'sensor': HardDrive,
};

/**
 * AIDeviceSummaryCard - Display device/entity summary
 *
 * Features:
 * - Device type icon
 * - Status indicator
 * - Two-column attribute list
 * - Optional metrics with status colors
 */
export const AIDeviceSummaryCard = memo(({ data }: AIDeviceSummaryCardProps) => {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No device data
      </div>
    );
  }

  const { name, type, status, attributes, metrics } = data;

  // Get device icon
  const typeKey = type.toLowerCase();
  const DeviceIcon = Object.entries(deviceTypeIcons).find(([key]) =>
    typeKey.includes(key)
  )?.[1] || Monitor;

  // Status colors
  const statusColors = {
    online: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      label: 'Online',
    },
    offline: {
      dot: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      label: 'Offline',
    },
    alerting: {
      dot: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      label: 'Alerting',
    },
  };

  const statusStyle = statusColors[status] || statusColors.online;

  // Metric status colors
  const getMetricStatusColor = (metricStatus?: 'good' | 'warning' | 'critical') => {
    switch (metricStatus) {
      case 'good':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          {/* Device icon */}
          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <DeviceIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </div>

          {/* Name and type */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{type}</p>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
            <span className={`text-xs font-medium ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {attributes.map((attr, index) => (
            <div key={index} className="overflow-hidden">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {attr.label}
              </div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate" title={attr.value}>
                {attr.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      {metrics && metrics.length > 0 && (
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-3">
          <div className="flex flex-wrap gap-4">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {metric.label}:
                </span>
                <span className={`text-xs font-semibold tabular-nums ${getMetricStatusColor(metric.status)}`}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

AIDeviceSummaryCard.displayName = 'AIDeviceSummaryCard';

export default AIDeviceSummaryCard;
