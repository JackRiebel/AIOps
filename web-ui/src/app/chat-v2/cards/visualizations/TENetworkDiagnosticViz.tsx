'use client';

/**
 * TENetworkDiagnosticViz
 *
 * Cross-platform diagnostic card combining ThousandEyes path data,
 * Splunk log excerpts, and findings from multiple sources.
 * All sections except severity and findings are optional.
 */

import { memo, useMemo } from 'react';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import {
  TopologyNode,
  TopologyLink,
  PathHop,
  classifyZone,
  getLinkHealth,
} from '@/components/thousandeyes/types';

interface MetricValue {
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface Finding {
  severity: 'critical' | 'warning' | 'info';
  text: string;
  source?: string;
}

interface LogExcerpt {
  timestamp: string;
  level: string;
  message: string;
}

interface DiagnosticData {
  severity: 'critical' | 'warning' | 'info' | 'healthy';
  device?: { name: string; ip?: string; status?: string; platform?: string };
  testName?: string;
  metrics?: {
    latency?: MetricValue;
    loss?: MetricValue;
    jitter?: MetricValue;
  };
  pathHops?: PathHop[];
  findings: Finding[];
  logExcerpts?: LogExcerpt[];
  rootCause?: string;
}

interface TENetworkDiagnosticVizProps {
  data: Record<string, unknown>;
}

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', label: 'CRITICAL' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', label: 'WARNING' },
  info: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', label: 'INFO' },
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', label: 'HEALTHY' },
};

const FINDING_ICONS: Record<string, string> = {
  critical: '\u274C',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  err: 'text-red-500',
  error: 'text-red-500',
  warn: 'text-amber-500',
  warning: 'text-amber-500',
  info: 'text-blue-400',
  debug: 'text-slate-400',
};

export const TENetworkDiagnosticViz = memo(({ data }: TENetworkDiagnosticVizProps) => {
  const diag = data as unknown as DiagnosticData;
  const severity = diag.severity ?? 'info';
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;

  // Build path nodes/links if pathHops provided
  const pathData = useMemo(() => {
    if (!diag.pathHops || !Array.isArray(diag.pathHops) || diag.pathHops.length === 0) return null;
    const hops = diag.pathHops;
    const totalHops = hops.length;

    const nodes: TopologyNode[] = hops.map((hop, i) => ({
      id: `diag-hop-${hop.hopNumber ?? i}`,
      label: hop.hostname || hop.ipAddress,
      ip: hop.ipAddress,
      zone: classifyZone(hop, i, totalHops),
      latency: hop.latency,
      loss: hop.loss,
      network: hop.network,
      hopNumber: hop.hopNumber ?? i + 1,
      prefix: hop.prefix,
    }));

    const links: TopologyLink[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        latency: nodes[i + 1].latency,
        loss: nodes[i + 1].loss,
        health: getLinkHealth(nodes[i + 1].latency, nodes[i + 1].loss),
      });
    }

    return { nodes, links };
  }, [diag.pathHops]);

  const hasMetrics = diag.metrics && (diag.metrics.latency || diag.metrics.loss || diag.metrics.jitter);
  const hasFindings = Array.isArray(diag.findings) && diag.findings.length > 0;
  const hasLogs = Array.isArray(diag.logExcerpts) && diag.logExcerpts.length > 0;

  if (!hasFindings) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
        No diagnostic data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`flex items-start gap-2 px-3 py-2 ${cfg.bg} border-b ${cfg.border} flex-shrink-0`}>
        <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
            {diag.device && (
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {diag.device.name}
                {diag.device.ip && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({diag.device.ip})</span>}
              </span>
            )}
          </div>
          {diag.testName && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Test: {diag.testName}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Metrics Row */}
        {hasMetrics && (
          <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-200 dark:border-slate-700/50">
            {diag.metrics!.latency && <MetricBadge label="Latency" metric={diag.metrics!.latency} />}
            {diag.metrics!.loss && <MetricBadge label="Loss" metric={diag.metrics!.loss} />}
            {diag.metrics!.jitter && <MetricBadge label="Jitter" metric={diag.metrics!.jitter} />}
          </div>
        )}

        {/* Path Flow (compact) */}
        {pathData && (
          <div className="border-b border-slate-200 dark:border-slate-700/50 overflow-x-auto">
            <NetworkPathFlow nodes={pathData.nodes} links={pathData.links} />
          </div>
        )}

        {/* Findings */}
        {hasFindings && (
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Findings</div>
            <div className="space-y-1">
              {diag.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="flex-shrink-0 mt-px">{FINDING_ICONS[f.severity] ?? FINDING_ICONS.info}</span>
                  <span className="text-slate-700 dark:text-slate-300">{f.text}</span>
                  {f.source && (
                    <span className="flex-shrink-0 text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                      {f.source}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log Excerpts */}
        {hasLogs && (
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Log Excerpts</div>
            <div className="bg-slate-900 dark:bg-slate-950 rounded-md p-2 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[100px] overflow-y-auto">
              {diag.logExcerpts!.map((log, i) => {
                const levelColor = LOG_LEVEL_COLORS[log.level.toLowerCase()] ?? 'text-slate-400';
                return (
                  <div key={i} className="whitespace-nowrap">
                    <span className="text-slate-500">{log.timestamp}</span>
                    {' '}
                    <span className={levelColor}>{log.level.toUpperCase()}</span>
                    {' '}
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Root Cause */}
        {diag.rootCause && (
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Root Cause</div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{diag.rootCause}</p>
          </div>
        )}
      </div>
    </div>
  );
});

TENetworkDiagnosticViz.displayName = 'TENetworkDiagnosticViz';

/** Metric badge with status coloring */
function MetricBadge({ label, metric }: { label: string; metric: MetricValue }) {
  const statusColor =
    metric.status === 'critical' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' :
    metric.status === 'warning' ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' :
    'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';

  return (
    <div className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1 ${statusColor}`}>
      <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-sm font-bold tabular-nums">{metric.value}{metric.unit}</span>
    </div>
  );
}
