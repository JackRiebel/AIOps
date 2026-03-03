'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, CheckCircle, Clock, AlertTriangle, ShieldAlert, Workflow as WorkflowIcon, Target, History } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';
import { ErrorAlert, EmptyState } from '@/components/common';
import {
  WorkflowListItem,
  WorkflowDetailPanel,
  TemplateSelector,
  ApprovalPanel,
  WorkflowHero,
  WorkflowCardGrid,
  ViewToggle,
  WorkflowOnboarding,
  shouldShowOnboarding,
  OutcomeRecorder,
  AIWorkflowROI,
  EnterpriseCanvas,
  ExecutionMonitor,
  WorkflowTestModal,
  WorkflowModeProvider,
  type Workflow,
  type WorkflowExecution,
  type WorkflowStats,
  type WorkflowTemplate,
  type WorkflowTab,
  type CreateWorkflowRequest,
  type ViewMode,
  type WorkflowOutcome,
} from '@/components/workflows';

// ============================================================================
// API Functions
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
  const res = await fetch(`${API_BASE}/${id}/toggle`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to toggle workflow');
  return res.json();
}

async function deleteWorkflow(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete workflow');
}

async function approveExecution(executionId: number): Promise<WorkflowExecution> {
  const res = await fetch(`${API_BASE}/executions/${executionId}/approve`, {
    method: 'POST',
    credentials: 'include',
  });
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
  const res = await fetch(`/api/executions/${executionId}/outcome`, {
    credentials: 'include',
  });
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

  // Canvas states (canvas is now the only creation method)
  const [showFlowCanvas, setShowFlowCanvas] = useState(false);
  const [canvasWorkflow, setCanvasWorkflow] = useState<Workflow | null>(null);
  const [monitoringExecutionId, setMonitoringExecutionId] = useState<number | null>(null);
  const [monitoringWorkflowId, setMonitoringWorkflowId] = useState<number | null>(null);

  // Workflow test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testWorkflowId, setTestWorkflowId] = useState<number | null>(null);
  const [testWorkflowName, setTestWorkflowName] = useState<string>('');

  // Outcome recording state
  const [showOutcomeRecorder, setShowOutcomeRecorder] = useState(false);
  const [outcomeExecution, setOutcomeExecution] = useState<WorkflowExecution | null>(null);
  const [existingOutcome, setExistingOutcome] = useState<WorkflowOutcome | null>(null);
  const [completedExecutions, setCompletedExecutions] = useState<WorkflowExecution[]>([]);

  // Check if onboarding should be shown on first render
  useEffect(() => {
    if (shouldShowOnboarding()) {
      setShowOnboarding(true);
    }
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
        fetchCompletedExecutions().catch(() => []), // Don't fail if this endpoint doesn't exist yet
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  // ============================================================================
  // Filtered Data
  // ============================================================================

  const filteredWorkflows = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return workflows.filter(w => w.status === 'active');
      case 'pending':
        return []; // Pending tab shows executions, not workflows
      case 'history':
        return workflows; // Show all with execution history
      default:
        return workflows;
    }
  }, [workflows, activeTab]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleToggleWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      const updated = await toggleWorkflow(workflow.id);
      setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
      if (selectedWorkflow?.id === updated.id) {
        setSelectedWorkflow(updated);
      }
    } catch {
      // Toggle failed silently
    }
  }, [selectedWorkflow]);

  const handleDeleteWorkflow = useCallback(async (workflow: Workflow) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;

    try {
      await deleteWorkflow(workflow.id);
      setWorkflows(prev => prev.filter(w => w.id !== workflow.id));
      if (selectedWorkflow?.id === workflow.id) {
        setSelectedWorkflow(null);
      }
    } catch {
      // Delete failed silently
    }
  }, [selectedWorkflow]);

  const handleApprove = useCallback(async (execution: WorkflowExecution) => {
    try {
      await approveExecution(execution.id);
      setPendingApprovals(prev => prev.filter(e => e.id !== execution.id));
      setShowApprovalModal(false);
      setSelectedExecution(null);
      await loadData();
    } catch {
      // Approve failed silently
    }
  }, [loadData]);

  const handleReject = useCallback(async (execution: WorkflowExecution, reason?: string) => {
    try {
      await rejectExecution(execution.id, reason);
      setPendingApprovals(prev => prev.filter(e => e.id !== execution.id));
      setShowApprovalModal(false);
      setSelectedExecution(null);
    } catch {
      // Reject failed silently
    }
  }, []);

  // Outcome recording handlers
  const handleOpenOutcomeRecorder = useCallback(async (execution: WorkflowExecution) => {
    setOutcomeExecution(execution);
    try {
      const outcome = await fetchExecutionOutcome(execution.id);
      setExistingOutcome(outcome);
    } catch {
      setExistingOutcome(null);
    }
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
    // Refresh data after saving outcome
    await loadData();
  }, [outcomeExecution, loadData]);

  const handleCreateFromTemplate = useCallback((template: WorkflowTemplate) => {
    setShowTemplates(false);
    // Navigate to wizard with template
    router.push(`/workflows/new?template=${template.id}`);
  }, [router]);

  const handleWorkflowCreated = useCallback((workflow: Workflow) => {
    setWorkflows(prev => [workflow, ...prev]);
    setShowFlowCanvas(false);
    setCanvasWorkflow(null);
    setSelectedWorkflow(workflow);
  }, []);

  // Handle workflow run - now opens execution monitor
  const handleRun = useCallback(async (workflow: Workflow) => {
    try {
      const res = await fetch(`${API_BASE}/${workflow.id}/run`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to run workflow');
      const data = await res.json();
      // Open execution monitor with the new execution
      if (data.execution_id) {
        setMonitoringWorkflowId(workflow.id);
        setMonitoringExecutionId(data.execution_id);
      }
      await loadData();
    } catch {
      // Run failed silently
    }
  }, [loadData]);

  // Handle opening flow canvas (now the primary creation method)
  const handleOpenCanvas = useCallback((workflow?: Workflow) => {
    setCanvasWorkflow(workflow || null);
    setShowFlowCanvas(true);
  }, []);

  // Handle saving from flow canvas
  const handleCanvasSave = useCallback((workflow: Workflow) => {
    setWorkflows(prev => {
      const exists = prev.find(w => w.id === workflow.id);
      if (exists) {
        return prev.map(w => w.id === workflow.id ? workflow : w);
      }
      return [workflow, ...prev];
    });
    setShowFlowCanvas(false);
    setCanvasWorkflow(null);
    setSelectedWorkflow(workflow);
  }, []);

  // Handle workflow duplicate
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
      // Switch to list view to show the new workflow's detail panel
      setViewMode('list');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to duplicate workflow');
    }
  }, []);

  // Handle workflow export
  const handleExport = useCallback(async (workflow: Workflow) => {
    try {
      const res = await fetch(`${API_BASE}/${workflow.id}/export`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export workflow');
      const data = await res.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_workflow.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    }
  }, []);

  // Handle view history
  const handleViewHistory = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setActiveTab('history');
  }, []);

  // Handle test workflow - opens test modal with time simulation
  const handleTestWorkflow = useCallback((workflow: Workflow) => {
    setTestWorkflowId(workflow.id);
    setTestWorkflowName(workflow.name);
    setShowTestModal(true);
  }, []);

  // Handle edit workflow - switch to list view and select the workflow
  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setViewMode('list');
    // Switch to all tab if we're on a different tab
    if (activeTab !== 'all' && activeTab !== 'active') {
      setActiveTab('all');
    }
  }, [activeTab]);

  // ============================================================================
  // Render
  // ============================================================================

  // Show loading while permissions are being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading workflows...</p>
        </div>
      </div>
    );
  }

  // Access denied if no view permission
  if (!canView) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 dark:text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            You don&apos;t have permission to view workflows. Please contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* Page Container */}
      <div className="px-6 py-6">
        {/* Hero Section */}
        <WorkflowHero
          stats={stats}
          onCreateWorkflow={() => handleOpenCanvas()}
          canCreate={canCreate}
        />

        {/* Error Alert */}
        {error && (
          <ErrorAlert
            title="Connection Error"
            message={error}
            onRetry={loadData}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* AI Workflow ROI - Show when there are workflow stats with AI data */}
        <AIWorkflowROI stats={stats} className="mb-4" />

        {/* Onboarding Card - Show when no workflows exist */}
        {canCreate && workflows.length === 0 && (
          <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <WorkflowIcon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Get Started with AI Workflows
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Create automated responses to network events with AI-powered analysis. Choose from templates, use AI to generate workflows, or build your own.
                </p>
              </div>
              <button
                onClick={() => handleOpenCanvas()}
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors shadow-sm"
              >
                <WorkflowIcon className="w-5 h-5" />
                Create Your First Workflow
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refresh Button - Float in corner */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors z-10"
        title="Refresh"
      >
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>

      {/* Tabs */}
      <div className="flex items-center justify-between px-6 pt-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1" role="tablist" aria-label="Workflow filters">
          {[
            { id: 'all' as const, label: 'All Workflows', count: workflows.length },
            { id: 'active' as const, label: 'Active', count: stats?.workflows.active ?? 0 },
            { id: 'pending' as const, label: 'Pending Approval', count: pendingApprovals.length },
            { id: 'history' as const, label: 'Execution History', count: null },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1
                ${activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-t border-x border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }
              `}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={`
                  ml-2 px-1.5 py-0.5 text-xs rounded-full
                  ${tab.id === 'pending' && tab.count > 0
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }
                `}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        {/* View Toggle - only show for workflow tabs */}
        {(activeTab === 'all' || activeTab === 'active') && (
          <div className="pb-2">
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Card View Mode - Full width grid */}
        {viewMode === 'card' && (activeTab === 'all' || activeTab === 'active') ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
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
              onDelete={(workflow) => handleDeleteWorkflow(workflow)}
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
            <div className="w-1/3 min-w-[320px] max-w-[480px] border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
              {activeTab === 'pending' ? (
                // Pending Approvals List
                pendingApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                    <CheckCircle className="w-12 h-12 mb-3" />
                    <p className="font-medium">No pending approvals</p>
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {pendingApprovals.map(execution => (
                      <div
                        key={execution.id}
                        onClick={() => {
                          if (canApprove) {
                            setSelectedExecution(execution);
                            setShowApprovalModal(true);
                          }
                        }}
                        className={`
                          p-4 transition-colors
                          ${canApprove ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'cursor-not-allowed opacity-75'}
                          ${selectedExecution?.id === execution.id ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-slate-900 dark:text-white">
                              {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {execution.ai_analysis || 'AI analysis pending...'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof execution.ai_confidence === 'number' && (
                              <span className={`
                                text-xs px-2 py-0.5 rounded-full
                                ${execution.ai_confidence >= 0.8
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : execution.ai_confidence >= 0.6
                                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }
                              `}>
                                {(execution.ai_confidence * 100).toFixed(0)}%
                              </span>
                            )}
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{execution.trigger_event_count} events</span>
                          <span>·</span>
                          <span>{new Date(execution.created_at?.endsWith?.('Z') ? execution.created_at : execution.created_at + 'Z').toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === 'history' ? (
                // Execution History List with Outcome Recording
                completedExecutions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                    <History className="w-12 h-12 mb-3" />
                    <p className="font-medium">No execution history</p>
                    <p className="text-sm">Completed executions will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {completedExecutions.map(execution => (
                      <div
                        key={execution.id}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 dark:text-white truncate">
                              {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                              {execution.ai_analysis || 'Execution completed'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {execution.status === 'completed' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Completed
                              </span>
                            )}
                            {execution.status === 'failed' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                Failed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{execution.completed_at
                              ? new Date(execution.completed_at?.endsWith?.('Z') ? execution.completed_at : execution.completed_at + 'Z').toLocaleString()
                              : new Date(execution.created_at?.endsWith?.('Z') ? execution.created_at : execution.created_at + 'Z').toLocaleString()}</span>
                          </div>
                          {canRecordOutcome && (
                            <button
                              onClick={() => handleOpenOutcomeRecorder(execution)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                            >
                              <Target className="w-3.5 h-3.5" />
                              Record Outcome
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // Workflows List
                filteredWorkflows.length === 0 ? (
                  <EmptyState
                    variant="workflows"
                    title="No workflows yet"
                    description={canCreate ? 'Create your first workflow to automate network tasks' : 'No workflows have been created yet'}
                    action={canCreate ? {
                      label: 'Create Workflow',
                      onClick: () => handleOpenCanvas()
                    } : undefined}
                  />
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
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
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  <p className="text-lg font-medium">Select a workflow</p>
                  <p className="text-sm">Choose a workflow from the list to view details</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
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
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedExecution(null);
          }}
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
          onClose={() => {
            setShowOutcomeRecorder(false);
            setOutcomeExecution(null);
            setExistingOutcome(null);
          }}
        />
      )}

      {/* Canvas - Primary Workflow Creation Method */}
      {showFlowCanvas && (
        <WorkflowModeProvider>
          <EnterpriseCanvas
            onClose={() => {
              setShowFlowCanvas(false);
              setCanvasWorkflow(null);
            }}
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
          onClose={() => {
            setMonitoringExecutionId(null);
            setMonitoringWorkflowId(null);
          }}
          onEdit={(workflowId) => {
            // Find the workflow and open it in the canvas editor
            // Use Number() to handle potential string/number type mismatch from API
            const workflow = workflows.find(w => Number(w.id) === Number(workflowId));
            console.log('[ExecutionMonitor] onEdit called:', { workflowId, found: !!workflow, workflows: workflows.map(w => ({ id: w.id, name: w.name })) });
            if (workflow) {
              setMonitoringExecutionId(null);
              setMonitoringWorkflowId(null);
              handleOpenCanvas(workflow);
            } else {
              console.error('[ExecutionMonitor] Workflow not found for ID:', workflowId);
            }
          }}
          onRetry={async () => {
            // Re-run the workflow
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

      {/* Workflow Test Modal - Time Machine simulation */}
      {showTestModal && testWorkflowId && (
        <WorkflowTestModal
          isOpen={showTestModal}
          onClose={() => {
            setShowTestModal(false);
            setTestWorkflowId(null);
            setTestWorkflowName('');
          }}
          workflowId={testWorkflowId}
          workflowName={testWorkflowName}
        />
      )}
    </div>
  );
}
