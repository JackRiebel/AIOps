'use client';

import { useState } from 'react';
import { Table, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import type { SQLQueryResult } from './types';

interface ResultsTableProps {
  results: SQLQueryResult;
  className?: string;
}

const PAGE_SIZE = 25;

export function ResultsTable({ results, className = '' }: ResultsTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(results.rows.length / PAGE_SIZE);
  const pageRows = results.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {results.row_count} rows &middot; {results.execution_time_ms}ms
          </span>
          {results.truncated && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <AlertCircle className="w-3 h-3" />
              Truncated
            </span>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 text-slate-400 hover:text-cyan-500 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 text-slate-400 hover:text-cyan-500 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              {results.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                {results.columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[300px] truncate">
                    {row[col] == null || (typeof row[col] === 'number' && isNaN(row[col]))
                      ? <span className="text-slate-300 italic">null</span>
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
