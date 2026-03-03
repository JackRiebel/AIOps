'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SplunkCorrelatedDevice, SplunkLog } from '../types';

// ============================================================================
// Deduplicated IP/host correlation helper
// ============================================================================

const IP_REGEX = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

interface LogLike {
  host?: string;
  source?: string;
  src_ip?: string;
  dest_ip?: string;
  _raw?: string;
}

function extractHostsAndIps(logs: LogLike[]): { hosts: string[]; ips: string[] } {
  const hosts = new Set<string>();
  const ips = new Set<string>();

  for (const log of logs) {
    if (log.host) hosts.add(log.host);
    if (log.source) {
      const m = log.source.match(IP_REGEX);
      if (m) m.forEach(ip => ips.add(ip));
    }
    if (log.src_ip) ips.add(log.src_ip);
    if (log.dest_ip) ips.add(log.dest_ip);
    if (log._raw) {
      const m = log._raw.match(IP_REGEX);
      if (m) m.forEach(ip => ips.add(ip));
    }
  }

  return { hosts: [...hosts], ips: [...ips] };
}

function correlateLogsWithDevices(
  allIps: string[],
  allHosts: string[],
  merakiDevices: any[],
  catalystDevices: any[],
): SplunkCorrelatedDevice[] {
  const correlated: SplunkCorrelatedDevice[] = [];

  // Match against Meraki devices
  for (const dev of merakiDevices) {
    const devIps = [dev.lanIp, dev.wan1Ip, dev.wan2Ip].filter(Boolean).map((ip: string) => ip.toLowerCase());
    const devName = (dev.name || '').toLowerCase();
    const matched = devIps.some((ip: string) => allIps.includes(ip)) || allHosts.some(h => h.toLowerCase() === devName);
    if (matched) {
      correlated.push({
        ip: devIps[0] || devName,
        hostname: dev.name,
        merakiDevice: { serial: dev.serial, name: dev.name, model: dev.model, status: dev.status, networkName: dev.networkName },
        platforms: ['meraki'],
      });
    }
  }

  // Match against Catalyst devices
  for (const dev of catalystDevices) {
    const devIp = (dev.managementIpAddress || dev.ipAddress || '').toLowerCase();
    const devName = (dev.hostname || dev.name || '').toLowerCase();
    const matched = allIps.includes(devIp) || allHosts.some(h => h.toLowerCase() === devName);
    if (matched) {
      const existing = correlated.find(c => c.ip === devIp);
      if (existing) {
        existing.catalystDevice = { serial: dev.serialNumber, name: dev.hostname, model: dev.platformId, reachabilityStatus: dev.reachabilityStatus };
        existing.platforms.push('catalyst');
      } else {
        correlated.push({
          ip: devIp || devName,
          hostname: dev.hostname,
          catalystDevice: { serial: dev.serialNumber, name: dev.hostname, model: dev.platformId, reachabilityStatus: dev.reachabilityStatus },
          platforms: ['catalyst'],
        });
      }
    }
  }

  return correlated;
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSplunkCorrelationParams {
  searchResults: any[];
  activityFeed: SplunkLog[];
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
}

export interface UseSplunkCorrelationReturn {
  correlatedDevices: SplunkCorrelatedDevice[];
  merakiDevices: any[];
  catalystDevices: any[];
  loadingCorrelation: boolean;
  fetchNetworkCache: () => Promise<void>;
  correlateSearchResults: () => Promise<void>;
}

export function useSplunkCorrelation({ searchResults, activityFeed, fetchApi }: UseSplunkCorrelationParams): UseSplunkCorrelationReturn {
  const [correlatedDevices, setCorrelatedDevices] = useState<SplunkCorrelatedDevice[]>([]);
  const [merakiDevices, setMerakiDevices] = useState<any[]>([]);
  const [catalystDevices, setCatalystDevices] = useState<any[]>([]);
  const [loadingCorrelation, setLoadingCorrelation] = useState(false);
  const activityCorrelationDone = useRef(false);

  const fetchNetworkCache = useCallback(async () => {
    try {
      const data = await fetchApi<any>('/api/network/cache');
      if (!data) return;

      const orgTypes: Record<string, string> = {};
      for (const org of data.organizations || []) {
        orgTypes[org.name] = org.type;
      }

      const allDevices = (data.devices || []).map((d: any) => ({
        ...d,
        orgType: orgTypes[d.organizationName] || 'unknown',
      }));

      setMerakiDevices(allDevices.filter((d: any) => d.orgType === 'meraki'));
      setCatalystDevices(allDevices.filter((d: any) => d.orgType === 'catalyst'));
    } catch (err) {
      console.error('Failed to fetch network cache:', err);
    }
  }, [fetchApi]);

  const correlateSearchResults = useCallback(async () => {
    if (searchResults.length === 0) return;

    try {
      setLoadingCorrelation(true);
      const { hosts: allHosts, ips: allIps } = extractHostsAndIps(searchResults);
      const localCorrelated = correlateLogsWithDevices(allIps, allHosts, merakiDevices, catalystDevices);
      setCorrelatedDevices(localCorrelated);

      // Also try server-side correlation for deeper analysis
      if (allHosts.length > 0 || allIps.length > 0) {
        try {
          const serverData = await fetchApi<any>('/api/splunk/cross-platform/correlate', {
            method: 'POST',
            body: JSON.stringify({ hosts: allHosts, ips: allIps }),
          });
          if (serverData?.correlatedDevices?.length) {
            const merged = [...localCorrelated];
            for (const sd of serverData.correlatedDevices) {
              if (!merged.find(m => m.ip === sd.ip)) {
                merged.push(sd);
              }
            }
            setCorrelatedDevices(merged);
          }
        } catch {
          // Server-side correlation failed, local results still valid
        }
      }
    } catch (err) {
      console.error('Correlation failed:', err);
    } finally {
      setLoadingCorrelation(false);
    }
  }, [searchResults, merakiDevices, catalystDevices, fetchApi]);

  // Auto-correlate activity feed with network devices
  useEffect(() => {
    if (
      activityCorrelationDone.current ||
      activityFeed.length === 0 ||
      (merakiDevices.length === 0 && catalystDevices.length === 0)
    ) return;
    activityCorrelationDone.current = true;

    const { hosts: allHosts, ips: allIps } = extractHostsAndIps(activityFeed);
    const correlated = correlateLogsWithDevices(allIps, allHosts, merakiDevices, catalystDevices);

    if (correlated.length > 0) {
      setCorrelatedDevices(correlated);
    }
  }, [activityFeed, merakiDevices, catalystDevices]);

  return {
    correlatedDevices,
    merakiDevices,
    catalystDevices,
    loadingCorrelation,
    fetchNetworkCache,
    correlateSearchResults,
  };
}
