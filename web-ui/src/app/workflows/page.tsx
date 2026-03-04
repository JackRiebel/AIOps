'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Workflow as WorkflowIcon,
  Target,
  History,
  Activity,
  Zap,
  Search,
  LayoutGrid,
  List,
  Loader2,
  TrendingUp,
  Sparkles,
  Play,
} from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';
import { ErrorAlert } from '@/components/common';
import {
  WorkflowListItem,
  WorkflowDetailPanel,
  TemplateSelector,
  ApprovalPanel,
  WorkflowCardGrid,
  WorkflowOnboarding,
  shouldShowOnboarding,
  OutcomeRecorder,
  EnterpriseCanvas,
  ExecutionMonitor,
  WorkflowTestModal,
  WorkflowModeProvider,
  type Workflow,
  type WorkflowExecution,
  type WorkflowStats,
  type WorkflowTemplate,
  type WorkflowTab,
  type ViewMode,
  type WorkflowOutcome,
} from '@/components/workflows';

// ============================================================================
// API Functions (unchanged)
// ============================================================================

const API_BASE = '/api/workflows';

async function fetchWorkflows(params?: { status?: string; organization?: string }): Promise<Workflow[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.organization) searchParams.set('organization', params.organization);
  const url = `${API_BASE}${searchParams.toString() ? `?${searchParams}` : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

async function fetchStats(organization?: string): Promise<WorkflowStats> {
  const url = organization ? `${API_BASE}/stats?organization=${organization}` : `${API_BASE}/stats`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function fetchTemplates(): Promise<WorkflowTemplate[]> {
  const res = await fetch(`${API_BASE}/templates`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

async function fetchPendingApprovals(organization?: string): Promise<WorkflowExecution[]> {
  const url = organization
    ? `${API_BASE}/executions/pending?organization=${organization}`
    : `${API_BASE}/executions/pending`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch pending approvals');
  return res.json();
}

async function toggleWorkflow(id: number): Promise<Workflow> {
  const res = await fetch(`${API_BASE}/${id}/toggle`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to toggle workflow');
  return res.json();
}

async function deleteWorkflow(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to delete workflow');
}

async function approveExecution(executionId: number): Promise<WorkflowExecution> {
  const res = await fetch(`${API_BASE}/executions/${executionId}/approve`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to approve execution');
  return res.json();
}

async function rejectExecution(executionId: number, reason?: string): Promise<WorkflowExecution> {
  const res = await fetch(`${API_BASE}/executions/${executionId}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to reject execution');
  return res.json();
}

async function fetchExecutionOutcome(executionId: number): Promise<WorkflowOutcome | null> {
  const res = await fetch(`/api/executions/${executionId}/outcome`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch outcome');
  return res.json();
}

async function saveExecutionOutcome(
  executionId: number,
  outcome: Omit<WorkflowOutcome, 'id' | 'created_at' | 'updated_at'>
): Promise<WorkflowOutcome> {
  const res = await fetch(`/api/executions/${executionId}/outcome`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(outcome),
  });
  if (!res.ok) throw new Error('Failed to save outcome');
  return res.json();
}

async function fetchCompletedExecutions(workflowId?: number): Promise<WorkflowExecution[]> {
  const url = workflowId
    ? `${API_BASE}/${workflowId}/executions?status=completed`
    : `${API_BASE}/executions/completed`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch completed executions');
  return res.json();
}

