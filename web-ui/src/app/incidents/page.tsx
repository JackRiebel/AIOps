'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, AlertTriangle } from 'lucide-react';
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

export default function IncidentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<{ incident: Incident; events: Event[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);
  const [activeTab, setActiveTab] = useState<'open' | 'investigating' | 'resolved' | 'closed'>('open');
  const [selectedSeverity, setSelectedSeverity] = useState<'critical' | 'high' | 'medium' | 'info' | null>(null);
  const [minConfidence, setMinConfidence] = useState<80 | 60 | 40 | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const hasFetchedRef = useRef(false);
  const previousTimeRangeRef = useRef(timeRange);

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
      const res = await fetch('/api/incidents-refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to refresh');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchIncidents();
    } catch {
      // Refresh failed silently
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchIncidents]);

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

    // Navigate to network page with encoded payload
    window.location.href = `/network?new_session=true&incident=${encodeURIComponent(encoded)}`;
  }, [incidentDetails]);

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
          <button
            onClick={refreshAlerts}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh & Correlate'}
          </button>
        </header>

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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Incident List */}
          <div className="xl:col-span-2">
            <DashboardCard
              title="Incidents"
              icon={<AlertTriangle className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500' : ''}`} />}
              accent={criticalCount > 0 ? 'red' : 'amber'}
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
                    setTimeRange(24);
                  }} />
                )
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-2 custom-scrollbar">
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
