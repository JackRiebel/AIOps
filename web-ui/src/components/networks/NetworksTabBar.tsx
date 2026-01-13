'use client';

import { memo } from 'react';
import { LayoutGrid, Building2, Network, Server } from 'lucide-react';
import type { TabType } from './types';

// ============================================================================
// Types
// ============================================================================

export interface NetworksTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  className?: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'networks', label: 'Networks', icon: Network },
  { id: 'devices', label: 'Devices', icon: Server },
];

// ============================================================================
// NetworksTabBar Component
// ============================================================================

export const NetworksTabBar = memo(({
  activeTab,
  onTabChange,
  className = '',
}: NetworksTabBarProps) => {
  return (
    <div
      className={`flex gap-1 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-1.5 ${className}`}
      role="tablist"
      aria-label="Network management views"
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
              isActive
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

NetworksTabBar.displayName = 'NetworksTabBar';

export default NetworksTabBar;
