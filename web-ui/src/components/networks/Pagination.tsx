'use client';

import { memo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  filteredItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination = memo(({
  currentPage,
  totalPages,
  totalItems,
  filteredItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);
      const adjustedStart = Math.max(1, end - maxVisible + 1);
      for (let i = adjustedStart; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const pages = getPageNumbers();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-900/20">
      {/* Item count */}
      <div className="text-xs text-slate-500 dark:text-slate-500">
        <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{startItem.toLocaleString()}&ndash;{endItem.toLocaleString()}</span>
        {' of '}
        <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{filteredItems.toLocaleString()}</span>
        {filteredItems !== totalItems && (
          <span className="text-slate-400 dark:text-slate-600"> (from {totalItems.toLocaleString()})</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 mr-1"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5">
          {pages[0] > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-2 py-1 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors tabular-nums"
              >
                1
              </button>
              {pages[0] > 2 && (
                <span className="px-0.5 text-slate-300 dark:text-slate-600 text-xs">&hellip;</span>
              )}
            </>
          )}

          {pages.map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all tabular-nums ${
                currentPage === page
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {page}
            </button>
          ))}

          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && (
                <span className="px-0.5 text-slate-300 dark:text-slate-600 text-xs">&hellip;</span>
              )}
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-2 py-1 rounded text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors tabular-nums"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;
