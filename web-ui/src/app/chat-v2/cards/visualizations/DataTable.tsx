'use client';

/**
 * DataTable Visualization
 *
 * Displays data in a sortable table format.
 * Used for device lists, search results, etc.
 */

import { memo, useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ColumnConfig, STATUS_COLORS } from '../types';

interface DataTableProps {
  data: Record<string, unknown>[];
  columns?: ColumnConfig[];
  pageSize?: number;
  sortable?: boolean;
  compact?: boolean;
  onRowClick?: (row: Record<string, unknown>) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export const DataTable = memo(({
  data,
  columns,
  pageSize = 10,
  sortable = true,
  compact = false,
  onRowClick,
}: DataTableProps) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Auto-generate columns if not provided
  const tableColumns: ColumnConfig[] = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (data.length === 0) return [];

    const sample = data[0];
    return Object.keys(sample).slice(0, 6).map(key => ({
      key,
      label: formatColumnLabel(key),
      sortable: true,
    }));
  }, [columns, data]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  // Reset page when data changes (e.g., from refresh)
  useEffect(() => {
    setCurrentPage(0);
  }, [data.length]);

  // Handle sort click
  const handleSort = (column: string) => {
    if (!sortable) return;

    if (sortColumn === column) {
      setSortDirection(prev =>
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
            <tr>
              {tableColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`
                    text-left font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50
                    ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
                    ${col.sortable !== false ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''}
                  `}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortColumn === col.key && (
                      <SortIcon direction={sortDirection} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIndex * 0.02 }}
                onClick={() => onRowClick?.(row)}
                className={`
                  border-b border-slate-100 dark:border-slate-800/50
                  ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                `}
              >
                {tableColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`text-slate-700 dark:text-slate-300 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
                  >
                    <CellValue
                      value={row[col.key]}
                      type={col.type}
                      colorMap={col.colorMap}
                      format={col.format}
                    />
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

DataTable.displayName = 'DataTable';

// =============================================================================
// Cell Value Renderer
// =============================================================================

interface CellValueProps {
  value: unknown;
  type?: ColumnConfig['type'];
  colorMap?: Record<string, string>;
  format?: string;
}

const CellValue = memo(({ value, type, colorMap }: CellValueProps) => {
  if (value === null || value === undefined) {
    return <span className="text-slate-600">-</span>;
  }

  switch (type) {
    case 'status': {
      const status = String(value).toLowerCase();
      const color = colorMap?.[status] ?? STATUS_COLORS[status] ?? '#94a3b8';
      return (
        <span className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="capitalize">{status}</span>
        </span>
      );
    }

    case 'badge': {
      const badgeValue = String(value).toLowerCase();
      const color = colorMap?.[badgeValue] ?? STATUS_COLORS[badgeValue] ?? '#6b7280';
      return (
        <span
          className="px-1.5 py-0.5 rounded text-xs font-medium capitalize"
          style={{
            backgroundColor: `${color}20`,
            color,
          }}
        >
          {String(value)}
        </span>
      );
    }

    case 'date': {
      return (
        <span className="text-slate-400 tabular-nums">
          {formatDate(value)}
        </span>
      );
    }

    case 'number': {
      return (
        <span className="tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      );
    }

    case 'progress': {
      const percent = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, percent))}%`,
                backgroundColor: percent >= 80 ? '#10b981' : percent >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums w-10">
            {percent.toFixed(0)}%
          </span>
        </div>
      );
    }

    default:
      return <span className="truncate max-w-[200px] block">{String(value)}</span>;
  }
});

CellValue.displayName = 'CellValue';

// =============================================================================
// Helper Functions
// =============================================================================

function formatColumnLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .replace(/\bIp\b/g, 'IP')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bMac\b/g, 'MAC')
    .trim();
}

function formatDate(value: unknown): string {
  if (!value) return '-';

  try {
    const date = new Date(String(value));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

    return date.toLocaleDateString();
  } catch {
    return String(value);
  }
}

// =============================================================================
// Icons
// =============================================================================

const SortIcon = ({ direction }: { direction: SortDirection }) => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    {direction === 'asc' ? (
      <path d="M12 4l-8 8h16l-8-8z" />
    ) : direction === 'desc' ? (
      <path d="M12 20l8-8H4l8 8z" />
    ) : (
      <path d="M12 4l-4 4h8l-4-4zm0 16l4-4H8l4 4z" opacity={0.3} />
    )}
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
