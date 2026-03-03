'use client';

/**
 * TELatencyChartViz
 *
 * Wraps the LatencyWaterfallChart component for inline chat card display.
 * Converts raw hop data to TopologyNode format if needed.
 */

import { memo, useMemo } from 'react';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import {
  TopologyNode,
  PathHop,
  classifyZone,
} from '@/components/thousandeyes/types';

interface TELatencyChartVizProps {
  data: Record<string, unknown>;
}

export const TELatencyChartViz = memo(({ data }: TELatencyChartVizProps) => {
  const { nodes, summary } = useMemo(() => {
    let resolvedNodes: TopologyNode[] = [];

    // If data already has TopologyNode[] nodes
    if (Array.isArray(data.nodes)) {
      resolvedNodes = data.nodes as TopologyNode[];
    }
    // Fallback: convert from PathHop[] format
    else if (Array.isArray(data.hops)) {
      const hops = data.hops as PathHop[];
      const totalHops = hops.length;
      resolvedNodes = hops.map((hop, i) => ({
        id: `hop-${hop.hopNumber ?? i}`,
        label: hop.hostname || hop.ipAddress,
        ip: hop.ipAddress,
        zone: classifyZone(hop, i, totalHops),
        latency: hop.latency,
        loss: hop.loss,
        network: hop.network,
        hopNumber: hop.hopNumber ?? i + 1,
        prefix: hop.prefix,
      }));
    }
    // Fallback: flat metrics object from AI (e.g., { latency: 45, loss: 0.5, target: 'host' })
    else if (typeof data.latency === 'number' || typeof data.avgLatency === 'number') {
      const latency = (data.latency ?? data.avgLatency) as number;
      resolvedNodes = [{
        id: 'metric-0',
        label: String(data.target || data.server || 'Target'),
        ip: String(data.ip || data.server || ''),
        zone: 'destination' as const,
        latency,
        loss: typeof data.loss === 'number' ? data.loss : 0,
        hopNumber: 1,
      }];
    }

    // Compute summary
    const totalLatency = resolvedNodes.reduce((sum, n) => sum + n.latency, 0);
    const bottleneck = resolvedNodes.length > 0
      ? resolvedNodes.reduce((max, n) => n.latency > max.latency ? n : max, resolvedNodes[0])
      : null;

    return {
      nodes: resolvedNodes,
      summary: {
        totalLatency,
        bottleneckName: bottleneck?.label ?? bottleneck?.ip,
        bottleneckLatency: bottleneck?.latency ?? 0,
      },
    };
  }, [data]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
        No latency data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-1 p-2">
      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 px-1">
        <span>Total: <strong className="text-slate-800 dark:text-slate-200">{summary.totalLatency.toFixed(0)}ms</strong></span>
        {summary.bottleneckName && (
          <span>Bottleneck: <strong className="text-red-600 dark:text-red-400">{summary.bottleneckName}</strong> ({summary.bottleneckLatency.toFixed(0)}ms)</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <LatencyWaterfallChart nodes={nodes} />
      </div>
    </div>
  );
});

TELatencyChartViz.displayName = 'TELatencyChartViz';
