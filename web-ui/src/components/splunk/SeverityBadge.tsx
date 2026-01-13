'use client';

import { memo } from 'react';
import { getSeverityConfig, type SeverityLevel } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  showDot?: boolean;
  pulse?: boolean;
  className?: string;
}

// ============================================================================
// SeverityBadge Component
// ============================================================================

export const SeverityBadge = memo(({
  severity,
  showDot = true,
  pulse = false,
  className = '',
}: SeverityBadgeProps) => {
  const config = getSeverityConfig(severity);
  const isCritical = severity.toLowerCase() === 'critical';
  const shouldPulse = pulse || isCritical;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}>
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          {shouldPulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
        </span>
      )}
      {severity.toUpperCase()}
    </span>
  );
});

SeverityBadge.displayName = 'SeverityBadge';

export default SeverityBadge;
