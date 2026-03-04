'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Globe, Search, Server, Cloud, ChevronDown, ChevronUp, Activity, Users, Network } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { TestPerformanceChart } from './TestPerformanceChart';
import { isEnabled } from './types';
import type { Test, TestResult, Alert } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEEnterpriseMonitoringProps {
  tests: Test[];
  alerts: Alert[];
  testResults: Record<number, TestResult[]>;
  loadingResults: Record<number, boolean>;
  loadingTests: boolean;
  onFetchTestResults: (testId: number, testType: string) => Promise<void>;
  onTestClick?: (testId: number) => void;
}

type CategoryFilter = 'all' | 'cloud' | 'web' | 'network' | 'dns';

// ============================================================================
// Constants
// ============================================================================

const CLOUD_PATTERNS = [
  'office365', 'outlook', 'microsoft', 'teams', 'sharepoint', 'onedrive',
  'salesforce', 'aws', 'amazon', 'azure', 'google', 'gcp', 'zoom',
  'slack', 'servicenow', 'workday', 'okta', 'box.com', 'dropbox',
  'webex', 'cisco', 'cloudflare', 'akamai', 'fastly', 'zendesk',
  'jira', 'atlassian', 'confluence', 'github', 'gitlab',
];

const categoryConfig: Record<CategoryFilter, { label: string; icon: typeof Globe }> = {
  all: { label: 'All', icon: Globe },
  cloud: { label: 'Cloud & SaaS', icon: Cloud },
  web: { label: 'Web & API', icon: Globe },
  network: { label: 'Network', icon: Server },
  dns: { label: 'DNS', icon: Network },
};

const healthDotColor: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  failing: 'bg-red-500 animate-pulse',
  disabled: 'bg-slate-400',
};

