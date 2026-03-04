'use client';

import { memo } from 'react';
import { Network, Server, ChevronRight, Globe } from 'lucide-react';
import { Pagination } from './Pagination';
import type { NetworkWithMeta } from './types';
import { getPlatformColor } from './types';

export interface NetworksTableProps {
  networks: NetworkWithMeta[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalNetworks: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewDevices: (orgName: string, networkId: string) => void;
  loading?: boolean;
  className?: string;
}

export const NetworksTable = memo(({
  networks,
  currentPage,
  totalPages,
  pageSize,
  totalNetworks,
  onPageChange,
  onPageSizeChange,
  onViewDevices,
  loading,
  className = '',
}: NetworksTableProps) => {
  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/40 rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/20">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Network
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Products
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Devices
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Timezone
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {networks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 mb-3 bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-500/10 dark:to-blue-500/10 rounded-2xl flex items-center justify-center">
                      <Network className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      No networks found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              networks.map(net => {
                const platform = getPlatformColor(net.organizationType);
                const onlineCount = net.devices.filter(d => d.status?.toLowerCase() === 'online').length;
                const healthPct = net.devices.length > 0 ? Math.round((onlineCount / net.devices.length) * 100) : 0;

                return (
                  <tr
                    key={net.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {net.name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          {net.id}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                      {net.organizationDisplayName}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${platform.bg} ${platform.text} ${platform.border}`}>
                        {net.organizationType === 'catalyst' ? 'Catalyst' : 'Meraki'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {net.productTypes?.slice(0, 3).map(pt => (
                          <span
                            key={pt}
                            className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded text-[10px] font-medium"
                          >
                            {pt}
                          </span>
                        ))}
                        {(net.productTypes?.length || 0) > 3 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            +{net.productTypes.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{net.devices.length}</span>
                        {net.devices.length > 0 && (
                          <span className={`text-[10px] font-medium ${healthPct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : healthPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            ({healthPct}%)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
                        <Globe className="w-3 h-3" />
                        {net.timeZone?.split('/').pop()?.replace('_', ' ') || net.timeZone}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => onViewDevices(net.organizationName, net.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        View Devices
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {networks.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalNetworks}
          filteredItems={networks.length}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
});

NetworksTable.displayName = 'NetworksTable';

export default NetworksTable;
