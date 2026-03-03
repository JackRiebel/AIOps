import { useMemo, useCallback, useState } from 'react';
import type { AITraceDetail, AITraceSpan, WaterfallBar } from '@/types/ai-trace';
import { PLATFORM_COLORS } from '@/types/ai-trace';
import type {
  JourneyNode,
  JourneyEdge,
  LatencyEdgeData,
  AnomalyFlags,
  BaselineInfo,
  TEEnrichment,
  SpanCostImpact,
  JourneyCostSummary,
} from '@/types/journey-flow';

const COL_WIDTH = 280;
const ROW_HEIGHT = 110;
const DEFAULT_PLATFORM_COLOR = '#64748b';

function getPlatformColor(platform: string | null | undefined): string {
  if (!platform) return DEFAULT_PLATFORM_COLOR;
  return PLATFORM_COLORS[platform.toLowerCase()] || DEFAULT_PLATFORM_COLOR;
}

function getSpanAnomalies(span: AITraceSpan): AnomalyFlags | undefined {
  return span.anomalies as AnomalyFlags | undefined;
}

function getSpanBaseline(span: AITraceSpan): BaselineInfo | undefined {
  return span.baseline as BaselineInfo | undefined;
}

function getSpanTEEnrichment(span: AITraceSpan): TEEnrichment | undefined {
  const te = span.te_enrichment;
  if (!te) return undefined;
  return {
    path_hops: (te.path_hops || []).map((h) => ({
      ip: h.ip,
      prefix: h.prefix,
      delay: h.delay,
      loss: h.loss,
      network: h.network,
      rdns: h.rdns,
      asNumber: h.asNumber,
      location: h.location,
    })),
    network_metrics: te.network_metrics,
    bgp_routes: te.bgp_routes || [],
    http_timing: te.http_timing,
    test_id: te.test_id,
    test_type: te.test_type,
    agent_name: te.agent_name,
  };
}

function getSpanCostImpact(span: AITraceSpan): SpanCostImpact | undefined {
  const ci = span.cost_impact;
  if (!ci) return undefined;
  return {
    costUsd: ci.cost_usd,
    baselineLatencyMs: ci.baseline_latency_ms,
    actualLatencyMs: ci.actual_latency_ms,
    excessLatencyMs: ci.excess_latency_ms,
    wastedComputeUsd: ci.wasted_compute_usd,
  };
}

function getWaterfallBarForSpan(
  span: AITraceSpan,
  waterfall: WaterfallBar[],
): WaterfallBar | undefined {
  return waterfall.find((b) => b.span_id === span.id);
}

interface JourneyFlowResult {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  onToggleSegment: (nodeId: string) => void;
  costSummary: JourneyCostSummary | null;
}

