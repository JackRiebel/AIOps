'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Server,
  Plus,
  Search,
  Wrench,
  Shield,
  Activity,
  RefreshCw,
  Loader2,
  FolderOpen,
  Lock,
  LockOpen,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ListFilter,
  BarChart3,
} from 'lucide-react';
import { useMCPMonitor } from './hooks/useMCPMonitor';
import { MCPConnectionBanner } from './MCPConnectionBanner';
import { MCPToolGrid } from './MCPToolGrid';
import { MCPSecurityPosture } from './MCPSecurityPosture';
import { MCPToolHealthTimeline } from './MCPToolHealthTimeline';
import { MCPEventLog } from './MCPEventLog';
import { MCPServerSetup } from './MCPServerSetup';
import { MCPNetworkHealth } from './MCPNetworkHealth';
import type { MCPServer } from '@/types/mcp-monitor';
import type { MCPToolHealth } from '@/types/mcp-monitor';

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
    case 'connected': return 'bg-emerald-500';
    case 'degraded': return 'bg-amber-500';
    case 'disconnected': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

function statusLabel(status: MCPServer['status']): string {
  switch (status) {
    case 'connected': return 'Connected';
    case 'degraded': return 'Degraded';
    case 'disconnected': return 'Disconnected';
    default: return 'Unknown';
  }
}

