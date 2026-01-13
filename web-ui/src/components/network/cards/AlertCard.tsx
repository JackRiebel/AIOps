'use client';

import type { AlertSummary } from '../types';

interface AlertCardProps {
  alert: AlertSummary;
  onClick: () => void;
}

const severityColors = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-500/10',
  warning: 'border-l-amber-500 bg-amber-50 dark:bg-amber-500/10',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-500/10',
};

export function AlertCard({ alert, onClick }: AlertCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-l-4 ${severityColors[alert.severity]} border border-slate-200 dark:border-slate-700/50 hover:opacity-80 transition-opacity`}
      aria-label={`${alert.severity} alert: ${alert.message}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          {alert.type}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {new Date(alert.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
        {alert.message}
      </p>
    </button>
  );
}
