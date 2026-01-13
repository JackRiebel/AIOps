'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Copy, Trash2, Clock } from 'lucide-react';
import type { SessionListItem, SessionMetrics } from '@/types/session';

/**
 * SessionSelector - Dropdown for selecting and managing sessions
 *
 * Following "Show, Don't Tell" philosophy:
 * - Quiet metrics display
 * - No instructional text
 * - Simple, clean interface
 */

// ============================================================================
// Types
// ============================================================================

export interface SessionSelectorProps {
  /** Current session name */
  currentSessionName: string;
  /** Current session ID */
  currentSessionId?: string;
  /** List of available sessions */
  sessions: SessionListItem[];
  /** Handler for creating new session */
  onNewSession: () => void;
  /** Handler for loading a session */
  onLoadSession: (sessionId: string) => void;
  /** Handler for duplicating a session */
  onDuplicateSession?: (sessionId: string) => void;
  /** Handler for deleting a session */
  onDeleteSession?: (sessionId: string) => void;
  /** Max sessions to show in dropdown */
  maxVisible?: number;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMetrics(metrics: SessionMetrics): string {
  const parts: string[] = [];

  if (metrics.messageCount > 0) {
    parts.push(`${metrics.messageCount} msg`);
  }
  if (metrics.cardCount > 0) {
    parts.push(`${metrics.cardCount} card`);
  }
  if (metrics.totalCostUsd > 0) {
    parts.push(`$${metrics.totalCostUsd.toFixed(3)}`);
  }

  return parts.join(' · ') || 'Empty';
}

// ============================================================================
// Session Item Component
// ============================================================================

interface SessionItemProps {
  session: SessionListItem;
  isActive: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const SessionItem = memo(({
  session,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
}: SessionItemProps) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`
        group relative px-3 py-2 cursor-pointer
        ${isActive
          ? 'bg-cyan-50 dark:bg-cyan-900/20'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Session name */}
          <div className={`text-sm font-medium truncate ${
            isActive
              ? 'text-cyan-700 dark:text-cyan-300'
              : 'text-slate-700 dark:text-slate-200'
          }`}>
            {session.name}
          </div>

          {/* Quiet metrics */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatRelativeTime(session.updatedAt)}
            </span>
            <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {formatMetrics(session.metrics)}
            </span>
          </div>
        </div>

        {/* Action buttons - show on hover */}
        {(showActions || isActive) && (onDuplicate || onDelete) && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onDuplicate && (
              <button
                onClick={onDuplicate}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Duplicate session"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && !isActive && (
              <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
                title="Delete session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-500 rounded-r" />
      )}
    </div>
  );
});

SessionItem.displayName = 'SessionItem';

// ============================================================================
// Main SessionSelector Component
// ============================================================================

export const SessionSelector = memo(({
  currentSessionName,
  currentSessionId,
  sessions,
  onNewSession,
  onLoadSession,
  onDuplicateSession,
  onDeleteSession,
  maxVisible = 10,
  className = '',
}: SessionSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewSession = useCallback(() => {
    onNewSession();
    setIsOpen(false);
  }, [onNewSession]);

  const handleSelectSession = useCallback((sessionId: string) => {
    onLoadSession(sessionId);
    setIsOpen(false);
  }, [onLoadSession]);

  const handleDuplicate = useCallback((sessionId: string) => {
    onDuplicateSession?.(sessionId);
    setIsOpen(false);
  }, [onDuplicateSession]);

  const handleDelete = useCallback((sessionId: string) => {
    onDeleteSession?.(sessionId);
  }, [onDeleteSession]);

  // Get visible sessions (most recent first)
  const visibleSessions = sessions.slice(0, maxVisible);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-slate-100 dark:bg-slate-700/50
          hover:bg-slate-200 dark:hover:bg-slate-700
          transition-colors
          ${isOpen ? 'ring-2 ring-cyan-500/50' : ''}
        `}
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
          {currentSessionName}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          {/* New Session Button */}
          <button
            onClick={handleNewSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700"
          >
            <div className="p-1 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
              <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              New Session
            </span>
          </button>

          {/* Sessions List */}
          {visibleSessions.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              <div className="px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/50">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                  Recent
                </span>
              </div>
              {visibleSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  onSelect={() => handleSelectSession(session.id)}
                  onDuplicate={onDuplicateSession ? () => handleDuplicate(session.id) : undefined}
                  onDelete={onDeleteSession ? () => handleDelete(session.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
              No sessions yet
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SessionSelector.displayName = 'SessionSelector';

export default SessionSelector;
