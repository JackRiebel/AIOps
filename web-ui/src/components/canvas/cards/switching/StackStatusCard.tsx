'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface StackMember {
  serial: string;
  name: string;
  model?: string;
  role: 'master' | 'member' | 'standby' | 'linecard';
  priority?: number;
  macAddress?: string;
  status: 'online' | 'offline' | 'provisioned' | 'mismatch';
  uptime?: string;
  ports?: number;
  stackPort1?: 'up' | 'down' | 'not-present';
  stackPort2?: 'up' | 'down' | 'not-present';
}

interface StackStatusCardData {
  stacks?: Array<{
    stackId: string;
    name: string;
    members: StackMember[];
  }>;
  members?: StackMember[];
  stackId?: string;
  stackName?: string;
  networkId?: string;
}

interface StackStatusCardProps {
  data: StackStatusCardData;
  config?: {
    showStackPorts?: boolean;
  };
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  master: { label: 'Master', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40', icon: '👑' },
  standby: { label: 'Standby', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40', icon: '🔄' },
  member: { label: 'Member', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700', icon: '📦' },
  linecard: { label: 'Linecard', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/40', icon: '🔌' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  online: { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  offline: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
  provisioned: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  mismatch: { color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/40' },
};

/**
 * StackStatusCard - Switch stack health overview
 *
 * Shows:
 * - Stack ring visualization
 * - Master/standby identification
 * - Stack port status
 * - Member health indicators
 */
export const StackStatusCard = memo(({ data, config }: StackStatusCardProps) => {
  const showStackPorts = config?.showStackPorts ?? true;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if (!data && demoMode) {
      const mockMembers: StackMember[] = [
        { serial: 'Q2XX-STACK-001', name: 'Core-Switch-1', model: 'MS350-48', role: 'master', priority: 15, status: 'online', uptime: '45d 12h', ports: 48, stackPort1: 'up', stackPort2: 'up' },
        { serial: 'Q2XX-STACK-002', name: 'Core-Switch-2', model: 'MS350-48', role: 'standby', priority: 14, status: 'online', uptime: '45d 12h', ports: 48, stackPort1: 'up', stackPort2: 'up' },
        { serial: 'Q2XX-STACK-003', name: 'Core-Switch-3', model: 'MS350-24', role: 'member', priority: 1, status: 'online', uptime: '45d 12h', ports: 24, stackPort1: 'up', stackPort2: 'up' },
        { serial: 'Q2XX-STACK-004', name: 'Core-Switch-4', model: 'MS350-24', role: 'member', priority: 1, status: 'online', uptime: '38d 8h', ports: 24, stackPort1: 'up', stackPort2: 'up' },
      ];
      return [{
        stackId: 'stack-demo',
        name: 'Core Stack',
        members: mockMembers,
      }];
    }

    if (!data) return null;

    // Handle single stack with members
    if (data.members && data.members.length > 0) {
      return [{
        stackId: data.stackId || 'stack-1',
        name: data.stackName || 'Switch Stack',
        members: data.members,
      }];
    }

    // Handle multiple stacks
    if (data.stacks && data.stacks.length > 0) {
      return data.stacks;
    }

    return null;
  }, [data]);

  if (!processedData || processedData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No stack data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Stack Status
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {processedData.length} stack{processedData.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Stack list */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-4">
          {processedData.map((stack, stackIndex) => {
            const members = Array.isArray(stack.members) ? stack.members : [];
            const onlineCount = members.filter(m => m?.status === 'online').length;
            const master = members.find(m => m?.role === 'master');
            const standby = members.find(m => m?.role === 'standby');
            const allHealthy = onlineCount === members.length;

            return (
              <div key={stack.stackId ?? `stack-${stackIndex}`} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                {/* Stack header */}
                <div className={`px-3 py-2 flex items-center justify-between ${allHealthy ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-amber-50/50 dark:bg-amber-900/10'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🗄️</span>
                    <div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {stack.name}
                      </div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">
                        {onlineCount}/{members.length} members online
                      </div>
                    </div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${allHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>

                {/* Stack ring visualization */}
                <div className="px-3 py-3 flex justify-center">
                  <div className="relative w-32 h-32">
                    {/* Ring background */}
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray="4 2"
                        className="text-slate-200 dark:text-slate-700"
                      />
                    </svg>

                    {/* Member nodes positioned around the ring */}
                    {members.map((member, idx) => {
                      const angle = (idx * (360 / members.length) - 90) * (Math.PI / 180);
                      const x = 50 + 40 * Math.cos(angle);
                      const y = 50 + 40 * Math.sin(angle);
                      const statusConfig = STATUS_CONFIG[member.status] || STATUS_CONFIG.offline;
                      const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;

                      return (
                        <div
                          key={member.serial ?? `member-${idx}`}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${statusConfig.bg} border-2 ${member.status === 'online' ? 'border-emerald-500' : 'border-red-500'}`}
                            title={`${member.name} - ${member.role} (${member.status})`}
                          >
                            <span className="text-xs">{roleConfig.icon}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                        {members.length}
                      </div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">units</div>
                    </div>
                  </div>
                </div>

                {/* Member details */}
                <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((member, memberIndex) => {
                    const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
                    const statusConfig = STATUS_CONFIG[member.status] || STATUS_CONFIG.offline;

                    return (
                      <div key={member.serial ?? `detail-${memberIndex}`} className="px-3 py-2 flex items-center gap-2">
                        <span className="text-sm">{roleConfig.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                              {member.name}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${roleConfig.bg} ${roleConfig.color}`}>
                              {roleConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                            {member.model && <span>{member.model}</span>}
                            {member.priority !== undefined && <span>Pri: {member.priority}</span>}
                          </div>
                        </div>

                        {/* Stack port status */}
                        {showStackPorts && (member.stackPort1 || member.stackPort2) && (
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-2 h-4 rounded-sm ${member.stackPort1 === 'up' ? 'bg-emerald-500' : member.stackPort1 === 'down' ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                              title={`Stack Port 1: ${member.stackPort1 || 'N/A'}`}
                            />
                            <div
                              className={`w-2 h-4 rounded-sm ${member.stackPort2 === 'up' ? 'bg-emerald-500' : member.stackPort2 === 'down' ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                              title={`Stack Port 2: ${member.stackPort2 || 'N/A'}`}
                            />
                          </div>
                        )}

                        {/* Status indicator */}
                        <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${statusConfig.bg} ${statusConfig.color}`}>
                          {member.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

StackStatusCard.displayName = 'StackStatusCard';

export default StackStatusCard;
