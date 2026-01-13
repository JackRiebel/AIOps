'use client';

import React, { useMemo } from 'react';

export interface SparklineChartProps {
  data: number[];
  height?: number;
  width?: number | '100%';
  color?: string;
  showArea?: boolean;
  showEndpoint?: boolean;
  strokeWidth?: number;
}

export function SparklineChart({
  data,
  height = 32,
  width = '100%',
  color = '#049FD9',
  showArea = true,
  showEndpoint = true,
  strokeWidth = 2,
}: SparklineChartProps) {
  const { path, areaPath, endPoint, viewBox } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', areaPath: '', endPoint: null, viewBox: '0 0 100 40' };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Calculate dimensions
    const chartWidth = 100;
    const chartHeight = 40;
    const padding = 4;
    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;

    // Generate points
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * innerWidth;
      const y = padding + innerHeight - ((value - min) / range) * innerHeight;
      return { x, y };
    });

    // Generate path
    const pathCommands = points.map((point, index) => {
      return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    });
    const linePath = pathCommands.join(' ');

    // Generate area path (close the path to bottom)
    const areaCommands = [
      ...pathCommands,
      `L ${points[points.length - 1].x.toFixed(2)} ${chartHeight - padding}`,
      `L ${padding} ${chartHeight - padding}`,
      'Z',
    ];
    const areaPathStr = areaCommands.join(' ');

    // End point for highlight
    const lastPoint = points[points.length - 1];

    return {
      path: linePath,
      areaPath: areaPathStr,
      endPoint: lastPoint,
      viewBox: `0 0 ${chartWidth} ${chartHeight}`,
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-xs"
        style={{ height, width: width === '100%' ? '100%' : width }}
      >
        No data
      </div>
    );
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      style={{
        height,
        width: width === '100%' ? '100%' : width,
        display: 'block',
      }}
    >
      {/* Gradient for area */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {showArea && (
        <path
          d={areaPath}
          fill={`url(#sparkline-gradient-${color.replace('#', '')})`}
        />
      )}

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* End point */}
      {showEndpoint && endPoint && (
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

export default SparklineChart;