const healthLabel: Record<string, { text: string; color: string }> = {
  healthy: { text: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' },
  degraded: { text: 'Degraded', color: 'text-amber-600 dark:text-amber-400' },
  failing: { text: 'Failing', color: 'text-red-600 dark:text-red-400' },
  disabled: { text: 'Disabled', color: 'text-slate-500 dark:text-slate-400' },
};

const typeBadgeColors: Record<string, string> = {
  'agent-to-server': 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'agent-to-agent': 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'http-server': 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400',
  'page-load': 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  'dns-server': 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'dns-trace': 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'network': 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

// ============================================================================
// Helpers
// ============================================================================

function categorizeTest(test: Test): CategoryFilter {
  const type = test.type?.toLowerCase() || '';
  const target = `${test.testName} ${test.url || ''} ${test.server || ''} ${test.domain || ''}`.toLowerCase();

  if (type.includes('dns')) return 'dns';
  if (type.includes('agent-to-server') || type.includes('agent-to-agent')) return 'network';

  // Check if target matches cloud/SaaS patterns
  if (CLOUD_PATTERNS.some(p => target.includes(p))) return 'cloud';

  // HTTP/page-load tests that aren't cloud → web
  if (type.includes('http') || type.includes('page-load') || type.includes('web-transactions')) return 'web';

  return 'network';
}

function getTestTarget(test: Test): string {
  return test.url || test.server || test.domain || '';
}

function getTestHealth(test: Test, alertsByTestId: Map<number, Alert[]>): string {
  if (!isEnabled(test.enabled)) return 'disabled';
  const testAlerts = alertsByTestId.get(test.testId) || [];
  const activeAlerts = testAlerts.filter(a => isEnabled(a.active));
  if (activeAlerts.some(a => {
    const s = a.severity?.toLowerCase() || '';
    return s.includes('critical') || s.includes('major') || s.includes('high') || s.includes('error');
  })) return 'failing';
  if (activeAlerts.length > 0) return 'degraded';
  return 'healthy';
}

function formatInterval(seconds: number): string {
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

// ============================================================================
// Sub-components
// ============================================================================

const SummaryStat = memo(({ label, value, subtext, color }: { label: string; value: string | number; subtext?: string; color?: string }) => (
  <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 p-3">
    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-lg font-bold tabular-nums leading-none ${color || 'text-slate-900 dark:text-white'}`}>{value}</p>
    {subtext && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
  </div>
));
SummaryStat.displayName = 'SummaryStat';

const TestTargetCard = memo(({
  test,
  health,
  testResults,
  loadingResult,
  expanded,
  onToggle,
  onFetchResults,
}: {
  test: Test;
  health: string;
  testResults?: TestResult[];
  loadingResult?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onFetchResults: () => void;
}) => {
  const target = getTestTarget(test);
  const hDot = healthDotColor[health] || healthDotColor.healthy;
  const hLabel = healthLabel[health] || healthLabel.healthy;
  const badgeColor = typeBadgeColors[test.type] || 'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400';
  const m = test._latestMetrics;

  const handleExpand = useCallback(() => {
    if (!testResults && !loadingResult) {
      onFetchResults();
    }
    onToggle();
  }, [testResults, loadingResult, onFetchResults, onToggle]);

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600/50 transition">
      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${hDot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-medium ${hLabel.color}`}>{hLabel.text}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{test.testName}</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${badgeColor}`}>
                {test.type?.toUpperCase().replace(/-/g, ' ')}
              </span>
            </div>
            {target && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{target}</p>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-3 mb-2.5">
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Latency</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
              {m?.latency != null ? `${m.latency}ms` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Loss</p>
            <p className={`text-sm font-semibold tabular-nums ${
              m?.loss != null && m.loss > 1 ? 'text-red-600 dark:text-red-400' :
              m?.loss != null && m.loss > 0 ? 'text-amber-600 dark:text-amber-400' :
              'text-slate-900 dark:text-white'
            }`}>
              {m?.loss != null ? `${m.loss.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Availability</p>
            <p className={`text-sm font-semibold tabular-nums ${
              m?.availability != null && m.availability < 95 ? 'text-red-600 dark:text-red-400' :
              m?.availability != null && m.availability < 99 ? 'text-amber-600 dark:text-amber-400' :
              'text-slate-900 dark:text-white'
            }`}>
              {m?.availability != null ? `${m.availability}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Interval</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {test.interval ? formatInterval(test.interval) : '—'}
            </p>
          </div>
        </div>

        {/* Agents row */}
        {test.agents && test.agents.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {test.agents.slice(0, 3).map(a => a.agentName).join(', ')}
              {test.agents.length > 3 && ` +${test.agents.length - 3} more`}
            </p>
          </div>
        )}

        {/* Expand button */}
        <button
          onClick={handleExpand}
          className="flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      {/* Expanded performance chart */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700/40 p-3">
          {loadingResult ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-xs text-slate-500">Loading results...</span>
            </div>
          ) : testResults && testResults.length > 0 ? (
            <TestPerformanceChart
              testId={test.testId}
              testName={test.testName}
              testType={test.type}
              results={testResults}
              loading={false}
              selectedOrg="default"
              onAskAI={() => {}}
            />
          ) : (
            <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
              No performance data available yet
            </p>
          )}
        </div>
      )}
    </div>
  );
});
TestTargetCard.displayName = 'TestTargetCard';

// ============================================================================
// Main Component
// ============================================================================

export const TEEnterpriseMonitoring = memo(({
  tests,
  alerts,
  testResults,
  loadingResults,
  loadingTests,
  onFetchTestResults,
  onTestClick,
}: TEEnterpriseMonitoringProps) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  // Build alert lookup
  const alertsByTestId = useMemo(() => {
    const map = new Map<number, Alert[]>();
    alerts.forEach(a => {
      if (a.testId) {
        const tid = typeof a.testId === 'string' ? parseInt(a.testId, 10) : a.testId;
        if (!isNaN(tid)) {
          const existing = map.get(tid) || [];
          existing.push(a);
          map.set(tid, existing);
        }
      }
    });
    return map;
  }, [alerts]);

  // Filter to enabled tests only
  const enabledTests = useMemo(() => tests.filter(t => isEnabled(t.enabled)), [tests]);

  // Categorized + filtered tests
  const filteredTests = useMemo(() => {
    let result = enabledTests;

    // Category filter
    if (category !== 'all') {
      result = result.filter(t => categorizeTest(t) === category);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => {
        const searchable = `${t.testName} ${t.url || ''} ${t.server || ''} ${t.domain || ''} ${t.agents?.map(a => a.agentName).join(' ') || ''}`.toLowerCase();
        return searchable.includes(q);
      });
    }

    // Sort: failing first, then degraded, then healthy
    return result.sort((a, b) => {
      const order: Record<string, number> = { failing: 0, degraded: 1, healthy: 2, disabled: 3 };
      const ha = order[getTestHealth(a, alertsByTestId)] ?? 2;
      const hb = order[getTestHealth(b, alertsByTestId)] ?? 2;
      return ha - hb;
    });
  }, [enabledTests, category, search, alertsByTestId]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = { all: enabledTests.length, cloud: 0, web: 0, network: 0, dns: 0 };
    enabledTests.forEach(t => { counts[categorizeTest(t)]++; });
    return counts;
  }, [enabledTests]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const targets = new Set<string>();
    enabledTests.forEach(t => {
      const target = getTestTarget(t);
      if (target) targets.add(target);
    });

    let latencySum = 0, latencyCount = 0;
    let lossSum = 0, lossCount = 0;
    let availSum = 0, availCount = 0;
    let issueCount = 0;

    enabledTests.forEach(t => {
      const m = t._latestMetrics;
      if (m?.latency != null) { latencySum += m.latency; latencyCount++; }
      if (m?.loss != null) { lossSum += m.loss; lossCount++; }
      if (m?.availability != null) { availSum += m.availability; availCount++; }
      const health = getTestHealth(t, alertsByTestId);
      if (health === 'failing' || health === 'degraded') issueCount++;
    });

    const avgAvail = availCount > 0 ? Math.round((availSum / availCount) * 10) / 10 : null;
    const avgLatency = latencyCount > 0 ? Math.round(latencySum / latencyCount) : null;

    return {
      targetCount: targets.size,
      avgAvailability: avgAvail,
      avgLatency,
      issueCount,
    };
  }, [enabledTests, alertsByTestId]);

  const handleToggleExpand = useCallback((testId: number) => {
    setExpandedTestId(prev => prev === testId ? null : testId);
  }, []);

  const loading = loadingTests && tests.length === 0;

  return (
    <DashboardCard
      title="Enterprise Monitoring"
      icon={<Activity className="w-4 h-4" />}
      accent="cyan"
      loading={loading}
      badge={
        enabledTests.length > 0 ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {enabledTests.length} active test{enabledTests.length !== 1 ? 's' : ''}
          </span>
        ) : null
      }
      compact
    >
      {enabledTests.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Globe className="w-6 h-6 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No tests configured</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[320px]">
            Enterprise agents can monitor connectivity to cloud applications, internal servers, and internet targets.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryStat
              label="Targets Monitored"
              value={summaryStats.targetCount}
              subtext={`${enabledTests.length} tests`}
            />
            <SummaryStat
              label="Avg Availability"
              value={summaryStats.avgAvailability != null ? `${summaryStats.avgAvailability}%` : '—'}
              color={
                summaryStats.avgAvailability != null
                  ? summaryStats.avgAvailability < 95 ? 'text-red-600 dark:text-red-400'
                    : summaryStats.avgAvailability < 99 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                  : undefined
              }
            />
            <SummaryStat
              label="Avg Latency"
              value={summaryStats.avgLatency != null ? `${summaryStats.avgLatency}ms` : '—'}
              color={
                summaryStats.avgLatency != null
                  ? summaryStats.avgLatency > 200 ? 'text-red-600 dark:text-red-400'
                    : summaryStats.avgLatency > 100 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-white'
                  : undefined
              }
            />
            <SummaryStat
              label="Issues Detected"
              value={summaryStats.issueCount}
              color={summaryStats.issueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
              subtext={summaryStats.issueCount === 0 ? 'All clear' : undefined}
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-700/40 pb-1 overflow-x-auto">
            {(Object.keys(categoryConfig) as CategoryFilter[]).map(cat => {
              const count = categoryCounts[cat];
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-t whitespace-nowrap transition ${
                    isActive
                      ? 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-b-2 border-cyan-500'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {categoryConfig[cat].label}
                  {count > 0 && (
                    <span className={`px-1 py-0 text-[9px] rounded-full ${
                      isActive ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          {enabledTests.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tests, URLs, servers, agents..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
          )}

          {/* Test Target Cards */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredTests.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                {search ? `No tests match "${search}"` : 'No tests in this category'}
              </div>
            ) : (
              filteredTests.map(test => (
                <TestTargetCard
                  key={test.testId}
                  test={test}
                  health={getTestHealth(test, alertsByTestId)}
                  testResults={testResults[test.testId]}
                  loadingResult={loadingResults[test.testId]}
                  expanded={expandedTestId === test.testId}
                  onToggle={() => handleToggleExpand(test.testId)}
                  onFetchResults={() => onFetchTestResults(test.testId, test.type)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {filteredTests.length > 0 && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              {filteredTests.length} of {enabledTests.length} test{enabledTests.length !== 1 ? 's' : ''} shown
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
});

TEEnterpriseMonitoring.displayName = 'TEEnterpriseMonitoring';
export default TEEnterpriseMonitoring;
