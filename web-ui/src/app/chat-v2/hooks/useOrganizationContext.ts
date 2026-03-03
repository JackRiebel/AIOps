/**
 * useOrganizationContext - Hook for managing organization and network context
 *
 * Consolidates organization/network fetching and provides display name mapping.
 */

import { useState, useEffect, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface Organization {
  id: number;
  name: string;
  display_name?: string;
  platform: 'meraki' | 'catalyst';
  is_active: boolean;
}

export interface Network {
  id: string;
  name: string;
  organizationId?: string;
}

export interface PollingContext {
  credentialOrg: string;
  organizationId: string;
  networkId: string;
}

export interface UseOrganizationContextReturn {
  /** List of all organizations (Meraki/Catalyst only) */
  organizations: Organization[];
  /** List of networks for the default Meraki org */
  networks: Network[];
  /** First active Meraki organization */
  defaultMerakiOrg: Organization | undefined;
  /** Mapping of org names to display names */
  orgDisplayNames: Record<string, string>;
  /** Context for card polling (org/network scope) */
  pollingContext: PollingContext | undefined;
  /** Loading state */
  isLoading: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchOrganizations(): Promise<Organization[]> {
  try {
    const response = await fetch('/api/organizations/network-platforms', { credentials: 'include' });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function fetchNetworksForOrg(orgName: string): Promise<Network[]> {
  try {
    const response = await fetch(`/api/meraki/networks?organization=${encodeURIComponent(orgName)}`, { credentials: 'include' });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || data || [];
  } catch {
    return [];
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOrganizationContext(): UseOrganizationContextReturn {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get the first active Meraki organization
  const defaultMerakiOrg = useMemo(() => {
    return organizations.find(o => o.platform === 'meraki' && o.is_active);
  }, [organizations]);

  // Fetch organizations on mount
  useEffect(() => {
    setIsLoading(true);
    fetchOrganizations().then((orgs) => {
      console.log('[useOrganizationContext] Loaded organizations:', orgs);
      setOrganizations(orgs);
      setIsLoading(false);
    });
  }, []);

  // Fetch networks when we have a Meraki org
  useEffect(() => {
    if (defaultMerakiOrg) {
      console.log('[useOrganizationContext] Fetching networks for org:', defaultMerakiOrg.name);
      fetchNetworksForOrg(defaultMerakiOrg.name).then((nets) => {
        console.log('[useOrganizationContext] Loaded networks:', nets);
        setNetworks(nets);
      });
    }
  }, [defaultMerakiOrg]);

  // Build org display names for AI context
  const orgDisplayNames = useMemo(() => {
    const mapping: Record<string, string> = {};
    organizations.forEach((o) => {
      mapping[o.name] = o.display_name || o.name;
    });
    return mapping;
  }, [organizations]);

  // Build polling context for cards
  const pollingContext = useMemo((): PollingContext | undefined => {
    if (!defaultMerakiOrg) return undefined;
    const firstNetwork = networks[0];
    return {
      credentialOrg: defaultMerakiOrg.name,
      organizationId: firstNetwork?.organizationId || '',
      networkId: firstNetwork?.id || '',
    };
  }, [defaultMerakiOrg, networks]);

  return {
    organizations,
    networks,
    defaultMerakiOrg,
    orgDisplayNames,
    pollingContext,
    isLoading,
  };
}
