'use client';

import { memo } from 'react';
import { LayoutGrid, List } from 'lucide-react';

/**
 * ViewToggle - Toggle between card and list view
 */

export type ViewMode = 'card' | 'list';

export interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewToggle = memo(({ viewMode, onChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
      <button
        onClick={() => onChange('card')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${viewMode === 'card'
            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }
        `}
      >
        <LayoutGrid className="w-4 h-4" />
        Cards
      </button>
      <button
        onClick={() => onChange('list')}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
          ${viewMode === 'list'
            ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }
        `}
      >
        <List className="w-4 h-4" />
        List
      </button>
    </div>
  );
});

ViewToggle.displayName = 'ViewToggle';

export default ViewToggle;
