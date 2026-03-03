'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Server, Lock, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { PlatformEndpointNodeData } from '@/types/journey-flow';
import { PLATFORMS, type PlatformId } from '@/types/agent-flow';

// Platform-specific colors for the ring
const PLATFORM_RING_COLORS: Record<string, string> = {
  meraki: '#00bceb',
  catalyst: '#049fd9',
  splunk: '#65a637',
  thousandeyes: '#ff6b35',
  anthropic: '#d4a574',
  openai: '#10b981',
  google: '#4285f4',
};

export const PlatformEndpointNode = memo(({ data }: NodeProps<Node<PlatformEndpointNodeData>>) => {
  const [copied, setCopied] = useState(false);
  const platformConfig = data.platform ? PLATFORMS[data.platform as PlatformId] : null;
  const ringColor = data.platform ? (PLATFORM_RING_COLORS[data.platform.toLowerCase()] || data.platformColor) : data.platformColor;

  const handleCopy = useCallback(() => {
    if (data.serverIp) {
      navigator.clipboard.writeText(data.serverIp + (data.serverPort ? `:${data.serverPort}` : ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [data.serverIp, data.serverPort]);

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-transparent !border-0" />

      <div className="min-w-[150px] max-w-[190px] rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Top color bar */}
        <div className="h-1" style={{ backgroundColor: ringColor }} />

        <div className="p-3">
          {/* Platform icon with colored ring */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-gray-800"
              style={{ border: `2px solid ${ringColor}`, boxShadow: `0 0 0 3px ${ringColor}15` }}
            >
              <Server className="w-4 h-4" style={{ color: ringColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold block truncate" style={{ color: ringColor }}>
                {platformConfig?.name || data.platform || 'Endpoint'}
              </span>
            </div>
          </div>

          {/* Server IP with copy button */}
          {data.serverIp && (
            <div className="flex items-center gap-1 group mb-2">
              <span className="text-[10px] font-mono text-gray-600 dark:text-gray-300 truncate flex-1">
                {data.serverIp}{data.serverPort ? `:${data.serverPort}` : ''}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap gap-1">
            {data.tlsVersion && (
              <span className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-medium">
                <Lock className="w-2.5 h-2.5" />
                {data.tlsVersion}
              </span>
            )}
            {data.httpVersion && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 font-medium">
                {data.httpVersion}
              </span>
            )}
            {data.serverPort && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-50 dark:bg-gray-750 text-gray-500 border border-gray-200 dark:border-gray-700 font-mono">
                :{data.serverPort}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
PlatformEndpointNode.displayName = 'PlatformEndpointNode';
