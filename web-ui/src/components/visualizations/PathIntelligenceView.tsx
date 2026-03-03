'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  AlertTriangle,
  Activity,
  Globe,
  ChevronRight,
  Loader2,
  RefreshCw,
  Network,
  MapPin,
  Server,
  Wifi,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { Test, TestResult, PathHop, TopologyNode, TopologyLink, BGPResult } from '@/components/thousandeyes/types';
import { isEnabled, ZONE_CONFIG, classifyZone, getLinkHealth, extractAsNumber, latencyColor } from '@/components/thousandeyes/types';
import { PathDiagnosticHeader } from '@/components/thousandeyes/PathDiagnosticHeader';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import type { TimeRange } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

interface PathIntelligenceViewProps {
  tests: Test[];
  testResults: Record<number, TestResult[]>;
  fetchTestResults: (testId: number, testType: string) => Promise<void>;
  isConfigured: boolean;
}

interface PathAgentTrace {
  agentId: string;
  agentName: string;
  hops: PathHop[];
}

// ============================================================================
// Test List Item
// ============================================================================

const TestListItem = memo(({ test, isSelected, onClick }: {
  test: Test;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const metrics = test._latestMetrics;
  const healthColor = !metrics ? 'bg-slate-400'
    : (metrics.loss && metrics.loss > 5) || (metrics.latency && metrics.latency > 200) ? 'bg-red-500'
    : (metrics.loss && metrics.loss > 1) || (metrics.latency && metrics.latency > 100) ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
        isSelected
          ? 'bg-cyan-500/10 border border-cyan-500/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${healthColor}`} />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {test.testName}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 ml-4">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{test.type}</span>
        {metrics?.latency !== undefined && (
          <span className={`text-[10px] font-medium ${latencyColor(metrics.latency)}`}>
            {metrics.latency.toFixed(0)}ms
          </span>
        )}
        {metrics?.loss !== undefined && metrics.loss > 0 && (
          <span className="text-[10px] font-medium text-red-500">
            {metrics.loss.toFixed(1)}% loss
          </span>
        )}
      </div>
    </button>
  );
});
TestListItem.displayName = 'TestListItem';

// ============================================================================
// Hop Detail Table
// ============================================================================

