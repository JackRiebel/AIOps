'use client';

import React, { memo, useState } from 'react';
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BookOpen,
  FileSpreadsheet,
  FileCheck,
  HelpCircle,
  Search,
} from 'lucide-react';

export interface KnowledgeDocument {
  id: string;
  title: string;
  excerpt: string;
  relevance: number;
  doc_type: 'datasheet' | 'guide' | 'cvd' | 'whitepaper' | 'faq' | 'document';
  url?: string;
  document_id?: number;
}

export interface KnowledgeSourcesData {
  query: string;
  documents: KnowledgeDocument[];
}

const docTypeIcons: Record<string, React.ElementType> = {
  datasheet: FileSpreadsheet,
  guide: BookOpen,
  cvd: FileCheck,
  whitepaper: FileText,
  faq: HelpCircle,
  document: FileText,
};

const docTypeLabels: Record<string, string> = {
  datasheet: 'Datasheet',
  guide: 'Guide',
  cvd: 'CVD',
  whitepaper: 'Whitepaper',
  faq: 'FAQ',
  document: 'Document',
};

interface SourceDocumentItemProps {
  doc: KnowledgeDocument;
  onView?: () => void;
}

const SourceDocumentItem = memo(({ doc, onView }: SourceDocumentItemProps) => {
  const [copied, setCopied] = useState(false);
  const Icon = docTypeIcons[doc.doc_type] || FileText;
  const relevancePercent = Math.round(doc.relevance * 100);

  const handleCopyLink = async () => {
    if (doc.url) {
      await navigator.clipboard.writeText(doc.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.8) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20';
    if (relevance >= 0.6) return 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/20';
    if (relevance >= 0.4) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20';
    return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/20';
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {doc.title}
            </h4>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRelevanceColor(doc.relevance)}`}>
              {relevancePercent}%
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
            {doc.excerpt}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              {docTypeLabels[doc.doc_type] || 'Document'}
            </span>

            <div className="flex-1" />

            {onView && (
              <button
                onClick={onView}
                className="px-2 py-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded transition-colors flex items-center gap-1"
              >
                <Search className="w-3 h-3" />
                View
              </button>
            )}

            {doc.url && (
              <>
                <button
                  onClick={handleCopyLink}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                  title="Copy link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors"
                  title="Open source"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

SourceDocumentItem.displayName = 'SourceDocumentItem';

export const KnowledgeSourcesCard = memo(({ data, config }: { data: KnowledgeSourcesData; config?: Record<string, unknown> }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  if (!data?.documents?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <FileText className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No sources found</p>
      </div>
    );
  }

  const visibleDocs = expanded ? data.documents : data.documents.slice(0, 3);
  const hasMore = data.documents.length > 3;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-500" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Source Documents
            </h3>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {data.documents.length} sources
          </span>
        </div>
        {data.query && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
            &ldquo;{data.query}&rdquo;
          </p>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {visibleDocs.map((doc) => (
          <SourceDocumentItem
            key={doc.id}
            doc={doc}
            onView={doc.document_id ? () => setSelectedDoc(doc.id) : undefined}
          />
        ))}
      </div>

      {/* Expand/Collapse */}
      {hasMore && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show All {data.documents.length} Sources
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

KnowledgeSourcesCard.displayName = 'KnowledgeSourcesCard';
