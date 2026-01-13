'use client';

import { memo } from 'react';
import { AIGaugeData } from '@/types/session';
import Gauge from '../charts/Gauge';

interface AIGaugeCardProps {
  data: AIGaugeData;
}

/**
 * AIGaugeCard - Display a value as a circular gauge
 *
 * Features:
 * - Circular gauge visualization
 * - Threshold-based coloring
 * - Configurable min/max
 */
export const AIGaugeCard = memo(({ data }: AIGaugeCardProps) => {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No gauge data
      </div>
    );
  }

  const { label, value, max, unit, thresholds } = data;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <Gauge
        value={value}
        min={0}
        max={max}
        size={140}
        strokeWidth={12}
        label={label}
        unit={unit || ''}
        showValue={true}
        thresholds={thresholds || { warning: max * 0.7, critical: max * 0.9 }}
      />
    </div>
  );
});

AIGaugeCard.displayName = 'AIGaugeCard';

export default AIGaugeCard;
