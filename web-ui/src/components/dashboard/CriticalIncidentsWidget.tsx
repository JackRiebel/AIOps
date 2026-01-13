'use client';

import { memo } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface Incident {
  id: string | number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'resolved';
  source: 'meraki' | 'catalyst' | 'splunk' | 'thousandeyes' | 'system';
  startTime: Date;
  eventCount?: number;
}

export interface CriticalIncidentsWidgetProps {
  incidents: Incident[];
  onViewIncident?: (incidentId: string | number) => void;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

// ============================================================================
// SeverityBadge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: Incident['severity'] }) {
  const config = {
    critical: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
    high: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
    low: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  };

  const { bg, text, dot } = config[severity];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {severity}
    </span>
  );
}

// ============================================================================
// SourceBadge Component
// ============================================================================

function SourceBadge({ source }: { source: Incident['source'] }) {
  const labels = {
    meraki: 'Meraki',
    catalyst: 'Catalyst',
    splunk: 'Splunk',
    thousandeyes: 'ThousandEyes',
    system: 'System',
  };

  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
      {labels[source]}
    </span>
  );
}

// ============================================================================
// IncidentRow Component
// ============================================================================

function IncidentRow({
  incident,
  onViewIncident,
}: {
  incident: Incident;
  onViewIncident?: (incidentId: string | number) => void;
}) {
  return (
    <button
      onClick={() => onViewIncident?.(incident.id)}
      className="w-full py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title & Severity */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <SeverityBadge severity={incident.severity} />
            <SourceBadge source={incident.source} />
          </div>

          {/* Title */}
          <p className="text-xs font-medium text-slate-900 dark:text-white truncate mb-0.5">
            {incident.title}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatTimeAgo(incident.startTime)}
            </span>
            {incident.eventCount && incident.eventCount > 1 && (
              <span>{incident.eventCount} events</span>
            )}
          </div>
        </div>

        {/* Hover Arrow */}
        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </button>
  );
}

// ============================================================================
// CriticalIncidentsWidget Component
// ============================================================================

export const CriticalIncidentsWidget = memo(({
  incidents,
  onViewIncident,
  loading,
  className = '',
}: CriticalIncidentsWidgetProps) => {
  // Sort by severity and time
  const sortedIncidents = [...incidents]
    .filter((i) => i.status !== 'resolved')
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.startTime.getTime() - a.startTime.getTime();
    })
    .slice(0, 5);

  const criticalCount = sortedIncidents.filter((i) => i.severity === 'critical').length;

  const badge = (
    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
      Last 24h
    </span>
  );

  return (
    <DashboardCard
      title="Active Incidents"
      icon={<AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500' : ''}`} />}
      href="/incidents"
      linkText="View All →"
      accent={criticalCount > 0 ? 'red' : 'amber'}
      loading={loading}
      className={className}
      badge={badge}
    >
      {sortedIncidents.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xs font-medium text-slate-900 dark:text-white">All Clear</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">No active incidents in last 24 hours</p>
        </div>
      ) : (
        /* Incident List */
        <div className="flex flex-col">
          {sortedIncidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onViewIncident={onViewIncident}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  );
});

CriticalIncidentsWidget.displayName = 'CriticalIncidentsWidget';

export default CriticalIncidentsWidget;
