'use client';

/**
 * TEAnalysisContextCard - ThousandEyes Analysis Context Display for Chat
 *
 * Displays ThousandEyes analysis context when the user clicks any "Ask AI"
 * button from the ThousandEyes page. Supports multiple categories:
 * test, event, agent, alert-rule, outage, path, tag, general.
 */

import { memo } from 'react';
import Image from 'next/image';
import {
  FlaskConical,
  Bell,
  Server,
  AlertTriangle,
  Globe,
  Route,
  Tag,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type TEAnalysisCategory =
  | 'test'
  | 'event'
  | 'agent'
  | 'alert-rule'
  | 'outage'
  | 'path'
  | 'tag'
  | 'general';

export interface TEAnalysisContextData {
  category: TEAnalysisCategory;
  title: string;
  details: Record<string, string | number | undefined>;
  message: string;
}

interface TEAnalysisContextCardProps {
  data: TEAnalysisContextData;
  isAnalyzing?: boolean;
}

// =============================================================================
// Category Config
// =============================================================================

const CATEGORY_CONFIG: Record<TEAnalysisCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeColor: string;
  borderColor: string;
  gradient: string;
}> = {
  test: {
    icon: FlaskConical,
    label: 'Test Analysis',
    badgeColor: 'bg-blue-500 text-white',
    borderColor: 'border-blue-500/40',
    gradient: 'from-blue-500/20 via-blue-500/10 to-transparent',
  },
  event: {
    icon: AlertTriangle,
    label: 'Event Analysis',
    badgeColor: 'bg-amber-500 text-white',
    borderColor: 'border-amber-500/40',
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
  },
  agent: {
    icon: Server,
    label: 'Agent Analysis',
    badgeColor: 'bg-emerald-500 text-white',
    borderColor: 'border-emerald-500/40',
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
  },
  'alert-rule': {
    icon: Bell,
    label: 'Alert Rule Analysis',
    badgeColor: 'bg-red-500 text-white',
    borderColor: 'border-red-500/40',
    gradient: 'from-red-500/20 via-red-500/10 to-transparent',
  },
  outage: {
    icon: Globe,
    label: 'Outage Analysis',
    badgeColor: 'bg-purple-500 text-white',
    borderColor: 'border-purple-500/40',
    gradient: 'from-purple-500/20 via-purple-500/10 to-transparent',
  },
  path: {
    icon: Route,
    label: 'Path Analysis',
    badgeColor: 'bg-cyan-500 text-white',
    borderColor: 'border-cyan-500/40',
    gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
  },
  tag: {
    icon: Tag,
    label: 'Tag Analysis',
    badgeColor: 'bg-indigo-500 text-white',
    borderColor: 'border-indigo-500/40',
    gradient: 'from-indigo-500/20 via-indigo-500/10 to-transparent',
  },
  general: {
    icon: Sparkles,
    label: 'Network Analysis',
    badgeColor: 'bg-slate-500 text-white',
    borderColor: 'border-cyan-500/40',
    gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
  },
};

// =============================================================================
// Main Component
// =============================================================================

export const TEAnalysisContextCard = memo(({ data, isAnalyzing = true }: TEAnalysisContextCardProps) => {
  const config = CATEGORY_CONFIG[data.category] || CATEGORY_CONFIG.general;
  const Icon = config.icon;

  // Filter out undefined details
  const details = Object.entries(data.details).filter(([, v]) => v !== undefined && v !== '');

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${config.borderColor} bg-white dark:bg-slate-800/95 shadow-xl ring-1 ring-cyan-500/20 max-w-md`}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${config.gradient} pointer-events-none`} />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 shadow-sm">
            <Image src="/te-logo.png" alt="ThousandEyes" width={22} height={22} />
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

TEAnalysisContextCard.displayName = 'TEAnalysisContextCard';

/**
 * Type guard for TE analysis context
 */
export function hasTEAnalysisContext(
  metadata: unknown
): metadata is { teAnalysisContext: { type: 'te_analysis'; data: TEAnalysisContextData } } {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  if (!m.teAnalysisContext || typeof m.teAnalysisContext !== 'object') return false;
  const ctx = m.teAnalysisContext as Record<string, unknown>;
  return ctx.type === 'te_analysis' && ctx.data !== null && typeof ctx.data === 'object';
}

export default TEAnalysisContextCard;
