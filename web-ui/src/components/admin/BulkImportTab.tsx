'use client';

import { useState, useCallback } from 'react';
import {
  Search, Download, Check, X, AlertTriangle,
  Globe, FileText, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

// Types
interface DiscoveredURL {
  url: string;
  title: string;
  description: string;
  source: string;
  doc_type_suggestion: string;
  product_suggestion: string;
  relevance_score: number;
  blocked: boolean;
  blocked_reason: string | null;
}

interface ImportProgress {
  current: number;
  total: number;
  results: ImportResult[];
  complete: boolean;
  summary?: {
    success: number;
    duplicates: number;
    errors: number;
  };
}

interface ImportResult {
  url: string;
  status: 'success' | 'duplicate' | 'error';
  title?: string;
  document_id?: number;
  chunk_count?: number;
  error?: string;
}

// Document type and product options
const DOC_TYPES = [
  { value: 'api_spec', label: 'API Spec' },
  { value: 'guide', label: 'Guide' },
  { value: 'datasheet', label: 'Datasheet' },
  { value: 'cli_reference', label: 'CLI Ref' },
  { value: 'cvd', label: 'CVD' },
  { value: 'troubleshooting', label: 'Troubleshoot' },
  { value: 'config_guide', label: 'Config Guide' },
  { value: 'release_notes', label: 'Release Notes' },
];

const PRODUCTS = [
  { value: '', label: 'All Products' },
  { value: 'meraki', label: 'Meraki' },
  { value: 'catalyst', label: 'Catalyst' },
  { value: 'ios-xe', label: 'IOS-XE' },
  { value: 'ise', label: 'ISE' },
  { value: 'thousandeyes', label: 'ThousandEyes' },
  { value: 'dnac', label: 'DNA Center' },
  { value: 'firepower', label: 'Firepower' },
  { value: 'general', label: 'General' },
];

interface BulkImportTabProps {
  onSuccess?: () => void;
}

export default function BulkImportTab({ onSuccess }: BulkImportTabProps) {
  // Phase: discover -> preview -> import
  const [phase, setPhase] = useState<'discover' | 'preview' | 'import'>('discover');

  // Discovery state
  const [query, setQuery] = useState('');
  const [useAiSearch, setUseAiSearch] = useState(true);
  const [useSitemapCrawl, setUseSitemapCrawl] = useState(true);
  const [productFilter, setProductFilter] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [discoveredUrls, setDiscoveredUrls] = useState<DiscoveredURL[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [urlOverrides, setUrlOverrides] = useState<Record<string, { doc_type?: string; product?: string }>>({});
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  // Import state
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // Discover documentation
  const handleDiscover = useCallback(async () => {
    if (!query.trim()) return;

    setDiscovering(true);
    setError(null);

    try {
      const response = await fetch('/api/knowledge/bulk/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: query.trim(),
          max_results: maxResults,
          use_ai_search: useAiSearch,
          use_sitemap_crawl: useSitemapCrawl,
          product_filter: productFilter || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Discovery failed: ${response.status}`);
      }

      const data = await response.json();
      setDiscoveredUrls(data.urls || []);

      // Auto-select non-blocked URLs
      const autoSelected = new Set<string>();
      (data.urls || []).forEach((u: DiscoveredURL) => {
        if (!u.blocked) {
          autoSelected.add(u.url);
        }
      });
      setSelectedUrls(autoSelected);

      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  }, [query, maxResults, useAiSearch, useSitemapCrawl, productFilter]);

  // Toggle URL selection
  const toggleUrl = (url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  // Select all non-blocked
  const selectAll = () => {
    const newSet = new Set<string>();
    discoveredUrls.forEach(u => {
      if (!u.blocked) newSet.add(u.url);
    });
    setSelectedUrls(newSet);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  // Update URL override
  const setUrlOverride = (url: string, field: 'doc_type' | 'product', value: string) => {
    setUrlOverrides(prev => ({
      ...prev,
      [url]: { ...prev[url], [field]: value },
    }));
  };

  // Start import
  const handleImport = useCallback(async () => {
    if (selectedUrls.size === 0) return;

    setPhase('import');
    setImportProgress({ current: 0, total: selectedUrls.size, results: [], complete: false });
    setError(null);

    try {
      // Build URLs to import
      const urlsToImport = discoveredUrls
        .filter(u => selectedUrls.has(u.url))
        .map(u => ({
          url: u.url,
          title: u.title || null,
          doc_type: urlOverrides[u.url]?.doc_type || u.doc_type_suggestion,
          product: urlOverrides[u.url]?.product || u.product_suggestion || null,
        }));

      // Start SSE connection
      const response = await fetch('/api/knowledge/bulk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ urls: urlsToImport }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Import failed: ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'import_start') {
                setImportProgress(prev => prev ? { ...prev, total: event.total } : null);
              } else if (event.type === 'import_progress') {
                setImportProgress(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    current: event.current,
                    results: [...prev.results, {
                      url: event.url,
                      status: event.status,
                      title: event.title,
                      document_id: event.document_id,
                      chunk_count: event.chunk_count,
                      error: event.error,
                    }],
                  };
                });
              } else if (event.type === 'import_complete') {
                setImportProgress(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    complete: true,
                    summary: {
                      success: event.success,
                      duplicates: event.duplicates,
                      errors: event.errors,
                    },
                  };
                });
                // Notify parent of success
                if (onSuccess && event.success > 0) {
                  onSuccess();
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setPhase('preview');
    }
  }, [selectedUrls, discoveredUrls, urlOverrides, onSuccess]);

  // Reset to discover phase
  const resetToDiscover = () => {
    setPhase('discover');
    setDiscoveredUrls([]);
    setSelectedUrls(new Set());
    setUrlOverrides({});
    setImportProgress(null);
    setError(null);
  };

  // Get relevance badge color
  const getRelevanceBadge = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
    if (score >= 0.5) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
  };

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <div className="px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Discovery Phase */}
      {phase === 'discover' && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Discover Documentation</h3>
              <p className="text-xs text-slate-500">Search for Cisco documentation to bulk import</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Search Query
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                placeholder="e.g., MX firewall configuration, Catalyst 9200 stacking, ISE deployment guide"
                className="flex-grow px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleDiscover}
                disabled={!query.trim() || discovering}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                {discovering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Discover
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Product Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Product
              </label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {PRODUCTS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Max Results */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Max Results
              </label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Discovery Methods */}
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Discovery Methods
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={useAiSearch}
                    onChange={(e) => setUseAiSearch(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">AI Search</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={useSitemapCrawl}
                    onChange={(e) => setUseSitemapCrawl(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">Sitemap Crawl</span>
                </label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-300">Note:</strong> Only official Cisco documentation is discovered.
              Blog posts, community forums, and marketing pages are automatically filtered out.
              Rate limited to 2 requests/second to external sites.
            </p>
          </div>
        </div>
      )}

      {/* Preview Phase */}
      {phase === 'preview' && (
        <div className="space-y-3">
          {/* Header */}
          <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Discovered URLs ({discoveredUrls.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedUrls.size} selected for import
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="px-2 py-1 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-2 py-1 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Deselect All
                </button>
                <button
                  onClick={resetToDiscover}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
                >
                  New Search
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedUrls.size === 0}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Import {selectedUrls.size > 0 && `(${selectedUrls.size})`}
                </button>
              </div>
            </div>
          </div>

          {/* URL List */}
          <div className="space-y-2">
            {discoveredUrls.map((url) => (
              <div
                key={url.url}
                className={`bg-white dark:bg-slate-800/50 rounded-lg border transition-colors ${
                  url.blocked
                    ? 'border-rose-200 dark:border-rose-500/30 opacity-60'
                    : selectedUrls.has(url.url)
                    ? 'border-cyan-300 dark:border-cyan-500/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Main row */}
                <div className="p-3 flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    {url.blocked ? (
                      <div className="w-4 h-4 rounded border border-rose-300 bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                        <X className="w-3 h-3 text-rose-500" />
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedUrls.has(url.url)}
                        onChange={() => toggleUrl(url.url)}
                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {url.title || 'Untitled'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getRelevanceBadge(url.relevance_score)}`}>
                        {Math.round(url.relevance_score * 100)}%
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        url.source === 'ai_search'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                      }`}>
                        {url.source === 'ai_search' ? 'AI' : 'Sitemap'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mb-1">
                      {url.url}
                    </p>
                    {url.blocked && (
                      <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="text-[10px]">{url.blocked_reason}</span>
                      </div>
                    )}
                    {url.description && !url.blocked && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">{url.description}</p>
                    )}
                  </div>

                  {/* Expand button */}
                  {!url.blocked && (
                    <button
                      onClick={() => setExpandedUrl(expandedUrl === url.url ? null : url.url)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {expandedUrl === url.url ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded options */}
                {expandedUrl === url.url && !url.blocked && (
                  <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-slate-700/50 ml-7">
                    <div className="flex gap-3 mt-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Document Type
                        </label>
                        <select
                          value={urlOverrides[url.url]?.doc_type || url.doc_type_suggestion}
                          onChange={(e) => setUrlOverride(url.url, 'doc_type', e.target.value)}
                          className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          {DOC_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Product
                        </label>
                        <select
                          value={urlOverrides[url.url]?.product || url.product_suggestion}
                          onChange={(e) => setUrlOverride(url.url, 'product', e.target.value)}
                          className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        >
                          {PRODUCTS.filter(p => p.value).map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {discoveredUrls.length === 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
              <Globe className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No URLs discovered</p>
              <p className="text-xs text-slate-500 mt-0.5">Try a different search query or enable more discovery methods</p>
            </div>
          )}
        </div>
      )}

      {/* Import Phase */}
      {phase === 'import' && importProgress && (
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              importProgress.complete
                ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600'
            }`}>
              {importProgress.complete ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {importProgress.complete ? 'Import Complete' : 'Importing Documents'}
              </h3>
              <p className="text-xs text-slate-500">
                {importProgress.current} of {importProgress.total} processed
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  importProgress.complete
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>

          {/* Summary (when complete) */}
          {importProgress.complete && importProgress.summary && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{importProgress.summary.success}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Imported</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{importProgress.summary.duplicates}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wide">Duplicates</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-500/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{importProgress.summary.errors}</p>
                <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase tracking-wide">Errors</p>
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="max-h-64 overflow-auto space-y-1">
            {importProgress.results.map((result, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  result.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : result.status === 'duplicate'
                    ? 'bg-amber-50 dark:bg-amber-500/5 text-amber-700 dark:text-amber-400'
                    : 'bg-rose-50 dark:bg-rose-500/5 text-rose-700 dark:text-rose-400'
                }`}
              >
                {result.status === 'success' ? (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                ) : result.status === 'duplicate' ? (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate flex-grow">
                  {result.title || result.url}
                </span>
                {result.chunk_count && (
                  <span className="text-[10px] opacity-75 flex-shrink-0">{result.chunk_count} chunks</span>
                )}
                {result.error && (
                  <span className="text-[10px] opacity-75 flex-shrink-0 truncate max-w-32">{result.error}</span>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          {importProgress.complete && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={resetToDiscover}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Import More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
