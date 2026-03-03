'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Server } from 'lucide-react';
import type { MCPServer } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPConnectionBannerProps {
  servers: MCPServer[];
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

// ============================================================================
// MCPConnectionBanner Component
// ============================================================================

export const MCPConnectionBanner = memo(({ servers }: MCPConnectionBannerProps) => {
  const status = useMemo(() => {
    const total = servers.length;
    const connected = servers.filter((s) => s.status === 'connected').length;
    const degraded = servers.filter((s) => s.status === 'degraded').length;
    const disconnected = servers.filter((s) => s.status === 'disconnected').length;

    // Find the most recent last_seen across all servers
    const lastSeen = servers.reduce((latest, s) => {
      if (!latest) return s.last_seen;
      return new Date(s.last_seen) > new Date(latest) ? s.last_seen : latest;
    }, '');

    if (disconnected > 0) {
      return {
        level: 'error' as const,
        icon: XCircle,
        message: `${disconnected} of ${total} server${total > 1 ? 's' : ''} disconnected`,
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200/60 dark:border-red-500/30',
        text: 'text-red-700 dark:text-red-400',
        iconColor: 'text-red-500 dark:text-red-400',
        total,
        connected,
        lastSeen,
      };
    }

    if (degraded > 0) {
      return {
        level: 'warning' as const,
        icon: AlertTriangle,
        message: `${degraded} of ${total} server${total > 1 ? 's' : ''} degraded`,
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200/60 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-400',
        iconColor: 'text-amber-500 dark:text-amber-400',
        total,
        connected,
        lastSeen,
      };
    }

    if (connected < total) {
      // Some servers have unknown status (not connected/degraded/disconnected)
      return {
        level: 'warning' as const,
        icon: AlertTriangle,
        message: `${connected} of ${total} server${total > 1 ? 's' : ''} connected`,
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200/60 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-400',
        iconColor: 'text-amber-500 dark:text-amber-400',
        total,
        connected,
        lastSeen,
      };
    }

    return {
      level: 'success' as const,
      icon: CheckCircle2,
      message: `All ${total} MCP server${total > 1 ? 's' : ''} connected`,
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      border: 'border-emerald-200/60 dark:border-emerald-500/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      total,
      connected,
      lastSeen,
    };
  }, [servers]);

  const Icon = status.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.level}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${status.bg} ${status.border}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${status.iconColor}`} />
          <span className={`text-[13px] font-medium ${status.text}`}>
            {status.message}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Server className="w-3 h-3" />
            {status.connected}/{status.total} online
          </span>
          {status.lastSeen && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Last seen {timeAgo(status.lastSeen)}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

MCPConnectionBanner.displayName = 'MCPConnectionBanner';

export default MCPConnectionBanner;