const HopDetailTable = memo(({ hops }: { hops: PathHop[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
            <th className="pr-2 pb-2 font-semibold">#</th>
            <th className="pr-2 pb-2 font-semibold">IP / Host</th>
            <th className="pr-2 pb-2 font-semibold">AS#</th>
            <th className="pr-2 pb-2 font-semibold">Network</th>
            <th className="pr-2 pb-2 font-semibold">Zone</th>
            <th className="pr-2 pb-2 text-right font-semibold">Latency</th>
            <th className="pb-2 text-right font-semibold">Loss</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((hop, i) => {
            const zone = classifyZone(hop, i, hops.length);
            const zoneCfg = ZONE_CONFIG[zone];
            const asn = extractAsNumber(hop.network);
            const latClass = hop.latency > 100 ? 'text-red-500' : hop.latency > 50 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400';
            return (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                <td className="pr-2 py-1.5 text-slate-400 font-mono">{hop.hopNumber}</td>
                <td className="pr-2 py-1.5">
                  <div className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={`${hop.hostname || ''} (${hop.ipAddress})`}>
                    {hop.hostname || hop.ipAddress}
                  </div>
                  {hop.hostname && hop.hostname !== hop.ipAddress && (
                    <div className="text-[9px] font-mono text-slate-400">{hop.ipAddress}</div>
                  )}
                </td>
                <td className="pr-2 py-1.5 text-cyan-600 dark:text-cyan-400 font-mono">{asn ? `AS${asn}` : '—'}</td>
                <td className="pr-2 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {hop.network ? hop.network.replace(/AS\s*\d+\s*/i, '').trim() || '—' : '—'}
                </td>
                <td className="pr-2 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneCfg?.dotColorHex || '#94a3b8' }} />
                    <span className={zoneCfg?.color || ''}>{zoneCfg?.label || zone}</span>
                  </span>
                </td>
                <td className={`pr-2 py-1.5 text-right font-mono font-semibold ${latClass}`}>{hop.latency.toFixed(1)}ms</td>
                <td className={`py-1.5 text-right font-mono ${hop.loss > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                  {hop.loss > 0 ? `${hop.loss.toFixed(1)}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
HopDetailTable.displayName = 'HopDetailTable';

// ============================================================================
// Agent Trace Selector
// ============================================================================

const AgentTraceSelector = memo(({ traces, selectedIdx, onSelect }: {
  traces: PathAgentTrace[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) => {
  if (traces.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agent Trace:</span>
      {traces.map((trace, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(idx)}
          className={`px-2 py-1 text-[10px] rounded-md transition-all ${
            idx === selectedIdx
              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/30 border border-transparent'
          }`}
        >
          {trace.agentName} ({trace.hops.length} hops)
        </button>
      ))}
    </div>
  );
});
AgentTraceSelector.displayName = 'AgentTraceSelector';

// ============================================================================
// Path Intelligence View — Main Component
// ============================================================================

export function PathIntelligenceView({ tests: teTests, testResults: teTestResults, fetchTestResults: fetchTETestResults, isConfigured: teConfigured }: PathIntelligenceViewProps) {
  const router = useRouter();
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  // Path-vis data state
  const [pathHops, setPathHops] = useState<PathHop[]>([]);
  const [agentTraces, setAgentTraces] = useState<PathAgentTrace[]>([]);
  const [selectedTraceIdx, setSelectedTraceIdx] = useState(0);
  const [loadingPath, setLoadingPath] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  // Filter tests
  const filteredTests = useMemo(() => {
    let tests = teTests.filter(t => isEnabled(t.enabled));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tests = tests.filter(t => t.testName.toLowerCase().includes(q) || t.type.toLowerCase().includes(q));
    }
    return tests;
  }, [teTests, searchQuery]);

  // Group tests by type
  const testGroups = useMemo(() => {
    const groups: Record<string, Test[]> = {};
    filteredTests.forEach(test => {
      const type = test.type || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(test);
    });
    return groups;
  }, [filteredTests]);

  const selectedTest = useMemo(() => {
    return teTests.find(t => t.testId === selectedTestId) || null;
  }, [teTests, selectedTestId]);

  // Get test results for time-series chart
  const selectedResults = useMemo((): TestResult[] => {
    if (!selectedTestId) return [];
    return teTestResults[selectedTestId] || [];
  }, [selectedTestId, teTestResults]);

  // Fetch real path-vis data from TE API
  const fetchPathData = useCallback(async (testId: number) => {
    try {
      setLoadingPath(true);
      setPathError(null);
      setPathHops([]);
      setAgentTraces([]);
      setSelectedTraceIdx(0);

      const response = await fetch(`/api/thousandeyes/tests/${testId}/path-vis/detailed?organization=default&window=2h`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const pathResults = data?.results || data?._embedded?.results || [];

      // Parse ALL agent traces
      const traces: PathAgentTrace[] = [];
      for (const result of pathResults) {
        const agentId = result.agent?.agentId || 'unknown';
        const agentName = result.agent?.agentName || `Agent ${agentId}`;
        const pathTraces = result.pathTraces || [];
        for (const trace of pathTraces) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const traceHops: PathHop[] = (trace.hops || []).map((hop: any, idx: number) => ({
            hopNumber: hop.hop || idx + 1,
            ipAddress: hop.ipAddress || hop.ip || 'N/A',
            hostname: hop.rdns || hop.hostname || hop.prefix,
            latency: Number(hop.responseTime || hop.delay || hop.latency) || 0,
            loss: Number(hop.loss) || 0,
            prefix: hop.prefix,
            network: hop.network,
          }));
          if (traceHops.length > 0) {
            traces.push({ agentId: String(agentId), agentName, hops: traceHops });
          }
        }
      }
      setAgentTraces(traces);

      // Best trace = longest (most complete path)
      if (traces.length > 0) {
        const bestIdx = traces.reduce((bestI, t, i) => t.hops.length > traces[bestI].hops.length ? i : bestI, 0);
        setSelectedTraceIdx(bestIdx);
        setPathHops(traces[bestIdx].hops);
      } else {
        // Fallback: build minimal 2-hop path from test results
        setPathHops([]);
      }
    } catch (err) {
      console.error('Failed to fetch path data:', err);
      setPathError('Failed to load path visualization. This test may not support path-vis data.');
      setPathHops([]);
      setAgentTraces([]);
    } finally {
      setLoadingPath(false);
    }
  }, []);

  // Handle trace selection
  const handleTraceSelect = useCallback((idx: number) => {
    setSelectedTraceIdx(idx);
    if (agentTraces[idx]) {
      setPathHops(agentTraces[idx].hops);
    }
  }, [agentTraces]);

  // Convert PathHop[] → TopologyNode[] and TopologyLink[] for shared components
  const { topologyNodes, topologyLinks } = useMemo(() => {
    if (pathHops.length === 0) return { topologyNodes: [] as TopologyNode[], topologyLinks: [] as TopologyLink[] };

    const nodes: TopologyNode[] = pathHops.map((hop, idx) => ({
      id: `path-hop-${idx}`,
      label: hop.hostname || '',
      ip: hop.ipAddress,
      zone: classifyZone(hop, idx, pathHops.length),
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
  }, [pathHops]);

  // Compute summary stats
  const pathStats = useMemo(() => {
    if (pathHops.length === 0) return null;
    const totalLatency = pathHops.reduce((s, h) => s + h.latency, 0);
    const maxLoss = Math.max(...pathHops.map(h => h.loss));
    const bottleneckHop = pathHops.reduce((max, h) => h.latency > max.latency ? h : max, pathHops[0]);
    const lossHops = pathHops.filter(h => h.loss > 0).length;
    return { totalLatency, maxLoss, bottleneckHop, lossHops, hopCount: pathHops.length };
  }, [pathHops]);

  // Handle test selection
  const handleTestSelect = useCallback((testId: number) => {
    setSelectedTestId(testId);
    const test = teTests.find(t => t.testId === testId);
    if (test) {
      fetchTETestResults(testId, test.type);
    }
    fetchPathData(testId);
  }, [teTests, fetchTETestResults, fetchPathData]);

  // AI analysis with full hop details
  const analyzePath = useCallback(() => {
    if (!selectedTest || pathHops.length === 0) return;
    const hopDetails = pathHops.map(h => {
      const zone = classifyZone(h, pathHops.indexOf(h), pathHops.length);
      return `Hop ${h.hopNumber}: ${h.hostname || h.ipAddress} (${h.latency.toFixed(0)}ms, ${h.loss.toFixed(1)}% loss, zone=${zone}${h.network ? `, network=${h.network}` : ''})`;
    }).join('. ');
    const prompt = `Analyze ThousandEyes path for "${selectedTest.testName}" (${selectedTest.type}) with ${pathHops.length} hops: ${hopDetails}. Identify the bottleneck hop/zone and recommend specific optimizations.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [selectedTest, pathHops, router]);

  // Not configured state
  if (!teConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <Globe className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">ThousandEyes Not Configured</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure ThousandEyes integration to view path intelligence</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[600px]">
      {/* Test List Panel */}
      <div className="w-[280px] flex-shrink-0 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 dark:text-slate-300"
            />
          </div>
        </div>

        {/* Test groups */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {Object.entries(testGroups).map(([type, tests]) => (
            <div key={type}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {type}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400">
                  {tests.length}
                </span>
              </div>
              {tests.map(test => (
                <TestListItem
                  key={test.testId}
                  test={test}
                  isSelected={selectedTestId === test.testId}
                  onClick={() => handleTestSelect(test.testId)}
                />
              ))}
            </div>
          ))}

          {filteredTests.length === 0 && (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No tests found</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {!selectedTest ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <ChevronRight className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Select a Test</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Choose a test from the list to visualize the full network path</p>
          </div>
        ) : loadingPath ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading path visualization data...</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Fetching hop-by-hop data from ThousandEyes</p>
          </div>
        ) : pathError && pathHops.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
            <p className="text-xs text-slate-600 dark:text-slate-400">{pathError}</p>
            <button
              onClick={() => fetchPathData(selectedTestId!)}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        ) : pathHops.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <Network className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-xs text-slate-600 dark:text-slate-400">No path-vis data available for this test type.</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Path visualization requires network or HTTP server tests</p>
          </div>
        ) : (
          <>
            {/* Header: Test info + actions */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Network className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{selectedTest.testName}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="uppercase">{selectedTest.type}</span>
                    <span>·</span>
                    <span>{pathStats?.hopCount} hops</span>
                    <span>·</span>
                    <span className={latencyColor(pathStats?.totalLatency || 0)}>{pathStats?.totalLatency?.toFixed(0)}ms total</span>
                    {(pathStats?.maxLoss || 0) > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-red-500">{pathStats?.lossHops} hops with loss</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchPathData(selectedTestId!)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/30 rounded-lg transition"
                  title="Refresh path data"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
                <button
                  onClick={analyzePath}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze Path
                </button>
              </div>
            </div>

            {/* Agent Trace Selector (if multiple traces) */}
            {agentTraces.length > 1 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-2.5">
                <AgentTraceSelector traces={agentTraces} selectedIdx={selectedTraceIdx} onSelect={handleTraceSelect} />
              </div>
            )}

            {/* Path Diagnostic Header — bottleneck diagnosis */}
            {topologyNodes.length > 0 && (
              <PathDiagnosticHeader nodes={topologyNodes} />
            )}

            {/* Network Path Flow — full SVG hop-by-hop visualization */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-cyan-500" />
                  Network Path ({pathHops.length} hops)
                </h3>
                {/* Zone legend */}
                <div className="flex items-center gap-3">
                  {(['source', 'local', 'isp', 'cloud', 'destination'] as const).map(zone => {
                    const cfg = ZONE_CONFIG[zone];
                    return (
                      <div key={zone} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dotColorHex }} />
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <NetworkPathFlow nodes={topologyNodes} links={topologyLinks} />
            </div>

            {/* Per-Hop Latency Waterfall Chart */}
            {topologyNodes.length > 0 && (
              <LatencyWaterfallChart nodes={topologyNodes} />
            )}

            {/* Summary Stats Cards */}
            {pathStats && (
              <div className="grid grid-cols-4 gap-3">
                <StatCard
                  icon={<Activity className="w-4 h-4 text-cyan-500" />}
                  label="Total Hops"
                  value={`${pathStats.hopCount}`}
                />
                <StatCard
                  icon={<MapPin className="w-4 h-4 text-emerald-500" />}
                  label="Total Latency"
                  value={`${pathStats.totalLatency.toFixed(0)}ms`}
                  valueClass={latencyColor(pathStats.totalLatency)}
                />
                <StatCard
                  icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                  label="Peak Hop Latency"
                  value={`${pathStats.bottleneckHop.latency.toFixed(0)}ms`}
                  sub={`Hop #${pathStats.bottleneckHop.hopNumber}`}
                  valueClass={latencyColor(pathStats.bottleneckHop.latency)}
                />
                <StatCard
                  icon={<Wifi className="w-4 h-4 text-red-500" />}
                  label="Max Loss"
                  value={pathStats.maxLoss > 0 ? `${pathStats.maxLoss.toFixed(1)}%` : '0%'}
                  sub={pathStats.lossHops > 0 ? `${pathStats.lossHops} hops affected` : undefined}
                  valueClass={pathStats.maxLoss > 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}
                />
              </div>
            )}

            {/* Hop Detail Table */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                Hop Detail
              </h3>
              <HopDetailTable hops={pathHops} />
            </div>

            {/* Metrics Time Series */}
            {selectedResults.length > 0 && (
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Test Metrics Over Time</span>
                  <div className="flex gap-1">
                    {(['1h', '6h', '24h', '7d'] as TimeRange[]).map(tr => (
                      <button
                        key={tr}
                        onClick={() => setTimeRange(tr)}
                        className={`px-2 py-0.5 text-[10px] rounded transition ${
                          timeRange === tr
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedResults.slice(-50)}>
                      <defs>
                        <linearGradient id="piLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }}
                      />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={40} />
                      <Tooltip
                        isAnimationActive={false}
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#piLatencyGrad)"
                        name="Latency (ms)"
                        isAnimationActive={false}
                      />
                      {selectedResults.some(r => r.loss !== undefined && r.loss > 0) && (
                        <Area
                          type="monotone"
                          dataKey="loss"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          fill="none"
                          name="Loss (%)"
                          isAnimationActive={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

function StatCard({ icon, label, value, sub, valueClass }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
        <div className={`text-sm font-mono font-bold ${valueClass || 'text-slate-800 dark:text-slate-200'}`}>
          {value}
          {sub && <span className="text-[9px] text-slate-400 ml-1 font-normal">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

export default PathIntelligenceView;
