'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { Route, ArrowRight, Globe, Loader2, Search, ChevronRight, ChevronDown, AlertTriangle, BarChart3, GitBranch, LayoutGrid, Link2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { Test, PathHop, BGPResult, TopologyNode, TopologyLink } from './types';
import { classifyZone, getLinkHealth, extractAsNumber, latencyColor, ZONE_CONFIG } from './types';
import { PathDiagnosticHeader } from './PathDiagnosticHeader';
import { NetworkPathFlow } from './NetworkPathFlow';
import { LatencyWaterfallChart } from './LatencyWaterfallChart';
import { BGPUpdatesChart } from './BGPUpdatesChart';
import { BGPSankeyPathVis } from './BGPSankeyPathVis';

// ============================================================================
// Types
// ============================================================================

export interface PathAnalysisPanelProps {
  tests: Test[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}

interface PathAgentTrace {
  agentId: string;
  agentName: string;
  hops: PathHop[];
}

interface PrefixGroup {
  prefix: string;
  monitors: BGPResult[];
  monitorCount: number;
  minReachability: number;
  maxReachability: number;
  avgReachability: number;
  totalUpdates: number;
  hasIssues: boolean;
}

// ============================================================================
// BGP Helpers
// ============================================================================

function groupBgpByPrefix(bgpData: BGPResult[]): PrefixGroup[] {
  const groups = new Map<string, BGPResult[]>();
  for (const result of bgpData) {
    const key = result.prefix || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(result);
  }

  return Array.from(groups.entries()).map(([prefix, monitors]) => {
    const reachabilities = monitors.map(m => m.reachability);
    const minReachability = Math.min(...reachabilities);
    const maxReachability = Math.max(...reachabilities);
    const avgReachability = reachabilities.reduce((s, v) => s + v, 0) / reachabilities.length;
    const totalUpdates = monitors.reduce((s, m) => s + m.updates, 0);

    return {
      prefix,
      monitors,
      monitorCount: monitors.length,
      minReachability,
      maxReachability,
      avgReachability,
      totalUpdates,
      hasIssues: minReachability < 100 || totalUpdates > 0,
    };
  });
}

function reachabilityColor(value: number): string {
  if (value >= 95) return 'text-green-600 dark:text-green-400';
  if (value >= 80) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function reachabilityBarColor(value: number): string {
  if (value >= 95) return 'bg-green-500';
  if (value >= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

// ============================================================================
// BGP Summary Cards
// ============================================================================

function BgpSummaryCards({ groups, bgpData }: { groups: PrefixGroup[]; bgpData: BGPResult[] }) {
  const avgReachability = bgpData.length > 0
    ? bgpData.reduce((s, b) => s + b.reachability, 0) / bgpData.length
    : 0;
  const totalUpdates = bgpData.reduce((s, b) => s + b.updates, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prefixes</span>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{groups.length}</p>
      </div>
      <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Reachability</span>
        <p className={`text-lg font-semibold ${reachabilityColor(avgReachability)}`}>{avgReachability.toFixed(1)}%</p>
      </div>
      <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Path Changes</span>
        <p className={`text-lg font-semibold ${totalUpdates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{totalUpdates}</p>
      </div>
      <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monitors</span>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{bgpData.length}</p>
      </div>
    </div>
  );
}

// ============================================================================
// BGP Correlation View — Maps hops to BGP prefixes with reachability
// ============================================================================

function BgpCorrelationView({ nodes, bgpData }: { nodes: TopologyNode[]; bgpData: BGPResult[] }) {
  const correlations = useMemo(() => {
    if (nodes.length === 0 || bgpData.length === 0) return [];

    // Group BGP data by prefix
    const prefixMap = new Map<string, BGPResult[]>();
    for (const b of bgpData) {
      if (!prefixMap.has(b.prefix)) prefixMap.set(b.prefix, []);
      prefixMap.get(b.prefix)!.push(b);
    }

    // Match nodes to prefixes
    return nodes
      .filter(n => n.prefix)
      .map(node => {
        const matchingBgp = prefixMap.get(node.prefix!) || [];
        const avgReach = matchingBgp.length > 0
          ? matchingBgp.reduce((s, b) => s + b.reachability, 0) / matchingBgp.length
          : -1;
        const totalUpdates = matchingBgp.reduce((s, b) => s + b.updates, 0);
        return { node, prefix: node.prefix!, matchingBgp, avgReach, totalUpdates };
      })
      .filter(c => c.matchingBgp.length > 0);
  }, [nodes, bgpData]);

  if (correlations.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No BGP prefix correlations found for path hops</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {correlations.map((c) => {
        const zConfig = ZONE_CONFIG[c.node.zone];
        return (
          <div
            key={c.node.id}
            className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg"
          >
            {/* Hop info */}
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className={`w-2 h-2 rounded-full ${zConfig?.dotColor || 'bg-slate-400'}`} />
              <span className="text-xs font-mono text-slate-900 dark:text-white">#{c.node.hopNumber}</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{c.node.ip}</span>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />

            {/* Prefix */}
            <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 min-w-[120px]">
              {c.prefix}
            </span>

            {/* Reachability */}
            <div className="flex items-center gap-2 flex-1">
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${reachabilityBarColor(c.avgReach)}`}
                  style={{ width: `${c.avgReach}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${reachabilityColor(c.avgReach)}`}>
                {c.avgReach.toFixed(0)}%
              </span>
            </div>

            {/* Updates */}
            <span className={`text-xs font-medium ${c.totalUpdates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {c.totalUpdates} upd
            </span>

            {/* Monitors count */}
            <span className="text-[10px] text-slate-400">
              {c.matchingBgp.length} mon
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// PathAnalysisPanel Component
// ============================================================================

export const PathAnalysisPanel = memo(({ tests, loading, onAskAI }: PathAnalysisPanelProps) => {
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [pathData, setPathData] = useState<PathHop[]>([]);
  const [agentTraces, setAgentTraces] = useState<PathAgentTrace[]>([]);
  const [bgpData, setBgpData] = useState<BGPResult[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);
  const [loadingBgp, setLoadingBgp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedHop, setExpandedHop] = useState<string | null>(null);

  // BGP grouped view state
  const [expandedPrefix, setExpandedPrefix] = useState<string | null>(null);
  const [bgpSearch, setBgpSearch] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [bgpView, setBgpView] = useState<'table' | 'sankey' | 'correlation'>('table');

  // View toggle for path section
  const [pathView, setPathView] = useState<'flow' | 'detail'>('flow');

  const fetchPathData = useCallback(async (testId: number) => {
    try {
      setLoadingPath(true);
      setError(null);

      const response = await fetch(`/api/thousandeyes/tests/${testId}/path-vis/detailed?organization=default&window=2h`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const pathResults = data?.results || data?._embedded?.results || [];

      // Store ALL agent traces
      const traces: PathAgentTrace[] = [];
      for (const result of pathResults) {
        const agentId = result.agent?.agentId || 'unknown';
        const agentName = result.agent?.agentName || `Agent ${agentId}`;
        const pathTraces = result.pathTraces || [];
        for (const trace of pathTraces) {
          const traceHops: PathHop[] = (trace.hops || []).map((hop: any, idx: number) => ({
            hopNumber: hop.hop || idx + 1,
            ipAddress: hop.ipAddress || hop.ip || 'N/A',
            hostname: hop.rdns || hop.hostname || hop.prefix,
            latency: Number(hop.responseTime || hop.delay || hop.latency) || 0,
            loss: Number(hop.loss) || 0,
            prefix: hop.prefix,
            network: hop.network,
          }));
          traces.push({ agentId: String(agentId), agentName, hops: traceHops });
        }
      }
      setAgentTraces(traces);

      // Best trace = longest (most complete)
      const bestTrace = traces.length > 0
        ? traces.reduce((best, t) => t.hops.length > best.hops.length ? t : best, traces[0])
        : { hops: [] as PathHop[] };
      setPathData(bestTrace.hops);
    } catch (err) {
      console.error('Failed to fetch path data:', err);
      setError('Failed to load path visualization');
      setPathData([]);
      setAgentTraces([]);
    } finally {
      setLoadingPath(false);
    }
  }, []);

  const fetchBgpData = useCallback(async (testId: number) => {
    try {
      setLoadingBgp(true);
      const response = await fetch(`/api/thousandeyes/tests/${testId}/bgp?organization=default`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const bgpResults = data?._embedded?.bgpMetrics || data?.bgpMetrics || data?._embedded?.results || data?.results || [];
      const results: BGPResult[] = bgpResults.map((r: any) => ({
        prefix: r.prefix || r.prefixId || 'N/A',
        asPath: Array.isArray(r.asPath) ? r.asPath : [],
        reachability: Number(r.reachability ?? r.avgReachability) || 100,
        updates: Number(r.updates ?? r.pathChanges) || 0,
        monitor: r.monitorName || r.monitor?.monitorName || (typeof r.monitor === 'string' ? r.monitor : null) || 'N/A',
        isActive: r.isActive ?? true,
      }));
      setBgpData(results);
    } catch (err) {
      console.error('Failed to fetch BGP data:', err);
      setBgpData([]);
    } finally {
      setLoadingBgp(false);
    }
  }, []);

  const handleTestSelect = useCallback((testId: number) => {
    setSelectedTestId(testId);
    setPathData([]);
    setAgentTraces([]);
    setBgpData([]);
    setExpandedHop(null);
    setExpandedPrefix(null);
    setBgpSearch('');
    setIssuesOnly(false);
    setPathView('flow');
    fetchPathData(testId);
    fetchBgpData(testId);
  }, [fetchPathData, fetchBgpData]);

  // Convert PathHop[] → TopologyNode[] and TopologyLink[] for shared components
  const { topologyNodes, topologyLinks } = useMemo(() => {
    if (pathData.length === 0) return { topologyNodes: [] as TopologyNode[], topologyLinks: [] as TopologyLink[] };

    const nodes: TopologyNode[] = pathData.map((hop, idx) => ({
      id: `path-hop-${idx}`,
      label: hop.hostname || '',
      ip: hop.ipAddress,
      zone: classifyZone(hop, idx, pathData.length),
      latency: hop.latency,
      loss: hop.loss,
      network: hop.network,
      hopNumber: hop.hopNumber,
      prefix: hop.prefix,
      asNumber: extractAsNumber(hop.network),
    }));

    const links: TopologyLink[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        latency: nodes[i + 1].latency,
        loss: nodes[i + 1].loss,
        health: getLinkHealth(nodes[i + 1].latency, nodes[i + 1].loss),
      });
    }

    return { topologyNodes: nodes, topologyLinks: links };
  }, [pathData]);

  // Path summary stats
  const pathStats = useMemo(() => {
    if (pathData.length === 0) return null;
    const totalLatency = pathData.reduce((s, h) => s + h.latency, 0);
    const maxHopLatency = Math.max(...pathData.map(h => h.latency));
    const hopsWithLoss = pathData.filter(h => h.loss > 0).length;
    return { totalHops: pathData.length, totalLatency, maxHopLatency, hopsWithLoss };
  }, [pathData]);

  // BGP prefix groups with filtering
  const prefixGroups = useMemo(() => {
    let groups = groupBgpByPrefix(bgpData);

    if (bgpSearch.trim()) {
      const q = bgpSearch.toLowerCase().trim();
      groups = groups.filter(g => g.prefix.toLowerCase().includes(q));
    }

    if (issuesOnly) {
      groups = groups.filter(g => g.hasIssues);
    }

    return groups;
  }, [bgpData, bgpSearch, issuesOnly]);

  // Filter to only network-type tests that support path vis
  const networkTests = tests.filter(t =>
    ['agent-to-server', 'agent-to-agent', 'network', 'http-server', 'page-load'].includes(t.type)
  );

  return (
    <DashboardCard title="Path Analysis & BGP" icon={<Route className="w-4 h-4" />} accent="purple" compact>
      {/* Test Selector */}
      <div className="pb-4 mb-4 border-b border-slate-200 dark:border-slate-700/50">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
          Select a test to analyze
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={selectedTestId || ''}
            onChange={(e) => e.target.value && handleTestSelect(Number(e.target.value))}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
          >
            <option value="">Choose a test...</option>
            {networkTests.map(test => (
              <option key={test.testId} value={test.testId}>
                {test.testName} ({test.type})
              </option>
            ))}
          </select>
        </div>
        {networkTests.length === 0 && !loading && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No network tests available for path analysis</p>
        )}
      </div>

      {!selectedTestId && (
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 dark:bg-purple-500/10 rounded-full flex items-center justify-center">
            <Route className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Select a test to view path data</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Path visualization shows hop-by-hop network traces</p>
        </div>
      )}

      {selectedTestId && (
        <div className="space-y-6">
          {/* Path Visualization Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-purple-500" /> Path Visualization
            </h4>

            {loadingPath ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Loading path data...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center">
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              </div>
            ) : pathData.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                  <Route className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No path data available</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  Path visualization requires recent test results from an agent-to-server or network test.
                </p>
              </div>
            ) : (
              <>
                {/* Path summary stats */}
                {pathStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Hops</span>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{pathStats.totalHops}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Latency</span>
                      <p className={`text-lg font-semibold ${pathStats.totalLatency > 200 ? 'text-red-500' : pathStats.totalLatency > 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {pathStats.totalLatency.toFixed(0)}ms
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max Hop Latency</span>
                      <p className={`text-lg font-semibold ${pathStats.maxHopLatency > 100 ? 'text-red-500' : pathStats.maxHopLatency > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {pathStats.maxHopLatency.toFixed(0)}ms
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hops with Loss</span>
                      <p className={`text-lg font-semibold ${pathStats.hopsWithLoss > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {pathStats.hopsWithLoss}
                      </p>
                    </div>
                  </div>
                )}

                {/* Diagnostic header */}
                <PathDiagnosticHeader nodes={topologyNodes} />

                {/* View toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
                  <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-0.5 inline-flex gap-0.5">
                    <button
                      onClick={() => setPathView('flow')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        pathView === 'flow'
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <GitBranch className="w-3 h-3" /> Flow
                    </button>
                    <button
                      onClick={() => setPathView('detail')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        pathView === 'detail'
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-3 h-3" /> Detail
                    </button>
                  </div>
                </div>

                {pathView === 'flow' ? (
                  <>
                    {/* Network path flow visualization */}
                    <div className="mb-4">
                      <NetworkPathFlow
                        nodes={topologyNodes}
                        links={topologyLinks}
                        onNodeClick={(nodeId) => {
                          setPathView('detail');
                          setExpandedHop(nodeId);
                        }}
                      />
                    </div>

                    {/* Latency waterfall chart */}
                    <LatencyWaterfallChart nodes={topologyNodes} />
                  </>
                ) : (
                  /* Detail view: compact traceroute table with multi-agent comparison */
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/30">
                          <th className="text-right pr-2 py-1.5 w-6">#</th>
                          <th className="w-5 py-1.5"></th>
                          <th className="text-left py-1.5">Address</th>
                          <th className="text-left py-1.5 hidden md:table-cell">Network</th>
                          <th className="text-right py-1.5 pr-2">Latency</th>
                          <th className="text-right py-1.5 w-14">Loss</th>
                          <th className="w-16 py-1.5"></th>
                          <th className="w-5 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/20">
                        {topologyNodes.map((node) => {
                          const isExpanded = expandedHop === node.id;
                          const maxLatency = 200;
                          const barWidth = Math.min((node.latency / maxLatency) * 100, 100);
                          const maxHopLatency = Math.max(...topologyNodes.map(n => n.latency));
                          const isBottleneck = node.latency === maxHopLatency && node.latency > 50;
                          const zConfig = ZONE_CONFIG[node.zone];

                          // Find matching hops across agents
                          const matchingHops = agentTraces.map(trace => ({
                            agentName: trace.agentName,
                            hop: trace.hops.find(h => h.ipAddress === node.ip),
                          })).filter((m): m is { agentName: string; hop: PathHop } => !!m.hop);

                          return (
                            <Fragment key={node.id}>
                              <tr
                                onClick={() => setExpandedHop(prev => prev === node.id ? null : node.id)}
                                className={`cursor-pointer group transition-colors ${
                                  isExpanded
                                    ? 'bg-slate-50 dark:bg-slate-800/30'
                                    : isBottleneck
                                      ? 'bg-red-50/50 dark:bg-red-500/5 hover:bg-red-50 dark:hover:bg-red-500/10'
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                <td className="text-[10px] text-slate-400 tabular-nums w-6 text-right pr-2 py-1.5">{node.hopNumber}</td>
                                <td className="w-5 py-1.5">
                                  <div className={`w-2 h-2 rounded-full ${zConfig?.dotColor || 'bg-slate-400'}`} />
                                </td>
                                <td className="py-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-mono text-slate-900 dark:text-white whitespace-nowrap">{node.ip}</span>
                                    {node.label && node.label !== node.ip && (
                                      <span className="text-[10px] text-slate-400 truncate max-w-[200px] hidden sm:inline">{node.label}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] py-1.5 hidden md:table-cell">{node.network || '—'}</td>
                                <td className="text-right tabular-nums py-1.5 pr-2">
                                  <span className={`text-xs font-medium ${latencyColor(node.latency)}`}>
                                    {node.latency.toFixed(0)}ms
                                  </span>
                                </td>
                                <td className="text-right tabular-nums w-14 py-1.5">
                                  {node.loss > 0 ? (
                                    <span className="text-xs font-medium text-red-500">{node.loss.toFixed(1)}%</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="w-16 py-1.5 pr-2">
                                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${node.latency > 100 ? 'bg-red-500' : node.latency > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="w-5 py-1.5">
                                  {isExpanded
                                    ? <ChevronDown className="w-3 h-3 text-slate-400" />
                                    : <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  }
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={8}>
                                    <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-700/30">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">Prefix</span>
                                          <p className="font-mono text-slate-700 dark:text-slate-300">{node.prefix || '—'}</p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">Hostname</span>
                                          <p className="text-slate-700 dark:text-slate-300 truncate">{node.label || '—'}</p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">Network / AS</span>
                                          <p className="text-slate-700 dark:text-slate-300 truncate">
                                            {node.network || '—'}
                                            {node.asNumber && <span className="text-slate-400 ml-1">(AS {node.asNumber})</span>}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-slate-400 block mb-0.5">Zone</span>
                                          <p className={zConfig?.color || 'text-slate-500'}>{zConfig?.label || node.zone}</p>
                                        </div>
                                      </div>
                                      {matchingHops.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/30">
                                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Multi-Agent Comparison</span>
                                          <table className="w-full mt-1.5 text-xs">
                                            <thead>
                                              <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700/30">
                                                <th className="text-left font-normal pb-1">Agent</th>
                                                <th className="text-right font-normal pb-1">Latency</th>
                                                <th className="text-right font-normal pb-1">Loss</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {matchingHops.map(m => (
                                                <tr key={m.agentName} className="border-b border-slate-100 dark:border-slate-700/20 last:border-0">
                                                  <td className="py-1 text-slate-700 dark:text-slate-300">{m.agentName}</td>
                                                  <td className={`py-1 text-right font-medium ${latencyColor(m.hop.latency)}`}>
                                                    {m.hop.latency.toFixed(0)}ms
                                                  </td>
                                                  <td className="py-1 text-right">
                                                    {m.hop.loss > 0
                                                      ? <span className="text-red-500 font-medium">{m.hop.loss.toFixed(1)}%</span>
                                                      : <span className="text-slate-300 dark:text-slate-600">—</span>
                                                    }
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* BGP Section */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> BGP Reachability
            </h4>

            {loadingBgp ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Loading BGP data...</span>
              </div>
            ) : bgpData.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">No BGP data available for this test</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <BgpSummaryCards groups={prefixGroups} bgpData={bgpData} />

                {/* BGP Updates Timeline Chart */}
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Path Changes by Monitor
                  </h5>
                  <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
                    <BGPUpdatesChart bgpData={bgpData} />
                  </div>
                </div>

                {/* View Toggle: Table | Sankey | Correlation */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
                  <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-0.5 inline-flex gap-0.5">
                    <button
                      onClick={() => setBgpView('table')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        bgpView === 'table'
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Search className="w-3 h-3" /> Table
                    </button>
                    <button
                      onClick={() => setBgpView('sankey')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        bgpView === 'sankey'
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <GitBranch className="w-3 h-3" /> Sankey
                    </button>
                    <button
                      onClick={() => setBgpView('correlation')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        bgpView === 'correlation'
                          ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Link2 className="w-3 h-3" /> Correlation
                    </button>
                  </div>
                </div>

                {/* BGP Views */}
                {bgpView === 'sankey' ? (
                  <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3 mb-4">
                    <BGPSankeyPathVis bgpData={bgpData} />
                  </div>
                ) : bgpView === 'correlation' ? (
                  <BgpCorrelationView nodes={topologyNodes} bgpData={bgpData} />
                ) : (
                <>

                {/* Filter bar */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by prefix..."
                      value={bgpSearch}
                      onChange={(e) => setBgpSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <button
                    onClick={() => setIssuesOnly(!issuesOnly)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      issuesOnly
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Issues only
                  </button>
                </div>

                {/* Prefix groups */}
                {prefixGroups.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {issuesOnly ? 'No prefixes with issues found' : 'No prefixes match your search'}
                    </p>
                    <button
                      onClick={() => { setBgpSearch(''); setIssuesOnly(false); }}
                      className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {prefixGroups.map((group) => (
                      <Fragment key={group.prefix}>
                        {/* Prefix row */}
                        <button
                          onClick={() => setExpandedPrefix(prev => prev === group.prefix ? null : group.prefix)}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:border-blue-300 dark:hover:border-blue-700/50 transition-colors text-left"
                        >
                          {expandedPrefix === group.prefix
                            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          }

                          {/* Prefix name */}
                          <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono min-w-[140px]">
                            {group.prefix}
                          </span>

                          {/* Monitor count badge */}
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
                            {group.monitorCount} monitor{group.monitorCount !== 1 ? 's' : ''}
                          </span>

                          {/* Reachability bar */}
                          <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full ${reachabilityBarColor(group.minReachability)}`}
                                style={{ width: `${group.avgReachability}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium whitespace-nowrap ${reachabilityColor(group.avgReachability)}`}>
                              {group.minReachability === group.maxReachability
                                ? `${group.avgReachability.toFixed(0)}%`
                                : `${group.minReachability.toFixed(0)}–${group.maxReachability.toFixed(0)}%`
                              }
                            </span>
                          </div>

                          {/* Total updates */}
                          <span className={`text-xs font-medium whitespace-nowrap ${group.totalUpdates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {group.totalUpdates} update{group.totalUpdates !== 1 ? 's' : ''}
                          </span>

                          {/* Issue indicator */}
                          {group.hasIssues && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </button>

                        {/* Expanded: per-monitor detail */}
                        {expandedPrefix === group.prefix && (
                          <div className="ml-7 mr-1 mb-2 overflow-x-auto">
                            <table className="w-full min-w-[500px]">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/50">
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Monitor</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reachability</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Updates</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AS Path</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                                {group.monitors.map((m, idx) => (
                                  <tr key={`${m.monitor}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{m.monitor}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${reachabilityBarColor(m.reachability)}`}
                                            style={{ width: `${m.reachability}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-medium ${reachabilityColor(m.reachability)}`}>{m.reachability}%</span>
                                      </div>
                                    </td>
                                    <td className={`px-3 py-2 text-xs font-medium ${m.updates > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                      {m.updates}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                      {Array.isArray(m.asPath) && m.asPath.length > 0 ? m.asPath.join(' → ') : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )}
              </>
              )}
              </>
            )}
          </div>

          {/* Ask AI */}
          {onAskAI && pathData.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => {
                  const testName = tests.find(t => t.testId === selectedTestId)?.testName || 'Unknown';
                  onAskAI(`Analyze the network path for ThousandEyes test "${testName}" (ID: ${selectedTestId}):\n\nPath hops: ${pathData.length}\nMax latency: ${Math.max(...pathData.map(h => h.latency)).toFixed(1)}ms\nHops with loss: ${pathData.filter(h => h.loss > 0).length}\n\nBGP prefixes monitored: ${prefixGroups.length}\nAvg reachability: ${bgpData.length > 0 ? (bgpData.reduce((s, b) => s + b.reachability, 0) / bgpData.length).toFixed(1) : 'N/A'}%`);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium"
              >
                Ask AI About This Path
              </button>
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
});

PathAnalysisPanel.displayName = 'PathAnalysisPanel';

export default PathAnalysisPanel;
