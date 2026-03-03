'use client';

import { memo } from 'react';
import { X, Brain, Wrench, Network, Server, MessageSquare, Sparkles, CheckCircle2, AlertTriangle, Lock, Shield } from 'lucide-react';
import type { JourneyNode, TEPathHop, TEEnrichment, SpanCostImpact, TEBGPRoute, AnomalyFlags, BaselineInfo } from '@/types/journey-flow';
import { HttpTimingBar } from './journey-nodes/HttpTimingBar';
import { BGPBadge } from './journey-nodes/BGPBadge';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import { hopsToTopology, classifyZone, extractAsNumber, ZONE_CONFIG } from './pathUtils';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return '';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function SecurityBadge({ label, secure }: { label: string; secure: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${
      secure
        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
    }`}>
      {secure ? <Lock className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

function AnomalyRow({ label, actual, baseline }: { label: string; actual: number | null | undefined; baseline: number | null | undefined }) {
  if (actual == null || baseline == null || baseline <= 0) return null;
  const excessPct = ((actual - baseline) / baseline * 100).toFixed(0);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-[10px]">
      <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
      <span className="text-red-700 dark:text-red-400 font-medium">{label}</span>
      <span className="ml-auto text-slate-600 dark:text-slate-400 font-mono">
        {actual.toFixed(0)}ms <span className="text-gray-400">vs</span> {baseline.toFixed(0)}ms
      </span>
      <span className="text-red-500 font-mono font-medium">+{excessPct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer Props & Component
// ---------------------------------------------------------------------------

interface JourneyDetailDrawerProps {
  selectedNode: JourneyNode | null;
  onClose: () => void;
}

const HEADER_ICONS: Record<string, React.ReactNode> = {
  userQuery: <MessageSquare className="w-4 h-4 text-gray-500" />,
  aiProvider: <Brain className="w-4 h-4 text-blue-500" />,
  toolBranch: <Wrench className="w-4 h-4 text-emerald-500" />,
  networkSegment: <Network className="w-4 h-4 text-purple-500" />,
  platformEndpoint: <Server className="w-4 h-4 text-cyan-500" />,
  synthesis: <Sparkles className="w-4 h-4 text-purple-500" />,
  response: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
};

export const JourneyDetailDrawer = memo(({ selectedNode, onClose }: JourneyDetailDrawerProps) => {
  if (!selectedNode) return null;

  const nodeType = selectedNode.type;
  const nodeData = selectedNode.data;

  return (
    <div
      className="absolute top-0 right-0 h-full w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200/60 dark:border-slate-700/40 shadow-xl z-50 flex flex-col overflow-hidden"
      style={{ animation: 'slideInRight 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/80">
        {HEADER_ICONS[nodeType || ''] || null}
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate flex-1">
          {nodeData.label}
        </span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {nodeType === 'userQuery' && <UserQueryDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'aiProvider' && <AIProviderDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'toolBranch' && <ToolBranchDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'networkSegment' && <NetworkSegmentDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'platformEndpoint' && <PlatformEndpointDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'synthesis' && <SynthesisDetail data={nodeData as Record<string, unknown>} />}
        {nodeType === 'response' && <ResponseDetail data={nodeData as Record<string, unknown>} />}
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
});
JourneyDetailDrawer.displayName = 'JourneyDetailDrawer';

// ===========================================================================
// 1. UserQueryDetail (NEW)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UserQueryDetail({ data }: { data: any }) {
  const relative = formatRelative(data.timestamp);

  return (
    <>
      <Section title="Query">
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/60 dark:border-slate-700/40 p-3 max-h-[300px] overflow-y-auto">
          <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
            {data.query || '—'}
          </p>
        </div>
      </Section>
      {data.timestamp && (
        <Section title="Timestamp">
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <Row label="Time" value={new Date(data.timestamp).toLocaleString()} />
            {relative && <Row label="Relative" value={relative} />}
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 2. AIProviderDetail (ENHANCED)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIProviderDetail({ data }: { data: any }) {
  const te: TEEnrichment | undefined = data.teEnrichment;
  const cost: SpanCostImpact | undefined = data.costImpact;
  const anomalies: AnomalyFlags | undefined = data.anomalies;
  const baseline: BaselineInfo | undefined = data.baseline;

  return (
    <>
      {/* Model info */}
      <Section title="Model">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Model" value={data.model} />
          <Row label="Provider" value={data.provider} />
          <Row label="Iteration" value={data.iteration} />
          <Row label="Duration" value={data.durationMs ? `${data.durationMs.toFixed(0)}ms` : null} />
          <Row label="Status" value={data.status} />
        </div>
      </Section>

      {/* Tokens + Cost */}
      <Section title="Tokens & Cost">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Input tokens" value={data.inputTokens?.toLocaleString()} />
          <Row label="Output tokens" value={data.outputTokens?.toLocaleString()} />
          <Row label="Cost" value={data.costUsd ? `$${data.costUsd.toFixed(4)}` : null} />
          {cost && cost.wastedComputeUsd > 0 && (
            <Row label="Network tax" value={`$${cost.wastedComputeUsd.toFixed(4)}`} valueClass="text-red-500" />
          )}
        </div>
      </Section>

      {/* HTTP Timing */}
      {te?.http_timing && (
        <Section title="HTTP Timing Waterfall">
          <HttpTimingBar timing={te.http_timing} />
          <div className="mt-2 text-[10px] text-gray-500 font-mono">
            Total: {te.http_timing.responseTime.toFixed(0)}ms · Wire: {(te.http_timing.wireSize / 1024).toFixed(1)}KB
          </div>
        </Section>
      )}

      {/* Network info */}
      <Section title="Network">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Server IP" value={data.serverIp} mono />
          <Row label="TLS" value={data.tlsVersion} />
          <Row label="HTTP" value={data.httpVersion} />
          {te?.agent_name && <Row label="TE Agent" value={te.agent_name} />}
          {te?.test_id && <Row label="Test ID" value={`#${te.test_id}`} />}
        </div>
      </Section>

      {/* BGP */}
      {te && te.bgp_routes.length > 0 && (
        <Section title="BGP Routes">
          <BGPBadge routes={te.bgp_routes} />
          <BGPRouteTable routes={te.bgp_routes} />
        </Section>
      )}

      {/* Anomalies Detected */}
      {anomalies && (anomalies.tcpSlow || anomalies.tlsSlow || anomalies.ttfbSlow || anomalies.durationSlow) && (
        <Section title="Anomalies Detected">
          <div className="space-y-1.5">
            {anomalies.tcpSlow && <AnomalyRow label="TCP" actual={data.tcpMs} baseline={baseline?.tcpMs} />}
            {anomalies.tlsSlow && <AnomalyRow label="TLS" actual={data.tlsMs} baseline={baseline?.tlsMs} />}
            {anomalies.ttfbSlow && <AnomalyRow label="TTFB" actual={data.ttfbMs} baseline={baseline?.ttfbMs} />}
            {anomalies.durationSlow && <AnomalyRow label="Duration" actual={data.durationMs} baseline={baseline?.durationMs} />}
          </div>
        </Section>
      )}

      {/* Performance Baseline */}
      {baseline?.isValid && (
        <Section title="Performance Baseline">
          <div className="grid grid-cols-2 gap-2">
            {baseline.tcpMs != null && <StatCard label="TCP Baseline" value={`${baseline.tcpMs.toFixed(0)}ms`} />}
            {baseline.tlsMs != null && <StatCard label="TLS Baseline" value={`${baseline.tlsMs.toFixed(0)}ms`} />}
            {baseline.ttfbMs != null && <StatCard label="TTFB Baseline" value={`${baseline.ttfbMs.toFixed(0)}ms`} />}
            {baseline.durationMs != null && <StatCard label="Duration Baseline" value={`${baseline.durationMs.toFixed(0)}ms`} />}
          </div>
        </Section>
      )}

      {/* Network Metrics */}
      {te?.network_metrics && (
        <Section title="Network Metrics">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Latency" value={`${te.network_metrics.latency.toFixed(0)}ms`} />
            <StatCard label="Loss" value={`${te.network_metrics.loss.toFixed(1)}%`} valueClass={te.network_metrics.loss > 1 ? 'text-red-500' : undefined} />
            <StatCard label="Jitter" value={`${te.network_metrics.jitter.toFixed(0)}ms`} />
          </div>
        </Section>
      )}

      {/* Network Path */}
      {te && te.path_hops.length > 0 && (
        <NetworkPathSection hops={te.path_hops} />
      )}

      {/* Cost breakdown */}
      {cost && (
        <Section title="Cost Impact">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total Cost" value={`$${cost.costUsd.toFixed(4)}`} />
            <StatCard label="Baseline Latency" value={cost.baselineLatencyMs ? `${cost.baselineLatencyMs.toFixed(0)}ms` : 'N/A'} />
            <StatCard label="Actual Latency" value={cost.actualLatencyMs ? `${cost.actualLatencyMs.toFixed(0)}ms` : 'N/A'} />
            <StatCard
              label="Wasted"
              value={`$${cost.wastedComputeUsd.toFixed(4)}`}
              valueClass={cost.wastedComputeUsd > 0 ? 'text-red-500' : undefined}
            />
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 3. ToolBranchDetail (ENHANCED)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolBranchDetail({ data }: { data: any }) {
  const te: TEEnrichment | undefined = data.teEnrichment;
  const cost: SpanCostImpact | undefined = data.costImpact;
  const anomalies: AnomalyFlags | undefined = data.anomalies;
  const baseline: BaselineInfo | undefined = data.baseline;

  return (
    <>
      <Section title="Tool">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Tool" value={data.toolName} />
          <Row label="Platform" value={data.platform} />
          <Row label="Duration" value={data.durationMs ? `${data.durationMs.toFixed(0)}ms` : null} />
          <Row label="Status" value={data.success === true ? 'Success' : data.success === false ? 'Failed' : 'Unknown'} />
        </div>
      </Section>

      {te?.http_timing && (
        <Section title="HTTP Timing Waterfall">
          <HttpTimingBar timing={te.http_timing} />
        </Section>
      )}

      {te?.network_metrics && (
        <Section title="Network Metrics">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Latency" value={`${te.network_metrics.latency.toFixed(0)}ms`} />
            <StatCard label="Loss" value={`${te.network_metrics.loss.toFixed(1)}%`} valueClass={te.network_metrics.loss > 1 ? 'text-red-500' : undefined} />
            <StatCard label="Jitter" value={`${te.network_metrics.jitter.toFixed(0)}ms`} />
          </div>
        </Section>
      )}

      <Section title="Network">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Server IP" value={data.serverIp} mono />
        </div>
      </Section>

      {te && te.path_hops.length > 0 && (
        <NetworkPathSection hops={te.path_hops} />
      )}

      {/* Cost Impact */}
      {cost && (
        <Section title="Cost Impact">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Cost" value={`$${cost.costUsd.toFixed(4)}`} />
            <StatCard label="Wasted" value={`$${cost.wastedComputeUsd.toFixed(4)}`} valueClass={cost.wastedComputeUsd > 0 ? 'text-red-500' : undefined} />
            <StatCard label="Baseline Latency" value={cost.baselineLatencyMs ? `${cost.baselineLatencyMs.toFixed(0)}ms` : 'N/A'} />
            <StatCard label="Actual Latency" value={cost.actualLatencyMs ? `${cost.actualLatencyMs.toFixed(0)}ms` : 'N/A'} />
          </div>
        </Section>
      )}

      {/* BGP Routes */}
      {te && te.bgp_routes.length > 0 && (
        <Section title="BGP Routes">
          <BGPBadge routes={te.bgp_routes} />
          <BGPRouteTable routes={te.bgp_routes} />
        </Section>
      )}

      {/* Performance Baseline */}
      {baseline?.isValid && (
        <Section title="Performance Baseline">
          <div className="grid grid-cols-2 gap-2">
            {baseline.tcpMs != null && <StatCard label="TCP Baseline" value={`${baseline.tcpMs.toFixed(0)}ms`} />}
            {baseline.tlsMs != null && <StatCard label="TLS Baseline" value={`${baseline.tlsMs.toFixed(0)}ms`} />}
            {baseline.ttfbMs != null && <StatCard label="TTFB Baseline" value={`${baseline.ttfbMs.toFixed(0)}ms`} />}
          </div>
        </Section>
      )}

      {/* Anomalies Detected */}
      {anomalies && (anomalies.tcpSlow || anomalies.tlsSlow || anomalies.ttfbSlow) && (
        <Section title="Anomalies Detected">
          <div className="space-y-1.5">
            {anomalies.tcpSlow && <AnomalyRow label="TCP" actual={data.tcpMs} baseline={baseline?.tcpMs} />}
            {anomalies.tlsSlow && <AnomalyRow label="TLS" actual={data.tlsMs} baseline={baseline?.tlsMs} />}
            {anomalies.ttfbSlow && <AnomalyRow label="TTFB" actual={data.ttfbMs} baseline={baseline?.ttfbMs} />}
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 4. NetworkSegmentDetail (ENHANCED)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NetworkSegmentDetail({ data }: { data: any }) {
  const te: TEEnrichment | undefined = data.teEnrichment;
  const hops: TEPathHop[] = te?.path_hops || (data.hops || []).map((h: { ip: string; prefix?: string; delay: number; loss?: number; network?: string; rdns?: string }) => ({
    ip: h.ip, prefix: h.prefix || '', delay: h.delay, loss: h.loss || 0, network: h.network || '', rdns: h.rdns || '',
  }));

  const hasTiming = !!(data.tcpMs || data.tlsMs || data.ttfbMs);

  return (
    <>
      <Section title="Path Summary">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Destination" value={data.destination} mono />
          <Row label="Platform" value={data.platform} />
          {hops.length > 0 && <Row label="Hops" value={`${hops.length}`} />}
          <Row label="Total Latency" value={`${data.totalLatency?.toFixed(0) || 0}ms`} />
          <Row label="Server IP" value={data.serverIp} mono />
          <Row label="TLS" value={data.tlsVersion} />
          <Row label="HTTP" value={data.httpVersion} />
        </div>
      </Section>

      {/* Connection Timing Phases (when no hops) */}
      {hops.length === 0 && hasTiming && (
        <Section title="Connection Timing">
          <div className="grid grid-cols-2 gap-2">
            {data.tcpMs != null && <StatCard label="TCP Handshake" value={`${data.tcpMs}ms`} />}
            {data.tlsMs != null && <StatCard label="TLS Negotiation" value={`${data.tlsMs}ms`} />}
            {data.ttfbMs != null && <StatCard label="TTFB (Server Wait)" value={`${data.ttfbMs}ms`} />}
            <StatCard label="Total" value={`${((data.tcpMs || 0) + (data.tlsMs || 0) + (data.ttfbMs || 0)).toFixed(0)}ms`} />
          </div>
          {/* Timing bar */}
          <div className="mt-3">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
              {data.tcpMs != null && data.tcpMs > 0 && (
                <div className="h-full bg-amber-500" style={{ flex: data.tcpMs }} title={`TCP: ${data.tcpMs}ms`} />
              )}
              {data.tlsMs != null && data.tlsMs > 0 && (
                <div className="h-full bg-purple-500" style={{ flex: data.tlsMs }} title={`TLS: ${data.tlsMs}ms`} />
              )}
              {data.ttfbMs != null && data.ttfbMs > 0 && (
                <div className="h-full bg-blue-500" style={{ flex: data.ttfbMs }} title={`TTFB: ${data.ttfbMs}ms`} />
              )}
            </div>
            <div className="flex gap-3 mt-1.5">
              {data.tcpMs != null && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  TCP {data.tcpMs}ms
                </span>
              )}
              {data.tlsMs != null && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  TLS {data.tlsMs}ms
                </span>
              )}
              {data.ttfbMs != null && (
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  TTFB {data.ttfbMs}ms
                </span>
              )}
            </div>
          </div>
        </Section>
      )}

      {hops.length > 0 && (
        <NetworkPathSection hops={hops} />
      )}

      {te && te.bgp_routes.length > 0 && (
        <Section title="BGP Routes">
          <BGPBadge routes={te.bgp_routes} />
          <BGPRouteTable routes={te.bgp_routes} />
        </Section>
      )}

      {/* Network Metrics */}
      {te?.network_metrics && (
        <Section title="Network Metrics">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Latency" value={`${te.network_metrics.latency.toFixed(0)}ms`} />
            <StatCard label="Loss" value={`${te.network_metrics.loss.toFixed(1)}%`} valueClass={te.network_metrics.loss > 1 ? 'text-red-500' : undefined} />
            <StatCard label="Jitter" value={`${te.network_metrics.jitter.toFixed(0)}ms`} />
          </div>
        </Section>
      )}

      {/* HTTP Timing */}
      {te?.http_timing && (
        <Section title="HTTP Timing">
          <HttpTimingBar timing={te.http_timing} />
        </Section>
      )}

      {/* ThousandEyes Agent */}
      {te?.agent_name && (
        <Section title="ThousandEyes Agent">
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <Row label="Agent" value={te.agent_name} />
            {te.test_id && <Row label="Test ID" value={`#${te.test_id}`} />}
            {te.test_type && <Row label="Test Type" value={te.test_type} />}
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 5. PlatformEndpointDetail (NEW)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlatformEndpointDetail({ data }: { data: any }) {
  const tlsSecure = data.tlsVersion && (data.tlsVersion.includes('1.3') || data.tlsVersion.includes('1.2'));
  const httpModern = data.httpVersion && (data.httpVersion.includes('2') || data.httpVersion.includes('3'));

  return (
    <>
      <Section title="Endpoint">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <Row label="Platform" value={data.platform} />
          <Row label="Server IP" value={data.serverIp} mono />
          <Row label="Port" value={data.serverPort} mono />
          <Row label="TLS Version" value={data.tlsVersion} />
          <Row label="HTTP Version" value={data.httpVersion} />
        </div>
      </Section>

      {(data.tlsVersion || data.httpVersion) && (
        <Section title="Security">
          <div className="flex flex-wrap gap-2">
            {data.tlsVersion && (
              <SecurityBadge label={data.tlsVersion} secure={!!tlsSecure} />
            )}
            {data.httpVersion && (
              <SecurityBadge label={data.httpVersion} secure={!!httpModern} />
            )}
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 6. SynthesisDetail (NEW)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SynthesisDetail({ data }: { data: any }) {
  const tokens = data.tokens || 0;
  const durationMs = data.durationMs || 0;
  const costUsd = data.costUsd || 0;

  // Token utilization: estimate as percentage of a typical context (128K)
  const maxTokens = 128000;
  const tokenUsagePct = Math.min((tokens / maxTokens) * 100, 100);
  const tokensPerSec = durationMs > 0 ? (tokens / (durationMs / 1000)) : 0;
  const costPer1k = tokens > 0 ? (costUsd / tokens * 1000) : 0;

  return (
    <>
      <Section title="Synthesis Metrics">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Duration" value={durationMs > 0 ? `${durationMs.toFixed(0)}ms` : '—'} />
          <StatCard label="Tokens" value={tokens > 0 ? tokens.toLocaleString() : '—'} />
          <StatCard label="Cost" value={costUsd > 0 ? `$${costUsd.toFixed(4)}` : '—'} />
          <StatCard label="Token Usage" value={`${tokenUsagePct.toFixed(1)}%`} />
        </div>
      </Section>

      {/* Token utilization bar */}
      {tokens > 0 && (
        <Section title="Token Utilization">
          <div className="h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${Math.max(tokenUsagePct, 1)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-mono">
            <span>{tokens.toLocaleString()} tokens</span>
            <span>{tokenUsagePct.toFixed(1)}% of 128K</span>
          </div>
        </Section>
      )}

      {/* Efficiency */}
      {(tokensPerSec > 0 || costPer1k > 0) && (
        <Section title="Efficiency">
          <div className="grid grid-cols-2 gap-2">
            {tokensPerSec > 0 && <StatCard label="Tokens/sec" value={tokensPerSec.toFixed(0)} />}
            {costPer1k > 0 && <StatCard label="Cost per 1K tokens" value={`$${costPer1k.toFixed(4)}`} />}
          </div>
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// 7. ResponseDetail (NEW)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResponseDetail({ data }: { data: any }) {
  const isSuccess = data.status === 'success';
  const cs = data.costSummary;
  const totalTokens = data.totalTokens || 0;
  const totalDurationMs = data.totalDurationMs || 0;
  const totalCostUsd = data.totalCostUsd || 0;

  const tokensPerSec = totalDurationMs > 0 ? (totalTokens / (totalDurationMs / 1000)) : 0;
  const costPer1k = totalTokens > 0 ? (totalCostUsd / totalTokens * 1000) : 0;

  return (
    <>
      {/* Status banner */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold ${
        isSuccess
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400'
      }`}>
        {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {isSuccess ? 'Response Complete' : 'Response Error'}
      </div>

      {/* Core metrics */}
      <Section title="Summary">
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Duration" value={totalDurationMs > 0 ? `${(totalDurationMs / 1000).toFixed(2)}s` : '—'} />
          <StatCard label="Total Cost" value={totalCostUsd > 0 ? `$${totalCostUsd.toFixed(4)}` : '—'} />
          <StatCard label="Total Tokens" value={totalTokens > 0 ? totalTokens.toLocaleString() : '—'} />
          <StatCard label="Status" value={isSuccess ? 'Success' : 'Error'} valueClass={isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'} />
        </div>
      </Section>

      {/* Cost Analysis */}
      {cs && (
        <Section title="Cost Analysis">
          <div className="grid grid-cols-2 gap-2">
            {cs.networkTaxPct > 0 && <StatCard label="Network Tax %" value={`${cs.networkTaxPct.toFixed(1)}%`} />}
            {cs.totalNetworkTaxMs > 0 && <StatCard label="Network Tax" value={`${cs.totalNetworkTaxMs.toFixed(0)}ms`} />}
            {cs.totalWastedUsd > 0 && (
              <StatCard label="Wasted" value={`$${cs.totalWastedUsd.toFixed(4)}`} valueClass="text-red-500" />
            )}
            {cs.totalWastedUsd > 0 && cs.totalCostUsd > 0 && (
              <StatCard label="Waste %" value={`${((cs.totalWastedUsd / cs.totalCostUsd) * 100).toFixed(1)}%`} valueClass="text-red-500" />
            )}
          </div>
        </Section>
      )}

      {/* Throughput */}
      {(tokensPerSec > 0 || costPer1k > 0) && (
        <Section title="Throughput">
          <div className="grid grid-cols-2 gap-2">
            {tokensPerSec > 0 && <StatCard label="Tokens/sec" value={tokensPerSec.toFixed(0)} />}
            {costPer1k > 0 && <StatCard label="Cost per 1K tokens" value={`$${costPer1k.toFixed(4)}`} />}
          </div>
        </Section>
      )}

      {/* User Impact */}
      {data.userImpact && (
        <Section title="User Impact">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Wait Time (p50)" value={`${data.userImpact.p50WaitMs.toFixed(0)}ms`} />
            <StatCard label="Wait Time (p95)" value={`${data.userImpact.p95WaitMs.toFixed(0)}ms`} valueClass={data.userImpact.p95WaitMs > 10000 ? 'text-red-500' : undefined} />
            <StatCard label="Timeout Risk" value={`${data.userImpact.timeoutProbability.toFixed(1)}%`} valueClass={data.userImpact.timeoutProbability > 5 ? 'text-red-500' : undefined} />
            <StatCard label="Added Wait" value={`+${data.userImpact.addedWaitMs.toFixed(0)}ms`} valueClass={data.userImpact.addedWaitMs > 2000 ? 'text-amber-500' : undefined} />
          </div>
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared Network Path section using real TE components
// ---------------------------------------------------------------------------

function NetworkPathSection({ hops }: { hops: TEPathHop[] }) {
  const { nodes, links } = hopsToTopology(hops);

  return (
    <>
      <Section title="Network Path">
        <NetworkPathFlow nodes={nodes} links={links} />
      </Section>

      {nodes.length > 0 && (
        <Section title="Per-Hop Latency">
          <LatencyWaterfallChart nodes={nodes} />
        </Section>
      )}

      <Section title="Hop Detail">
        <HopTable hops={hops} />
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono, valueClass }: { label: string; value: string | number | null | undefined; mono?: boolean; valueClass?: string }) {
  if (value == null) return null;
  return (
    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${valueClass || 'text-slate-800 dark:text-slate-200'}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/40 p-2.5 bg-slate-50 dark:bg-slate-800/80">
      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-xs font-mono font-semibold mt-0.5 ${valueClass || 'text-slate-800 dark:text-slate-100'}`}>{value}</div>
    </div>
  );
}

function HopTable({ hops }: { hops: TEPathHop[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr className="text-gray-400 text-left">
            <th className="pr-2 pb-1">#</th>
            <th className="pr-2 pb-1">IP / Host</th>
            <th className="pr-2 pb-1">AS#</th>
            <th className="pr-2 pb-1">Zone</th>
            <th className="pr-2 pb-1 text-right">Latency</th>
            <th className="pb-1 text-right">Loss</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((hop, i) => {
            const zone = classifyZone(hop, i, hops.length);
            const zoneCfg = ZONE_CONFIG[zone];
            const asn = extractAsNumber(hop.network);
            const latColor = hop.delay > 100 ? 'text-red-500' : hop.delay > 50 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400';
            return (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50">
                <td className="pr-2 py-0.5 text-gray-400">{i + 1}</td>
                <td className="pr-2 py-0.5 font-mono text-slate-700 dark:text-slate-300 max-w-[120px] truncate" title={`${hop.rdns || ''} (${hop.ip})`}>
                  {hop.rdns || hop.ip}
                </td>
                <td className="pr-2 py-0.5 text-cyan-600 dark:text-cyan-400">{asn || '—'}</td>
                <td className="pr-2 py-0.5">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneCfg?.dotColorHex || '#94a3b8' }} />
                    {zoneCfg?.label || zone}
                  </span>
                </td>
                <td className={`pr-2 py-0.5 text-right font-mono ${latColor}`}>{hop.delay.toFixed(1)}ms</td>
                <td className={`py-0.5 text-right font-mono ${hop.loss > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {hop.loss > 0 ? `${hop.loss}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BGPRouteTable({ routes }: { routes: TEBGPRoute[] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr className="text-gray-400 text-left">
            <th className="pr-2 pb-1">Prefix</th>
            <th className="pr-2 pb-1">AS Path</th>
            <th className="pr-2 pb-1 text-right">Reach.</th>
            <th className="pb-1 text-right">Updates</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50">
              <td className="pr-2 py-0.5 font-mono text-slate-700 dark:text-slate-300">{route.prefix}</td>
              <td className="pr-2 py-0.5 text-gray-500 font-mono truncate max-w-[100px]" title={route.asPath.join(' → ')}>
                {route.asPath.join(' → ')}
              </td>
              <td className={`pr-2 py-0.5 text-right font-mono ${route.reachability < 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {route.reachability}%
              </td>
              <td className={`py-0.5 text-right font-mono ${route.updates > 10 ? 'text-amber-500' : 'text-gray-500'}`}>
                {route.updates}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
