'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ErrorAlert } from '@/components/common';
import type { NetworkPlatformOrg } from '@/types';
import type { VisualizationTab } from '@/types/visualization';
import { TopStatsBar, type StatItem } from '@/components/dashboard/TopStatsBar';
import { VisualizationsTabBar } from '@/components/visualizations/VisualizationsTabBar';
import NetworkTopology from '@/components/visualizations/NetworkTopology';
import PerformanceCharts from '@/components/visualizations/PerformanceCharts';
import OrgWideTopology from '@/components/visualizations/OrgWideTopology';

interface Network {
  id: string;
  name: string;
  organizationId?: string;
  productTypes?: string[];
  timeZone?: string;
}

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState<VisualizationTab>('organization');
  const [organizations, setOrganizations] = useState<NetworkPlatformOrg[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networksLoading, setNetworksLoading] = useState(false);

  // Fetch network platform organizations (Meraki/Catalyst only) on mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Fetch networks when organization changes
  useEffect(() => {
    if (selectedOrg) {
      fetchNetworks(selectedOrg);
    } else {
      setNetworks([]);
      setSelectedNetwork('');
    }
  }, [selectedOrg]);

  async function fetchOrganizations() {
    setError(null);
    try {
      // Only fetch Meraki and Catalyst organizations (valid network platforms)
      const orgs = await apiClient.getNetworkPlatformOrgs();
      setOrganizations(orgs);
      // Auto-select first org if available
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch network platform organizations:', err);
      setError('Failed to load organizations. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchNetworks(orgName: string) {
    setNetworksLoading(true);
    try {
      const nets = await apiClient.getMerakiNetworks(orgName);
      setNetworks(Array.isArray(nets) ? nets : []);
      // Auto-select first network if available
      if (nets && nets.length > 0) {
        setSelectedNetwork(nets[0].id);
      } else {
        setSelectedNetwork('');
      }
    } catch (err) {
      console.error('Failed to fetch networks:', err);
      setNetworks([]);
      setSelectedNetwork('');
    } finally {
      setNetworksLoading(false);
    }
  }

  const handleTabChange = useCallback((tab: VisualizationTab) => {
    setActiveTab(tab);
  }, []);

  // Stats for the TopStatsBar based on active tab
  const stats: StatItem[] = useMemo(() => {
    if (activeTab === 'organization') {
      return [
        { id: 'orgs', label: 'Organizations', value: organizations.length, icon: 'server', tooltip: 'Total organizations available for visualization.' },
        { id: 'networks', label: 'Networks', value: networks.length, icon: 'activity', tooltip: 'Networks within the selected organization.' },
        { id: 'selected', label: 'Selected Org', value: selectedOrg || 'None', icon: 'activity', tooltip: 'Currently selected organization for viewing.' },
        { id: 'status', label: 'Status', value: 'Ready', status: 'success', tooltip: 'Visualization system status.' },
      ];
    }
    if (activeTab === 'topology') {
      return [
        { id: 'network', label: 'Network', value: networks.find(n => n.id === selectedNetwork)?.name || 'None', icon: 'server', tooltip: 'Network being visualized in topology view.' },
        { id: 'products', label: 'Products', value: networks.find(n => n.id === selectedNetwork)?.productTypes?.length || 0, icon: 'activity', tooltip: 'Meraki product types in this network.' },
        { id: 'org', label: 'Organization', value: selectedOrg || 'None', icon: 'activity', tooltip: 'Parent organization of the network.' },
        { id: 'status', label: 'Status', value: selectedNetwork ? 'Connected' : 'Select Network', status: selectedNetwork ? 'success' : 'warning', tooltip: 'Topology data connection status.' },
      ];
    }
    // Performance tab
    return [
      { id: 'network', label: 'Network', value: networks.find(n => n.id === selectedNetwork)?.name || 'None', icon: 'server', tooltip: 'Network being monitored for performance.' },
      { id: 'timeRange', label: 'Time Range', value: '24h', icon: 'activity', tooltip: 'Time window for performance data.' },
      { id: 'metrics', label: 'Metrics', value: '4 Active', icon: 'activity', tooltip: 'Number of performance metrics being tracked.' },
      { id: 'status', label: 'Status', value: selectedNetwork ? 'Monitoring' : 'Select Network', status: selectedNetwork ? 'success' : 'warning', tooltip: 'Performance monitoring status.' },
    ];
  }, [activeTab, organizations.length, networks, selectedOrg, selectedNetwork]);

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900">
        <div className="px-6 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Network Visualizations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Interactive topology maps and performance analytics
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <ErrorAlert
            title="Connection Error"
            message={error}
            onRetry={fetchOrganizations}
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        {/* Tab Bar and Selectors */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          {/* Tab Bar */}
          <VisualizationsTabBar activeTab={activeTab} onTabChange={handleTabChange} />

          {/* Selectors */}
          <div className="flex items-center gap-3">
            {/* Organization Selector (Meraki/Catalyst only) */}
            <label htmlFor="viz-org-select" className="sr-only">Select organization</label>
            <select
              id="viz-org-select"
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              aria-label="Select organization for visualization"
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white"
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.name}>
                  [{org.platform === 'meraki' ? 'Meraki' : 'Catalyst'}] {org.display_name || org.name}
                </option>
              ))}
            </select>

            {/* Network Selector */}
            <label htmlFor="viz-network-select" className="sr-only">Select network</label>
            <select
              id="viz-network-select"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              disabled={!selectedOrg || networksLoading}
              aria-label="Select network for visualization"
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white disabled:opacity-50"
            >
              <option value="">
                {networksLoading ? 'Loading...' : 'Select Network'}
              </option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => {
                if (selectedOrg) fetchNetworks(selectedOrg);
              }}
              disabled={!selectedOrg}
              aria-label={networksLoading ? 'Refreshing networks...' : 'Refresh networks'}
              className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <RefreshCw className={`w-5 h-5 ${networksLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <TopStatsBar stats={stats} loading={networksLoading} className="mb-6" />

        {/* Content */}
        {activeTab === 'organization' ? (
          // Organization VPN tab only needs org selected
          !selectedOrg ? (
            <div className="flex flex-col items-center justify-center h-96 theme-bg-secondary rounded-xl border theme-border">
              <svg
                className="w-16 h-16 theme-text-muted mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              <h3 className="text-lg font-semibold theme-text-primary mb-2">
                Select an Organization
              </h3>
              <p className="text-sm theme-text-muted text-center max-w-md">
                Choose an organization from the dropdown above to view the VPN hub-spoke topology
                across all networks.
              </p>
            </div>
          ) : (
            <OrgWideTopology
              organization={selectedOrg}
              organizationId={selectedOrg}
              organizationName={organizations.find((o) => o.name === selectedOrg)?.display_name || selectedOrg}
            />
          )
        ) : !selectedOrg || !selectedNetwork ? (
          // Network Topology and Performance tabs need both org and network selected
          <div className="flex flex-col items-center justify-center h-96 theme-bg-secondary rounded-xl border theme-border">
            <svg
              className="w-16 h-16 theme-text-muted mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <h3 className="text-lg font-semibold theme-text-primary mb-2">
              Select a Network
            </h3>
            <p className="text-sm theme-text-muted text-center max-w-md">
              Choose an organization and network from the dropdowns above to view topology maps
              and performance metrics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'topology' && (
              <NetworkTopology
                organization={selectedOrg}
                networkId={selectedNetwork}
                networkName={networks.find((n) => n.id === selectedNetwork)?.name || ''}
              />
            )}

            {activeTab === 'performance' && (
              <PerformanceCharts
                organization={selectedOrg}
                networkId={selectedNetwork}
                networkName={networks.find((n) => n.id === selectedNetwork)?.name || ''}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
