'use client';

import { memo } from 'react';

interface EmptyStateProps {
  message: string;
}

/**
 * EmptyState - Simple centered message for empty card states
 */
export const EmptyState = memo(({ message }: EmptyStateProps) => (
  <div className="h-full flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
    {message}
  </div>
));

EmptyState.displayName = 'EmptyState';

export default EmptyState;
