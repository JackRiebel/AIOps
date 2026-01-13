'use client';

import { memo, useState, useCallback } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'csv' | 'json';

export interface ExportButtonProps {
  /** Data to export */
  data: Record<string, unknown>[];
  /** Filename without extension */
  filename: string;
  /** Available export formats */
  formats?: ExportFormat[];
  /** Columns to include (if not specified, all keys from first object) */
  columns?: { key: string; label: string }[];
  /** Custom formatter for values */
  formatValue?: (key: string, value: unknown) => string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeCSVValue(value: string): string {
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDefaultValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function generateCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  formatValue?: (key: string, value: unknown) => string
): string {
  // Header row
  const header = columns.map(col => escapeCSVValue(col.label)).join(',');

  // Data rows
  const rows = data.map(row =>
    columns
      .map(col => {
        const value = row[col.key];
        const formatted = formatValue
          ? formatValue(col.key, value)
          : formatDefaultValue(value);
        return escapeCSVValue(formatted);
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// ExportButton Component
// ============================================================================

export const ExportButton = memo(({
  data,
  filename,
  formats = ['csv'],
  columns,
  formatValue,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  className = '',
}: ExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Derive columns from first data item if not provided
  const exportColumns = columns || (data.length > 0
    ? Object.keys(data[0]).map(key => ({ key, label: key }))
    : []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    setShowMenu(false);

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      const timestamp = new Date().toISOString().split('T')[0];
      const fullFilename = `${filename}_${timestamp}`;

      switch (format) {
        case 'csv': {
          const csv = generateCSV(data, exportColumns, formatValue);
          downloadFile(csv, `${fullFilename}.csv`, 'text/csv;charset=utf-8');
          break;
        }
        case 'json': {
          const json = JSON.stringify(data, null, 2);
          downloadFile(json, `${fullFilename}.json`, 'application/json');
          break;
        }
      }
    } finally {
      setIsExporting(false);
    }
  }, [data, filename, exportColumns, formatValue]);

  const variantClasses = {
    primary: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-500/25',
    secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Single format - direct export
  if (formats.length === 1) {
    const format = formats[0];
    const Icon = format === 'csv' ? FileSpreadsheet : FileText;

    return (
      <button
        onClick={() => handleExport(format)}
        disabled={disabled || isExporting || data.length === 0}
        aria-label={`Export data as ${format.toUpperCase()}`}
        aria-busy={isExporting}
        className={`
          inline-flex items-center font-medium rounded-lg transition-all
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isExporting ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} aria-hidden="true" />
        ) : (
          <Icon className={iconSizes[size]} aria-hidden="true" />
        )}
        Export {format.toUpperCase()}
      </button>
    );
  }

  // Multiple formats - dropdown menu
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || isExporting || data.length === 0}
        aria-label="Export data"
        aria-expanded={showMenu}
        aria-haspopup="menu"
        aria-busy={isExporting}
        className={`
          inline-flex items-center font-medium rounded-lg transition-all
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isExporting ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} aria-hidden="true" />
        ) : (
          <Download className={iconSizes[size]} aria-hidden="true" />
        )}
        Export
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50"
            role="menu"
            aria-label="Export format options"
          >
            {formats.map(format => {
              const Icon = format === 'csv' ? FileSpreadsheet : FileText;
              return (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  Export as {format.toUpperCase()}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

ExportButton.displayName = 'ExportButton';

export default ExportButton;
