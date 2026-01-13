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
export function getStatusDot(status: string): string {
  switch (status?.toLowerCase()) {
    case 'online': return 'bg-green-500';
    case 'offline': return 'bg-red-500';
    default: return 'bg-yellow-500';
  }
}

export function getStatusBadge(status: string): string {
  switch (status?.toLowerCase()) {
    case 'online': return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20';
    case 'offline': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
    default: return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20';
  }
}

export function getTypeBadge(type: 'meraki' | 'catalyst'): string {
  return type === 'meraki'
    ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20'
    : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
}
