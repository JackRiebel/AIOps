'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface CorrelationNode {
  id: string;
  name: string;
  type: 'source' | 'event' | 'destination';
  count: number;
  category?: string;
}

interface CorrelationLink {
  source: string;
  target: string;
  count: number;
  percentage?: number;
}

interface FlowData {
  id: string;
  source: string;
  event: string;
  destination: string;
  count: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  relatedEvents?: string[];
}

interface EventCorrelationCardData {
  nodes?: CorrelationNode[];
  links?: CorrelationLink[];
  flows?: FlowData[];
  totalEvents?: number;
  timeRange?: string;
}

interface EventCorrelationCardProps {
  data: EventCorrelationCardData;
  config?: {
    maxFlows?: number;
  };
}

type ProcessedFlow = FlowData & {
  percentage: number;
  thickness: number;
  color: string;
  colorLight: string;
  yPosition: number;
};

const FLOW_COLORS = [
  { main: '#8b5cf6', light: 'rgba(139, 92, 246, 0.2)' }, // purple
  { main: '#3b82f6', light: 'rgba(59, 130, 246, 0.2)' },  // blue
  { main: '#06b6d4', light: 'rgba(6, 182, 212, 0.2)' },   // cyan
  { main: '#10b981', light: 'rgba(16, 185, 129, 0.2)' },  // emerald
  { main: '#f59e0b', light: 'rgba(245, 158, 11, 0.2)' },  // amber
  { main: '#ef4444', light: 'rgba(239, 68, 68, 0.2)' },   // red
];

