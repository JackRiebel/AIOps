'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { Monitor, ChevronRight, ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import { EndpointAgentDetailView } from './EndpointAgentDetailView';

// ============================================================================
// Types
// ============================================================================

interface EndpointAgent {
  agentId: string;
  agentName: string;
  computerName?: string;
  osVersion?: string;
  platform?: string;
  publicIP?: string | string[];
  privateIP?: string | string[];
  location?: string | { latitude?: number; longitude?: number; locationName?: string };
  status?: string;
  lastSeen?: string;
  version?: string;
  enabled?: number | boolean;
}

function getLocationString(location?: EndpointAgent['location']): string {
  if (!location) return 'Unknown';
  if (typeof location === 'string') return location;
  return location.locationName || 'Unknown';
}

function getIPString(ip?: string | string[]): string {
  if (!ip) return 'N/A';
  if (Array.isArray(ip)) return ip[0] || 'N/A';
  return ip;
}

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 'N/A';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function isEPAgentOnline(agent: EndpointAgent): boolean {
  if (agent.status) {
    const s = agent.status.toLowerCase();
    return s === 'connected' || s === 'online' || s === 'enabled';
  }
  return agent.enabled === true || agent.enabled === 1;
}

export interface EndpointAgentsPanelProps {
  agents: EndpointAgent[];
  loading: boolean;
  onAskAI?: (context: string) => void;
  onFetchMetrics?: (agentId: string) => void;
  metrics?: Record<string, any[]>;
  loadingMetrics?: Record<string, boolean>;
}

// ============================================================================
// Status Badge
// ============================================================================

function EPStatusBadge({ status, enabled }: { status?: string; enabled?: number | boolean }) {
  const s = (status || '').toLowerCase();
  const isOnline = s === 'connected' || s === 'online' || s === 'enabled' || enabled === true || enabled === 1;
  return isOnline ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Offline
    </span>
  );
}

// ============================================================================
// Platform Badge
// ============================================================================

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null;
  const isWindows = platform.toLowerCase().includes('windows');
  const isMac = platform.toLowerCase().includes('mac') || platform.toLowerCase().includes('darwin');
  const color = isWindows
    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50'
    : isMac
    ? 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600/50'
    : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700/50';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {platform}
    </span>
  );
}

// ============================================================================
// Sort types
// ============================================================================

type SortField = 'name' | 'platform' | 'os' | 'version' | 'status' | 'lastSeen';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'connected' | 'offline';

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 text-cyan-500" />
    : <ArrowDown className="w-3 h-3 ml-1 text-cyan-500" />;
}

// ============================================================================
// EndpointAgentsPanel Component
// ============================================================================

