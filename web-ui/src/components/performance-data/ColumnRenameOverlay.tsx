'use client';

import { useState, useCallback } from 'react';
import { ArrowRight, Check, RotateCcw, X, Sparkles } from 'lucide-react';
import type { ColumnRenameSuggestion } from './types';

interface ColumnRenameOverlayProps {
  filename: string;
  columns: ColumnRenameSuggestion[];
  onConfirm: (renames: Record<string, string>) => void;
  onCancel: () => void;
}

export function ColumnRenameOverlay({ filename, columns, onConfirm, onCancel }: ColumnRenameOverlayProps) {
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col.original] = col.suggested;
    }
    return initial;
  });

  const handleReset = useCallback((original: string, suggested: string) => {
    setEdits(prev => ({ ...prev, [original]: suggested }));
  }, []);

  const handleChange = useCallback((original: string, value: string) => {
    setEdits(prev => ({ ...prev, [original]: value }));
  }, []);

  const handleConfirm = useCallback(() => {
    // Only include renames where the name actually changed from the original
    const renames: Record<string, string> = {};
    for (const col of columns) {
      const edited = edits[col.original];
      if (edited && edited !== col.original) {
        renames[col.original] = edited;
      }
    }
    onConfirm(renames);
  }, [columns, edits, onConfirm]);

  const hasChanges = columns.some(c => edits[c.original] !== c.original);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-500" />
              Review Column Names
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              AI-suggested explicit names for <span className="font-medium">{filename}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Column list */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr,24px,1fr,32px] gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>Original</span>
              <span />
              <span>New Name</span>
              <span />
            </div>

            {columns.map((col) => {
              const edited = edits[col.original] || '';
              const isChanged = edited !== col.original;
              const isDefault = edited === col.suggested;

              return (
                <div
                  key={col.original}
                  className={`grid grid-cols-[1fr,24px,1fr,32px] gap-2 items-center px-2 py-2 rounded-lg transition-colors ${
                    isChanged
                      ? 'bg-cyan-50/50 dark:bg-cyan-900/10'
                      : 'bg-slate-50 dark:bg-slate-700/30'
                  }`}
                >
                  {/* Original column name */}
                  <div className="min-w-0">
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
                      {col.original}
                    </code>
                    {col.sample_values.length > 0 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        e.g. {col.sample_values.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isChanged ? 'text-cyan-500' : 'text-slate-300 dark:text-slate-600'
                  }`} />

                  {/* Editable suggested name */}
                  <input
                    type="text"
                    value={edited}
                    onChange={(e) => handleChange(col.original, e.target.value)}
                    className={`w-full px-2 py-1 text-xs font-mono rounded border transition-colors ${
                      isChanged
                        ? 'border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    } focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500`}
                  />

                  {/* Reset button */}
                  {!isDefault && (
                    <button
                      onClick={() => handleReset(col.original, col.suggested)}
                      title="Reset to AI suggestion"
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isDefault && <span className="w-[22px]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            {hasChanges
              ? `${columns.filter(c => edits[c.original] !== c.original).length} column(s) will be renamed`
              : 'No changes — original names will be used'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              Confirm & Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
