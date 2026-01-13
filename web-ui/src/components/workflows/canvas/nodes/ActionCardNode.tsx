'use client';

import { memo, useState, useCallback } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import {
  Wrench, Hand, Check, AlertTriangle, ChevronDown, ChevronUp,
  Settings, Copy, Trash2, Info, ExternalLink
} from 'lucide-react';
import { ACTION_REGISTRY, type ActionDefinition } from '../../types';

// Platform configuration with colors and icons
const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  meraki: { label: 'Meraki', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  splunk: { label: 'Splunk', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  thousandeyes: { label: 'ThousandEyes', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  catalyst: { label: 'Catalyst', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  general: { label: 'General', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  notification: { label: 'Notify', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
};

const RISK_CONFIG = {
  low: { label: 'Low Risk', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  medium: { label: 'Medium Risk', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  high: { label: 'High Risk', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
};

export interface ActionCardNodeData {
  label: string;
  description?: string;
  actionId?: string;
  actionName?: string;
  platform?: string;
  params?: Record<string, unknown>;
  requiresApproval?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  isValid?: boolean;
  validationErrors?: string[];
  isRunning?: boolean;
  hasRun?: boolean;
  runResult?: 'success' | 'error' | 'skipped';
  isCollapsed?: boolean;
  [key: string]: unknown;
}

interface ActionCardNodeProps extends NodeProps {
  data: ActionCardNodeData;
}

export const ActionCardNode = memo(({ data, selected }: ActionCardNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Get action definition from registry
  const action = data.actionId ? ACTION_REGISTRY.find(a => a.id === data.actionId) : null;
  const platform = data.platform || action?.platform || 'general';
  const platformConfig = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.general;
  const riskLevel = data.riskLevel || action?.riskLevel || 'low';
  const riskConfig = RISK_CONFIG[riskLevel];

  // Validation status
  const hasValidationErrors = data.validationErrors && data.validationErrors.length > 0;
  const isConfigured = data.params && Object.keys(data.params).length > 0;

  // Running status indicator
  const getStatusIndicator = () => {
    if (data.isRunning) {
      return (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      );
    }
    if (data.runResult === 'success') {
      return (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-3 h-3 text-white" />
        </div>
      );
    }
    if (data.runResult === 'error') {
      return (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
      );
    }
    if (hasValidationErrors) {
      return (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
      );
    }
    if (isConfigured) {
      return (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-3 h-3 text-white" />
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`relative group transition-all duration-200 ${
        selected ? 'scale-[1.02]' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-800 hover:!bg-cyan-400 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-800 hover:!bg-cyan-400 transition-colors"
      />

      {/* Main Card */}
      <div
        className={`min-w-[260px] max-w-[320px] rounded-xl overflow-hidden shadow-xl transition-all duration-200
                    ${selected
                      ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900'
                      : 'ring-1 ring-slate-700 hover:ring-slate-600'
                    }
                    ${data.isRunning ? 'shadow-cyan-500/20 shadow-lg' : ''}
                    ${data.runResult === 'error' ? 'shadow-red-500/20 shadow-lg' : ''}`}
      >
        {/* Header */}
        <div className={`relative px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-800/80 border-b border-slate-700`}>
          {getStatusIndicator()}

          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 p-2 rounded-lg ${platformConfig.bgColor}`}>
              {action?.icon ? (
                <span className="text-xl">{action.icon}</span>
              ) : (
                <Wrench className={`w-5 h-5 ${platformConfig.color}`} />
              )}
            </div>

            {/* Title and Platform */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white text-sm truncate">
                  {data.label || action?.name || 'Action'}
                </h3>
                {data.requiresApproval && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-medium">
                    <Hand className="w-2.5 h-2.5" />
                    Approval
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformConfig.bgColor} ${platformConfig.color}`}>
                  {platformConfig.label}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${riskConfig.bgColor} ${riskConfig.color}`}>
                  {riskConfig.label}
                </span>
              </div>
            </div>

            {/* Expand Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex-shrink-0 p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Description (always visible) */}
        <div className="px-4 py-2 bg-slate-800/50">
          <p className="text-xs text-slate-400 line-clamp-2">
            {data.description || action?.description || 'Configure this action in the properties panel'}
          </p>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 py-3 bg-slate-850 border-t border-slate-700 space-y-3">
            {/* Parameters Preview */}
            {data.params && Object.keys(data.params).length > 0 ? (
              <div>
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Configuration
                </h4>
                <div className="space-y-1">
                  {Object.entries(data.params).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400 truncate">{key}:</span>
                      <span className="text-slate-300 truncate max-w-[120px]">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(data.params).length > 3 && (
                    <span className="text-[10px] text-slate-500">
                      +{Object.keys(data.params).length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5" />
                <span>No parameters configured</span>
              </div>
            )}

            {/* Validation Errors */}
            {hasValidationErrors && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">
                  Validation Issues
                </h4>
                <ul className="space-y-0.5">
                  {data.validationErrors!.map((error, idx) => (
                    <li key={idx} className="text-[11px] text-red-300 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Info Link */}
            {action && (
              <button className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                <ExternalLink className="w-3 h-3" />
                View action documentation
              </button>
            )}
          </div>
        )}

        {/* Quick Actions Bar (on hover) */}
        {showActions && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Configure"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ActionCardNode.displayName = 'ActionCardNode';

export default ActionCardNode;
