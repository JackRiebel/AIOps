'use client';

import { memo } from 'react';
import { Zap, Calendar, Play, Clock } from 'lucide-react';
import { formatPollInterval } from '../utils/generateFlowFromWorkflow';

interface TriggerFlowNodeProps {
  data: {
    triggerType: 'splunk_query' | 'schedule' | 'manual';
    splunkQuery?: string;
    scheduleCron?: string;
    pollInterval?: number;
  };
}

/**
 * TriggerFlowNode - Shows the workflow trigger with icon and details
 * Green accent color, displays trigger type and configuration
 */
export const TriggerFlowNode = memo(({ data }: TriggerFlowNodeProps) => {
  const { triggerType, splunkQuery, scheduleCron, pollInterval } = data;

  const getTriggerIcon = () => {
    switch (triggerType) {
      case 'splunk_query':
        return <Zap className="w-4 h-4" />;
      case 'schedule':
        return <Calendar className="w-4 h-4" />;
      case 'manual':
        return <Play className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const getTriggerLabel = () => {
    switch (triggerType) {
      case 'splunk_query':
        return 'Splunk Query';
      case 'schedule':
        return 'Schedule';
      case 'manual':
        return 'Manual';
      default:
        return 'Trigger';
    }
  };

  const getTriggerDetail = () => {
    switch (triggerType) {
      case 'splunk_query':
        return splunkQuery ? (
          <span className="truncate" title={splunkQuery}>
            {splunkQuery.substring(0, 30)}...
          </span>
        ) : null;
      case 'schedule':
        return scheduleCron ? (
          <code className="text-[10px] font-mono">{scheduleCron}</code>
        ) : null;
      case 'manual':
        return <span>On demand</span>;
      default:
        return null;
    }
  };

  return (
    <div className="
      w-[160px] p-3 rounded-lg
      bg-emerald-50 dark:bg-emerald-900/30
      border-2 border-emerald-400 dark:border-emerald-600
      shadow-sm hover:shadow-md transition-shadow
    ">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400">
          {getTriggerIcon()}
        </div>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
          Trigger
        </span>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {getTriggerLabel()}
        </p>
        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
          {getTriggerDetail()}
        </div>
        {pollInterval && pollInterval > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            <Clock className="w-3 h-3" />
            <span>Every {formatPollInterval(pollInterval)}</span>
          </div>
        )}
      </div>
    </div>
  );
});

TriggerFlowNode.displayName = 'TriggerFlowNode';

export default TriggerFlowNode;
