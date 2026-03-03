'use client';

import { memo } from 'react';
import { Brain, Search, MonitorCog, Plus } from 'lucide-react';
import type { TEDashboardView } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TENavigationBarProps {
  currentView: TEDashboardView;
  onViewChange: (view: TEDashboardView) => void;
  onCreateTest: () => void;
}

// ============================================================================
// Nav items
// ============================================================================

interface NavItem {
  id: TEDashboardView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'investigate', label: 'Investigate', icon: Search },
  { id: 'platform', label: 'Platform', icon: MonitorCog },
];

// ============================================================================
// Component
// ============================================================================

export const TENavigationBar = memo(({
  currentView,
  onViewChange,
  onCreateTest,
}: TENavigationBarProps) => {
  return (
    <div className="flex items-center gap-1">
      {NAV_ITEMS.map(item => {
        const isActive = currentView === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        );
      })}

      {/* Separator + Create Test */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/50 mx-1 flex-shrink-0" />
      <button
        onClick={onCreateTest}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition"
      >
        <Plus className="w-3.5 h-3.5" />
        Create Test
      </button>
    </div>
  );
});

TENavigationBar.displayName = 'TENavigationBar';
export default TENavigationBar;