// ============================================================================
// Stat Card
// ============================================================================

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function WorkflowsPage() {
  const router = useRouter();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<WorkflowExecution[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Permission checks
  const canView = hasPermission(PERMISSIONS.WORKFLOWS_VIEW);
  const canCreate = hasPermission(PERMISSIONS.WORKFLOWS_CREATE);
  const canEdit = hasPermission(PERMISSIONS.WORKFLOWS_EDIT);
  const canDelete = hasPermission(PERMISSIONS.WORKFLOWS_DELETE);
  const canApprove = hasPermission(PERMISSIONS.WORKFLOWS_APPROVE);
  const canExecute = hasPermission(PERMISSIONS.WORKFLOWS_EXECUTE);
  const canRecordOutcome = hasPermission(PERMISSIONS.WORKFLOWS_RECORD_OUTCOME);

  // UI State
  const [activeTab, setActiveTab] = useState<WorkflowTab>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Canvas states
  const [showFlowCanvas, setShowFlowCanvas] = useState(false);
  const [canvasWorkflow, setCanvasWorkflow] = useState<Workflow | null>(null);
  const [monitoringExecutionId, setMonitoringExecutionId] = useState<number | null>(null);
  const [monitoringWorkflowId, setMonitoringWorkflowId] = useState<number | null>(null);

  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testWorkflowId, setTestWorkflowId] = useState<number | null>(null);
  const [testWorkflowName, setTestWorkflowName] = useState<string>('');

  // Outcome recording state
  const [showOutcomeRecorder, setShowOutcomeRecorder] = useState(false);
  const [outcomeExecution, setOutcomeExecution] = useState<WorkflowExecution | null>(null);
  const [existingOutcome, setExistingOutcome] = useState<WorkflowOutcome | null>(null);
  const [completedExecutions, setCompletedExecutions] = useState<WorkflowExecution[]>([]);

  useEffect(() => {
    if (shouldShowOnboarding()) setShowOnboarding(true);
  }, []);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [workflowsData, statsData, templatesData, pendingData, completedData] = await Promise.all([
        fetchWorkflows(),
        fetchStats(),
        fetchTemplates(),
        fetchPendingApprovals(),
        fetchCompletedExecutions().catch(() => []),
      ]);
      setWorkflows(workflowsData);
      setStats(statsData);
      setTemplates(templatesData);
      setPendingApprovals(pendingData);
      setCompletedExecutions(completedData);
    } catch {
      setError('Failed to load workflows. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  // ============================================================================
  // Filtered Data
  // ============================================================================

  const filteredWorkflows = useMemo(() => {
    let list = workflows;
    switch (activeTab) {
      case 'active':
        list = workflows.filter(w => w.status === 'active');
        break;
      case 'pending':
        return [];
      case 'history':
        break;
      default:
        break;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.description?.toLowerCase().includes(q) ||
        w.trigger_type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [workflows, activeTab, searchQuery]);

  // ============================================================================
  // Handlers (all preserved exactly)
  // ============================================================================

  const handleToggleWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      const updated = await toggleWorkflow(workflow.id);
      setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
      if (selectedWorkflow?.id === updated.id) setSelectedWorkflow(updated);
    } catch { /* silent */ }
  }, [selectedWorkflow]);

  const handleDeleteWorkflow = useCallback(async (workflow: Workflow) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;
    try {
      await deleteWorkflow(workflow.id);
      setWorkflows(prev => prev.filter(w => w.id !== workflow.id));
      if (selectedWorkflow?.id === workflow.id) setSelectedWorkflow(null);
    } catch { /* silent */ }
  }, [selectedWorkflow]);

  const handleApprove = useCallback(async (execution: WorkflowExecution) => {
    try {
      await approveExecution(execution.id);
      setPendingApprovals(prev => prev.filter(e => e.id !== execution.id));
      setShowApprovalModal(false);
      setSelectedExecution(null);
      await loadData();
    } catch { /* silent */ }
  }, [loadData]);

  const handleReject = useCallback(async (execution: WorkflowExecution, reason?: string) => {
    try {
      await rejectExecution(execution.id, reason);
      setPendingApprovals(prev => prev.filter(e => e.id !== execution.id));
      setShowApprovalModal(false);
      setSelectedExecution(null);
    } catch { /* silent */ }
  }, []);

  const handleOpenOutcomeRecorder = useCallback(async (execution: WorkflowExecution) => {
    setOutcomeExecution(execution);
    try {
      const outcome = await fetchExecutionOutcome(execution.id);
      setExistingOutcome(outcome);
    } catch { setExistingOutcome(null); }
    setShowOutcomeRecorder(true);
  }, []);

  const handleSaveOutcome = useCallback(async (
    outcomeData: Omit<WorkflowOutcome, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (!outcomeExecution) return;
    await saveExecutionOutcome(outcomeExecution.id, outcomeData);
    setShowOutcomeRecorder(false);
    setOutcomeExecution(null);
    setExistingOutcome(null);
    await loadData();
  }, [outcomeExecution, loadData]);

  const handleCreateFromTemplate = useCallback((template: WorkflowTemplate) => {
    setShowTemplates(false);
    router.push(`/workflows/new?template=${template.id}`);
  }, [router]);

  const handleWorkflowCreated = useCallback((workflow: Workflow) => {
    setWorkflows(prev => [workflow, ...prev]);
    setShowFlowCanvas(false);
    setCanvasWorkflow(null);
    setSelectedWorkflow(workflow);
  }, []);

  const handleRun = useCallback(async (workflow: Workflow) => {
    try {
      const res = await fetch(`${API_BASE}/${workflow.id}/run`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to run workflow');
      const data = await res.json();
      if (data.execution_id) {
        setMonitoringWorkflowId(workflow.id);
        setMonitoringExecutionId(data.execution_id);
      }
      await loadData();
    } catch { /* silent */ }
  }, [loadData]);

  const handleOpenCanvas = useCallback((workflow?: Workflow) => {
    setCanvasWorkflow(workflow || null);
    setShowFlowCanvas(true);
  }, []);

  const handleCanvasSave = useCallback((workflow: Workflow) => {
    setWorkflows(prev => {
      const exists = prev.find(w => w.id === workflow.id);
      if (exists) return prev.map(w => w.id === workflow.id ? workflow : w);
      return [workflow, ...prev];
    });
    setShowFlowCanvas(false);
    setCanvasWorkflow(null);
    setSelectedWorkflow(workflow);
  }, []);

  const handleDuplicate = useCallback(async (workflow: Workflow) => {
    try {
      const res = await fetch(`${API_BASE}/${workflow.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to duplicate workflow');
      }
      const newWorkflow = await res.json();
      setWorkflows(prev => [newWorkflow, ...prev]);
      setSelectedWorkflow(newWorkflow);
      setViewMode('list');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to duplicate workflow');
    }
  }, []);

  const handleExport = useCallback(async (workflow: Workflow) => {
    try {
      const res = await fetch(`${API_BASE}/${workflow.id}/export`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to export workflow');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, []);

  const handleViewHistory = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setActiveTab('history');
  }, []);

  const handleTestWorkflow = useCallback((workflow: Workflow) => {
    setTestWorkflowId(workflow.id);
    setTestWorkflowName(workflow.name);
    setShowTestModal(true);
  }, []);

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setViewMode('list');
    if (activeTab !== 'all' && activeTab !== 'active') setActiveTab('all');
  }, [activeTab]);

  // ============================================================================
  // Tab Config
  // ============================================================================

  const tabs = useMemo(() => [
    { id: 'all' as const, label: 'All', icon: WorkflowIcon, count: workflows.length },
    { id: 'active' as const, label: 'Active', icon: Activity, count: stats?.workflows.active ?? 0 },
    { id: 'pending' as const, label: 'Pending', icon: AlertTriangle, count: pendingApprovals.length },
    { id: 'history' as const, label: 'History', icon: History, count: completedExecutions.length },
  ], [workflows.length, stats, pendingApprovals.length, completedExecutions.length]);

  // ============================================================================
  // Render
  // ============================================================================

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 dark:text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            You don&apos;t have permission to view workflows. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const successRate = stats ? stats.success_rate : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              Workflow Automation
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 font-light">
              AI-powered network operations with approval workflows and execution tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all shadow-sm hover:shadow-md disabled:opacity-40 group"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 transition-transform group-hover:rotate-45 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {canCreate && (
              <button
                onClick={() => handleOpenCanvas()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create Workflow
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <ErrorAlert
            title="Connection Error"
            message={error}
            onRetry={loadData}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={WorkflowIcon}
            label="Total"
            value={stats?.workflows.total ?? workflows.length}
            sub={`${stats?.workflows.draft ?? 0} drafts`}
            accent="bg-gradient-to-br from-slate-500 to-slate-600"
          />
          <StatCard
            icon={Activity}
            label="Active"
            value={stats?.workflows.active ?? 0}
            sub={`${stats?.workflows.paused ?? 0} paused`}
            accent="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pending"
            value={pendingApprovals.length}
            sub={pendingApprovals.length > 0 ? 'Needs review' : 'All clear'}
            accent={`bg-gradient-to-br ${pendingApprovals.length > 0 ? 'from-amber-500 to-amber-600' : 'from-slate-400 to-slate-500'}`}
          />
          <StatCard
            icon={TrendingUp}
            label="Success Rate"
            value={stats && stats.total_triggers > 0 ? `${Math.round(successRate)}%` : '--'}
            sub={stats ? `${stats.total_triggers} total runs` : 'No data'}
            accent={`bg-gradient-to-br ${successRate >= 90 ? 'from-emerald-500 to-emerald-600' : successRate >= 70 ? 'from-amber-500 to-amber-600' : 'from-slate-400 to-slate-500'}`}
          />
        </div>

        {/* ── Empty state CTA ── */}
        {canCreate && workflows.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-cyan-300 dark:border-cyan-700/50 bg-gradient-to-r from-cyan-50/50 to-blue-50/50 dark:from-cyan-900/10 dark:to-blue-900/10 p-6 mb-5">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Get Started with AI Workflows
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Create automated responses to network events with AI-powered analysis and approval workflows.
                </p>
              </div>
              <button
                onClick={() => handleOpenCanvas()}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create First Workflow
              </button>
            </div>
          </div>
        )}

        {/* ── Tab Bar + Controls ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isPending = tab.id === 'pending' && tab.count > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/30'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-500' : ''}`} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                      isPending
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                        : isActive
                          ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                          : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          {(activeTab === 'all' || activeTab === 'active') && (
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workflows..."
                  className="w-52 pl-8 pr-3 py-2 bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg text-[13px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 shadow-sm"
                />
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-lg p-0.5 shadow-sm">
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Card view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex overflow-hidden mt-4">
        {/* Card View */}
        {viewMode === 'card' && (activeTab === 'all' || activeTab === 'active') ? (
          <div className="flex-1 overflow-y-auto">
            <WorkflowCardGrid
              workflows={filteredWorkflows}
              selectedWorkflowId={selectedWorkflow?.id}
              onSelect={setSelectedWorkflow}
              onRun={handleRun}
              onTest={handleTestWorkflow}
              onDuplicate={handleDuplicate}
              onExport={handleExport}
              onViewHistory={handleViewHistory}
              onEdit={handleEditWorkflow}
              onDelete={handleDeleteWorkflow}
              onToggle={handleToggleWorkflow}
              onCreateNew={() => handleOpenCanvas()}
              canExecute={canExecute}
              canEdit={canEdit}
              canDelete={canDelete}
              canCreate={canCreate}
            />
          </div>
        ) : (
          <>
            {/* List Panel */}
            <div className="w-[380px] min-w-[340px] border-r border-slate-200 dark:border-slate-700/60 overflow-y-auto bg-white dark:bg-slate-800/40">
              {activeTab === 'pending' ? (
                pendingApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                      <CheckCircle className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">No pending approvals</p>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">All caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {pendingApprovals.map(execution => (
                      <button
                        key={execution.id}
                        type="button"
                        onClick={() => {
                          if (canApprove) {
                            setSelectedExecution(execution);
                            setShowApprovalModal(true);
                          }
                        }}
                        className={`w-full text-left p-4 transition-colors ${
                          canApprove ? 'hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer' : 'cursor-not-allowed opacity-75'
                        } ${selectedExecution?.id === execution.id ? 'bg-cyan-50/50 dark:bg-cyan-900/10 border-l-2 border-l-cyan-500' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                              {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
                            </h3>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {execution.ai_analysis || 'AI analysis pending...'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {typeof execution.ai_confidence === 'number' && (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                execution.ai_confidence >= 0.8
                                  ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : execution.ai_confidence >= 0.6
                                    ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                    : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400'
                              }`}>
                                {(execution.ai_confidence * 100).toFixed(0)}%
                              </span>
                            )}
                            {execution.ai_risk_level && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                execution.ai_risk_level === 'low'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : execution.ai_risk_level === 'medium'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                              }`}>
                                {execution.ai_risk_level} risk
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {execution.trigger_event_count} events
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(execution.created_at?.endsWith?.('Z') ? execution.created_at : execution.created_at + 'Z').toLocaleString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : activeTab === 'history' ? (
                completedExecutions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4">
                      <History className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">No execution history</p>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Completed executions will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {completedExecutions.map(execution => (
                      <div key={execution.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                              {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
                            </h3>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {execution.ai_analysis || 'Execution completed'}
                            </p>
                          </div>
                          <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            execution.status === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400'
                          }`}>
                            {execution.status === 'completed' ? 'Completed' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                            <Clock className="w-3 h-3" />
                            {execution.completed_at
                              ? new Date(execution.completed_at?.endsWith?.('Z') ? execution.completed_at : execution.completed_at + 'Z').toLocaleString()
                              : new Date(execution.created_at?.endsWith?.('Z') ? execution.created_at : execution.created_at + 'Z').toLocaleString()}
                          </span>
                          {canRecordOutcome && (
                            <button
                              onClick={() => handleOpenOutcomeRecorder(execution)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors border border-purple-200/60 dark:border-purple-500/20"
                            >
                              <Target className="w-3 h-3" />
                              Record Outcome
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                filteredWorkflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4">
                      <WorkflowIcon className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {searchQuery ? 'No matching workflows' : 'No workflows yet'}
                    </p>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                      {searchQuery
                        ? `No workflows match "${searchQuery}"`
                        : canCreate ? 'Create your first workflow to get started' : 'No workflows have been created yet'}
                    </p>
                    {canCreate && !searchQuery && (
                      <button
                        onClick={() => handleOpenCanvas()}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Workflow
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredWorkflows.map(workflow => (
                      <WorkflowListItem
                        key={workflow.id}
                        workflow={workflow}
                        isSelected={selectedWorkflow?.id === workflow.id}
                        onClick={() => setSelectedWorkflow(workflow)}
                        onToggle={canEdit ? () => handleToggleWorkflow(workflow) : undefined}
                        onDelete={canDelete ? () => handleDeleteWorkflow(workflow) : undefined}
                      />
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Detail Panel */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
              {selectedWorkflow ? (
                <WorkflowDetailPanel
                  workflow={selectedWorkflow}
                  onUpdate={(updated) => {
                    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
                    setSelectedWorkflow(updated);
                  }}
                  onClose={() => setSelectedWorkflow(null)}
                  onEditCanvas={(workflow) => {
                    setSelectedWorkflow(null);
                    handleOpenCanvas(workflow);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <WorkflowIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a workflow</p>
                  <p className="text-[13px] text-slate-400 dark:text-slate-500 mt-1">Choose from the list to view details</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modals (all preserved) ── */}
      {showTemplates && (
        <TemplateSelector
          templates={templates}
          onSelect={handleCreateFromTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showApprovalModal && selectedExecution && canApprove && (
        <ApprovalPanel
          execution={selectedExecution}
          onApprove={() => handleApprove(selectedExecution)}
          onReject={(reason) => handleReject(selectedExecution, reason)}
          onClose={() => { setShowApprovalModal(false); setSelectedExecution(null); }}
        />
      )}

      {showOnboarding && (
        <WorkflowOnboarding
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {showOutcomeRecorder && outcomeExecution && (
        <OutcomeRecorder
          execution={outcomeExecution}
          existingOutcome={existingOutcome}
          onSave={handleSaveOutcome}
          onClose={() => { setShowOutcomeRecorder(false); setOutcomeExecution(null); setExistingOutcome(null); }}
        />
      )}

      {showFlowCanvas && (
        <WorkflowModeProvider>
          <EnterpriseCanvas
            onClose={() => { setShowFlowCanvas(false); setCanvasWorkflow(null); }}
            onSave={handleCanvasSave}
            initialFlow={canvasWorkflow?.flow_data}
            workflowId={canvasWorkflow?.id}
            workflowName={canvasWorkflow?.name}
          />
        </WorkflowModeProvider>
      )}

      {monitoringExecutionId && (
        <ExecutionMonitor
          executionId={monitoringExecutionId}
          onClose={() => { setMonitoringExecutionId(null); setMonitoringWorkflowId(null); }}
          onEdit={(workflowId) => {
            const workflow = workflows.find(w => Number(w.id) === Number(workflowId));
            if (workflow) {
              setMonitoringExecutionId(null);
              setMonitoringWorkflowId(null);
              handleOpenCanvas(workflow);
            }
          }}
          onRetry={async () => {
            if (monitoringWorkflowId) {
              const workflow = workflows.find(w => w.id === monitoringWorkflowId);
              if (workflow) {
                setMonitoringExecutionId(null);
                await handleRun(workflow);
              }
            } else {
              setMonitoringExecutionId(null);
              setMonitoringWorkflowId(null);
            }
          }}
        />
      )}

      {showTestModal && testWorkflowId && (
        <WorkflowTestModal
          isOpen={showTestModal}
          onClose={() => { setShowTestModal(false); setTestWorkflowId(null); setTestWorkflowName(''); }}
          workflowId={testWorkflowId}
          workflowName={testWorkflowName}
        />
      )}
    </div>
  );
}
