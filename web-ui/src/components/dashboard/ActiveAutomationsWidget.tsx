'use client';

import { memo } from 'react';
import Link from 'next/link';
import {
  Workflow,
  Play,
  Pause,
  Clock,
  Zap,
  Search,
  Hand,
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface AutomationItem {
  id: number;
  name: string;
  status: 'active' | 'paused' | 'draft';
  triggerType: 'splunk_query' | 'schedule' | 'manual' | 'webhook';
  lastRun?: string;
  executionCount?: number;
}

export interface ActiveAutomationsWidgetProps {
  automations: AutomationItem[];
  totalActive: number;
  totalPaused: number;
  recentExecutions: number;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTriggerIcon(type: string) {
  switch (type) {
    case 'splunk_query':
      return <Search className="w-3 h-3" />;
    case 'schedule':
      return <Clock className="w-3 h-3" />;
    case 'webhook':
      return <Zap className="w-3 h-3" />;
    case 'manual':
      return <Hand className="w-3 h-3" />;
    default:
      return <Workflow className="w-3 h-3" />;
  }
}

function getTriggerLabel(type: string): string {
  switch (type) {
    case 'splunk_query':
      return 'Splunk';
    case 'schedule':
      return 'Scheduled';
    case 'webhook':
      return 'Webhook';
    case 'manual':
      return 'Manual';
    default:
      return type;
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
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

// ============================================================================
// AutomationRow Component
// ============================================================================

function AutomationRow({ automation }: { automation: AutomationItem }) {
  const isActive = automation.status === 'active';

  return (
    <Link
      href={`/workflows?id=${automation.id}`}
      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
    >
      {/* Status Indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        isActive ? 'bg-green-500' : 'bg-slate-400'
      }`} />

      {/* Name */}
      <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate font-medium group-hover:text-slate-900 dark:group-hover:text-white">
        {automation.name}
      </span>

      {/* Trigger Type Badge */}
      <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
        {getTriggerIcon(automation.triggerType)}
        <span className="hidden sm:inline">{getTriggerLabel(automation.triggerType)}</span>
      </span>

      {/* Last Run */}
      {automation.lastRun && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 w-14 text-right">
          {formatTimeAgo(automation.lastRun)}
        </span>
      )}
    </Link>
  );
}

// ============================================================================
// ActiveAutomationsWidget Component
// ============================================================================

export const ActiveAutomationsWidget = memo(({
  automations,
  totalActive,
  totalPaused,
  recentExecutions,
  loading,
  className = '',
}: ActiveAutomationsWidgetProps) => {
  const hasAutomations = automations.length > 0 || totalActive > 0;

  return (
    <DashboardCard
      title="AI Automations"
      icon={<Workflow className="w-4 h-4" />}
      href="/workflows"
      linkText="Manage →"
      accent="purple"
      loading={loading}
      className={className}
    >
      {!hasAutomations ? (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-2">
            <Workflow className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No automations yet</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Create workflows to automate tasks
          </p>
          <Link
            href="/workflows"
            className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 hover:underline"
          >
            Create your first workflow →
          </Link>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* Stats Row */}
          <div className="flex items-center gap-4 pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <Play className="w-3 h-3 text-green-500" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{totalActive}</span>
              <span className="text-[10px] text-slate-500">active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Pause className="w-3 h-3 text-slate-400" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{totalPaused}</span>
              <span className="text-[10px] text-slate-500">paused</span>
            </div>
            {recentExecutions > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] text-slate-500">{recentExecutions} runs today</span>
              </div>
            )}
          </div>

          {/* Automations List */}
          <div className="flex-1 space-y-0.5 overflow-auto">
            {automations.slice(0, 5).map((automation) => (
              <AutomationRow key={automation.id} automation={automation} />
            ))}
          </div>

          {/* View All Link */}
          {automations.length > 5 && (
            <div className="pt-2 mt-auto border-t border-slate-200 dark:border-slate-700">
              <Link
                href="/workflows"
                className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline"
              >
                View all {totalActive + totalPaused} workflows →
              </Link>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
});

ActiveAutomationsWidget.displayName = 'ActiveAutomationsWidget';

export default ActiveAutomationsWidget;
