'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface SplunkResult {
  type?: string;
  category?: string;
  sourcetype?: string;
  count?: string | number;
  _raw?: string;
  _time?: string;
  host?: string;
  source?: string;
  index?: string;
  severity?: string;
  [key: string]: unknown;
}

interface TypeBreakdown {
  name: string;
  count: number;
}

interface SplunkSearchResultsCardData {
  results?: SplunkResult[];
  typeBreakdown?: TypeBreakdown[];
  severityBreakdown?: TypeBreakdown[];
  totalEvents?: number;
  searchQuery?: string;
  timeRange?: string;
  hasMore?: boolean;
  primaryField?: string;
  queryIntent?: string;
  insights?: string[];
  columns?: string[];
}

interface SplunkSearchResultsCardProps {
  data: SplunkSearchResultsCardData;
  config?: Record<string, unknown>;
}

type ViewMode = 'breakdown' | 'table' | 'raw';
type SortDirection = 'asc' | 'desc';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  error: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
  critical: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-700' },
  warning: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
  warn: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
  info: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  debug: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-600' },
};

const TYPE_COLORS = [
  'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500',
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return timestamp;
  }
}

function truncateString(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

/**
 * SplunkSearchResultsCard - Interactive data table for Splunk results
 *
 * Features:
 * - Sortable columns with click headers
 * - Row expansion for full event details
 * - Field highlighting with click-to-filter
 * - Copy event to clipboard
 * - View modes: Breakdown / Table / Raw
 * - "Refine Search" and "Export" actions
 */
export const SplunkSearchResultsCard = memo(({ data }: SplunkSearchResultsCardProps) => {
  const { demoMode } = useDemoMode();
  const [viewMode, setViewMode] = useState<ViewMode>('breakdown');
  const [sortColumn, setSortColumn] = useState<string>('_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<{ field: string; value: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if (!data && demoMode) {
      const mockTypeBreakdown = [
        { type: 'error', count: 2450, category: 'System' },
        { type: 'warning', count: 1890, category: 'Application' },
        { type: 'info', count: 12500, category: 'Network' },
        { type: 'debug', count: 8900, category: 'Debug' },
      ];
      const totalEvents = mockTypeBreakdown.reduce((sum, t) => sum + t.count, 0);
      const maxCount = mockTypeBreakdown[0].count;
      return {
        typeBreakdown: mockTypeBreakdown.map((t, idx) => ({
          ...t,
          name: t.type,
          percentage: (t.count / totalEvents) * 100,
          barWidth: (t.count / maxCount) * 100,
          color: TYPE_COLORS[idx % TYPE_COLORS.length],
        })),
        results: [],
        columns: ['_time', 'type', 'message', 'source'],
        totalEvents,
        primaryField: 'type',
        queryIntent: 'Demo Search Results',
        insights: ['Demo mode active - showing sample data'],
      };
    }

    if (!data) return null;

    const typeBreakdown = data.typeBreakdown || [];
    const results = data.results || [];
    const totalEvents = data.totalEvents || typeBreakdown.reduce((sum, t) => sum + t.count, 0);

    if (typeBreakdown.length === 0 && results.length === 0) return null;

    const maxCount = typeBreakdown.length > 0 ? typeBreakdown[0].count : 0;

    // Detect columns from first result
    const detectedColumns = results.length > 0
      ? Object.keys(results[0]).filter(k => !k.startsWith('_') || k === '_time')
      : [];
    const columns = data.columns || detectedColumns.slice(0, 6);

    return {
      typeBreakdown: typeBreakdown.slice(0, 8).map((t, idx) => ({
        ...t,
        percentage: totalEvents > 0 ? (t.count / totalEvents) * 100 : 0,
        barWidth: maxCount > 0 ? (t.count / maxCount) * 100 : 0,
        color: TYPE_COLORS[idx % TYPE_COLORS.length],
      })),
      results,
      columns,
      totalEvents,
      searchQuery: data.searchQuery,
      timeRange: data.timeRange,
      hasMore: data.hasMore || results.length > 10,
      primaryField: data.primaryField || 'type',
      queryIntent: data.queryIntent || 'Splunk Results',
      insights: data.insights || [],
    };
  }, [data, demoMode]);

  const sortedResults = useMemo(() => {
    if (!processedData?.results) return [];
    return [...processedData.results].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [processedData?.results, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  }, [sortColumn]);

  const handleCopy = useCallback((result: SplunkResult, index: number) => {
    const text = result._raw || JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleAction = useCallback(async (action: string) => {
    setActionState({ status: 'loading', message: `Executing ${action}...` });
    try {
      const result = await executeCardAction(`splunk-${action}`, {
        field: selectedField?.field,
        value: selectedField?.value,
        searchQuery: data?.searchQuery,
      });
      if (result.success) {
        setActionState({ status: 'success', message: action === 'refine' ? 'Search refined' : 'Export started' });
        if (action === 'refine') {
          setSelectedField(null);
        }
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } catch {
      setActionState({ status: 'error', message: 'Action failed' });
    }
    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [selectedField, data?.searchQuery]);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span className="text-sm">No Splunk data</span>
      </div>
    );
  }

  const fieldLabels: Record<string, string> = {
    type: 'Event Type', ssid: 'Network', reason: 'Reason',
    clientMac: 'Client', apMac: 'AP', deviceSerial: 'Device',
    category: 'Category', sourcetype: 'Source Type', host: 'Host',
    _time: 'Time', severity: 'Severity', source: 'Source',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-orange-50/30 dark:from-slate-800/50 dark:to-orange-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {processedData.queryIntent}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums">
              {formatNumber(processedData.totalEvents)}
            </span>
            {/* View mode toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
              {(['breakdown', 'table', 'raw'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-1.5 py-0.5 text-[9px] transition-colors ${
                    viewMode === mode
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {mode === 'breakdown' ? 'Stats' : mode === 'table' ? 'Table' : 'Raw'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {processedData.timeRange && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {processedData.timeRange}
          </div>
        )}
      </div>

      {/* Insights */}
      {processedData.insights.length > 0 && viewMode === 'breakdown' && (
        <div className="flex-shrink-0 px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div className="text-[10px] text-amber-700 dark:text-amber-400">
              {processedData.insights.map((insight, i) => (
                <span key={i}>{i > 0 && ' | '}<strong>{insight}</strong></span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'breakdown' && (
          /* Breakdown view */
          <div className="p-3">
            <div className="text-[9px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              By {fieldLabels[processedData.primaryField] || processedData.primaryField}
            </div>
            <div className="space-y-2">
              {processedData.typeBreakdown.map((type, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedField({ field: processedData.primaryField, value: type.name })}
                  className={`cursor-pointer rounded-lg p-2 transition-colors ${
                    selectedField?.value === type.name
                      ? 'bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-300 dark:ring-orange-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                      {type.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                      {formatNumber(type.count)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${type.color} rounded-full transition-all duration-500`}
                      style={{ width: `${type.barWidth}%` }}
                    />
                  </div>
                  <div className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 text-right">
                    {type.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'table' && (
          /* Table view */
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                <tr>
                  {processedData.columns.map(col => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {fieldLabels[col] || col}
                        {sortColumn === col && (
                          <svg className={`w-3 h-3 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sortedResults.slice(0, 15).map((result, idx) => {
                  const isExpanded = expandedRow === idx;
                  const severityConfig = result.severity ? SEVERITY_COLORS[String(result.severity).toLowerCase()] : null;

                  return (
                    <>
                      <tr
                        key={idx}
                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                        className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors
                          ${isExpanded ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        {processedData.columns.map(col => (
                          <td key={col} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {col === '_time' ? (
                              formatTimestamp(result._time as string | undefined)
                            ) : col === 'severity' && severityConfig ? (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${severityConfig.bg} ${severityConfig.text}`}>
                                {String(result[col])}
                              </span>
                            ) : (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedField({ field: col, value: String(result[col]) });
                                }}
                                className="hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-300 px-0.5 rounded cursor-pointer"
                                title={`Filter by ${col}="${result[col]}"`}
                              >
                                {truncateString(String(result[col] ?? '-'), 20)}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-1">
                          <svg className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${idx}-expanded`} className="bg-slate-50 dark:bg-slate-800/30">
                          <td colSpan={processedData.columns.length + 1} className="px-3 py-2">
                            <div className="space-y-2">
                              {/* All fields */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {Object.entries(result)
                                  .filter(([k]) => !k.startsWith('_') || k === '_time')
                                  .map(([key, value]) => (
                                    <div key={key} className="flex items-start gap-1">
                                      <span className="text-[9px] text-slate-500 dark:text-slate-400 min-w-[60px]">{key}:</span>
                                      <span className="text-[9px] text-slate-700 dark:text-slate-300 break-all">
                                        {truncateString(String(value ?? '-'), 40)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                              {/* Raw event */}
                              {result._raw && (
                                <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-900/50 rounded font-mono text-[9px] text-slate-600 dark:text-slate-400 max-h-24 overflow-auto">
                                  {result._raw}
                                </div>
                              )}
                              {/* Actions */}
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopy(result, idx); }}
                                  className="px-2 py-1 text-[9px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                >
                                  {copiedIndex === idx ? 'Copied!' : 'Copy Event'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'raw' && (
          /* Raw view */
          <div className="p-2 space-y-2">
            {sortedResults.slice(0, 10).map((result, idx) => (
              <div
                key={idx}
                className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {result._time && (
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {formatTimestamp(result._time)}
                      </span>
                    )}
                    {result.type && (
                      <span className="px-1.5 py-0.5 text-[9px] bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded">
                        {String(result.type)}
                      </span>
                    )}
                    {result.severity && SEVERITY_COLORS[String(result.severity).toLowerCase()] && (
                      <span className={`px-1.5 py-0.5 text-[9px] rounded ${SEVERITY_COLORS[String(result.severity).toLowerCase()].bg} ${SEVERITY_COLORS[String(result.severity).toLowerCase()].text}`}>
                        {String(result.severity)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopy(result, idx)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    title="Copy"
                  >
                    {copiedIndex === idx ? (
                      <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="font-mono text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-all max-h-16 overflow-hidden">
                  {result._raw || JSON.stringify(result, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected field filter indicator */}
      {selectedField && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-cyan-600 dark:text-cyan-400">
                Filter: {selectedField.field}=&quot;{truncateString(selectedField.value, 20)}&quot;
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAction('refine')}
                className="px-1.5 py-0.5 text-[9px] font-medium bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedField(null)}
                className="p-0.5 text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-300"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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

      {/* Footer actions */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[60%]" title={processedData.searchQuery}>
          {processedData.searchQuery ? `${truncateString(processedData.searchQuery, 35)}` : ''}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('refine')}
            className="px-2 py-1 text-[9px] font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
          >
            Refine Search
          </button>
          <button
            onClick={() => handleAction('export')}
            className="px-2 py-1 text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
});

SplunkSearchResultsCard.displayName = 'SplunkSearchResultsCard';

export default SplunkSearchResultsCard;
