'use client';

import { memo } from 'react';
import { CheckCircle2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface StatusBadgeProps {
  status: 'active' | 'completed';
  className?: string;
}

// ============================================================================
// StatusBadge Component
// ============================================================================

export const StatusBadge = memo(({ status, className = '' }: StatusBadgeProps) => {
  if (status === 'active') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        Active
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20 ${className}`}
    >
      <CheckCircle2 className="w-3 h-3" />
      Completed
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
