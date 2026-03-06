'use client';

import { memo } from 'react';
import { Database, Search, History } from 'lucide-react';
import type { PerformanceDataTab } from './types';

export interface PerformanceDataTabBarProps {
  activeTab: PerformanceDataTab;
  onTabChange: (tab: PerformanceDataTab) => void;
  datasetCount?: number;
  className?: string;
}

export const PerformanceDataTabBar = memo(({
  activeTab,
  onTabChange,
  datasetCount = 0,
  className = '',
}: PerformanceDataTabBarProps) => {
  const getTabClasses = (tab: PerformanceDataTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
      activeTab === tab
        ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
    }`;

  return (
    <div
      className={`flex gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/40 rounded-xl w-fit ${className}`}
      role="tablist"
      aria-label="Performance data views"
    >
      <button
        onClick={() => onTabChange('datasets')}
        className={getTabClasses('datasets')}
        role="tab"
        aria-selected={activeTab === 'datasets'}
      >
        <Database className="w-4 h-4" />
        Datasets
        {datasetCount > 0 && (
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
            activeTab === 'datasets' ? 'bg-white/20 text-white' : 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
          }`}>
            {datasetCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onTabChange('query')}
        className={getTabClasses('query')}
        role="tab"
        aria-selected={activeTab === 'query'}
      >
        <Search className="w-4 h-4" />
        Query
      </button>
      <button
        onClick={() => onTabChange('history')}
        className={getTabClasses('history')}
        role="tab"
        aria-selected={activeTab === 'history'}
      >
        <History className="w-4 h-4" />
        History
      </button>
    </div>
  );
});

PerformanceDataTabBar.displayName = 'PerformanceDataTabBar';
