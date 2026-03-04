'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Building2,
  Network,
  Server,
  Wifi,
  WifiOff,
  ChevronDown,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
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
// Stat Card Component
// ============================================================================

function StatCard({ icon: Icon, label, value, color, subValue }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40">
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
          {value.toLocaleString()}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      </div>
      {subValue && (
        <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500">{subValue}</span>
      )}
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function PageSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-6 py-5 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="h-7 w-52 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700/50 rounded mt-2 animate-pulse" />
          </div>
          <div className="flex gap-2.5">
            <div className="h-9 w-44 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[68px] bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="h-10 w-96 bg-slate-200 dark:bg-slate-700/50 rounded-xl mb-5 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
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
  // Computed Stats
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

  const offlineCount = totalStats.devices - totalStats.online;
  const healthPct = totalStats.devices > 0 ? Math.round((totalStats.online / totalStats.devices) * 100) : 0;

  // Tab counts for badges
  const tabCounts = useMemo(() => ({
    organizations: orgStats.length,
    networks: allNetworks.length,
    devices: allDevices.length,
  }), [orgStats, allNetworks, allDevices]);

  // ============================================================================
  // Filtered Data
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
  // Pagination
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
  // Data Fetching
  // ============================================================================

  const loadCachedData = useCallback(async () => {
    try {
      const response = await fetch('/api/network/cache', { credentials: 'include' });
      if (!response.ok) return null;

      const data = await response.json();

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
      return null;
    }
  }, []);

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

  const syncData = useCallback(async () => {
    try {
      setSyncing(true);

      const response = await fetch('/api/network/sync', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await response.json();
        await loadCachedData();
      } else {
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

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cached = await loadCachedData();

      if (cached && (cached.total_networks > 0 || cached.total_devices > 0)) {
        setLoading(false);
        if (cached.cache_age_seconds === null || cached.cache_age_seconds > 300) {
          await syncData();
        }
      } else {
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
    router.push('/chat-v2');
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

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAllData();
    }
  }, [fetchAllData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!syncing && !loading) {
        loadCachedData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [syncing, loading, loadCachedData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrg, searchQuery, statusFilter, networkFilter, activeTab]);

  const formatCacheAge = useCallback((): string => {
    if (cacheAge === null) return '';
    if (cacheAge < 60) return 'just now';
    if (cacheAge < 3600) return `${Math.floor(cacheAge / 60)}m ago`;
    return `${Math.floor(cacheAge / 3600)}h ago`;
  }, [cacheAge]);

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) return <PageSkeleton />;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Networks & Devices
              </h1>
              {syncing && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 rounded-full text-[11px] font-medium border border-cyan-200/60 dark:border-cyan-500/20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing
                </span>
              )}
              {!syncing && cacheAge !== null && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Updated {formatCacheAge()}
                </span>
              )}
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 font-light">
              Manage and monitor networks and devices across all platforms
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Organization Filter */}
            <div className="relative">
              <label htmlFor="org-filter" className="sr-only">Filter by organization</label>
              <select
                id="org-filter"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 text-slate-800 dark:text-slate-200 transition-all shadow-sm hover:shadow-md cursor-pointer min-w-[180px]"
              >
                <option value="all">All Organizations</option>
                {orgStats.map(org => (
                  <option key={org.name} value={org.name}>{org.displayName}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Sync Button */}
            <button
              onClick={syncData}
              disabled={loading || syncing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <StatCard
            icon={Building2}
            label="Organizations"
            value={totalStats.organizations}
            color="from-blue-500 to-indigo-500"
          />
          <StatCard
            icon={Network}
            label="Networks"
            value={totalStats.networks}
            color="from-cyan-500 to-blue-500"
          />
          <StatCard
            icon={Server}
            label="Total Devices"
            value={totalStats.devices}
            color="from-slate-500 to-slate-600"
          />
          <StatCard
            icon={Wifi}
            label="Online"
            value={totalStats.online}
            color="from-emerald-500 to-green-500"
            subValue={totalStats.devices > 0 ? `${healthPct}%` : undefined}
          />
          <StatCard
            icon={WifiOff}
            label="Offline"
            value={offlineCount}
            color={offlineCount > 0 ? 'from-red-500 to-rose-500' : 'from-slate-400 to-slate-500'}
          />
        </div>

        {/* Tab Bar */}
        <NetworksTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={tabCounts}
          className="mb-5"
        />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
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
                <OrganizationsGrid
                  organizations={orgStats}
                  onNavigateToDevices={navigateToDevices}
                  loading={false}
                />
              </div>
            )}

            {/* Organizations Tab */}
            {activeTab === 'organizations' && (
              <OrganizationsTable
                organizations={orgStats}
                onNavigateToNetworks={navigateToNetworks}
                onNavigateToDevices={navigateToDevices}
                loading={false}
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
                  loading={false}
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
                  loading={false}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
