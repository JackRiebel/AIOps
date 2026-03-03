'use client';

import { useMemo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { LatencyEdgeData } from '@/types/journey-flow';

function getLatencyColor(ms: number | null): string {
  if (ms == null) return '#94a3b8';
  if (ms > 100) return '#ef4444';
  if (ms > 50) return '#f59e0b';
  return '#10b981';
}

export function LatencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<LatencyEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = data?.platformColor || getLatencyColor(data?.latencyMs ?? null);
  const strokeWidth = data?.latencyMs != null ? Math.max(2, Math.min(4, data.latencyMs / 40)) : 2;
  const dashArray = data?.dashed ? '6 3' : undefined;
  const isSuccess = !data?.dashed && data?.latencyMs != null;

  // Unique gradient ID for this edge
  const gradientId = `edge-gradient-${id}`;

  // Particle animation: show 1 flowing dot along the edge path
  const particleCount = isSuccess ? 1 : 0;
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      key: `particle-${id}-${i}`,
      delay: i * 1.5,
      duration: 3,
    }));
  }, [particleCount, id]);

  return (
    <>
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0.9} />
        </linearGradient>
      </defs>

      {/* Glow layer (subtler) */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 2}
        strokeOpacity={0.06}
        strokeLinecap="round"
      />

      {/* Main edge path */}
      <path
        id={`edge-path-${id}`}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />

      {/* Animated flow particles */}
      {particles.map((p) => (
        <circle key={p.key} r={2.5} fill={color} opacity={0.8}>
          <animateMotion
            dur={`${p.duration}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      ))}

      {/* Edge label */}
      {data?.latencyMs != null && data.latencyMs > 0 && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <div
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold shadow-sm bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
              style={{
                color,
                border: `1px solid ${color}30`,
                textShadow: `0 0 8px ${color}40`,
              }}
            >
              {data.latencyMs.toFixed(0)}ms
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
