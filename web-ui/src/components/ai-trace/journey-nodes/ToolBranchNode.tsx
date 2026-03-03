'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Globe, Server, Search, Eye } from 'lucide-react';
import type { ToolBranchNodeData } from '@/types/journey-flow';
import { InlinePathPreview } from './InlinePathPreview';
import { HttpTimingBar } from './HttpTimingBar';

const TIMING_COLORS = { tcp: '#f59e0b', tls: '#8b5cf6', ttfb: '#3b82f6' };

// Platform-specific icons
const PLATFORM_ICONS: Record<string, typeof Globe> = {
  meraki: Globe,
  catalyst: Server,
  splunk: Search,
  thousandeyes: Eye,
};

export const ToolBranchNode = memo(({ data }: NodeProps<Node<ToolBranchNodeData>>) => {
  const [expanded, setExpanded] = useState(false);
  const hasAnomaly = data.anomalies && (data.anomalies.tcpSlow || data.anomalies.tlsSlow || data.anomalies.ttfbSlow);
  const isError = data.status === 'error' || data.success === false;

  const teHops = data.teEnrichment?.path_hops || [];
  const httpTiming = data.teEnrichment?.http_timing || null;
  const networkMetrics = data.teEnrichment?.network_metrics || null;
  const hasTEData = teHops.length > 0 || httpTiming || networkMetrics;

  const platformKey = (data.platform || '').toLowerCase();
  const PlatformIcon = PLATFORM_ICONS[platformKey] || null;

  const phases = [
    { key: 'tcp', ms: data.tcpMs, color: TIMING_COLORS.tcp },
    { key: 'tls', ms: data.tlsMs, color: TIMING_COLORS.tls },
    { key: 'ttfb', ms: data.ttfbMs, color: TIMING_COLORS.ttfb },
  ].filter((p) => p.ms != null && p.ms > 0);
  const timingTotal = phases.reduce((s, p) => s + (p.ms || 0), 0);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-transparent !border-0" />

      <div className={`flex rounded-xl border overflow-hidden min-w-[200px] max-w-[240px] bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow ${
        hasAnomaly ? 'border-orange-400 dark:border-orange-600' :
        isError ? 'border-red-300 dark:border-red-700' :
        'border-slate-200/60 dark:border-slate-700/40'
      }`}>
        {/* Platform color stripe */}
        <div className="w-1 shrink-0" style={{ backgroundColor: data.platformColor }} />

        <div className="flex flex-col gap-1 p-3 flex-1 min-w-0">
          {/* Tool name + status */}
          <div className="flex items-center gap-1.5">
            {data.success === true ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            ) : data.success === false ? (
              <XCircle className="w-3 h-3 text-red-500 shrink-0" />
            ) : null}
            {PlatformIcon && (
              <PlatformIcon className="w-3 h-3 shrink-0" style={{ color: data.platformColor }} />
            )}
            <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
              {data.toolName}
            </span>
            {hasTEData && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="ml-auto p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {expanded ? <ChevronDown className="w-2.5 h-2.5 text-slate-400" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-400" />}
              </button>
            )}
          </div>

          {/* Duration + inline path preview */}
          <div className="flex items-center gap-2">
            {data.durationMs != null && (
              <span className="text-[10px] font-mono text-slate-500">
                {data.durationMs.toFixed(0)}ms
              </span>
            )}
            {teHops.length > 0 && <InlinePathPreview hops={teHops} width={50} />}
          </div>

          {/* HTTP Timing (from TE data) or fallback mini-bar */}
          {httpTiming ? (
            <HttpTimingBar timing={httpTiming} compact />
          ) : timingTotal > 0 ? (
            <div>
              <div className="flex h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                {phases.map((p) => (
                  <div
                    key={p.key}
                    className="h-full"
                    style={{ width: `${Math.max((p.ms! / timingTotal) * 100, 8)}%`, backgroundColor: p.color }}
                    title={`${p.key.toUpperCase()}: ${p.ms}ms`}
                  />
                ))}
              </div>
              <div className="flex gap-1.5 mt-0.5">
                {phases.map((p) => (
                  <span key={p.key} className="text-[10px] text-slate-400">
                    {p.key.toUpperCase()} {p.ms}ms
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Anomaly badge */}
          {hasAnomaly && (
            <div className="flex items-center gap-0.5 text-[10px] text-orange-500 font-medium">
              <AlertTriangle className="w-2.5 h-2.5" />
              Slow
            </div>
          )}

          {/* Expanded detail */}
          {expanded && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-0.5 space-y-1">
              {/* Network metrics */}
              {networkMetrics && (
                <div className="flex gap-2 text-[10px] text-slate-500">
                  <span>Latency: <span className="font-mono">{networkMetrics.latency.toFixed(0)}ms</span></span>
                  <span>Loss: <span className="font-mono">{networkMetrics.loss.toFixed(1)}%</span></span>
                  <span>Jitter: <span className="font-mono">{networkMetrics.jitter.toFixed(0)}ms</span></span>
                </div>
              )}

              {/* Server IP */}
              {data.serverIp && (
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {data.serverIp}
                </div>
              )}

              {/* Anomaly baseline comparison */}
              {hasAnomaly && data.baseline?.isValid && (
                <div className="text-[10px] text-slate-500">
                  {data.ttfbMs != null && data.baseline.ttfbMs != null && (
                    <span>
                      TTFB: {data.ttfbMs.toFixed(0)}ms / baseline {data.baseline.ttfbMs.toFixed(0)}ms
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
ToolBranchNode.displayName = 'ToolBranchNode';
