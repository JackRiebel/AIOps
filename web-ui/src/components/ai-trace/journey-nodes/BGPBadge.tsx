'use client';

import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TEBGPRoute } from '@/types/journey-flow';

interface BGPBadgeProps {
  routes: TEBGPRoute[];
}

export const BGPBadge = memo(({ routes }: BGPBadgeProps) => {
  if (routes.length === 0) return null;

  const uniquePrefixes = new Set(routes.map((r) => r.prefix)).size;
  const avgReachability = routes.reduce((sum, r) => sum + r.reachability, 0) / routes.length;

  const isHealthy = avgReachability >= 100;
  const isDegraded = avgReachability >= 80 && avgReachability < 100;

  const colorClass = isHealthy
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
    : isDegraded
      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
      : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40';

  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium ${colorClass}`}>
      {!isHealthy && <AlertTriangle className="w-2.5 h-2.5" />}
      <span>BGP: {uniquePrefixes} {uniquePrefixes === 1 ? 'prefix' : 'prefixes'}, {avgReachability.toFixed(0)}% reachable</span>
    </div>
  );
});
BGPBadge.displayName = 'BGPBadge';
