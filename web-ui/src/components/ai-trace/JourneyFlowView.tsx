'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Wifi, TrendingUp, Activity, Gauge, Clock } from 'lucide-react';
import { useIsDark } from '@/hooks/useIsDark';
import type { AITraceDetail, WaterfallBar } from '@/types/ai-trace';
import type { JourneyNode, JourneyCostSummary } from '@/types/journey-flow';
import { useJourneyFlow } from './useJourneyFlow';
import { UserQueryNode } from './journey-nodes/UserQueryNode';
import { AIProviderNode } from './journey-nodes/AIProviderNode';
import { ToolBranchNode } from './journey-nodes/ToolBranchNode';
import { NetworkSegmentNode } from './journey-nodes/NetworkSegmentNode';
import { PlatformEndpointNode } from './journey-nodes/PlatformEndpointNode';
import { SynthesisNode } from './journey-nodes/SynthesisNode';
import { ResponseNode } from './journey-nodes/ResponseNode';
import { LatencyEdge } from './journey-edges/LatencyEdge';
import { JourneyDetailDrawer } from './JourneyDetailDrawer';

const journeyNodeTypes = {
  userQuery: UserQueryNode,
  aiProvider: AIProviderNode,
  toolBranch: ToolBranchNode,
  networkSegment: NetworkSegmentNode,
  platformEndpoint: PlatformEndpointNode,
  synthesis: SynthesisNode,
  response: ResponseNode,
} as const;

const journeyEdgeTypes = {
  latency: LatencyEdge,
} as const;

interface JourneyFlowViewProps {
  trace: AITraceDetail;
  waterfall: WaterfallBar[];
  costSummary?: JourneyCostSummary | null;
}

