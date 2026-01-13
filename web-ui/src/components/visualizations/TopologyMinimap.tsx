'use client';

import { memo, useCallback, useMemo } from 'react';
import { Map, X } from 'lucide-react';
import type { TopologyNode, DeviceStatus } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

export interface TopologyMinimapProps {
  nodes: TopologyNode[];
  dimensions: { width: number; height: number };
  viewportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
  };
  onNavigate: (x: number, y: number) => void;
  onClose?: () => void;
  visible?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const NODE_RADIUS = 3;

const STATUS_DOT_COLORS: Record<DeviceStatus, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  alerting: '#f59e0b',
  dormant: '#9ca3af',
  unknown: '#64748b',
};

// ============================================================================
// TopologyMinimap Component
// ============================================================================

export const TopologyMinimap = memo(({
  nodes,
  dimensions,
  viewportBounds,
  onNavigate,
  onClose,
  visible = true,
  className = '',
}: TopologyMinimapProps) => {
  // Calculate scale to fit topology in minimap
  const scale = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return 1;
    const scaleX = MINIMAP_WIDTH / dimensions.width;
    const scaleY = MINIMAP_HEIGHT / dimensions.height;
    return Math.min(scaleX, scaleY) * 0.9; // 90% to add padding
  }, [dimensions]);

  // Calculate viewport rectangle in minimap coordinates
  const viewportRect = useMemo(() => {
    const x = (viewportBounds.x / viewportBounds.scale) * scale;
    const y = (viewportBounds.y / viewportBounds.scale) * scale;
    const width = (viewportBounds.width / viewportBounds.scale) * scale;
    const height = (viewportBounds.height / viewportBounds.scale) * scale;
    return { x, y, width, height };
  }, [viewportBounds, scale]);

  // Handle click on minimap to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap coordinates to topology coordinates
      const topoX = clickX / scale;
      const topoY = clickY / scale;

      onNavigate(topoX, topoY);
    },
    [scale, onNavigate]
  );

  if (!visible) return null;

  return (
    <div
      className={`absolute z-30 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-sm ${className}`}
      style={{ width: MINIMAP_WIDTH + 16, height: MINIMAP_HEIGHT + 40 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          <Map className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Minimap
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Minimap SVG */}
      <div className="p-2">
        <svg
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onClick={handleClick}
          className="cursor-crosshair bg-slate-50 dark:bg-slate-900/50 rounded"
          style={{ border: '1px solid var(--border-color, #e2e8f0)' }}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.05"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="url(#minimap-grid)" />

          {/* Nodes as dots */}
          {nodes.map((node) => {
            if (node.x === undefined || node.y === undefined) return null;
            const x = node.x * scale;
            const y = node.y * scale;
            const color = STATUS_DOT_COLORS[node.status] || STATUS_DOT_COLORS.unknown;

            return (
              <circle
                key={node.id}
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={color}
                opacity={0.8}
              />
            );
          })}

          {/* Viewport rectangle */}
          <rect
            x={-viewportRect.x}
            y={-viewportRect.y}
            width={viewportRect.width}
            height={viewportRect.height}
            fill="rgba(6, 182, 212, 0.1)"
            stroke="#06b6d4"
            strokeWidth={1.5}
            rx={2}
            className="pointer-events-none"
          />
        </svg>
      </div>

      {/* Footer with node count */}
      <div className="px-2 pb-1.5">
        <span className="text-[9px] text-slate-400">
          {nodes.length} nodes
        </span>
      </div>
    </div>
  );
});

TopologyMinimap.displayName = 'TopologyMinimap';

export default TopologyMinimap;