// ============================================================================
// Stats Card
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      {subValue && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// ============================================================================
// Server List Item (compact sidebar card)
// ============================================================================

const ServerListItem = memo(({
  server,
  selected,
  onSelect,
}: {
  server: MCPServer;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`w-full text-left rounded-lg border p-2.5 transition-all duration-150 ${
      selected
        ? 'border-cyan-400 dark:border-cyan-500/60 bg-cyan-50/50 dark:bg-cyan-900/10 shadow-sm shadow-cyan-500/10'
        : 'border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600/60'
    }`}
  >
    <div className="flex items-center gap-2 min-w-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(server.status)}`} />
      <span className="text-[12px] font-semibold text-slate-900 dark:text-white truncate flex-1">
        {server.name}
      </span>
      {server.tls_enabled ? (
        <Lock className="w-3 h-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
      ) : (
        <LockOpen className="w-3 h-3 text-red-400 flex-shrink-0" />
      )}
    </div>
    <div className="flex items-center gap-2.5 mt-1.5">
      <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        <Wrench className="w-2.5 h-2.5" />
        {server.tool_count}
      </span>
      <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        <FolderOpen className="w-2.5 h-2.5" />
        {server.resource_count}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
        {timeAgo(server.last_seen)}
      </span>
    </div>
  </button>
));
ServerListItem.displayName = 'ServerListItem';

// ============================================================================
// Server Detail Panel (right side when a server is selected)
// ============================================================================

const ServerDetailPanel = memo(({
  server,
  onRemove,
  onReauthorize,
  onReconnect,
}: {
  server: MCPServer;
  onRemove: () => void;
  onReauthorize?: () => void;
  onReconnect?: () => void;
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      onRemove();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, onRemove]);

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(server.status)}`} />
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
            {server.name}
          </h3>
          <span className={`text-[9px] font-medium px-1 py-0.5 rounded flex-shrink-0 ${
            server.status === 'connected'
              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : server.status === 'degraded'
              ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
          }`}>
            {statusLabel(server.status)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
            confirmDelete
              ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
              : 'text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
          }`}
          title={confirmDelete ? 'Click again to confirm' : 'Remove server'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {confirmDelete && (
        <p className="text-[10px] text-red-500 dark:text-red-400 mb-2 text-right">Click again to confirm removal</p>
      )}

      {/* Endpoint (full width) */}
      <div className="mb-2">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Endpoint</span>
        <p className="text-[10px] text-slate-700 dark:text-slate-300 font-mono mt-0.5 break-all leading-relaxed">{server.endpoint_url}</p>
      </div>

      {/* Compact info row */}
      <div className="flex items-center gap-3 text-[10px] mb-2">
        <span className="text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wider font-medium">Auth</span>{' '}
          <span className="text-slate-700 dark:text-slate-300 capitalize">{server.auth_type || 'None'}</span>
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="text-slate-500 dark:text-slate-400">
          <span className="uppercase tracking-wider font-medium">TLS</span>{' '}
          {server.tls_enabled ? (
            <span className="text-emerald-600 dark:text-emerald-400">{server.tls_version || 'On'}</span>
          ) : (
            <span className="text-red-500 dark:text-red-400">Off</span>
          )}
        </span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span className="text-slate-400 dark:text-slate-500">{timeAgo(server.last_seen)}</span>
      </div>

      {server.description && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{server.description}</p>
      )}

      {/* Quick stats row */}
      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Wrench className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{server.tool_count}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">tools</span>
        </div>
        <div className="flex items-center gap-1">
          <FolderOpen className="w-3 h-3 text-violet-500 dark:text-violet-400" />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{server.resource_count}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">resources</span>
        </div>
      </div>

      {/* Action buttons for disconnected servers */}
      {server.status !== 'connected' && (
        <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex gap-2">
          {server.auth_type === 'oauth' && onReauthorize && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                setActionLoading(true);
                try { await onReauthorize(); } finally { setActionLoading(false); }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition text-[10px] font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Authorizing...' : 'Authorize'}
            </button>
          )}
          {server.auth_type !== 'oauth' && onReconnect && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                setActionLoading(true);
                try { await onReconnect(); } finally { setActionLoading(false); }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition text-[10px] font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Reconnecting...' : 'Reconnect'}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
ServerDetailPanel.displayName = 'ServerDetailPanel';

// ============================================================================
// MCPSection Component (Full Tab-Level View)
// ============================================================================

export const MCPSection = memo(() => {
  const {
    servers,
    selectedServer,
    setSelectedServer,
    tools,
    events,
    securityPosture,
    networkHealth,
    loading,
    detailsLoading,
    registerServer,
    removeServer,
    refreshServers,
    startOAuth,
  } = useMCPMonitor();

  // Server setup modal state
  const [setupOpen, setSetupOpen] = useState(false);

  // Wrap registerServer to close modal BEFORE the refresh that follows registration.
  const handleRegister = useCallback(
    async (config: Parameters<typeof registerServer>[0]) => {
      setSetupOpen(false);
      await registerServer(config);
    },
    [registerServer],
  );

  // Search filter for server list
  const [serverSearch, setServerSearch] = useState('');
  // Search filter for tools
  const [toolSearch, setToolSearch] = useState('');

  const handleOpenSetup = useCallback(() => setSetupOpen(true), []);
  const handleCloseSetup = useCallback(() => setSetupOpen(false), []);

  // Build synthetic tool health timeline
  const [toolHealthData] = useState<MCPToolHealth[]>(() => {
    const now = Date.now();
    const points: MCPToolHealth[] = [];
    for (let i = 11; i >= 0; i--) {
      const ts = new Date(now - i * 5 * 60_000).toISOString();
      points.push({ timestamp: ts, available_tools: 0, total_tools: 0, availability_pct: 100 });
    }
    return points;
  });

  // Filtered servers
  const filteredServers = useMemo(() => {
    if (!serverSearch.trim()) return servers;
    const q = serverSearch.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.endpoint_url.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    );
  }, [servers, serverSearch]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    if (!toolSearch.trim()) return tools;
    const q = toolSearch.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [tools, toolSearch]);

  // Aggregate stats
  const stats = useMemo(() => {
    const connected = servers.filter((s) => s.status === 'connected').length;
    const degraded = servers.filter((s) => s.status === 'degraded').length;
    const disconnected = servers.filter((s) => s.status === 'disconnected').length;
    const totalTools = servers.reduce((sum, s) => sum + s.tool_count, 0);
    const totalResources = servers.reduce((sum, s) => sum + s.resource_count, 0);
    return { connected, degraded, disconnected, totalTools, totalResources };
  }, [servers]);

  // Loading state
  if (loading && servers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Loading MCP servers...</span>
      </div>
    );
  }

  // Empty state — full tab empty state with registration CTA
  if (servers.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200/60 dark:border-cyan-700/40 flex items-center justify-center mb-5">
              <Server className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No MCP Servers Registered
            </h3>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              Register your MCP servers to monitor tool availability, discover capabilities,
              track health metrics, and analyze security posture across your AI tool infrastructure.
            </p>
            <button
              type="button"
              onClick={handleOpenSetup}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition text-[13px] font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Register MCP Server
            </button>
          </div>
        </div>
        <MCPServerSetup open={setupOpen} onClose={handleCloseSetup} onRegister={handleRegister} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Connection Banner */}
        <MCPConnectionBanner servers={servers} />

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={Server}
            label="Total Servers"
            value={servers.length}
            subValue={`${stats.connected} connected, ${stats.degraded + stats.disconnected} issues`}
            iconColor="text-cyan-500 dark:text-cyan-400"
          />
          <StatCard
            icon={Wrench}
            label="Total Tools"
            value={stats.totalTools}
            subValue={`${stats.totalResources} resources`}
            iconColor="text-violet-500 dark:text-violet-400"
          />
          <StatCard
            icon={Shield}
            label="Security Score"
            value={securityPosture ? `${Math.round(securityPosture.overall_score)}` : '—'}
            subValue={securityPosture ? `${securityPosture.sensitive_tools_exposed} sensitive exposed` : 'No data'}
            iconColor="text-emerald-500 dark:text-emerald-400"
          />
          <StatCard
            icon={Activity}
            label="Availability"
            value={servers.length > 0 ? `${Math.round((stats.connected / servers.length) * 100)}%` : '—'}
            subValue={`${stats.disconnected} disconnected`}
            iconColor="text-blue-500 dark:text-blue-400"
          />
        </div>

        {/* Main Content: Server List + Detail */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column: Server List */}
          <div className="col-span-12 lg:col-span-3 space-y-3">
            {/* Server list header */}
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Servers ({filteredServers.length})
              </h4>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => refreshServers()}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenSetup}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 rounded-md transition font-medium"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                placeholder="Filter servers..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/40 rounded-lg text-[12px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>

            {/* Server List */}
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredServers.map((server) => (
                <ServerListItem
                  key={server.id}
                  server={server}
                  selected={selectedServer?.id === server.id}
                  onSelect={() => setSelectedServer(server)}
                />
              ))}
              {filteredServers.length === 0 && serverSearch && (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
                  No servers match &ldquo;{serverSearch}&rdquo;
                </p>
              )}
            </div>

            {/* Status summary */}
            <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-900/30 p-2.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400">{stats.connected} online</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400">{stats.degraded} degraded</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-slate-500 dark:text-slate-400">{stats.disconnected} offline</span>
                </span>
              </div>
            </div>
          </div>

          {/* Detail Column: Server Info + Security + Tools */}
          <div className="col-span-12 lg:col-span-3 space-y-3">
            {/* Selected server detail */}
            {selectedServer ? (
              <ServerDetailPanel
                server={selectedServer}
                onRemove={() => removeServer(selectedServer.id)}
                onReauthorize={selectedServer.auth_type === 'oauth' ? async () => {
                  await startOAuth(selectedServer.id);
                } : undefined}
                onReconnect={async () => {
                  // Force re-discover by calling the discover endpoint
                  try {
                    await fetch(`/api/mcp-monitor/servers/${selectedServer.id}/discover`, {
                      credentials: 'include',
                    });
                    await refreshServers();
                  } catch { /* ignore */ }
                }}
              />
            ) : (
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4 flex flex-col items-center justify-center py-8">
                <Server className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-[12px] text-slate-500 dark:text-slate-400">Select a server</p>
              </div>
            )}

            <MCPSecurityPosture posture={securityPosture} />

            {/* Tool Grid with search */}
            <div>
              {detailsLoading ? (
                <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-3 space-y-2">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {tools.length > 0 && (
                    <div className="mb-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          value={toolSearch}
                          onChange={(e) => setToolSearch(e.target.value)}
                          placeholder="Search tools..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/40 rounded-lg text-[12px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                  <MCPToolGrid tools={filteredTools} />
                </>
              )}
            </div>

            <MCPToolHealthTimeline data={toolHealthData} />

            {/* Server Comparison Mini-Table */}
            {servers.length > 1 && (
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200/60 dark:border-slate-700/40">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Server Comparison
                    </h4>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200/60 dark:border-slate-700/40">
                        <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Server</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tools</th>
                        <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TLS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                      {servers.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedServer(s)}
                          className={`cursor-pointer transition-colors ${
                            selectedServer?.id === s.id
                              ? 'bg-cyan-50/50 dark:bg-cyan-900/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                            {s.name}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${statusDotColor(s.status)}`} />
                          </td>
                          <td className="px-2 py-1.5 text-center text-[11px] text-slate-600 dark:text-slate-400">{s.tool_count}</td>
                          <td className="px-2 py-1.5 text-center">
                            {s.tls_enabled ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Wide Column: Network Path Health */}
          <div className="col-span-12 lg:col-span-6">
            {selectedServer ? (
              <MCPNetworkHealth key={selectedServer.id} data={networkHealth} loading={detailsLoading} serverName={selectedServer.name} />
            ) : (
              <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-6 flex flex-col items-center justify-center py-16">
                <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-[13px] text-slate-500 dark:text-slate-400">Select a server to view network path health</p>
              </div>
            )}
          </div>
        </div>

        {/* Event Log (full width) */}
        {detailsLoading ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-3 space-y-2">
            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <MCPEventLog events={events} />
        )}
      </div>

      {/* Server setup modal */}
      <MCPServerSetup
        open={setupOpen}
        onClose={handleCloseSetup}
        onRegister={handleRegister}
      />
    </>
  );
});

MCPSection.displayName = 'MCPSection';

export default MCPSection;