export function JourneyFlowView({ trace, waterfall, costSummary: propCostSummary }: JourneyFlowViewProps) {
  const isDark = useIsDark();
  const { nodes, edges, onToggleSegment, costSummary: hookCostSummary } = useJourneyFlow(trace, waterfall);
  const [selectedNode, setSelectedNode] = useState<JourneyNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flowRef = useRef<any>(null);

  const cs = propCostSummary || hookCostSummary;

  // Inject onToggle callback into NetworkSegment nodes
  const nodesWithCallbacks = nodes.map((node) => {
    if (node.type === 'networkSegment') {
      return {
        ...node,
        data: {
          ...node.data,
          onToggle: () => onToggleSegment(node.id),
        },
      };
    }
    return node;
  });

  const onNodeClick = useCallback((_event: React.MouseEvent, node: JourneyNode) => {
    setSelectedNode(node);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onInit = useCallback((instance: any) => {
    flowRef.current = instance;
    setTimeout(() => instance.fitView(), 50);
  }, []);

  // Auto-fit when drawer opens/closes or nodes change (e.g. segment expand/collapse)
  useEffect(() => {
    if (flowRef.current) {
      setTimeout(() => flowRef.current?.fitView({ duration: 200 }), 50);
    }
  }, [selectedNode, nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        No flow data available for this trace.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Network impact banner */}
      {cs && cs.totalNetworkTaxMs > 0 && <CostBanner costSummary={cs} />}

      {/* Flow diagram + drawer */}
      <div className="relative" style={{ height: 720 }}>
        <div className={`h-full rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-700/40 shadow-sm transition-all duration-200 ${selectedNode ? 'mr-[420px]' : ''}`}>
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            nodeTypes={journeyNodeTypes}
            edgeTypes={journeyEdgeTypes}
            onNodeClick={onNodeClick}
            onInit={onInit}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color={isDark ? '#334155' : '#cbd5e1'} gap={20} size={1} className="!bg-slate-50 dark:!bg-gray-900" />
            <Controls showInteractive={false} className="!rounded-xl !bg-white/80 dark:!bg-gray-900/80 !backdrop-blur-sm !shadow-md !border-slate-200/50 dark:!border-slate-700/50 [&_button]:dark:!bg-gray-900/80 [&_button]:!text-slate-600 [&_button]:dark:!text-slate-300 [&_svg]:!fill-slate-600 [&_svg]:dark:!fill-slate-300" />
            <MiniMap
              nodeStrokeWidth={3}
              pannable
              zoomable
              maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(240,240,240,0.7)'}
              className="!bg-gray-100 dark:!bg-gray-800 !border-slate-200/50 dark:!border-slate-700/50 !rounded-xl"
            />
          </ReactFlow>

          {/* Floating legend overlay */}
          <JourneyLegend />
        </div>

        {/* Detail drawer */}
        <JourneyDetailDrawer selectedNode={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}

function CostBanner({ costSummary: cs }: { costSummary: JourneyCostSummary }) {
  const wastePct = cs.totalCostUsd > 0 ? (cs.totalWastedUsd / cs.totalCostUsd) * 100 : 0;
  const pathHealth = wastePct > 5 ? 'Degraded' : wastePct > 0 ? 'Fair' : 'Healthy';
  const pathHealthColor = wastePct > 5 ? 'text-red-500' : wastePct > 0 ? 'text-amber-500' : 'text-emerald-500';
  const hasWait = cs.userWaitMs != null && cs.userWaitMs > 0;
  const cols = hasWait ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <div className={`grid ${cols} gap-3`}>
      <CostStatCard icon={<Wifi className="w-5 h-5 text-blue-500" />} label="Network Latency" value={`${cs.totalNetworkTaxMs.toFixed(0)}ms`} valueClass={cs.totalNetworkTaxMs > 100 ? 'text-red-600 dark:text-red-400' : cs.totalNetworkTaxMs > 50 ? 'text-amber-600 dark:text-amber-400' : undefined} accent="border-l-blue-500" />
      <CostStatCard icon={<TrendingUp className="w-5 h-5 text-amber-500" />} label="Extra vs Baseline" value={cs.totalNetworkTaxMs > 0 ? `+${cs.totalNetworkTaxMs.toFixed(0)}ms` : '0ms'} accent="border-l-amber-500" />
      <CostStatCard icon={<Gauge className="w-5 h-5 text-purple-500" />} label="Network Overhead" value={`${cs.networkTaxPct.toFixed(1)}%`} sub="of query time" accent="border-l-purple-500" />
      <CostStatCard icon={<Activity className="w-5 h-5" />} label="Path Health" value={pathHealth} valueClass={pathHealthColor} accent="border-l-slate-400" />
      {hasWait && (
        <CostStatCard
          icon={<Clock className="w-5 h-5 text-cyan-500" />}
          label="User Wait"
          value={`${cs.userWaitMs!.toFixed(0)}ms`}
          valueClass={cs.userWaitMs! > 5000 ? 'text-red-600 dark:text-red-400' : cs.userWaitMs! > 2000 ? 'text-amber-600 dark:text-amber-400' : undefined}
          accent="border-l-cyan-500"
        />
      )}
    </div>
  );
}

function CostStatCard({ icon, label, value, sub, valueClass, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  accent: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/40 border-l-[3px] ${accent} bg-white dark:bg-gray-800/80 shadow-sm`}>
      <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>
        <div className={`text-base font-mono font-semibold ${valueClass || 'text-slate-800 dark:text-slate-200'}`}>
          {value}
          {sub && <span className="text-[10px] text-slate-400 ml-1 font-normal">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

function JourneyLegend() {
  const latencyItems = [
    { color: '#10b981', label: 'Good (< 50ms)' },
    { color: '#f59e0b', label: 'Fair (50-100ms)' },
    { color: '#ef4444', label: 'Slow (> 100ms)' },
  ];

  const zoneItems = [
    { color: '#06b6d4', label: 'Source' },
    { color: '#3b82f6', label: 'Local' },
    { color: '#8b5cf6', label: 'ISP' },
    { color: '#10b981', label: 'Cloud' },
    { color: '#f59e0b', label: 'Dest' },
  ];

  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-4 px-3 py-2 text-[10px] text-slate-500 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200/50 dark:border-slate-700/50">
      <span className="font-semibold text-slate-600 dark:text-slate-300">Latency</span>
      {latencyItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
      <span className="font-semibold text-slate-600 dark:text-slate-300">Zones</span>
      {zoneItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
