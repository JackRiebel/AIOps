'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { TopStatsBar, type StatItem } from '@/components/dashboard/TopStatsBar';
import {
  ThousandEyesTabBar,
  TestsTable,
  AlertsTable,
  AgentsTable,
  CreateTestModal,
  type Test,
  type TestResult,
  type Alert,
  type Agent,
  type TabType,
} from '@/components/thousandeyes';

// ============================================================================
// ThousandEyes Page Component
// ============================================================================

export default function ThousandEyesPage() {
  const router = useRouter();

  // Data state
  const [tests, setTests] = useState<Test[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [testResults, setTestResults] = useState<Record<number, TestResult[]>>({});
  const [loadingResults, setLoadingResults] = useState<Record<number, boolean>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('tests');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  // ============================================================================
  // Data Fetching (uses system_config, no organization selection needed)
  // ============================================================================

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/tests?organization=default', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 503) {
        setIsConfigured(false);
        setError('ThousandEyes is not configured. Add your OAuth token in System Config.');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTests(data.tests || []);
      setIsConfigured(true);
    } catch (err) {
      console.error('Failed to fetch tests:', err);
      setError('Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/alerts?organization=default&active_only=true', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 503) {
        setIsConfigured(false);
        setError('ThousandEyes is not configured. Add your OAuth token in System Config.');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAlerts(data.alerts || []);
      setIsConfigured(true);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/agents?organization=default', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.status === 503) {
        setIsConfigured(false);
        setError('ThousandEyes is not configured. Add your OAuth token in System Config.');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAgents(data.agents || []);
      setIsConfigured(true);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTestResults = useCallback(async (testId: number, testType: string) => {
    if (testResults[testId]) return; // Already cached
    try {
      setLoadingResults(prev => ({ ...prev, [testId]: true }));
      const response = await fetch(
        `/api/thousandeyes/tests/${testId}/results?organization=default&test_type=${encodeURIComponent(testType)}&window=12h`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const results = data.results?.results || [];
      interface ApiTestResult {
        date?: string;
        roundId?: number;
        responseTime?: number;
        avgLatency?: number;
        totalTime?: number;
        availability?: number;
        loss?: number;
        latency?: number;
        jitter?: number;
        throughput?: number;
      }
      const chartData: TestResult[] = results.map((r: ApiTestResult) => ({
        timestamp: new Date(r.date || r.roundId || Date.now()).toLocaleTimeString(),
        responseTime: r.responseTime || r.avgLatency || r.totalTime,
        availability: r.availability,
        loss: r.loss,
        latency: r.avgLatency || r.latency,
        jitter: r.jitter,
        throughput: r.throughput,
      }));
      setTestResults(prev => ({ ...prev, [testId]: chartData }));
    } catch (err) {
      console.error('Failed to fetch test results:', err);
    } finally {
      setLoadingResults(prev => ({ ...prev, [testId]: false }));
    }
  }, [testResults]);

  // ============================================================================
  // Test Creation
  // ============================================================================

  const createTestFromAI = useCallback(async (prompt: string) => {
    if (!prompt.trim()) {
      setError('Please describe what you want to test');
      return;
    }
    try {
      setAiProcessing(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/tests/ai?organization=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      await fetchTests();
    } catch (err) {
      console.error('Failed to create test:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test');
      throw err;
    } finally {
      setAiProcessing(false);
    }
  }, [fetchTests]);

  const createTestManual = useCallback(async (config: { testName: string; url: string; testType: string; interval: number }) => {
    if (!config.testName || !config.url) {
      setError('Please fill in all required fields');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/tests?organization=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      await fetchTests();
    } catch (err) {
      console.error('Failed to create test:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTests]);

  // ============================================================================
  // AI Integration
  // ============================================================================

  const handleAskAI = useCallback((context: string) => {
    sessionStorage.setItem('ai_initial_message', context);
    router.push('/network');
  }, [router]);

  // ============================================================================
  // Refresh Handler
  // ============================================================================

  const handleRefresh = useCallback(() => {
    if (activeTab === 'tests') fetchTests();
    else if (activeTab === 'alerts') fetchAlerts();
    else if (activeTab === 'agents') fetchAgents();
  }, [activeTab, fetchTests, fetchAlerts, fetchAgents]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    // Fetch data on mount and tab change
    if (activeTab === 'tests') fetchTests();
    else if (activeTab === 'alerts') fetchAlerts();
    else if (activeTab === 'agents') fetchAgents();
  }, [activeTab, fetchTests, fetchAlerts, fetchAgents]);

  // ============================================================================
  // Computed Stats
  // ============================================================================

  const activeAlertCount = useMemo(() => alerts.filter(a => a.active === 1).length, [alerts]);
  const enabledAgentsCount = useMemo(() => agents.filter(a => a.enabled === 1).length, [agents]);
  const disabledAgentsCount = useMemo(() => agents.filter(a => a.enabled === 0).length, [agents]);

  const stats: StatItem[] = useMemo(() => [
    { id: 'tests', label: 'Tests', value: tests.length, icon: 'activity', tooltip: 'Active ThousandEyes tests monitoring network performance.' },
    { id: 'alerts', label: 'Active Alerts', value: activeAlertCount, icon: 'alert', status: activeAlertCount > 0 ? 'critical' : 'normal', tooltip: 'Current alerts triggered by test thresholds.' },
    { id: 'online', label: 'Agents Online', value: enabledAgentsCount, icon: 'server', status: 'success', tooltip: 'Enterprise agents actively running tests.' },
    { id: 'offline', label: 'Agents Offline', value: disabledAgentsCount, icon: 'server', status: disabledAgentsCount > 0 ? 'warning' : 'normal', tooltip: 'Agents not currently running tests.' },
  ], [tests.length, activeAlertCount, enabledAgentsCount, disabledAgentsCount]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ThousandEyes Monitoring</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Network performance monitoring and intelligence</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label={loading ? 'Refreshing data...' : 'Refresh data'}
              className="p-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Configuration Warning */}
        {!isConfigured && (
          <div role="alert" className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Configuration Required</h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  ThousandEyes is not configured. Please add your THOUSANDEYES_OAUTH_TOKEN to your environment configuration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Stats Bar */}
        <TopStatsBar stats={stats} loading={loading && !tests.length && !alerts.length && !agents.length} className="mb-6" />

        {/* Tab Bar */}
        <ThousandEyesTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          alertCount={activeAlertCount}
          className="mb-6"
        />

        {/* Error Display */}
        {error && (
          <div role="alert" className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'tests' && (
          <TestsTable
            tests={tests}
            testResults={testResults}
            loadingResults={loadingResults}
            loading={loading}
            selectedOrg="default"
            isConfigured={isConfigured}
            onCreateTest={() => setShowCreateModal(true)}
            onToggleResults={fetchTestResults}
            onAskAI={handleAskAI}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsTable
            alerts={alerts}
            loading={loading}
          />
        )}

        {activeTab === 'agents' && (
          <AgentsTable
            agents={agents}
            loading={loading}
          />
        )}
      </div>

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateAI={createTestFromAI}
        onCreateManual={createTestManual}
        loading={loading}
        aiProcessing={aiProcessing}
        error={error}
      />
    </div>
  );
}
