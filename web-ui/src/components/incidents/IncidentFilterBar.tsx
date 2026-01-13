'use client';

import { memo } from 'react';
import { CheckCircle, AlertTriangle, Sparkles, Clock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type WorkflowStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type Severity = 'critical' | 'high' | 'medium' | 'info' | null;
export type Confidence = 80 | 60 | 40 | null;

export interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
}

export interface IncidentFilterBarProps {
  activeTab: WorkflowStatus;
  onTabChange: (tab: WorkflowStatus) => void;
  selectedSeverity: Severity;
  onSeverityChange: (severity: Severity) => void;
  minConfidence: Confidence;
  onConfidenceChange: (confidence: Confidence) => void;
  timeRange: number;
  onTimeRangeChange: (range: number) => void;
  stats: IncidentStats;
  className?: string;
}

// ============================================================================
// FilterGroup Component
// ============================================================================

function FilterGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// TabButton Component
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
  gradient = 'from-cyan-600 to-blue-600',
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  gradient?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`px-2 py-1 rounded font-medium text-[10px] transition-all whitespace-nowrap ${
        active
          ? `bg-gradient-to-r ${gradient} text-white shadow-sm`
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// IncidentFilterBar Component
// ============================================================================

export const IncidentFilterBar = memo(({
  activeTab,
  onTabChange,
  selectedSeverity,
  onSeverityChange,
  minConfidence,
  onConfidenceChange,
  timeRange,
  onTimeRangeChange,
  stats,
  className = '',
}: IncidentFilterBarProps) => {
  const statusTabs: { value: WorkflowStatus; label: string }[] = [
    { value: 'open', label: `Open (${stats.open})` },
    { value: 'investigating', label: `Investigating (${stats.investigating})` },
    { value: 'resolved', label: `Resolved (${stats.resolved})` },
    { value: 'closed', label: `Closed (${stats.closed})` },
  ];

  const severityOptions: { value: Severity; label: string; gradient?: string }[] = [
    { value: null, label: 'All' },
    { value: 'critical', label: 'Critical', gradient: 'from-red-600 to-red-700' },
    { value: 'high', label: 'High', gradient: 'from-orange-600 to-orange-700' },
    { value: 'medium', label: 'Medium', gradient: 'from-yellow-600 to-yellow-700' },
    { value: 'info', label: 'Info', gradient: 'from-blue-600 to-blue-700' },
  ];

  const confidenceOptions: { value: Confidence; label: string }[] = [
    { value: null, label: 'All' },
    { value: 80, label: 'High (80%+)' },
    { value: 60, label: 'Med+ (60%+)' },
    { value: 40, label: 'Any (40%+)' },
  ];

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Status Filter */}
        <FilterGroup label="Status" icon={<CheckCircle className="w-3 h-3" />}>
          <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-md">
            {statusTabs.map((tab) => (
              <TabButton
                key={tab.value}
                active={activeTab === tab.value}
                onClick={() => onTabChange(tab.value)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </FilterGroup>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden md:block" />

        {/* Severity Filter */}
        <FilterGroup label="Severity" icon={<AlertTriangle className="w-3 h-3" />}>
          <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-md">
            {severityOptions.map((option) => (
              <TabButton
                key={option.value ?? 'all'}
                active={selectedSeverity === option.value}
                onClick={() => onSeverityChange(option.value)}
                gradient={option.gradient || 'from-cyan-600 to-blue-600'}
              >
                {option.label}
              </TabButton>
            ))}
          </div>
        </FilterGroup>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden md:block" />

        {/* Confidence Filter */}
        <FilterGroup label="Confidence" icon={<Sparkles className="w-3 h-3" />}>
          <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-900/50 p-0.5 rounded-md">
            {confidenceOptions.map((option) => (
              <TabButton
                key={option.value ?? 'all'}
                active={minConfidence === option.value}
                onClick={() => onConfidenceChange(option.value)}
                gradient="from-purple-600 to-cyan-600"
              >
                {option.label}
              </TabButton>
            ))}
          </div>
        </FilterGroup>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden md:block" />

        {/* Time Range */}
        <FilterGroup label="Range" icon={<Clock className="w-3 h-3" />}>
          <label htmlFor="incident-time-range" className="sr-only">
            Time range filter
          </label>
          <select
            id="incident-time-range"
            value={timeRange}
            onChange={(e) => onTimeRangeChange(Number(e.target.value))}
            aria-label="Filter incidents by time range"
            className="px-2 py-1 text-[10px] rounded-md bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          >
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={168}>7 days</option>
            <option value={720}>30 days</option>
          </select>
        </FilterGroup>
      </div>
    </div>
  );
});

IncidentFilterBar.displayName = 'IncidentFilterBar';

export default IncidentFilterBar;