export const EndpointAgentsPanel = memo(({ agents, loading, onAskAI }: EndpointAgentsPanelProps) => {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const connectedCount = useMemo(() => agents.filter(isEPAgentOnline).length, [agents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    let result = agents;

    // Status filter
    if (statusFilter === 'connected') {
      result = result.filter(isEPAgentOnline);
    } else if (statusFilter === 'offline') {
      result = result.filter(a => !isEPAgentOnline(a));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a =>
        (a.agentName || '').toLowerCase().includes(q) ||
        (a.computerName || '').toLowerCase().includes(q) ||
        getIPString(a.publicIP).toLowerCase().includes(q) ||
        getIPString(a.privateIP).toLowerCase().includes(q) ||
        getLocationString(a.location).toLowerCase().includes(q)
      );
    }

    return result;
  }, [agents, statusFilter, searchQuery]);

  // Sort agents
  const sortedAgents = useMemo(() => {
    if (!sortField) return filteredAgents;
    const sorted = [...filteredAgents].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.agentName || a.computerName || '').localeCompare(b.agentName || b.computerName || '');
          break;
        case 'platform':
          cmp = (a.platform || '').localeCompare(b.platform || '');
          break;
        case 'os':
          cmp = (a.osVersion || '').localeCompare(b.osVersion || '');
          break;
        case 'version':
          cmp = (a.version || '').localeCompare(b.version || '');
          break;
        case 'status': {
          const aOnline = isEPAgentOnline(a) ? 1 : 0;
          const bOnline = isEPAgentOnline(b) ? 1 : 0;
          cmp = aOnline - bOnline;
          break;
        }
        case 'lastSeen': {
          const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredAgents, sortField, sortDir]);

  const totalPages = Math.ceil(sortedAgents.length / pageSize);
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAgents.slice(start, start + pageSize);
  }, [sortedAgents, currentPage, pageSize]);

  const handleToggle = useCallback((agentId: string) => {
    setExpandedAgentId(prev => prev === agentId ? null : agentId);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedAgentId(null);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedAgentId(null);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  // Reset page when filters change
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((val: StatusFilter) => {
    setStatusFilter(val);
    setCurrentPage(1);
  }, []);

  if (agents.length === 0 && !loading) {
    return (
      <DashboardCard title="Endpoint Agents" icon={<Monitor className="w-4 h-4" />} accent="blue" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
            <Monitor className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No endpoint agents found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Deploy endpoint agents to monitor end-user experience</p>
        </div>
      </DashboardCard>
    );
  }

  const statusFilterBtnClass = (filter: StatusFilter) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      statusFilter === filter
        ? 'bg-cyan-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50'
    }`;

  return (
    <DashboardCard title="Endpoint Agents" icon={<Monitor className="w-4 h-4" />} accent="blue" compact>
      {/* Summary + Filters */}
      <div className="pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
        {/* Summary stats */}
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-green-600 dark:text-green-400">{connectedCount}</span> connected
            {' / '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{agents.length}</span> total
          </p>
          {filteredAgents.length !== agents.length && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ({filteredAgents.length} shown)
            </p>
          )}
        </div>

        {/* Search + Status filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, IP, location..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleStatusFilterChange('all')} className={statusFilterBtnClass('all')}>All</button>
            <button onClick={() => handleStatusFilterChange('connected')} className={statusFilterBtnClass('connected')}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />Connected
            </button>
            <button onClick={() => handleStatusFilterChange('offline')} className={statusFilterBtnClass('offline')}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />Offline
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('name')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  Agent <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('platform')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  Platform <SortIcon field="platform" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">IP Address</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('os')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  OS <SortIcon field="os" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('version')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  Agent Ver <SortIcon field="version" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('status')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('lastSeen')} className="flex items-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                  Last Seen <SortIcon field="lastSeen" sortField={sortField} sortDir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedAgents.map((agent) => (
              <Fragment key={agent.agentId}>
                <tr
                  onClick={() => handleToggle(agent.agentId)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer select-none"
                >
                  <td className="px-4 py-3">
                    <span className="p-1 text-slate-400 transition">
                      {expandedAgentId === agent.agentId
                        ? <ChevronDown className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        : <ChevronRight className="w-4 h-4" />
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{agent.agentName || agent.computerName}</div>
                    {agent.computerName && agent.agentName && agent.computerName !== agent.agentName && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{agent.computerName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={agent.platform} /></td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900 dark:text-white">{getIPString(agent.publicIP)}</div>
                    {getIPString(agent.privateIP) !== 'N/A' && getIPString(agent.privateIP) !== getIPString(agent.publicIP) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{getIPString(agent.privateIP)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{getLocationString(agent.location)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-700 dark:text-slate-300">{agent.osVersion || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-mono">{agent.version || '—'}</span>
                  </td>
                  <td className="px-4 py-3"><EPStatusBadge status={agent.status} enabled={agent.enabled} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{getRelativeTime(agent.lastSeen)}</td>
                </tr>

                {expandedAgentId === agent.agentId && (
                  <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                    <td colSpan={9} className="px-4 py-4">
                      <EndpointAgentDetailView agent={agent} onAskAI={onAskAI} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {sortedAgents.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No agents match your search</p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={agents.length}
        filteredItems={sortedAgents.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

EndpointAgentsPanel.displayName = 'EndpointAgentsPanel';

export default EndpointAgentsPanel;
