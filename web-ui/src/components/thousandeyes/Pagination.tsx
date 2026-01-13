'use client';

import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  filteredItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// ============================================================================
// Pagination Component
// ============================================================================

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

  // Calculate page numbers to show
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
      {/* Item count */}
      <div className="text-xs text-slate-500 dark:text-slate-500">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{startItem}-{endItem}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{filteredItems}</span>
        {filteredItems !== totalItems && (
          <span className="text-slate-400 dark:text-slate-600"> (filtered from {totalItems})</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pages[0] > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                1
              </button>
              {pages[0] > 2 && (
                <span className="px-1 text-slate-400 dark:text-slate-600">...</span>
              )}
            </>
          )}

          {pages.map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                currentPage === page
                  ? 'bg-cyan-600 text-white border border-cyan-600'
                  : 'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {page}
            </button>
          ))}

          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && (
                <span className="px-1 text-slate-400 dark:text-slate-600">...</span>
              )}
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

export default Pagination;
