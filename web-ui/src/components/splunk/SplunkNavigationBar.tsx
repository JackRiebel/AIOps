'use client';

import { memo } from 'react';
import { Brain, Search } from 'lucide-react';
import type { SplunkDashboardView } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkNavigationBarProps {
  currentView: SplunkDashboardView;
  onViewChange: (view: SplunkDashboardView) => void;
}

interface NavItem {
  id: SplunkDashboardView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Brain },
  { id: 'investigate', label: 'Investigate', icon: Search },
];

// ============================================================================
// Component
// ============================================================================

export const SplunkNavigationBar = memo(({
  currentView,
  onViewChange,
}: SplunkNavigationBarProps) => {
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
    </div>
  );
});

SplunkNavigationBar.displayName = 'SplunkNavigationBar';
export default SplunkNavigationBar;
