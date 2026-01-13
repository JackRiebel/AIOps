'use client';

import { memo } from 'react';
import { Bell, MessageSquare, Mail, MessageCircle, AlertTriangle, Send, Hash, AtSign } from 'lucide-react';

// Icon mapping for notification channels
const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Slack': MessageSquare,
  'Email': Mail,
  'Teams': MessageCircle,
  'PagerDuty': AlertTriangle,
  'Webhook': Send,
  'Alert': Bell,
};

interface NotifyFlowNodeProps {
  data: {
    tool: string;
    label: string;
    description: string;
    icon: string;
    channel: string;
    target?: string;
  };
}

/**
 * NotifyFlowNode - Shows notification action with channel details
 * Blue accent color, displays channel type and target
 */
export const NotifyFlowNode = memo(({ data }: NotifyFlowNodeProps) => {
  const { label, description, channel, target } = data;

  const ChannelIcon = CHANNEL_ICONS[channel] || Bell;

  return (
    <div className="
      w-[160px] p-3 rounded-lg
      bg-blue-50 dark:bg-blue-900/30
      border-2 border-blue-400 dark:border-blue-600
      shadow-sm hover:shadow-md transition-shadow
    ">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400">
          <ChannelIcon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
          Notify
        </span>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          {label}
        </p>
        <p className="text-[10px] text-blue-600 dark:text-blue-400">
          {description}
        </p>

        {/* Channel & Target */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100/50 dark:bg-blue-800/30 rounded">
          {target && target.startsWith('#') ? (
            <>
              <Hash className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate">
                {target}
              </span>
            </>
          ) : target && target.includes('@') ? (
            <>
              <AtSign className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate">
                {target}
              </span>
            </>
          ) : target ? (
            <>
              <Send className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate">
                {target}
              </span>
            </>
          ) : (
            <span className="text-[10px] text-blue-600 dark:text-blue-400">
              {channel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

NotifyFlowNode.displayName = 'NotifyFlowNode';

export default NotifyFlowNode;
