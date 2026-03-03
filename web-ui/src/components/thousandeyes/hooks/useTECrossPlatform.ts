'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { isEnabled, isAgentOnline } from '../types';
import type {
  Agent,
  Alert,
  Test,
  MerakiCachedDevice,
  MerakiCachedNetwork,
  CatalystCachedDevice,
  CatalystCachedNetwork,
  CachedOrganization,
  AgentGroupSummary,
  PlatformHealthSummary,
  CorrelatedDevice,
  CrossPlatformInsight,
  SiteHealthSummary,
  TESplunkCorrelation,
} from '../types';

export interface UseTECrossPlatformParams {
  agents: Agent[];
  alerts: Alert[];
  tests: Test[];
  merakiDevices: MerakiCachedDevice[];
  merakiNetworks: MerakiCachedNetwork[];
  catalystDevices: CatalystCachedDevice[];
  catalystNetworks: CatalystCachedNetwork[];
  organizations: CachedOrganization[];
  isConfigured: boolean;
  activeAlertCount: number;
  enabledAgentsCount: number;
  initialLoadComplete: boolean;
}

export interface UseTECrossPlatformReturn {
  agentsByRegion: Record<string, AgentGroupSummary>;
  platformHealth: PlatformHealthSummary[];
  correlatedDevices: CorrelatedDevice[];
  crossPlatformInsights: CrossPlatformInsight[];
  siteHealth: SiteHealthSummary[];
  splunkCorrelation: TESplunkCorrelation | null;
  loadingSplunkCorrelation: boolean;
}

