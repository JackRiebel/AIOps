'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Brain, Cpu, Globe, Network, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { AIProviderNodeData } from '@/types/journey-flow';
import { HttpTimingBar } from './HttpTimingBar';
import { BGPBadge } from './BGPBadge';

const TIMING_COLORS = { tcp: '#f59e0b', tls: '#8b5cf6', ttfb: '#3b82f6' };

// Provider-specific accent colors and icons
const PROVIDER_CONFIG: Record<string, { color: string; icon: typeof Brain }> = {
  anthropic: { color: '#d4a574', icon: Brain },
  openai: { color: '#10b981', icon: Cpu },
  google: { color: '#4285f4', icon: Globe },
  cisco: { color: '#06b6d4', icon: Network },
};

function getProviderKey(provider?: string, model?: string): string {
  const p = (provider || model || '').toLowerCase();
  if (p.includes('anthropic') || p.includes('claude')) return 'anthropic';
  if (p.includes('openai') || p.includes('gpt')) return 'openai';
  if (p.includes('google') || p.includes('gemini')) return 'google';
  if (p.includes('cisco') || p.includes('circuit')) return 'cisco';
  return 'anthropic';
}

export const AIProviderNode = memo(({ data }: NodeProps<Node<AIProviderNodeData>>) => {
  const [expanded, setExpanded] = useState(false);
  const totalTokens = data.inputTokens + data.outputTokens;
  const inputPct = totalTokens > 0 ? (data.inputTokens / totalTokens) * 100 : 50;
  const hasAnomaly = data.anomalies && (data.anomalies.tcpSlow || data.anomalies.tlsSlow || data.anomalies.ttfbSlow || data.anomalies.durationSlow);
  const isError = data.status === 'error';

  const httpTiming = data.teEnrichment?.http_timing || null;
  const bgpRoutes = data.teEnrichment?.bgp_routes || [];
  const costImpact = data.costImpact;
  const hasWaste = costImpact && costImpact.wastedComputeUsd > 0;

  const providerKey = getProviderKey(data.provider ?? undefined, data.model ?? undefined);
  const config = PROVIDER_CONFIG[providerKey] || PROVIDER_CONFIG.anthropic;
  const ProviderIcon = config.icon;

  // Timing phases for mini-bar (fallback when no HTTP timing)
  const phases = [
    { key: 'tcp', ms: data.tcpMs, color: TIMING_COLORS.tcp },
    { key: 'tls', ms: data.tlsMs, color: TIMING_COLORS.tls },
    { key: 'ttfb', ms: data.ttfbMs, color: TIMING_COLORS.ttfb },
  ].filter((p) => p.ms != null && p.ms > 0);
  const timingTotal = phases.reduce((s, p) => s + (p.ms || 0), 0);

  const hasExpandableContent = httpTiming || bgpRoutes.length > 0 || hasAnomaly;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Bottom} id="tools" className="!w-2 !h-2 !bg-transparent !border-0" />

      <div className={`flex flex-col gap-1.5 rounded-xl border min-w-[200px] max-w-[240px] bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
        hasAnomaly ? 'border-l-4 border-l-red-500 border-t-slate-200/60 border-r-slate-200/60 border-b-slate-200/60 dark:border-t-slate-700/40 dark:border-r-slate-700/40 dark:border-b-slate-700/40' :
        isError ? 'border-red-300 dark:border-red-700' :
        'border-slate-200/60 dark:border-slate-700/40'
      }`}>
        {/* Provider accent bar */}
        {!hasAnomaly && (
          <div className="h-[2px]" style={{ backgroundColor: config.color }} />
        )}

        <div className="flex flex-col gap-1.5 p-3.5">
          {/* Header */}
          <div className="flex items-center gap-1.5">
            <ProviderIcon className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {data.model || data.provider || 'LLM'}
            </span>
            {data.iteration > 1 && (
              <span className="text-[8px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded">
                #{data.iteration}
              </span>
            )}
            {hasExpandableContent && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="ml-auto p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {expanded ? <ChevronDown className="w-2.5 h-2.5 text-slate-400" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-400" />}
              </button>
            )}
          </div>

          {/* Token bar */}
          {totalTokens > 0 && (
            <div>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${inputPct}%` }} title={`Input: ${data.inputTokens}`} />
                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${100 - inputPct}%` }} title={`Output: ${data.outputTokens}`} />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] text-blue-500">{data.inputTokens.toLocaleString()} in</span>
                <span className="text-[10px] text-purple-500">{data.outputTokens.toLocaleString()} out</span>
              </div>
            </div>
          )}

          {/* Cost with impact */}
          {data.costUsd != null && data.costUsd > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                ${data.costUsd.toFixed(4)}
              </span>
              {hasWaste && (
                <span className="text-[10px] font-mono text-red-500">
                  (+${costImpact.wastedComputeUsd.toFixed(4)} network tax)
                </span>
              )}
            </div>
          )}

          {/* HTTP Timing Waterfall (from TE data) or fallback mini-bar */}
          {httpTiming ? (
            <HttpTimingBar timing={httpTiming} compact />
          ) : timingTotal > 0 ? (
            <div>
              <div className="flex h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                {phases.map((p) => (
                  <div
                    key={p.key}
                    className="h-full"
                    style={{ width: `${Math.max((p.ms! / timingTotal) * 100, 5)}%`, backgroundColor: p.color }}
                    title={`${p.key.toUpperCase()}: ${p.ms}ms`}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-0.5">
                {phases.map((p) => (
                  <span key={p.key} className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.key.toUpperCase()} {p.ms}ms
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Duration + status */}
          {data.durationMs != null && (
            <span className="text-[10px] text-slate-500">{data.durationMs.toFixed(0)}ms total</span>
          )}

          {/* BGP badge */}
          {bgpRoutes.length > 0 && <BGPBadge routes={bgpRoutes} />}

          {/* Anomaly badge */}
          {hasAnomaly && (
            <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Anomaly detected
            </div>
          )}

          {/* Expanded sections */}
          {expanded && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-0.5 space-y-1.5">
              {/* Server info */}
              {data.serverIp && (
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {data.serverIp}
                  {data.tlsVersion && <span className="ml-1">{data.tlsVersion}</span>}
                  {data.httpVersion && <span className="ml-1">{data.httpVersion}</span>}
                </div>
              )}

              {/* TE agent + test ID */}
              {data.teEnrichment?.agent_name && (
                <div className="text-[10px] text-slate-400">
                  Agent: {data.teEnrichment.agent_name} · Test #{data.teEnrichment.test_id}
                </div>
              )}

              {/* Anomaly detail */}
              {hasAnomaly && costImpact && (
                <div className="text-[10px] space-y-0.5">
                  {costImpact.baselineLatencyMs != null && costImpact.actualLatencyMs != null && (
                    <div className="text-slate-600 dark:text-slate-400">
                      Current: {costImpact.actualLatencyMs.toFixed(0)}ms / Baseline: {costImpact.baselineLatencyMs.toFixed(0)}ms
                      <span className="text-red-500 ml-1">
                        (+{((costImpact.excessLatencyMs / costImpact.baselineLatencyMs) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}
                  {hasWaste && (
                    <div className="text-red-500">
                      Excess latency cost: ${costImpact.wastedComputeUsd.toFixed(4)}
                    </div>
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
AIProviderNode.displayName = 'AIProviderNode';
