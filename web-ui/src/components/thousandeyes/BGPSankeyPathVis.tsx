'use client';

import { memo, useMemo, useState } from 'react';
import type { BGPResult } from './types';

export interface BGPSankeyPathVisProps {
  bgpData: BGPResult[];
}

interface SankeyNode {
  id: string;
  label: string;
  column: number; // 0=monitors, 1..N=AS hops, last=prefixes
  y: number;
  height: number;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  thickness: number;
  sourceY: number;
  targetY: number;
  color: string;
  opacity: number;
}

function reachabilityToColor(reachability: number): string {
  if (reachability >= 95) return '#22c55e';
  if (reachability >= 80) return '#f59e0b';
  return '#ef4444';
}

export const BGPSankeyPathVis = memo(({ bgpData }: BGPSankeyPathVisProps) => {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const { nodes, links, width, height } = useMemo(() => {
    if (bgpData.length === 0) return { nodes: [], links: [], width: 800, height: 200 };

    // Collect unique monitors, AS hops, and prefixes
    const monitors = [...new Set(bgpData.map(r => r.monitor))].filter(Boolean);
    const prefixes = [...new Set(bgpData.map(r => r.prefix))].filter(Boolean);

    // Collect unique AS numbers across all paths
    const allASNumbers = new Set<number>();
    for (const r of bgpData) {
      if (Array.isArray(r.asPath)) {
        for (const as of r.asPath) allASNumbers.add(as);
      }
    }
    const asNumbers = [...allASNumbers].sort((a, b) => a - b);

    // Determine columns: monitors | AS hops (up to 3 columns) | prefixes
    const maxHops = Math.min(3, Math.max(...bgpData.map(r => (r.asPath?.length || 0)), 1));
    const totalColumns = 2 + maxHops; // monitors + AS hop columns + prefixes

    const svgWidth = 800;
    const padding = 30;
    const nodeWidth = 14;
    const colSpacing = (svgWidth - 2 * padding) / Math.max(totalColumns - 1, 1);

    // Build nodes
    const nodeMap = new Map<string, SankeyNode>();
    const nodeHeight = 22;
    const nodeGap = 6;

    // Monitor nodes (column 0)
    monitors.forEach((m, i) => {
      const id = `mon-${m}`;
      nodeMap.set(id, {
        id, label: m.length > 20 ? m.slice(0, 18) + '..' : m,
        column: 0,
        y: padding + i * (nodeHeight + nodeGap),
        height: nodeHeight,
        color: '#6366f1',
      });
    });

    // AS nodes (columns 1..maxHops)
    const asColumnMap = new Map<number, Set<number>>(); // column -> set of AS numbers
    for (const r of bgpData) {
      if (!Array.isArray(r.asPath)) continue;
      for (let i = 0; i < Math.min(r.asPath.length, maxHops); i++) {
        if (!asColumnMap.has(i + 1)) asColumnMap.set(i + 1, new Set());
        asColumnMap.get(i + 1)!.add(r.asPath[i]);
      }
    }

    for (const [col, asSet] of asColumnMap.entries()) {
      const asList = [...asSet].sort((a, b) => a - b);
      asList.forEach((as, i) => {
        const id = `as-${col}-${as}`;
        nodeMap.set(id, {
          id, label: `AS${as}`,
          column: col,
          y: padding + i * (nodeHeight + nodeGap),
          height: nodeHeight,
          color: '#3b82f6',
        });
      });
    }

    // Prefix nodes (last column)
    prefixes.forEach((p, i) => {
      const id = `pfx-${p}`;
      nodeMap.set(id, {
        id, label: p.length > 18 ? p.slice(0, 16) + '..' : p,
        column: totalColumns - 1,
        y: padding + i * (nodeHeight + nodeGap),
        height: nodeHeight,
        color: '#8b5cf6',
      });
    });

    // Build links
    const linkSet = new Map<string, { source: string; target: string; count: number; reachability: number }>();

    for (const r of bgpData) {
      const monId = `mon-${r.monitor}`;
      const pfxId = `pfx-${r.prefix}`;
      const path = Array.isArray(r.asPath) ? r.asPath : [];

      if (path.length === 0) {
        // Direct link monitor -> prefix
        const key = `${monId}|${pfxId}`;
        const existing = linkSet.get(key);
        if (existing) {
          existing.count++;
          existing.reachability = Math.min(existing.reachability, r.reachability);
        } else {
          linkSet.set(key, { source: monId, target: pfxId, count: 1, reachability: r.reachability });
        }
      } else {
        // Monitor -> first AS
        const firstAS = `as-1-${path[0]}`;
        const firstKey = `${monId}|${firstAS}`;
        const e1 = linkSet.get(firstKey);
        if (e1) { e1.count++; e1.reachability = Math.min(e1.reachability, r.reachability); }
        else linkSet.set(firstKey, { source: monId, target: firstAS, count: 1, reachability: r.reachability });

        // AS -> AS hops
        for (let i = 0; i < Math.min(path.length - 1, maxHops - 1); i++) {
          const src = `as-${i + 1}-${path[i]}`;
          const tgt = `as-${i + 2}-${path[i + 1]}`;
          const key = `${src}|${tgt}`;
          const e = linkSet.get(key);
          if (e) { e.count++; e.reachability = Math.min(e.reachability, r.reachability); }
          else linkSet.set(key, { source: src, target: tgt, count: 1, reachability: r.reachability });
        }

        // Last AS -> prefix
        const lastASIdx = Math.min(path.length, maxHops);
        const lastAS = `as-${lastASIdx}-${path[lastASIdx - 1]}`;
        const lastKey = `${lastAS}|${pfxId}`;
        const eL = linkSet.get(lastKey);
        if (eL) { eL.count++; eL.reachability = Math.min(eL.reachability, r.reachability); }
        else linkSet.set(lastKey, { source: lastAS, target: pfxId, count: 1, reachability: r.reachability });
      }
    }

    const maxCount = Math.max(...Array.from(linkSet.values()).map(l => l.count), 1);

    const sankeyLinks: SankeyLink[] = Array.from(linkSet.values())
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => {
        const src = nodeMap.get(l.source)!;
        const tgt = nodeMap.get(l.target)!;
        return {
          source: l.source,
          target: l.target,
          thickness: Math.max(2, (l.count / maxCount) * 16),
          sourceY: src.y + src.height / 2,
          targetY: tgt.y + tgt.height / 2,
          color: reachabilityToColor(l.reachability),
          opacity: 0.5,
        };
      });

    // Calculate SVG height
    const maxY = Math.max(...Array.from(nodeMap.values()).map(n => n.y + n.height), 200);
    const svgHeight = maxY + padding;

    return {
      nodes: Array.from(nodeMap.values()),
      links: sankeyLinks,
      width: svgWidth,
      height: svgHeight,
    };
  }, [bgpData]);

  if (bgpData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">No BGP path data available for Sankey visualization</p>
      </div>
    );
  }

  const padding = 30;
  const nodeWidth = 14;
  const totalColumns = Math.max(...nodes.map(n => n.column), 0) + 1;
  const colSpacing = (width - 2 * padding) / Math.max(totalColumns - 1, 1);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: 200, maxHeight: 400 }}>
        {/* Links (Bezier curves) */}
        {links.map((link, i) => {
          const srcNode = nodes.find(n => n.id === link.source);
          const tgtNode = nodes.find(n => n.id === link.target);
          if (!srcNode || !tgtNode) return null;

          const sx = padding + srcNode.column * colSpacing + nodeWidth;
          const tx = padding + tgtNode.column * colSpacing;
          const midX = (sx + tx) / 2;
          const isHovered = hoveredLink === `${link.source}|${link.target}`;

          return (
            <path
              key={i}
              d={`M ${sx} ${link.sourceY} C ${midX} ${link.sourceY}, ${midX} ${link.targetY}, ${tx} ${link.targetY}`}
              fill="none"
              stroke={link.color}
              strokeWidth={link.thickness}
              opacity={isHovered ? 0.9 : 0.45}
              className="transition-opacity cursor-pointer"
              onMouseEnter={() => setHoveredLink(`${link.source}|${link.target}`)}
              onMouseLeave={() => setHoveredLink(null)}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const x = padding + node.column * colSpacing;
          const isFirst = node.column === 0;
          const isLast = node.column === totalColumns - 1;

          return (
            <g key={node.id}>
              <rect
                x={x}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                rx={3}
                fill={node.color}
                opacity={0.85}
              />
              <text
                x={isFirst ? x - 4 : isLast ? x + nodeWidth + 4 : x + nodeWidth / 2}
                y={node.y + node.height / 2}
                textAnchor={isFirst ? 'end' : isLast ? 'start' : 'middle'}
                dominantBaseline="central"
                className="fill-slate-600 dark:fill-slate-300"
                fontSize={10}
                fontFamily="monospace"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Column headers */}
        {totalColumns > 0 && (
          <>
            <text x={padding + nodeWidth / 2} y={14} textAnchor="middle" fontSize={9} className="fill-slate-400 dark:fill-slate-500 uppercase" fontWeight="600">
              Monitors
            </text>
            <text x={padding + (totalColumns - 1) * colSpacing + nodeWidth / 2} y={14} textAnchor="middle" fontSize={9} className="fill-slate-400 dark:fill-slate-500 uppercase" fontWeight="600">
              Prefixes
            </text>
            {totalColumns > 2 && (
              <text x={padding + Math.floor(totalColumns / 2) * colSpacing + nodeWidth / 2} y={14} textAnchor="middle" fontSize={9} className="fill-slate-400 dark:fill-slate-500 uppercase" fontWeight="600">
                AS Path
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">100% Reachable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Degraded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-red-500" />
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Unreachable</span>
        </div>
      </div>
    </div>
  );
});

BGPSankeyPathVis.displayName = 'BGPSankeyPathVis';

export default BGPSankeyPathVis;
