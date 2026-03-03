'use client';

import { useState, useCallback } from 'react';
import type { WaterfallBar } from '@/types/ai-trace';
import { SPAN_COLORS, PLATFORM_COLORS } from '@/types/ai-trace';
import { SpanTooltip } from './SpanTooltip';

interface WaterfallViewProps {
  bars: WaterfallBar[];
}

export function WaterfallView({ bars }: WaterfallViewProps) {
  const [hoveredBar, setHoveredBar] = useState<WaterfallBar | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const totalDuration = Math.max(
    ...bars.map((b) => b.offset_ms + b.duration_ms),
    1
  );

  const handleMouseMove = useCallback((e: React.MouseEvent, bar: WaterfallBar) => {
    setHoveredBar(bar);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No span data available
      </div>
    );
  }

  // Time scale markers
  const markerCount = 5;
  const markers = Array.from({ length: markerCount + 1 }, (_, i) => {
    const ms = Math.round((totalDuration / markerCount) * i);
    return { ms, pct: (ms / totalDuration) * 100 };
  });

  return (
    <div className="relative">
      {/* Time scale header */}
      <div className="relative h-6 mb-1 border-b border-gray-200 dark:border-gray-700">
        {markers.map((m) => (
          <span
            key={m.ms}
            className="absolute text-[10px] text-gray-400 -translate-x-1/2"
            style={{ left: `${Math.min(m.pct, 98)}%` }}
          >
            {m.ms >= 1000 ? `${(m.ms / 1000).toFixed(1)}s` : `${m.ms}ms`}
          </span>
        ))}
      </div>

      {/* Waterfall rows */}
      <div className="space-y-0.5">
        {bars.map((bar) => {
          const color = SPAN_COLORS[bar.span_type];
          const leftPct = (bar.offset_ms / totalDuration) * 100;
          const widthPct = Math.max((bar.duration_ms / totalDuration) * 100, 0.5);
          const platformColor = bar.tool_platform ? PLATFORM_COLORS[bar.tool_platform] : null;

          return (
            <div
              key={bar.span_id}
              className="flex items-center h-8 group hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded"
              onMouseMove={(e) => handleMouseMove(e, bar)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Label */}
              <div
                className="shrink-0 text-xs text-gray-600 dark:text-gray-300 truncate pr-2"
                style={{ width: 180, paddingLeft: bar.depth * 16 }}
              >
                {bar.tool_platform && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: platformColor || color.hex }}
                  />
                )}
                <span className="align-middle">{bar.tool_name || bar.span_name}</span>
              </div>

              {/* Bar area */}
              <div className="flex-1 relative h-full">
                <div
                  className="absolute top-1 h-5 rounded-sm transition-opacity group-hover:opacity-90"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    minWidth: 6,
                    backgroundColor: platformColor || color.hex,
                    opacity: bar.status === 'error' ? 0.6 : 0.85,
                  }}
                >
                  {/* Duration label inside bar if wide enough */}
                  {widthPct > 6 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium">
                      {bar.duration_ms >= 1000
                        ? `${(bar.duration_ms / 1000).toFixed(1)}s`
                        : `${bar.duration_ms}ms`}
                    </span>
                  )}

                  {/* Error stripe */}
                  {bar.status === 'error' && (
                    <div className="absolute inset-0 rounded-sm border-2 border-red-500" />
                  )}
                </div>
              </div>

              {/* Duration text */}
              <div className="shrink-0 w-16 text-right text-[11px] text-gray-400 tabular-nums">
                {bar.duration_ms != null
                  ? bar.duration_ms >= 1000
                    ? `${(bar.duration_ms / 1000).toFixed(1)}s`
                    : `${bar.duration_ms}ms`
                  : '...'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        {Object.entries(SPAN_COLORS).map(([type, { hex }]) => (
          <div key={type} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: hex }} />
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredBar && <SpanTooltip bar={hoveredBar} position={tooltipPos} />}
    </div>
  );
}
