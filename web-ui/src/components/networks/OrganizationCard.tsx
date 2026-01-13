'use client';

import { memo } from 'react';
import { Building2, Server, Wifi, CheckCircle2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard';
import type { OrgStats } from './types';
import { getTypeBadge } from './types';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// OrganizationCard Component
// ============================================================================

export const OrganizationCard = memo(({ org, onNavigate }: OrganizationCardProps) => {
  const healthPct = org.deviceCount > 0 ? Math.round((org.onlineCount / org.deviceCount) * 100) : 0;
  const healthColor = healthPct >= 90 ? 'bg-green-500' : healthPct >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div
      onClick={() => onNavigate(org.name)}
      className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50">
            <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {org.displayName}
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getTypeBadge(org.type)}`}>
          {org.type === 'catalyst' ? 'Catalyst' : 'Meraki'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Wifi className="w-3 h-3 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{org.networkCount}</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase">Networks</p>
        </div>
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Server className="w-3 h-3 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{org.deviceCount}</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase">Devices</p>
        </div>
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{org.onlineCount}</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-500 uppercase">Online</p>
        </div>
      </div>

      {/* Health Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${healthColor}`}
            style={{ width: `${healthPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          {healthPct}%
        </span>
      </div>
    </div>
  );
});

OrganizationCard.displayName = 'OrganizationCard';

// ============================================================================
// OrganizationsGrid Component
// ============================================================================

export const OrganizationsGrid = memo(({
  organizations,
  onNavigateToDevices,
  loading,
  className = '',
}: OrganizationsGridProps) => {
  if (loading) {
    return (
      <DashboardCard
        title="Organizations"
        icon={<Building2 className="w-4 h-4" />}
        accent="blue"
        loading={true}
        className={className}
      >
        <div className="h-48" />
      </DashboardCard>
    );
  }

  if (organizations.length === 0) {
    return (
      <DashboardCard
        title="Organizations"
        icon={<Building2 className="w-4 h-4" />}
        accent="blue"
        className={className}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-14 h-14 mb-4 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
            <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
            No organizations found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Configure organizations to view networks and devices
          </p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map(org => (
          <OrganizationCard
            key={org.name}
            org={org}
            onNavigate={onNavigateToDevices}
          />
        ))}
      </div>
    </div>
  );
});

OrganizationsGrid.displayName = 'OrganizationsGrid';

export default OrganizationCard;
