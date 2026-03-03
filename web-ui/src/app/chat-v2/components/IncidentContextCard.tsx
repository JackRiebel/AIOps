'use client';

/**
 * IncidentContextCard - Enterprise Incident Display for Chat
 *
 * A premium, enterprise-grade card that displays incident details
 * when the user navigates from the incidents page with "Ask AI" action.
 * Designed to fit seamlessly with the chat-v2 theme.
 */

import { memo } from 'react';
import {
  AlertTriangle,
  MapPin,
  Zap,
  Clock,
  TrendingUp,
  Activity,
  Server,
  Shield,
  ChevronRight
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface IncidentContextData {
  id: number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  eventCount: number;
  networkName?: string;
  networkId?: string;
  hypothesis?: string;
  confidenceScore?: number;
  affectedServices?: string[];
  createdAt?: string;
}

interface IncidentContextCardProps {
  incident: IncidentContextData;
  isAnalyzing?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        gradient: 'from-red-500/20 via-red-500/10 to-transparent',
        border: 'border-red-500/40',
        badge: 'bg-red-500 text-white',
        badgeDot: 'bg-red-400',
        icon: 'text-red-500',
        iconBg: 'bg-red-500/15',
        accent: 'text-red-500',
        ring: 'ring-red-500/20',
      };
    case 'high':
      return {
        gradient: 'from-orange-500/20 via-orange-500/10 to-transparent',
        border: 'border-orange-500/40',
        badge: 'bg-orange-500 text-white',
        badgeDot: 'bg-orange-400',
        icon: 'text-orange-500',
        iconBg: 'bg-orange-500/15',
        accent: 'text-orange-500',
        ring: 'ring-orange-500/20',
      };
    case 'medium':
      return {
        gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
        border: 'border-amber-500/40',
        badge: 'bg-amber-500 text-white',
        badgeDot: 'bg-amber-400',
        icon: 'text-amber-500',
        iconBg: 'bg-amber-500/15',
        accent: 'text-amber-500',
        ring: 'ring-amber-500/20',
      };
    default:
      return {
        gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
        border: 'border-blue-500/40',
        badge: 'bg-blue-500 text-white',
        badgeDot: 'bg-blue-400',
        icon: 'text-blue-500',
        iconBg: 'bg-blue-500/15',
        accent: 'text-blue-500',
        ring: 'ring-blue-500/20',
      };
  }
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// =============================================================================
// Main Component
// =============================================================================

export const IncidentContextCard = memo(({ incident, isAnalyzing = true }: IncidentContextCardProps) => {
  const config = getSeverityConfig(incident.severity);

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${config.border} bg-white dark:bg-slate-800/95 shadow-xl ${config.ring} ring-1 max-w-md`}>
      {/* Gradient accent at top */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${config.gradient} pointer-events-none`} />

      {/* Content */}
      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2.5 rounded-xl ${config.iconBg} flex-shrink-0 shadow-sm`}>
            <AlertTriangle className={`w-5 h-5 ${config.icon}`} strokeWidth={2.5} />
          </div>

          {/* Title area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Severity badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${config.badge} shadow-sm`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config.badgeDot} animate-pulse`} />
                {incident.severity}
              </span>
              {/* Incident ID */}
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                INC-{String(incident.id).padStart(4, '0')}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 leading-snug">
              {incident.title}
            </h3>
          </div>
        </div>

        {/* Metadata row */}
        <div className="mt-4 flex items-center gap-4 text-[11px]">
          {incident.networkName && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Server className="w-3.5 h-3.5" />
              <span className="font-medium truncate max-w-[120px]">{incident.networkName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-medium">{incident.eventCount} event{incident.eventCount !== 1 ? 's' : ''}</span>
          </div>
          {incident.createdAt && (
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimeAgo(incident.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Hypothesis section */}
        {incident.hypothesis && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    AI Hypothesis
                  </span>
                  {incident.confidenceScore && (
                    <span className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                      {incident.confidenceScore}% confidence
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {incident.hypothesis.length > 150
                    ? `${incident.hypothesis.slice(0, 150)}...`
                    : incident.hypothesis}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Affected Services */}
        {incident.affectedServices && incident.affectedServices.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Affected Services
            </div>
            <div className="flex flex-wrap gap-1.5">
              {incident.affectedServices.slice(0, 5).map((service, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 font-medium"
                >
                  {service}
                </span>
              ))}
              {incident.affectedServices.length > 5 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 px-1 font-medium">
                  +{incident.affectedServices.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer - Analysis status */}
        {isAnalyzing && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </div>
                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  Analyzing with AI
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <span>Generating insights</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

IncidentContextCard.displayName = 'IncidentContextCard';

/**
 * Type guard to check if message metadata contains incident context
 */
export function hasIncidentContext(
  metadata: unknown
): metadata is { incidentContext: { type: 'incident_analysis'; incident: IncidentContextData } } {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  if (!m.incidentContext || typeof m.incidentContext !== 'object') return false;
  const ctx = m.incidentContext as Record<string, unknown>;
  return ctx.type === 'incident_analysis' && ctx.incident !== null && typeof ctx.incident === 'object';
}

export default IncidentContextCard;
