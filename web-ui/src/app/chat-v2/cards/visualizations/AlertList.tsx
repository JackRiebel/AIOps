'use client';

/**
 * AlertList Visualization
 *
 * Displays a list of alerts/incidents with severity indicators.
 * Used for notable events, security alerts, rogue APs.
 */

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_COLORS } from '../types';

interface Alert {
  id?: string;
  title: string;
  description?: string;
  severity: string;
  timestamp?: string | Date;
  status?: string;
  source?: string;
  [key: string]: unknown;
}

interface AlertListProps {
  data: Alert[];
  compact?: boolean;
  maxItems?: number;
  showTimestamp?: boolean;
  severityField?: string;
  severityColors?: Record<string, string>;
  onAlertClick?: (alert: Alert) => void;
  expandable?: boolean;
}

const SEVERITY_ORDER = ['critical', 'high', 'major', 'medium', 'warning', 'low', 'minor', 'info'];

export const AlertList = memo(({
  data,
  compact = false,
  maxItems = 10,
  showTimestamp = true,
  severityField = 'severity',
  severityColors = STATUS_COLORS,
  onAlertClick,
  expandable = true,
}: AlertListProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort by severity and timestamp
  const alerts = useMemo(() => {
    return [...data]
      .sort((a, b) => {
        const aSeverity = SEVERITY_ORDER.indexOf(String(a[severityField]).toLowerCase());
        const bSeverity = SEVERITY_ORDER.indexOf(String(b[severityField]).toLowerCase());

        if (aSeverity !== bSeverity) {
          return (aSeverity === -1 ? 999 : aSeverity) - (bSeverity === -1 ? 999 : bSeverity);
        }

        // Then by timestamp
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, maxItems);
  }, [data, maxItems, severityField]);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <CheckIcon />
        <span className="text-sm mt-2">No active alerts</span>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${compact ? 'py-1' : 'py-2'}`}>
      {alerts.map((alert, index) => {
        const severity = String(alert[severityField] ?? 'info').toLowerCase();
        const color = severityColors[severity] ?? '#6b7280';
        const isExpanded = expandedId === (alert.id ?? String(index));
        const alertId = alert.id ?? String(index);

        return (
          <motion.div
            key={alertId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`
              border-l-2 mx-2 mb-2 last:mb-0
              ${compact ? 'pl-2 py-1' : 'pl-3 py-2'}
              bg-slate-50 dark:bg-slate-800/30 rounded-r-lg
              ${onAlertClick || expandable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50' : ''}
              transition-colors
            `}
            style={{ borderColor: color }}
            onClick={() => {
              if (expandable) {
                setExpandedId(isExpanded ? null : alertId);
              }
              onAlertClick?.(alert);
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-2">
              {/* Severity badge */}
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium capitalize ${compact ? 'mt-0' : 'mt-0.5'}`}
                style={{
                  backgroundColor: `${color}20`,
                  color,
                }}
              >
                {severity}
              </span>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <span className={`text-slate-900 dark:text-white font-medium line-clamp-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {alert.title}
                </span>

                {/* Metadata row */}
                {!compact && (
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    {alert.source && (
                      <span>{alert.source}</span>
                    )}
                    {showTimestamp && alert.timestamp && (
                      <span>{formatTimestamp(alert.timestamp)}</span>
                    )}
                    {alert.status && (
                      <span className="capitalize">{alert.status}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Expand indicator */}
              {expandable && alert.description && (
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="text-slate-500 shrink-0"
                >
                  <ChevronDownIcon />
                </motion.span>
              )}
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && alert.description && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 pl-1">
                    {alert.description}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* More indicator */}
      {data.length > maxItems && (
        <div className="text-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/50 mx-2">
          +{data.length - maxItems} more alerts
        </div>
      )}
    </div>
  );
});

AlertList.displayName = 'AlertList';

// =============================================================================
// Device List Component
// =============================================================================

interface Device {
  id?: string;
  name: string;
  model?: string;
  status: string;
  ip?: string;
  serial?: string;
  lastSeen?: string | Date;
  [key: string]: unknown;
}

interface DeviceListProps {
  data: Device[];
  compact?: boolean;
  maxItems?: number;
  statusColors?: Record<string, string>;
  onDeviceClick?: (device: Device) => void;
}

export const DeviceList = memo(({
  data,
  compact = false,
  maxItems = 10,
  statusColors = STATUS_COLORS,
  onDeviceClick,
}: DeviceListProps) => {
  const devices = useMemo(() => {
    // Sort offline first, then alerting, then online
    return [...data]
      .sort((a, b) => {
        const statusOrder = ['offline', 'alerting', 'dormant', 'online'];
        const aOrder = statusOrder.indexOf((a.status || 'online').toLowerCase());
        const bOrder = statusOrder.indexOf((b.status || 'online').toLowerCase());
        return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
      })
      .slice(0, maxItems);
  }, [data, maxItems]);

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No devices
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${compact ? 'py-1' : 'py-2'}`}>
      {devices.map((device, index) => {
        const status = device.status.toLowerCase();
        const color = statusColors[status] ?? '#6b7280';

        return (
          <motion.div
            key={device.id ?? device.serial ?? index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02 }}
            onClick={() => onDeviceClick?.(device)}
            className={`
              flex items-center gap-3 mx-2 mb-1 last:mb-0
              ${compact ? 'py-1.5 px-2' : 'py-2 px-3'}
              rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50
              ${onDeviceClick ? 'cursor-pointer' : ''}
              transition-colors
            `}
          >
            {/* Status indicator */}
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className={`text-slate-900 dark:text-white font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                {device.name}
              </div>
              {!compact && (device.model || device.ip) && (
                <div className="text-xs text-slate-500 truncate">
                  {device.model && <span>{device.model}</span>}
                  {device.model && device.ip && <span> • </span>}
                  {device.ip && <span>{device.ip}</span>}
                </div>
              )}
            </div>

            {/* Status label */}
            <span
              className={`shrink-0 capitalize ${compact ? 'text-xs' : 'text-sm'}`}
              style={{ color }}
            >
              {status}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
});

DeviceList.displayName = 'DeviceList';

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// =============================================================================
// Icons
// =============================================================================

const CheckIcon = () => (
  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
