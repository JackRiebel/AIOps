'use client';

import { useState, useCallback } from 'react';
import {
  RefreshCw, Trash2, AlertTriangle, CheckCircle2, Copy, FileText,
  ChevronDown, ChevronRight, Shield, Sparkles, X
} from 'lucide-react';

interface ChunkInfo {
  id: number;
  document_id: number;
  document_filename: string;
  content_preview: string;
  content_length: number;
  quality_score: number | null;
  chunk_index: number;
}

interface DuplicateGroup {
  similarity: number;
  keep_chunk: ChunkInfo;
  remove_chunks: ChunkInfo[];
}

interface LowQualityChunk {
  chunk: ChunkInfo;
  quality_score: number;
  reason: string;
}

interface HygieneReport {
  analyzed_at: string;
  total_chunks: number;
  total_documents: number;
  duplicate_groups: DuplicateGroup[];
  low_quality_chunks: LowQualityChunk[];
  orphaned_chunk_ids: number[];
  duplicate_count: number;
  low_quality_count: number;
  orphaned_count: number;
}

interface CleanupResult {
  success: boolean;
  chunks_deleted: number;
  documents_affected: number;
  errors: string[];
}

interface HygieneTabProps {
  onSuccess?: () => void;
}

export default function HygieneTab({ onSuccess }: HygieneTabProps) {
  const [report, setReport] = useState<HygieneReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection state
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());
  const [selectedLowQuality, setSelectedLowQuality] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Analysis options
  const [options, setOptions] = useState({
    check_duplicates: true,
    check_quality: true,
    check_orphans: true,
    duplicate_threshold: 0.9,
    min_quality_score: 0.3,
  });

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setReport(null);
    setSelectedDuplicates(new Set());
    setSelectedLowQuality(new Set());

    try {
      const response = await fetch('/api/knowledge/hygiene/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Analysis failed');
      }

      const data = await response.json();
      setReport(data);

      // Auto-select all removable chunks
      const dupIds = new Set<number>();
      data.duplicate_groups.forEach((g: DuplicateGroup) => {
        g.remove_chunks.forEach((c: ChunkInfo) => dupIds.add(c.id));
      });
      setSelectedDuplicates(dupIds);

      const lqIds = new Set<number>();
      data.low_quality_chunks.forEach((lq: LowQualityChunk) => lqIds.add(lq.chunk.id));
      setSelectedLowQuality(lqIds);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [options]);

  const applyCleanup = async () => {
    if (!report) return;

    const actions: Array<{
      action: string;
      target_id: number;
      reason: string;
      issue_type: string;
    }> = [];

    // Build cleanup actions from selections
    report.duplicate_groups.forEach(group => {
      group.remove_chunks.forEach(chunk => {
        if (selectedDuplicates.has(chunk.id)) {
          actions.push({
            action: 'delete_chunk',
            target_id: chunk.id,
            reason: `Duplicate of chunk ${group.keep_chunk.id} (${Math.round(group.similarity * 100)}% similar)`,
            issue_type: 'duplicate',
          });
        }
      });
    });

    report.low_quality_chunks.forEach(lq => {
      if (selectedLowQuality.has(lq.chunk.id)) {
        actions.push({
          action: 'delete_chunk',
          target_id: lq.chunk.id,
          reason: lq.reason,
          issue_type: 'low_quality',
        });
      }
    });

    // Add orphans
    report.orphaned_chunk_ids.forEach(id => {
      actions.push({
        action: 'delete_chunk',
        target_id: id,
        reason: 'Orphaned chunk (no parent document)',
        issue_type: 'orphaned',
      });
    });

    if (actions.length === 0) {
      setError('No items selected for cleanup');
      return;
    }

    setCleaning(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge/hygiene/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actions }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Cleanup failed');
      }

      const result: CleanupResult = await response.json();

      if (result.success) {
        setSuccess(`Cleanup complete: ${result.chunks_deleted} chunks deleted, ${result.documents_affected} documents affected`);
        setReport(null);
        onSuccess?.();
      } else {
        setError(`Cleanup completed with errors: ${result.errors.join(', ')}`);
      }

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  const toggleGroup = (index: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleDuplicateSelection = (chunkId: number) => {
    setSelectedDuplicates(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  };

  const toggleLowQualitySelection = (chunkId: number) => {
    setSelectedLowQuality(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  };

  const selectAllDuplicates = () => {
    if (!report) return;
    const ids = new Set<number>();
    report.duplicate_groups.forEach(g => g.remove_chunks.forEach(c => ids.add(c.id)));
    setSelectedDuplicates(ids);
  };

  const selectAllLowQuality = () => {
    if (!report) return;
    const ids = new Set<number>();
    report.low_quality_chunks.forEach(lq => ids.add(lq.chunk.id));
    setSelectedLowQuality(ids);
  };

  const totalSelected = selectedDuplicates.size + selectedLowQuality.size + (report?.orphaned_chunk_ids.length || 0);

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Knowledge Base Hygiene</h2>
                <p className="text-xs text-slate-500">Find and remove duplicates, low-quality chunks, and orphans</p>
              </div>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Options */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={options.check_duplicates}
                onChange={(e) => setOptions(prev => ({ ...prev, check_duplicates: e.target.checked }))}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Check Duplicates</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={options.check_quality}
                onChange={(e) => setOptions(prev => ({ ...prev, check_quality: e.target.checked }))}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Check Quality</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={options.check_orphans}
                onChange={(e) => setOptions(prev => ({ ...prev, check_orphans: e.target.checked }))}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Check Orphans</span>
            </label>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Similarity:</span>
              <input
                type="number"
                min="0.5"
                max="1.0"
                step="0.05"
                value={options.duplicate_threshold}
                onChange={(e) => setOptions(prev => ({ ...prev, duplicate_threshold: parseFloat(e.target.value) }))}
                className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Min Quality:</span>
              <input
                type="number"
                min="0.0"
                max="1.0"
                step="0.1"
                value={options.min_quality_score}
                onChange={(e) => setOptions(prev => ({ ...prev, min_quality_score: parseFloat(e.target.value) }))}
                className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg flex items-center justify-between">
          <span className="text-xs text-emerald-700 dark:text-emerald-400">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{report.total_chunks}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Chunks</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{report.duplicate_count}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Duplicates</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <div>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{report.low_quality_count}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Low Quality</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-lg font-bold text-slate-600 dark:text-slate-400">{report.orphaned_count}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Orphaned</p>
                </div>
              </div>
            </div>
          </div>

          {/* Duplicate Groups */}
          {report.duplicate_groups.length > 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-amber-500" />
                  Duplicate Groups ({report.duplicate_groups.length})
                </h3>
                <button
                  onClick={selectAllDuplicates}
                  className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
                >
                  Select All
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700/50 max-h-80 overflow-auto">
                {report.duplicate_groups.map((group, idx) => (
                  <div key={idx} className="p-3">
                    <button
                      onClick={() => toggleGroup(idx)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(idx) ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {group.remove_chunks.length + 1} chunks ({Math.round(group.similarity * 100)}% similar)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        from {group.keep_chunk.document_filename}
                      </span>
                    </button>

                    {expandedGroups.has(idx) && (
                      <div className="mt-2 ml-6 space-y-2">
                        {/* Keep chunk */}
                        <div className="flex items-start gap-2 p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded border border-emerald-200 dark:border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Keep</span>
                              <span className="text-[10px] text-slate-500">{group.keep_chunk.content_length} chars</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                              {group.keep_chunk.content_preview}
                            </p>
                          </div>
                        </div>

                        {/* Remove chunks */}
                        {group.remove_chunks.map(chunk => (
                          <div
                            key={chunk.id}
                            className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                              selectedDuplicates.has(chunk.id)
                                ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'
                            }`}
                            onClick={() => toggleDuplicateSelection(chunk.id)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedDuplicates.has(chunk.id)}
                              onChange={() => toggleDuplicateSelection(chunk.id)}
                              className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            />
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 uppercase">Remove</span>
                                <span className="text-[10px] text-slate-500">{chunk.content_length} chars</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                {chunk.content_preview}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Quality Chunks */}
          {report.low_quality_chunks.length > 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Low Quality Chunks ({report.low_quality_chunks.length})
                </h3>
                <button
                  onClick={selectAllLowQuality}
                  className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  Select All
                </button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700/50 max-h-80 overflow-auto">
                {report.low_quality_chunks.map(lq => (
                  <div
                    key={lq.chunk.id}
                    className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                      selectedLowQuality.has(lq.chunk.id)
                        ? 'bg-rose-50 dark:bg-rose-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                    onClick={() => toggleLowQualitySelection(lq.chunk.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLowQuality.has(lq.chunk.id)}
                      onChange={() => toggleLowQualitySelection(lq.chunk.id)}
                      className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          lq.quality_score < 0.1
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                            : lq.quality_score < 0.2
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {Math.round(lq.quality_score * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-500">{lq.reason}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">
                        {lq.chunk.content_preview}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {lq.chunk.document_filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orphaned Chunks */}
          {report.orphaned_chunk_ids.length > 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-slate-500" />
                Orphaned Chunks ({report.orphaned_chunk_ids.length})
              </h3>
              <p className="text-xs text-slate-500">
                These chunks have no parent document and will be automatically removed.
              </p>
            </div>
          )}

          {/* Apply Button */}
          {(report.duplicate_count > 0 || report.low_quality_count > 0 || report.orphaned_count > 0) && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{totalSelected} chunks</span>
                <span className="text-slate-500"> selected for removal</span>
              </div>
              <button
                onClick={applyCleanup}
                disabled={cleaning || totalSelected === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {cleaning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Apply Cleanup
                  </>
                )}
              </button>
            </div>
          )}

          {/* No Issues Found */}
          {report.duplicate_count === 0 && report.low_quality_count === 0 && report.orphaned_count === 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20 p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Knowledge Base is Clean!</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                No duplicates, low-quality chunks, or orphans found.
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!report && !analyzing && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Run Analysis</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click Analyze to scan for duplicates, low-quality chunks, and orphans
          </p>
        </div>
      )}
    </div>
  );
}
