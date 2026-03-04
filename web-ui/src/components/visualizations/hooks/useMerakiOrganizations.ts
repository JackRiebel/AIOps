'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { NetworkPlatformOrg } from '@/types';

interface Network {
  id: string;
  name: string;
  organizationId?: string;
  productTypes?: string[];
  timeZone?: string;
}

export interface UseMerakiOrganizationsReturn {
  organizations: NetworkPlatformOrg[];
  networks: Network[];
  selectedOrg: string;
  selectedNetwork: string;
  loading: boolean;
  error: string | null;
  setSelectedOrg: (org: string) => void;
  setSelectedNetwork: (net: string) => void;
  clearError: () => void;
  retryFetch: () => void;
}

export function useMerakiOrganizations(): UseMerakiOrganizationsReturn {
  const [organizations, setOrganizations] = useState<NetworkPlatformOrg[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orgFetchedRef = useRef(false);

  const fetchOrgs = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const orgs = await apiClient.getNetworkPlatformOrgs();
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].name);
      }
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      const msg = err?.message || '';
      if (msg.includes('Session expired') || msg.includes('401')) {
        // Auth issue — AuthContext handles redirect
      } else {
        setError('Failed to load organizations. Check that your Meraki or Catalyst credentials are configured in Settings.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch organizations on mount
  useEffect(() => {
    if (orgFetchedRef.current) return;
    orgFetchedRef.current = true;
    fetchOrgs();
  }, [fetchOrgs]);

  const retryFetch = useCallback(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch networks when org changes
  useEffect(() => {
    if (!selectedOrg) {
      setNetworks([]);
      setSelectedNetwork('');
      return;
    }

    (async () => {
      try {
        const nets = await apiClient.getMerakiNetworks(selectedOrg);
        const netArr = Array.isArray(nets) ? nets : [];
        setNetworks(netArr);
        if (netArr.length > 0) {
          setSelectedNetwork(netArr[0].id);
        } else {
          setSelectedNetwork('');
        }
      } catch (err) {
        console.error('Failed to fetch networks:', err);
        setNetworks([]);
        setSelectedNetwork('');
      }
    })();
  }, [selectedOrg]);

  return {
    organizations,
    networks,
    selectedOrg,
    selectedNetwork,
    loading,
    error,
    setSelectedOrg,
    setSelectedNetwork,
    clearError,
    retryFetch,
  };
}
