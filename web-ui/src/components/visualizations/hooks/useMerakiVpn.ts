'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { OrgNetworkNode, OrgVpnEdge } from '@/types/visualization';
import type { NetworkPlatformOrg } from '@/types';

export interface VpnSummary {
  totalNetworks: number;
  hubCount: number;
  spokeCount: number;
  standaloneCount: number;
  totalVpnTunnels: number;
}

export interface UseMerakiVpnParams {
  selectedOrg: string;
  organizations: NetworkPlatformOrg[];
}

export interface UseMerakiVpnReturn {
  vpnNodes: OrgNetworkNode[];
  vpnEdges: OrgVpnEdge[];
  vpnSummary: VpnSummary | null;
  fetchVpnTopology: () => Promise<void>;
}

export function useMerakiVpn({ selectedOrg, organizations }: UseMerakiVpnParams): UseMerakiVpnReturn {
  const [vpnNodes, setVpnNodes] = useState<OrgNetworkNode[]>([]);
  const [vpnEdges, setVpnEdges] = useState<OrgVpnEdge[]>([]);
  const [vpnSummary, setVpnSummary] = useState<VpnSummary | null>(null);

  const fetchVpnTopology = useCallback(async () => {
    if (!selectedOrg) return;
    try {
      const org = organizations.find(o => o.name === selectedOrg);
      const orgId = String(org?.id || selectedOrg);
      const data = await apiClient.getOrgVpnTopology(selectedOrg, orgId);
      setVpnNodes(data.nodes || []);
      setVpnEdges(data.edges || []);
      setVpnSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch VPN topology:', err);
    }
  }, [selectedOrg, organizations]);

  return {
    vpnNodes,
    vpnEdges,
    vpnSummary,
    fetchVpnTopology,
  };
}
