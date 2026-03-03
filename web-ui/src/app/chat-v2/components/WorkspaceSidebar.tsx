'use client';

/**
 * WorkspaceSidebar - Session/Workspace management dropdown
 */

import { useState } from 'react';
import { CanvasIcon } from './CanvasIcon';

export interface Workspace {
  id: string;
  name: string;
  updatedAt: string;
  messageCount: number;
}

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  currentId?: string;
  onNewWorkspace: () => void;
  onLoadWorkspace: (id: string) => void;
  onDeleteWorkspace: (id: string) => Promise<void>;
  showCanvas: boolean;
  onToggleCanvas: () => void;
}

export function WorkspaceSidebar({
  workspaces,
  currentId,
  onNewWorkspace,
  onLoadWorkspace,
  onDeleteWorkspace,
  showCanvas,
  onToggleCanvas,
}: WorkspaceSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentWorkspace = workspaces.find(w => w.id === currentId);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteWorkspace(id);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('[Sidebar] Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Menu button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setConfirmDeleteId(null);
        }}
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
        title="Workspaces"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>

      {/* Current workspace name */}
      {currentWorkspace && (
        <span className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
          {currentWorkspace.name}
        </span>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setConfirmDeleteId(null);
            }}
          />
          <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Canvas Toggle */}
            <button
              onClick={() => {
                onToggleCanvas();
                setIsOpen(false);
                setConfirmDeleteId(null);
              }}
              className="w-full p-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <CanvasIcon show={showCanvas} />
              <span>{showCanvas ? 'Hide Canvas' : 'Show Canvas'}</span>
              <span className="ml-auto text-xs text-slate-500">
                {showCanvas ? 'Chat + Cards' : 'Chat Only'}
              </span>
            </button>

            {/* Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900 dark:text-white">Workspaces</span>
              <button
                onClick={() => {
                  onNewWorkspace();
                  setIsOpen(false);
                  setConfirmDeleteId(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white text-xs hover:bg-cyan-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>

            {/* Workspace list */}
            <div className="max-h-80 overflow-y-auto">
              {workspaces.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No workspaces yet
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className={`p-3 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      workspace.id === currentId ? 'bg-cyan-50 dark:bg-cyan-600/10 border-l-2 border-l-cyan-500' : ''
                    }`}
                    onClick={() => {
                      onLoadWorkspace(workspace.id);
                      setIsOpen(false);
                      setConfirmDeleteId(null);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-900 dark:text-white truncate flex-1">{workspace.name}</span>
                      {confirmDeleteId === workspace.id ? (
                        // Confirmation buttons
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmDelete(workspace.id);
                            }}
                            disabled={deletingId === workspace.id}
                            className="px-2 py-1 rounded text-xs bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === workspace.id ? 'Deleting...' : 'Delete'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        // Delete button
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setConfirmDeleteId(workspace.id);
                          }}
                          className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          title="Delete workspace"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{workspace.messageCount} messages</span>
                      <span>·</span>
                      <span>{new Date(workspace.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
