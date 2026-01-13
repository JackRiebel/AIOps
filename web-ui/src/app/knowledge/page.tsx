'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Search, Sparkles, Filter, ThumbsUp, ThumbsDown, BookOpen, FileText } from 'lucide-react';

interface SearchResult {
  id: number;
  content: string;
  document_filename: string;
  document_title: string | null;
  document_type: string;
  document_product: string | null;
  relevance: number;
}

interface AIResponse {
  response: string;
  sources: Array<{
    document: string;
    chunk_id: number;
    relevance: number;
  }>;
  confidence: number;
}

// Document type options with colors
const DOC_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  'api_spec': { label: 'API', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  'guide': { label: 'Guide', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  'datasheet': { label: 'Datasheet', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  'cli_reference': { label: 'CLI', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  'cvd': { label: 'CVD', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  'troubleshooting': { label: 'Troubleshoot', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
};

// Product options
const PRODUCTS: Record<string, string> = {
  'meraki': 'Meraki',
  'catalyst': 'Catalyst',
  'ios-xe': 'IOS-XE',
  'ise': 'ISE',
  'thousandeyes': 'ThousandEyes',
  'general': 'General',
};

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [askingAI, setAskingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDocType, setFilterDocType] = useState<string>('');
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'up' | 'down'>>({});
  const [aiResponseFeedback, setAiResponseFeedback] = useState<'up' | 'down' | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setAiResponse(null);
    setAiResponseFeedback(null);

    try {
      const results = await apiClient.searchKnowledge({
        query: query.trim(),
        top_k: 10,
        filters: {
          doc_type: filterDocType || undefined,
          product: filterProduct || undefined,
        },
      });
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, filterDocType, filterProduct]);

  // Handle AI query
  const handleAskAI = useCallback(async () => {
    if (!query.trim()) return;

    setAskingAI(true);
    setError(null);

    try {
      const response = await apiClient.queryKnowledge({
        query: query.trim(),
        top_k: 8,
        filters: {
          doc_type: filterDocType || undefined,
          product: filterProduct || undefined,
        },
      });
      setAiResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI query failed');
    } finally {
      setAskingAI(false);
    }
  }, [query, filterDocType, filterProduct]);

  // Handle keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleAskAI();
      } else {
        handleSearch();
      }
    }
  };

  // Handle feedback
  const handleResultFeedback = async (resultId: number, feedback: 'up' | 'down') => {
    setFeedbackGiven(prev => ({ ...prev, [resultId]: feedback }));
    try {
      await apiClient.submitKnowledgeFeedback({
        query: query,
        feedback_type: feedback === 'up' ? 'positive' : 'negative',
        feedback_target: 'search_result',
        chunk_id: resultId,
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleAIFeedback = async (feedback: 'up' | 'down') => {
    setAiResponseFeedback(feedback);
    try {
      await apiClient.submitKnowledgeFeedback({
        query: query,
        feedback_type: feedback === 'up' ? 'positive' : 'negative',
        feedback_target: 'ai_answer',
        metadata: {
          confidence: aiResponse?.confidence,
          source_count: aiResponse?.sources?.length || 0,
        },
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  // Get doc type badge
  const getDocTypeBadge = (docType: string) => {
    const type = DOC_TYPES[docType];
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${type?.bg || 'bg-slate-100 dark:bg-slate-700'} ${type?.color || 'text-slate-600 dark:text-slate-400'}`}>
        {type?.label || docType}
      </span>
    );
  };

  // Get product badge
  const getProductBadge = (product: string | null) => {
    if (!product) return null;
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
        {PRODUCTS[product] || product}
      </span>
    );
  };

  // Get relevance indicator
  const getRelevanceIndicator = (relevance: number) => {
    const pct = Math.round(relevance * 100);
    const color = relevance >= 0.8 ? 'bg-emerald-500' : relevance >= 0.5 ? 'bg-amber-500' : 'bg-slate-400';
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">{pct}%</span>
      </div>
    );
  };

  const hasActiveFilters = filterDocType || filterProduct;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center" aria-hidden="true">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Knowledge Base</h1>
              <p className="text-xs text-slate-500">Search Cisco documentation and guides</p>
            </div>
          </div>
          <div className="text-xs text-slate-400" aria-hidden="true">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">Enter</kbd> search
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">Shift+Enter</kbd> ask AI
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mb-4" role="search">
          <label htmlFor="knowledge-search" className="sr-only">Search knowledge base</label>
          <div className="flex items-center">
            <div className="flex-grow flex items-center">
              <Search className="w-4 h-4 text-slate-400 ml-3" aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="knowledge-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for configurations, troubleshooting guides, API docs..."
                className="flex-grow px-3 py-2.5 bg-transparent border-0 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center border-l border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                aria-label={`${showFilters ? 'Hide' : 'Show'} filters${hasActiveFilters ? ' (filters active)' : ''}`}
                className={`px-3 py-2.5 text-sm flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset ${
                  hasActiveFilters
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!query.trim() || searching}
                aria-label={searching ? 'Searching' : 'Search knowledge base'}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset"
              >
                {searching ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Search
              </button>
              <button
                type="button"
                onClick={handleAskAI}
                disabled={!query.trim() || askingAI}
                aria-label={askingAI ? 'Asking AI' : 'Ask AI assistant'}
                className="px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-r-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                {askingAI ? (
                  <div className="w-3.5 h-3.5 border-2 border-purple-300 border-t-white rounded-full animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Ask AI
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2" role="group" aria-label="Search filters">
              <label htmlFor="filter-doc-type" className="sr-only">Filter by document type</label>
              <select
                id="filter-doc-type"
                value={filterDocType}
                onChange={(e) => setFilterDocType(e.target.value)}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">All Types</option>
                {Object.entries(DOC_TYPES).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <label htmlFor="filter-product" className="sr-only">Filter by product</label>
              <select
                id="filter-product"
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">All Products</option>
                {Object.entries(PRODUCTS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => { setFilterDocType(''); setFilterProduct(''); }}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="mb-4 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg flex items-center gap-2 text-sm text-rose-700 dark:text-rose-400">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <section aria-label="AI Answer" className="mb-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-500/30 overflow-hidden">
            <div className="px-3 py-2 bg-purple-100/50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">AI Answer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  aiResponse.confidence >= 0.8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  aiResponse.confidence >= 0.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`} role="status" aria-label={`Confidence level: ${Math.round(aiResponse.confidence * 100)} percent`}>
                  {Math.round(aiResponse.confidence * 100)}% confidence
                </span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {aiResponse.response}
              </p>

              {/* Sources */}
              {aiResponse.sources && aiResponse.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-500/30">
                  <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1.5">Sources</p>
                  <div className="flex flex-wrap gap-1.5" role="list" aria-label="Source documents">
                    {aiResponse.sources.slice(0, 3).map((source, idx) => (
                      <span key={idx} role="listitem" className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 border border-purple-200 dark:border-purple-500/30">
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        {source.document || 'Untitled'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-500/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Was this helpful?</span>
                <div className="flex items-center gap-1" role="group" aria-label="Rate this answer">
                  <button
                    type="button"
                    onClick={() => handleAIFeedback('up')}
                    aria-label="Helpful"
                    aria-pressed={aiResponseFeedback === 'up'}
                    className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      aiResponseFeedback === 'up'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAIFeedback('down')}
                    aria-label="Not helpful"
                    aria-pressed={aiResponseFeedback === 'down'}
                    className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      aiResponseFeedback === 'down'
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <section aria-label="Search results">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300" aria-live="polite">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="space-y-2" role="list">
              {searchResults.map((result) => (
                <article
                  key={result.id}
                  role="listitem"
                  className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-cyan-300 dark:hover:border-cyan-600 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getDocTypeBadge(result.document_type)}
                      {getProductBadge(result.document_product)}
                    </div>
                    {getRelevanceIndicator(result.relevance)}
                  </div>

                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1.5 line-clamp-1">
                    {result.document_title || result.document_filename}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {result.content}
                  </p>

                  {/* Feedback */}
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <span className="text-[10px] text-slate-400">Relevant?</span>
                    <div className="flex items-center gap-1" role="group" aria-label="Rate this result">
                      <button
                        type="button"
                        onClick={() => handleResultFeedback(result.id, 'up')}
                        aria-label="Relevant"
                        aria-pressed={feedbackGiven[result.id] === 'up'}
                        className={`p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          feedbackGiven[result.id] === 'up'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResultFeedback(result.id, 'down')}
                        aria-label="Not relevant"
                        aria-pressed={feedbackGiven[result.id] === 'down'}
                        className={`p-0.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          feedbackGiven[result.id] === 'down'
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!searching && searchResults.length === 0 && !aiResponse && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
              <BookOpen className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Search the Knowledge Base
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
              Find documentation for Meraki, Catalyst, ISE, and more. Use the search bar above or ask the AI assistant.
            </p>

            {/* Example queries */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Try searching for</p>
              <div className="flex flex-wrap justify-center gap-1.5" role="list" aria-label="Example search queries">
                {[
                  'Configure VLANs on Meraki',
                  'Catalyst API authentication',
                  'ISE guest portal',
                  'Troubleshoot wireless',
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    role="listitem"
                    onClick={() => {
                      setQuery(example);
                      searchInputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-600 dark:text-slate-400 hover:border-cyan-300 dark:hover:border-cyan-600 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
