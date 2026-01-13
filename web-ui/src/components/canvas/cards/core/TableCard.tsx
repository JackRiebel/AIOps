'use client';

import { memo, useState } from 'react';
import { StatusIndicator } from '@/components/common/StatusIndicator';
import { DeviceTypeIcon } from '@/components/common/DeviceTypeIcon';
import {
  MAX_DISPLAY_ROWS,
  formatCellValue,
  extractStatus,
  getActionsForDevice,
  executeQuickAction,
} from './utils';
import { EmptyState } from './EmptyState';

// Action button configuration
const ACTION_BUTTON_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  hoverClass: string;
}> = {
  ping: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>,
    label: 'Ping',
    hoverClass: 'hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400',
  },
  traceroute: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    label: 'Traceroute',
    hoverClass: 'hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-600 dark:hover:text-purple-400',
  },
  'blink-led': {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    label: 'Blink LED',
    hoverClass: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/40 hover:text-yellow-600 dark:hover:text-yellow-400',
  },
  'cycle-port': {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    label: 'Cycle Port',
    hoverClass: 'hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:text-orange-600 dark:hover:text-orange-400',
  },
};

interface TableCardProps {
  data: unknown[];
}

export const TableCard = memo(({ data }: TableCardProps) => {
  const [actionStates, setActionStates] = useState<Record<string, { loading: boolean; result?: string; message?: string }>>({});

  // Validate data is a non-empty array with valid first element
  if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0] !== 'object') {
    return <EmptyState message="No data" />;
  }

  const typedData = data as Record<string, unknown>[];

  // Check if this is a device table (has serial column)
  const allColumns = Object.keys(typedData[0]);
  const serialCol = allColumns.find(c => c.toLowerCase() === 'serial');
  const modelCol = allColumns.find(c => c.toLowerCase() === 'model');
  const isDeviceTable = !!(serialCol || modelCol);

  // Get columns, prioritize important ones
  const priorityColumns = ['name', 'Name', 'serial', 'Serial', 'model', 'Model', 'status', 'Status', 'mac', 'MAC', 'networkId'];
  // For device tables, limit to 4 columns to make room for actions
  const maxColumns = isDeviceTable ? 4 : 5;
  const sortedColumns = [
    ...priorityColumns.filter(c => allColumns.includes(c)),
    ...allColumns.filter(c => !priorityColumns.includes(c)),
  ].slice(0, maxColumns);

  // Detect special columns for enhanced rendering
  const statusCol = sortedColumns.find(c => c.toLowerCase() === 'status' || c.toLowerCase() === 'devicestatus');
  const typeCol = sortedColumns.find(c => ['model', 'type', 'producttype'].includes(c.toLowerCase()));

  // Limit displayed rows for performance
  const displayedData = typedData.slice(0, MAX_DISPLAY_ROWS);
  const hasMore = typedData.length > MAX_DISPLAY_ROWS;

  // Handle quick action click
  const handleAction = async (actionType: string, row: Record<string, unknown>) => {
    const serial = (row.serial || row.Serial) as string;
    if (!serial) return;

    const key = `${serial}-${actionType}`;
    setActionStates(prev => ({ ...prev, [key]: { loading: true } }));

    const result = await executeQuickAction(actionType, serial);

    setActionStates(prev => ({
      ...prev,
      [key]: {
        loading: false,
        result: result.success ? '✓' : '✗',
        message: result.message
      }
    }));

    // Clear result after delay
    setTimeout(() => {
      setActionStates(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }, result.success ? 2000 : 3000);
  };

  // Calculate column widths
  const actionColWidth = isDeviceTable ? 15 : 0;
  const dataColWidth = (100 - actionColWidth) / sortedColumns.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with count badge */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isDeviceTable ? 'Devices' : 'Data Table'}
        </span>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
          {typedData.length} {typedData.length === 1 ? 'row' : 'rows'}
        </span>
      </div>

      {/* Column Headers */}
      <div className="flex bg-slate-100 dark:bg-slate-700 border-b-2 border-slate-300 dark:border-slate-600">
        {sortedColumns.map((col) => (
          <div
            key={col}
            style={{ width: `${dataColWidth}%` }}
            className="px-3 py-2.5 text-left font-bold text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-wider"
          >
            {col.replace(/_/g, ' ')}
          </div>
        ))}
        {isDeviceTable && (
          <div
            style={{ width: `${actionColWidth}%` }}
            className="px-2 py-2.5 text-center font-bold text-slate-600 dark:text-slate-300 text-[10px] uppercase tracking-wider"
          >
            Actions
          </div>
        )}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {displayedData.map((row, i) => {
          const serial = (row.serial || row.Serial || '') as string;

          return (
            <div
              key={i}
              className={`
                flex items-center group transition-colors cursor-pointer border-l-2 border-transparent
                hover:border-l-cyan-500 hover:bg-cyan-50/60 dark:hover:bg-cyan-900/20
                ${i % 2 === 0 ? 'bg-white dark:bg-slate-800/30' : 'bg-slate-50/50 dark:bg-slate-800/60'}
              `}
            >
              {sortedColumns.map((col) => {
                const value = row[col];
                const isStatus = col === statusCol;
                const isType = col === typeCol;

                return (
                  <div
                    key={col}
                    style={{ width: `${dataColWidth}%` }}
                    className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50"
                  >
                    {isStatus ? (
                      <StatusIndicator status={extractStatus(row)} size="sm" />
                    ) : isType ? (
                      <div className="flex items-center gap-2">
                        <DeviceTypeIcon type={String(value)} className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="truncate max-w-[80px] font-medium">{formatCellValue(value)}</span>
                      </div>
                    ) : (
                      <span className="truncate block max-w-[120px]" title={String(value)}>
                        {formatCellValue(value)}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Quick Actions Column for Device Tables */}
              {isDeviceTable && serial && (() => {
                const model = (row.model || row.Model) as string | undefined;
                const availableActions = getActionsForDevice(model);

                return (
                  <div
                    style={{ width: `${actionColWidth}%` }}
                    className="px-1 py-1.5 flex items-center justify-center gap-1 border-b border-slate-100 dark:border-slate-700/50"
                  >
                    {availableActions.map((actionType) => {
                      const config = ACTION_BUTTON_CONFIG[actionType];
                      if (!config) return null;

                      const key = `${serial}-${actionType}`;
                      const state = actionStates[key];

                      return (
                        <button
                          key={actionType}
                          onClick={(e) => { e.stopPropagation(); handleAction(actionType, row); }}
                          disabled={state?.loading}
                          title={state?.message || config.label}
                          className={`p-1.5 rounded text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50 ${config.hoverClass}`}
                        >
                          {state?.loading ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : state?.result ? (
                            <span className={`text-xs font-bold ${state.result === '✓' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {state.result}
                            </span>
                          ) : (
                            config.icon
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Footer with pagination info */}
      {hasMore && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{displayedData.length}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{typedData.length}</span> rows
          </span>
        </div>
      )}
    </div>
  );
});

TableCard.displayName = 'TableCard';

export default TableCard;
