'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function EditModeIndicator() {
  const { user } = useAuth();
  const [editMode, setEditMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Confirmation overlay state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => {
    // Fetch edit mode status
    const fetchEditMode = async () => {
      try {
        const response = await fetch('/api/security/edit-mode', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setEditMode(data.edit_mode_enabled ?? data.enabled ?? false);
        }
      } catch (error) {
        console.error('Failed to fetch edit mode:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch pending actions count
    const fetchPendingCount = async () => {
      try {
        const response = await fetch('/api/pending-actions/count', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setPendingCount(data.count || 0);
        }
      } catch (error) {
        // Silently fail - pending actions endpoint might not exist yet
      }
    };

    fetchEditMode();
    fetchPendingCount();

    // Poll for updates
    const interval = setInterval(() => {
      fetchEditMode();
      fetchPendingCount();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const toggleEditMode = useCallback(async (enable: boolean) => {
    setToggling(true);
    try {
      const response = await fetch('/api/security/edit-mode', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enable }),
      });
      if (response.ok) {
        const data = await response.json();
        setEditMode(data.edit_mode_enabled ?? data.enabled ?? enable);
      }
    } catch (error) {
      console.error('Failed to toggle edit mode:', error);
    } finally {
      setToggling(false);
    }
  }, []);

  const handleEditModeClick = () => {
    if (toggling) return;

    if (editMode) {
      // Disabling edit mode — no confirmation needed
      toggleEditMode(false);
    } else {
      // Enabling edit mode — show confirmation overlay
      setConfirmInput('');
      setConfirmError('');
      setShowConfirm(true);
    }
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (confirmInput.trim() === user.username) {
      setShowConfirm(false);
      setConfirmInput('');
      setConfirmError('');
      toggleEditMode(true);
    } else {
      setConfirmError('Username does not match');
    }
  };

  if (loading || editMode === null) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Edit Mode Badge */}
        <button
          onClick={handleEditModeClick}
          disabled={toggling}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            transition-colors cursor-pointer
            ${toggling ? 'opacity-50 cursor-wait' : ''}
            ${editMode
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/50'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }
          `}
          title={editMode ? 'Click to switch to read-only mode' : 'Click to enable edit mode'}
        >
          {editMode ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Edit Mode</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Read Only</span>
            </>
          )}
        </button>

        {/* Pending Actions Badge */}
        {pendingCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            title={`${pendingCount} action(s) awaiting approval`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{pendingCount} Pending</span>
          </div>
        )}
      </div>

      {/* Confirmation Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Enable Edit Mode</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">This allows write operations on network devices</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmSubmit} className="px-6 py-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                Type your username <span className="font-semibold text-slate-900 dark:text-white">{user?.username}</span> to confirm.
              </p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => {
                  setConfirmInput(e.target.value);
                  setConfirmError('');
                }}
                placeholder="Enter your username"
                autoFocus
                className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                  confirmError
                    ? 'border-red-300 dark:border-red-500 focus:ring-red-500/40'
                    : 'border-slate-300 dark:border-slate-600 focus:ring-amber-500/40 focus:border-amber-400'
                }`}
              />
              {confirmError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{confirmError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!confirmInput.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  Enable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
