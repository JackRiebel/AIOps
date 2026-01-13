'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText, ExternalLink, Sparkles, Zap, RefreshCw, Globe } from 'lucide-react';
import { AgenticRAGPipeline } from './AgenticRAGPipeline';

export interface Citation {
  index: number;
  chunk_id: number;
  document_id: number;
  title: string;
  section?: string;
  quote?: string;
  relevance: number;
}

export interface AgenticRAGMetrics {
  enabled: boolean;
  iterations: number;
  agents_used: string[];
  query_type?: string;
  quality?: string;
  latency_ms?: number;
  web_search_used?: boolean;
}

interface CitationsDisplayProps {
  citations: Citation[];
  className?: string;
  agenticRag?: AgenticRAGMetrics;
  showPipeline?: boolean;
}

export function CitationsDisplay({ citations, className = '', agenticRag, showPipeline = true }: CitationsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) {
    return null;
  }

  // Quality badge color
  const qualityColor = agenticRag?.quality === 'EXCELLENT'
    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10'
    : agenticRag?.quality === 'GOOD'
    ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10'
    : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10';

  return (
    <div className={`mt-4 ${className}`}>
      {/* Agentic RAG Badge */}
      {agenticRag?.enabled && (
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
            <Sparkles className="w-3 h-3" />
            Agentic RAG
          </span>
          {agenticRag.query_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
              <Zap className="w-3 h-3" />
              {agenticRag.query_type}
            </span>
          )}
          {agenticRag.iterations > 1 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
              <RefreshCw className="w-3 h-3" />
              {agenticRag.iterations} iterations
            </span>
          )}
          {agenticRag.web_search_used && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Globe className="w-3 h-3" />
              Web search
            </span>
          )}
          {agenticRag.quality && (
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${qualityColor}`}>
              {agenticRag.quality}
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="font-medium">Sources ({citations.length})</span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Collapsed: Show citation numbers inline */}
      {!isExpanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {citations.map((citation) => (
            <span
              key={citation.index}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
              title={citation.title}
            >
              [{citation.index}] {citation.title.slice(0, 20)}
              {citation.title.length > 20 ? '...' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: Show full citation details */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {citations.map((citation) => (
            <div
              key={citation.index}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
            >
              {/* Citation number badge */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold">
                {citation.index}
              </div>

              <div className="flex-1 min-w-0">
                {/* Title and section */}
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {citation.title}
                  </span>
                  {citation.section && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      - {citation.section}
                    </span>
                  )}
                </div>

                {/* Quote preview */}
                {citation.quote && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                    "{citation.quote}"
                  </p>
                )}

                {/* Relevance indicator */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                      style={{ width: `${Math.min(citation.relevance * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    {(citation.relevance * 100).toFixed(0)}% match
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agentic RAG Pipeline Visualization */}
      {showPipeline && agenticRag?.enabled && (
        <AgenticRAGPipeline metrics={agenticRag} />
      )}
    </div>
  );
}

// Inline citation reference component (for use in markdown)
export function CitationRef({ index, title }: { index: number; title?: string }) {
  return (
    <sup
      className="inline-flex items-center justify-center w-4 h-4 ml-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 cursor-help"
      title={title || `Source ${index}`}
    >
      {index}
    </sup>
  );
}

export default CitationsDisplay;
