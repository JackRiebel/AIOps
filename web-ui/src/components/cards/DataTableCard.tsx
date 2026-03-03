'use client';

/**
 * DataTableCard component for displaying tabular data.
 *
 * Used in dashboards and Canvas artifact renderers to show
 * lists, tables, and structured data within a card container.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { cn } from '@/lib/utils';

export interface Column<T> {
  /** Unique key for the column (must match a property in the data) */
  key: keyof T | string;
  /** Header text to display */
  header: string;
  /** Custom render function for cell content */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Additional CSS classes for the column */
  className?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether the column is sortable */
  sortable?: boolean;
}

export interface DataTableCardProps<T extends Record<string, unknown>> {
  /** Title for the card */
  title: string;
  /** Optional description */
  description?: string;
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Maximum number of rows to display */
  maxRows?: number;
  /** Click handler for rows */
  onRowClick?: (row: T) => void;
  /** Optional header actions */
  actions?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Unique key function for rows */
  getRowKey?: (row: T, index: number) => string | number;
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

/**
 * DataTableCard displays tabular data within a card container.
 *
 * @example
 * <DataTableCard
 *   title="Network Devices"
 *   columns={[
 *     { key: 'name', header: 'Name' },
 *     { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
 *     { key: 'lanIp', header: 'IP Address' }
 *   ]}
 *   data={devices}
 *   onRowClick={(device) => navigate(`/devices/${device.id}`)}
 * />
 */
export function DataTableCard<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  data,
  emptyMessage = 'No data available',
  maxRows,
  onRowClick,
  actions,
  className,
  loading = false,
  getRowKey,
}: DataTableCardProps<T>) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;
  const hasMore = maxRows && data.length > maxRows;

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)} padding="none">
        <CardHeader className="px-6 pt-6">
          <div className="h-6 w-32 bg-gray-200 rounded" />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="space-y-3 px-6 pb-6">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} padding="none">
      <CardHeader className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y border-gray-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      'px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right',
                      col.align !== 'center' && col.align !== 'right' && 'text-left'
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {displayData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((row, idx) => (
                  <tr
                    key={getRowKey ? getRowKey(row, idx) : idx}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-gray-50 transition-colors'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => {
                      const value = getNestedValue(row, String(col.key));
                      return (
                        <td
                          key={String(col.key)}
                          className={cn(
                            'px-6 py-4 text-sm text-gray-900',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right',
                            col.className
                          )}
                        >
                          {col.render
                            ? col.render(value, row)
                            : String(value ?? '-')}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="px-6 py-3 text-center text-sm text-gray-500 bg-gray-50 border-t">
            Showing {maxRows} of {data.length} items
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataTableCard;
