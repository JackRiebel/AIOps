'use client';

import { memo } from 'react';
import { Activity, AlertTriangle, Server } from 'lucide-react';
import type { TabType } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ThousandEyesTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  alertCount?: number;
  className?: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'tests', label: 'Tests', icon: Activity },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'agents', label: 'Agents', icon: Server },
];

// ============================================================================
// ThousandEyesTabBar Component
// ============================================================================

export const ThousandEyesTabBar = memo(({
  activeTab,
  onTabChange,
  alertCount = 0,
  className = '',
}: ThousandEyesTabBarProps) => {
  return (
    <div className={`flex gap-1 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-1.5 ${className}`}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const showBadge = tab.id === 'alerts' && alertCount > 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
            {showBadge && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-red-500 text-white'
              }`}>
                {alertCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

ThousandEyesTabBar.displayName = 'ThousandEyesTabBar';

export default ThousandEyesTabBar;
