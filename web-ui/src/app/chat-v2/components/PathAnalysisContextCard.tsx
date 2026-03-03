'use client';

/**
 * PathAnalysisContextCard - Network Path Analysis Display for Chat
 *
 * Displays ThousandEyes path analysis context when the user navigates
 * from the AI Journey page with "Analyze Path" action.
 * Follows the same pattern as IncidentContextCard.
 */

import { memo } from 'react';
import Image from 'next/image';
import {
  Activity,
  Clock,
  AlertTriangle,
  ChevronRight,
  Gauge,
  Route,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface PathHopContext {
  hopNumber: number;
  ip: string;
  hostname?: string;
  latency: number;
  loss: number;
  zone: string;
  network?: string;
}

export interface PathAnalysisContextData {
  providerName: string;
  hopCount: number;
  testId?: number;
  hops: PathHopContext[];
  bottleneck: {
    hopNumber: number;
    hostname?: string;
    ip: string;
    latency: number;
    zone: string;
  };
  metrics?: {
    health?: string;
    latency?: number;
    loss?: number;
    availability?: number;
  };
  costImpact?: {
    excessLatency?: number;
    wastedCompute?: number;
  };
}

interface PathAnalysisContextCardProps {
  pathData: PathAnalysisContextData;
  isAnalyzing?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function getHealthConfig(health?: string) {
  switch (health) {
    case 'healthy':
      return {
        gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
        border: 'border-emerald-500/40',
        badge: 'bg-emerald-500 text-white',
        badgeDot: 'bg-emerald-400',
        accent: 'text-emerald-500',
        ring: 'ring-emerald-500/20',
      };
    case 'degraded':
      return {
        gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
        border: 'border-amber-500/40',
        badge: 'bg-amber-500 text-white',
        badgeDot: 'bg-amber-400',
        accent: 'text-amber-500',
        ring: 'ring-amber-500/20',
      };
    case 'failing':
      return {
        gradient: 'from-red-500/20 via-red-500/10 to-transparent',
        border: 'border-red-500/40',
        badge: 'bg-red-500 text-white',
        badgeDot: 'bg-red-400',
        accent: 'text-red-500',
        ring: 'ring-red-500/20',
      };
    default:
      return {
        gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
        border: 'border-cyan-500/40',
        badge: 'bg-cyan-500 text-white',
        badgeDot: 'bg-cyan-400',
        accent: 'text-cyan-500',
        ring: 'ring-cyan-500/20',
      };
  }
}

const ZONE_COLORS: Record<string, string> = {
  source: 'bg-emerald-500',
  local: 'bg-blue-500',
  isp: 'bg-amber-500',
  cloud: 'bg-purple-500',
  destination: 'bg-cyan-500',
};

// =============================================================================
// Main Component
// =============================================================================

export const PathAnalysisContextCard = memo(({ pathData, isAnalyzing = true }: PathAnalysisContextCardProps) => {
  const config = getHealthConfig(pathData.metrics?.health);
  const bottleneck = pathData.bottleneck;

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${config.border} bg-white dark:bg-slate-800/95 shadow-xl ${config.ring} ring-1 max-w-md`}>
      {/* Gradient accent at top */}
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${config.gradient} pointer-events-none`} />

      {/* Content */}
      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* ThousandEyes logo */}
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 shadow-sm">
            <Image src="/te-logo.png" alt="ThousandEyes" width={22} height={22} />
          </div>

          {/* Title area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Health badge */}
              {pathData.metrics?.health && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${config.badge} shadow-sm`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${config.badgeDot} animate-pulse`} />
                  {pathData.metrics.health}
                </span>
              )}
              {/* Hop count */}
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                {pathData.hopCount} hops
              </span>
            </div>

            {/* Provider name */}
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 leading-snug">
              Path Analysis: {pathData.providerName}
            </h3>
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-4 flex items-center gap-4 text-[11px]">
          {pathData.metrics?.latency != null && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">{pathData.metrics.latency.toFixed(0)}ms latency</span>
            </div>
          )}
          {pathData.metrics?.loss != null && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-medium">{pathData.metrics.loss.toFixed(1)}% loss</span>
            </div>
          )}
          {pathData.metrics?.availability != null && (
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Gauge className="w-3.5 h-3.5" />
              <span>{pathData.metrics.availability.toFixed(1)}% avail</span>
            </div>
          )}
        </div>

        {/* Bottleneck section */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Bottleneck
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ZONE_COLORS[bottleneck.zone] || 'bg-slate-500'} text-white`}>
                  {bottleneck.zone}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                Hop {bottleneck.hopNumber}: {bottleneck.hostname || bottleneck.ip} — {bottleneck.latency.toFixed(0)}ms
              </p>
            </div>
          </div>
        </div>

        {/* Hop zone summary */}
        {pathData.hops.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Route className="w-3 h-3" />
              Path Zones
            </div>
            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
              {pathData.hops.map((hop, i) => (
                <div
                  key={i}
                  className={`flex-1 ${ZONE_COLORS[hop.zone] || 'bg-slate-400'} ${hop.latency > 50 ? 'opacity-100' : 'opacity-60'}`}
                  title={`Hop ${hop.hopNumber}: ${hop.hostname || hop.ip} (${hop.latency.toFixed(0)}ms, ${hop.zone})`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cost impact */}
        {pathData.costImpact && (pathData.costImpact.excessLatency != null || pathData.costImpact.wastedCompute != null) && (
          <div className="mt-3 flex items-center gap-3 text-[11px]">
            {pathData.costImpact.excessLatency != null && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                +{pathData.costImpact.excessLatency.toFixed(0)}ms excess latency
              </span>
            )}
            {pathData.costImpact.wastedCompute != null && (
              <span className="text-red-500 dark:text-red-400 font-medium">
                ${pathData.costImpact.wastedCompute.toFixed(2)} wasted
              </span>
            )}
          </div>
        )}

        {/* Footer - Analysis status */}
        {isAnalyzing && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </div>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                  Analyzing path with AI
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <span>Finding optimizations</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

PathAnalysisContextCard.displayName = 'PathAnalysisContextCard';

/**
 * Type guard to check if message metadata contains path analysis context
 */
export function hasPathAnalysisContext(
  metadata: unknown
): metadata is { pathAnalysisContext: { type: 'path_analysis'; pathData: PathAnalysisContextData } } {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  if (!m.pathAnalysisContext || typeof m.pathAnalysisContext !== 'object') return false;
  const ctx = m.pathAnalysisContext as Record<string, unknown>;
  return ctx.type === 'path_analysis' && ctx.pathData !== null && typeof ctx.pathData === 'object';
}

export default PathAnalysisContextCard;
