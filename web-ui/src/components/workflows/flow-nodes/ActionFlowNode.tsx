'use client';

import { memo } from 'react';
import {
  Wrench, RefreshCw, XCircle, CheckCircle, Settings, Lightbulb, Activity,
  Shield, Plus, Edit2, Wifi, AlertCircle, Edit, CheckCircle2, Lock, Ban, UserX,
  AlertTriangle,
} from 'lucide-react';
import { getRiskLevelColor } from '../utils/actionDescriptions';
import type { RiskLevel } from '../types';

// Icon mapping from string to component
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'RefreshCw': RefreshCw,
  'XCircle': XCircle,
  'CheckCircle': CheckCircle,
  'Settings': Settings,
  'Lightbulb': Lightbulb,
  'Activity': Activity,
  'Shield': Shield,
  'Plus': Plus,
  'Edit2': Edit2,
  'Wifi': Wifi,
  'AlertCircle': AlertCircle,
  'Edit': Edit,
  'CheckCircle2': CheckCircle2,
  'Lock': Lock,
  'Ban': Ban,
  'UserX': UserX,
  'Wrench': Wrench,
  'Trash2': XCircle, // Fallback
};

interface ActionFlowNodeProps {
  data: {
    tool: string;
    label: string;
    description: string;
    icon: string;
    category: string;
    riskLevel: RiskLevel;
    requiresApproval: boolean;
    params?: Record<string, unknown>;
    reason?: string;
  };
}

/**
 * ActionFlowNode - Shows workflow action with tool details
 * Cyan accent (or red if requires approval), displays tool description
 */
export const ActionFlowNode = memo(({ data }: ActionFlowNodeProps) => {
  const {
    label,
    description,
    icon,
    riskLevel,
    requiresApproval,
    reason,
  } = data;

  const IconComponent = ICON_MAP[icon] || Wrench;
  const riskColors = getRiskLevelColor(riskLevel);

  // Use red theme if requires approval
  const baseColors = requiresApproval
    ? {
        bg: 'bg-red-50 dark:bg-red-900/30',
        border: 'border-red-400 dark:border-red-600',
        headerBg: 'bg-red-100 dark:bg-red-800/50',
        headerText: 'text-red-600 dark:text-red-400',
        titleText: 'text-red-700 dark:text-red-300',
        bodyText: 'text-red-800 dark:text-red-200',
        mutedText: 'text-red-600 dark:text-red-400',
      }
    : {
        bg: 'bg-cyan-50 dark:bg-cyan-900/30',
        border: 'border-cyan-400 dark:border-cyan-600',
        headerBg: 'bg-cyan-100 dark:bg-cyan-800/50',
        headerText: 'text-cyan-600 dark:text-cyan-400',
        titleText: 'text-cyan-700 dark:text-cyan-300',
        bodyText: 'text-cyan-800 dark:text-cyan-200',
        mutedText: 'text-cyan-600 dark:text-cyan-400',
      };

  return (
    <div className={`
      w-[160px] p-3 rounded-lg
      ${baseColors.bg}
      border-2 ${baseColors.border}
      shadow-sm hover:shadow-md transition-shadow
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-md ${baseColors.headerBg} ${baseColors.headerText}`}>
          <IconComponent className="w-4 h-4" />
        </div>
        <span className={`text-xs font-semibold ${baseColors.titleText} uppercase tracking-wide`}>
          Action
        </span>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <p className={`text-sm font-medium ${baseColors.bodyText}`}>
          {label}
        </p>
        <p className={`text-[10px] ${baseColors.mutedText}`}>
          {description}
        </p>

        {/* Approval Badge */}
        {requiresApproval && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-800/50 rounded text-[9px]">
            <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300 font-medium">
              Requires Approval
            </span>
          </div>
        )}

        {/* Risk Level Badge */}
        <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] ${riskColors.bg} ${riskColors.text}`}>
          {riskLevel} risk
        </div>

        {/* Reason (if provided) */}
        {reason && (
          <p className={`text-[9px] ${baseColors.mutedText} italic`} title={reason}>
            {reason.substring(0, 50)}...
          </p>
        )}
      </div>
    </div>
  );
});

ActionFlowNode.displayName = 'ActionFlowNode';

export default ActionFlowNode;
