'use client';

import { memo, useMemo, useState } from 'react';

interface HeatmapDataPoint {
  x: number | string;  // Column index or label
  y: number | string;  // Row index or label
  value: number;
}

interface HeatmapProps {
  data: HeatmapDataPoint[];
  xLabels?: string[];
  yLabels?: string[];
  colorScale?: 'blue' | 'green' | 'red' | 'purple' | 'cyan';
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  cellSize?: number;
  cellGap?: number;
  showLegend?: boolean;
  minValue?: number;
  maxValue?: number;
  className?: string;
}

const COLOR_SCALES: Record<string, { light: string; dark: string }> = {
  blue: { light: 'rgb(219, 234, 254)', dark: 'rgb(30, 64, 175)' },
  green: { light: 'rgb(220, 252, 231)', dark: 'rgb(21, 128, 61)' },
  red: { light: 'rgb(254, 226, 226)', dark: 'rgb(185, 28, 28)' },
  purple: { light: 'rgb(243, 232, 255)', dark: 'rgb(126, 34, 206)' },
  cyan: { light: 'rgb(207, 250, 254)', dark: 'rgb(14, 116, 144)' },
};

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = color1.match(/\d+/g)!.map(Number);
  const c2 = color2.match(/\d+/g)!.map(Number);
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Heatmap - Grid-based heat visualization
 *
 * Features:
 * - Configurable color scales
 * - Hover tooltips
 * - Row/column labels
 * - Value display in cells
 */
export const Heatmap = memo(({
  data,
  xLabels,
  yLabels,
  colorScale = 'cyan',
  showValues = false,
  valueFormatter = (v) => v.toFixed(0),
  cellSize = 24,
  cellGap = 2,
  showLegend = true,
  minValue,
  maxValue,
  className = '',
}: HeatmapProps) => {
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null);

  const { grid, cols, rows, min, max } = useMemo(() => {
    if (!data || data.length === 0) {
      return { grid: [], cols: 0, rows: 0, min: 0, max: 0 };
    }

    // Determine dimensions
    const xValues = [...new Set(data.map(d => typeof d.x === 'number' ? d.x : xLabels?.indexOf(d.x as string) ?? 0))];
    const yValues = [...new Set(data.map(d => typeof d.y === 'number' ? d.y : yLabels?.indexOf(d.y as string) ?? 0))];

    const numCols = xLabels?.length || Math.max(...xValues) + 1;
    const numRows = yLabels?.length || Math.max(...yValues) + 1;

    // Build grid
    const gridData: (number | null)[][] = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => null)
    );

    let minVal = minValue ?? Infinity;
    let maxVal = maxValue ?? -Infinity;

    for (const point of data) {
      const x = typeof point.x === 'number' ? point.x : xLabels?.indexOf(point.x as string) ?? 0;
      const y = typeof point.y === 'number' ? point.y : yLabels?.indexOf(point.y as string) ?? 0;

      if (y >= 0 && y < numRows && x >= 0 && x < numCols) {
        gridData[y][x] = point.value;
        if (minValue === undefined) minVal = Math.min(minVal, point.value);
        if (maxValue === undefined) maxVal = Math.max(maxVal, point.value);
      }
    }

    return {
      grid: gridData,
      cols: numCols,
      rows: numRows,
      min: minVal === Infinity ? 0 : minVal,
      max: maxVal === -Infinity ? 100 : maxVal,
    };
  }, [data, xLabels, yLabels, minValue, maxValue]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        No data available
      </div>
    );
  }

  const colors = COLOR_SCALES[colorScale];
  const range = max - min || 1;

  const labelWidth = yLabels ? 50 : 0;
  const labelHeight = xLabels ? 20 : 0;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex">
        {/* Y-axis labels spacer */}
        {yLabels && <div style={{ width: labelWidth }} />}

        {/* X-axis labels */}
        {xLabels && (
          <div className="flex" style={{ gap: cellGap }}>
            {xLabels.map((label, i) => (
              <div
                key={i}
                className="text-[9px] text-slate-500 dark:text-slate-400 text-center truncate"
                style={{ width: cellSize }}
                title={label}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex">
        {/* Y-axis labels */}
        {yLabels && (
          <div className="flex flex-col justify-center" style={{ width: labelWidth, gap: cellGap }}>
            {yLabels.map((label, i) => (
              <div
                key={i}
                className="text-[9px] text-slate-500 dark:text-slate-400 text-right pr-2 truncate"
                style={{ height: cellSize }}
                title={label}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gap: cellGap,
          }}
        >
          {grid.map((row, y) =>
            row.map((value, x) => {
              const factor = value !== null ? (value - min) / range : 0;
              const bgColor = value !== null
                ? interpolateColor(colors.light, colors.dark, factor)
                : 'transparent';

              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative rounded-sm transition-transform cursor-pointer ${
                    value === null ? 'bg-slate-100 dark:bg-slate-800' : ''
                  } ${hoveredCell?.x === x && hoveredCell?.y === y ? 'scale-110 z-10' : ''}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bgColor,
                  }}
                  onMouseEnter={() => value !== null && setHoveredCell({ x, y, value })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {showValues && value !== null && cellSize >= 20 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-white mix-blend-difference">
                      {valueFormatter(value)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="mt-2 text-center text-xs text-slate-600 dark:text-slate-400">
          {xLabels?.[hoveredCell.x] || `Col ${hoveredCell.x}`} / {yLabels?.[hoveredCell.y] || `Row ${hoveredCell.y}`}:
          <span className="font-semibold ml-1">{valueFormatter(hoveredCell.value)}</span>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-[9px] text-slate-500 dark:text-slate-400">{valueFormatter(min)}</span>
          <div
            className="h-2 rounded"
            style={{
              width: 60,
              background: `linear-gradient(to right, ${colors.light}, ${colors.dark})`,
            }}
          />
          <span className="text-[9px] text-slate-500 dark:text-slate-400">{valueFormatter(max)}</span>
        </div>
      )}
    </div>
  );
});

Heatmap.displayName = 'Heatmap';

export default Heatmap;
