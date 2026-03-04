'use client';

import { memo } from 'react';
import { Building2, Network, Server, ChevronRight } from 'lucide-react';
import type { OrgStats } from './types';
import { getPlatformColor } from './types';

export interface OrganizationsTableProps {
  organizations: OrgStats[];
  onNavigateToNetworks: (orgName: string) => void;
  onNavigateToDevices: (orgName: string) => void;
  loading?: boolean;
  className?: string;
}

export const OrganizationsTable = memo(({
  organizations,
  onNavigateToNetworks,
  onNavigateToDevices,
  loading,
  className = '',
}: OrganizationsTableProps) => {
  if (loading) {
    return (
      <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/40">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
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
                Organization
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Networks
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Devices
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Online
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Health
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 mb-3 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-2xl flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      No organizations found
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Configure organizations in Settings to view data
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              organizations.map(org => {
                const healthPct = org.deviceCount > 0 ? Math.round((org.onlineCount / org.deviceCount) * 100) : 0;
                const healthColor = healthPct >= 90 ? 'bg-emerald-500' : healthPct >= 70 ? 'bg-amber-500' : 'bg-red-500';
                const healthText = healthPct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : healthPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                const platform = getPlatformColor(org.type);

                return (
                  <tr
                    key={org.name}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg ${platform.bg} border ${platform.border} flex items-center justify-center shrink-0`}>
                          <Building2 className={`w-4 h-4 ${platform.text}`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {org.displayName}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                            {org.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${platform.bg} ${platform.text} ${platform.border}`}>
                        {org.type === 'catalyst' ? 'Catalyst' : 'Meraki'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Network className="w-3.5 h-3.5 text-slate-400" />
                        {org.networkCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        {org.deviceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{org.onlineCount}</span>
                      <span className="text-sm text-slate-400 dark:text-slate-500"> / {org.deviceCount}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${healthColor}`}
                            style={{ width: `${healthPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${healthText}`}>{healthPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onNavigateToNetworks(org.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all"
                        >
                          Networks
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onNavigateToDevices(org.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-all"
                        >
                          Devices
                          <ChevronRight className="w-3 h-3" />
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
    </div>
  );
});

OrganizationsTable.displayName = 'OrganizationsTable';

export default OrganizationsTable;
