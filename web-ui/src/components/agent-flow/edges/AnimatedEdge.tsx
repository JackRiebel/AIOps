'use client';

import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { AnimatedEdgeData, EdgeStatus, FlowEdge } from '@/types/agent-flow';

// ============================================================================
// Edge Style Configuration
// ============================================================================

const edgeStatusStyles: Record<EdgeStatus, {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  animation: string;
  glowColor?: string;
}> = {
  idle: {
    stroke: '#cbd5e1', // slate-300
    strokeWidth: 2,
    animation: '',
  },
  active: {
    stroke: '#3b82f6', // blue-500
    strokeWidth: 3,
    strokeDasharray: '8 4',
    animation: 'animate-dash',
    glowColor: '#3b82f6',
  },
  completed: {
    stroke: '#10b981', // emerald-500
    strokeWidth: 2.5,
    animation: '',
    glowColor: '#10b981',
  },
};

// ============================================================================
// AnimatedEdge Component
// ============================================================================

export const AnimatedEdge = memo((props: EdgeProps<FlowEdge>) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props;

  const edgeData = data as AnimatedEdgeData | undefined;
  const status: EdgeStatus = edgeData?.status || 'idle';
  const label = edgeData?.label;
  const styleConfig = edgeStatusStyles[status];

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Background glow effect for active/completed edges */}
      {styleConfig.glowColor && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: styleConfig.glowColor,
            strokeWidth: styleConfig.strokeWidth + 6,
            strokeOpacity: 0.15,
            filter: 'blur(3px)',
          }}
        />
      )}

      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: styleConfig.stroke,
          strokeWidth: styleConfig.strokeWidth,
          strokeDasharray: styleConfig.strokeDasharray,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
        }}
        className={styleConfig.animation}
      />

      {/* Subtle animated dash for active edges */}
      {status === 'active' && (
        <path
          d={edgePath}
          fill="none"
          stroke={styleConfig.stroke}
          strokeWidth={styleConfig.strokeWidth}
          strokeDasharray="8 4"
          strokeLinecap="round"
          className="animate-dash-flow"
        />
      )}

      {/* Label with improved styling */}
      {label && (
        <foreignObject
          x={labelX - 50}
          y={labelY - 14}
          width={100}
          height={28}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center h-full">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-md border border-slate-200 dark:border-slate-600 whitespace-nowrap">
              {label}
            </span>
          </div>
        </foreignObject>
      )}

      {/* Completed checkmark - only show if no label */}
      {status === 'completed' && !label && (
        <foreignObject
          x={labelX - 10}
          y={labelY - 10}
          width={20}
          height={20}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </foreignObject>
      )}

      {/* Active pulse indicator */}
      {status === 'active' && !label && (
        <foreignObject
          x={labelX - 8}
          y={labelY - 8}
          width={16}
          height={16}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <div className="relative">
              <span className="absolute inline-flex h-4 w-4 rounded-full bg-blue-400 opacity-50 animate-ping" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </div>
          </div>
        </foreignObject>
      )}
    </>
  );
});

AnimatedEdge.displayName = 'AnimatedEdge';

export default AnimatedEdge;
