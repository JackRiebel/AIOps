'use client';

import { memo } from 'react';
import { DollarSign, Lightbulb, BarChart3, Sparkles, Globe } from 'lucide-react';
import type { CostsTabType } from './types';

// ============================================================================
// Types
// ============================================================================

export interface CostsTabBarProps {
  activeTab: CostsTabType;
  onTabChange: (tab: CostsTabType) => void;
  sessionCount?: number;
  className?: string;
}

// ============================================================================
// CostsTabBar Component
// ============================================================================

export const CostsTabBar = memo(({
  activeTab,
  onTabChange,
  sessionCount = 0,
  className = '',
}: CostsTabBarProps) => {
  const getTabClasses = (tab: CostsTabType) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
      activeTab === tab
        ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-sm'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
    }`;

  return (
    <div
      className={`flex gap-1 p-1 bg-slate-100/80 dark:bg-slate-800/40 rounded-xl w-fit ${className}`}
      role="tablist"
      aria-label="Cost analysis views"
    >
      <button
        onClick={() => onTabChange('costs')}
        className={getTabClasses('costs')}
        role="tab"
        aria-selected={activeTab === 'costs'}
        aria-controls="tabpanel-costs"
      >
        <DollarSign className="w-4 h-4" aria-hidden="true" />
        Cost Overview
      </button>
      <button
        onClick={() => onTabChange('sessions')}
        className={getTabClasses('sessions')}
        role="tab"
        aria-selected={activeTab === 'sessions'}
        aria-controls="tabpanel-sessions"
      >
        <Lightbulb className="w-4 h-4" aria-hidden="true" />
        AI Sessions
        {sessionCount > 0 && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
              activeTab === 'sessions'
                ? 'bg-white/20 text-white'
                : 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
            }`}
            aria-label={`${sessionCount} sessions`}
          >
            {sessionCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onTabChange('analytics')}
        className={getTabClasses('analytics')}
        role="tab"
        aria-selected={activeTab === 'analytics'}
        aria-controls="tabpanel-analytics"
      >
        <BarChart3 className="w-4 h-4" aria-hidden="true" />
        Analytics
      </button>
      <button
        onClick={() => onTabChange('rag')}
        className={getTabClasses('rag')}
        role="tab"
        aria-selected={activeTab === 'rag'}
        aria-controls="tabpanel-rag"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        Agentic RAG
      </button>
      <button
        onClick={() => onTabChange('network')}
        className={getTabClasses('network')}
        role="tab"
        aria-selected={activeTab === 'network'}
        aria-controls="tabpanel-network"
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        Network
      </button>
    </div>
  );
});

CostsTabBar.displayName = 'CostsTabBar';

export default CostsTabBar;
