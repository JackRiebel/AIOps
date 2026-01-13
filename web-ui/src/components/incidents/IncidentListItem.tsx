'use client';

import { memo } from 'react';
import { Clock, FileText, ChevronRight, Sparkles, Lightbulb, Network, Zap } from 'lucide-react';
import type { Incident } from './index';

// ============================================================================
// Types
// ============================================================================

export interface IncidentListItemProps {
  incident: Incident;
  isSelected: boolean;
  onSelect: () => void;
  formatTimestamp: (timestamp: string) => string;
}

// ============================================================================
// Severity Configuration
// ============================================================================

const severityConfig = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-500/10',
    border: 'border-orange-200 dark:border-orange-500/30',
    text: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-yellow-100 dark:bg-yellow-500/10',
    border: 'border-yellow-200 dark:border-yellow-500/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
};

// ============================================================================
// ConfidenceBadge Component
// ============================================================================

function ConfidenceBadge({ score }: { score: number | null }) {
  if (!score) return null;

  const color =
    score >= 80
      ? 'from-emerald-500 to-green-600'
      : score >= 60
      ? 'from-yellow-500 to-amber-600'
      : score >= 40
      ? 'from-orange-500 to-red-600'
      : 'from-red-600 to-rose-700';

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${color} text-white text-[10px] font-bold shadow-sm`}
    >
      <Sparkles className="w-3 h-3" />
      {score}%
    </div>
  );
}

// ============================================================================
// AI Assisted Badge Component
// ============================================================================

function AIAssistedBadge({ timeSavedSeconds }: { timeSavedSeconds?: number }) {
  // Format time saved
  const formatTimeSaved = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-500/30">
      <Zap className="w-3 h-3" />
      AI Assisted
      {timeSavedSeconds && timeSavedSeconds > 0 && (
        <span className="ml-1 text-emerald-600 dark:text-emerald-300">
          ~{formatTimeSaved(timeSavedSeconds)} saved
        </span>
      )}
    </div>
  );
}

// ============================================================================
// IncidentListItem Component
// ============================================================================

export const IncidentListItem = memo(({
  incident,
  isSelected,
  onSelect,
  formatTimestamp,
}: IncidentListItemProps) => {
  const sev = severityConfig[incident.severity] || severityConfig.info;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
      aria-label={`${incident.severity} severity incident: ${incident.title}. ${incident.event_count} events. ${isSelected ? 'Selected' : 'Click to view details'}`}
      className={`
        group relative bg-white dark:bg-slate-800/30 rounded-xl p-4 cursor-pointer
        transition-all duration-200 border shadow-sm dark:shadow-none
        focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        ${
          isSelected
            ? 'border-cyan-500/50 bg-cyan-50/50 dark:bg-slate-800/50 shadow-lg shadow-cyan-500/10'
            : 'border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600/50 hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }
      `}
    >
      {/* Severity indicator stripe */}
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${sev.dot}`} />

      <div className="flex items-start justify-between pl-3">
        <div className="flex-1 pr-3">
          {/* Severity & Confidence Badges */}
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${sev.bg} ${sev.text} border ${sev.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {incident.severity}
            </span>
            <ConfidenceBadge score={incident.confidence_score} />
            {incident.ai_assisted && (
              <AIAssistedBadge timeSavedSeconds={incident.ai_time_saved_seconds} />
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition text-sm leading-tight mt-1.5">
            {incident.title}
          </h3>

          {/* Meta Info */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(incident.start_time)}
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {incident.event_count} events
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center pt-1">
          <ChevronRight
            className={`w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all ${
              isSelected ? 'text-cyan-500 dark:text-cyan-400' : ''
            }`}
          />
        </div>
      </div>

      {/* AI Hypothesis Preview */}
      {incident.root_cause_hypothesis && (
        <div
          className={`mt-3 ml-3 p-2.5 rounded-lg border transition-all ${
            isSelected
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-500/40'
              : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase">
              AI Hypothesis
            </span>
          </div>
          <p
            className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed ${
              isSelected ? '' : 'line-clamp-2'
            }`}
          >
            {incident.root_cause_hypothesis}
          </p>
        </div>
      )}

      {/* Affected Services */}
      {incident.affected_services && incident.affected_services.length > 0 && (
        <div className="mt-2.5 ml-3 flex flex-wrap gap-1">
          {incident.affected_services.slice(0, 3).map((service, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900/50 rounded text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50"
            >
              {service}
            </span>
          ))}
          {incident.affected_services.length > 3 && (
            <span className="px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-500">
              +{incident.affected_services.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Network Badge */}
      {incident.network_name && (
        <div className="mt-2.5 ml-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-500/10 rounded text-[10px] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
            <Network className="w-3 h-3" />
            {incident.network_name}
          </span>
        </div>
      )}
    </div>
  );
});

IncidentListItem.displayName = 'IncidentListItem';

export default IncidentListItem;
