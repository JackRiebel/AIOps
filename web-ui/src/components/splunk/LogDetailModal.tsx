'use client';

import { memo } from 'react';
import { X, FileJson } from 'lucide-react';
import type { SplunkLog } from './types';

// ============================================================================
// Types
// ============================================================================

export interface LogDetailModalProps {
  log: SplunkLog;
  onClose: () => void;
}

// ============================================================================
// LogDetailModal Component
// ============================================================================

export const LogDetailModal = memo(({
  log,
  onClose,
}: LogDetailModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Log Details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <pre className="text-sm text-slate-700 dark:text-slate-200 font-mono bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(log, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
});

LogDetailModal.displayName = 'LogDetailModal';

export default LogDetailModal;