const SEVERITY_COLORS: Record<string, { main: string; light: string }> = {
  critical: { main: '#ef4444', light: 'rgba(239, 68, 68, 0.2)' },
  high: { main: '#f97316', light: 'rgba(249, 115, 22, 0.2)' },
  medium: { main: '#f59e0b', light: 'rgba(245, 158, 11, 0.2)' },
  low: { main: '#3b82f6', light: 'rgba(59, 130, 246, 0.2)' },
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Generate curved Sankey path
function generateSankeyPath(
  x1: number, y1: number, // source
  x2: number, y2: number, // mid (event)
  x3: number, y3: number, // destination
  thickness: number
): string {
  const halfThick = thickness / 2;
  const curveOffset = 15;

  // First segment: source to event
  const cp1x = x1 + curveOffset;
  const cp2x = x2 - curveOffset;

  // Second segment: event to destination
  const cp3x = x2 + curveOffset;
  const cp4x = x3 - curveOffset;

  return `
    M ${x1} ${y1 - halfThick}
    C ${cp1x} ${y1 - halfThick}, ${cp2x} ${y2 - halfThick}, ${x2} ${y2 - halfThick}
    C ${cp3x} ${y2 - halfThick}, ${cp4x} ${y3 - halfThick}, ${x3} ${y3 - halfThick}
    L ${x3} ${y3 + halfThick}
    C ${cp4x} ${y3 + halfThick}, ${cp3x} ${y2 + halfThick}, ${x2} ${y2 + halfThick}
    C ${cp2x} ${y2 + halfThick}, ${cp1x} ${y1 + halfThick}, ${x1} ${y1 + halfThick}
    Z
  `;
}

/**
 * EventCorrelationCard - Interactive Sankey-style event correlation
 *
 * Features:
 * - SVG Sankey diagram with curved flow paths
 * - Animated particles along flows
 * - Click to select and highlight flow
 * - Hover details with correlation info
 * - "Investigate" and "Create Rule" actions
 */
export const EventCorrelationCard = memo(({ data, config }: EventCorrelationCardProps) => {
  const maxFlows = config?.maxFlows ?? 6;
  const { demoMode } = useDemoMode();
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if (!data && demoMode) {
      const mockFlows: FlowData[] = [
        { id: 'f1', source: 'firewall', event: 'Connection Blocked', destination: 'external-host', count: 1250 },
        { id: 'f2', source: 'auth-server', event: 'Login Failed', destination: 'user-workstation', count: 890 },
        { id: 'f3', source: 'web-server', event: 'Error 500', destination: 'client-browser', count: 456 },
        { id: 'f4', source: 'database', event: 'Query Timeout', destination: 'app-server', count: 234 },
        { id: 'f5', source: 'api-gateway', event: 'Rate Limit', destination: 'external-api', count: 128 },
      ];
      const totalEvents = mockFlows.reduce((sum, f) => sum + f.count, 0);
      const maxCount = mockFlows[0]?.count || 1;
      const flowHeight = 100 / (mockFlows.length + 1);
      const processedFlows: ProcessedFlow[] = mockFlows.map((f, idx) => {
        const colorSet = FLOW_COLORS[idx % FLOW_COLORS.length];
        return {
          ...f,
          percentage: (f.count / totalEvents) * 100,
          thickness: Math.max(2, (f.count / maxCount) * 8),
          color: colorSet.main,
          colorLight: colorSet.light,
          yPosition: (idx + 1) * flowHeight,
        };
      });
      return {
        flows: processedFlows,
        totalEvents,
        maxCount,
        sources: [...new Set(processedFlows.map(f => f.source))],
        events: [...new Set(processedFlows.map(f => f.event))],
        destinations: [...new Set(processedFlows.map(f => f.destination))],
      };
    }

    if (!data) return null;

    let flows: FlowData[] = [];

    // If flows are provided directly
    if (data.flows && data.flows.length > 0) {
      flows = data.flows;
    }
    // Build flows from nodes and links
    else if (data.nodes && data.links && data.nodes.length > 0) {
      const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

      for (const sourceLink of data.links.filter(l => nodeMap.get(l.source)?.type === 'source')) {
        const eventNode = nodeMap.get(sourceLink.target);
        if (!eventNode || eventNode.type !== 'event') continue;

        for (const destLink of data.links.filter(l => l.source === eventNode.id)) {
          const destNode = nodeMap.get(destLink.target);
          if (!destNode || destNode.type !== 'destination') continue;

          flows.push({
            id: `${sourceLink.source}-${eventNode.id}-${destNode.id}`,
            source: nodeMap.get(sourceLink.source)?.name || sourceLink.source,
            event: eventNode.name,
            destination: destNode.name,
            count: Math.min(sourceLink.count, destLink.count),
          });
        }
      }
    }

    if (flows.length === 0) return null;

    const sortedFlows = [...flows].sort((a, b) => b.count - a.count).slice(0, maxFlows);
    const totalEvents = data.totalEvents ?? sortedFlows.reduce((sum, f) => sum + f.count, 0);
    const maxCount = sortedFlows[0]?.count || 1;

    // Calculate positions and styling
    const flowHeight = 100 / (sortedFlows.length + 1);

    const processedFlows: ProcessedFlow[] = sortedFlows.map((f, idx) => {
      const colorSet = f.severity ? SEVERITY_COLORS[f.severity] : FLOW_COLORS[idx % FLOW_COLORS.length];
      const thickness = Math.max((f.count / maxCount) * 8, 2);

      return {
        ...f,
        id: f.id || `flow-${idx}`,
        percentage: (f.count / totalEvents) * 100,
        thickness,
        color: colorSet.main,
        colorLight: colorSet.light,
        yPosition: flowHeight * (idx + 1),
      };
    });

    // Get unique sources, events, destinations
    const sources = [...new Set(processedFlows.map(f => f.source))];
    const events = [...new Set(processedFlows.map(f => f.event))];
    const destinations = [...new Set(processedFlows.map(f => f.destination))];

    return {
      flows: processedFlows,
      totalEvents,
      maxCount,
      sources,
      events,
      destinations,
    };
  }, [data, maxFlows, demoMode]);

  const handleAction = useCallback(async (action: string, flow?: ProcessedFlow) => {
    setActionState({ status: 'loading', message: `Executing ${action}...` });
    try {
      const result = await executeCardAction(`splunk-${action}`, {
        flowId: flow?.id,
        event: flow?.event,
        source: flow?.source,
        destination: flow?.destination,
        count: flow?.count,
      });
      if (result.success) {
        setActionState({ status: 'success', message: action === 'investigate' ? 'Investigation started' : 'Rule created' });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } catch {
      setActionState({ status: 'error', message: 'Action failed' });
    }
    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
          <path d="M10 7h4M7 10v4M17 10v4M10 17h4" />
        </svg>
        <span className="text-sm">No correlation data</span>
      </div>
    );
  }

  const activeFlow = selectedFlow
    ? processedData.flows.find(f => f.id === selectedFlow)
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Event Correlation
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {formatNumber(processedData.totalEvents)}
            </span>
            <span className="text-[10px] text-slate-400">events</span>
          </div>
        </div>
      </div>

      {/* Column labels */}
      <div className="flex-shrink-0 px-3 py-1.5 grid grid-cols-3 border-b border-slate-200 dark:border-slate-700">
        <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Source</div>
        <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Event Type</div>
        <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Destination</div>
      </div>

      {/* Sankey visualization */}
      <div className="flex-1 overflow-hidden p-2">
        <svg
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            {/* Gradient definitions for each flow */}
            {processedData.flows.map((flow) => (
              <linearGradient key={`grad-${flow.id}`} id={`flow-grad-${flow.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={flow.color} stopOpacity="0.8" />
                <stop offset="50%" stopColor={flow.color} stopOpacity="1" />
                <stop offset="100%" stopColor={flow.color} stopOpacity="0.8" />
              </linearGradient>
            ))}

            {/* Animated particle */}
            <circle id="particle" r="1.5" fill="white" />
          </defs>

          {/* Flow paths */}
          {processedData.flows.map((flow) => {
            const isSelected = selectedFlow === flow.id;
            const isHovered = hoveredFlow === flow.id;
            const isDimmed = (selectedFlow || hoveredFlow) && !isSelected && !isHovered;

            // Calculate positions
            const sourceX = 15;
            const eventX = 100;
            const destX = 185;
            const y = flow.yPosition;

            return (
              <g
                key={flow.id}
                onClick={() => setSelectedFlow(isSelected ? null : flow.id)}
                onMouseEnter={() => setHoveredFlow(flow.id)}
                onMouseLeave={() => setHoveredFlow(null)}
                className="cursor-pointer"
                style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
              >
                {/* Flow path */}
                <path
                  d={generateSankeyPath(
                    sourceX, y,
                    eventX, y,
                    destX, y,
                    flow.thickness
                  )}
                  fill={isSelected || isHovered ? flow.color : flow.colorLight}
                  stroke={flow.color}
                  strokeWidth={isSelected || isHovered ? 0.5 : 0.2}
                  className="transition-all duration-200"
                />

                {/* Animated particles for active flows */}
                {(isSelected || isHovered) && (
                  <>
                    <circle r="1.5" fill="white" opacity="0.8">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={`M ${sourceX} ${y} Q ${sourceX + 40} ${y} ${eventX} ${y} Q ${eventX + 40} ${y} ${destX} ${y}`}
                      />
                    </circle>
                    <circle r="1" fill="white" opacity="0.6">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        begin="0.5s"
                        path={`M ${sourceX} ${y} Q ${sourceX + 40} ${y} ${eventX} ${y} Q ${eventX + 40} ${y} ${destX} ${y}`}
                      />
                    </circle>
                  </>
                )}

                {/* Source node */}
                <g transform={`translate(${sourceX - 8}, ${y})`}>
                  <rect
                    x="-6" y="-6" width="12" height="12" rx="2"
                    fill={isSelected || isHovered ? flow.color : '#e2e8f0'}
                    className="dark:fill-slate-700"
                  />
                  <text
                    x="0" y="1"
                    textAnchor="middle"
                    className={`text-[5px] ${isSelected || isHovered ? 'fill-white' : 'fill-slate-600 dark:fill-slate-300'}`}
                  >
                    S
                  </text>
                </g>

                {/* Event node */}
                <g transform={`translate(${eventX}, ${y})`}>
                  <rect
                    x="-20" y="-7" width="40" height="14" rx="2"
                    fill={flow.color}
                    opacity={isSelected || isHovered ? 1 : 0.7}
                  />
                  <text
                    x="0" y="2"
                    textAnchor="middle"
                    className="text-[4px] fill-white font-medium"
                  >
                    {flow.event.length > 12 ? flow.event.substring(0, 10) + '..' : flow.event}
                  </text>
                </g>

                {/* Destination node */}
                <g transform={`translate(${destX + 8}, ${y})`}>
                  <rect
                    x="-6" y="-6" width="12" height="12" rx="2"
                    fill={isSelected || isHovered ? flow.color : '#e2e8f0'}
                    className="dark:fill-slate-700"
                  />
                  <text
                    x="0" y="1"
                    textAnchor="middle"
                    className={`text-[5px] ${isSelected || isHovered ? 'fill-white' : 'fill-slate-600 dark:fill-slate-300'}`}
                  >
                    D
                  </text>
                </g>

                {/* Count label */}
                {(isSelected || isHovered) && (
                  <text
                    x={eventX}
                    y={y + 12}
                    textAnchor="middle"
                    className="text-[4px] fill-slate-500 dark:fill-slate-400"
                  >
                    {formatNumber(flow.count)} ({flow.percentage.toFixed(1)}%)
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Flow list (small text) */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 max-h-24 overflow-auto">
        <div className="space-y-1">
          {processedData.flows.map((flow) => {
            const isSelected = selectedFlow === flow.id;
            return (
              <div
                key={flow.id}
                onClick={() => setSelectedFlow(isSelected ? null : flow.id)}
                className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer transition-colors
                  ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: flow.color }}
                />
                <div className="flex-1 min-w-0 text-[9px]">
                  <span className="text-slate-600 dark:text-slate-400">{flow.source}</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="font-medium" style={{ color: flow.color }}>{flow.event}</span>
                  <span className="text-slate-400 mx-1">→</span>
                  <span className="text-slate-600 dark:text-slate-400">{flow.destination}</span>
                </div>
                <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatNumber(flow.count)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected flow details */}
      {activeFlow && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeFlow.color }} />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {activeFlow.event}
              </span>
            </div>
            <span className="text-sm font-bold" style={{ color: activeFlow.color }}>
              {formatNumber(activeFlow.count)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Source: </span>
              <span className="text-slate-700 dark:text-slate-300">{activeFlow.source}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Destination: </span>
              <span className="text-slate-700 dark:text-slate-300">{activeFlow.destination}</span>
            </div>
          </div>

          {activeFlow.relatedEvents && activeFlow.relatedEvents.length > 0 && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
              Related: {activeFlow.relatedEvents.slice(0, 3).join(', ')}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleAction('investigate', activeFlow)}
              className="flex-1 px-2 py-1 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
            >
              Investigate
            </button>
            <button
              onClick={() => handleAction('rule', activeFlow)}
              className="px-2 py-1 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Create Rule
            </button>
          </div>
        </div>
      )}

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-1 flex items-center gap-2 text-[10px] ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {actionState.status === 'success' && <span>✓</span>}
          {actionState.status === 'error' && <span>✗</span>}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Footer */}
      {data.timeRange && !activeFlow && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            {data.timeRange}
          </div>
        </div>
      )}
    </div>
  );
});

EventCorrelationCard.displayName = 'EventCorrelationCard';

export default EventCorrelationCard;
