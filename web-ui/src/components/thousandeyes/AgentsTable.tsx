'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Server, Sparkles, List, LayoutGrid } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import { isAgentOnline } from './types';
import type { Agent } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AgentsTableProps {
  agents: Agent[];
  loading: boolean;
  onAskAI?: (context: string) => void;
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

function StatusBadge({ agent }: { agent: Agent }) {
  const online = isAgentOnline(agent);
  const label = agent.agentState === 'online' ? 'Online' : agent.agentState === 'offline' ? 'Offline' : agent.agentState === 'disabled' ? 'Disabled' : online ? 'Enabled' : 'Disabled';
  return online ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      {label}
    </span>
  );
}

// ============================================================================
// Agent Table Row
// ============================================================================

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
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
        <StatusBadge agent={agent} />
      </td>
    </tr>
  );
}

// ============================================================================
// AgentsTable Component
// ============================================================================

export const AgentsTable = memo(({
  agents,
  loading,
  onAskAI,
}: AgentsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [groupByType, setGroupByType] = useState(false);

  // Pagination logic (flat mode)
  const totalPages = Math.ceil(agents.length / pageSize);
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return agents.slice(start, start + pageSize);
  }, [agents, currentPage, pageSize]);

  // Grouped agents
  const groupedAgents = useMemo(() => {
    if (!groupByType) return null;
    const groups: Record<string, Agent[]> = {};
    agents.forEach(agent => {
      const type = agent.agentType || 'Unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(agent);
    });
    return groups;
  }, [agents, groupByType]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Agent counts
  const enabledCount = agents.filter(a => isAgentOnline(a)).length;
  const disabledCount = agents.length - enabledCount;

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

  const tableHeader = (
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
  );

  return (
    <DashboardCard title="Agents" icon={<Server className="w-4 h-4" />} accent="green" compact>
      {/* Summary */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-4">
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
        <div className="flex items-center gap-2">
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Analyze ThousandEyes agents:\n- Total agents: ${agents.length}\n- Enabled: ${enabledCount}\n- Disabled: ${disabledCount}\n- Agent types: ${[...new Set(agents.map(a => a.agentType))].join(', ')}\n\nProvide health assessment and recommendations.`)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium"
            >
              <Sparkles className="w-3 h-3" />
              Ask AI
            </button>
          )}
          <div className="flex border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setGroupByType(false)}
              className={`p-1.5 transition ${!groupByType ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
              title="Flat list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGroupByType(true)}
              className={`p-1.5 transition ${groupByType ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
              title="Group by type"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {groupByType && groupedAgents ? (
        <div className="space-y-4">
          {Object.entries(groupedAgents).map(([type, typeAgents]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <TypeBadge type={type} />
                <span className="text-xs text-slate-500 dark:text-slate-400">({typeAgents.length})</span>
              </div>
              <div className="overflow-x-auto -mx-4">
                <table className="w-full min-w-[600px]">
                  {tableHeader}
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                    {typeAgents.map((agent) => (
                      <AgentRow key={agent.agentId} agent={agent} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4">
            <table className="w-full min-w-[600px]">
              {tableHeader}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {paginatedAgents.map((agent) => (
                  <AgentRow key={agent.agentId} agent={agent} />
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
        </>
      )}
    </DashboardCard>
  );
});

AgentsTable.displayName = 'AgentsTable';

export default AgentsTable;
