'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Zap, Clock, ChevronRight } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useWebSocket, type TopicUpdate } from '@/hooks/useWebSocket';

// ============================================================================
// Types
// ============================================================================

export interface ActionFeedItem {
  id: string;
  type: 'workflow_execution' | 'audit_log' | 'system_event';
  title: string;
  description?: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  timestamp: Date;
  workflowId?: string;
  workflowName?: string;
  triggeredBy?: string;
  duration?: number; // in ms
}

export interface LiveActionsFeedProps {
  /** Initial items to display (from API) */
  initialItems?: ActionFeedItem[];
  /** Maximum number of items to show */
  maxItems?: number;
  /** WebSocket URL for live updates */
  wsUrl?: string;
  /** Loading state */
  loading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ActionFeedItem['status'] }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    running: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
    pending: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  };

  const defaultConfig = { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' };
  const { bg, text, dot } = config[status] || defaultConfig;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// ============================================================================
// Feed Item Component
// ============================================================================

function FeedItem({ item, onView }: { item: ActionFeedItem; onView?: () => void }) {
  return (
    <button
      onClick={onView}
      className="w-full py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Status & Type */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <StatusBadge status={item.status} />
            {item.workflowName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {item.workflowName}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-xs font-medium text-slate-900 dark:text-white truncate mb-0.5">
            {item.title}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatTimestamp(item.timestamp)}
            </span>
            {item.duration !== undefined && item.status === 'completed' && (
              <span>{formatDuration(item.duration)}</span>
            )}
            {item.triggeredBy && (
              <span>by {item.triggeredBy}</span>
            )}
          </div>
        </div>

        {/* Hover Arrow */}
        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const LiveActionsFeed = memo(function LiveActionsFeed({
  initialItems = [],
  maxItems = 5,
  wsUrl,
  loading = false,
}: LiveActionsFeedProps) {
  const [items, setItems] = useState<ActionFeedItem[]>(initialItems);

  // Handle WebSocket topic updates
  const handleTopicUpdate = useCallback((update: TopicUpdate) => {
    if (update.topic !== 'workflow_execution') return;

    const data = update.data;
    const newItem: ActionFeedItem = {
      id: String(data.execution_id || Date.now()),
      type: 'workflow_execution',
      title: String(data.workflow_name || 'Workflow Execution'),
      description: String(data.trigger_reason || ''),
      status: data.status === 'running' ? 'running' :
              data.status === 'completed' ? 'completed' :
              data.status === 'failed' ? 'failed' : 'pending',
      timestamp: new Date(String(data.timestamp) || Date.now()),
      workflowId: String(data.workflow_id || ''),
      workflowName: String(data.workflow_name || ''),
      triggeredBy: String(data.triggered_by || 'system'),
      duration: typeof data.duration_ms === 'number' ? data.duration_ms : undefined,
    };

    setItems(prev => {
      // Check if this execution already exists (update it) or is new (prepend it)
      const existingIndex = prev.findIndex(item => item.id === newItem.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newItem;
        return updated;
      }
      // Prepend new item and limit to maxItems
      return [newItem, ...prev].slice(0, maxItems);
    });
  }, [maxItems]);

  // Connect to WebSocket for live updates
  const { isConnected, subscribe } = useWebSocket({
    url: wsUrl || '',
    onTopicUpdate: handleTopicUpdate,
  });

  // Subscribe to workflow_execution topic when connected
  useEffect(() => {
    if (isConnected && wsUrl) {
      subscribe('workflow_execution');
    }
  }, [isConnected, wsUrl, subscribe]);

  // Update items when initialItems change
  useEffect(() => {
    if (initialItems.length > 0) {
      setItems(initialItems.slice(0, maxItems));
    }
  }, [initialItems, maxItems]);

  // Sort items by timestamp (most recent first)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [items]);

  // Navigate to workflow details
  const handleViewItem = useCallback((item: ActionFeedItem) => {
    if (item.workflowId) {
      window.location.href = `/workflows?selected=${item.workflowId}`;
    }
  }, []);

  const badge = wsUrl ? (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {isConnected ? 'Live' : 'Offline'}
    </span>
  ) : undefined;

  return (
    <DashboardCard
      title="Live Actions"
      icon={<Zap className="w-4 h-4" />}
      href="/workflows"
      linkText="View All →"
      accent="purple"
      loading={loading}
      badge={badge}
    >
      {sortedItems.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mb-2">
            <Zap className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No recent actions</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Workflow executions will appear here
          </p>
        </div>
      ) : (
        /* Feed Items */
        <div className="flex flex-col">
          {sortedItems.map(item => (
            <FeedItem
              key={item.id}
              item={item}
              onView={() => handleViewItem(item)}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
});

LiveActionsFeed.displayName = 'LiveActionsFeed';

export default LiveActionsFeed;
