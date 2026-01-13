'use client';

import { memo } from 'react';
import { Building2, Network, Server, ExternalLink } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard';
import type { OrgStats } from './types';
import { getTypeBadge } from './types';

// ============================================================================
// Types
// ============================================================================

export interface OrganizationsTableProps {
  organizations: OrgStats[];
  onNavigateToNetworks: (orgName: string) => void;
  onNavigateToDevices: (orgName: string) => void;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// OrganizationsTable Component
// ============================================================================

export const OrganizationsTable = memo(({
  organizations,
  onNavigateToNetworks,
  onNavigateToDevices,
  loading,
  className = '',
}: OrganizationsTableProps) => {
  return (
    <DashboardCard
      title="All Organizations"
      icon={<Building2 className="w-4 h-4" />}
      accent="blue"
      loading={loading}
      className={className}
    >
      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Networks
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Devices
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Online
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Health
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-3 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      No organizations found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure organizations to view data
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              organizations.map(org => {
                const healthPct = org.deviceCount > 0 ? Math.round((org.onlineCount / org.deviceCount) * 100) : 0;
                const healthColor = healthPct >= 80 ? 'bg-green-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500';

                return (
                  <tr
                    key={org.name}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {org.displayName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                          {org.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getTypeBadge(org.type)}`}>
                        {org.type === 'catalyst' ? 'Catalyst' : 'Meraki'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                        <Network className="w-3.5 h-3.5 text-slate-400" />
                        {org.networkCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        {org.deviceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">{org.onlineCount}</span>
                      <span className="text-sm text-slate-400 dark:text-slate-500"> / {org.deviceCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${healthColor}`}
                            style={{ width: `${healthPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{healthPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onNavigateToNetworks(org.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/50 rounded-lg text-xs font-medium transition-colors"
                        >
                          Networks
                        </button>
                        <button
                          onClick={() => onNavigateToDevices(org.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-100 dark:bg-cyan-600/20 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-600/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          Devices
                          <ExternalLink className="w-3 h-3" />
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
    </DashboardCard>
  );
});

OrganizationsTable.displayName = 'OrganizationsTable';

export default OrganizationsTable;
