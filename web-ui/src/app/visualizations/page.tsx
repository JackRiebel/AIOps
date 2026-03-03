'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Activity,
  LayoutGrid,
  RefreshCw,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { ErrorAlert } from '@/components/common';
import type { VisualizationTabV2 } from '@/types/visualization';
import { useVisualizationHub } from '@/components/visualizations/useVisualizationHub';
import { NetworkMapView } from '@/components/visualizations/NetworkMapView';
import { PerformanceView } from '@/components/visualizations/PerformanceView';
import { HealthMatrixView } from '@/components/visualizations/HealthMatrixView';

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS: {
  id: VisualizationTabV2;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'network-map', label: 'Network Map', icon: Network },
  { id: 'performance-v2', label: 'Performance', icon: Activity },
  { id: 'health-matrix', label: 'Health Matrix', icon: LayoutGrid },
];

// ============================================================================
// Platform Status Indicator
// ============================================================================

function PlatformIndicator({ label, configured, healthy, platform }: { label: string; configured: boolean; healthy: boolean; platform?: string }) {
  const platformColors: Record<string, { bg: string; ring: string }> = {
    meraki: { bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
    thousandeyes: { bg: 'bg-orange-500', ring: 'ring-orange-500/30' },
    catalyst: { bg: 'bg-blue-500', ring: 'ring-blue-500/30' },
    splunk: { bg: 'bg-lime-600', ring: 'ring-lime-600/30' },
  };
  const colors = platform ? platformColors[platform] : undefined;
  const dotColor = !configured
    ? 'bg-slate-400 dark:bg-slate-600'
    : healthy
      ? (colors?.bg || 'bg-emerald-500')
      : 'bg-amber-500';
  const ringColor = !configured ? '' : healthy && configured ? (colors?.ring || 'ring-emerald-500/30') : '';

  return (
    <div className="flex items-center gap-1.5 group/platform">
      <div className={`relative w-2.5 h-2.5 rounded-full ${dotColor} ${configured && healthy ? `ring-2 ${ringColor}` : ''}`}>
        {configured && healthy && (
          <div className={`absolute inset-0 rounded-full ${dotColor} animate-ping opacity-30`} />
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover/platform:text-slate-700 dark:group-hover/platform:text-slate-300 transition-colors">
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-6 py-6 max-w-[1800px] mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700/50 rounded mt-2 animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-40 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Tab skeleton */}
        <div className="h-10 w-96 bg-slate-200 dark:bg-slate-700/50 rounded-lg mb-6 animate-pulse" />
        {/* Content skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

// ============================================================================
// Custom Select
// ============================================================================

function StyledSelect({ value, onChange, options, placeholder, disabled, id }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 text-slate-800 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md cursor-pointer min-w-[160px]"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

const VALID_TABS = new Set<string>(['network-map', 'performance-v2', 'health-matrix']);

export default function VisualizationsPageWrapper() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VisualizationsPage />
    </Suspense>
  );
}

function VisualizationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hub = useVisualizationHub();

  // Persist active tab in URL so browser back button restores it
  const tabParam = searchParams.get('tab') || '';
  const activeTab: VisualizationTabV2 = VALID_TABS.has(tabParam)
    ? (tabParam as VisualizationTabV2)
    : 'network-map';

  const handleTabChange = useCallback((tab: VisualizationTabV2) => {
    router.replace(`/visualizations?tab=${tab}`, { scroll: false });
  }, [router]);

  const selectedNetworkName = useMemo(() => {
    return hub.networks.find(n => n.id === hub.selectedNetwork)?.name || '';
  }, [hub.networks, hub.selectedNetwork]);

  const orgOptions = useMemo(() => hub.organizations.map(org => ({
    value: org.name,
    label: `[${org.platform === 'meraki' ? 'Meraki' : 'Catalyst'}] ${org.display_name || org.name}`,
  })), [hub.organizations]);

  const networkOptions = useMemo(() => hub.networks.map(net => ({
    value: net.id,
    label: net.name,
  })), [hub.networks]);

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Network Intelligence
              </h1>
              {hub.platformStatuses.length > 0 && (
                <>
                  <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center gap-3">
                    {hub.platformStatuses.map(p => (
                      <PlatformIndicator
                        key={p.platform}
                        label={p.platform === 'thousandeyes' ? 'TE' : p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}
                        configured={p.configured}
                        healthy={p.healthy}
                        platform={p.platform}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 font-light">
              Unified topology, path analysis, and cross-platform health monitoring
            </p>
          </div>

          <div className="flex items-center gap-2.5">
              <label htmlFor="viz-org-select" className="sr-only">Select organization</label>
              <StyledSelect
                id="viz-org-select"
                value={hub.selectedOrg}
                onChange={hub.setSelectedOrg}
                options={orgOptions}
                placeholder="Select Organization"
              />

              <label htmlFor="viz-network-select" className="sr-only">Select network</label>
              <StyledSelect
                id="viz-network-select"
                value={hub.selectedNetwork}
                onChange={hub.setSelectedNetwork}
                options={networkOptions}
                placeholder="Select Network"
                disabled={!hub.selectedOrg}
              />

              <button
                onClick={hub.refresh}
                disabled={!hub.selectedOrg}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed group"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 transition-transform group-hover:rotate-45 ${hub.topologyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
        </div>

        {/* Error */}
        {hub.error && (
          <ErrorAlert
            title="Connection Error"
            message={hub.error}
            onDismiss={() => {}}
            className="mb-5"
          />
        )}

        {/* Tab Bar */}
        <div className="relative flex gap-0.5 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl w-fit mb-5 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-500' : ''}`} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {hub.loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                <span className="text-sm text-slate-500">Loading platform data...</span>
              </div>
            ) : (
              <>
                {activeTab === 'network-map' && (
                  <NetworkMapView
                    hub={hub}
                    networkName={selectedNetworkName}
                  />
                )}
                {activeTab === 'performance-v2' && (
                  <PerformanceView
                    hub={hub}
                    networkName={selectedNetworkName}
                  />
                )}
                {activeTab === 'health-matrix' && (
                  <HealthMatrixView hub={hub} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
