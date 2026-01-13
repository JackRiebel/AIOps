'use client';

import { memo, useState } from 'react';
import { AIFindingData } from '@/types/session';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from 'lucide-react';

interface AIFindingCardProps {
  data: AIFindingData;
}

/**
 * AIFindingCard - Display an important finding or alert
 *
 * Features:
 * - Severity-based styling (info, warning, critical, success)
 * - Expandable details section
 * - Recommendation callout
 */
export const AIFindingCard = memo(({ data }: AIFindingCardProps) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No finding data
      </div>
    );
  }

  const { severity, title, description, details, recommendation } = data;

  // Severity styles
  const severityStyles = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      titleColor: 'text-blue-800 dark:text-blue-200',
      Icon: Info,
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      titleColor: 'text-amber-800 dark:text-amber-200',
      Icon: AlertTriangle,
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-400',
      titleColor: 'text-red-800 dark:text-red-200',
      Icon: AlertCircle,
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      titleColor: 'text-emerald-800 dark:text-emerald-200',
      Icon: CheckCircle,
    },
  };

  const styles = severityStyles[severity] || severityStyles.info;
  const { Icon } = styles;

  return (
    <div className={`h-full flex flex-col ${styles.bg} rounded-lg border ${styles.border} overflow-hidden`}>
      {/* Header */}
      <div className="flex-shrink-0 p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-lg ${styles.iconBg} flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${styles.iconColor}`} />
          </div>

          {/* Title and description */}
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${styles.titleColor}`}>
              {title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Details section */}
      {details && details.length > 0 && (
        <div className="flex-shrink-0 border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="font-medium">Details ({details.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="px-3 pb-3 space-y-1.5">
              {details.map((detail, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-xs p-2 bg-white/50 dark:bg-slate-800/50 rounded"
                >
                  <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{detail.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="flex-shrink-0 mt-auto border-t border-slate-200/50 dark:border-slate-700/50 p-3">
          <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Recommendation: </span>
              {recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

AIFindingCard.displayName = 'AIFindingCard';

export default AIFindingCard;
