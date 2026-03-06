'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, ScatterChart as ScatterIcon, AreaChart as AreaIcon, Hash } from 'lucide-react';
import type { SQLQueryResult } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'scatter' | 'grouped_bar' | 'stat' | 'none';

interface ResultsChartProps {
  results: SQLQueryResult;
  suggestedChart?: ChartType;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = ['#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
const MAX_POINTS = 30;

const CHART_OPTIONS: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: 'bar', icon: BarChart3, label: 'Bar' },
  { type: 'horizontal_bar', icon: BarChart3, label: 'H-Bar' },
  { type: 'line', icon: TrendingUp, label: 'Line' },
  { type: 'area', icon: AreaIcon, label: 'Area' },
  { type: 'pie', icon: PieIcon, label: 'Pie' },
  { type: 'scatter', icon: ScatterIcon, label: 'Scatter' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // ISO dates, common date formats
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value);
}

function truncateLabel(label: string, max = 16): string {
  return label.length > max ? label.slice(0, max - 1) + '…' : label;
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

// ─── Data analysis ───────────────────────────────────────────────────────────

interface DataAnalysis {
  categoricalCols: string[];
  numericCols: string[];
  timestampCols: string[];
  autoChart: ChartType;
}

function analyzeData(results: SQLQueryResult): DataAnalysis {
  const { columns, rows } = results;
  if (!rows.length || !columns.length) {
    return { categoricalCols: [], numericCols: [], timestampCols: [], autoChart: 'none' };
  }

  const categoricalCols: string[] = [];
  const numericCols: string[] = [];
  const timestampCols: string[] = [];

  for (const col of columns) {
    const sample = rows.slice(0, 10).map(r => r[col]);
    const nonNull = sample.filter(v => v != null && v !== '');
    const numericCount = nonNull.filter(v =>
      typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))
    ).length;
    const tsCount = nonNull.filter(v => isTimestamp(v)).length;

    if (tsCount > nonNull.length / 2) {
      timestampCols.push(col);
    } else if (numericCount > nonNull.length / 2) {
      numericCols.push(col);
    } else {
      categoricalCols.push(col);
    }
  }

  let autoChart: ChartType = 'none';

  if (rows.length === 1 && numericCols.length >= 1) {
    // Single row aggregate → stat card
    autoChart = 'stat';
  } else if (timestampCols.length >= 1 && numericCols.length >= 1) {
    // Time series
    autoChart = 'line';
  } else if (categoricalCols.length >= 1 && numericCols.length >= 2) {
    // Grouped bar
    autoChart = 'grouped_bar';
  } else if (categoricalCols.length >= 1 && numericCols.length === 1) {
    if (rows.length <= 8) {
      autoChart = 'pie';
    } else {
      autoChart = 'horizontal_bar';
    }
  } else if (numericCols.length >= 2 && categoricalCols.length === 0 && timestampCols.length === 0) {
    autoChart = 'scatter';
  } else if (numericCols.length >= 1) {
    autoChart = 'bar';
  }

  return { categoricalCols, numericCols, timestampCols, autoChart };
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      {label && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              {typeof entry.value === 'number' ? formatNumber(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat Card (single-row aggregate) ────────────────────────────────────────

function StatCard({ results, numericCols }: { results: SQLQueryResult; numericCols: string[] }) {
  const row = results.rows[0];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {numericCols.map((col, i) => {
        const value = Number(row[col]) || 0;
        return (
          <div key={col} className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600/50">
            <p className="text-2xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>
              {formatNumber(value)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{col}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ResultsChart({ results, suggestedChart }: ResultsChartProps) {
  const analysis = useMemo(() => analyzeData(results), [results]);
  const { categoricalCols, numericCols, timestampCols, autoChart } = analysis;

  // Determine initial chart type: AI suggestion > auto-detected
  const defaultChart = (suggestedChart && suggestedChart !== 'none') ? suggestedChart : autoChart;
  const [chartType, setChartType] = useState<ChartType>(defaultChart);

  // Reset when suggestedChart or results change
  useEffect(() => {
    const next = (suggestedChart && suggestedChart !== 'none') ? suggestedChart : autoChart;
    setChartType(next);
  }, [suggestedChart, autoChart]);

  // Nothing to chart
  if (autoChart === 'none' && (!suggestedChart || suggestedChart === 'none')) return null;

  // Prepare data (cap at MAX_POINTS)
  const rawRows = results.rows;
  const truncated = rawRows.length > MAX_POINTS;
  const rows = truncated ? rawRows.slice(0, MAX_POINTS) : rawRows;

  // Category axis key
  const categoryKey = timestampCols[0] || categoricalCols[0] || results.columns[0];

  // Build chart data
  const chartData = rows.map(row => {
    const entry: Record<string, unknown> = {};
    entry[categoryKey] = row[categoryKey] != null ? String(row[categoryKey]) : '';
    for (const col of numericCols) {
      entry[col] = Number(row[col]) || 0;
    }
    return entry;
  });

  // Build full options list (include stat when applicable)
  const allOptions = results.rows.length === 1 && numericCols.length >= 1
    ? [...CHART_OPTIONS, { type: 'stat' as ChartType, icon: Hash, label: 'Stat' }]
    : CHART_OPTIONS;

  const isStat = chartType === 'stat';

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      {/* Chart type selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {allOptions.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === type
                  ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
        {truncated && (
          <span className="text-xs text-amber-500 dark:text-amber-400">
            Showing first {MAX_POINTS} of {rawRows.length} rows
          </span>
        )}
      </div>

      {/* Stat card or Recharts */}
      {isStat ? (
        <StatCard results={results} numericCols={numericCols} />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(chartType, chartData, categoryKey, numericCols)}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Chart renderers ─────────────────────────────────────────────────────────

function renderChart(
  type: ChartType,
  data: Record<string, unknown>[],
  categoryKey: string,
  numericCols: string[],
): React.ReactElement {
  const gridStroke = 'rgba(148,163,184,0.15)';
  const axisStyle = { fontSize: 11, fill: '#94a3b8' };

  switch (type) {
    case 'bar':
    case 'grouped_bar':
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey={categoryKey} tick={axisStyle} tickFormatter={v => truncateLabel(String(v))} />
          <YAxis tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <Tooltip content={<ChartTooltip />} />
          {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {numericCols.map((col, i) => (
            <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );

    case 'horizontal_bar':
      return (
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis type="number" tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <YAxis dataKey={categoryKey} type="category" tick={axisStyle} width={120} tickFormatter={v => truncateLabel(String(v))} />
          <Tooltip content={<ChartTooltip />} />
          {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {numericCols.map((col, i) => (
            <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      );

    case 'line':
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey={categoryKey} tick={axisStyle} tickFormatter={v => truncateLabel(String(v))} />
          <YAxis tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <Tooltip content={<ChartTooltip />} />
          {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {numericCols.map((col, i) => (
            <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={data.length <= 20} />
          ))}
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey={categoryKey} tick={axisStyle} tickFormatter={v => truncateLabel(String(v))} />
          <YAxis tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <Tooltip content={<ChartTooltip />} />
          {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {numericCols.map((col, i) => (
            <Area key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      );

    case 'pie': {
      const valueKey = numericCols[0];
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={categoryKey}
            cx="50%"
            cy="50%"
            outerRadius="75%"
            innerRadius="40%"
            paddingAngle={2}
            label={({ name, percent }: { name?: string; percent?: number }) => `${truncateLabel(String(name ?? ''), 12)} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
            style={{ fontSize: 11 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      );
    }

    case 'scatter': {
      const xKey = numericCols[0];
      const yKey = numericCols[1] || numericCols[0];
      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey={xKey} name={xKey} tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <YAxis dataKey={yKey} name={yKey} tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <Tooltip content={<ChartTooltip />} />
          <Scatter data={data} fill={COLORS[0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      );
    }

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey={categoryKey} tick={axisStyle} tickFormatter={v => truncateLabel(String(v))} />
          <YAxis tick={axisStyle} tickFormatter={v => formatNumber(Number(v))} />
          <Tooltip content={<ChartTooltip />} />
          {numericCols.map((col, i) => (
            <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}
