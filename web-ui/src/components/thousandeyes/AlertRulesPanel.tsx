'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Pencil, Trash2, ChevronRight, Loader2, X, Bell, BellOff } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { AlertRule } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AlertRulesPanelProps {
  onAskAI?: (context: string) => void;
}

// ============================================================================
// Severity Badge
// ============================================================================

function SeverityBadge({ severity }: { severity?: string }) {
  const config: Record<string, string> = {
    critical: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50',
    major: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/50',
    minor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50',
    info: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50',
  };
  const s = severity?.toLowerCase() || 'info';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${config[s] || config.info}`}>
      {(severity || 'info').toUpperCase()}
    </span>
  );
}

// ============================================================================
// Edit/Create Modal
// ============================================================================

function AlertRuleModal({ rule, onSave, onClose, saving }: {
  rule: Partial<AlertRule> | null;
  onSave: (data: Record<string, any>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(rule?.ruleName || '');
  const [expression, setExpression] = useState(rule?.expression || '');
  const [alertType, setAlertType] = useState(rule?.alertType || 'http-server');
  const [severity, setSeverity] = useState<string>(rule?.severity || 'major');
  const [minSources, setMinSources] = useState(rule?.minimumSources ?? 1);
  const [roundsRequired, setRoundsRequired] = useState(rule?.roundsViolatingRequired ?? 2);
  const [roundsOutOf, setRoundsOutOf] = useState(rule?.roundsViolatingOutOf ?? 3);
  const [notifyClear, setNotifyClear] = useState(rule?.notifyOnClear ?? true);

  const isEdit = !!rule?.ruleId;

  const handleSubmit = async () => {
    if (!name.trim() || !expression.trim()) return;
    await onSave({
      ruleName: name.trim(),
      expression: expression.trim(),
      alertType,
      severity,
      minimumSources: minSources,
      roundsViolatingRequired: roundsRequired,
      roundsViolatingOutOf: roundsOutOf,
      notifyOnClear: notifyClear,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Rule Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Latency Alert"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Expression</label>
            <input type="text" value={expression} onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g., ((responseTime >= 1000))"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white font-mono text-sm" />
            <p className="mt-1 text-xs text-slate-500">ThousandEyes alert expression syntax</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Alert Type</label>
              <select value={alertType} onChange={(e) => setAlertType(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-900 dark:text-white">
                {['http-server', 'network', 'page-load', 'dns-server', 'dns-trace', 'web-transactions', 'ftp-server', 'sip-server', 'voice', 'bgp'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-900 dark:text-white">
                {['critical', 'major', 'minor', 'info'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Min Sources</label>
              <input type="number" min={1} max={100} value={minSources} onChange={(e) => setMinSources(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Rounds Required</label>
              <input type="number" min={1} max={10} value={roundsRequired} onChange={(e) => setRoundsRequired(parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Out of Rounds</label>
              <input type="number" min={1} max={10} value={roundsOutOf} onChange={(e) => setRoundsOutOf(parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm text-slate-900 dark:text-white" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyClear} onChange={(e) => setNotifyClear(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
            <span className="text-sm text-slate-700 dark:text-slate-200">Notify on clear</span>
          </label>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
          <button onClick={handleSubmit} disabled={saving || !name.trim() || !expression.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Update Rule' : 'Create Rule'}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/50 transition font-medium text-sm disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AlertRulesPanel Component
// ============================================================================

export const AlertRulesPanel = memo(({ onAskAI }: AlertRulesPanelProps) => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalRule, setModalRule] = useState<Partial<AlertRule> | null | 'create'>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/thousandeyes/alert-rules?organization=default', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rulesList = data.alertRules || data._embedded?.alertRules || data.rules || [];
      setRules(rulesList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alert rules');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = useCallback(async (data: Record<string, any>) => {
    setSaving(true);
    try {
      const isEdit = modalRule && typeof modalRule === 'object' && 'ruleId' in modalRule;
      const url = isEdit
        ? `/api/thousandeyes/alert-rules/${(modalRule as AlertRule).ruleId}?organization=default`
        : '/api/thousandeyes/alert-rules?organization=default';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      await fetchRules();
      setModalRule(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally { setSaving(false); }
  }, [modalRule, fetchRules]);

  const handleDelete = useCallback(async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      const res = await fetch(`/api/thousandeyes/alert-rules/${ruleId}?organization=default`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    } finally { setDeletingId(null); }
  }, [fetchRules]);

  const totalPages = Math.ceil(rules.length / pageSize);
  const paginatedRules = rules.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <DashboardCard title="Alert Rules" icon={<Shield className="w-4 h-4" />} accent="amber" compact>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
        </p>
        <button onClick={() => setModalRule('create')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs rounded-lg hover:from-amber-700 hover:to-orange-700 transition font-medium shadow-sm">
          <Plus className="w-3.5 h-3.5" /> New Rule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && rules.length === 0 && (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && rules.length === 0 && (
        <div className="py-8 text-center">
          <Shield className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">No alert rules configured</p>
          <p className="text-xs text-slate-400 mt-1">Create rules to get notified of test failures</p>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-1.5">
        {paginatedRules.map(rule => (
          <div key={rule.ruleId} className="border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition"
              onClick={() => setExpandedId(expandedId === rule.ruleId ? null : rule.ruleId)}
            >
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedId === rule.ruleId ? 'rotate-90' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{rule.ruleName}</span>
                  <SeverityBadge severity={rule.severity} />
                  {rule.default && (
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-[10px]">Default</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{rule.alertType} &middot; {rule.expression}</p>
              </div>
              <div className="flex items-center gap-1">
                {rule.notifyOnClear ? (
                  <span title="Notify on clear"><Bell className="w-3.5 h-3.5 text-emerald-500" /></span>
                ) : (
                  <span title="No clear notification"><BellOff className="w-3.5 h-3.5 text-slate-400" /></span>
                )}
              </div>
            </div>

            {/* Expanded Detail */}
            {expandedId === rule.ruleId && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/30 space-y-2">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Min Sources:</span>
                    <span className="ml-1 text-slate-900 dark:text-white font-medium">{rule.minimumSources ?? 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rounds:</span>
                    <span className="ml-1 text-slate-900 dark:text-white font-medium">{rule.roundsViolatingRequired ?? '?'} of {rule.roundsViolatingOutOf ?? '?'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Direction:</span>
                    <span className="ml-1 text-slate-900 dark:text-white font-medium">{rule.direction || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Expression:</span>
                  <code className="block mt-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-200 break-all">
                    {rule.expression}
                  </code>
                </div>
                {rule.testIds && rule.testIds.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500">Assigned to {rule.testIds.length} test{rule.testIds.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setModalRule(rule)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => handleDelete(rule.ruleId)} disabled={deletingId === rule.ruleId}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition disabled:opacity-50">
                    <Trash2 className="w-3 h-3" /> {deletingId === rule.ruleId ? 'Deleting...' : 'Delete'}
                  </button>
                  {onAskAI && (
                    <button onClick={() => onAskAI(`Analyze alert rule "${rule.ruleName}" with expression: ${rule.expression}. Is this rule configured optimally?`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition">
                      Ask AI
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {rules.length > pageSize && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={rules.length}
          filteredItems={rules.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
        />
      )}

      {/* Modal */}
      {modalRule !== null && (
        <AlertRuleModal
          rule={modalRule === 'create' ? {} : modalRule}
          onSave={handleSave}
          onClose={() => setModalRule(null)}
          saving={saving}
        />
      )}
    </DashboardCard>
  );
});

AlertRulesPanel.displayName = 'AlertRulesPanel';

export default AlertRulesPanel;
