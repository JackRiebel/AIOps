'use client';

import { AlertTriangle, Clock, MapPin, Zap } from 'lucide-react';

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
}

// =============================================================================
// Helper Functions
// =============================================================================

function getSeverityStyle(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        badge: 'bg-red-500/20 text-red-300',
        icon: 'text-red-400',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        badge: 'bg-orange-500/20 text-orange-300',
        icon: 'text-orange-400',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
        badge: 'bg-yellow-500/20 text-yellow-300',
        icon: 'text-yellow-400',
      };
    default:
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        badge: 'bg-blue-500/20 text-blue-300',
        icon: 'text-blue-400',
      };
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function IncidentContextCard({ incident }: IncidentContextCardProps) {
  const style = getSeverityStyle(incident.severity);

  return (
    <div className={`rounded-xl ${style.bg} border ${style.border} p-4 max-w-md`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${style.bg}`}>
          <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}>
              {incident.severity.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">
              Incident #{incident.id}
            </span>
          </div>
          <h4 className="text-sm font-medium text-white mt-1 line-clamp-2">
            {incident.title}
          </h4>
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 space-y-2">
        {/* Network & Events */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {incident.networkName && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{incident.networkName}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>{incident.eventCount} event{incident.eventCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Hypothesis */}
        {incident.hypothesis && (
          <div className="text-xs text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2">
            <span className="text-slate-400">Hypothesis: </span>
            {incident.hypothesis.split('.')[0]}.
            {incident.confidenceScore && (
              <span className="text-slate-500 ml-1">
                ({incident.confidenceScore}% confidence)
              </span>
            )}
          </div>
        )}

        {/* Affected Services */}
        {incident.affectedServices && incident.affectedServices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {incident.affectedServices.slice(0, 4).map((service, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded"
              >
                {service}
              </span>
            ))}
            {incident.affectedServices.length > 4 && (
              <span className="text-xs text-slate-500">
                +{incident.affectedServices.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action label */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <p className="text-xs text-cyan-400">
          Analyzing incident and creating monitoring cards...
        </p>
      </div>
    </div>
  );
}

/**
 * Check if message data contains incident context
 */
export function isIncidentContext(data: unknown): data is { incident: IncidentContextData } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === 'incident_analysis' &&
    d.incident !== null &&
    typeof d.incident === 'object'
  );
}

export default IncidentContextCard;
