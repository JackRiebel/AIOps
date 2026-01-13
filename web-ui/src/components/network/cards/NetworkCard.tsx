'use client';

import { StatusDot } from '../StatusDot';
import type { NetworkSummary } from '../types';

interface NetworkCardProps {
  network: NetworkSummary;
  isSelected: boolean;
  onClick: () => void;
}

export function NetworkCard({ network, isSelected, onClick }: NetworkCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30'
          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
      aria-pressed={isSelected}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {network.name}
        </span>
        <StatusDot status="online" />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
        {network.productTypes?.slice(0, 2).map((type) => (
          <span
            key={type}
            className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded"
          >
            {type}
          </span>
        ))}
        {network.deviceCount && (
          <span>{network.deviceCount} devices</span>
        )}
      </div>
    </button>
  );
}
