'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api-client';
import type { SystemHealth, Organization } from '@/types';
import {
  DashboardLayout,
  DashboardCard,
  TopStatsBar,
  UnifiedHealthWidget,
  CriticalIncidentsWidget,
  MiniTopologyWidget,
  DashboardSkeleton,
  DataFreshnessIndicator,
  HealthVelocityWidget,
  LiveActionsFeed,
  type StatItem,
  type IntegrationHealth,
  type Incident,
  type DeviceSummary,
  type VelocityDataPoint,
  type ActionFeedItem,
} from '@/components/dashboard';
import { TrendingUp } from 'lucide-react';
import { ErrorAlert } from '@/components/common';

// ============================================================================
// Types
// ============================================================================

interface CostSummary {
  period_days: number;
  queries: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_per_query: number;
  last_7_days: { queries: number; cost_usd: number };
}

interface DailyCost {
  date: string;
  cost_usd: number;
  queries: number;
  label: string;
}

interface IncidentData {
  id: number;
  title: string;
  status: string;
  severity: string;
  start_time: string;
  event_count: number;
}


interface AuditLogEntry {
  id: number;
  timestamp: string;
  http_method: string;
  path?: string;
  response_status?: number;
}

// Integration status type
interface IntegrationStatus {
  meraki: boolean;
  catalyst: boolean;
  thousandeyes: boolean;
  splunk: boolean;
}

// Device data from API
interface DeviceData {
  model?: string;
  status?: string;
  reachabilityStatus?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload?: { fullDate?: string };
  }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload?.length) {
    const value = payload[0].value;
    const fullDate = payload[0].payload?.fullDate;
    const formatted = value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
    return (
      <div className="bg-slate-900 rounded-lg px-3 py-2 shadow-xl border border-slate-700 backdrop-blur-sm">
        <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-0.5">{fullDate}</p>
        <p className="font-bold text-white text-lg leading-tight">{formatted}</p>
      </div>
    );
  }
  return null;
}


// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [incidents7Day, setIncidents7Day] = useState<IncidentData[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    meraki: false, catalyst: false, thousandeyes: false, splunk: false
  });
  const [deviceStats, setDeviceStats] = useState<{ total: number; online: number; alerting: number; networks: number; byType: DeviceSummary[] }>({
    total: 0, online: 0, alerting: 0, networks: 0, byType: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // New predictive intelligence state
  const [velocityData, setVelocityData] = useState<{
    hourlyData: VelocityDataPoint[];
    currentHourCount: number;
    averageCount: number;
  }>({ hourlyData: [], currentHourCount: 0, averageCount: 0 });
  const [activityFeed, setActivityFeed] = useState<ActionFeedItem[]>([]);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // BFF: Single aggregated request replaces 10 parallel calls
      const response = await fetch('/api/dashboard/summary', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Dashboard fetch failed: ${response.status}`);
      }
      const data = await response.json();

      // Extract data from aggregated response
      if (data.health) setHealth(data.health);
      if (data.organizations) setOrganizations(data.organizations);
      if (data.costs_summary) setCostSummary(data.costs_summary);
      if (data.daily_costs) {
        const sorted = Array.isArray(data.daily_costs)
          ? data.daily_costs.sort((a: DailyCost, b: DailyCost) => new Date(a.date).getTime() - new Date(b.date).getTime())
          : [];
        setDailyCosts(sorted);
      }
      if (data.incidents_24h) setIncidents(data.incidents_24h);
      if (data.incidents_7d) setIncidents7Day(data.incidents_7d);

      // Process audit logs for recent activity
      if (Array.isArray(data.audit_logs)) {
        setRecentActivity(data.audit_logs.slice(0, 6));
      }

      // Process velocity data for predictive intelligence
      if (data.incident_velocity) {
        setVelocityData({
          hourlyData: data.incident_velocity.hourly_data || [],
          currentHourCount: data.incident_velocity.current_hour_count || 0,
          averageCount: data.incident_velocity.average_count || 0,
        });
      }

      // Process activity feed
      if (data.activity_feed?.items) {
        const feedItems: ActionFeedItem[] = data.activity_feed.items.map((item: Record<string, unknown>) => ({
          id: String(item.id),
          type: item.type as ActionFeedItem['type'],
          title: String(item.title || ''),
          description: item.description ? String(item.description) : undefined,
          status: (item.status as ActionFeedItem['status']) || 'pending',
          timestamp: new Date(String(item.timestamp)),
          workflowId: item.workflow_id ? String(item.workflow_id) : undefined,
          workflowName: item.workflow_name ? String(item.workflow_name) : undefined,
          triggeredBy: item.triggered_by ? String(item.triggered_by) : undefined,
          duration: typeof item.duration === 'number' ? item.duration : undefined,
        }));
        setActivityFeed(feedItems);
      }

      // Parse integration config status from system_config only
      const configs = data.integrations_config?.configs || null;

      setIntegrations({
        meraki: configs?.meraki_api_key?.has_value || false,
        catalyst: configs?.catalyst_center_host?.has_value || false,
        thousandeyes: configs?.thousandeyes_oauth_token?.has_value || false,
        splunk: configs?.splunk_host?.has_value || configs?.splunk_api_url?.has_value || false,
      });

      // Fetch device inventory - try cache first, then fallback to direct API
      const typeMap: Record<string, { total: number; online: number; alerting: number; offline: number }> = {};
      let totalDevices = 0;
      let totalOnline = 0;
      let totalAlerting = 0;
      let totalNetworks = 0;
      let dataLoaded = false;

      // Try cache first (fast path)
      try {
        const cacheRes = await fetch('/api/network/cache', { credentials: 'include' });
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json();
          const networks = cacheData?.networks || [];
          const devices = cacheData?.devices || [];

          if (devices.length > 0) {
            totalNetworks = networks.length;
            devices.forEach((device: DeviceData) => {
              const model = (device.model || '').toLowerCase();
              const prefix = model.substring(0, 2);
              const type = prefix as DeviceSummary['type'];
              const status = (device.status || 'offline').toLowerCase();

              if (!typeMap[type]) {
                typeMap[type] = { total: 0, online: 0, alerting: 0, offline: 0 };
              }
              typeMap[type].total++;
              totalDevices++;

              if (status === 'online') {
                typeMap[type].online++;
                totalOnline++;
              } else if (status === 'alerting') {
                typeMap[type].alerting++;
                totalAlerting++;
              } else {
                typeMap[type].offline++;
              }
            });
            dataLoaded = true;
          }
        }
      } catch {
        // Cache not available, will fallback to direct API
      }

      // Fallback to direct API if cache empty
      if (!dataLoaded && data.organizations) {
        // Filter to Meraki/Catalyst orgs only
        const networkOrgs = (data.organizations as Organization[]).filter((o: Organization) => {
          if (!o.is_active) return false;
          const url = (o.url || '').toLowerCase();
          if (url.includes('thousandeyes')) return false;
          if (url.includes(':8089') || url.includes('splunk')) return false;
          return true;
        });

        for (const org of networkOrgs) {
          try {
            const url = (org.url || '').toLowerCase();
            const isCatalyst = url.includes('dnac') || url.includes('catalyst');

            // Fetch networks
            try {
              const networksRes = await apiClient.listNetworks(org.name);
              const networks = networksRes?.data || [];
              if (Array.isArray(networks)) {
                totalNetworks += networks.length;
              }
            } catch {
              // Ignore network fetch errors
            }

            // Fetch devices
            const devicesRes = await apiClient.listDevices(org.name);
            const devices = devicesRes?.data || [];
            if (Array.isArray(devices)) {
              devices.forEach((device: DeviceData) => {
                const model = (device.model || '').toLowerCase();
                const prefix = model.substring(0, 2);
                const type = (isCatalyst ? 'cw' : prefix) as DeviceSummary['type'];
                const status = isCatalyst
                  ? (device.reachabilityStatus === 'Reachable' ? 'online' : 'offline')
                  : (device.status || 'offline').toLowerCase();

                if (!typeMap[type]) {
                  typeMap[type] = { total: 0, online: 0, alerting: 0, offline: 0 };
                }
                typeMap[type].total++;
                totalDevices++;

                if (status === 'online') {
                  typeMap[type].online++;
                  totalOnline++;
                } else if (status === 'alerting') {
                  typeMap[type].alerting++;
                  totalAlerting++;
                } else {
                  typeMap[type].offline++;
                }
              });
            }
          } catch {
            // Failed to fetch data for this org - continue with others
          }
        }
      }

      // Update device stats
      if (totalDevices > 0) {
        const byType: DeviceSummary[] = Object.entries(typeMap)
          .map(([type, stats]) => ({
            type: type as DeviceSummary['type'],
            ...stats
          }))
          .sort((a, b) => b.total - a.total);

        setDeviceStats({
          total: totalDevices,
          online: totalOnline,
          alerting: totalAlerting,
          networks: totalNetworks,
          byType
        });
      }

      setLastUpdated(new Date());
    } catch {
      setError('Failed to load dashboard data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived metrics - use 24h data for stats bar to match the Active Incidents widget
  // Count all non-resolved incidents (active, investigating, open)
  const activeIncidents24h = incidents.filter(i =>
    i.status !== 'resolved' && i.status !== 'closed'
  ).length;
  const criticalIncidents = incidents.filter(i =>
    i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'closed'
  ).length;

  // Chart data - last 7 days
  const chartData = dailyCosts.slice(-7).map((d, i, arr) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: d.cost_usd,
    showLabel: i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2),
  }));

  const totalCost = chartData.reduce((sum, d) => sum + d.cost, 0);

  // Transform data for widgets - count orgs for each integration type
  const integrationHealth: IntegrationHealth[] = useMemo(() => {
    // Count Meraki orgs (exclude ThousandEyes, Splunk, Catalyst by URL)
    const merakiOrgs = organizations.filter((o: Organization) => {
      if (!o.is_active) return false;
      const url = (o.url || '').toLowerCase();
      if (url.includes('thousandeyes')) return false;
      if (url.includes(':8089') || url.includes('splunk')) return false;
      if (url.includes('dnac') || url.includes('catalyst') || url.includes('sandboxdnac')) return false;
      return true;
    });
    const merakiCount = merakiOrgs.length;

    // Count Catalyst orgs
    const catalystOrgs = organizations.filter((o: Organization) => {
      if (!o.is_active) return false;
      const url = (o.url || '').toLowerCase();
      return url.includes('dnac') || url.includes('catalyst') || url.includes('sandboxdnac');
    });
    const catalystCount = catalystOrgs.length || (integrations.catalyst ? 1 : 0);

    // Count ThousandEyes orgs
    const thousandeyesOrgs = organizations.filter((o: Organization) => {
      if (!o.is_active) return false;
      const url = (o.url || '').toLowerCase();
      return url.includes('thousandeyes');
    });
    const thousandeyesCount = thousandeyesOrgs.length || (integrations.thousandeyes ? 1 : 0);

    // Splunk connections
    const splunkCount = integrations.splunk ? 1 : 0;

    return [
      {
        id: 'meraki',
        name: 'meraki',
        displayName: 'Meraki',
        status: integrations.meraki ? 'healthy' : 'not_configured',
        connectedCount: merakiCount,
        totalCount: merakiCount || (integrations.meraki ? 1 : 0),
        href: '/admin/settings',
      },
      {
        id: 'catalyst',
        name: 'catalyst',
        displayName: 'Catalyst Center',
        status: integrations.catalyst ? 'healthy' : 'not_configured',
        connectedCount: catalystCount,
        totalCount: catalystCount,
        href: '/admin/settings',
      },
      {
        id: 'thousandeyes',
        name: 'thousandeyes',
        displayName: 'ThousandEyes',
        status: integrations.thousandeyes ? 'healthy' : 'not_configured',
        connectedCount: thousandeyesCount,
        totalCount: thousandeyesCount,
        href: '/admin/settings',
      },
      {
        id: 'splunk',
        name: 'splunk',
        displayName: 'Splunk',
        status: integrations.splunk ? 'healthy' : 'not_configured',
        connectedCount: splunkCount,
        totalCount: splunkCount,
        href: '/admin/settings',
      },
    ];
  }, [integrations]);

  const widgetIncidents: Incident[] = useMemo(() =>
    incidents.map(i => {
      // Map severity: 'info' -> 'low' for widget compatibility
      const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        info: 'low',
        low: 'low',
      };
      // Map status: 'open' -> 'active', 'closed' -> 'resolved' for widget compatibility
      const statusMap: Record<string, 'active' | 'investigating' | 'resolved'> = {
        open: 'active',
        investigating: 'investigating',
        resolved: 'resolved',
        closed: 'resolved',
        active: 'active',
      };
      return {
        id: i.id,
        title: i.title,
        severity: severityMap[i.severity] || 'medium',
        status: statusMap[i.status] || 'active',
        source: 'system' as const,
        startTime: new Date(i.start_time),
        eventCount: i.event_count,
      };
    }),
  [incidents]);

  // Top stats bar data
  const topStats: StatItem[] = useMemo(() => [
    {
      id: 'incidents',
      label: 'Active Incidents',
      value: activeIncidents24h,
      status: criticalIncidents > 0 ? 'critical' : activeIncidents24h > 0 ? 'warning' : 'success',
      href: '/incidents',
      icon: 'alert' as const,
      tooltip: 'Non-resolved incidents from the last 24 hours.',
    },
    {
      id: 'devices',
      label: 'Devices Online',
      value: deviceStats.total > 0 ? `${deviceStats.online}/${deviceStats.total}` : '0',
      status: deviceStats.alerting > 0 ? 'warning' : 'normal',
      href: '/networks',
      icon: 'server' as const,
      tooltip: 'Network devices currently online vs total discovered across all integrations.',
    },
    {
      id: 'queries',
      label: 'AI Queries (24h)',
      value: costSummary?.last_7_days?.queries ? Math.round(costSummary.last_7_days.queries / 7) : 0,
      status: 'normal',
      href: '/costs',
      icon: 'cost' as const,
      tooltip: 'Estimated AI queries in the last 24 hours based on 7-day average.',
    },
    {
      id: 'health',
      label: 'System Health',
      value: health?.status === 'healthy' ? 'Operational' : health?.status === 'degraded' ? 'Degraded' : 'Unknown',
      status: health?.status === 'healthy' ? 'success' : health?.status === 'degraded' ? 'warning' : 'normal',
      href: '/health',
      icon: 'activity' as const,
      tooltip: 'Overall system health including database, API services, and integrations.',
    },
  ], [activeIncidents24h, criticalIncidents, deviceStats, costSummary, health]);

  const handleViewIncident = useCallback((incidentId: string | number) => {
    router.push(`/incidents?selected=${incidentId}`);
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-6 py-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Network intelligence at a glance</p>
          </div>
          <DataFreshnessIndicator
            lastUpdated={lastUpdated}
            onRefresh={fetchData}
            staleThresholdMinutes={2}
          />
        </header>

        {/* Error Alert */}
        {error && (
          <ErrorAlert
            title="Connection Error"
            message={error}
            onRetry={fetchData}
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        {/* Top Stats Bar */}
        <TopStatsBar stats={topStats} loading={loading} className="mb-6" />

        {/* Main Content Grid - 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Health Widget */}
          <UnifiedHealthWidget
            integrations={integrationHealth}
            loading={loading}
          />

          {/* Critical Incidents */}
          <CriticalIncidentsWidget
            incidents={widgetIncidents}
            onViewIncident={handleViewIncident}
            loading={loading}
          />

          {/* Network Overview */}
          <MiniTopologyWidget
            devices={deviceStats.byType}
            totalDevices={deviceStats.total}
            onlineDevices={deviceStats.online}
            alertingDevices={deviceStats.alerting}
            networkCount={deviceStats.networks}
            loading={loading}
          />

          {/* Cost & Quick Actions Card */}
          <DashboardCard
            title="AI Cost Trend"
            icon={<TrendingUp className="w-4 h-4" />}
            href="/costs"
            linkText="Details →"
            accent="cyan"
            loading={loading}
          >
            {/* Cost Chart */}
            {chartData.length > 0 ? (
              <>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">last 7 days</span>
                </div>
                <div className="h-16" role="img" aria-label={`AI cost trend chart showing $${totalCost.toFixed(2)} spent over last 7 days`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25}/>
                          <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.1}/>
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        dy={5}
                        interval={0}
                        tick={{ fill: '#94a3b8' }}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cost"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#costGradient)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-16 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No usage data yet</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Start using AI to see trends</p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-slate-200 dark:border-slate-700 my-3" />

            {/* Quick Actions */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/network', label: 'Agent Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
                  { href: '/incidents', label: 'Incidents', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { href: '/networks', label: 'Networks', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
                  { href: '/admin/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                ].map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600/30 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors group"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                    </svg>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-cyan-700 dark:group-hover:text-cyan-400">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </DashboardCard>

          {/* Live Actions Feed - Real-time Workflow Activity */}
          <LiveActionsFeed
            initialItems={activityFeed}
            loading={loading}
          />

          {/* Incident Velocity - Predictive Intelligence */}
          <HealthVelocityWidget
            hourlyData={velocityData.hourlyData}
            currentHourCount={velocityData.currentHourCount}
            averageCount={velocityData.averageCount}
            loading={loading}
          />
        </div>

        {/* Bottom Navigation Row */}
        <div className="mt-6">
          <DashboardCard
            title="Quick Navigation"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            }
            accent="slate"
            compact
          >
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link href="/network" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/10 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/20 transition-colors">
                  <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">Agent Chat</span>
              </Link>
              <Link href="/incidents" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 transition-colors">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">Incidents</span>
              </Link>
              <Link href="/networks" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">Networks</span>
              </Link>
              <Link href="/splunk" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50 dark:bg-green-500/10 group-hover:bg-green-100 dark:group-hover:bg-green-500/20 transition-colors">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">Splunk</span>
              </Link>
              <Link href="/thousandeyes" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-500/10 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 transition-colors">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">ThousandEyes</span>
              </Link>
              <Link href="/admin" className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-500/10 group-hover:bg-slate-200 dark:group-hover:bg-slate-500/20 transition-colors">
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white text-center">Settings</span>
              </Link>
            </div>
          </DashboardCard>
        </div>

      </div>
    </DashboardLayout>
  );
}
