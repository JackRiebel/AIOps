'use client';

import { memo, useMemo } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { TimelineItem } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEIssueTimelineProps {
  items: TimelineItem[];
  loading: boolean;
  maxVisible?: number;
  onItemClick: (item: TimelineItem) => void;
  onViewAll: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const severityColors: Record<TimelineItem['severity'], string> = {
  critical: 'bg-red-500',
  major: 'bg-orange-500',
  minor: 'bg-amber-500',
  info: 'bg-blue-400',
};

const typeBadgeColors: Record<TimelineItem['type'], string> = {
  alert: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
  event: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  outage: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
};

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ============================================================================
// Component
// ============================================================================

export const TEIssueTimeline = memo(({
  items,
  loading,
  maxVisible = 10,
  onItemClick,
  onViewAll,
}: TEIssueTimelineProps) => {
  const visibleItems = useMemo(() => items.slice(0, maxVisible), [items, maxVisible]);
  const activeCount = useMemo(() => items.filter(i => i.isActive).length, [items]);

  const badge = activeCount > 0 ? (
    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full">
      {activeCount} active
    </span>
  ) : null;

  return (
    <DashboardCard
      title="Active Issues"
      icon={<AlertCircle className="w-4 h-4" />}
      accent="red"
      loading={loading}
      badge={badge}
      compact
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-500 dark:text-slate-400">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p>No active issues</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          <AnimatePresence initial={false}>
            {visibleItems.map((item, idx) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => onItemClick(item)}
                className="w-full flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition text-left group"
              >
                {/* Severity dot */}
                <div className="flex flex-col items-center mt-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${severityColors[item.severity]} ${item.isActive ? 'animate-pulse' : 'opacity-60'}`} />
                  {idx < visibleItems.length - 1 && (
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium border rounded ${typeBadgeColors[item.type]}`}>
                      {item.type}
                    </span>
                    {item.isActive && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>
                </div>

                {/* Timestamp */}
                <span className="flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
                  {timeAgo(item.timestamp)}
                </span>

                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition mt-1" />
              </motion.button>
            ))}
          </AnimatePresence>

          {items.length > maxVisible && (
            <button
              onClick={onViewAll}
              className="w-full text-center py-2 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition"
            >
              View all {items.length} issues
            </button>
          )}
        </div>
      )}
    </DashboardCard>
  );
});

TEIssueTimeline.displayName = 'TEIssueTimeline';
export default TEIssueTimeline;
