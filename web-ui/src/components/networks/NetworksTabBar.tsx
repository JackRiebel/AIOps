'use client';

import { memo } from 'react';
import { LayoutGrid, Building2, Network, Server } from 'lucide-react';
import { motion } from 'framer-motion';
import type { TabType } from './types';

export interface NetworksTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts?: { overview?: number; organizations?: number; networks?: number; devices?: number };
  className?: string;
}

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'networks', label: 'Networks', icon: Network },
  { id: 'devices', label: 'Devices', icon: Server },
];

export const NetworksTabBar = memo(({
  activeTab,
  onTabChange,
  counts,
  className = '',
}: NetworksTabBarProps) => {
  return (
    <div
      className={`relative flex gap-0.5 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl w-fit backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 ${className}`}
      role="tablist"
      aria-label="Network management views"
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const count = counts?.[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            className={`relative px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
              isActive
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-500' : ''}`} />
            {tab.label}
            {count !== undefined && count > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                isActive
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                  : 'bg-slate-200/80 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400'
              }`}>
                {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="networks-tab-indicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

NetworksTabBar.displayName = 'NetworksTabBar';

export default NetworksTabBar;
