'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import type { TopologyNode } from './types';
import { ZONE_CONFIG } from './types';

// ============================================================================
// LatencyWaterfallChart — Per-hop latency bar chart with cumulative line,
// threshold markers, and interactive bar highlighting
// ============================================================================

export interface LatencyWaterfallChartProps {
  nodes: TopologyNode[];
  onHopSelect?: (nodeId: string) => void;
}

interface ChartDataPoint {
  name: string;
  hopNumber: number;
  latency: number;
  cumulative: number;
  zone: string;
  ip: string;
  loss: number;
  isBottleneck: boolean;
  nodeId: string;
}

export const LatencyWaterfallChart = memo(({ nodes, onHopSelect }: LatencyWaterfallChartProps) => {
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const data = useMemo(() => {
    if (nodes.length === 0) return [];

    const maxLatency = Math.max(...nodes.map(n => n.latency));
    let cumulative = 0;

    return nodes.map((node): ChartDataPoint => {
      cumulative += node.latency;
      return {
        name: `#${node.hopNumber}`,
        hopNumber: node.hopNumber,
        latency: node.latency,
        cumulative,
        zone: node.zone,
        ip: node.ip,
        loss: node.loss,
        isBottleneck: node.latency === maxLatency && maxLatency > 50,
        nodeId: node.id,
      };
    });
  }, [nodes]);

  const maxCumulative = useMemo(() => {
    if (data.length === 0) return 100;
    return Math.max(...data.map(d => d.cumulative));
  }, [data]);

  const handleBarClick = useCallback((entry: ChartDataPoint) => {
    setSelectedBar(prev => prev === entry.nodeId ? null : entry.nodeId);
    onHopSelect?.(entry.nodeId);
  }, [onHopSelect]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
      <h5 className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">
        Per-Hop Latency
      </h5>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={{ stroke: '#334155', strokeWidth: 0.5 }}
              tickLine={false}
              interval={data.length > 15 ? Math.floor(data.length / 10) : 0}
            />
            <YAxis
              yAxisId="latency"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}ms`}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}ms`}
              hide
            />
            <Tooltip
              isAnimationActive={false}
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#e2e8f0',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'latency') return [`${value.toFixed(1)}ms`, 'Hop Latency'];
                if (name === 'cumulative') return [`${value.toFixed(1)}ms`, 'Cumulative'];
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                if (payload?.[0]?.payload) {
                  const d = payload[0].payload as ChartDataPoint;
                  const zoneLabel = ZONE_CONFIG[d.zone]?.label || d.zone;
                  return `Hop ${d.hopNumber} (${d.ip}) — ${zoneLabel}${d.loss > 0 ? ` · ${d.loss.toFixed(1)}% loss` : ''}`;
                }
                return label;
              }}
            />
            {/* Threshold reference lines */}
            <ReferenceLine
              yAxisId="latency"
              y={50}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              strokeOpacity={0.5}
              label={{ value: '50ms', position: 'right', fontSize: 8, fill: '#f59e0b', opacity: 0.7 }}
            />
            {maxCumulative > 80 && (
              <ReferenceLine
                yAxisId="latency"
                y={100}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeOpacity={0.5}
                label={{ value: '100ms', position: 'right', fontSize: 8, fill: '#ef4444', opacity: 0.7 }}
              />
            )}
            <Bar
              yAxisId="latency"
              dataKey="latency"
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              onClick={(_data, _index, e) => {
                const payload = (e as unknown as { payload?: ChartDataPoint })?.payload;
                if (payload) handleBarClick(payload);
              }}
              className="cursor-pointer"
            >
              {data.map((entry, idx) => {
                const zoneHex = ZONE_CONFIG[entry.zone]?.dotColorHex || '#94a3b8';
                const isSelected = selectedBar === entry.nodeId;
                return (
                  <Cell
                    key={idx}
                    fill={entry.isBottleneck ? '#ef4444' : zoneHex}
                    fillOpacity={isSelected ? 1 : entry.isBottleneck ? 0.9 : 0.7}
                    stroke={isSelected ? '#06b6d4' : entry.isBottleneck ? '#ef4444' : zoneHex}
                    strokeWidth={isSelected ? 2 : entry.isBottleneck ? 2 : 0}
                  />
                );
              })}
            </Bar>
            <Line
              yAxisId="latency"
              type="monotone"
              dataKey="cumulative"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              opacity={0.6}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

LatencyWaterfallChart.displayName = 'LatencyWaterfallChart';
