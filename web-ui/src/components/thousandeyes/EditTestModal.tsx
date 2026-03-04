'use client';

import { memo, useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import type { Test } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EditTestModalProps {
  isOpen: boolean;
  test: Test | null;
  onClose: () => void;
  onSave: (testId: number, data: Record<string, any>) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const intervals = [
  { value: 60, label: 'Every minute' },
  { value: 120, label: 'Every 2 minutes' },
  { value: 300, label: 'Every 5 minutes' },
  { value: 600, label: 'Every 10 minutes' },
  { value: 900, label: 'Every 15 minutes' },
  { value: 1800, label: 'Every 30 minutes' },
  { value: 3600, label: 'Every hour' },
];

// ============================================================================
// EditTestModal Component
// ============================================================================

export const EditTestModal = memo(({
  isOpen,
  test,
  onClose,
  onSave,
  loading,
  error,
}: EditTestModalProps) => {
  const [testName, setTestName] = useState('');
  const [target, setTarget] = useState('');
  const [interval, setInterval_] = useState(300);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form with selected test
  useEffect(() => {
    if (test) {
      setTestName(test.testName || '');
      setTarget(test.url || test.server || '');
      setInterval_(test.interval || 300);
      setAlertsEnabled(test.alertsEnabled === true || test.alertsEnabled === 1);
      setEnabled(test.enabled === true || test.enabled === 1);
      setDescription(test.description || '');
    }
  }, [test]);

  const handleSave = async () => {
    if (!test || !testName.trim()) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        testName: testName.trim(),
        interval,
        alertsEnabled: alertsEnabled ? 1 : 0,
        enabled: enabled ? 1 : 0,
      };
      if (description.trim()) updates.description = description.trim();
      // Set the right target field based on test type
      if (test.type === 'http-server' || test.type === 'page-load' || test.type === 'web-transactions') {
        if (target.trim()) updates.url = target.trim();
      } else if (test.type === 'agent-to-server' || test.type === 'agent-to-agent') {
        if (target.trim()) updates.server = target.trim();
      } else if (test.type === 'dns-server' || test.type === 'dns-trace') {
        if (target.trim()) updates.domain = target.trim();
      }
      await onSave(test.testId, updates);
      onClose();
    } catch {
      // Error displayed via error prop
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !test) return null;

  const targetLabel = (() => {
    switch (test.type) {
      case 'http-server': case 'page-load': case 'web-transactions': return 'URL';
      case 'agent-to-server': case 'agent-to-agent': return 'Server / IP';
      case 'dns-server': case 'dns-trace': return 'Domain';
      default: return 'Target';
    }
  })();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Test</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ID: {test.testId} &middot; {test.type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Test Name
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              {targetLabel}
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              Interval
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval_(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white text-sm"
            >
              {intervals.map(i => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">Enabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">Alerts Enabled</span>
            </label>
          </div>

          {/* Agents (read-only display) */}
          {test.agents && test.agents.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Agents
              </label>
              <div className="flex flex-wrap gap-1.5">
                {test.agents.map(a => (
                  <span key={a.agentId} className="px-2 py-1 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-md text-xs">
                    {a.agentName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={handleSave}
            disabled={saving || loading || !testName.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/50 transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

EditTestModal.displayName = 'EditTestModal';

export default EditTestModal;
