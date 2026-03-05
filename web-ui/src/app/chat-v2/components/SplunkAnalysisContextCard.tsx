'use client';

/**
 * SplunkAnalysisContextCard - Splunk Analysis Context Display for Chat
 *
 * Displays Splunk security analysis context when the user clicks "Ask AI"
 * buttons from the Splunk page. Supports categories:
 * security-briefing, firewall, device-status, access-anomaly, threat-impact, assessment, general.
 */

import { memo } from 'react';
import {
  Shield,
  Activity,
  Eye,
  AlertTriangle,
  BrainCircuit,
  Lock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type SplunkAnalysisCategory =
  | 'security-briefing'
  | 'firewall'
  | 'device-status'
  | 'access-anomaly'
  | 'threat-impact'
  | 'assessment'
  | 'general';

export interface SplunkAnalysisContextData {
  category: SplunkAnalysisCategory;
  title: string;
  details: Record<string, string | number | undefined>;
  message: string;
}

interface SplunkAnalysisContextCardProps {
  data: SplunkAnalysisContextData;
  isAnalyzing?: boolean;
}

// =============================================================================
// Category Config
// =============================================================================

const CATEGORY_CONFIG: Record<SplunkAnalysisCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeColor: string;
  borderColor: string;
  gradient: string;
}> = {
  'security-briefing': {
    icon: Shield,
    label: 'Security Briefing',
    badgeColor: 'bg-purple-600 text-white',
    borderColor: 'border-purple-500/40',
    gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
  },
  firewall: {
    icon: Shield,
    label: 'Firewall Analysis',
    badgeColor: 'bg-red-500 text-white',
    borderColor: 'border-red-500/40',
    gradient: 'from-red-500/20 via-red-500/10 to-transparent',
  },
  'device-status': {
    icon: Activity,
    label: 'Device Status',
    badgeColor: 'bg-amber-500 text-white',
    borderColor: 'border-amber-500/40',
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
  },
  'access-anomaly': {
    icon: Eye,
    label: 'Access Anomaly',
    badgeColor: 'bg-orange-500 text-white',
    borderColor: 'border-orange-500/40',
    gradient: 'from-orange-500/20 via-orange-500/10 to-transparent',
  },
  'threat-impact': {
    icon: AlertTriangle,
    label: 'Threat Impact',
    badgeColor: 'bg-red-600 text-white',
    borderColor: 'border-red-600/40',
    gradient: 'from-red-500/20 via-red-500/10 to-transparent',
  },
  assessment: {
    icon: BrainCircuit,
    label: 'Security Assessment',
    badgeColor: 'bg-cyan-600 text-white',
    borderColor: 'border-cyan-500/40',
    gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
  },
  general: {
    icon: Lock,
    label: 'Splunk Analysis',
    badgeColor: 'bg-slate-500 text-white',
    borderColor: 'border-green-500/40',
    gradient: 'from-green-500/20 via-green-500/10 to-transparent',
  },
};

// =============================================================================
// Main Component
// =============================================================================

export const SplunkAnalysisContextCard = memo(({ data, isAnalyzing = true }: SplunkAnalysisContextCardProps) => {
  const config = CATEGORY_CONFIG[data.category] || CATEGORY_CONFIG.general;
  const Icon = config.icon;

  const details = Object.entries(data.details).filter(([, v]) => v !== undefined && v !== '');

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${config.borderColor} bg-white dark:bg-slate-800/95 shadow-xl ring-1 ring-green-500/20 max-w-md`}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${config.gradient} pointer-events-none`} />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex-shrink-0 shadow-sm">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm ${config.badgeColor}`}>
                <Icon className="w-3 h-3" />
                {config.label}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 leading-snug">
              {data.title}
            </h3>
          </div>
        </div>

        {/* Details grid */}
        {details.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {details.slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60">
                <div className="min-w-0">
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider truncate">{key}</div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums truncate">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {isAnalyzing && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </div>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
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

SplunkAnalysisContextCard.displayName = 'SplunkAnalysisContextCard';

/**
 * Type guard for Splunk analysis context
 */
export function hasSplunkAnalysisContext(
  metadata: unknown
): metadata is { splunkAnalysisContext: { type: 'splunk_analysis'; data: SplunkAnalysisContextData } } {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  if (!m.splunkAnalysisContext || typeof m.splunkAnalysisContext !== 'object') return false;
  const ctx = m.splunkAnalysisContext as Record<string, unknown>;
  return ctx.type === 'splunk_analysis' && ctx.data !== null && typeof ctx.data === 'object';
}

export default SplunkAnalysisContextCard;
