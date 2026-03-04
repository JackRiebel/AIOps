'use client';

import { memo } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { NetworkWithMeta } from './types';

export interface NetworksFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: 'all' | 'online' | 'offline';
  onStatusChange: (value: 'all' | 'online' | 'offline') => void;
  networkFilter: string;
  onNetworkChange: (value: string) => void;
  networks: NetworkWithMeta[];
  resultCount: number;
  showStatusFilter?: boolean;
  showNetworkFilter?: boolean;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  placeholder?: string;
  className?: string;
}

export const NetworksFilterBar = memo(({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  networkFilter,
  onNetworkChange,
  networks,
  resultCount,
  showStatusFilter = false,
  showNetworkFilter = false,
  onClearFilters,
  hasActiveFilters,
  placeholder = 'Search...',
  className = '',
}: NetworksFilterBarProps) => {
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filters */}
      {(showStatusFilter || showNetworkFilter) && (
        <>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filters</span>
          </div>
        </>
      )}

      {/* Status Filter */}
      {showStatusFilter && (
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as 'all' | 'online' | 'offline')}
            className="appearance-none pl-3 pr-8 py-2 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all shadow-sm cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Network Filter */}
      {showNetworkFilter && (
        <div className="relative">
          <select
            value={networkFilter}
            onChange={(e) => onNetworkChange(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all shadow-sm cursor-pointer max-w-[200px]"
          >
            <option value="all">All Networks</option>
            {networks.map(net => (
              <option key={net.id} value={net.id}>{net.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
        >
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}

      {/* Result Count */}
      <div className="ml-auto text-xs text-slate-500 dark:text-slate-500">
        <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{resultCount.toLocaleString()}</span> results
      </div>
    </div>
  );
});

NetworksFilterBar.displayName = 'NetworksFilterBar';

export default NetworksFilterBar;
