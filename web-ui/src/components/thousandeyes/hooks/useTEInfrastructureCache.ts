'use client';

import { useState, useCallback } from 'react';
import type {
  MerakiCachedDevice,
  MerakiCachedNetwork,
  CatalystCachedDevice,
  CatalystCachedNetwork,
  CachedOrganization,
} from '../types';

export interface UseTEInfrastructureCacheReturn {
  merakiDevices: MerakiCachedDevice[];
  merakiNetworks: MerakiCachedNetwork[];
  catalystDevices: CatalystCachedDevice[];
  catalystNetworks: CatalystCachedNetwork[];
  organizations: CachedOrganization[];
  fetchNetworkCache: () => Promise<void>;
}

export function useTEInfrastructureCache(): UseTEInfrastructureCacheReturn {
  const [merakiDevices, setMerakiDevices] = useState<MerakiCachedDevice[]>([]);
  const [merakiNetworks, setMerakiNetworks] = useState<MerakiCachedNetwork[]>([]);
  const [catalystDevices, setCatalystDevices] = useState<CatalystCachedDevice[]>([]);
  const [catalystNetworks, setCatalystNetworks] = useState<CatalystCachedNetwork[]>([]);
  const [organizations, setOrganizations] = useState<CachedOrganization[]>([]);

  const fetchNetworkCache = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/network/cache', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
      });
      if (!response.ok) return;
      const data = await response.json();

      const allDevices = data.devices || [];
      const allNetworks = data.networks || [];
      const allOrgs: CachedOrganization[] = data.organizations || [];

      const mDevices = allDevices.filter((d: any) =>
        allOrgs.some(o => o.name === d.organizationName && o.type === 'meraki')
      );
      const cDevices = allDevices.filter((d: any) =>
        allOrgs.some(o => o.name === d.organizationName && o.type === 'catalyst')
      );
      const mNetworks = allNetworks.filter((n: any) => n.organizationType === 'meraki');
      const cNetworks = allNetworks.filter((n: any) => n.organizationType === 'catalyst');

      setMerakiDevices(mDevices);
      setMerakiNetworks(mNetworks);
      setCatalystDevices(cDevices);
      setCatalystNetworks(cNetworks);
      setOrganizations(allOrgs);
    } catch {
      // Network cache not available — silently ignore
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  return {
    merakiDevices,
    merakiNetworks,
    catalystDevices,
    catalystNetworks,
    organizations,
    fetchNetworkCache,
  };
}
