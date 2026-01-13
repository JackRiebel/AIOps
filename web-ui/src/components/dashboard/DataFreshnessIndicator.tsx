'use client';

import { memo, useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface DataFreshnessIndicatorProps {
  lastUpdated: Date;
  onRefresh: () => void;
  isRefreshing?: boolean;
  staleThresholdMinutes?: number;
  className?: string;
}

export const DataFreshnessIndicator = memo(({
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  staleThresholdMinutes = 5,
  className = '',
}: DataFreshnessIndicatorProps) => {
  const [timeAgo, setTimeAgo] = useState('');
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const diff = now.getTime() - lastUpdated.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setIsStale(minutes >= staleThresholdMinutes);

      if (minutes === 0) {
        setTimeAgo(seconds < 10 ? 'Just now' : `${seconds}s ago`);
      } else if (minutes < 60) {
        setTimeAgo(`${minutes}m ago`);
      } else {
        const hours = Math.floor(minutes / 60);
        setTimeAgo(`${hours}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated, staleThresholdMinutes]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isStale ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
        )}
        <span className={`text-xs font-medium ${
          isStale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
        }`}>
          {isStale ? 'Data may be stale' : 'Live'}
        </span>
      </div>

      {/* Divider */}
      <span className="text-slate-300 dark:text-slate-600">•</span>

      {/* Time ago */}
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
        <span className="text-xs text-slate-400">{timeAgo}</span>
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        aria-label={isRefreshing ? 'Refreshing data' : 'Refresh data'}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
});

DataFreshnessIndicator.displayName = 'DataFreshnessIndicator';

export default DataFreshnessIndicator;
