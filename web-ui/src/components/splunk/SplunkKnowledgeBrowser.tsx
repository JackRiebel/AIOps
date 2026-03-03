'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import {
  BookOpen,
  Search as SearchIcon,
  Play,
  Clock,
  FileText,
  Loader2,
  Database,
  Tag,
  Hash,
  Braces,
} from 'lucide-react';
import type { SplunkKnowledgeObject } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkKnowledgeBrowserProps {
  objects: SplunkKnowledgeObject[];
  loading: boolean;
  onFetchObjects: (type: string) => Promise<void>;
  onRunSearch?: (search: string) => void;
}

type KnowledgeTab = 'saved_searches' | 'datamodels' | 'macros' | 'lookups' | 'eventtypes' | 'tags';

const TABS: { id: KnowledgeTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'saved_searches', label: 'Saved Searches', icon: SearchIcon },
  { id: 'datamodels', label: 'Data Models', icon: Database },
  { id: 'macros', label: 'Macros', icon: Braces },
  { id: 'lookups', label: 'Lookups', icon: FileText },
  { id: 'eventtypes', label: 'Event Types', icon: Tag },
  { id: 'tags', label: 'Tags', icon: Hash },
];

// ============================================================================
// Component
// ============================================================================

export const SplunkKnowledgeBrowser = memo(({
  objects,
  loading,
  onFetchObjects,
  onRunSearch,
}: SplunkKnowledgeBrowserProps) => {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('saved_searches');
  const [filter, setFilter] = useState('');

  // Fetch on mount and tab change
  useEffect(() => {
    onFetchObjects(activeTab);
  }, [activeTab, onFetchObjects]);

  const handleTabChange = useCallback((tab: KnowledgeTab) => {
    setActiveTab(tab);
    setFilter('');
  }, []);

  const filteredObjects = objects.filter(obj =>
    obj.name.toLowerCase().includes(filter.toLowerCase()) ||
    (obj.description?.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Tab bar - TE sub-nav pill pattern */}
      <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-1 inline-flex gap-1 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search filter */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={`Filter ${activeTab.replace('_', ' ')}...`}
          className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-300 dark:focus:border-cyan-500/30 transition"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-500 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading {activeTab.replace('_', ' ')}...
            </p>
          </div>
        </div>
      ) : filteredObjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
              <SearchIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {filter ? `No ${activeTab.replace('_', ' ')} match "${filter}"` : `No ${activeTab.replace('_', ' ')} found`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredObjects.map((obj, i) => (
            <div
              key={`${obj.name}-${i}`}
              className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 px-4 py-3 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">{obj.name}</h4>
                  {obj.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{obj.description}</p>
                  )}
                </div>
                {activeTab === 'saved_searches' && obj.search && onRunSearch && (
                  <button
                    onClick={() => onRunSearch(obj.search!)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700 rounded-lg transition"
                  >
                    <Play className="w-3 h-3" />
                    Run
                  </button>
                )}
              </div>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                {obj.search && (
                  <span className="font-mono bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded-lg truncate max-w-[300px] border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400">
                    {obj.search}
                  </span>
                )}
                {obj.cron_schedule && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    {obj.cron_schedule}
                  </span>
                )}
                {obj.disabled !== undefined && (
                  <span className={`px-2 py-0.5 rounded-lg border ${
                    obj.disabled
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  }`}>
                    {obj.disabled ? 'Disabled' : 'Enabled'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SplunkKnowledgeBrowser.displayName = 'SplunkKnowledgeBrowser';
export default SplunkKnowledgeBrowser;