export function useJourneyFlow(
  trace: AITraceDetail,
  waterfall: WaterfallBar[],
): JourneyFlowResult {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const onToggleSegment = useCallback((nodeId: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const costSummary: JourneyCostSummary | null = useMemo(() => {
    const cs = trace.cost_summary;
    if (!cs) return null;
    return {
      totalCostUsd: cs.total_cost_usd,
      totalNetworkTaxMs: cs.total_network_tax_ms,
      totalWastedUsd: cs.total_wasted_usd,
      networkTaxPct: cs.network_tax_pct,
    };
  }, [trace.cost_summary]);

  const { nodes, edges } = useMemo(() => {
    const allNodes: JourneyNode[] = [];
    const allEdges: JourneyEdge[] = [];
    const root = trace.root_span;
    if (!root) return { nodes: allNodes, edges: allEdges };

    // Use running X position instead of fixed colIndex * COL_WIDTH
    // so expanded network segments get more space without overlapping
    let currentX = 0;
    const centerY = 250;
    const GAP = 40; // gap between columns

    // --- User Query Node ---
    const userNodeId = 'user-query';
    allNodes.push({
      id: userNodeId,
      type: 'userQuery',
      position: { x: currentX, y: centerY },
      data: {
        label: 'User Query',
        query: root.span_name || 'Query',
        timestamp: root.start_time,
      },
    });
    currentX += COL_WIDTH;

    // Collect LLM calls and group by iteration
    const llmCalls = (root.children || []).filter((s) => s.span_type === 'llm_call');

    let prevNodeId = userNodeId;

    for (let llmIdx = 0; llmIdx < llmCalls.length; llmIdx++) {
      const llmSpan = llmCalls[llmIdx];
      const llmBar = getWaterfallBarForSpan(llmSpan, waterfall);
      const llmTE = getSpanTEEnrichment(llmSpan);

      // --- Network Segment Node (hops to AI) ---
      const teHops = llmTE?.path_hops || [];
      const hasHops = teHops.length > 0 || (llmSpan.network_path && llmSpan.network_path.length > 0);
      const hasNetTiming = llmBar?.network_timing && (llmBar.network_timing.tcp_ms || llmBar.network_timing.tls_ms);

      if (hasHops || hasNetTiming) {
        const segNodeId = `net-seg-${llmSpan.id}`;
        const hops = llmSpan.network_path || [];
        const hopCount = teHops.length || hops.length;
        const totalLat = teHops.length > 0
          ? teHops.reduce((sum, h) => sum + (h.delay || 0), 0)
          : hops.reduce((sum, h) => sum + (h.delay || 0), 0);
        const isExpanded = expandedSegments.has(segNodeId);

        const tcpMs = llmSpan.tcp_connect_ms || llmBar?.network_timing?.tcp_ms || null;
        const tlsMs = llmSpan.tls_ms || llmBar?.network_timing?.tls_ms || null;
        const ttfbMs = llmSpan.ttfb_ms || llmBar?.network_timing?.ttfb_ms || null;

        // Build a meaningful label
        let segLabel: string;
        if (hopCount > 0) {
          segLabel = `${hopCount} hops`;
        } else {
          const parts: string[] = [];
          if (tcpMs) parts.push(`TCP ${tcpMs}ms`);
          if (tlsMs) parts.push(`TLS ${tlsMs}ms`);
          if (ttfbMs) parts.push(`TTFB ${ttfbMs}ms`);
          segLabel = parts.length > 0 ? parts.join(' · ') : 'Network';
        }

        // Dynamic width: expanded nodes need more space
        const segWidth = isExpanded ? (hopCount > 0 ? 480 : 380) : COL_WIDTH;

        allNodes.push({
          id: segNodeId,
          type: 'networkSegment',
          position: { x: currentX, y: centerY },
          data: {
            label: segLabel,
            destination: llmSpan.server_ip || llmSpan.model || 'AI Provider',
            platform: llmSpan.provider,
            hops,
            totalLatency: totalLat || (tcpMs || 0) + (tlsMs || 0),
            isExpanded,
            hasAnomaly: !!(llmSpan.anomalies && (llmSpan.anomalies.tcpSlow || llmSpan.anomalies.tlsSlow)),
            teEnrichment: llmTE,
            tcpMs,
            tlsMs,
            ttfbMs,
            serverIp: llmSpan.server_ip || llmBar?.server_ip || null,
            tlsVersion: llmSpan.tls_version || llmBar?.tls_version || null,
            httpVersion: llmSpan.http_version || llmBar?.http_version || null,
          },
        });

        addEdge(allEdges, prevNodeId, segNodeId, llmBar?.network_timing?.tcp_ms || null, null, false, false);
        prevNodeId = segNodeId;
        currentX += segWidth + GAP;
      }

      // --- AI Provider Node ---
      const aiNodeId = `ai-provider-${llmSpan.id}`;
      allNodes.push({
        id: aiNodeId,
        type: 'aiProvider',
        position: { x: currentX, y: centerY },
        data: {
          label: llmSpan.model || llmSpan.provider || 'LLM',
          model: llmSpan.model,
          provider: llmSpan.provider,
          inputTokens: llmSpan.input_tokens || 0,
          outputTokens: llmSpan.output_tokens || 0,
          costUsd: llmSpan.cost_usd,
          ttfbMs: llmSpan.ttfb_ms || llmBar?.network_timing?.ttfb_ms || null,
          tcpMs: llmSpan.tcp_connect_ms || llmBar?.network_timing?.tcp_ms || null,
          tlsMs: llmSpan.tls_ms || llmBar?.network_timing?.tls_ms || null,
          serverIp: llmSpan.server_ip || llmBar?.server_ip || null,
          tlsVersion: llmSpan.tls_version || llmBar?.tls_version || null,
          httpVersion: llmSpan.http_version || llmBar?.http_version || null,
          iteration: llmSpan.iteration || llmIdx + 1,
          durationMs: llmSpan.duration_ms,
          status: llmSpan.status,
          anomalies: getSpanAnomalies(llmSpan),
          baseline: getSpanBaseline(llmSpan),
          teEnrichment: llmTE,
          costImpact: getSpanCostImpact(llmSpan),
        },
      });

      addEdge(allEdges, prevNodeId, aiNodeId, llmBar?.network_timing?.ttfb_ms || null, null, false, false);
      currentX += COL_WIDTH;

      // --- Tool Branch Nodes (fan out vertically) ---
      const toolSpans = (llmSpan.children || []).filter((s) => s.span_type === 'tool_execution');

      if (toolSpans.length > 0) {
        const toolColX = currentX;
        const endpointColX = currentX + COL_WIDTH;
        const midpoint = (toolSpans.length - 1) / 2;

        for (let tIdx = 0; tIdx < toolSpans.length; tIdx++) {
          const toolSpan = toolSpans[tIdx];
          const toolBar = getWaterfallBarForSpan(toolSpan, waterfall);
          const toolTE = getSpanTEEnrichment(toolSpan);
          const toolY = centerY + (tIdx - midpoint) * ROW_HEIGHT;
          const platform = toolSpan.tool_platform || toolBar?.tool_platform || null;
          const platformColor = getPlatformColor(platform);

          // Tool Branch Node
          const toolNodeId = `tool-${toolSpan.id}`;
          allNodes.push({
            id: toolNodeId,
            type: 'toolBranch',
            position: { x: toolColX, y: toolY },
            data: {
              label: toolSpan.tool_name || 'Tool',
              toolName: toolSpan.tool_name || 'Unknown Tool',
              platform,
              platformColor,
              durationMs: toolSpan.duration_ms,
              success: toolSpan.tool_success,
              tcpMs: toolSpan.tcp_connect_ms || toolBar?.network_timing?.tcp_ms || null,
              tlsMs: toolSpan.tls_ms || toolBar?.network_timing?.tls_ms || null,
              ttfbMs: toolSpan.ttfb_ms || toolBar?.network_timing?.ttfb_ms || null,
              serverIp: toolSpan.server_ip || toolBar?.server_ip || null,
              status: toolSpan.status,
              anomalies: getSpanAnomalies(toolSpan),
              baseline: getSpanBaseline(toolSpan),
              teEnrichment: toolTE,
              costImpact: getSpanCostImpact(toolSpan),
            },
          });

          addEdge(allEdges, aiNodeId, toolNodeId, null, platformColor, false, false);

          // Platform Endpoint Node (if we have server info)
          const hasServerInfo = toolSpan.server_ip || toolBar?.server_ip;
          if (hasServerInfo) {
            const endpointNodeId = `endpoint-${toolSpan.id}`;
            allNodes.push({
              id: endpointNodeId,
              type: 'platformEndpoint',
              position: { x: endpointColX, y: toolY },
              data: {
                label: platform || 'Endpoint',
                platform,
                platformColor,
                serverIp: toolSpan.server_ip || toolBar?.server_ip || null,
                serverPort: toolSpan.server_port || toolBar?.server_port || null,
                tlsVersion: toolSpan.tls_version || toolBar?.tls_version || null,
                httpVersion: toolSpan.http_version || toolBar?.http_version || null,
              },
            });

            addEdge(allEdges, toolNodeId, endpointNodeId, toolSpan.ttfb_ms || null, platformColor, false, false);
          }
        }

        currentX += COL_WIDTH * 2; // tool col + endpoint col
      }

      // Connect to next iteration's prevNodeId
      prevNodeId = aiNodeId;
    }

    // --- Synthesis Node ---
    const synthesisSpan = (root.children || []).find((s) => s.span_type === 'synthesis');
    if (synthesisSpan) {
      const synthNodeId = 'synthesis';
      allNodes.push({
        id: synthNodeId,
        type: 'synthesis',
        position: { x: currentX, y: centerY },
        data: {
          label: 'Synthesis',
          durationMs: synthesisSpan.duration_ms,
          tokens: (synthesisSpan.input_tokens || 0) + (synthesisSpan.output_tokens || 0),
          costUsd: synthesisSpan.cost_usd,
        },
      });

      addEdge(allEdges, prevNodeId, synthNodeId, null, null, false, false);
      prevNodeId = synthNodeId;
      currentX += COL_WIDTH;
    }

    // --- Response Node (always last) ---
    const responseNodeId = 'response';
    allNodes.push({
      id: responseNodeId,
      type: 'response',
      position: { x: currentX, y: centerY },
      data: {
        label: 'Response',
        totalDurationMs: root.duration_ms,
        totalCostUsd: trace.total_cost,
        totalTokens: trace.total_tokens,
        status: root.status,
        costSummary: costSummary || undefined,
      },
    });

    addEdge(allEdges, prevNodeId, responseNodeId, null, null, false, false);

    return { nodes: allNodes, edges: allEdges };
  }, [trace, waterfall, expandedSegments, costSummary]);

  return { nodes, edges, onToggleSegment, costSummary };
}

function addEdge(
  edges: JourneyEdge[],
  source: string,
  target: string,
  latencyMs: number | null,
  platformColor: string | null,
  animated: boolean,
  dashed: boolean,
): void {
  const data: LatencyEdgeData = { latencyMs, platformColor, animated, dashed };
  edges.push({
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'latency',
    data,
    animated,
  });
}
