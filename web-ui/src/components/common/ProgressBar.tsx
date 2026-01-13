'use client';

import { memo, useMemo } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  colorMode?: 'gradient' | 'threshold';
  className?: string;
}

export const ProgressBar = memo(({
  value,
  max = 100,
  showLabel = false,
  showValue = true,
  size = 'md',
  colorMode = 'threshold',
  className = '',
}: ProgressBarProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barColor = useMemo(() => {
    if (colorMode === 'gradient') {
      return 'bg-gradient-to-r from-cyan-500 to-emerald-500';
    }
    // Threshold-based coloring
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }, [percentage, colorMode]);

  const textColor = useMemo(() => {
    if (percentage >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (percentage >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }, [percentage]);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      {showValue && (
        <div className={`text-right text-xs font-semibold mb-1 ${textColor}`}>
          {Math.round(percentage)}%
        </div>
      )}
      <div className={`w-full ${sizeClasses[size]} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-400">0</span>
          <span className="text-[10px] text-slate-400">{max}</span>
        </div>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
