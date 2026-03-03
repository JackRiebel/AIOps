'use client';

/**
 * ChangeHistoryViz
 *
 * Displays a timeline of network configuration changes with status indicators.
 * Used for the network_change_history card type.
 */

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ChangeHistoryItem {
  id: string;
  change_type: string;
  setting_path: string;
  description: string;
  applied_at: string;
  reverted_at: string | null;
  status: string;
  user_id: string;
  has_metrics: boolean;
}

interface ChangeHistoryData {
  changes: ChangeHistoryItem[];
  total: number;
}

interface ChangeHistoryVizProps {
  data: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
}

const CHANGE_TYPE_ICONS: Record<string, string> = {
  ssid_config: 'wifi',
  rf_profile: 'signal',
  traffic_shaping: 'chart',
  qos_rule: 'priority',
  port_config: 'port',
  uplink_bandwidth: 'upload',
  radio_settings: 'radio',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  ssid_config: 'text-blue-500 bg-blue-50 dark:bg-blue-500/20',
  rf_profile: 'text-purple-500 bg-purple-50 dark:bg-purple-500/20',
  traffic_shaping: 'text-amber-500 bg-amber-50 dark:bg-amber-500/20',
  qos_rule: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/20',
  port_config: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/20',
  uplink_bandwidth: 'text-orange-500 bg-orange-50 dark:bg-orange-500/20',
  radio_settings: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/20',
};

export const ChangeHistoryViz = memo(({ data, onAction }: ChangeHistoryVizProps) => {
  const historyData = data as unknown as ChangeHistoryData;
  const { changes, total } = historyData;

  const handleChangeClick = useCallback((change: ChangeHistoryItem) => {
    onAction?.('view_change', { changeId: change.id });
  }, [onAction]);

  const handleRevertClick = useCallback((change: ChangeHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.('revert_change', { changeId: change.id });
  }, [onAction]);

  if (!changes || changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <EmptyHistoryIcon />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          No configuration changes recorded
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Changes will appear here when made via the AI assistant
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Recent Changes
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {total ?? changes.length} total
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

          {/* Change items */}
          <div className="space-y-3">
            {changes.map((change, index) => (
              <ChangeItem
                key={change.id}
                change={change}
                index={index}
                onClick={() => handleChangeClick(change)}
                onRevert={(e) => handleRevertClick(change, e)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ChangeHistoryViz.displayName = 'ChangeHistoryViz';

// =============================================================================
// Change Item Component
// =============================================================================

interface ChangeItemProps {
  change: ChangeHistoryItem;
  index: number;
  onClick: () => void;
  onRevert: (e: React.MouseEvent) => void;
}

const ChangeItem = memo(({ change, index, onClick, onRevert }: ChangeItemProps) => {
  const colorClass = CHANGE_TYPE_COLORS[change.change_type] ?? 'text-slate-500 bg-slate-50 dark:bg-slate-500/20';
  const isReverted = change.status === 'reverted';
  const canRevert = change.status === 'applied';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`relative pl-10 cursor-pointer group ${isReverted ? 'opacity-60' : ''}`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-2 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 z-10 ${
          isReverted
            ? 'bg-slate-400'
            : change.status === 'failed'
            ? 'bg-red-500'
            : 'bg-emerald-500'
        }`}
      />

      {/* Content */}
      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-start justify-between gap-2">
          {/* Left side */}
          <div className="min-w-0 flex-1">
            {/* Type badge and description */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                {formatChangeType(change.change_type)}
              </span>
              {isReverted && (
                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  Reverted
                </span>
              )}
            </div>

            {/* Description */}
            <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
              {change.description || formatSettingPath(change.setting_path)}
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <ClockIcon />
              <span>{formatTimeAgo(change.applied_at)}</span>
              {change.has_metrics && (
                <>
                  <span>-</span>
                  <ChartBadge />
                </>
              )}
            </div>
          </div>

          {/* Right side - action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canRevert && (
              <button
                onClick={onRevert}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors"
                title="Revert this change"
              >
                <RevertIcon />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="View details"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ChangeItem.displayName = 'ChangeItem';

// =============================================================================
// Sub-components
// =============================================================================

const ChartBadge = () => (
  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4" />
    </svg>
    <span>Metrics</span>
  </span>
);

// =============================================================================
// Icons
// =============================================================================

const EmptyHistoryIcon = () => (
  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
    <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </div>
);

const ClockIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RevertIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// =============================================================================
// Helpers
// =============================================================================

function formatSettingPath(path: string): string {
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatChangeType(type: string): string {
  const labels: Record<string, string> = {
    ssid_config: 'SSID',
    rf_profile: 'RF',
    traffic_shaping: 'Traffic',
    qos_rule: 'QoS',
    port_config: 'Port',
    uplink_bandwidth: 'Uplink',
    radio_settings: 'Radio',
  };
  return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
