'use client';

import { useState, useCallback } from 'react';
import {
  RefreshCw, Layers, FileText, ChevronDown, ChevronRight,
  GitMerge, CheckCircle2, X, AlertTriangle, Eye
} from 'lucide-react';

interface MergeCandidate {
  document_id: number;
  title: string;
  filename: string;
  chunk_count: number;
  product: string | null;
  doc_type: string | null;
  device_model: string | null;
}

interface MergeGroup {
  group_key: string;
  product: string | null;
  doc_type: string | null;
  device_model: string | null;
  document_count: number;
  total_chunks: number;
  documents: MergeCandidate[];
}

interface MergePreview {
  merged_title: string;
  merged_description: string;
  total_chunks_before: number;
  estimated_chunks_after: number;
  duplicate_chunks: number;
  source_urls: string[];
  documents_to_delete: number[];
  group: MergeGroup;
}

interface MergeResult {
  new_document_id: number;
  merged_title: string;
  documents_merged: number;
  chunks_before: number;
  chunks_after: number;
  duplicates_removed: number;
  duration_ms: number;
}

interface MergeTabProps {
  onSuccess?: () => void;
}

export default function MergeTab({ onSuccess }: MergeTabProps) {
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection and preview state
  const [selectedGroup, setSelectedGroup] = useState<MergeGroup | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [customTitle, setCustomTitle] = useState('');

  // Options
  const [minDocuments, setMinDocuments] = useState(2);

  const findCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGroups([]);
    setSelectedGroup(null);
    setPreview(null);

    try {
      const response = await fetch(`/api/knowledge/merge/candidates?min_documents=${minDocuments}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to find candidates');
      }

      const data: MergeGroup[] = await response.json();
      setGroups(data);

      if (data.length === 0) {
        setSuccess('No merge candidates found. Documents are already well-organized!');
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find candidates');
    } finally {
      setLoading(false);
    }
  }, [minDocuments]);

  const previewMerge = async (group: MergeGroup) => {
    setSelectedGroup(group);
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const documentIds = group.documents.map(d => d.document_id);
      const response = await fetch('/api/knowledge/merge/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document_ids: documentIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to preview merge');
      }

      const data: MergePreview = await response.json();
      setPreview(data);
      setCustomTitle(data.merged_title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview merge');
    } finally {
      setLoading(false);
    }
  };

  const executeMerge = async () => {
    if (!preview || !selectedGroup) return;

    setMerging(true);
    setError(null);

    try {
      const documentIds = selectedGroup.documents.map(d => d.document_id);
      const response = await fetch('/api/knowledge/merge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          document_ids: documentIds,
          merged_title: customTitle || preview.merged_title,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Merge failed');
      }

      const result: MergeResult = await response.json();

      setSuccess(
        `Merged ${result.documents_merged} documents into "${result.merged_title}". ` +
        `${result.duplicates_removed} duplicate chunks removed.`
      );

      // Clear state and refresh
      setSelectedGroup(null);
      setPreview(null);
      setGroups(prev => prev.filter(g => g.group_key !== selectedGroup.group_key));

      onSuccess?.();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const closePreview = () => {
    setSelectedGroup(null);
    setPreview(null);
    setCustomTitle('');
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Document Merge</h2>
                <p className="text-xs text-slate-500">Consolidate related documents by device model or topic</p>
              </div>
            </div>
          </div>
          <button
            onClick={findCandidates}
            disabled={loading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && !preview ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                Find Candidates
              </>
            )}
          </button>
        </div>

        {/* Options */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Min documents per group:</span>
              <input
                type="number"
                min="2"
                max="10"
                value={minDocuments}
                onChange={(e) => setMinDocuments(parseInt(e.target.value) || 2)}
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

      {/* Preview Modal */}
      {preview && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border-2 border-violet-500 dark:border-violet-400 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-violet-500" />
              Merge Preview
            </h3>
            <button onClick={closePreview} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Preview Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{preview.total_chunks_before}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Chunks Before</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{preview.estimated_chunks_after}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Chunks After</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{preview.duplicate_chunks}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Duplicates</p>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Merged Document Title
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              placeholder={preview.merged_title}
            />
          </div>

          {/* Documents to Merge */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Documents to merge ({preview.group.document_count}):
            </p>
            <div className="space-y-1 max-h-40 overflow-auto">
              {preview.group.documents.map(doc => (
                <div
                  key={doc.document_id}
                  className="flex items-center justify-between py-1 px-2 bg-slate-50 dark:bg-slate-800/50 rounded text-xs"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate">{doc.title}</span>
                  <span className="text-slate-500 flex-shrink-0 ml-2">{doc.chunk_count} chunks</span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              This will delete the original {preview.group.document_count} documents and create a new consolidated document.
              This action cannot be undone.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={closePreview}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeMerge}
              disabled={merging}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {merging ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4" />
                  Execute Merge
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Merge Groups List */}
      {groups.length > 0 && !preview && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              Merge Candidates ({groups.length} groups)
            </h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {groups.map(group => (
              <div key={group.group_key} className="p-3">
                <button
                  onClick={() => toggleGroup(group.group_key)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(group.group_key) ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 text-xs font-medium rounded">
                        {group.device_model || 'Unknown'}
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {group.document_count} documents
                      </span>
                      <span className="text-xs text-slate-500">
                        ({group.total_chunks} chunks)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      previewMerge(group);
                    }}
                    disabled={loading}
                    className="px-3 py-1 bg-violet-100 dark:bg-violet-500/20 hover:bg-violet-200 dark:hover:bg-violet-500/30 text-violet-700 dark:text-violet-400 text-xs font-medium rounded transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                </button>

                {expandedGroups.has(group.group_key) && (
                  <div className="mt-2 ml-6 space-y-1">
                    {group.documents.map(doc => (
                      <div
                        key={doc.document_id}
                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/30 rounded"
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div className="flex-grow min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.device_model && (
                              <span className="text-[10px] text-slate-500">{doc.device_model}</span>
                            )}
                            <span className="text-[10px] text-slate-400">{doc.chunk_count} chunks</span>
                          </div>
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

      {/* Empty State */}
      {!groups.length && !loading && !preview && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Find Merge Candidates</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click &quot;Find Candidates&quot; to scan for documents that can be consolidated
          </p>
        </div>
      )}

      {/* No Candidates Found */}
      {groups.length === 0 && !loading && !preview && success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Documents Well Organized!</h3>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
            No documents found that need to be merged.
          </p>
        </div>
      )}
    </div>
  );
}
