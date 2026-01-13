'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { TopStatsBar, type StatItem } from '@/components/dashboard';
import {
  type TabType,
  type NetworkWithMeta,
  type Device,
  type OrgStats,
  NetworksTabBar,
  NetworksFilterBar,
  AIInsightsCard,
  OrganizationsGrid,
  OrganizationsTable,
  NetworksTable,
  DevicesTable,
  DeviceActionModals,
} from '@/components/networks';

// ============================================================================
// Helper Functions
// ============================================================================

function detectOrgType(url: string): 'meraki' | 'catalyst' | 'thousandeyes' | 'splunk' {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('thousandeyes')) return 'thousandeyes';
  if (urlLower.includes(':8089') || urlLower.includes('splunk')) return 'splunk';
  if (urlLower.includes('dnac') || urlLower.includes('catalyst')) return 'catalyst';
  return 'meraki';
}

// ============================================================================
// Main Component
// ============================================================================

export default function NetworksManagementPage() {
  const router = useRouter();
  const hasFetchedRef = useRef(false);

  // Core state
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [allNetworks, setAllNetworks] = useState<NetworkWithMeta[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [networkFilter, setNetworkFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [showRebootModal, setShowRebootModal] = useState(false);
  const [rebootDevice, setRebootDevice] = useState<Device | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeDevice, setRemoveDevice] = useState<Device | null>(null);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [configureDevice, setConfigureDevice] = useState<Device | null>(null);

  // AI Insights
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);

  // ============================================================================
  // Computed Stats (Memoized)
  // ============================================================================

  const orgStats = useMemo((): OrgStats[] => {
    const statsMap = new Map<string, OrgStats>();

    allNetworks.forEach(net => {
      if (!statsMap.has(net.organizationName)) {
        statsMap.set(net.organizationName, {
          name: net.organizationName,
          displayName: net.organizationDisplayName,
          type: net.organizationType,
          networkCount: 0,
          deviceCount: 0,
          onlineCount: 0,
          offlineCount: 0,
        });
      }
      const stats = statsMap.get(net.organizationName)!;
      stats.networkCount++;
      stats.deviceCount += net.devices.length;
      stats.onlineCount += net.devices.filter(d => d.status?.toLowerCase() === 'online').length;
      stats.offlineCount += net.devices.filter(d => d.status?.toLowerCase() === 'offline').length;
    });

    return Array.from(statsMap.values());
  }, [allNetworks]);

  const totalStats = useMemo(() => ({
    organizations: orgStats.length,
    networks: allNetworks.length,
    devices: allDevices.length,
    online: allDevices.filter(d => d.status?.toLowerCase() === 'online').length,
  }), [orgStats, allNetworks, allDevices]);

  // TopStatsBar data
  const topStatsData: StatItem[] = useMemo(() => [
    { id: 'orgs', label: 'Organizations', value: totalStats.organizations, icon: 'activity', status: 'normal', tooltip: 'Number of Meraki/Catalyst organizations discovered.' },
    { id: 'networks', label: 'Networks', value: totalStats.networks, icon: 'activity', status: 'normal', tooltip: 'Total networks across all organizations.' },
    { id: 'devices', label: 'Devices', value: totalStats.devices, icon: 'server', status: 'normal', tooltip: 'Total devices discovered across all networks.' },
    { id: 'online', label: 'Online', value: totalStats.online, icon: 'server', status: 'success', tooltip: 'Devices currently reachable and reporting status.' },
    { id: 'offline', label: 'Offline', value: totalStats.devices - totalStats.online, icon: 'alert', status: totalStats.devices - totalStats.online > 0 ? 'critical' : 'normal', tooltip: 'Devices not responding or unreachable.' },
  ], [totalStats]);

  // ============================================================================
  // Filtered Data (Memoized)
  // ============================================================================

  const filteredNetworks = useMemo(() => {
    let result = allNetworks;
    if (selectedOrg !== 'all') {
      result = result.filter(n => n.organizationName === selectedOrg);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allNetworks, selectedOrg, searchQuery]);

  const filteredDevices = useMemo(() => {
    let result = allDevices;
    if (selectedOrg !== 'all') {
      result = result.filter(d => d.organizationName === selectedOrg);
    }
    if (networkFilter !== 'all') {
      result = result.filter(d => d.networkId === networkFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status?.toLowerCase() === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.serial?.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allDevices, selectedOrg, networkFilter, statusFilter, searchQuery]);

  // ============================================================================
  // Pagination (Memoized)
  // ============================================================================

  const paginatedNetworks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNetworks.slice(start, start + pageSize);
  }, [filteredNetworks, currentPage, pageSize]);

  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDevices.slice(start, start + pageSize);
  }, [filteredDevices, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    const count = activeTab === 'networks' ? filteredNetworks.length : filteredDevices.length;
    return Math.ceil(count / pageSize);
  }, [activeTab, filteredNetworks.length, filteredDevices.length, pageSize]);

  // ============================================================================
  // Data Fetching - Cache First, Then Sync
  // ============================================================================

  // Load cached data (instant) - with fallback to direct API
  const loadCachedData = useCallback(async () => {
    try {
      const response = await fetch('/api/network/cache', { credentials: 'include' });
      if (!response.ok) {
        // Cache not available - silently fall back to direct API
        return null;
      }

      const data = await response.json();

      // Transform to expected format
      const networks: NetworkWithMeta[] = (data.networks || []).map((net: NetworkWithMeta) => ({
        ...net,
        organizationType: net.organizationType as 'meraki' | 'catalyst',
      }));

      const devices: Device[] = data.devices || [];

      setAllNetworks(networks);
      setAllDevices(devices);
      setCacheAge(data.cache_age_seconds);

      return data;
    } catch {
      // Cache not available - silently fall back to direct API
      return null;
    }
  }, []);

  // Direct API fetch (fallback when cache is not available)
  const fetchDirectFromAPI = useCallback(async () => {
    try {
      const orgs = await apiClient.getOrganizations();

      const supportedOrgs = orgs.filter(org => {
        const orgType = detectOrgType(org.url);
        return orgType === 'meraki' || orgType === 'catalyst';
      });

      if (supportedOrgs.length === 0) return;

      const networksWithMeta: NetworkWithMeta[] = [];
      const devicesList: Device[] = [];

      await Promise.allSettled(
        supportedOrgs.map(async (org) => {
          try {
            const orgType = detectOrgType(org.url);
            const orgDisplayName = org.display_name || org.name;

            if (orgType === 'meraki') {
              const [networksData, devicesData] = await Promise.all([
                apiClient.listNetworks(org.name),
                apiClient.listDevices(org.name)
              ]);

              const devices: Device[] = (devicesData.data || []).map((d: Device) => ({
                ...d,
                organizationName: org.name,
                organizationDisplayName: orgDisplayName,
              }));
              devicesList.push(...devices);

              const networks: NetworkWithMeta[] = (networksData.data || []).map((net: Omit<NetworkWithMeta, 'devices' | 'organizationName' | 'organizationDisplayName' | 'organizationType'>) => {
                const networkDevices = devices.filter(d => d.networkId === net.id);
                networkDevices.forEach(d => d.networkName = net.name);
                return {
                  ...net,
                  devices: networkDevices,
                  organizationName: org.name,
                  organizationDisplayName: orgDisplayName,
                  organizationType: 'meraki' as const,
                };
              });
              networksWithMeta.push(...networks);
            }
          } catch {
            // Failed to fetch data for this org
          }
        })
      );

      setAllNetworks(networksWithMeta);
      setAllDevices(devicesList);
    } catch (err) {
      throw err;
    }
  }, []);

  // Sync fresh data from APIs
  const syncData = useCallback(async () => {
    try {
      setSyncing(true);

      // Try cache sync endpoint first
      const response = await fetch('/api/network/sync', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await response.json();
        // Reload cached data after sync
        await loadCachedData();
      } else {
        // Fallback to direct API
        await fetchDirectFromAPI();
      }
    } catch {
      try {
        await fetchDirectFromAPI();
      } catch {
        // Direct API fallback also failed
      }
    } finally {
      setSyncing(false);
    }
  }, [loadCachedData, fetchDirectFromAPI]);

  // Initial load and sync
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Try to load cached data instantly
      const cached = await loadCachedData();

      if (cached && (cached.total_networks > 0 || cached.total_devices > 0)) {
        // Have cache - show it immediately
        setLoading(false);
        // Trigger sync if cache is older than 5 minutes (await to prevent race condition)
        if (cached.cache_age_seconds === null || cached.cache_age_seconds > 300) {
          await syncData();
        }
      } else {
        // No cache - fall back to direct API fetch
        setLoading(false);
        setSyncing(true);
        await fetchDirectFromAPI();
        setSyncing(false);
      }
    } catch {
      setError('Failed to load data');
      setLoading(false);
      setSyncing(false);
    }
  }, [loadCachedData, syncData, fetchDirectFromAPI]);

  // ============================================================================
  // AI Insights
  // ============================================================================

  const fetchAIInsights = useCallback(async () => {
    if (allDevices.length === 0) return;

    setAiInsightsLoading(true);
    try {
      const offlineDevices = allDevices.filter(d => d.status?.toLowerCase() === 'offline');
      const alertingDevices = allDevices.filter(d => d.status?.toLowerCase() === 'alerting');
      const healthPercent = allDevices.length > 0
        ? Math.round((allDevices.filter(d => d.status?.toLowerCase() === 'online').length / allDevices.length) * 100)
        : 0;

      const response = await fetch('/api/network/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stats: {
            organizations: orgStats.length,
            networks: allNetworks.length,
            devices: allDevices.length,
            online: allDevices.filter(d => d.status?.toLowerCase() === 'online').length,
            offline: offlineDevices.length,
            health_percent: healthPercent
          },
          organizations: orgStats.map(org => ({
            name: org.name,
            displayName: org.displayName,
            deviceCount: org.deviceCount,
            onlineCount: org.onlineCount,
            offlineCount: org.offlineCount
          })),
          offline_devices: offlineDevices.slice(0, 10).map(d => ({
            name: d.name,
            model: d.model,
            serial: d.serial,
            networkName: d.networkName
          })),
          alerting_devices: alertingDevices.slice(0, 10).map(d => ({
            name: d.name,
            model: d.model,
            serial: d.serial,
            networkName: d.networkName
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.analysis);
        setAiInsightsExpanded(true);
      } else {
        setAiInsights('Unable to generate insights. Please try again.');
      }
    } catch {
      setAiInsights('Unable to generate insights. Please try again.');
    } finally {
      setAiInsightsLoading(false);
    }
  }, [allDevices, allNetworks, orgStats]);

  // ============================================================================
  // Navigation & Handlers
  // ============================================================================

  const navigateToAIChat = useCallback((context?: string) => {
    if (context) {
      sessionStorage.setItem('ai_initial_message', context);
    }
    router.push('/network');
  }, [router]);

  const navigateToDevices = useCallback((orgName?: string, networkId?: string) => {
    if (orgName) setSelectedOrg(orgName);
    if (networkId) setNetworkFilter(networkId);
    setActiveTab('devices');
    setCurrentPage(1);
  }, []);

  const navigateToNetworks = useCallback((orgName?: string) => {
    if (orgName) setSelectedOrg(orgName);
    setActiveTab('networks');
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setNetworkFilter('all');
    setSelectedOrg('all');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || networkFilter !== 'all' || selectedOrg !== 'all';

  // Device action handlers
  const handleReboot = useCallback((device: Device) => {
    setRebootDevice(device);
    setShowRebootModal(true);
  }, []);

  const confirmReboot = useCallback(async () => {
    if (!rebootDevice) return;
    try {
      await apiClient.rebootDevice(rebootDevice.organizationName!, rebootDevice.serial);
      alert(`Device ${rebootDevice.name} is rebooting...`);
    } catch {
      alert('Failed to reboot device');
    } finally {
      setShowRebootModal(false);
      setRebootDevice(null);
    }
  }, [rebootDevice]);

  const handleRemove = useCallback((device: Device) => {
    setRemoveDevice(device);
    setShowRemoveModal(true);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!removeDevice) return;
    try {
      await apiClient.removeDevice(removeDevice.organizationName!, removeDevice.serial);
      setAllDevices(prev => prev.filter(d => d.serial !== removeDevice.serial));
      setAllNetworks(prev => prev.map(n => ({
        ...n,
        devices: n.devices.filter(d => d.serial !== removeDevice.serial)
      })));
      alert(`Device ${removeDevice.name} removed`);
    } catch {
      alert('Failed to remove device');
    } finally {
      setShowRemoveModal(false);
      setRemoveDevice(null);
    }
  }, [removeDevice]);

  const handleConfigure = useCallback((device: Device) => {
    setConfigureDevice(device);
    setShowConfigureModal(true);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial data fetch
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAllData();
    }
  }, [fetchAllData]);

  // Poll for fresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!syncing && !loading) {
        loadCachedData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [syncing, loading, loadCachedData]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrg, searchQuery, statusFilter, networkFilter, activeTab]);

  // Format cache age for display
  const formatCacheAge = useCallback((): string => {
    if (cacheAge === null) return '';
    if (cacheAge < 60) return 'Updated just now';
    if (cacheAge < 3600) return `Updated ${Math.floor(cacheAge / 60)}m ago`;
    return `Updated ${Math.floor(cacheAge / 3600)}h ago`;
  }, [cacheAge]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Networks & Devices</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage networks and devices across all platforms
              </p>
              {cacheAge !== null && !syncing && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  • {formatCacheAge()}
                </span>
              )}
              {syncing && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 rounded-full text-xs font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Organization Filter */}
            <label htmlFor="org-filter" className="sr-only">
              Filter by organization
            </label>
            <select
              id="org-filter"
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              aria-label="Filter by organization"
              className="px-4 py-2 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm"
            >
              <option value="all">All Organizations</option>
              {orgStats.map(org => (
                <option key={org.name} value={org.name}>{org.displayName}</option>
              ))}
            </select>

            {/* Sync Button */}
            <button
              onClick={syncData}
              disabled={loading || syncing}
              aria-label={syncing ? 'Syncing network data' : 'Sync network data'}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Top Stats Bar */}
        <TopStatsBar stats={topStatsData} loading={loading} className="mb-6" />

        {/* Tab Bar */}
        <NetworksTabBar activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading networks and devices...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* AI Insights */}
                {orgStats.length > 0 && (
                  <AIInsightsCard
                    insights={aiInsights}
                    loading={aiInsightsLoading}
                    expanded={aiInsightsExpanded}
                    onToggleExpand={() => setAiInsightsExpanded(!aiInsightsExpanded)}
                    onGenerate={fetchAIInsights}
                    onAskMore={() => navigateToAIChat('Analyze my network and show me devices that need attention')}
                  />
                )}

                {/* Organizations Grid */}
                <OrganizationsGrid
                  organizations={orgStats}
                  onNavigateToDevices={navigateToDevices}
                  loading={loading}
                />
              </div>
            )}

            {/* Organizations Tab */}
            {activeTab === 'organizations' && (
              <OrganizationsTable
                organizations={orgStats}
                onNavigateToNetworks={navigateToNetworks}
                onNavigateToDevices={navigateToDevices}
                loading={loading}
              />
            )}

            {/* Networks Tab */}
            {activeTab === 'networks' && (
              <div className="space-y-4">
                <NetworksFilterBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  networkFilter={networkFilter}
                  onNetworkChange={setNetworkFilter}
                  networks={filteredNetworks}
                  resultCount={filteredNetworks.length}
                  showStatusFilter={false}
                  showNetworkFilter={false}
                  onClearFilters={handleClearFilters}
                  hasActiveFilters={hasActiveFilters}
                  placeholder="Search networks..."
                />

                <NetworksTable
                  networks={paginatedNetworks}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalNetworks={allNetworks.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  onViewDevices={navigateToDevices}
                  loading={loading}
                />
              </div>
            )}

            {/* Devices Tab */}
            {activeTab === 'devices' && (
              <div className="space-y-4">
                <NetworksFilterBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  networkFilter={networkFilter}
                  onNetworkChange={setNetworkFilter}
                  networks={filteredNetworks}
                  resultCount={filteredDevices.length}
                  showStatusFilter={true}
                  showNetworkFilter={true}
                  onClearFilters={handleClearFilters}
                  hasActiveFilters={hasActiveFilters}
                  placeholder="Search by name, serial, or model..."
                />

                <DevicesTable
                  devices={paginatedDevices}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalDevices={allDevices.length}
                  filteredCount={filteredDevices.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  onConfigure={handleConfigure}
                  onReboot={handleReboot}
                  onRemove={handleRemove}
                  loading={loading}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Device Action Modals */}
      <DeviceActionModals
        showRebootModal={showRebootModal}
        rebootDevice={rebootDevice}
        onRebootConfirm={confirmReboot}
        onRebootCancel={() => { setShowRebootModal(false); setRebootDevice(null); }}
        showRemoveModal={showRemoveModal}
        removeDevice={removeDevice}
        onRemoveConfirm={confirmRemove}
        onRemoveCancel={() => { setShowRemoveModal(false); setRemoveDevice(null); }}
        showConfigureModal={showConfigureModal}
        configureDevice={configureDevice}
        onConfigureClose={() => { setShowConfigureModal(false); setConfigureDevice(null); }}
      />

    </div>
  );
}
