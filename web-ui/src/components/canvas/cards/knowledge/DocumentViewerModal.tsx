'use client';

import React, { memo, useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  X,
  Calendar,
  Tag,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface DocumentContent {
  id: number;
  title: string;
  doc_type: string;
  source_url?: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface DocumentViewerModalProps {
  documentId: number | string;
  onClose: () => void;
}

export const DocumentViewerModal = memo(({ documentId, onClose }: DocumentViewerModalProps) => {
  const [document, setDocument] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/knowledge/documents/${documentId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load document');
        }

        const doc = await response.json();
        setDocument(doc);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  const handleCopy = useCallback(async () => {
    if (document?.content) {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [document?.content]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const docTypeColors: Record<string, string> = {
    datasheet: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    guide: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    cvd: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
    whitepaper: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    faq: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isExpanded
            ? 'w-full h-full max-w-none max-h-none'
            : 'max-w-4xl w-full max-h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              <span className="text-sm text-slate-500">Loading document...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-500">
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">Error loading document</span>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                {document?.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {document?.doc_type && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${docTypeColors[document.doc_type] || 'bg-slate-100 text-slate-600'}`}>
                    {document.doc_type.toUpperCase()}
                  </span>
                )}
                {document?.created_at && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(document.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 ml-4">
            {!loading && !error && (
              <>
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Copy content"
                >
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
                {document?.source_url && (
                  <a
                    href={document.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Open original source"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title={isExpanded ? "Minimize" : "Maximize"}
                >
                  {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading document content...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-base font-medium text-red-500 mb-2">{error}</p>
              <p className="text-sm text-slate-500">Please try again or contact support if the issue persists.</p>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {document?.content.split('\n\n').map((paragraph, idx) => (
                <p key={idx} className="text-base text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && document?.metadata && Object.keys(document.metadata).length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Metadata:</span>
              {Object.entries(document.metadata)
                .filter(([key]) => !['source_url', 'doc_type', 'title'].includes(key))
                .slice(0, 5)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DocumentViewerModal.displayName = 'DocumentViewerModal';
