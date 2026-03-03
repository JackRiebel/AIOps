'use client';

import { memo, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { TopologyNode } from './types';
import { ZONE_CONFIG, ZONE_ORDER } from './types';

// ============================================================================
// PathDiagnosticHeader — Explicit bottleneck diagnosis
// Replaces the vague ZoneSummaryBar with clear issue/healthy messaging
// ============================================================================

export interface PathDiagnosticHeaderProps {
  nodes: TopologyNode[];
}

interface ZoneStat {
  zone: string;
  label: string;
  hopCount: number;
  totalLatency: number;
  maxLoss: number;
  latencyPercent: number;
}

export const PathDiagnosticHeader = memo(({ nodes }: PathDiagnosticHeaderProps) => {
  const diagnosis = useMemo(() => {
    if (nodes.length === 0) return null;

    const totalLatency = nodes.reduce((s, n) => s + n.latency, 0) || 1;

    // Compute per-zone stats
    const zoneStats: ZoneStat[] = ZONE_ORDER
      .map(zone => {
        const zoneNodes = nodes.filter(n => n.zone === zone);
        const zLatency = zoneNodes.reduce((s, n) => s + n.latency, 0);
        const maxLoss = zoneNodes.length > 0 ? Math.max(...zoneNodes.map(n => n.loss)) : 0;
        return {
          zone,
          label: ZONE_CONFIG[zone]?.label || zone,
          hopCount: zoneNodes.length,
          totalLatency: zLatency,
          maxLoss,
          latencyPercent: (zLatency / totalLatency) * 100,
        };
      })
      .filter(z => z.hopCount > 0);

    // Find bottleneck zone (exclude source/destination)
    const transitZones = zoneStats.filter(z => z.zone !== 'source' && z.zone !== 'destination');
    const bottleneck = transitZones.length > 0
      ? transitZones.reduce((max, z) => z.totalLatency > max.totalLatency ? z : max, transitZones[0])
      : null;

    // Count high-latency hops
    const highLatencyHops = nodes.filter(n => n.latency > 20).length;
    const hasLoss = nodes.some(n => n.loss > 1);
    const hasHighLatency = totalLatency > 100;

    // Determine severity
    const isIssue = (bottleneck && bottleneck.latencyPercent > 50 && hasHighLatency) || hasLoss;
    const severity: 'healthy' | 'warning' | 'critical' =
      hasLoss ? 'critical' : isIssue ? 'warning' : 'healthy';

    let message: string;
    let detail: string;

    if (severity === 'healthy') {
      message = `Path is healthy — ${totalLatency.toFixed(0)}ms total latency across ${nodes.length} hops`;
      detail = 'No issues detected.';
    } else if (bottleneck) {
      message = `${bottleneck.label} is the bottleneck — ${bottleneck.totalLatency.toFixed(0)}ms (${bottleneck.latencyPercent.toFixed(0)}% of path latency)`;
      const parts: string[] = [];
      if (highLatencyHops > 0) parts.push(`${highLatencyHops} hop${highLatencyHops > 1 ? 's' : ''} with >20ms response time`);
      if (hasLoss) {
        const lossHops = nodes.filter(n => n.loss > 0);
        parts.push(`${lossHops.length} hop${lossHops.length > 1 ? 's' : ''} with packet loss`);
      }
      detail = parts.join('. ') + '.';
    } else {
      message = `Elevated latency — ${totalLatency.toFixed(0)}ms total across ${nodes.length} hops`;
      detail = `${highLatencyHops} hops with >20ms response time.`;
    }

    return { severity, message, detail, zoneStats, totalLatency };
  }, [nodes]);

  if (!diagnosis) return null;

  const severityConfig = {
    healthy: {
      border: 'border-l-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-500/5',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
    },
    warning: {
      border: 'border-l-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-500/5',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    critical: {
      border: 'border-l-red-500',
      bg: 'bg-red-50 dark:bg-red-500/5',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
    },
  };

  const config = severityConfig[diagnosis.severity];
  const Icon = config.icon;

  return (
    <div className={`${config.bg} border border-slate-200 dark:border-slate-700/50 border-l-4 ${config.border} rounded-lg p-3 mb-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 ${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {diagnosis.message}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{diagnosis.detail}</p>
        </div>

        {/* Zone breakdown pills */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {diagnosis.zoneStats
            .filter(z => z.zone !== 'source' && z.zone !== 'destination')
            .map(z => {
              const zConfig = ZONE_CONFIG[z.zone];
              return (
                <span
                  key={z.zone}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${zConfig.bgColor} ${zConfig.color} border ${zConfig.borderColor}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${zConfig.dotColor}`} />
                  {z.totalLatency.toFixed(0)}ms
                </span>
              );
            })}
        </div>
      </div>
    </div>
  );
});

PathDiagnosticHeader.displayName = 'PathDiagnosticHeader';
