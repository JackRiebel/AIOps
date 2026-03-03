import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { PathHop } from '@/components/thousandeyes/types';
import { classifyZone, getLinkHealth } from '@/components/thousandeyes/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIProvider {
  provider: string;
  display_name: string;
  test_mode: 'network_only' | 'full_assurance';
  tests: AIAssuranceTest[];
  status: string;
  source?: 'managed' | 'discovered';
}

export interface AIAssuranceTest {
  testId?: number;
  id?: number;
  testName?: string;
  type?: string;
  [key: string]: unknown;
}

export interface HopNodeData {
  hopNumber: number;
  ipAddress: string;
  hostname?: string;
  latency: number;
  loss: number;
  zone: string;
  network?: string;
  isBottleneck: boolean;
  [key: string]: unknown;
}

export interface PathEdgeData {
  hopLatency: number;
  [key: string]: unknown;
}

export interface PathAgentTrace {
  agentId: string;
  agentName: string;
  hops: PathHop[];
}

export interface AIMetrics {
  avg_response_time_ms: number;
  availability_pct: number;
  path_latency_ms: number;
  path_loss_pct: number;
  path_health: 'healthy' | 'degraded' | 'failing';
}

export interface CostAnalysis {
  provider: string | null;
  period_hours: number;
  total_ai_cost_usd: number;
  total_queries: number;
  avg_api_latency_ms: number;
  avg_network_latency_ms: number | null;
  network_latency_pct: number | null;
  latency_cost_impact: {
    baseline_latency_ms: number;
    actual_avg_latency_ms: number;
    excess_latency_ms: number;
    total_excess_wait_s: number;
    suspected_slow_queries: number;
    estimated_retry_cost_usd: number;
  } | null;
  hourly_breakdown: {
    hour: string;
    queries: number;
    cost_usd: number;
    avg_api_latency_ms: number;
    path_health: string;
  }[];
  path_summary: Record<string, unknown> | null;
  token_waste?: {
    suspected_slow_queries: number;
    estimated_retry_tokens: number;
    total_productive_tokens: number;
    waste_pct: number;
    estimated_retry_cost_usd: number;
  } | null;
  user_impact?: {
    avg_wait_time_ms: number;
    p50_wait_time_ms: number;
    p95_wait_time_ms: number;
    timeout_probability_pct: number;
    degraded_query_pct: number;
    total_excess_wait_s: number;
    timeout_count: number;
    total_queries: number;
  } | null;
}

