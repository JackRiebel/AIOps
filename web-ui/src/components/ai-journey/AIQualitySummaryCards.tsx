'use client';

import { memo } from 'react';
import { Timer, Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { AIQualitySummary } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface AIQualitySummaryCardsProps {
  summary: AIQualitySummary | null;
}

// ============================================================================
// Helpers
// ============================================================================

function passRateColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-500';
  if (rate >= 80) return 'text-amber-500';
  return 'text-red-500';
}

function availabilityColor(pct: number): string {
  if (pct >= 99.5) return 'text-emerald-500';
  return 'text-amber-500';
}

// ============================================================================
// Component
// ============================================================================

export const AIQualitySummaryCards = memo(({ summary }: AIQualitySummaryCardsProps) => {
  if (!summary) {
    return (
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-w-[130px] p-3 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30"
          >
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Avg Response Time',
      value: `${summary.avg_response_time_ms.toFixed(0)}ms`,
      icon: Timer,
      color: 'text-blue-500',
    },
    {
      label: 'Token Efficiency',
      value: summary.token_efficiency.toFixed(2),
      icon: Cpu,
      color: 'text-purple-500',
    },
    {
      label: 'Assertion Pass Rate',
      value: `${summary.assertion_pass_rate.toFixed(1)}%`,
      icon: CheckCircle2,
      color: passRateColor(summary.assertion_pass_rate),
    },
    {
      label: 'Availability',
      value: `${summary.availability_pct.toFixed(1)}%`,
      icon: ShieldCheck,
      color: availabilityColor(summary.availability_pct),
    },
  ];

  return (
    <div className="flex gap-3 flex-wrap">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex-1 min-w-[130px] p-3 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className={`text-lg font-bold tabular-nums leading-none ${card.color}`}>
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
});

AIQualitySummaryCards.displayName = 'AIQualitySummaryCards';
export default AIQualitySummaryCards;
