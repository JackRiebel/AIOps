'use client';

import { useState } from 'react';
import { Database, Trash2, Eye, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DatasetInfo } from './types';

interface DatasetListProps {
  datasets: DatasetInfo[];
  selectedDatasetId: number | null;
  onSelect: (dataset: DatasetInfo) => void;
  onDelete: (id: number) => void;
  onPreview: (id: number) => void;
}

export function DatasetList({ datasets, selectedDatasetId, onSelect, onDelete, onPreview }: DatasetListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this dataset? This will drop the data table and cannot be undone.')) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (datasets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-8 text-center">
        <Database className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">No datasets uploaded yet</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload a CSV or Excel file to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {datasets.map((d) => (
        <div
          key={d.id}
          onClick={() => d.status === 'ready' && onSelect(d)}
          className={`bg-white dark:bg-slate-800/60 rounded-xl border p-4 transition-all ${
            selectedDatasetId === d.id
              ? 'border-cyan-500 ring-1 ring-cyan-500/30'
              : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
          } ${d.status === 'ready' ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.name}</h4>
                {d.status === 'ready' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                {d.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-cyan-500 animate-spin flex-shrink-0" />}
                {d.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {d.source_filename} &middot; {d.row_count?.toLocaleString()} rows &middot; {d.column_count} columns
              </p>
              {d.error_message && (
                <p className="text-xs text-red-500 mt-1 truncate">{d.error_message}</p>
              )}
              {d.schema_info && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(d.schema_info.columns || {}).slice(0, 6).map(([col, info]) => (
                    <span
                      key={col}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded"
                    >
                      {col}
                      <span className="text-slate-400 dark:text-slate-500 ml-0.5">
                        {info.type === 'TEXT' ? 'T' : info.type === 'TIMESTAMP' ? 'ts' : '#'}
                      </span>
                    </span>
                  ))}
                  {Object.keys(d.schema_info.columns || {}).length > 6 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-slate-400">
                      +{Object.keys(d.schema_info.columns).length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {d.status === 'ready' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(d.id); }}
                  className="p-1.5 text-slate-400 hover:text-cyan-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  title="Preview data"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                disabled={deletingId === d.id}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                title="Delete dataset"
              >
                {deletingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
