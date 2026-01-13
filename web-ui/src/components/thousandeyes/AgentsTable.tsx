'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Server } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { Agent } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AgentsTableProps {
  agents: Agent[];
  loading: boolean;
}

// ============================================================================
// Type Badge Component
// ============================================================================

function TypeBadge({ type }: { type: string }) {
  const isEnterprise = type?.toLowerCase().includes('enterprise');
  const isEndpoint = type?.toLowerCase().includes('endpoint');
  const isCloud = type?.toLowerCase().includes('cloud');

  let bgColor = 'bg-slate-100 dark:bg-slate-500/20';
  let textColor = 'text-slate-600 dark:text-slate-400';
  let borderColor = 'border-slate-200 dark:border-slate-600/50';

  if (isEnterprise) {
    bgColor = 'bg-purple-100 dark:bg-purple-500/20';
    textColor = 'text-purple-700 dark:text-purple-400';
    borderColor = 'border-purple-200 dark:border-purple-700/50';
  } else if (isEndpoint) {
    bgColor = 'bg-blue-100 dark:bg-blue-500/20';
    textColor = 'text-blue-700 dark:text-blue-400';
    borderColor = 'border-blue-200 dark:border-blue-700/50';
  } else if (isCloud) {
    bgColor = 'bg-cyan-100 dark:bg-cyan-500/20';
    textColor = 'text-cyan-700 dark:text-cyan-400';
    borderColor = 'border-cyan-200 dark:border-cyan-700/50';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${bgColor} ${textColor} ${borderColor}`}>
      {type}
    </span>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ enabled }: { enabled: number }) {
  return enabled === 1 ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Disabled
    </span>
  );
}

// ============================================================================
// AgentsTable Component
// ============================================================================

export const AgentsTable = memo(({
  agents,
  loading,
}: AgentsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Pagination logic
  const totalPages = Math.ceil(agents.length / pageSize);
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return agents.slice(start, start + pageSize);
  }, [agents, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Agent counts
  const enabledCount = agents.filter(a => a.enabled === 1).length;
  const disabledCount = agents.filter(a => a.enabled === 0).length;

  // Empty state
  if (agents.length === 0 && !loading) {
    return (
      <DashboardCard title="Agents" icon={<Server className="w-4 h-4" />} accent="green" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <Server className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No agents found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Deploy agents to start monitoring</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Agents" icon={<Server className="w-4 h-4" />} accent="green" compact>
      {/* Summary */}
      <div className="flex items-center gap-4 pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {agents.length} agent{agents.length !== 1 ? 's' : ''} total
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">{enabledCount} enabled</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">{disabledCount} disabled</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Agent Name
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Network
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedAgents.map((agent) => (
              <tr key={agent.agentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{agent.agentName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">ID: {agent.agentId}</div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={agent.agentType} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {agent.location || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {agent.network || 'Unknown'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge enabled={agent.enabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={agents.length}
        filteredItems={agents.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

AgentsTable.displayName = 'AgentsTable';

export default AgentsTable;
