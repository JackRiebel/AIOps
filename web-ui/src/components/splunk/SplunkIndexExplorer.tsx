'use client';

import { memo, useState, useCallback } from 'react';
import {
  Database,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Server,
  FileText,
  Layers,
  Search,
  Loader2,
} from 'lucide-react';
import type { SplunkIndex, SplunkIndexDetail, SplunkIndexMetadata } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkIndexExplorerProps {
  indexes: SplunkIndex[];
  indexDetails: Record<string, SplunkIndexDetail>;
  indexMetadata: Record<string, SplunkIndexMetadata>;
  loading: boolean;
  onFetchDetail: (name: string) => Promise<void>;
  onFetchMetadata: (name: string, type: string) => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

type MetadataTab = 'hosts' | 'sources' | 'sourcetypes';

export const SplunkIndexExplorer = memo(({
  indexes,
  indexDetails,
  indexMetadata,
  loading,
  onFetchDetail,
  onFetchMetadata,
}: SplunkIndexExplorerProps) => {
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MetadataTab>('hosts');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const handleExpand = useCallback(async (name: string) => {
    if (expandedIndex === name) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(name);

    // Fetch detail if not cached
    if (!indexDetails[name]) {
      setLoadingDetail(name);
      await onFetchDetail(name);
      setLoadingDetail(null);
    }
    // Fetch initial metadata tab
    if (!indexMetadata[name]?.hosts) {
      await onFetchMetadata(name, 'hosts');
    }
  }, [expandedIndex, indexDetails, indexMetadata, onFetchDetail, onFetchMetadata]);

  const handleTabChange = useCallback(async (tab: MetadataTab) => {
    setActiveTab(tab);
    if (expandedIndex && !indexMetadata[expandedIndex]?.[tab]) {
      await onFetchMetadata(expandedIndex, tab);
    }
  }, [expandedIndex, indexMetadata, onFetchMetadata]);

  const filteredIndexes = indexes.filter(idx =>
    idx.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading && indexes.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Index Explorer</span>
        </div>
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-purple-500" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Index Explorer</span>
        {indexes.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50">
            {indexes.length} indexes
          </span>
        )}
      </div>

      {/* Search filter */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Filter indexes..."
          className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-300 dark:focus:border-cyan-500/30 transition"
        />
      </div>

      {/* Index list */}
      <div className="space-y-1.5">
        {filteredIndexes.map(idx => {
          const isExpanded = expandedIndex === idx.name;
          const detail = indexDetails[idx.name];
          const meta = indexMetadata[idx.name];
          const eventCount = typeof idx.totalEventCount === 'string'
            ? parseInt(idx.totalEventCount, 10) || 0
            : (idx.totalEventCount || 0);
          const sizeMB = typeof idx.currentDBSizeMB === 'string'
            ? parseFloat(idx.currentDBSizeMB) || 0
            : (idx.currentDBSizeMB || 0);

          return (
            <div key={idx.name} className={`rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden transition-colors ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/20' : 'bg-white dark:bg-slate-800/60'}`}>
              {/* Index header row */}
              <button
                onClick={() => handleExpand(idx.name)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}
                <Database className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">{idx.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto tabular-nums">
                  {eventCount.toLocaleString()} events
                </span>
                {sizeMB > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB.toFixed(0)} MB`}
                  </span>
                )}
                {idx.datatype && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600/50">
                    {idx.datatype}
                  </span>
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-700/50 px-4 py-4 space-y-4">
                  {loadingDetail === idx.name ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading details...
                    </div>
                  ) : (
                    <>
                      {/* Stats */}
                      {detail && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {detail.minTime && (
                            <div className="bg-white dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium block mb-0.5">Earliest Event</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{new Date(detail.minTime).toLocaleDateString()}</span>
                            </div>
                          )}
                          {detail.maxTime && (
                            <div className="bg-white dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium block mb-0.5">Latest Event</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{new Date(detail.maxTime).toLocaleDateString()}</span>
                            </div>
                          )}
                          {detail.maxTotalDataSizeMB && (
                            <div className="bg-white dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium block mb-0.5">Max Size</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{Number(detail.maxTotalDataSizeMB).toLocaleString()} MB</span>
                            </div>
                          )}
                          {detail.frozenTimePeriodInSecs && (
                            <div className="bg-white dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium block mb-0.5">Retention</span>
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{Math.round(Number(detail.frozenTimePeriodInSecs) / 86400)} days</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Metadata tabs */}
                      <div>
                        <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-1 inline-flex gap-1 mb-3">
                          {(['hosts', 'sources', 'sourcetypes'] as MetadataTab[]).map(tab => (
                            <button
                              key={tab}
                              onClick={() => handleTabChange(tab)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                activeTab === tab
                                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-400 shadow-sm'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}
                            >
                              {tab === 'hosts' && <Server className="w-3 h-3" />}
                              {tab === 'sources' && <FileText className="w-3 h-3" />}
                              {tab === 'sourcetypes' && <Layers className="w-3 h-3" />}
                              {tab.charAt(0).toUpperCase() + tab.slice(1)}
                              {meta?.[tab] && (
                                <span className="text-[10px] opacity-60">({meta[tab]!.length})</span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Metadata list */}
                        <div className="max-h-[200px] overflow-y-auto">
                          {!meta?.[activeTab] ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading {activeTab}...
                            </div>
                          ) : meta[activeTab]!.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No {activeTab} found</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {meta[activeTab]!.map(item => (
                                <span key={item} className="px-2 py-1 text-xs bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700/50 truncate max-w-[250px]">
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredIndexes.length === 0 && (
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
            <Database className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {searchFilter ? 'No indexes match your filter' : 'No indexes found'}
          </p>
        </div>
      )}
    </div>
  );
});

SplunkIndexExplorer.displayName = 'SplunkIndexExplorer';
export default SplunkIndexExplorer;
