'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle2, XCircle, Clock, Coins, Hash, Wifi, TrendingDown, Repeat } from 'lucide-react';
import type { ResponseNodeData } from '@/types/journey-flow';

export const ResponseNode = memo(({ data }: NodeProps<Node<ResponseNodeData>>) => {
  const isSuccess = data.status === 'success';
  const cs = data.costSummary;
  const hasWaste = cs && cs.totalWastedUsd > 0;
  const wastePct = cs && cs.totalCostUsd > 0 ? (cs.totalWastedUsd / cs.totalCostUsd) * 100 : 0;

  // Border color based on cost health
  const borderColor = !isSuccess
    ? 'border-red-200 dark:border-red-800'
    : hasWaste && wastePct > 5
      ? 'border-amber-200 dark:border-amber-800'
      : 'border-emerald-200 dark:border-emerald-800';
  const bgColor = !isSuccess
    ? 'bg-red-50 dark:bg-red-950/40'
    : hasWaste && wastePct > 5
      ? 'bg-amber-50 dark:bg-amber-950/40'
      : 'bg-emerald-50 dark:bg-emerald-950/40';

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-transparent !border-0" />

      <div className={`flex flex-col gap-1.5 p-3.5 rounded-xl border shadow-sm ${borderColor} ${bgColor} min-w-[170px]`}>
        {/* Status */}
        <div className="flex items-center gap-1.5 justify-center">
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-[11px] font-semibold ${isSuccess ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
            {isSuccess ? 'Complete' : 'Error'}
          </span>
        </div>

        {/* Core metrics */}
        <div className="flex flex-col gap-0.5">
          {data.totalDurationMs != null && (
            <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
              <Clock className="w-2.5 h-2.5" />
              <span className="font-mono">{(data.totalDurationMs / 1000).toFixed(2)}s</span>
            </div>
          )}
          {data.totalCostUsd > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
              <Coins className="w-2.5 h-2.5" />
              <span className="font-mono">${data.totalCostUsd.toFixed(4)}</span>
            </div>
          )}
          {data.totalTokens > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
              <Hash className="w-2.5 h-2.5" />
              <span className="font-mono">{data.totalTokens.toLocaleString()} tokens</span>
            </div>
          )}
        </div>

        {/* Cost Summary (from TE enrichment) */}
        {cs && (
          <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-1.5 mt-0.5 space-y-0.5">
            {/* Network Tax */}
            {cs.networkTaxPct > 0 && (
              <div className="flex items-center gap-1 text-[10px]">
                <Wifi className="w-2.5 h-2.5 text-blue-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Network tax: <span className="font-mono font-medium">{cs.networkTaxPct.toFixed(1)}%</span> of round-trip
                </span>
              </div>
            )}

            {/* Wasted on Latency */}
            {hasWaste && (
              <div className="flex items-center gap-1 text-[10px]">
                <TrendingDown className="w-2.5 h-2.5 text-red-500" />
                <span className="text-red-600 dark:text-red-400">
                  Wasted: <span className="font-mono font-medium">${cs.totalWastedUsd.toFixed(4)}</span>
                  <span className="text-gray-400 ml-0.5">({wastePct.toFixed(1)}% of spend)</span>
                </span>
              </div>
            )}

            {/* Token waste from retries */}
            {data.tokenWaste && data.tokenWaste.retryCount > 0 && (
              <div className="flex items-center gap-1 text-[10px]">
                <Repeat className="w-2.5 h-2.5 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">
                  <span className="font-mono font-medium">{data.tokenWaste.retryCount}</span> retries, <span className="font-mono font-medium">{data.tokenWaste.wastedTokens.toLocaleString()}</span> tokens re-sent
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
ResponseNode.displayName = 'ResponseNode';
