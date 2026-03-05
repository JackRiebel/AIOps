'use client';

import { useMemo } from 'react';
import { Clock, TrendingDown, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { HelpTooltip } from '@/components/common';

// ============================================================================
// Types
// ============================================================================

export interface IncidentSession {
  id: number;
  sessionName: string;
  incidentId: number;
  incidentType: string;
  resolved: boolean;
  resolutionTimeMinutes: number;
  baselineMinutes: number;
  startedAt: string;
  endedAt?: string;
}

export interface MTTRData {
  baselineMinutes: number;
  aiAssistedMinutes: number;
  improvementPercentage: number;
  incidentsResolved: number;
  avgTimeSavedPerIncident: number;
  recentIncidents: IncidentSession[];
}

interface MTTRDashboardProps {
  data: MTTRData;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getImprovementColor(pct: number): { text: string; bg: string } {
  if (pct >= 50) {
    return { text: 'text-emerald-500', bg: 'bg-emerald-500' };
  } else if (pct >= 25) {
    return { text: 'text-green-500', bg: 'bg-green-500' };
  } else if (pct >= 0) {
    return { text: 'text-yellow-500', bg: 'bg-yellow-500' };
  } else {
    return { text: 'text-red-500', bg: 'bg-red-500' };
  }
}

// ============================================================================
// Component
// ============================================================================

export function MTTRDashboard({ data, className = '' }: MTTRDashboardProps) {
  const improvementColors = useMemo(
    () => getImprovementColor(data.improvementPercentage),
    [data.improvementPercentage]
  );

  const baselineWidth = 100;
  const aiWidth = data.baselineMinutes > 0
    ? Math.max(5, (data.aiAssistedMinutes / data.baselineMinutes) * 100)
    : 50;

  if (data.incidentsResolved === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            MTTR Impact
          </h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
          No incident sessions recorded yet. Link AI sessions to incidents to track MTTR improvement.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-emerald-500 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10">
              <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
              Mean Time to Resolution (MTTR)
              <HelpTooltip content="Compares your AI-assisted resolution times against industry benchmarks (NOC/IT operations research). MTTR = average time from detection to resolution." />
            </h3>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${improvementColors.bg}/10`}>
            <TrendingDown className={`w-3.5 h-3.5 ${improvementColors.text}`} />
            <span className={`text-xs font-medium ${improvementColors.text}`}>
              {data.improvementPercentage.toFixed(0)}% faster
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Bars */}
      <div className="p-5">
        <div className="space-y-4 mb-6">
          {/* Before AI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                Industry Benchmark
                <HelpTooltip content="Industry benchmark for manual incident resolution time (without AI). Based on NOC performance data from INOC, Gartner, and ServiceNow research. Not specific to your organization." />
              </span>
              <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {formatTime(data.baselineMinutes)}
              </span>
            </div>
            <div className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden">
              <div
                className="h-full bg-slate-400 dark:bg-slate-500 flex items-center justify-end px-3 transition-all duration-700"
                style={{ width: `${baselineWidth}%` }}
              >
                <span className="text-xs font-medium text-white">avg</span>
              </div>
            </div>
          </div>

          {/* With AI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                With AI assistance
                <HelpTooltip content="Actual average resolution time when using the AI assistant, measured from your incident-linked sessions." />
              </span>
              <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {formatTime(data.aiAssistedMinutes)}
              </span>
            </div>
            <div className="h-8 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 flex items-center justify-end px-3 transition-all duration-700"
                style={{ width: `${aiWidth}%` }}
              >
                <span className="text-xs font-medium text-white">avg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg mb-6">
          <div className="text-center border-l-2 border-l-blue-500 pl-3">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.incidentsResolved}
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              Incidents Resolved
              <HelpTooltip content="Number of incidents manually linked to AI sessions that were marked as resolved." />
            </p>
          </div>
          <div className="text-center border-l-2 border-l-emerald-500 pl-3">
            <p className={`text-2xl font-bold ${improvementColors.text}`}>
              {data.improvementPercentage.toFixed(0)}%
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              vs Benchmark
              <HelpTooltip content="Percentage improvement compared to industry benchmark resolution times. Based on NOC/IT operations research, not your org's historical data." />
            </p>
          </div>
          <div className="text-center border-l-2 border-l-cyan-500 pl-3">
            <p className="text-2xl font-bold text-emerald-500">
              {formatTime(data.avgTimeSavedPerIncident)}
            </p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              Est. Saved/Incident
              <HelpTooltip content="Estimated average time saved per incident vs industry benchmark. Actual savings may vary." />
            </p>
          </div>
        </div>

        {/* Recent Incidents */}
        {data.recentIncidents.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Recent Incidents Resolved
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {data.recentIncidents.slice(0, 5).map((incident) => {
                const savedPct = incident.baselineMinutes > 0
                  ? ((incident.baselineMinutes - incident.resolutionTimeMinutes) / incident.baselineMinutes) * 100
                  : 0;
                const savedColors = getImprovementColor(savedPct);

                return (
                  <div
                    key={incident.id}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {incident.resolved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {incident.sessionName || `Incident #${incident.incidentId}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {incident.incidentType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-mono">
                        {formatTime(incident.resolutionTimeMinutes)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400 line-through font-mono">
                        ~{formatTime(incident.baselineMinutes)}
                      </span>
                      <span className={`font-medium ${savedColors.text}`}>
                        ({savedPct.toFixed(0)}% faster)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MTTRDashboard;
