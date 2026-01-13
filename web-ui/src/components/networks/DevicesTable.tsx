'use client';

import { memo } from 'react';
import { Server, Settings, RotateCw, Trash2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard';
import { Pagination } from './Pagination';
import type { Device } from './types';
import { getStatusDot, getStatusBadge } from './types';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// DevicesTable Component
// ============================================================================

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
  return (
    <DashboardCard
      title="Devices"
      icon={<Server className="w-4 h-4" />}
      accent="green"
      loading={loading}
      className={className}
    >
      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Serial
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Network
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                IP
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {devices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                      <Server className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      No devices found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              devices.map(device => (
                <tr
                  key={device.serial}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {device.name || 'Unnamed'}
                      </div>
                      {device.mac && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5">
                          {device.mac}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {device.model}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {device.serial}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {device.organizationDisplayName}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[150px] truncate">
                    {device.networkName || device.networkId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(device.status)}`} />
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(device.status)}`}>
                        {device.status?.charAt(0).toUpperCase() + device.status?.slice(1).toLowerCase() || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {device.lanIp || device.publicIp || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onConfigure(device)}
                        className="p-1.5 bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 rounded-lg transition-colors"
                        title="Configure"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onReboot(device)}
                        className="p-1.5 bg-amber-100 dark:bg-amber-600/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-600/30 border border-amber-200 dark:border-amber-500/30 rounded-lg transition-colors"
                        title="Reboot"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemove(device)}
                        className="p-1.5 bg-red-100 dark:bg-red-600/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-600/30 border border-red-200 dark:border-red-500/30 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {devices.length > 0 && (
        <div className="-mx-4 -mb-4 mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalDevices}
            filteredItems={filteredCount}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </DashboardCard>
  );
});

DevicesTable.displayName = 'DevicesTable';

export default DevicesTable;
