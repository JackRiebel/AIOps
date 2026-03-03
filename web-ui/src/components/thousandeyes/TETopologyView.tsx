'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Network, AlertTriangle, Loader2, ChevronDown, ChevronRight, LayoutGrid, GitBranch } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { isEnabled, classifyZone, getLinkHealth, extractAsNumber, latencyColor, latencyBarColor, ZONE_CONFIG, ZONE_ORDER } from './types';
import type { Test, PathHop, TopologyNode, TopologyLink, AgentTrace, PathTopology } from './types';
import { PathDiagnosticHeader } from './PathDiagnosticHeader';
import { NetworkPathFlow } from './NetworkPathFlow';
import { LatencyWaterfallChart } from './LatencyWaterfallChart';

// ============================================================================
// Types
// ============================================================================

export interface TETopologyViewProps {
  tests: Test[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}


// ============================================================================
// Hop Detail Panel (expanded row)
// ============================================================================

function HopDetailPanel({ node, agentTraces }: { node: TopologyNode; agentTraces: AgentTrace[] }) {
  const config = ZONE_CONFIG[node.zone];

  // Find matching hops across agents (by IP address)
  const matchingHops = agentTraces.map(trace => ({
    agentName: trace.agentName,
    hop: trace.hops.find(h => h.ipAddress === node.ip),
  })).filter((m): m is { agentName: string; hop: PathHop } => !!m.hop);

  return (
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
          <p className={config.color}>{config.label}</p>
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
                  <td className={`py-1 text-right font-medium ${latencyColor(m.hop.latency)}`}>{m.hop.latency.toFixed(0)}ms</td>
                  <td className="py-1 text-right">{m.hop.loss > 0 ? <span className="text-red-500 font-medium">{m.hop.loss.toFixed(1)}%</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Hop Row (replaces TopologyNodeCard)
// ============================================================================

function CompactHopRow({ node, isBottleneck, isExpanded, onToggle, agentTraces }: {
  node: TopologyNode;
  isBottleneck: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  agentTraces: AgentTrace[];
}) {
  const config = ZONE_CONFIG[node.zone];
  const maxLatency = 200;
  const barWidth = Math.min((node.latency / maxLatency) * 100, 100);

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer group transition-colors ${
          isExpanded
            ? 'bg-slate-50 dark:bg-slate-800/30'
            : isBottleneck
              ? 'bg-red-50/50 dark:bg-red-500/5 hover:bg-red-50 dark:hover:bg-red-500/10'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
        }`}
      >
        {/* Hop # */}
        <td className="text-[10px] text-slate-400 tabular-nums w-6 text-right pr-2 py-1.5">{node.hopNumber}</td>
        {/* Zone dot */}
        <td className="w-5 py-1.5">
          <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        </td>
        {/* IP + hostname */}
        <td className="py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-mono text-slate-900 dark:text-white whitespace-nowrap">{node.ip}</span>
            {node.label && node.label !== node.ip && (
              <span className="text-[10px] text-slate-400 truncate max-w-[200px] hidden sm:inline">{node.label}</span>
            )}
          </div>
        </td>
        {/* Network/AS */}
        <td className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] py-1.5 hidden md:table-cell">{node.network || '—'}</td>
        {/* Latency */}
        <td className="text-right tabular-nums py-1.5 pr-2">
          <span className={`text-xs font-medium ${latencyColor(node.latency)}`}>
            {node.latency.toFixed(0)}ms
          </span>
        </td>
        {/* Loss */}
        <td className="text-right tabular-nums w-14 py-1.5">
          {node.loss > 0 ? (
            <span className="text-xs font-medium text-red-500">{node.loss.toFixed(1)}%</span>
          ) : (
            <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
        {/* Latency bar */}
        <td className="w-16 py-1.5 pr-2">
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${latencyBarColor(node.latency)}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </td>
        {/* Expand indicator */}
        <td className="w-5 py-1.5">
          {isExpanded
            ? <ChevronDown className="w-3 h-3 text-slate-400" />
            : <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        </td>
      </tr>
      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={8}>
            <HopDetailPanel node={node} agentTraces={agentTraces} />
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// Path Topology Card
// ============================================================================

function PathTopologyCard({ topology, onAskAI }: { topology: PathTopology; onAskAI?: (ctx: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedHop, setExpandedHop] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flow' | 'detail'>('flow');

  const bottleneckNode = useMemo(() => {
    if (topology.nodes.length === 0) return null;
    return topology.nodes.reduce((max, n) => n.latency > max.latency ? n : max, topology.nodes[0]);
  }, [topology.nodes]);

  const zoneIssues = useMemo(() => {
    const issues: string[] = [];
    const zones = ['local', 'isp', 'cloud'] as const;
    for (const zone of zones) {
      const zoneNodes = topology.nodes.filter(n => n.zone === zone);
      const zoneLoss = Math.max(0, ...zoneNodes.map(n => n.loss));
      const zoneLatency = zoneNodes.reduce((s, n) => s + n.latency, 0);
      if (zoneLoss > 5) issues.push(`${ZONE_CONFIG[zone].label}: ${zoneLoss.toFixed(1)}% packet loss`);
      else if (zoneLatency > 150) issues.push(`${ZONE_CONFIG[zone].label}: ${zoneLatency.toFixed(0)}ms latency`);
    }
    return issues;
  }, [topology.nodes]);

  return (
    <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="text-sm font-semibold text-slate-900 dark:text-white flex-1 truncate">
          {topology.testName}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded">
          {topology.testType}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {topology.nodes.length} hops
          </span>
          <span className={`font-medium ${topology.totalLatency > 200 ? 'text-red-500' : topology.totalLatency > 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {topology.totalLatency.toFixed(0)}ms
          </span>
          {topology.maxLoss > 0 && (
            <span className="font-medium text-red-500">{topology.maxLoss.toFixed(1)}% loss</span>
          )}
          {zoneIssues.length > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-200 dark:border-slate-700/50">
          {topology.loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading path data...</span>
            </div>
          ) : topology.error ? (
            <div className="py-4 text-center text-sm text-red-500">{topology.error}</div>
          ) : topology.nodes.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-500">No path data available</div>
          ) : (
            <>
              {/* Diagnostic header */}
              <PathDiagnosticHeader nodes={topology.nodes} />

              {/* View toggle */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">View:</span>
                <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-0.5 inline-flex gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewMode('flow'); }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      viewMode === 'flow'
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <GitBranch className="w-3 h-3" /> Flow
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewMode('detail'); }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      viewMode === 'detail'
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" /> Detail
                  </button>
                </div>
              </div>

              {viewMode === 'flow' ? (
                <>
                  {/* Network path flow visualization */}
                  <div className="mb-4">
                    <NetworkPathFlow
                      nodes={topology.nodes}
                      links={topology.links}
                      onNodeClick={(nodeId) => {
                        setViewMode('detail');
                        setExpandedHop(nodeId);
                      }}
                    />
                  </div>

                  {/* Latency waterfall chart */}
                  <LatencyWaterfallChart nodes={topology.nodes} />
                </>
              ) : (
                /* Detail view: compact traceroute table */
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
                      {topology.nodes.map(node => (
                        <CompactHopRow
                          key={node.id}
                          node={node}
                          isBottleneck={bottleneckNode?.id === node.id && node.latency > 50}
                          isExpanded={expandedHop === node.id}
                          onToggle={() => setExpandedHop(prev => prev === node.id ? null : node.id)}
                          agentTraces={topology.agentTraces}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ask AI button */}
              {onAskAI && topology.nodes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  <button
                    onClick={() => onAskAI(
                      `Analyze the network path topology for ThousandEyes test "${topology.testName}" (${topology.testType}):\n\n` +
                      `Path: ${topology.nodes.length} hops, Total latency: ${topology.totalLatency.toFixed(0)}ms, Max loss: ${topology.maxLoss.toFixed(1)}%\n` +
                      `Zones: ${(['local', 'isp', 'cloud'] as const).map(z => {
                        const zn = topology.nodes.filter(n => n.zone === z);
                        return `${ZONE_CONFIG[z].label}: ${zn.length} hops, ${zn.reduce((s,n) => s+n.latency,0).toFixed(0)}ms`;
                      }).join(' | ')}\n` +
                      (topology.bottleneckZone ? `\nBottleneck: ${topology.bottleneckZone}` : '') +
                      (zoneIssues.length > 0 ? `\nIssues: ${zoneIssues.join('; ')}` : '') +
                      `\n\nIdentify where the issue is: my local network, ISP transit, or cloud provider? Recommend next steps.`
                    )}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-cyan-700 transition font-medium"
                  >
                    Analyze Path Issues with AI
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TETopologyView Component
// ============================================================================

export const TETopologyView = memo(({ tests, loading, onAskAI }: TETopologyViewProps) => {
  const [topologies, setTopologies] = useState<Record<number, PathTopology>>({});
  const [loadingTests, setLoadingTests] = useState<Set<number>>(new Set());
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Network-type tests that support path visualization
  const networkTests = useMemo(() =>
    tests.filter(t =>
      isEnabled(t.enabled) &&
      ['agent-to-server', 'agent-to-agent', 'network', 'http-server', 'page-load'].includes(t.type)
    ),
  [tests]);

  const fetchPathTopology = useCallback(async (test: Test) => {
    if (loadingTests.has(test.testId)) return;

    setLoadingTests(prev => new Set(prev).add(test.testId));
    setTopologies(prev => ({
      ...prev,
      [test.testId]: {
        testId: test.testId,
        testName: test.testName,
        testType: test.type,
        nodes: [],
        links: [],
        totalLatency: 0,
        maxLoss: 0,
        bottleneckZone: null,
        loading: true,
        error: null,
        agentTraces: [],
      },
    }));

    try {
      const response = await fetch(`/api/thousandeyes/tests/${test.testId}/path-vis/detailed?organization=default&window=2h`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const pathResults = data?.results || data?._embedded?.results || [];

      // Store ALL agent traces (not just the best one)
      const agentTraces: AgentTrace[] = [];
      for (const result of pathResults) {
        const agentId = result.agent?.agentId || 'unknown';
        const agentName = result.agent?.agentName || `Agent ${agentId}`;
        const traces = result.pathTraces || [];
        for (const trace of traces) {
          const traceHops: PathHop[] = (trace.hops || []).map((hop: any, idx: number) => ({
            hopNumber: hop.hop || idx + 1,
            ipAddress: hop.ipAddress || hop.ip || 'N/A',
            hostname: hop.rdns || hop.hostname || hop.prefix,
            latency: Number(hop.responseTime || hop.delay || hop.latency) || 0,
            loss: Number(hop.loss) || 0,
            prefix: hop.prefix,
            network: hop.network,
          }));
          agentTraces.push({ agentId: String(agentId), agentName, hops: traceHops });
        }
      }

      // Best trace = longest (most complete)
      const bestTrace = agentTraces.length > 0
        ? agentTraces.reduce((best, t) => t.hops.length > best.hops.length ? t : best, agentTraces[0])
        : { hops: [] as PathHop[] };

      // Build topology nodes from best trace, carrying prefix through
      const nodes: TopologyNode[] = bestTrace.hops.map((hop, idx) => ({
        id: `${test.testId}-hop-${idx}`,
        label: hop.hostname || '',
        ip: hop.ipAddress,
        zone: classifyZone(hop, idx, bestTrace.hops.length),
        latency: hop.latency,
        loss: hop.loss,
        network: hop.network,
        hopNumber: hop.hopNumber,
        prefix: hop.prefix,
        asNumber: extractAsNumber(hop.network),
      }));

      // Build topology links
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

      // Find bottleneck zone
      const zoneLatencies = new Map<string, number>();
      nodes.forEach(n => {
        zoneLatencies.set(n.zone, (zoneLatencies.get(n.zone) || 0) + n.latency);
      });
      let maxZoneLatency = 0;
      let bottleneckZone: string | null = null;
      zoneLatencies.forEach((lat, zone) => {
        if (lat > maxZoneLatency && zone !== 'source' && zone !== 'destination') {
          maxZoneLatency = lat;
          bottleneckZone = zone;
        }
      });

      setTopologies(prev => ({
        ...prev,
        [test.testId]: {
          testId: test.testId,
          testName: test.testName,
          testType: test.type,
          nodes,
          links,
          totalLatency: nodes.reduce((s, n) => s + n.latency, 0),
          maxLoss: nodes.length > 0 ? Math.max(...nodes.map(n => n.loss)) : 0,
          bottleneckZone: bottleneckZone ? ZONE_CONFIG[bottleneckZone]?.label || bottleneckZone : null,
          loading: false,
          error: null,
          agentTraces,
        },
      }));
    } catch (err: any) {
      setTopologies(prev => ({
        ...prev,
        [test.testId]: {
          ...prev[test.testId],
          loading: false,
          error: err.message || 'Failed to load path data',
        },
      }));
    } finally {
      setLoadingTests(prev => {
        const next = new Set(prev);
        next.delete(test.testId);
        return next;
      });
    }
  }, [loadingTests]);

  // Auto-load first 5 tests
  const handleAutoLoad = useCallback(() => {
    if (autoLoaded || networkTests.length === 0) return;
    setAutoLoaded(true);
    const toLoad = networkTests.slice(0, 5);
    toLoad.forEach(test => fetchPathTopology(test));
  }, [autoLoaded, networkTests, fetchPathTopology]);

  // Trigger auto-load when tests are available
  if (!autoLoaded && networkTests.length > 0 && !loading) {
    handleAutoLoad();
  }

  // Sort topologies: issues first, then by total latency
  const sortedTopologies = useMemo(() => {
    return Object.values(topologies).sort((a, b) => {
      if (a.maxLoss > 0 && b.maxLoss === 0) return -1;
      if (b.maxLoss > 0 && a.maxLoss === 0) return 1;
      return b.totalLatency - a.totalLatency;
    });
  }, [topologies]);

  // Summary stats
  const summary = useMemo(() => {
    const loaded = sortedTopologies.filter(t => !t.loading && !t.error && t.nodes.length > 0);
    const withIssues = loaded.filter(t => t.maxLoss > 1 || t.totalLatency > 200);
    const avgLatency = loaded.length > 0 ? loaded.reduce((s, t) => s + t.totalLatency, 0) / loaded.length : 0;

    // Max hop latency across all loaded topologies
    let maxHopLatency = 0;
    loaded.forEach(t => {
      t.nodes.forEach(n => {
        if (n.latency > maxHopLatency) maxHopLatency = n.latency;
      });
    });

    return { loaded: loaded.length, withIssues: withIssues.length, avgLatency, maxHopLatency };
  }, [sortedTopologies]);

  if (!loading && networkTests.length === 0) {
    return (
      <DashboardCard title="Network Topology" icon={<Network className="w-4 h-4" />} accent="cyan" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
            <Network className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No network tests available</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create agent-to-server or network tests to view topology</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Network Topology" icon={<Network className="w-4 h-4" />} accent="cyan" compact>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paths Analyzed</span>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{summary.loaded}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">With Issues</span>
          <p className={`text-lg font-semibold ${summary.withIssues > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{summary.withIssues}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Latency</span>
          <p className={`text-lg font-semibold ${summary.avgLatency > 200 ? 'text-red-500' : summary.avgLatency > 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {summary.avgLatency.toFixed(0)}ms
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Max Hop</span>
          <p className={`text-lg font-semibold ${summary.maxHopLatency > 100 ? 'text-red-500' : summary.maxHopLatency > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {summary.maxHopLatency.toFixed(0)}ms
          </p>
        </div>
      </div>

      {/* Zone legend */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {ZONE_ORDER.map(zone => {
          const config = ZONE_CONFIG[zone];
          return (
            <div key={zone} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Load more tests button */}
      {networkTests.length > Object.keys(topologies).length && (
        <div className="mb-4">
          <button
            onClick={() => {
              const loaded = new Set(Object.keys(topologies).map(Number));
              const unloaded = networkTests.filter(t => !loaded.has(t.testId)).slice(0, 5);
              unloaded.forEach(test => fetchPathTopology(test));
            }}
            className="px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition"
          >
            Load more paths ({networkTests.length - Object.keys(topologies).length} remaining)
          </button>
        </div>
      )}

      {/* Path topologies */}
      <div className="space-y-3">
        {sortedTopologies.map(topology => (
          <PathTopologyCard
            key={topology.testId}
            topology={topology}
            onAskAI={onAskAI}
          />
        ))}
      </div>

      {loading && sortedTopologies.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading tests...</span>
        </div>
      )}
    </DashboardCard>
  );
});

TETopologyView.displayName = 'TETopologyView';
export default TETopologyView;
