'use client';

import React from 'react';

interface CategoryStatus {
  id: string;
  name: string;
  icon: string;
  color: string;
  configured: number;
  total: number;
}

interface QuickStatusBarProps {
  categories: CategoryStatus[];
  onCategoryClick?: (categoryId: string) => void;
}

export function QuickStatusBar({ categories, onCategoryClick }: QuickStatusBarProps) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Integration Status</h2>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400" role="group" aria-label="Status legend">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
            <span>Configured</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-400" aria-hidden="true" />
            <span>Not Set</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {categories.map((category) => {
          const isFullyConfigured = category.configured === category.total;
          const isPartiallyConfigured = category.configured > 0 && category.configured < category.total;
          const statusColor = isFullyConfigured
            ? 'border-green-500'
            : isPartiallyConfigured
            ? 'border-amber-500'
            : 'border-slate-300 dark:border-slate-600';

          const statusLabel = isFullyConfigured
            ? 'fully configured'
            : isPartiallyConfigured
            ? 'partially configured'
            : 'not configured';

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryClick?.(category.id)}
              aria-label={`${category.name}: ${category.configured} of ${category.total} ${statusLabel}. Click to scroll to section.`}
              className={`
                flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200
                bg-slate-50 dark:bg-slate-800/50
                hover:bg-slate-100 dark:hover:bg-slate-700
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                ${statusColor}
              `}
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg ${category.color} flex items-center justify-center mb-2`} aria-hidden="true">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={category.icon} />
                </svg>
              </div>

              {/* Name */}
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                {category.name}
              </span>

              {/* Count */}
              <span
                className={`
                  text-xs mt-1 font-medium
                  ${isFullyConfigured
                    ? 'text-green-600 dark:text-green-400'
                    : isPartiallyConfigured
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {category.configured}/{category.total}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickStatusBar;
