'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ResponseSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
  badgeColor?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const badgeColors = {
  default: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
  success: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  error: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  info: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
};

export function ResponseSection({
  title,
  icon,
  defaultExpanded = true,
  badge,
  badgeColor = 'default',
  children,
  actions,
  className = '',
}: ResponseSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {title}
          </span>
          {badge !== undefined && (
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${badgeColors[badgeColor]}`}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 bg-white dark:bg-slate-800/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
