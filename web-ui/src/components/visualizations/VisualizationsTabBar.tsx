'use client';

import { memo } from 'react';
import { Globe, Network, Activity } from 'lucide-react';
import type { VisualizationTab } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

export interface VisualizationsTabBarProps {
  activeTab: VisualizationTab;
  onTabChange: (tab: VisualizationTab) => void;
  className?: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS: {
  id: VisualizationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'organization', label: 'Organization VPN', icon: Globe },
  { id: 'topology', label: 'Network Topology', icon: Network },
  { id: 'performance', label: 'Performance', icon: Activity },
];

// ============================================================================
// VisualizationsTabBar Component
// ============================================================================

export const VisualizationsTabBar = memo(({
  activeTab,
  onTabChange,
  className = '',
}: VisualizationsTabBarProps) => {
  return (
    <div className={`flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit ${className}`}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              isActive
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

VisualizationsTabBar.displayName = 'VisualizationsTabBar';

export default VisualizationsTabBar;
