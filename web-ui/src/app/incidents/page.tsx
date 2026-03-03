'use client';

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertTriangle, Clock, ChevronDown, CheckCircle2, XCircle, X } from 'lucide-react';
import { DashboardCard, TopStatsBar, type StatItem } from '@/components/dashboard';
import { ErrorAlert, AllSystemsOperational, NoFilterResults } from '@/components/common';
import {
  IncidentFilterBar,
  IncidentListItem,
  IncidentDetailPanel,
  AIImpactSummary,
  IncidentListSkeleton,
  type Incident,
  type Event,
  type IncidentStats,
} from '@/components/incidents';

// ============================================================================
// Main Component
// ============================================================================

function IncidentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<{ incident: Incident; events: Event[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(168);
  const [activeTab, setActiveTab] = useState<'open' | 'investigating' | 'resolved' | 'closed'>('open');
  const [selectedSeverity, setSelectedSeverity] = useState<'critical' | 'high' | 'medium' | 'info' | null>(null);
  const [minConfidence, setMinConfidence] = useState<80 | 60 | 40 | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const hasFetchedRef = useRef(false);
  const previousTimeRangeRef = useRef(timeRange);

  // Correlation settings state
  const [correlationInterval, setCorrelationInterval] = useState<string>('off');
  const [correlationNextRun, setCorrelationNextRun] = useState<string | null>(null);
  const [showIntervalDropdown, setShowIntervalDropdown] = useState(false);
  const intervalDropdownRef = useRef<HTMLDivElement>(null);

  const INTERVAL_OPTIONS = [
    { value: 'off', label: 'Manual Only', description: 'Only run when clicking Refresh' },
    { value: '5min', label: 'Every 5 min', description: 'High frequency polling' },
    { value: '30min', label: 'Every 30 min', description: 'Balanced polling' },
    { value: '1hr', label: 'Every hour', description: 'Standard polling' },
    { value: '2hr', label: 'Every 2 hours', description: 'Low frequency' },
    { value: '3hr', label: 'Every 3 hours', description: 'Minimal polling' },
  ];

  // ============================================================================
  // Stats Calculation
  // ============================================================================

  const stats: IncidentStats = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open').length,
    investigating: incidents.filter(i => i.status === 'investigating').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
    closed: incidents.filter(i => i.status === 'closed').length,
  }), [incidents]);

  // TopStatsBar data
  const topStats: StatItem[] = useMemo(() => [
    {
      id: 'total',
      label: 'Total Incidents',
      value: stats.total,
      icon: 'activity',
      status: 'normal',
      tooltip: 'Total incidents detected within the selected time range.',
    },
    {
      id: 'open',
      label: 'Open',
      value: stats.open,
      icon: 'alert',
      status: stats.open > 0 ? 'critical' : 'success',
      tooltip: 'New incidents awaiting triage or acknowledgement.',
    },
    {
      id: 'investigating',
      label: 'Investigating',
      value: stats.investigating,
      icon: 'activity',
      status: stats.investigating > 0 ? 'warning' : 'normal',
      tooltip: 'Incidents currently being analyzed or remediated.',
    },
    {
      id: 'resolved',
      label: 'Resolved',
      value: stats.resolved,
      icon: 'server',
      status: 'success',
      tooltip: 'Incidents where root cause was addressed and verified.',
    },
    {
      id: 'closed',
      label: 'Closed',
      value: stats.closed,
      icon: 'activity',
      status: 'normal',
      tooltip: 'Incidents archived after resolution or dismissal.',
    },
  ], [stats]);

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatLastFetched = useCallback((): string => {
    if (!lastFetched) return '';
    const ageMs = Date.now() - lastFetched.getTime();
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }, [lastFetched]);

  const formatTimestamp = useCallback((t: string): string => {
    const date = new Date(t);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }, []);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchIncidents = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      const res = await fetch(`/api/incidents?hours=${timeRange}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setIncidents(data);
      setLastFetched(new Date());
    } catch {
      setError('Failed to load incidents. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const loadIncidentDetails = useCallback(async (id: number) => {
    const res = await fetch(`/api/incidents/${id}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setIncidentDetails(data);
    setSelectedIncident(id);
  }, []);

  const updateStatus = useCallback(async (id: number, status: string) => {
    await fetch(`/api/incidents/${id}/status?status=${status}`, { method: 'PUT', credentials: 'include' });
    fetchIncidents();
    if (selectedIncident === id) loadIncidentDetails(id);
  }, [fetchIncidents, loadIncidentDetails, selectedIncident]);

  const refreshAlerts = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setRefreshStatus(null);

      // Start the correlation (returns immediately)
      const res = await fetch('/api/incidents-refresh', { method: 'POST', credentials: 'include' });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const detail = errorData?.detail || `Refresh failed (${res.status})`;
        setRefreshStatus({ type: 'error', message: detail });
        setIsRefreshing(false);
        return;
      }

      const startData = await res.json();

      if (startData.status === 'already_running') {
        setRefreshStatus({ type: 'success', message: 'Correlation already in progress...' });
      } else {
        setRefreshStatus({ type: 'success', message: 'Correlation started — processing events...' });
      }

      // Poll for completion
      const pollInterval = 5000; // 5 seconds
      const maxPolls = 120; // 10 minutes max
      let polls = 0;

      const poll = async () => {
        polls++;
        try {
          const statusRes = await fetch('/api/incidents-refresh/status', { credentials: 'include' });
          if (!statusRes.ok) return;

          const status = await statusRes.json();

          if (status.status === 'running') {
            setRefreshStatus({ type: 'success', message: 'Correlation in progress...' });
            if (polls < maxPolls) {
              setTimeout(poll, pollInterval);
            } else {
              setRefreshStatus({ type: 'success', message: 'Correlation still running in background — refresh the page later to see results' });
              setIsRefreshing(false);
            }
            return;
          }

          // Completed or errored
          if (status.status === 'error') {
            setRefreshStatus({ type: 'error', message: status.message });
          } else {
            setRefreshStatus({ type: 'success', message: status.message || 'Correlation completed' });
            await fetchIncidents();
          }
          setIsRefreshing(false);
        } catch {
          setRefreshStatus({ type: 'error', message: 'Lost connection while polling — correlation may still be running' });
          setIsRefreshing(false);
        }
      };

      setTimeout(poll, pollInterval);
    } catch {
      setRefreshStatus({ type: 'error', message: 'Network error — could not reach the server' });
      setIsRefreshing(false);
    }
  }, [fetchIncidents]);

  // Fetch correlation settings
  const fetchCorrelationSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents/correlation-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCorrelationInterval(data.current_interval || 'off');
        setCorrelationNextRun(data.next_run || null);
      }
    } catch {
      // Settings fetch failed silently
    }
  }, []);

  // Update correlation interval
  const updateCorrelationInterval = useCallback(async (newInterval: string) => {
    try {
      const res = await fetch(`/api/incidents/correlation-settings?interval=${newInterval}`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCorrelationInterval(data.current_interval);
        setCorrelationNextRun(data.next_run || null);
      }
    } catch {
      // Update failed silently
    }
    setShowIntervalDropdown(false);
  }, []);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (intervalDropdownRef.current && !intervalDropdownRef.current.contains(event.target as Node)) {
        setShowIntervalDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch correlation settings on mount
  useEffect(() => {
    fetchCorrelationSettings();
  }, [fetchCorrelationSettings]);

  const askAI = useCallback(() => {
    if (!incidentDetails) return;

    const incident = incidentDetails.incident;
    const events = incidentDetails.events;

    // Build structured data for the incident card display
    const incidentContext = {
      type: 'incident_analysis',
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        eventCount: events.length,
        networkName: incident.network_name,
        networkId: incident.network_id,
        hypothesis: incident.root_cause_hypothesis,
        confidenceScore: incident.confidence_score,
        affectedServices: incident.affected_services,
        createdAt: incident.start_time,
      },
    };

    // AI-facing message with full context (not shown to user)
    let aiMessage = `Analyze Incident #${incident.id}: ${incident.title}\n`;
    aiMessage += `Severity: ${incident.severity.toUpperCase()} • Events: ${events.length} • Network: ${incident.network_name || 'Unknown'} (${incident.network_id || 'N/A'})\n`;

    if (incident.root_cause_hypothesis) {
      aiMessage += `Hypothesis (${incident.confidence_score}% confidence): ${incident.root_cause_hypothesis}\n`;
    }

    if (incident.affected_services?.length) {
      aiMessage += `Affected: ${incident.affected_services.join(', ')}\n`;
    }

    aiMessage += `\nProvide: 1) Root cause analysis (2-3 sentences), 2) Remediation steps, 3) Create 1-2 monitoring cards`;

    // Encode both message and context data
    const payload = {
      message: aiMessage,
      context: incidentContext,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));

    // Navigate to chat-v2 page with encoded payload
    // Using router.push for faster client-side navigation (improvement over window.location.href)
    router.push(`/chat-v2?new_session=true&incident=${encodeURIComponent(encoded)}`);
  }, [incidentDetails, router]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    const timeRangeChanged = previousTimeRangeRef.current !== timeRange;
    previousTimeRangeRef.current = timeRange;

    if (!hasFetchedRef.current || timeRangeChanged) {
      hasFetchedRef.current = true;
      fetchIncidents();
    }
  }, [timeRange, fetchIncidents]);

  // Handle selected incident from query parameter
  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && incidents.length > 0) {
      const id = parseInt(selectedId, 10);
      if (!isNaN(id)) {
        loadIncidentDetails(id);
        // Clear the query parameter from URL
        router.replace('/incidents', { scroll: false });
      }
    }
  }, [searchParams, incidents, loadIncidentDetails, router]);

  // ============================================================================
  // Filtered Data
  // ============================================================================

  const filteredIncidents = useMemo(() =>
    incidents
      .filter(i => i.status === activeTab)
      .filter(i => selectedSeverity === null || i.severity === selectedSeverity)
      .filter(i => minConfidence === null || (i.confidence_score ?? 0) >= minConfidence),
    [incidents, activeTab, selectedSeverity, minConfidence]
  );

  const criticalCount = useMemo(() =>
    filteredIncidents.filter(i => i.severity === 'critical').length,
    [filteredIncidents]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Incident Timeline</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              AI-powered detection and correlation
              {lastFetched && (
                <span className="ml-2">
                  - Updated {formatLastFetched()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-polling dropdown */}
            <div className="relative" ref={intervalDropdownRef}>
              <button
                onClick={() => setShowIntervalDropdown(!showIntervalDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Clock className="w-4 h-4" />
                <span>{INTERVAL_OPTIONS.find(o => o.value === correlationInterval)?.label || 'Manual Only'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showIntervalDropdown && (
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Auto-Polling Interval</p>
                  </div>
                  {INTERVAL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateCorrelationInterval(option.value)}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                        correlationInterval === option.value ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          correlationInterval === option.value
                            ? 'text-cyan-700 dark:text-cyan-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {option.label}
                        </span>
                        {correlationInterval === option.value && (
                          <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {option.description}
                      </p>
                    </button>
                  ))}
                  {correlationNextRun && correlationInterval !== 'off' && (
                    <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 mt-1">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Next run: {new Date(correlationNextRun).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={refreshAlerts}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Correlating...' : 'Refresh & Correlate'}
            </button>
          </div>
        </header>

        {/* Refresh Status Notification */}
        {refreshStatus && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-6 text-sm ${
            refreshStatus.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20'
              : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {refreshStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{refreshStatus.message}</span>
            </div>
            <button
              onClick={() => setRefreshStatus(null)}
              className="p-1 hover:opacity-70 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <ErrorAlert
            title="Connection Error"
            message={error}
            onRetry={fetchIncidents}
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        {/* Top Stats Bar */}
        <TopStatsBar stats={topStats} className="mb-6" />

        {/* AI Impact Summary - shows when there are AI-assisted incidents */}
        <AIImpactSummary incidents={incidents} className="mb-6" />

        {/* Filter Bar */}
        <IncidentFilterBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedSeverity={selectedSeverity}
          onSeverityChange={setSelectedSeverity}
          minConfidence={minConfidence}
          onConfidenceChange={setMinConfidence}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          stats={stats}
          className="mb-6"
        />

        {/* Main Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-stretch">
          {/* Incident List */}
          <div className="xl:col-span-2 flex flex-col">
            <DashboardCard
              title="Incidents"
              icon={<AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500' : ''}`} />}
              accent={criticalCount > 0 ? 'red' : 'amber'}
              className="flex-1 flex flex-col"
              badge={
                criticalCount > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                    {criticalCount} Critical
                  </span>
                ) : null
              }
            >
              {loading ? (
                <IncidentListSkeleton count={5} />
              ) : filteredIncidents.length === 0 ? (
                incidents.length === 0 ? (
                  <AllSystemsOperational />
                ) : (
                  <NoFilterResults onReset={() => {
                    setActiveTab('open');
                    setTimeRange(168);
                  }} />
                )
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredIncidents.map(incident => (
                    <IncidentListItem
                      key={incident.id}
                      incident={incident}
                      isSelected={selectedIncident === incident.id}
                      onSelect={() => loadIncidentDetails(incident.id)}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>

          {/* Detail Panel */}
          <IncidentDetailPanel
            incident={incidentDetails?.incident || null}
            events={incidentDetails?.events || []}
            onUpdateStatus={updateStatus}
            onAskAI={askAI}
            formatTimestamp={formatTimestamp}
          />
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function IncidentsLoading() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 dark:text-slate-300 text-lg">Loading incidents...</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function IncidentsPage() {
  return (
    <Suspense fallback={<IncidentsLoading />}>
      <IncidentsContent />
    </Suspense>
  );
}
