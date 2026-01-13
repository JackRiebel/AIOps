'use client';

import React, { useState } from 'react';

interface IntegrationSectionProps {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  configuredCount: number;
  totalCount: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function IntegrationSection({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  id,
  title,
  description,
  icon,
  configuredCount,
  totalCount,
  defaultExpanded = false,
  children,
}: IntegrationSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const isFullyConfigured = configuredCount === totalCount;
  const isPartiallyConfigured = configuredCount > 0 && configuredCount < totalCount;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${title}: ${configuredCount} of ${totalCount} configured. Click to ${isExpanded ? 'collapse' : 'expand'}.`}
        className={`
          w-full px-5 py-4 flex items-center justify-between text-left
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500/50
          ${isExpanded
            ? 'bg-slate-50 dark:bg-slate-800/50'
            : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center" aria-hidden="true">
              <svg
                className="w-4 h-4 text-slate-600 dark:text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </div>
          )}

          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              {/* Status Badge */}
              <span
                className={`
                  inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  ${isFullyConfigured
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : isPartiallyConfigured
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }
                `}
              >
                {configuredCount}/{totalCount}
              </span>
            </div>
            {description && !isExpanded && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <svg
          className={`
            w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0
            ${isExpanded ? 'rotate-180' : ''}
          `}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Section Content */}
      <div
        className={`
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}
        `}
      >
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          {description && isExpanded && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{description}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrationSection;
