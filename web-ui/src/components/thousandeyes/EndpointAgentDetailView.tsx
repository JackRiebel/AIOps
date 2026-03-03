'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Wifi, Globe, Monitor, Shield, MapPin, Clock, Sparkles, MessageSquare, Activity } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import type { HealthSegment, EndpointScheduledTest } from './types';
import { EndpointHealthFlow } from './EndpointHealthFlow';

// ============================================================================
// Types
// ============================================================================

interface EndpointAgent {
  agentId: string;
  agentName: string;
  computerName?: string;
  osVersion?: string;
  platform?: string;
  publicIP?: string | string[];
  privateIP?: string | string[];
  location?: string | { latitude?: number; longitude?: number; locationName?: string };
  status?: string;
  lastSeen?: string;
  version?: string;
  enabled?: number | boolean;
}

interface ScoreDataPoint {
  time: string;
  score: number;
}

interface TestMetricPoint {
  name: string;
  latency: number;
  testId: string;
}

export interface EndpointAgentDetailViewProps {
  agent: EndpointAgent;
  onAskAI?: (context: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getIPString(ip?: string | string[]): string {
  if (!ip) return 'N/A';
  if (Array.isArray(ip)) return ip[0] || 'N/A';
  return ip;
}

function getLocationString(location?: EndpointAgent['location']): string {
  if (!location) return 'Unknown';
  if (typeof location === 'string') return location;
  return location.locationName || 'Unknown';
}

function isOnline(agent: EndpointAgent): boolean {
  if (agent.status) {
    const s = agent.status.toLowerCase();
    return s === 'connected' || s === 'online' || s === 'enabled';
  }
  return agent.enabled === true || agent.enabled === 1;
}

function healthBorderColor(test: EndpointScheduledTest): string {
  if (test.httpStatusCode != null && (test.httpStatusCode < 200 || test.httpStatusCode >= 400)) return 'border-l-red-500';
  if (test.loss != null && test.loss > 5) return 'border-l-red-500';
  if (test.loss != null && test.loss > 0) return 'border-l-amber-500';
  if (test.latency != null && test.latency > 200) return 'border-l-amber-500';
  if (test.latency != null || test.httpStatusCode != null) return 'border-l-emerald-500';
  return 'border-l-slate-300 dark:border-l-slate-600';
}

// ============================================================================
// Scheduled Tests Table — with colored health indicators
// ============================================================================

function ScheduledTestsTable({ tests, loading, onAskAI, agentName }: { tests: EndpointScheduledTest[]; loading: boolean; onAskAI?: (context: string) => void; agentName?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
        <span className="ml-2 text-xs text-slate-500">Loading tests...</span>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">No scheduled tests found for this agent</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700/50">
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Test Name</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Target</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Score</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Loss</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Latency</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            {onAskAI && <th className="px-3 py-2 w-10"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
          {tests.map((test) => {
            const scoreColor = test.score != null
              ? test.score >= 90 ? 'text-green-600 dark:text-green-400'
                : test.score >= 70 ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400'
              : 'text-slate-400';
            const statusCode = test.httpStatusCode;
            const statusOk = statusCode != null && statusCode >= 200 && statusCode < 400;
            const borderClass = healthBorderColor(test);

            return (
              <tr key={test.testId} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-l-3 ${borderClass}`}>
                <td className="px-3 py-2 text-xs font-medium text-slate-900 dark:text-white">{test.testName}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
                    {test.testType}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">{test.target || '—'}</td>
                <td className={`px-3 py-2 text-xs font-bold text-right ${scoreColor}`}>
                  {test.score != null ? test.score : '—'}
                </td>
                <td className={`px-3 py-2 text-xs text-right ${test.loss != null && test.loss > 0 ? 'text-red-500 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  {test.loss != null ? `${test.loss}%` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-right text-slate-700 dark:text-slate-300">
                  {test.latency != null ? `${test.latency}ms` : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  {statusCode != null ? (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      statusOk
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                    }`}>
                      {statusCode}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                {onAskAI && (
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onAskAI(
                        `Analyze the "${test.testName}" (${test.testType}) test for endpoint agent "${agentName || 'Unknown'}". ` +
                        `Target: ${test.target || 'N/A'}. ` +
                        (test.score != null ? `Score: ${test.score}. ` : '') +
                        (test.latency != null ? `Latency: ${test.latency}ms. ` : 'No latency data. ') +
                        (test.loss != null ? `Loss: ${test.loss}%. ` : '') +
                        (test.httpStatusCode != null ? `HTTP Status: ${test.httpStatusCode}. ` : '') +
                        'What does this indicate and are there any concerns?'
                      )}
                      className="p-1 rounded-md text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors"
                      title="Analyze this test with AI"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Agent Score Timeline
// ============================================================================

function AgentScoreTimeline({ data, loading }: { data: ScoreDataPoint[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-[140px] flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
        <span className="ml-2 text-xs text-slate-500">Loading score data...</span>
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -10 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155', strokeWidth: 0.5 }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#e2e8f0',
            }}
            formatter={(value: number) => [`${value}%`, 'Score']}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#scoreGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// Test Metrics Trend Chart — Bar chart fallback when no score data
// ============================================================================

function TestMetricsTrendChart({ tests, onAskAI, agentName }: { tests: EndpointScheduledTest[]; onAskAI?: (context: string) => void; agentName?: string }) {
  const data = useMemo(() => {
    return tests
      .filter(t => t.latency != null)
      .map(t => ({
        name: t.testName.length > 15 ? t.testName.slice(0, 14) + '..' : t.testName,
        latency: t.latency!,
        testId: t.testId,
      }));
  }, [tests]);

  if (data.length === 0) {
    return (
      <div className="py-4 px-3 space-y-3">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Activity className="w-4 h-4" />
          <span className="text-xs font-medium">No latency metrics available yet</span>
        </div>
        {tests.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tests.length} test{tests.length !== 1 ? 's' : ''} configured — awaiting metric collection:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tests.slice(0, 6).map(t => (
                <span key={t.testId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50">
                  <span className="w-1 h-1 rounded-full bg-slate-400" />
                  {t.testName} ({t.testType})
                </span>
              ))}
              {tests.length > 6 && (
                <span className="text-[10px] text-slate-400">+{tests.length - 6} more</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">No scheduled tests found for this agent.</p>
        )}
        {onAskAI && (
          <button
            onClick={() => onAskAI(
              `Analyze endpoint agent "${agentName || 'Unknown'}" health. ` +
              `${tests.length} tests are configured but no latency metrics are available. ` +
              `Tests: ${tests.map(t => `${t.testName} (${t.testType})`).join(', ')}. ` +
              'Why might metrics be missing and what should be checked?'
            )}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Agent Health
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 8, fill: '#94a3b8' }}
            axisLine={{ stroke: '#334155', strokeWidth: 0.5 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#e2e8f0',
            }}
            formatter={(value: number) => [`${value}ms`, 'Latency']}
          />
          <Bar dataKey="latency" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.latency > 200 ? '#ef4444' : entry.latency > 100 ? '#f59e0b' : '#06b6d4'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// EndpointAgentDetailView Component
// ============================================================================

export const EndpointAgentDetailView = memo(({ agent, onAskAI }: EndpointAgentDetailViewProps) => {
  const [loading, setLoading] = useState(true);
  const [scheduledTests, setScheduledTests] = useState<EndpointScheduledTest[]>([]);
  const [healthSegments, setHealthSegments] = useState<HealthSegment[]>([]);
  const [scoreData, setScoreData] = useState<ScoreDataPoint[]>([]);
  const [loadingScore, setLoadingScore] = useState(true);
  const [healthMetrics, setHealthMetrics] = useState<{
    connectionLatency?: number; connectionLoss?: number;
    gatewayLatency?: number; gatewayLoss?: number;
    internetLatency?: number; internetLoss?: number;
    appLatency?: number; appLoss?: number;
  }>({});

  // Derive gateway IP from agent data
  const gatewayIP = useMemo(() => {
    const ip = getIPString(agent.privateIP);
    if (ip !== 'N/A') {
      const parts = ip.split('.');
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
    }
    return undefined;
  }, [agent.privateIP]);

  // Fetch endpoint tests and results
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch endpoint scheduled tests
      const testsRes = await fetch('/api/thousandeyes/endpoint-tests?organization=default', { credentials: 'include' });
      let tests: EndpointScheduledTest[] = [];

      if (testsRes.ok) {
        const testsData = await testsRes.json();
        const rawTests = testsData?._embedded?.tests || testsData?.tests || testsData?._embedded?.endpointTests || [];

        const testPromises = rawTests.slice(0, 10).map(async (t: any) => {
          const testId = t.testId || t.id;
          const testName = t.testName || t.name || 'Unknown';
          const testType = t.type || t.testType || 'HTTP';
          const target = t.server || t.url || t.target || '';

          let score: number | undefined;
          let loss: number | undefined;
          let latency: number | undefined;
          let jitter: number | undefined;
          let httpStatusCode: number | undefined;

          // Try fetching with agentId first, then fall back to aggregate
          for (const url of [
            `/api/thousandeyes/endpoint-data/http-server/${testId}?organization=default&agentId=${agent.agentId}`,
            `/api/thousandeyes/endpoint-data/http-server/${testId}?organization=default`,
          ]) {
            try {
              const httpRes = await fetch(url, { credentials: 'include' });
              if (httpRes.ok) {
                const httpData = await httpRes.json();
                const results = httpData?._embedded?.results || httpData?.results || httpData?._embedded?.httpMetrics || [];
                if (results.length > 0) {
                  const latest = results[results.length - 1];
                  latency = latest.responseTime ?? latest.avgLatency ?? latest.latency;
                  loss = latest.loss ?? latest.packetLoss;
                  httpStatusCode = latest.responseCode ?? latest.httpStatusCode ?? latest.statusCode;
                  if (latency != null && loss != null) {
                    score = Math.max(0, Math.min(100, Math.round(100 - (loss * 2) - (latency > 200 ? (latency - 200) / 10 : 0))));
                  }
                  break; // Got data, stop trying
                }
              }
            } catch {
              // Continue to fallback
            }
          }

          // Secondary fetch: net-metrics for latency/loss if HTTP didn't return them
          if (latency == null) {
            try {
              const netRes = await fetch(
                `/api/thousandeyes/endpoint-data/net-metrics/${testId}?organization=default&agentId=${agent.agentId}`,
                { credentials: 'include' }
              );
              if (netRes.ok) {
                const netData = await netRes.json();
                const netResults = netData?._embedded?.results || netData?.results || netData?._embedded?.netMetrics || [];
                if (netResults.length > 0) {
                  const latest = netResults[netResults.length - 1];
                  latency = latency ?? latest.avgLatency ?? latest.latency;
                  loss = loss ?? latest.loss ?? latest.packetLoss;
                  jitter = latest.jitter ?? latest.avgJitter;
                }
              }
            } catch {
              // Silently fail
            }
          }

          return {
            testId: String(testId),
            testName,
            testType,
            target,
            score,
            loss,
            latency,
            jitter,
            httpStatusCode,
          } as EndpointScheduledTest;
        });

        tests = await Promise.all(testPromises);
      }

      setScheduledTests(tests);

      // Derive health segments from test results + agent status
      const online = isOnline(agent);
      const hasLoss = tests.some(t => t.loss != null && t.loss > 0);
      const hasHighLatency = tests.some(t => t.latency != null && t.latency > 200);
      const hasErrors = tests.some(t => t.httpStatusCode != null && (t.httpStatusCode < 200 || t.httpStatusCode >= 400));

      const segments: HealthSegment[] = [
        { id: 'connection', label: 'Connection', status: online ? 'healthy' : 'critical' },
        { id: 'gateway', label: 'Gateway', status: online ? (hasLoss ? 'warning' : 'healthy') : 'unknown' },
        { id: 'internet', label: 'Internet', status: online ? (hasHighLatency ? 'warning' : 'healthy') : 'unknown' },
        { id: 'applications', label: 'Applications', status: online ? (hasErrors ? 'critical' : 'healthy') : 'unknown' },
        { id: 'system', label: 'System', status: online ? 'healthy' : 'critical' },
      ];
      setHealthSegments(segments);

      // Derive metrics for EndpointHealthFlow from test results
      const avgLatency = tests.filter(t => t.latency != null).reduce((s, t) => s + t.latency!, 0) / Math.max(1, tests.filter(t => t.latency != null).length);
      const avgLoss = tests.filter(t => t.loss != null).reduce((s, t) => s + t.loss!, 0) / Math.max(1, tests.filter(t => t.loss != null).length);

      setHealthMetrics({
        connectionLatency: online ? Math.round(avgLatency * 0.1) || undefined : undefined,
        gatewayLatency: online ? Math.round(avgLatency * 0.15) || undefined : undefined,
        gatewayLoss: hasLoss ? Math.round(avgLoss * 10) / 10 : undefined,
        internetLatency: online ? Math.round(avgLatency * 0.5) || undefined : undefined,
        internetLoss: hasHighLatency ? Math.round(avgLoss * 10) / 10 : undefined,
        appLatency: online ? Math.round(avgLatency * 0.25) || undefined : undefined,
      });
    } catch (err) {
      console.error('Failed to fetch endpoint agent details:', err);
    } finally {
      setLoading(false);
    }
  }, [agent]);

  // Fetch agent score timeline
  const fetchScoreData = useCallback(async () => {
    setLoadingScore(true);
    try {
      const res = await fetch(
        `/api/thousandeyes/endpoint-data/automated-sessions/${agent.agentId}/results?organization=default&agentId=${agent.agentId}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data?._embedded?.results || data?.results || [];
        const points: ScoreDataPoint[] = results
          .filter((r: any) => r.date || r.timestamp || r.roundId)
          .map((r: any) => {
            const timestamp = r.date || r.timestamp || '';
            const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const score = r.score ?? r.experienceScore ?? r.agentScore ?? (r.loss != null ? Math.max(0, 100 - r.loss * 2) : 50);
            return { time, score: Math.round(Number(score)) };
          })
          .slice(-24);
        setScoreData(points);
      }
    } catch {
      // Score data unavailable
    } finally {
      setLoadingScore(false);
    }
  }, [agent.agentId]);

  useEffect(() => {
    fetchData();
    fetchScoreData();
  }, [fetchData, fetchScoreData]);

  const online = isOnline(agent);
  const statusColor = online ? 'bg-emerald-500' : 'bg-red-500';
  const statusLabel = online ? 'Online' : 'Offline';

  return (
    <div className="space-y-4">
      {/* Compact inline header — single row with key metadata */}
      <div className="flex items-center gap-3 flex-wrap bg-white dark:bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {agent.computerName || agent.agentName}
          </span>
        </div>

        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
          online
            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          {statusLabel}
        </span>

        {/* Platform badge */}
        {agent.platform && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
            <Shield className="w-3 h-3 mr-1" />
            {agent.platform} {agent.osVersion ? `· ${agent.osVersion}` : ''}
          </span>
        )}

        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Globe className="w-3 h-3" />
          <span className="font-mono">{getIPString(agent.publicIP)}</span>
        </div>

        {getIPString(agent.privateIP) !== 'N/A' && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Wifi className="w-3 h-3" />
            <span className="font-mono">{getIPString(agent.privateIP)}</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="w-3 h-3" />
          <span>{getLocationString(agent.location)}</span>
        </div>

        {agent.lastSeen && (
          <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
            <Clock className="w-3 h-3" />
            <span>Last seen: {new Date(agent.lastSeen).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Endpoint Health Flow — animated path visualization */}
      {healthSegments.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Network Path</h5>
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4">
            <EndpointHealthFlow
              segments={healthSegments}
              gatewayIP={gatewayIP}
              metrics={healthMetrics}
              agentName={agent.agentName || agent.computerName}
              agentPlatform={agent.platform}
              agentIP={getIPString(agent.publicIP)}
              onSegmentClick={onAskAI ? (_id, context) => onAskAI(context) : undefined}
            />
            {onAskAI && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Click any segment above for AI analysis</span>
                <button
                  onClick={() => onAskAI(
                    `Analyze the full network path for endpoint agent "${agent.agentName || agent.computerName}". ` +
                    `Segments: ${healthSegments.map(s => `${s.label}: ${s.status}`).join(', ')}. ` +
                    `Platform: ${agent.platform || 'Unknown'}, OS: ${agent.osVersion || 'Unknown'}, IP: ${getIPString(agent.publicIP)}. ` +
                    (healthMetrics.connectionLatency != null ? `Connection latency: ${healthMetrics.connectionLatency}ms. ` : '') +
                    (healthMetrics.gatewayLatency != null ? `Gateway latency: ${healthMetrics.gatewayLatency}ms. ` : '') +
                    (healthMetrics.internetLatency != null ? `Internet latency: ${healthMetrics.internetLatency}ms. ` : '') +
                    'Provide a comprehensive network path analysis with recommendations.'
                  )}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Analyze Network Path
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score Timeline or Test Metrics Trend */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
          {scoreData.length > 0 ? 'Agent Score Timeline' : 'Test Latency Overview'}
        </h5>
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
          {scoreData.length > 0 ? (
            <AgentScoreTimeline data={scoreData} loading={loadingScore} />
          ) : loadingScore ? (
            <div className="h-[140px] flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
              <span className="ml-2 text-xs text-slate-500">Loading data...</span>
            </div>
          ) : (
            <TestMetricsTrendChart tests={scheduledTests} onAskAI={onAskAI} agentName={agent.agentName || agent.computerName} />
          )}
        </div>
      </div>

      {/* Health Segment Chips */}
      {healthSegments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {healthSegments.map(seg => {
            const colors: Record<string, string> = {
              healthy: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700/50',
              warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50',
              critical: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50',
              unknown: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600/50',
            };
            const dots: Record<string, string> = {
              healthy: 'bg-green-500', warning: 'bg-amber-500', critical: 'bg-red-500', unknown: 'bg-slate-400',
            };
            return (
              <span key={seg.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[seg.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dots[seg.status]}`} />
                {seg.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Scheduled Tests */}
      <div>
        <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Scheduled Tests</h5>
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg">
          <ScheduledTestsTable tests={scheduledTests} loading={loading} onAskAI={onAskAI} agentName={agent.agentName || agent.computerName} />
        </div>
      </div>

      {/* Deep Analyze button */}
      {onAskAI && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              const segmentSummary = healthSegments.map(s => `${s.label}: ${s.status}`).join(', ');
              const testSummary = scheduledTests.map(t =>
                `${t.testName} (${t.testType}): latency=${t.latency ?? 'N/A'}ms, loss=${t.loss ?? 'N/A'}%, score=${t.score ?? 'N/A'}, HTTP=${t.httpStatusCode ?? 'N/A'}`
              ).join('; ');
              onAskAI(
                `Perform a deep analysis of endpoint agent "${agent.agentName || agent.computerName}". ` +
                `Status: ${online ? 'Online' : 'Offline'}. Platform: ${agent.platform || 'Unknown'}, OS: ${agent.osVersion || 'Unknown'}, Version: ${agent.version || 'Unknown'}. ` +
                `Public IP: ${getIPString(agent.publicIP)}, Private IP: ${getIPString(agent.privateIP)}, Location: ${getLocationString(agent.location)}. ` +
                `Network path segments — ${segmentSummary}. ` +
                (scheduledTests.length > 0 ? `Scheduled tests — ${testSummary}. ` : 'No scheduled tests found. ') +
                'Provide a comprehensive health assessment, identify any issues, and suggest optimization recommendations.'
              );
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-sm hover:shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Deep Analyze This Agent
          </button>
        </div>
      )}
    </div>
  );
});

EndpointAgentDetailView.displayName = 'EndpointAgentDetailView';

export default EndpointAgentDetailView;
