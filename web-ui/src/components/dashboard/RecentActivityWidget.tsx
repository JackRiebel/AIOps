'use client';

import { memo } from 'react';
import { History } from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface ActivityItem {
  id: number;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  status: number;
  timestamp: Date;
}

export interface RecentActivityWidgetProps {
  activities: ActivityItem[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400';
    case 'POST':
      return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';
    case 'PUT':
      return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
    case 'DELETE':
      return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
    default:
      return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400';
  if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function truncatePath(path: string): string {
  // Show last 2 segments of the path
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 2) return path;
  return '.../' + segments.slice(-2).join('/');
}

// ============================================================================
// ActivityRow Component
// ============================================================================

function ActivityRow({ activity }: { activity: ActivityItem }) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {/* Method Badge */}
      <span
        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${getMethodColor(
          activity.method
        )}`}
      >
        {activity.method}
      </span>

      {/* Path */}
      <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 truncate font-mono">
        {truncatePath(activity.path)}
      </span>

      {/* Status */}
      <span className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
        {activity.status}
      </span>

      {/* Time */}
      <span className="text-[10px] text-slate-400 dark:text-slate-500 w-12 text-right">
        {formatTimeAgo(activity.timestamp)}
      </span>
    </div>
  );
}

// ============================================================================
// RecentActivityWidget Component
// ============================================================================

export const RecentActivityWidget = memo(({
  activities,
  loading,
  className = '',
}: RecentActivityWidgetProps) => {
  return (
    <DashboardCard
      title="Recent Activity"
      icon={<History className="w-4 h-4" />}
      href="/audit"
      linkText="View All →"
      accent="cyan"
      loading={loading}
      className={className}
    >
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2">
            <History className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No recent activity</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Activity will appear here
          </p>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="flex-1 space-y-0.5 overflow-auto">
            {activities.slice(0, 6).map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
});

RecentActivityWidget.displayName = 'RecentActivityWidget';

export default RecentActivityWidget;
