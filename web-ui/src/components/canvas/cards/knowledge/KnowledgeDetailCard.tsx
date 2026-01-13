'use client';

import React, { memo, useState, useEffect } from 'react';
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Calendar,
  Tag,
  Loader2,
} from 'lucide-react';

export interface KnowledgeDetailData {
  documentId: number;
  title?: string;
  docType?: string;
}

interface DocumentContent {
  id: number;
  title: string;
  doc_type: string;
  source_url?: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const KnowledgeDetailCard = memo(({ data, config }: { data: KnowledgeDetailData; config?: Record<string, unknown> }) => {
  const [document, setDocument] = useState<DocumentContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!data?.documentId) {
        setError('No document ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/knowledge/documents/${data.documentId}`, {
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
  }, [data?.documentId]);

  const handleCopy = async () => {
    if (document?.content) {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-2" />
        <p className="text-sm text-slate-500">Loading document...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 mb-3 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <FileText className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-500">{error || 'Document not found'}</p>
      </div>
    );
  }

  const docTypeColors: Record<string, string> = {
    datasheet: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    guide: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    cvd: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
    whitepaper: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    faq: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-cyan-500 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {document.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${docTypeColors[document.doc_type] || 'bg-slate-100 text-slate-600'}`}>
                {document.doc_type.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(document.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
              title="Copy content"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {document.source_url && (
              <a
                href={document.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors"
                title="Open original source"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {document.content.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Footer with metadata */}
      {document.metadata && Object.keys(document.metadata).length > 0 && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-slate-400" />
            {Object.entries(document.metadata)
              .filter(([key]) => !['source_url', 'doc_type', 'title'].includes(key))
              .slice(0, 3)
              .map(([key, value]) => (
                <span
                  key={key}
                  className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded"
                >
                  {key}: {String(value)}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});

KnowledgeDetailCard.displayName = 'KnowledgeDetailCard';
