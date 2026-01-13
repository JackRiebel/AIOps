'use client';

import { memo, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  Layout,
  Download,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import type { DeviceType, DeviceStatus } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

export type LayoutType = 'hierarchical' | 'force' | 'radial';

export interface TopologyToolbarProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;

  // Filters
  statusFilter: DeviceStatus | 'all';
  onStatusFilterChange: (status: DeviceStatus | 'all') => void;
  typeFilter: DeviceType | 'all';
  onTypeFilterChange: (type: DeviceType | 'all') => void;

  // Layout
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;

  // Export
  onExport: (format: 'png' | 'svg' | 'json') => void;

  // Auto-refresh
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;

  // Refresh
  onRefresh: () => void;
  isRefreshing?: boolean;

  className?: string;
}

// ============================================================================
// Filter Options
// ============================================================================

const STATUS_OPTIONS: { value: DeviceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'alerting', label: 'Alerting' },
];

const TYPE_OPTIONS: { value: DeviceType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'MX', label: 'Security (MX)' },
  { value: 'MS', label: 'Switch (MS)' },
  { value: 'MR', label: 'Wireless (MR)' },
  { value: 'MV', label: 'Camera (MV)' },
  { value: 'MG', label: 'Cellular (MG)' },
  { value: 'MT', label: 'Sensor (MT)' },
];

const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'force', label: 'Force-Directed' },
  { value: 'radial', label: 'Radial' },
];

// ============================================================================
// TopologyToolbar Component
// ============================================================================

export const TopologyToolbar = memo(({
  searchQuery,
  onSearchChange,
  searchInputRef,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  layout,
  onLayoutChange,
  onExport,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  isRefreshing = false,
  className = '',
}: TopologyToolbarProps) => {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localInputRef;

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSearchChange]); // inputRef is a stable ref, no need to include

  return (
    <div
      className={`flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 ${className}`}
    >
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search devices... (/ or ⌘K)"
          className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:text-white"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

      {/* Status Filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as DeviceStatus | 'all')}
          className="appearance-none pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:text-white cursor-pointer"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Type Filter */}
      <div className="relative">
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as DeviceType | 'all')}
          className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:text-white cursor-pointer"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />

      {/* Layout Selector */}
      <div className="relative">
        <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <select
          value={layout}
          onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
          className="appearance-none pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:text-white cursor-pointer"
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export Button */}
      <div className="relative group">
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span className="text-slate-700 dark:text-slate-300">Export</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        {/* Dropdown */}
        <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
          <button
            onClick={() => onExport('png')}
            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            Export PNG
          </button>
          <button
            onClick={() => onExport('svg')}
            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            Export SVG
          </button>
          <button
            onClick={() => onExport('json')}
            className="w-full px-4 py-2 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Auto-Refresh Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => onAutoRefreshChange(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
        />
        <span className="text-sm text-slate-600 dark:text-slate-400">Auto-refresh</span>
      </label>

      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        title="Refresh"
      >
        <RefreshCw
          className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
});

TopologyToolbar.displayName = 'TopologyToolbar';

export default TopologyToolbar;
