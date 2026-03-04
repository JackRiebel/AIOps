// Types for Networks & Devices page

export interface Network {
  id: string;
  name: string;
  organizationId: string;
  productTypes: string[];
  timeZone: string;
  tags: string[];
  url: string;
}

export interface Device {
  serial: string;
  name: string;
  model: string;
  networkId: string;
  networkName?: string;
  organizationName?: string;
  organizationDisplayName?: string;
  status: string;
  lanIp?: string;
  publicIp?: string;
  mac?: string;
  firmware?: string;
}

export interface NetworkWithMeta extends Network {
  devices: Device[];
  organizationName: string;
  organizationDisplayName: string;
  organizationType: 'meraki' | 'catalyst';
}

export interface OrgStats {
  name: string;
  displayName: string;
  type: 'meraki' | 'catalyst';
  networkCount: number;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
}

export type TabType = 'overview' | 'organizations' | 'networks' | 'devices';

export interface TotalStats {
  organizations: number;
  networks: number;
  devices: number;
  online: number;
}

// Status helper functions
export function getStatusColor(status: string): {
  dot: string;
  bg: string;
  text: string;
  border: string;
  ring: string;
} {
  switch (status?.toLowerCase()) {
    case 'online':
      return {
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-500/20',
        ring: 'ring-emerald-500/20',
      };
    case 'offline':
      return {
        dot: 'bg-red-500',
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-500/20',
        ring: 'ring-red-500/20',
      };
    case 'alerting':
      return {
        dot: 'bg-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-500/20',
        ring: 'ring-amber-500/20',
      };
    default:
      return {
        dot: 'bg-slate-400',
        bg: 'bg-slate-50 dark:bg-slate-500/10',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-500/20',
        ring: 'ring-slate-500/20',
      };
  }
}

export function getPlatformColor(type: 'meraki' | 'catalyst'): {
  bg: string;
  text: string;
  border: string;
  accent: string;
} {
  return type === 'meraki'
    ? {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200/60 dark:border-emerald-500/20',
        accent: 'from-emerald-500 to-green-500',
      }
    : {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200/60 dark:border-blue-500/20',
        accent: 'from-blue-500 to-indigo-500',
      };
}

// Legacy compatibility
export function getStatusDot(status: string): string {
  return getStatusColor(status).dot;
}

export function getStatusBadge(status: string): string {
  const c = getStatusColor(status);
  return `${c.bg} ${c.text} ${c.border}`;
}

export function getTypeBadge(type: 'meraki' | 'catalyst'): string {
  const c = getPlatformColor(type);
  return `${c.bg} ${c.text} ${c.border}`;
}
