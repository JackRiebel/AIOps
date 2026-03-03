'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import type { SynthesisNodeData } from '@/types/journey-flow';

export const SynthesisNode = memo(({ data }: NodeProps<Node<SynthesisNodeData>>) => {
  // Token progress ring: show as fraction of a typical max (e.g., 4096)
  const maxTokens = 4096;
  const tokenPct = data.tokens > 0 ? Math.min((data.tokens / maxTokens) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 16;
  const dashOffset = circumference - (tokenPct / 100) * circumference;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-white dark:!border-gray-900" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-white dark:!border-gray-900" />

      <div className="relative min-w-[140px] rounded-xl overflow-hidden">
        {/* Animated shimmer background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/8 to-purple-500/10 animate-gradient-slow" />
        <div className="absolute inset-0 bg-[length:200%_200%] animate-shimmer"
          style={{
            backgroundImage: 'linear-gradient(110deg, transparent 25%, rgba(139,92,246,0.06) 50%, transparent 75%)',
            animation: 'shimmer 3s ease-in-out infinite',
          }}
        />

        <div className="relative border border-purple-200 dark:border-purple-800/60 rounded-xl p-3.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            {/* Token progress ring */}
            <div className="relative w-10 h-10 shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-100 dark:text-purple-900/50" />
                <circle
                  cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="text-purple-500"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <Sparkles className="w-4 h-4 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block">Synthesis</span>

              {data.durationMs != null && (
                <span className="text-[10px] font-mono text-purple-500 block">{data.durationMs.toFixed(0)}ms</span>
              )}

              {data.tokens > 0 && (
                <span className="text-[9px] text-gray-400 block">{data.tokens.toLocaleString()} tokens</span>
              )}
            </div>
          </div>

          {/* Cost badge */}
          {data.costUsd != null && data.costUsd > 0 && (
            <div className="mt-2 flex items-center justify-center">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                ${data.costUsd.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          background-size: 200% 100%;
        }
      `}</style>
    </div>
  );
});
SynthesisNode.displayName = 'SynthesisNode';
