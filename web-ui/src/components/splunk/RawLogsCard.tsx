'use client';

import { memo, useState, useMemo } from 'react';
import { Terminal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { SplunkLog } from './types';

// ============================================================================
// Types
// ============================================================================

export interface RawLogsCardProps {
  logs: SplunkLog[];
  maxLogs: number;
  onSelectLog: (log: SplunkLog) => void;
  pageSize?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(timestamp: string): string {
  try {
    const num = parseFloat(timestamp);
    if (!isNaN(num)) return new Date(num * 1000).toLocaleString();
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

// ============================================================================
// Pagination Controls
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

const Pagination = memo(({ currentPage, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700/30">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Showing {startItem}-{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-0.5 mx-1">
          {pageNumbers.map((page, idx) => (
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400">...</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`min-w-[28px] h-7 px-2 rounded text-xs font-medium transition ${
                  currentPage === page
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {page}
              </button>
            )
          ))}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// ============================================================================
// RawLogsCard Inner Component (uses key-based reset for pagination)
// ============================================================================

const RawLogsCardInner = memo(({
  logs,
  maxLogs,
  onSelectLog,
  pageSize = 50,
}: RawLogsCardProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Limit logs to maxLogs, then paginate
  const limitedLogs = useMemo(() => logs.slice(0, maxLogs), [logs, maxLogs]);
  const totalPages = Math.max(1, Math.ceil(limitedLogs.length / pageSize));

  // Get current page logs
  const currentLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return limitedLogs.slice(start, end);
  }, [limitedLogs, currentPage, pageSize]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <DashboardCard
      title={`Raw Logs (${limitedLogs.length} total)`}
      icon={<Terminal className="w-4 h-4" />}
      accent="slate"
      compact
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-96 overflow-y-auto -mx-4">
        {currentLogs.map((log, idx) => (
          <div
            key={`${currentPage}-${idx}`}
            className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition cursor-pointer"
            onClick={() => onSelectLog(log)}
          >
            <div className="flex items-start gap-3">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0 pt-0.5">
                {formatTimestamp(log._time)}
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono flex-1 truncate">
                {log._raw || JSON.stringify(log)}
              </p>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={limitedLogs.length}
          pageSize={pageSize}
        />
      )}
    </DashboardCard>
  );
});

RawLogsCardInner.displayName = 'RawLogsCardInner';

// ============================================================================
// RawLogsCard Wrapper (provides key-based reset when logs change)
// ============================================================================

export const RawLogsCard = memo(({
  logs,
  maxLogs,
  onSelectLog,
  pageSize = 50,
}: RawLogsCardProps) => (
  <RawLogsCardInner
    key={logs.length}
    logs={logs}
    maxLogs={maxLogs}
    onSelectLog={onSelectLog}
    pageSize={pageSize}
  />
));

RawLogsCard.displayName = 'RawLogsCard';

export default RawLogsCard;
