'use client';

import { useState, useEffect } from 'react';

export default function EditModeIndicator() {
  const [editMode, setEditMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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

  if (loading || editMode === null) {
    return null;
  }

  const handleEditModeClick = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const response = await fetch('/api/security/edit-mode', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !editMode }),
      });
      if (response.ok) {
        const data = await response.json();
        setEditMode(data.edit_mode_enabled ?? data.enabled ?? !editMode);
      }
    } catch (error) {
      console.error('Failed to toggle edit mode:', error);
    } finally {
      setToggling(false);
    }
  };

  return (
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
  );
}
