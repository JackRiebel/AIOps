'use client';

import { memo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { NetworkWithMeta } from './types';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// NetworksFilterBar Component
// ============================================================================

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
    <div className={`flex items-center gap-3 flex-wrap bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-2.5 ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Divider */}
      {(showStatusFilter || showNetworkFilter) && (
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700/50" />
      )}

      {/* Filters Icon */}
      {(showStatusFilter || showNetworkFilter) && (
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Filters</span>
        </div>
      )}

      {/* Status Filter */}
      {showStatusFilter && (
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as 'all' | 'online' | 'offline')}
          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      )}

      {/* Network Filter */}
      {showNetworkFilter && (
        <select
          value={networkFilter}
          onChange={(e) => onNetworkChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 max-w-[180px]"
        >
          <option value="all">All Networks</option>
          {networks.map(net => (
            <option key={net.id} value={net.id}>{net.name}</option>
          ))}
        </select>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}

      {/* Result Count */}
      <div className="ml-auto text-xs text-slate-500 dark:text-slate-500">
        <span className="font-medium text-slate-700 dark:text-slate-300">{resultCount}</span> results
      </div>
    </div>
  );
});

NetworksFilterBar.displayName = 'NetworksFilterBar';

export default NetworksFilterBar;