export function useTECrossPlatform({
  agents,
  alerts,
  tests,
  merakiDevices,
  merakiNetworks,
  catalystDevices,
  catalystNetworks,
  organizations,
  isConfigured,
  activeAlertCount,
  enabledAgentsCount,
  initialLoadComplete,
}: UseTECrossPlatformParams): UseTECrossPlatformReturn {
  const [splunkCorrelation, setSplunkCorrelation] = useState<TESplunkCorrelation | null>(null);
  const [loadingSplunkCorrelation, setLoadingSplunkCorrelation] = useState(false);

  const agentsByRegion: Record<string, AgentGroupSummary> = useMemo(() => {
    const groups: Record<string, AgentGroupSummary> = {};
    agents.forEach(a => {
      const region = a.location || 'Unknown';
      if (!groups[region]) {
        groups[region] = { region, total: 0, online: 0, types: {} };
      }
      groups[region].total++;
      if (isAgentOnline(a)) groups[region].online++;
      const aType = a.agentType || 'unknown';
      groups[region].types[aType] = (groups[region].types[aType] || 0) + 1;
    });
    return groups;
  }, [agents]);

  const platformHealth: PlatformHealthSummary[] = useMemo(() => {
    const summaries: PlatformHealthSummary[] = [];

    summaries.push({
      platform: 'thousandeyes',
      configured: isConfigured,
      deviceCount: agents.length,
      onlineCount: enabledAgentsCount,
      offlineCount: agents.length - enabledAgentsCount,
      healthPercent: agents.length > 0 ? Math.round((enabledAgentsCount / agents.length) * 100) : 100,
      alertCount: activeAlertCount,
      networkCount: tests.length,
    });

    if (merakiDevices.length > 0 || organizations.some(o => o.type === 'meraki')) {
      const merakiOnline = merakiDevices.filter(d => d.status === 'online').length;
      const merakiOffline = merakiDevices.filter(d => d.status === 'offline').length;
      const merakiAlerting = merakiDevices.filter(d => d.status === 'alerting').length;
      summaries.push({
        platform: 'meraki',
        configured: true,
        deviceCount: merakiDevices.length,
        onlineCount: merakiOnline,
        offlineCount: merakiOffline,
        healthPercent: merakiDevices.length > 0 ? Math.round((merakiOnline / merakiDevices.length) * 100) : 100,
        alertCount: merakiAlerting,
        networkCount: merakiNetworks.length,
      });
    }

    if (catalystDevices.length > 0 || organizations.some(o => o.type === 'catalyst')) {
      const catReachable = catalystDevices.filter(d => d.status === 'online' || d.reachabilityStatus === 'Reachable').length;
      summaries.push({
        platform: 'catalyst',
        configured: true,
        deviceCount: catalystDevices.length,
        onlineCount: catReachable,
        offlineCount: catalystDevices.length - catReachable,
        healthPercent: catalystDevices.length > 0 ? Math.round((catReachable / catalystDevices.length) * 100) : 100,
        alertCount: 0,
        networkCount: catalystNetworks.length,
      });
    }

    return summaries;
  }, [isConfigured, agents.length, enabledAgentsCount, activeAlertCount, tests.length,
    merakiDevices, merakiNetworks.length, catalystDevices, catalystNetworks.length, organizations]);

  const correlatedDevices: CorrelatedDevice[] = useMemo(() => {
    const correlated: CorrelatedDevice[] = [];
    if (agents.length === 0 && merakiDevices.length === 0 && catalystDevices.length === 0) return correlated;

    const merakiByIp = new Map<string, MerakiCachedDevice>();
    merakiDevices.forEach(d => {
      if (d.lanIp) merakiByIp.set(d.lanIp, d);
      if (d.publicIp) merakiByIp.set(d.publicIp, d);
    });

    const catalystByIp = new Map<string, CatalystCachedDevice>();
    catalystDevices.forEach(d => {
      if (d.lanIp) catalystByIp.set(d.lanIp, d);
      if (d.publicIp) catalystByIp.set(d.publicIp, d);
    });

    agents.forEach(agent => {
      const ips = agent.ipAddresses || [];
      for (const ip of ips) {
        const meraki = merakiByIp.get(ip);
        const catalyst = catalystByIp.get(ip);
        if (meraki || catalyst) {
          const platforms: ('thousandeyes' | 'meraki' | 'catalyst')[] = ['thousandeyes'];
          if (meraki) platforms.push('meraki');
          if (catalyst) platforms.push('catalyst');

          const anyOffline = (meraki && meraki.status === 'offline') ||
            (catalyst && (catalyst.status === 'offline' || catalyst.reachabilityStatus === 'Unreachable'));
          const anyAlerting = (meraki && meraki.status === 'alerting') || !isAgentOnline(agent);

          correlated.push({
            id: `corr-${agent.agentId}-${ip}`,
            name: agent.agentName,
            matchedIp: ip,
            teAgent: { agentId: agent.agentId, agentName: agent.agentName, agentType: agent.agentType, enabled: agent.enabled, agentState: agent.agentState },
            merakiDevice: meraki || undefined,
            catalystDevice: catalyst || undefined,
            platforms,
            healthStatus: anyOffline ? 'offline' : anyAlerting ? 'degraded' : 'healthy',
          });
          break;
        }
      }
    });

    return correlated;
  }, [agents, merakiDevices, catalystDevices]);

  const crossPlatformInsights: CrossPlatformInsight[] = useMemo(() => {
    const insights: CrossPlatformInsight[] = [];
    const hasMeraki = merakiDevices.length > 0;
    const hasCatalyst = catalystDevices.length > 0;
    if (!hasMeraki && !hasCatalyst) return insights;

    const offlineMeraki = merakiDevices.filter(d => d.status === 'offline');
    const alertingMeraki = merakiDevices.filter(d => d.status === 'alerting');
    const offlineCatalyst = catalystDevices.filter(d => d.status === 'offline' || d.reachabilityStatus === 'Unreachable');

    // 1. Correlated infrastructure failure
    if ((offlineMeraki.length > 0 || offlineCatalyst.length > 0) && activeAlertCount > 0) {
      const totalOffline = offlineMeraki.length + offlineCatalyst.length;
      const platforms: ('thousandeyes' | 'meraki' | 'catalyst')[] = ['thousandeyes'];
      const items: CrossPlatformInsight['relatedItems'] = [];
      if (offlineMeraki.length > 0) {
        platforms.push('meraki');
        offlineMeraki.slice(0, 2).forEach(d => items.push({ type: 'device', id: d.serial, name: d.name || d.serial, platform: 'meraki' }));
      }
      if (offlineCatalyst.length > 0) {
        platforms.push('catalyst');
        offlineCatalyst.slice(0, 2).forEach(d => items.push({ type: 'device', id: d.serial, name: d.name || d.serial, platform: 'catalyst' }));
      }
      insights.push({
        id: 'correlated-infrastructure-failure',
        title: 'Correlated Infrastructure Issue Detected',
        description: `${totalOffline} device(s) offline across ${platforms.length - 1} platform(s) while ${activeAlertCount} ThousandEyes alert(s) active. Indicates potential shared infrastructure failure.`,
        severity: 'critical',
        category: 'availability',
        platforms,
        relatedItems: items,
        aiContext: `Cross-platform infrastructure issue: ${offlineMeraki.length} Meraki offline, ${offlineCatalyst.length} Catalyst unreachable, ${activeAlertCount} TE alerts active. Devices: ${items.map(i => i.name).join(', ')}`,
      });
    }

    // 2. TE agents on managed infrastructure
    if (correlatedDevices.length > 0) {
      const platforms: ('thousandeyes' | 'meraki' | 'catalyst')[] = ['thousandeyes'];
      const onMeraki = correlatedDevices.filter(c => c.merakiDevice);
      const onCatalyst = correlatedDevices.filter(c => c.catalystDevice);
      if (onMeraki.length > 0) platforms.push('meraki');
      if (onCatalyst.length > 0) platforms.push('catalyst');
      insights.push({
        id: 'te-agents-on-infrastructure',
        title: `${correlatedDevices.length} TE Agent${correlatedDevices.length > 1 ? 's' : ''} on Managed Infrastructure`,
        description: `IP-matched: ${onMeraki.length} on Meraki${onCatalyst.length > 0 ? `, ${onCatalyst.length} on Catalyst` : ''}. End-to-end correlation active.`,
        severity: 'info',
        category: 'correlation',
        platforms,
        relatedItems: correlatedDevices.slice(0, 4).map(c => ({
          type: 'agent', id: String(c.teAgent?.agentId || ''), name: c.name, platform: 'thousandeyes',
        })),
      });
    }

    // 3. Meraki uplink + TE performance mismatch
    if (alertingMeraki.length > 0 && activeAlertCount === 0) {
      insights.push({
        id: 'meraki-alerting-te-ok',
        title: 'Meraki Alerting — WAN Healthy',
        description: `${alertingMeraki.length} Meraki device(s) in alerting state but ThousandEyes shows no test failures. Issue may be local to LAN/WiFi.`,
        severity: 'warning',
        category: 'performance',
        platforms: ['thousandeyes', 'meraki'],
        relatedItems: alertingMeraki.slice(0, 3).map(d => ({ type: 'device', id: d.serial, name: d.name || d.serial, platform: 'meraki' })),
        aiContext: `Meraki alerting but TE healthy. ${alertingMeraki.length} alerting Meraki devices. This suggests the issue is on the local network (WiFi congestion, switch port errors, or DHCP issues) rather than WAN/ISP.`,
      });
    }

    // 4. TE alerts but all infrastructure healthy
    if (activeAlertCount > 0 && offlineMeraki.length === 0 && alertingMeraki.length === 0 && offlineCatalyst.length === 0) {
      const platforms: ('thousandeyes' | 'meraki' | 'catalyst')[] = ['thousandeyes'];
      if (hasMeraki) platforms.push('meraki');
      if (hasCatalyst) platforms.push('catalyst');
      insights.push({
        id: 'te-alerts-infra-healthy',
        title: 'TE Alerts — Infrastructure Healthy',
        description: `${activeAlertCount} ThousandEyes alert(s) active but all ${hasMeraki ? 'Meraki' : ''}${hasMeraki && hasCatalyst ? '/' : ''}${hasCatalyst ? 'Catalyst' : ''} devices are online. Issue likely external (ISP, SaaS provider, DNS).`,
        severity: 'warning',
        category: 'performance',
        platforms,
        relatedItems: [],
        aiContext: `TE alerts with healthy infrastructure. All Meraki/Catalyst devices online. Root cause is likely ISP, external service, or application-layer issue.`,
      });
    }

    // 5. Platform health overview
    if (hasMeraki) {
      const onlineCount = merakiDevices.filter(d => d.status === 'online').length;
      insights.push({
        id: 'meraki-health-overview',
        title: 'Meraki Network Status',
        description: `${onlineCount}/${merakiDevices.length} devices online across ${merakiNetworks.length} network(s).${offlineMeraki.length > 0 ? ` ${offlineMeraki.length} offline.` : ''}`,
        severity: offlineMeraki.length > 0 ? 'warning' : 'info',
        category: 'availability',
        platforms: ['meraki'],
        relatedItems: [],
      });
    }

    if (hasCatalyst) {
      const reachable = catalystDevices.filter(d => d.status === 'online' || d.reachabilityStatus === 'Reachable').length;
      insights.push({
        id: 'catalyst-health-overview',
        title: 'Catalyst Center Status',
        description: `${reachable}/${catalystDevices.length} devices reachable across ${catalystNetworks.length} site(s).${offlineCatalyst.length > 0 ? ` ${offlineCatalyst.length} unreachable.` : ''}`,
        severity: offlineCatalyst.length > 0 ? 'warning' : 'info',
        category: 'availability',
        platforms: ['catalyst'],
        relatedItems: [],
      });
    }

    // 6. Catalyst + Meraki overlap
    if (hasMeraki && hasCatalyst) {
      insights.push({
        id: 'multi-platform-coverage',
        title: 'Multi-Platform Monitoring Active',
        description: `Full-stack visibility: ${tests.length} TE tests, ${merakiDevices.length} Meraki devices, ${catalystDevices.length} Catalyst devices. Campus-to-cloud monitoring enabled.`,
        severity: 'info',
        category: 'infrastructure',
        platforms: ['thousandeyes', 'meraki', 'catalyst'],
        relatedItems: [],
      });
    }

    return insights.sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });
  }, [merakiDevices, merakiNetworks.length, catalystDevices, catalystNetworks.length,
    agents, activeAlertCount, correlatedDevices, tests.length, organizations]);

  const siteHealth: SiteHealthSummary[] = useMemo(() => {
    if (merakiNetworks.length === 0 && catalystNetworks.length === 0) return [];

    const sites = new Map<string, SiteHealthSummary>();

    merakiNetworks.forEach(net => {
      const name = net.name || net.id;
      const devs = merakiDevices.filter(d => d.networkId === net.id);
      sites.set(name, {
        siteName: name,
        merakiNetworkId: net.id,
        merakiDeviceCount: devs.length,
        merakiOnline: devs.filter(d => d.status === 'online').length,
        catalystDeviceCount: 0,
        catalystReachable: 0,
        teAgentCount: 0,
        teAgentsOnline: 0,
        teActiveAlerts: 0,
        overallHealth: 'healthy',
      });
    });

    catalystNetworks.forEach(net => {
      const name = net.name || net.id;
      const devs = catalystDevices.filter(d => d.networkId === net.id);
      const existing = sites.get(name);
      if (existing) {
        existing.catalystSiteId = net.id;
        existing.catalystDeviceCount = devs.length;
        existing.catalystReachable = devs.filter(d => d.status === 'online' || d.reachabilityStatus === 'Reachable').length;
      } else {
        sites.set(name, {
          siteName: name,
          catalystSiteId: net.id,
          merakiDeviceCount: 0,
          merakiOnline: 0,
          catalystDeviceCount: devs.length,
          catalystReachable: devs.filter(d => d.status === 'online' || d.reachabilityStatus === 'Reachable').length,
          teAgentCount: 0,
          teAgentsOnline: 0,
          teActiveAlerts: 0,
          overallHealth: 'healthy',
        });
      }
    });

    sites.forEach(site => {
      const totalDevices = site.merakiDeviceCount + site.catalystDeviceCount + site.teAgentCount;
      const totalOnline = site.merakiOnline + site.catalystReachable + site.teAgentsOnline;
      if (totalDevices === 0) return;
      const healthPct = totalOnline / totalDevices;
      site.overallHealth = healthPct >= 0.9 ? 'healthy' : healthPct >= 0.5 ? 'degraded' : 'critical';
    });

    return Array.from(sites.values()).sort((a, b) => {
      const order = { critical: 0, degraded: 1, healthy: 2 };
      return order[a.overallHealth] - order[b.overallHealth];
    });
  }, [merakiNetworks, merakiDevices, catalystNetworks, catalystDevices]);

  // Splunk correlation
  const correlateSplunkLogs = useCallback(async () => {
    try {
      setLoadingSplunkCorrelation(true);
      const agentIps = agents.flatMap(a => a.ipAddresses || []);
      const alertIps = alerts
        .filter(a => isEnabled(a.active))
        .map(a => a.testName)
        .filter(Boolean);

      if (agentIps.length === 0) return;

      const response = await fetch('/api/thousandeyes/cross-platform/correlate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ips: agentIps.slice(0, 50), alert_ips: alertIps.slice(0, 20) }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setSplunkCorrelation(data);
    } catch {
      // Splunk not configured or correlation failed
    } finally {
      setLoadingSplunkCorrelation(false);
    }
  }, [agents, alerts]);

  // Auto-correlate Splunk logs when agents are loaded
  useEffect(() => {
    if (agents.length > 0 && initialLoadComplete && !splunkCorrelation) {
      correlateSplunkLogs();
    }
  }, [agents.length, initialLoadComplete, splunkCorrelation, correlateSplunkLogs]);

  return {
    agentsByRegion,
    platformHealth,
    correlatedDevices,
    crossPlatformInsights,
    siteHealth,
    splunkCorrelation,
    loadingSplunkCorrelation,
  };
}
