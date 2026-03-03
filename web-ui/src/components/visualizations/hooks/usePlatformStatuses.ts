'use client';

import { useMemo } from 'react';
import type { TopologyNode, PlatformStatus } from '@/types/visualization';
import type { NetworkPlatformOrg } from '@/types';
import type { Agent } from '@/components/thousandeyes/types';

export interface UsePlatformStatusesParams {
  organizations: NetworkPlatformOrg[];
  topologyNodes: TopologyNode[];
  teAgents: Agent[];
  teIsConfigured: boolean;
  teHealthScore: number;
  splunkIsConfigured: boolean;
  splunkError: string | null;
  splunkIndexCount: number;
}

export interface UsePlatformStatusesReturn {
  platformStatuses: PlatformStatus[];
}

export function usePlatformStatuses({
  organizations,
  topologyNodes,
  teAgents,
  teIsConfigured,
  teHealthScore,
  splunkIsConfigured,
  splunkError,
  splunkIndexCount,
}: UsePlatformStatusesParams): UsePlatformStatusesReturn {
  const platformStatuses = useMemo((): PlatformStatus[] => {
    const statuses: PlatformStatus[] = [];

    // Meraki
    const merakiDevices = topologyNodes.filter(n => !n.isClient);
    const merakiOnline = merakiDevices.filter(n => n.status === 'online').length;
    statuses.push({
      platform: 'meraki',
      configured: organizations.length > 0,
      healthy: merakiDevices.length === 0 || (merakiOnline / merakiDevices.length) >= 0.9,
      deviceCount: merakiDevices.length,
      onlinePercent: merakiDevices.length > 0 ? Math.round((merakiOnline / merakiDevices.length) * 100) : 0,
    });

    // ThousandEyes
    const teOnline = teAgents.filter(a => a.agentState?.toLowerCase() === 'online').length;
    statuses.push({
      platform: 'thousandeyes',
      configured: teIsConfigured,
      healthy: teHealthScore >= 80,
      deviceCount: teAgents.length,
      onlinePercent: teAgents.length > 0 ? Math.round((teOnline / teAgents.length) * 100) : 0,
    });

    // Catalyst
    statuses.push({
      platform: 'catalyst',
      configured: false,
      healthy: false,
      deviceCount: 0,
      onlinePercent: 0,
    });

    // Splunk
    statuses.push({
      platform: 'splunk',
      configured: splunkIsConfigured,
      healthy: !splunkError,
      deviceCount: splunkIndexCount,
      onlinePercent: splunkIsConfigured ? 100 : 0,
    });

    return statuses;
  }, [organizations, topologyNodes, teAgents, teIsConfigured, teHealthScore, splunkIsConfigured, splunkError, splunkIndexCount]);

  return { platformStatuses };
}
