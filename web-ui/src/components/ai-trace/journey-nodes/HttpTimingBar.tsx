'use client';

import { memo } from 'react';
import type { TEHttpTiming } from '@/types/journey-flow';

const PHASES = [
  { key: 'dns', field: 'dnsTime' as const, label: 'DNS', color: '#06b6d4' },
  { key: 'connect', field: 'connectTime' as const, label: 'Connect', color: '#f59e0b' },
  { key: 'ssl', field: 'sslTime' as const, label: 'SSL', color: '#8b5cf6' },
  { key: 'wait', field: 'waitTime' as const, label: 'Wait', color: '#3b82f6' },
  { key: 'receive', field: 'receiveTime' as const, label: 'Receive', color: '#10b981' },
] as const;

interface HttpTimingBarProps {
  timing: TEHttpTiming;
  compact?: boolean;
}

export const HttpTimingBar = memo(({ timing, compact = false }: HttpTimingBarProps) => {
  const phases = PHASES.map((p) => ({
    ...p,
    ms: timing[p.field] || 0,
  })).filter((p) => p.ms > 0);

  const total = phases.reduce((sum, p) => sum + p.ms, 0);
  if (total === 0) return null;

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {/* Stacked bar */}
      <div className={`flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 ${compact ? 'h-1' : 'h-1.5'}`}>
        {phases.map((p) => (
          <div
            key={p.key}
            className="h-full"
            style={{
              width: `${Math.max((p.ms / total) * 100, 3)}%`,
              backgroundColor: p.color,
            }}
            title={`${p.label}: ${p.ms.toFixed(0)}ms`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className={`flex flex-wrap gap-x-2 gap-y-0 ${compact ? 'gap-x-1.5' : ''}`}>
        {phases.map((p) => (
          <span
            key={p.key}
            className={`flex items-center gap-0.5 ${compact ? 'text-[7px]' : 'text-[8px]'} text-gray-500`}
          >
            <span
              className="w-1 h-1 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            {p.label} {p.ms.toFixed(0)}ms
          </span>
        ))}
      </div>
    </div>
  );
});
HttpTimingBar.displayName = 'HttpTimingBar';
