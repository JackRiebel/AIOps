'use client';

import React, { useState, useMemo } from 'react';
import { StatusLevel } from './StatusIndicator';

export interface Column<T = Record<string, unknown>> {
  key: keyof T | string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  maxRows?: number;
  sortable?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG = {
  sm: { cell: 'px-2 py-1 text-xs', header: 'px-2 py-1.5 text-xs' },
  md: { cell: 'px-3 py-2 text-sm', header: 'px-3 py-2 text-sm' },
  lg: { cell: 'px-4 py-3 text-base', header: 'px-4 py-3 text-base' },
};

export function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  maxRows,
  sortable = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data available',
  size = 'md',
}: DataTableProps<T>) {
  const config = SIZE_CONFIG[size];
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (search && searchable) {
      const searchLower = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col.key as keyof T];
          return String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply sorting
    if (sortKey && sortable) {
      result.sort((a, b) => {
        const aVal = a[sortKey as keyof T];
        const bVal = b[sortKey as keyof T];
        const comparison =
          typeof aVal === 'number' && typeof bVal === 'number'
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }

    // Apply max rows limit
    if (maxRows && result.length > maxRows) {
      result = result.slice(0, maxRows);
    }

    return result;
  }, [data, search, sortKey, sortDir, columns, maxRows, searchable, sortable]);

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const getValue = (row: T, key: string): unknown => {
    return row[key as keyof T];
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Search */}
      {searchable && (
        <div className="mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`${config.header} font-medium text-gray-600 dark:text-gray-400
                             ${sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                             text-${col.align || 'left'}`}
                  style={{ width: col.width }}
                  onClick={() => handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortable && sortKey === col.key && (
                      <span className="text-xs">
                        {sortDir === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`${config.cell} text-center text-gray-500 dark:text-gray-400`}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-gray-100 dark:border-gray-700/50
                             hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`${config.cell} text-gray-900 dark:text-gray-100
                                 text-${col.align || 'left'}`}
                    >
                      {col.render
                        ? col.render(getValue(row, String(col.key)), row)
                        : String(getValue(row, String(col.key)) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Truncation indicator */}
      {maxRows && data.length > maxRows && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          Showing {filteredData.length} of {data.length} items
        </div>
      )}
    </div>
  );
}

export default DataTable;