export interface UseAIPathJourneyReturn {
  providers: AIProvider[];
  selectedProvider: string | null;
  setSelectedProvider: (p: string | null) => void;
  pathNodes: Node<HopNodeData>[];
  pathEdges: Edge<PathEdgeData>[];
  pathHops: PathHop[];
  agentTraces: PathAgentTrace[];
  selectedTraceIdx: number;
  selectTrace: (idx: number) => void;
  metrics: AIMetrics | null;
  costAnalysis: CostAnalysis | null;
  testResults: Record<string, unknown>[];
  currentTestId: number | null;
  loading: boolean;
  error: string | null;
  refreshProviders: () => Promise<void>;
  createTest: (provider: string, mode: string, customUrl?: string) => Promise<void>;
  deleteTest: (provider: string) => Promise<void>;
  setupOpen: boolean;
  setSetupOpen: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL = 60_000;

export function useAIPathJourney(): UseAIPathJourneyReturn {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [pathNodes, setPathNodes] = useState<Node<HopNodeData>[]>([]);
  const [pathEdges, setPathEdges] = useState<Edge<PathEdgeData>[]>([]);
  const [pathHops, setPathHops] = useState<PathHop[]>([]);
  const [agentTraces, setAgentTraces] = useState<PathAgentTrace[]>([]);
  const [selectedTraceIdx, setSelectedTraceIdx] = useState(0);
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis | null>(null);
  const [testResults, setTestResults] = useState<Record<string, unknown>[]>([]);
  const [currentTestId, setCurrentTestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- Fetch provider list ----
  const refreshProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/thousandeyes/ai-assurance/tests', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Filter out platform providers (ThousandEyes, Meraki, etc.) — AI Journey is for AI providers only
      const aiProviders = (data.providers || []).filter(
        (p: { category?: string }) => p.category !== 'platform'
      );
      setProviders(aiProviders);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch AI Assurance tests:', err);
      setError('Unable to load AI Assurance tests');
    }
  }, []);

  // ---- Fetch path data for selected provider ----
  const fetchPathData = useCallback(async (provider: string) => {
    // Cancel any in-flight fetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    // Clear stale data from previous provider
    setPathNodes([]);
    setPathEdges([]);
    setPathHops([]);
    setAgentTraces([]);
    setSelectedTraceIdx(0);
    setMetrics(null);
    setCostAnalysis(null);
    setTestResults([]);
    setLoading(true);

    try {
      // 1. Get provider metrics
      const metricsRes = await fetch(
        `/api/thousandeyes/ai-assurance/tests/${provider}/metrics`,
        { credentials: 'include', signal }
      );
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();

        // Find network/agent-to-server test for path data
        const netTest = metricsData.tests?.find((t: { test_name?: string }) =>
          t.test_name?.includes('Network Path')
        ) || metricsData.tests?.find((t: { test_type?: string }) =>
          t.test_type?.includes('agent-to-server')
        );
        const testId = netTest?.test_id;
        setCurrentTestId(testId ? Number(testId) : null);

        // Also find any HTTP test for response time metrics
        const httpTest = metricsData.tests?.find((t: { test_type?: string }) =>
          t.test_type?.includes('http-server') || t.test_type?.includes('page-load')
        );
        const httpTestId = httpTest?.test_id;

        if (testId) {
          // Fetch path-vis and test results in parallel
          const [pathRes, resultsRes] = await Promise.all([
            fetch(
              `/api/thousandeyes/tests/${testId}/path-vis/detailed?organization=default&window=2h`,
              { credentials: 'include', signal }
            ),
            fetch(
              `/api/thousandeyes/tests/${testId}/results?organization=default&test_type=agent-to-server`,
              { credentials: 'include', signal }
            ),
          ]);

          if (pathRes.ok) {
            const pathData = await pathRes.json();
            transformPathToFlow(pathData);
          }
          if (resultsRes.ok) {
            const resultsData = await resultsRes.json();
            // Unwrap double-nested results: API returns { results: { results: [...] } }
            let items = resultsData;
            if (!Array.isArray(items)) {
              items = items.results;
              if (items && !Array.isArray(items)) {
                items = items.results || [];
              }
            }
            setTestResults(Array.isArray(items) ? items : []);
          }
        }

        // Also fetch HTTP test results if available (for response time overlay)
        if (httpTestId && httpTestId !== testId) {
          try {
            const httpRes = await fetch(
              `/api/thousandeyes/tests/${httpTestId}/results?organization=default&test_type=http-server`,
              { credentials: 'include', signal }
            );
            if (httpRes.ok) {
              const httpData = await httpRes.json();
              // Unwrap double-nested results
              let rawHttp = httpData;
              if (!Array.isArray(rawHttp)) {
                rawHttp = rawHttp.results;
                if (rawHttp && !Array.isArray(rawHttp)) {
                  rawHttp = rawHttp.results || [];
                }
              }
              const httpResults = Array.isArray(rawHttp) ? rawHttp : [];
              if (httpResults.length > 0) {
                setTestResults(prev => {
                  if (prev.length === 0) return httpResults;
                  return prev.map((r: Record<string, unknown>, i: number) => ({
                    ...r,
                    responseTime: (httpResults[i] as Record<string, unknown>)?.responseTime ?? r.responseTime,
                  }));
                });
              }
            }
          } catch {
            // Non-critical, ignore
          }
        }

        // Build metrics summary
        setMetrics(buildMetrics(metricsData));
      }

      // 2. Fetch cost analysis
      const costRes = await fetch(
        `/api/ai-sessions/cost-network-analysis?hours=24&provider=${provider}`,
        { credentials: 'include', signal }
      );
      if (costRes.ok) {
        setCostAnalysis(await costRes.json());
      }

      setError(null);
    } catch (err) {
      if (signal.aborted) return; // Ignore abort errors
      console.error('Failed to fetch path data:', err);
      setError('Failed to load path data');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  // ---- Build XYFlow nodes/edges from PathHop[] ----
  const buildFlowFromHops = useCallback((hops: PathHop[]) => {
    if (hops.length === 0) {
      setPathNodes([]);
      setPathEdges([]);
      return;
    }

    const maxLatency = Math.max(...hops.map(h => h.latency));
    const nodes: Node<HopNodeData>[] = hops.map((hop, i) => ({
      id: `hop-${i}`,
      type: 'hop',
      position: { x: i * 220, y: 80 },
      data: {
        hopNumber: hop.hopNumber,
        ipAddress: hop.ipAddress,
        hostname: hop.hostname,
        latency: hop.latency,
        loss: hop.loss,
        zone: classifyZone(hop, i, hops.length),
        network: hop.network,
        isBottleneck: hop.latency === maxLatency && maxLatency > 50,
      },
    }));

    const edges: Edge<PathEdgeData>[] = hops.slice(1).map((hop, i) => ({
      id: `edge-${i}`,
      source: `hop-${i}`,
      target: `hop-${i + 1}`,
      type: 'pathEdge',
      data: { hopLatency: hop.latency },
    }));

    setPathNodes(nodes);
    setPathEdges(edges);
  }, []);

  // ---- Transform path-vis data to agent traces, hops, and XYFlow nodes/edges ----
  const transformPathToFlow = useCallback((pathData: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyRecord = Record<string, any>;

    // --- Try TE v7 detailed format: { results: [{ agent, pathTraces: [{ hops }] }] } ---
    const pathResults = (pathData as AnyRecord).results || (pathData as AnyRecord)._embedded?.results || [];
    if (Array.isArray(pathResults) && pathResults.length > 0) {
      const traces: PathAgentTrace[] = [];
      for (const result of pathResults) {
        const agentId = result.agent?.agentId || 'unknown';
        const agentName = result.agent?.agentName || `Agent ${agentId}`;
        const pathTraces = result.pathTraces || [];
        for (const trace of pathTraces) {
          const traceHops: PathHop[] = (trace.hops || []).map((hop: AnyRecord, idx: number) => ({
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

        // Fallback: result.routes format (older TE or legacy proxy)
        if (pathTraces.length === 0 && result.routes) {
          const routeHops: PathHop[] = [];
          for (const route of result.routes) {
            for (const hop of route.hops || []) {
              const addr = hop.ipAddress || hop.ip || hop.prefix;
              if (addr) {
                routeHops.push({
                  hopNumber: routeHops.length + 1,
                  ipAddress: addr,
                  hostname: hop.rdns || undefined,
                  latency: Number(hop.delay || hop.responseTime || hop.latency) || 0,
                  loss: Number(hop.loss) || 0,
                  prefix: hop.prefix,
                  network: hop.network,
                });
              }
            }
          }
          if (routeHops.length > 0) {
            traces.push({ agentId: String(agentId), agentName, hops: routeHops });
          }
        }
      }

      if (traces.length > 0) {
        setAgentTraces(traces);
        const bestIdx = traces.reduce((best, t, i) => t.hops.length > traces[best].hops.length ? i : best, 0);
        setSelectedTraceIdx(bestIdx);
        setPathHops(traces[bestIdx].hops);
        buildFlowFromHops(traces[bestIdx].hops);
        return;
      }
    }

    // --- Fallback: legacy pathVis / routes format ---
    type HopEntry = { ip?: string; ipAddress?: string; prefix?: string; delay?: number; loss?: number; rdns?: string; network?: string; responseTime?: number; latency?: number; hostname?: string };
    type RouteEntry = { hops?: HopEntry[] };
    type ResultEntry = { routes?: RouteEntry[]; pathVis?: { routes?: RouteEntry[] }[] };

    let routes: RouteEntry[] = [];
    const results = (pathData as { results?: ResultEntry[] }).results;
    if (Array.isArray(results) && results.length > 0) {
      for (const r of results) {
        if (r.routes && r.routes.length > 0) { routes = r.routes; break; }
      }
    }
    if (routes.length === 0) {
      const pathVis = (pathData as { pathVis?: { routes?: RouteEntry[] }[] }).pathVis;
      if (Array.isArray(pathVis) && pathVis.length > 0) routes = pathVis[0].routes || [];
    }
    if (routes.length === 0 && Array.isArray(pathData)) {
      for (const r of pathData as ResultEntry[]) {
        if (r.routes && r.routes.length > 0) { routes = r.routes; break; }
      }
    }

    const hops: PathHop[] = [];
    for (const route of routes) {
      for (const hop of route.hops || []) {
        const addr = hop.ipAddress || hop.ip || hop.prefix;
        if (addr) {
          hops.push({
            hopNumber: hops.length + 1,
            ipAddress: addr,
            hostname: hop.rdns || hop.hostname || undefined,
            latency: Number(hop.delay || hop.responseTime || hop.latency) || 0,
            loss: Number(hop.loss) || 0,
            prefix: hop.prefix,
            network: hop.network,
          });
        }
      }
    }

    setPathHops(hops);
    setAgentTraces([]);
    setSelectedTraceIdx(0);
    buildFlowFromHops(hops);
  }, [buildFlowFromHops]);

  // ---- Build metrics from provider data ----
  const buildMetrics = (data: Record<string, unknown>): AIMetrics => {
    const tests = (data as { tests?: { results?: unknown; test_type?: string }[] }).tests || [];
    let totalLatency = 0;
    let totalLoss = 0;
    let responseTime = 0;
    let count = 0;

    for (const t of tests) {
      if (!t.results || typeof t.results !== 'object') continue;

      // TE v7 API wraps data in: { results: [{ avgLatency, loss, ... }], test: {...} }
      // So t.results may be the raw TE response with its own 'results' array inside
      const rawResults = t.results as Record<string, unknown>;

      // Extract the actual metric records - could be nested in a results array
      let records: Record<string, unknown>[] = [];
      if (Array.isArray(rawResults.results)) {
        records = rawResults.results as Record<string, unknown>[];
      } else if (typeof rawResults.avgLatency === 'number' || typeof rawResults.loss === 'number') {
        // Direct format (not nested)
        records = [rawResults];
      }

      for (const rec of records) {
        if (typeof rec.avgLatency === 'number') {
          totalLatency += rec.avgLatency;
          count++;
        }
        if (typeof rec.loss === 'number') {
          totalLoss += rec.loss;
        }
        // HTTP test response time
        if (typeof rec.responseTime === 'number') {
          responseTime = Math.max(responseTime, rec.responseTime);
        }
      }
    }

    const avgLat = count > 0 ? totalLatency / count : 0;
    const avgLoss = count > 0 ? totalLoss / count : 0;
    const health = getLinkHealth(avgLat, avgLoss);

    return {
      avg_response_time_ms: responseTime || avgLat,
      availability_pct: 100 - avgLoss,
      path_latency_ms: avgLat,
      path_loss_pct: avgLoss,
      path_health: health,
    };
  };

  // ---- Select a specific agent trace ----
  const selectTrace = useCallback((idx: number) => {
    if (agentTraces[idx]) {
      setSelectedTraceIdx(idx);
      setPathHops(agentTraces[idx].hops);
      buildFlowFromHops(agentTraces[idx].hops);
    }
  }, [agentTraces, buildFlowFromHops]);

  // ---- Create / delete tests (re-throw so AIEndpointSetup can show feedback) ----
  const createTest = useCallback(async (provider: string, mode: string, customUrl?: string) => {
    const body: Record<string, unknown> = { provider, test_mode: mode };
    if (customUrl) body.custom_url = customUrl;
    const res = await fetch('/api/thousandeyes/ai-assurance/tests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(detail || `HTTP ${res.status}`);
    }
    await refreshProviders();
    // Keep setup panel open so user can continue adding tests
    setSetupOpen(true);
  }, [refreshProviders]);

  const deleteTest = useCallback(async (provider: string) => {
    const res = await fetch(`/api/thousandeyes/ai-assurance/tests/${provider}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await refreshProviders();
    if (selectedProvider === provider) {
      setSelectedProvider(null);
      setPathNodes([]);
      setPathEdges([]);
      setPathHops([]);
      setAgentTraces([]);
      setSelectedTraceIdx(0);
      setMetrics(null);
      setCostAnalysis(null);
      setTestResults([]);
    }
  }, [refreshProviders, selectedProvider]);

  // ---- Auto-refresh ----
  useEffect(() => {
    refreshProviders();
    timerRef.current = setInterval(refreshProviders, REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshProviders]);

  // ---- Auto-select first provider when providers load ----
  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].provider);
    }
  }, [providers, selectedProvider]);

  // ---- Fetch path data when provider changes ----
  useEffect(() => {
    if (selectedProvider) {
      fetchPathData(selectedProvider);
    }
  }, [selectedProvider, fetchPathData]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return {
    providers,
    selectedProvider,
    setSelectedProvider,
    pathNodes,
    pathEdges,
    pathHops,
    agentTraces,
    selectedTraceIdx,
    selectTrace,
    metrics,
    costAnalysis,
    testResults,
    currentTestId,
    loading,
    error,
    refreshProviders,
    createTest,
    deleteTest,
    setupOpen,
    setSetupOpen,
  };
}
