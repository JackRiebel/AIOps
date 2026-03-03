'use client';

/**
 * TEPathVisualizationViz
 *
 * Enhanced path visualization with stat row, zone legend,
 * full NetworkPathFlow diagram, and scrollable hop table.
 */

import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import {
  TopologyNode,
  TopologyLink,
  PathHop,
  classifyZone,
  getLinkHealth,
  latencyColor,
  ZONE_CONFIG,
  ZONE_ORDER,
} from '@/components/thousandeyes/types';

interface TEPathVisualizationVizProps {
  data: Record<string, unknown>;
}

export const TEPathVisualizationViz = memo(({ data }: TEPathVisualizationVizProps) => {
  const [tableExpanded, setTableExpanded] = useState(false);

  const { nodes, links, source, destination, totalLatency, maxLoss, bottleneckZone } = useMemo(() => {
    // If data already has nodes/links arrays, use them directly
    if (Array.isArray(data.nodes) && Array.isArray(data.links) && (data.nodes as TopologyNode[]).length > 0) {
      const n = data.nodes as TopologyNode[];
      const total = n.reduce((sum, h) => sum + h.latency, 0);
      const mLoss = Math.max(...n.map(h => h.loss), 0);
      // Find bottleneck zone (node with highest latency > 50ms)
      const bottleneck = n.reduce((max, h) => h.latency > max.latency ? h : max, n[0]);
      const bZone = bottleneck && bottleneck.latency > 50 ? ZONE_CONFIG[bottleneck.zone]?.label ?? bottleneck.zone : null;

      return {
        nodes: n,
        links: data.links as TopologyLink[],
        source: data.source as string | undefined,
        destination: data.destination as string | undefined,
        totalLatency: data.totalLatency as number | undefined ?? total,
        maxLoss: mLoss,
        bottleneckZone: bZone,
      };
    }

    // Fallback: convert from PathHop[] format
    if (Array.isArray(data.hops)) {
      const hops = data.hops as PathHop[];
      const totalHops = hops.length;

      const convertedNodes: TopologyNode[] = hops.map((hop, i) => ({
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

      const convertedLinks: TopologyLink[] = [];
      for (let i = 0; i < convertedNodes.length - 1; i++) {
        convertedLinks.push({
          from: convertedNodes[i].id,
          to: convertedNodes[i + 1].id,
          latency: convertedNodes[i + 1].latency,
          loss: convertedNodes[i + 1].loss,
          health: getLinkHealth(convertedNodes[i + 1].latency, convertedNodes[i + 1].loss),
        });
      }

      const total = hops.reduce((sum, h) => sum + h.latency, 0);
      const mLoss = Math.max(...hops.map(h => h.loss), 0);
      const bottleneck = convertedNodes.reduce((max, h) => h.latency > max.latency ? h : max, convertedNodes[0]);
      const bZone = bottleneck && bottleneck.latency > 50 ? ZONE_CONFIG[bottleneck.zone]?.label ?? bottleneck.zone : null;

      return {
        nodes: convertedNodes,
        links: convertedLinks,
        source: hops[0]?.hostname || hops[0]?.ipAddress,
        destination: hops[totalHops - 1]?.hostname || hops[totalHops - 1]?.ipAddress,
        totalLatency: total,
        maxLoss: mLoss,
        bottleneckZone: bZone,
      };
    }

    return { nodes: [], links: [], source: undefined, destination: undefined, totalLatency: undefined, maxLoss: 0, bottleneckZone: null };
  }, [data]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500 dark:text-slate-400">
        No path data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-0 p-2 overflow-hidden">
      {/* Stat Row */}
      <div className="flex items-center gap-3 px-2 py-1.5 flex-shrink-0">
        <StatBox
          label="Total Latency"
          value={totalLatency != null ? `${totalLatency.toFixed(0)}ms` : '--'}
          status={totalLatency != null && totalLatency > 100 ? 'critical' : totalLatency != null && totalLatency > 50 ? 'warning' : 'good'}
        />
        <StatBox
          label="Max Loss"
          value={`${maxLoss.toFixed(1)}%`}
          status={maxLoss > 5 ? 'critical' : maxLoss > 1 ? 'warning' : 'good'}
        />
        {bottleneckZone && (
          <StatBox label="Bottleneck" value={bottleneckZone} status="warning" />
        )}
        <StatBox label="Hops" value={String(nodes.length)} status="good" />
      </div>

      {/* Zone Legend */}
      <div className="flex items-center gap-3 px-2 py-1 border-t border-slate-200 dark:border-slate-700/50 flex-shrink-0">
        {ZONE_ORDER.map((zone) => {
          const cfg = ZONE_CONFIG[zone];
          if (!cfg) return null;
          const hasZone = nodes.some(n => n.zone === zone);
          if (!hasZone) return null;
          return (
            <div key={zone} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Path Flow */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700/50">
        <NetworkPathFlow nodes={nodes} links={links} />
      </div>

      {/* Hop Table — collapsed: ~4 rows visible, expanded: scrollable up to 400px */}
      <div className={`overflow-y-auto border-t border-slate-200 dark:border-slate-700/50 min-h-0 transition-[max-height] duration-200 ${
        tableExpanded ? 'max-h-[400px] flex-1' : 'max-h-[140px]'
      }`}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="px-2 py-1 font-medium w-8">#</th>
              <th className="px-2 py-1 font-medium">IP</th>
              <th className="px-2 py-1 font-medium">Host</th>
              <th className="px-2 py-1 font-medium text-right">Latency</th>
              <th className="px-2 py-1 font-medium text-right">Loss</th>
              <th className="px-2 py-1 font-medium">Zone</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => {
              const zoneCfg = ZONE_CONFIG[node.zone];
              return (
                <tr
                  key={node.id}
                  className="border-t border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-2 py-1 text-slate-400 tabular-nums">{node.hopNumber}</td>
                  <td className="px-2 py-1 text-slate-700 dark:text-slate-300 font-mono tabular-nums">{node.ip}</td>
                  <td className="px-2 py-1 text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                    {node.label !== node.ip ? node.label : (node.network || '--')}
                  </td>
                  <td className={`px-2 py-1 text-right tabular-nums font-medium ${latencyColor(node.latency)}`}>
                    {node.latency.toFixed(1)}ms
                  </td>
                  <td className={`px-2 py-1 text-right tabular-nums ${node.loss > 1 ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    {node.loss.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${zoneCfg?.bgColor ?? ''} ${zoneCfg?.color ?? 'text-slate-500'}`}>
                      {zoneCfg?.label ?? node.zone}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toggle — only show when >4 hops */}
      {nodes.length > 4 && (
        <button
          onClick={() => setTableExpanded(e => !e)}
          className="flex-shrink-0 flex items-center justify-center gap-1 py-1 w-full text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition border-t border-slate-100 dark:border-slate-700/30"
        >
          {tableExpanded ? (
            <><ChevronUp className="w-3 h-3" /> Show fewer</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Show all {nodes.length} hops</>
          )}
        </button>
      )}
    </div>
  );
});

TEPathVisualizationViz.displayName = 'TEPathVisualizationViz';

/** Small stat box used in the top row */
function StatBox({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'critical' }) {
  const borderColor =
    status === 'critical' ? 'border-red-400 dark:border-red-500/50' :
    status === 'warning' ? 'border-amber-400 dark:border-amber-500/50' :
    'border-slate-200 dark:border-slate-700';

  const valueColor =
    status === 'critical' ? 'text-red-600 dark:text-red-400' :
    status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    'text-slate-800 dark:text-slate-200';

  return (
    <div className={`flex flex-col items-center border rounded-md px-3 py-1 ${borderColor}`}>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}
