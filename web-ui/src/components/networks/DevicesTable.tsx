'use client';

import { memo } from 'react';
import { Server, Settings, RotateCw, Trash2, MoreHorizontal } from 'lucide-react';
import { Pagination } from './Pagination';
import type { Device } from './types';
import { getStatusColor } from './types';

export interface DevicesTableProps {
  devices: Device[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalDevices: number;
  filteredCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onConfigure: (device: Device) => void;
  onReboot: (device: Device) => void;
  onRemove: (device: Device) => void;
  loading?: boolean;
  className?: string;
}

export const DevicesTable = memo(({
  devices,
  currentPage,
  totalPages,
  pageSize,
  totalDevices,
  filteredCount,
  onPageChange,
  onPageSizeChange,
  onConfigure,
  onReboot,
  onRemove,
  loading,
  className = '',
}: DevicesTableProps) => {
  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/40 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/20">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Serial
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Network
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                IP Address
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {devices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 mb-3 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-500/10 dark:to-green-500/10 rounded-2xl flex items-center justify-center">
                      <Server className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      No devices found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              devices.map(device => {
                const status = getStatusColor(device.status);

                return (
                  <tr
                    key={device.serial}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${status.dot} shrink-0 ring-2 ${status.ring}`} />
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {device.name || 'Unnamed Device'}
                          </div>
                          {device.mac && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                              {device.mac}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{device.model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{device.serial}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{device.organizationDisplayName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate block">
                        {device.networkName || device.networkId}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {device.status?.charAt(0).toUpperCase() + device.status?.slice(1).toLowerCase() || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {device.lanIp || device.publicIp || '\u2014'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onConfigure(device)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                          title="Configure"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onReboot(device)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all"
                          title="Reboot"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(device)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {devices.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalDevices}
          filteredItems={filteredCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
});

DevicesTable.displayName = 'DevicesTable';

export default DevicesTable;
