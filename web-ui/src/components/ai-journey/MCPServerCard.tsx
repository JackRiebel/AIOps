'use client';

import { memo, useState } from 'react';
import { Lock, LockOpen, Trash2, Wrench, FolderOpen } from 'lucide-react';
import type { MCPServer } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPServerCardProps {
  server: MCPServer;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusDotColor(status: MCPServer['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500';
    case 'degraded':
      return 'bg-amber-500';
    case 'disconnected':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

// ============================================================================
// MCPServerCard Component
// ============================================================================

export const MCPServerCard = memo(({
  server,
  selected,
  onSelect,
  onRemove,
}: MCPServerCardProps) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onRemove();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset confirm state after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${
        selected
          ? 'border-cyan-400 dark:border-cyan-500/60 bg-cyan-50/50 dark:bg-cyan-900/10 shadow-sm shadow-cyan-500/10'
          : 'border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600/60'
      }`}
    >
      {/* Top row: name + status dot */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(server.status)}`} />
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
            {server.name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* TLS badge */}
          {server.tls_enabled ? (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">TLS</span>
            </span>
          ) : (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400">
              <LockOpen className="w-2.5 h-2.5" />
              <span className="text-[10px] font-medium">No TLS</span>
            </span>
          )}
        </div>
      </div>

      {/* Endpoint URL */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mb-2" title={server.endpoint_url}>
        {truncateUrl(server.endpoint_url)}
      </p>

      {/* Bottom row: meta + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <Wrench className="w-3 h-3" />
            {server.tool_count} tool{server.tool_count !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <FolderOpen className="w-3 h-3" />
            {server.resource_count} resource{server.resource_count !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {timeAgo(server.last_seen)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className={`p-1 rounded transition-colors ${
            confirmDelete
              ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
              : 'text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
          }`}
          title={confirmDelete ? 'Click again to confirm' : 'Remove server'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confirm delete hint */}
      {confirmDelete && (
        <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 text-right">
          Click again to confirm removal
        </p>
      )}
    </button>
  );
});

MCPServerCard.displayName = 'MCPServerCard';

export default MCPServerCard;
