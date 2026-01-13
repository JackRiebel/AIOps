'use client';

import { StatusDot } from '../StatusDot';
import type { DeviceSummary } from '../types';

interface DeviceCardProps {
  device: DeviceSummary;
  isSelected: boolean;
  onClick: () => void;
}

export function DeviceCard({ device, isSelected, onClick }: DeviceCardProps) {
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
          {device.name || device.model}
        </span>
        <StatusDot status={device.status} />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
        <span className="font-mono">{device.model}</span>
        <span>•</span>
        <span className="font-mono truncate">{device.serial}</span>
      </div>
    </button>
  );
}
