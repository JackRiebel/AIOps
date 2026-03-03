'use client';

import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import type { UserQueryNodeData } from '@/types/journey-flow';

// Highlight network terms (IPs, hostnames) in query text
function highlightNetworkTerms(text: string): React.ReactNode[] {
  const ipPattern = /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/g;
  const parts = text.split(ipPattern);
  return parts.map((part, i) =>
    ipPattern.test(part) ? (
      <span key={i} className="font-mono text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 px-0.5 rounded">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export const UserQueryNode = memo(({ data }: NodeProps<Node<UserQueryNodeData>>) => {
  const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';
  const relativeTime = useMemo(() => {
    if (!data.timestamp) return '';
    const diff = Math.round((Date.now() - new Date(data.timestamp).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    return time;
  }, [data.timestamp, time]);

  return (
    <div className="relative">
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-gray-900" />

      {/* Chat bubble card with speech tail */}
      <div className="relative min-w-[180px] max-w-[240px]">
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/40 border-2 border-transparent"
          style={{ borderImage: 'linear-gradient(135deg, #3b82f6, #8b5cf6) 1', borderImageSlice: 1, borderRadius: '12px', border: '2px solid transparent', backgroundClip: 'padding-box' }}
        >
          {/* Gradient border overlay */}
          <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
            padding: '2px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            borderRadius: '12px',
          }} />

          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-[10px] font-medium text-blue-500/70 uppercase tracking-wider">User Query</span>
          </div>

          <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 leading-relaxed line-clamp-3">
            {highlightNetworkTerms(data.query)}
          </p>

          {relativeTime && (
            <span className="block mt-2 text-[10px] text-gray-400">{relativeTime}</span>
          )}
        </div>

        {/* Speech bubble tail pointing right */}
        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-blue-50 dark:bg-blue-950/50 border-r-2 border-t-2" style={{
          borderColor: '#8b5cf6',
        }} />
      </div>
    </div>
  );
});
UserQueryNode.displayName = 'UserQueryNode';
