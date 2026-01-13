'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export type ChartType = 'line' | 'area' | 'bar';

export interface DataPoint {
  [key: string]: string | number;
}

export interface ChartSeries {
  dataKey: string;
  name?: string;
  color?: string;
}

export interface EmbeddedChartProps {
  type?: ChartType;
  data: DataPoint[];
  xAxisKey: string;
  series: ChartSeries[];
  height?: number;
  title?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  className?: string;
}

const defaultColors = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
];

export function EmbeddedChart({
  type = 'line',
  data,
  xAxisKey,
  series,
  height = 200,
  title,
  showLegend = true,
  showGrid = true,
  className = '',
}: EmbeddedChartProps) {
  // Assign colors to series that don't have one
  const seriesWithColors = useMemo(
    () =>
      series.map((s, i) => ({
        ...s,
        color: s.color || defaultColors[i % defaultColors.length],
      })),
    [series]
  );

  const commonProps = {
    data,
    margin: { top: 10, right: 10, left: 0, bottom: 0 },
  };

  const axisProps = {
    xAxis: (
      <XAxis
        dataKey={xAxisKey}
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        axisLine={{ stroke: '#e2e8f0' }}
        tickLine={false}
      />
    ),
    yAxis: (
      <YAxis
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        axisLine={false}
        tickLine={false}
        width={40}
      />
    ),
    grid: showGrid ? (
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
    ) : null,
    tooltip: (
      <Tooltip
        contentStyle={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(71, 85, 105, 0.5)',
          borderRadius: '8px',
          fontSize: '12px',
        }}
        labelStyle={{ color: '#94a3b8' }}
      />
    ),
    legend: showLegend ? (
      <Legend
        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        iconSize={8}
      />
    ) : null,
  };

  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {seriesWithColors.map((s) => (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {seriesWithColors.map((s) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                fill={s.color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            {axisProps.grid}
            {axisProps.xAxis}
            {axisProps.yAxis}
            {axisProps.tooltip}
            {axisProps.legend}
            {seriesWithColors.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={{ fill: s.color, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className={`${className}`}>
      {title && (
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {title}
        </h4>
      )}
      <div className="bg-white dark:bg-slate-800/50 rounded-lg p-3">
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Quick chart component for simple inline metrics
export function SparklineChart({
  data,
  dataKey,
  color = '#06b6d4',
  height = 40,
  className = '',
}: {
  data: DataPoint[];
  dataKey: string;
  color?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`inline-block ${className}`} style={{ width: 100, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
