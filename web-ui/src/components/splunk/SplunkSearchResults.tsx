'use client';

import React, { memo, useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SplunkSearchResultsProps {
  results: any[];
  loading: boolean;
}

// ============================================================================
// Component
// ============================================================================

const PAGE_SIZE = 50;

export const SplunkSearchResults = memo(({
  results,
  loading,
}: SplunkSearchResultsProps) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  // Detect columns from results
  const columns = useMemo(() => {
    if (results.length === 0) return [];
    const fieldSet = new Set<string>();
    // Priority fields first
    const priority = ['_time', 'host', 'source', 'sourcetype', 'index', 'severity', 'level'];
    results.slice(0, 20).forEach(r => {
      Object.keys(r).forEach(k => {
        if (!k.startsWith('_') || k === '_time' || k === '_raw') {
          fieldSet.add(k);
        }
      });
    });
    // Sort: priority fields first, then alphabetical, _raw last
    const allFields = Array.from(fieldSet);
    return allFields.sort((a, b) => {
      if (a === '_raw') return 1;
      if (b === '_raw') return -1;
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    }).filter(f => f !== '_raw'); // _raw shown in expanded row
  }, [results]);

  // Sort results
  const sortedResults = useMemo(() => {
    if (!sortField) return results;
    return [...results].sort((a, b) => {
      const va = a[sortField] ?? '';
      const vb = b[sortField] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [results, sortField, sortDir]);

  // Paginate
  const pageResults = useMemo(() => {
    return sortedResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [sortedResults, page]);

  const totalPages = Math.ceil(sortedResults.length / PAGE_SIZE);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) return null;

  // Limit displayed columns to avoid overflow
  const displayColumns = columns.slice(0, 8);

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {sortedResults.length.toLocaleString()} results
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40">
              Prev
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/30">
              <th className="w-8 px-2 py-2" />
              {displayColumns.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortField === col ? (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {pageResults.map((row, i) => {
              const globalIdx = page * PAGE_SIZE + i;
              const isExpanded = expandedRow === globalIdx;
              return (
                <React.Fragment key={globalIdx}>
                  <tr
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/40' : ''}`}
                    onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                  >
                    <td className="px-2 py-2 text-center">
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </td>
                    {displayColumns.map(col => (
                      <td key={col} className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={displayColumns.length + 1} className="px-4 py-3 bg-slate-50 dark:bg-slate-900/30">
                        <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                          {row._raw || JSON.stringify(row, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

SplunkSearchResults.displayName = 'SplunkSearchResults';
export default SplunkSearchResults;
