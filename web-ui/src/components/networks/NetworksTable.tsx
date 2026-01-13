'use client';

import { memo } from 'react';
import { Network, ExternalLink, Server } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard';
import { Pagination } from './Pagination';
import type { NetworkWithMeta } from './types';
import { getTypeBadge } from './types';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// NetworksTable Component
// ============================================================================

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
  return (
    <DashboardCard
      title="Networks"
      icon={<Network className="w-4 h-4" />}
      accent="cyan"
      loading={loading}
      className={className}
    >
      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Network
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Products
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Devices
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Timezone
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {networks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
                      <Network className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      No networks found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              networks.map(net => (
                <tr
                  key={net.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {net.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5">
                        {net.id}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {net.organizationDisplayName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getTypeBadge(net.organizationType)}`}>
                      {net.organizationType === 'catalyst' ? 'Catalyst' : 'Meraki'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {net.productTypes?.slice(0, 3).map(pt => (
                        <span
                          key={pt}
                          className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded text-[10px]"
                        >
                          {pt}
                        </span>
                      ))}
                      {(net.productTypes?.length || 0) > 3 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          +{net.productTypes.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded text-xs font-medium">
                      <Server className="w-3 h-3" />
                      {net.devices.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-500">
                    {net.timeZone}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onViewDevices(net.organizationName, net.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 dark:bg-cyan-600/20 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-600/30 border border-cyan-200 dark:border-cyan-500/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      View Devices
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {networks.length > 0 && (
        <div className="-mx-4 -mb-4 mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalNetworks}
            filteredItems={networks.length}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </DashboardCard>
  );
});

NetworksTable.displayName = 'NetworksTable';

export default NetworksTable;
