'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, X } from 'lucide-react';
import type { ColumnRenameSuggestion } from './types';
import { ColumnRenameOverlay } from './ColumnRenameOverlay';

interface DatasetUploadProps {
  onUploadComplete: () => void;
}

export function DatasetUpload({ onUploadComplete }: DatasetUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Two-step state: pending file + column suggestions
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [columnSuggestions, setColumnSuggestions] = useState<ColumnRenameSuggestion[] | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setAnalyzing(true);
    setPendingFile(file);
    setColumnSuggestions(null);

    // Step 1: Analyze columns via LLM
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/structured-data/datasets/analyze-columns', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || `Analysis failed (${resp.status})`);
      }

      const data = await resp.json();
      setColumnSuggestions(data.columns);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Column analysis failed');
      setPendingFile(null);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleConfirmUpload = useCallback(async (renames: Record<string, string>) => {
    if (!pendingFile) return;
    setColumnSuggestions(null);
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', pendingFile);
    if (datasetName.trim()) {
      formData.append('name', datasetName.trim());
    }
    // Only send renames if there are actual changes
    if (Object.keys(renames).length > 0) {
      formData.append('column_renames', JSON.stringify(renames));
    }

    try {
      const resp = await fetch('/api/structured-data/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${resp.status})`);
      }

      setDatasetName('');
      setPendingFile(null);
      onUploadComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [pendingFile, datasetName, onUploadComplete]);

  const handleCancelRename = useCallback(() => {
    setColumnSuggestions(null);
    setPendingFile(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const isBusy = analyzing || uploading;

  return (
    <>
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
          Upload Dataset
        </h3>

        <div className="mb-3">
          <input
            type="text"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="Dataset name (optional)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
          />
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isBusy ? 'cursor-wait' : 'cursor-pointer'
          } ${
            isDragging
              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          {analyzing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Analyzing columns with AI...</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Suggesting explicit column names</p>
            </div>
          ) : uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Uploading and processing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Supports .xlsx, .xls, .csv (max 100 MB)
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}
      </div>

      {/* Column rename overlay */}
      {columnSuggestions && pendingFile && (
        <ColumnRenameOverlay
          filename={pendingFile.name}
          columns={columnSuggestions}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelRename}
        />
      )}
    </>
  );
}
