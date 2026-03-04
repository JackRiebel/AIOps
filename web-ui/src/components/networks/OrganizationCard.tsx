'use client';

import { memo } from 'react';
import { Building2, Server, Wifi, ChevronRight, ShieldCheck } from 'lucide-react';
import type { OrgStats } from './types';
import { getPlatformColor } from './types';

export interface OrganizationCardProps {
  org: OrgStats;
  onNavigate: (orgName: string) => void;
}

export interface OrganizationsGridProps {
  organizations: OrgStats[];
  onNavigateToDevices: (orgName: string) => void;
  loading?: boolean;
  className?: string;
}

export const OrganizationCard = memo(({ org, onNavigate }: OrganizationCardProps) => {
  const healthPct = org.deviceCount > 0 ? Math.round((org.onlineCount / org.deviceCount) * 100) : 0;
  const healthColor = healthPct >= 90 ? 'bg-emerald-500' : healthPct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  const healthTextColor = healthPct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : healthPct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const platform = getPlatformColor(org.type);

  return (
    <div
      onClick={() => onNavigate(org.name)}
      className="relative bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer group"
    >
      {/* Top accent bar */}
      <div className={`h-1 bg-gradient-to-r ${platform.accent}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg ${platform.bg} border ${platform.border} flex items-center justify-center shrink-0`}>
              <Building2 className={`w-4.5 h-4.5 ${platform.text}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                {org.displayName}
              </h3>
              <span className={`text-[10px] font-medium ${platform.text}`}>
                {org.type === 'catalyst' ? 'Catalyst Center' : 'Meraki'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-slate-50/80 dark:bg-slate-900/30 rounded-lg">
            <Wifi className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
            <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{org.networkCount}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-medium">Networks</p>
          </div>
          <div className="text-center p-2 bg-slate-50/80 dark:bg-slate-900/30 rounded-lg">
            <Server className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
            <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{org.deviceCount}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-medium">Devices</p>
          </div>
          <div className="text-center p-2 bg-slate-50/80 dark:bg-slate-900/30 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-1" />
            <p className={`text-base font-bold tabular-nums ${healthTextColor}`}>{healthPct}%</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-medium">Health</p>
          </div>
        </div>

        {/* Health Bar */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${healthColor}`}
              style={{ width: `${healthPct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {org.onlineCount}/{org.deviceCount} online
          </span>
        </div>
      </div>
    </div>
  );
});

OrganizationCard.displayName = 'OrganizationCard';

export const OrganizationsGrid = memo(({
  organizations,
  onNavigateToDevices,
  loading,
  className = '',
}: OrganizationsGridProps) => {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden">
            <div className="h-1 bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-16 bg-slate-100 dark:bg-slate-900/30 rounded-lg animate-pulse" style={{ animationDelay: `${j * 100}ms` }} />
                ))}
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 ${className}`}>
        <div className="w-16 h-16 mb-4 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-2xl flex items-center justify-center">
          <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
          No organizations found
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-[300px]">
          Configure Meraki or Catalyst organizations in Settings to view networks and devices
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 ${className}`}>
      {organizations.map(org => (
        <OrganizationCard
          key={org.name}
          org={org}
          onNavigate={onNavigateToDevices}
        />
      ))}
    </div>
  );
});

OrganizationsGrid.displayName = 'OrganizationsGrid';

export default OrganizationCard;
