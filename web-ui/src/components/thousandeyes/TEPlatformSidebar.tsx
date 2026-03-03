'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Wifi, Server, Database, FlaskConical, Search, Bot, MessageSquare, AlertCircle, ChevronRight } from 'lucide-react';
import type { PlatformHealthSummary, TimelineItem } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEPlatformSidebarProps {
  platformHealth: PlatformHealthSummary[];
  issueTimeline: TimelineItem[];
  splunkCorrelation: { splunkMatches: Array<{ host: string; count: string | number }>; correlatedDevices: any[] } | null;
  onNavigate: (view: string) => void;
  onIssueClick: (item: TimelineItem) => void;
}

// ============================================================================
// Helpers
// ============================================================================

const platformConfig: Record<string, { icon: React.ComponentType<{ className?: string }> | null; color: string; label: string }> = {
  thousandeyes: { icon: null, color: 'text-cyan-500', label: 'ThousandEyes' },
  meraki: { icon: Wifi, color: 'text-emerald-500', label: 'Meraki' },
  catalyst: { icon: Server, color: 'text-blue-500', label: 'Catalyst' },
};

const severityDot: Record<string, string> = {
  critical: 'bg-red-500',
  major: 'bg-orange-500',
  minor: 'bg-amber-500',
  info: 'bg-blue-400',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ============================================================================
// Component
// ============================================================================

export const TEPlatformSidebar = memo(({
  platformHealth,
  issueTimeline,
  splunkCorrelation,
  onNavigate,
  onIssueClick,
}: TEPlatformSidebarProps) => {
  const router = useRouter();
  const activeIssues = issueTimeline.filter(i => i.isActive);

  return (
    <div className="space-y-3">
      {/* Platform Health */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium mb-2.5">Platform Health</h3>
        <div className="space-y-2.5">
          {platformHealth.map(p => {
            const config = platformConfig[p.platform] || platformConfig.thousandeyes;
            const Icon = config.icon;
            return (
              <div key={p.platform}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {p.platform === 'thousandeyes' ? (
                      <Image src="/te-logo.png" alt="ThousandEyes" width={14} height={14} className="object-contain" />
                    ) : Icon ? (
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    ) : null}
                    <span className="text-xs text-slate-700 dark:text-slate-300">{config.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {p.onlineCount}/{p.deviceCount}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.healthPercent >= 90 ? 'bg-emerald-500' : p.healthPercent >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${p.deviceCount > 0 ? p.healthPercent : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
          {/* Splunk row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-slate-700 dark:text-slate-300">Splunk</span>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {splunkCorrelation ? `${splunkCorrelation.splunkMatches.length} hosts` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Active Issues */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Active Issues</h3>
          {activeIssues.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
              {activeIssues.length}
            </span>
          )}
        </div>
        {activeIssues.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">No active issues</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {activeIssues.slice(0, 8).map(issue => (
              <button
                key={issue.id}
                onClick={() => onIssueClick(issue)}
                className="w-full flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left group"
              >
                <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${severityDot[issue.severity] || 'bg-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{issue.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{timeAgo(issue.timestamp)}</p>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 mt-1 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {activeIssues.length > 3 && (
          <button
            onClick={() => onNavigate('operations')}
            className="mt-2 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition"
          >
            View all issues →
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium mb-2.5">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate('operations')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <FlaskConical className="w-3 h-3" />
            Create Test
          </button>
          <button
            onClick={() => router.push('/splunk')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Search className="w-3 h-3" />
            Search Logs
          </button>
          <button
            onClick={() => router.push('/chat-v2?q=Help+me+analyze+network+health')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Bot className="w-3 h-3" />
            Ask AI
          </button>
          <button
            onClick={() => router.push('/chat-v2')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <MessageSquare className="w-3 h-3" />
            Open Chat
          </button>
        </div>
      </div>
    </div>
  );
});

TEPlatformSidebar.displayName = 'TEPlatformSidebar';
export default TEPlatformSidebar;
