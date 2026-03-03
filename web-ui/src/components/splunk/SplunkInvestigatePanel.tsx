'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Play, Sparkles, Code, ChevronDown, ChevronUp, Copy, Wand2,
  FileQuestion, Zap, Loader2, Network, Bot, RefreshCw, MessageSquare, Send,
  Terminal, Clock, Hash, ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SplunkCorrelatedDevice } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkInvestigatePanelProps {
  // SAIA
  saiaAvailable: boolean;
  loadingSaia: boolean;
  generatedSpl: string | null;
  splExplanation: string | null;
  optimizedSpl: string | null;
  onGenerateSpl: (prompt: string) => Promise<void>;
  onExplainSpl: (spl: string) => Promise<void>;
  onOptimizeSpl: (spl: string) => Promise<void>;
  // Search
  loadingSearch: boolean;
  searchResults: any[];
  onSearch: (query: string, timeRange: string, maxResults: number) => Promise<void>;
  // Correlation
  correlatedDevices: SplunkCorrelatedDevice[];
  loadingCorrelation: boolean;
  onCorrelate: () => Promise<void>;
  // SAIA Q&A
  saiaAnswer: string | null;
  onAskSplunk: (question: string) => Promise<void>;
  // Initial command
  initialQuery?: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGES = [
  { value: '-15m', label: '15 min' },
  { value: '-1h', label: '1 hour' },
  { value: '-4h', label: '4 hours' },
  { value: '-24h', label: '24 hours' },
  { value: '-7d', label: '7 days' },
  { value: '-30d', label: '30 days' },
];

const SAIA_QUICK_PROMPTS = [
  'Which hosts are sending the most data?',
  'Show failed authentication attempts in the last 24h',
  'Find VPN connection issues',
  'Show top error events by source',
];

// Shared markdown prose classes
const MD_PROSE = '[&_ul]:space-y-0.5 [&_ul]:pl-3.5 [&_ul]:list-disc [&_ul]:marker:text-purple-400 [&_ol]:space-y-0.5 [&_ol]:pl-3.5 [&_ol]:list-decimal [&_li]:text-[12px] [&_li]:leading-snug [&_p]:text-[12px] [&_p]:leading-relaxed [&_strong]:font-semibold [&_h1]:text-xs [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-[12px] [&_h3]:font-semibold [&_code]:text-[10px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-[10px] [&_pre]:bg-slate-900 [&_pre]:text-green-400 [&_pre]:p-2.5 [&_pre]:rounded-lg [&_pre]:overflow-x-auto';

// ============================================================================
// Component
// ============================================================================

export const SplunkInvestigatePanel = memo(({
  saiaAvailable,
  loadingSaia,
  generatedSpl,
  splExplanation,
  optimizedSpl,
  onGenerateSpl,
  onExplainSpl,
  onOptimizeSpl,
  loadingSearch,
  searchResults,
  onSearch,
  correlatedDevices,
  loadingCorrelation,
  onCorrelate,
  saiaAnswer,
  onAskSplunk,
  initialQuery,
}: SplunkInvestigatePanelProps) => {
  const router = useRouter();
  const [nlQuery, setNlQuery] = useState('');
  const [splQuery, setSplQuery] = useState('search index=* | head 50');
  const [timeRange, setTimeRange] = useState('-1h');
  const [maxResults, setMaxResults] = useState(100);
  const [showEditor, setShowEditor] = useState(true);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [aiContent, setAiContent] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const initialQueryHandled = useRef(false);
  const saiaScrollRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 50;

  // SAIA Q&A state — use a ref for the pending question so it survives the render cycle
  const [saiaQuestion, setSaiaQuestion] = useState('');
  const pendingQuestionRef = useRef<string>('');
  const [saiaHistory, setSaiaHistory] = useState<{ q: string; a: string }[]>([]);

  // Handle initial query from command header
  useEffect(() => {
    if (initialQuery && !initialQueryHandled.current) {
      initialQueryHandled.current = true;
      setNlQuery(initialQuery);
      if (saiaAvailable) {
        onGenerateSpl(initialQuery);
      }
    }
  }, [initialQuery, saiaAvailable, onGenerateSpl]);

  // Apply generated SPL
  useEffect(() => {
    if (generatedSpl) {
      setSplQuery(generatedSpl);
    }
  }, [generatedSpl]);

  // Track SAIA answers — uses the ref so the question is never lost
  useEffect(() => {
    if (saiaAnswer && pendingQuestionRef.current) {
      setSaiaHistory(prev => [...prev, { q: pendingQuestionRef.current, a: saiaAnswer }]);
      pendingQuestionRef.current = '';
    }
  }, [saiaAnswer]);

  // Auto-scroll SAIA history to bottom
  useEffect(() => {
    if (saiaScrollRef.current) {
      saiaScrollRef.current.scrollTop = saiaScrollRef.current.scrollHeight;
    }
  }, [saiaHistory.length, loadingSaia]);

  const handleNlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    if (saiaAvailable) {
      onGenerateSpl(nlQuery.trim());
    }
  }, [nlQuery, saiaAvailable, onGenerateSpl]);

  const handleSearch = useCallback(() => {
    if (!splQuery.trim()) return;
    setPage(0);
    setExpandedRow(null);
    onSearch(splQuery.trim(), timeRange, maxResults);
  }, [splQuery, timeRange, maxResults, onSearch]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(splQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [splQuery]);

  const handleAskSaia = useCallback((question: string) => {
    if (!question.trim()) return;
    const q = question.trim();
    pendingQuestionRef.current = q;
    onAskSplunk(q);
    setSaiaQuestion('');
  }, [onAskSplunk]);

  // AI analysis of search results
  const analyzeResults = useCallback(async () => {
    if (searchResults.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiContent('');
    setAiStreaming(true);

    const sampleResults = searchResults.slice(0, 10).map(r => JSON.stringify(r).slice(0, 200));
    const prompt = `Analyze these Splunk search results (${searchResults.length} total). SPL: ${splQuery}\n\nSample:\n${sampleResults.join('\n')}\n\nProvide: patterns found, anomalies, severity assessment, and recommendations. Be concise.`;

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: prompt, session_id: `splunk-investigate-${Date.now()}` }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text_delta' && event.text) {
              setAiContent(prev => prev + event.text);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setAiContent('Analysis failed. Try again.');
    } finally {
      setAiStreaming(false);
    }
  }, [searchResults, splQuery]);

  // Auto-analyze when results change
  useEffect(() => {
    if (searchResults.length > 0) {
      analyzeResults();
      onCorrelate();
    }
  }, [searchResults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Columns from results
  const columns = searchResults.length > 0
    ? Object.keys(searchResults[0]).filter(k => k !== '_raw').slice(0, 8)
    : [];

  // Sort + paginate
  const sortedResults = [...searchResults].sort((a, b) => {
    if (!sortField) return 0;
    const av = a[sortField] || '';
    const bv = b[sortField] || '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const pageResults = sortedResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);

  return (
    <div className="space-y-4">

      {/* ================================================================ */}
      {/* SPL Editor -- Full-width hero section */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm overflow-hidden">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm">
              <Terminal className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">SPL Editor</span>
              {generatedSpl && (
                <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                  AI generated
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/50 text-slate-400 dark:text-slate-500 transition-colors"
          >
            {showEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showEditor && (
          <div className="p-5 space-y-3.5">
            {/* SPL Textarea with line-number gutter feel */}
            <div className="relative flex rounded-xl border border-slate-700/60 overflow-hidden shadow-inner bg-slate-950">
              {/* Line numbers gutter */}
              <div className="flex-shrink-0 w-10 bg-slate-900/80 border-r border-slate-800 pt-4 pb-4 select-none">
                {Array.from({ length: Math.max(4, (splQuery.match(/\n/g) || []).length + 1) }).map((_, i) => (
                  <div key={i} className="px-2 text-right text-[10px] leading-relaxed text-slate-600 font-mono">{i + 1}</div>
                ))}
              </div>
              <textarea
                value={splQuery}
                onChange={e => setSplQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSearch(); }}
                rows={4}
                className="flex-1 p-4 bg-transparent text-green-400 font-mono text-sm leading-relaxed focus:outline-none resize-y placeholder-slate-600"
                spellCheck={false}
                placeholder="search index=* | head 50"
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-slate-600 font-mono">
                {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to run
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Time Range */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <Clock className="w-3 h-3 text-slate-400" />
                <select
                  value={timeRange}
                  onChange={e => setTimeRange(e.target.value)}
                  className="text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  {TIME_RANGES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Max Results */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <Hash className="w-3 h-3 text-slate-400" />
                <select
                  value={maxResults}
                  onChange={e => setMaxResults(Number(e.target.value))}
                  className="text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  {[50, 100, 500, 1000].map(n => <option key={n} value={n}>{n} results</option>)}
                </select>
              </div>

              <div className="flex-1" />

              {/* SAIA Buttons */}
              {saiaAvailable && (
                <>
                  <button
                    onClick={() => onExplainSpl(splQuery)}
                    disabled={loadingSaia || !splQuery.trim()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors disabled:opacity-40"
                  >
                    <FileQuestion className="w-3 h-3" />Explain
                  </button>
                  <button
                    onClick={() => onOptimizeSpl(splQuery)}
                    disabled={loadingSaia || !splQuery.trim()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors disabled:opacity-40"
                  >
                    <Zap className="w-3 h-3" />Optimize
                  </button>
                </>
              )}

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
              </button>

              <button
                onClick={handleSearch}
                disabled={loadingSearch || !splQuery.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:shadow-none"
              >
                {loadingSearch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run Search
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* AI Assistants -- NL->SPL + SAIA Chat (side by side) */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Natural Language -> SPL */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2 px-1">Natural Language to SPL</p>
          <form onSubmit={handleNlSubmit} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
                <Wand2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">NL to SPL</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Describe what you need in plain English</p>
              </div>
              {saiaAvailable ? (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  SAIA
                </span>
              ) : (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Unavailable
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={nlQuery}
                onChange={e => setNlQuery(e.target.value)}
                placeholder={saiaAvailable ? 'e.g. "Show failed logins from the last 24 hours"' : 'SAIA not available -- enter SPL directly above'}
                disabled={!saiaAvailable}
                className="w-full pl-3.5 pr-28 py-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-colors disabled:opacity-40"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <button
                  type="submit"
                  disabled={!saiaAvailable || !nlQuery.trim() || loadingSaia}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:shadow-none"
                >
                  {loadingSaia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Generate'}
                </button>
              </div>
            </div>

            {/* Quick prompts */}
            {saiaAvailable && !nlQuery && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {SAIA_QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => { setNlQuery(prompt); onGenerateSpl(prompt); }}
                    className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 border border-slate-200/80 dark:border-slate-600/40 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-200 dark:hover:border-purple-500/25 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* SAIA Chat Panel */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2 px-1">Splunk AI Assistant</p>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700/40">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">Ask Splunk AI</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Get answers about your environment</p>
              </div>
              {saiaAvailable && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                  SAIA
                </span>
              )}
            </div>

            {/* Chat Area */}
            <div ref={saiaScrollRef} className="flex-1 min-h-[120px] max-h-[240px] overflow-y-auto px-4 py-3">
              {saiaHistory.length > 0 ? (
                <div className="space-y-3">
                  {saiaHistory.map((entry, i) => (
                    <div key={i} className="space-y-1.5">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-br-sm bg-purple-600 text-white text-[12px] leading-relaxed">
                          {entry.q}
                        </div>
                      </div>
                      {/* AI response */}
                      <div className="flex justify-start">
                        <div className={`max-w-[95%] px-3 py-2 rounded-lg rounded-bl-sm bg-slate-50 dark:bg-slate-700/40 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 ${MD_PROSE} [&_strong]:text-purple-700 [&_strong]:dark:text-purple-300 [&_code]:bg-purple-50 [&_code]:dark:bg-purple-500/10 [&_code]:text-purple-700 [&_code]:dark:text-purple-300`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.a}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : loadingSaia && pendingQuestionRef.current ? (
                <div className="flex items-center gap-2.5 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">Thinking...</span>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/40 flex items-center justify-center mx-auto mb-2">
                    <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    {saiaAvailable ? 'Ask anything about your Splunk environment' : 'SAIA not available'}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {saiaAvailable && 'Try: "What sourcetypes do we have?" or "How is our license usage?"'}
                  </p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 dark:border-slate-700/30">
              <div className="relative">
                <input
                  type="text"
                  value={saiaQuestion}
                  onChange={e => setSaiaQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskSaia(saiaQuestion); } }}
                  placeholder={saiaAvailable ? 'Ask a question...' : 'SAIA not available'}
                  disabled={!saiaAvailable || loadingSaia}
                  className="w-full pl-3.5 pr-11 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-colors disabled:opacity-40"
                />
                <button
                  onClick={() => handleAskSaia(saiaQuestion)}
                  disabled={!saiaAvailable || !saiaQuestion.trim() || loadingSaia}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-30 disabled:bg-slate-400"
                >
                  {loadingSaia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SAIA Explanation / Optimization results */}
      {/* ================================================================ */}
      {splExplanation && (
        <div className="bg-white dark:bg-slate-800/50 border border-blue-200/60 dark:border-blue-500/20 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-500/5 dark:to-sky-500/5 border-b border-blue-100 dark:border-blue-500/15">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileQuestion className="w-3.5 h-3.5 text-blue-500" /> SPL Explanation
            </h4>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">via SAIA</span>
          </div>
          <div className={`px-4 py-3 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 ${MD_PROSE} [&_strong]:text-blue-800 [&_strong]:dark:text-blue-200 [&_code]:bg-blue-50 [&_code]:dark:bg-blue-500/10 [&_code]:text-blue-800 [&_code]:dark:text-blue-300 [&_ul]:marker:text-blue-400`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{splExplanation}</ReactMarkdown>
          </div>
        </div>
      )}
      {optimizedSpl && (
        <div className="bg-white dark:bg-slate-800/50 border border-amber-200/60 dark:border-amber-500/20 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/5 dark:to-yellow-500/5 border-b border-amber-100 dark:border-amber-500/15">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Optimized SPL
            </h4>
            <button
              onClick={() => setSplQuery(optimizedSpl)}
              className="px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/15 transition-colors"
            >
              Apply to Editor
            </button>
          </div>
          <div className="px-4 py-3">
            <pre className="text-xs text-amber-900 dark:text-amber-300 font-mono bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3 overflow-x-auto border border-slate-200/60 dark:border-slate-700/30">{optimizedSpl}</pre>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Results + Sidebar */}
      {/* ================================================================ */}
      {(searchResults.length > 0 || loadingSearch) && (
        <div className="grid grid-cols-12 gap-4">
          {/* Results Table */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700/40">
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {loadingSearch ? 'Running search...' : `${searchResults.length} results`}
                  </span>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1.5 font-medium tabular-nums">{page + 1} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {loadingSearch ? (
                <div className="p-5 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-700/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80">
                        {columns.map(col => (
                          <th
                            key={col}
                            onClick={() => { setSortField(col); setSortDir(prev => sortField === col && prev === 'asc' ? 'desc' : 'asc'); }}
                            className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors select-none border-b border-slate-200 dark:border-slate-700/40"
                          >
                            <span className="inline-flex items-center gap-1">
                              {col}
                              {sortField === col && <ArrowUpDown className="w-2.5 h-2.5" />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                      {pageResults.map((row, i) => (
                        <tr key={i} className="group">
                          <td colSpan={columns.length} className="p-0">
                            <button
                              onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                              className="w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                            >
                              <div className="flex">
                                {columns.map(col => (
                                  <div key={col} className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate flex-1">
                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                  </div>
                                ))}
                              </div>
                            </button>
                            {expandedRow === i && row._raw && (
                              <div className="mx-4 mb-3 p-3 bg-slate-950 rounded-lg border border-slate-700/60">
                                <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto leading-relaxed">
                                  {row._raw}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom pagination bar */}
              {totalPages > 1 && !loadingSearch && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-900/30">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Showing <span className="font-medium text-slate-700 dark:text-slate-300">{page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, searchResults.length)}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{searchResults.length}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                      const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
                      const pageNum = startPage + idx;
                      if (pageNum >= totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-cyan-600 text-white border border-cyan-600'
                              : 'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Investigation Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            {/* AI Analysis */}
            <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">AI Analysis</h4>
                </div>
                <div className="flex items-center gap-1">
                  {aiStreaming && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
                  {!aiStreaming && searchResults.length > 0 && (
                    <button onClick={analyzeResults} className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/40 text-slate-400 hover:text-purple-500 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4">
                {aiContent ? (
                  <div className={`max-h-[350px] overflow-y-auto text-[12px] leading-relaxed text-slate-700 dark:text-slate-200 ${MD_PROSE} [&_strong]:text-purple-700 [&_strong]:dark:text-purple-300 [&_code]:bg-purple-50 [&_code]:dark:bg-purple-500/10 [&_code]:text-purple-700 [&_code]:dark:text-purple-300 [&_h1]:text-slate-900 [&_h1]:dark:text-white [&_h2]:text-slate-900 [&_h2]:dark:text-white [&_h3]:text-slate-800 [&_h3]:dark:text-slate-100`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiContent}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">Run a search to see AI analysis</p>
                )}
              </div>
            </div>

            {/* Matched Devices */}
            {correlatedDevices.length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/40 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/80 dark:to-slate-800/60 border-b border-slate-200 dark:border-slate-700/40">
                  <Network className="w-3.5 h-3.5 text-emerald-500" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Matched Devices</h4>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">{correlatedDevices.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[220px] overflow-y-auto">
                  {correlatedDevices.slice(0, 15).map((dev, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/chat-v2?q=Investigate+device+${encodeURIComponent(dev.hostname || dev.ip)}+in+Splunk+logs`)}
                      className="w-full flex items-center gap-2.5 text-[11px] text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 px-4 py-2 transition-colors group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{dev.hostname || dev.ip}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">{dev.platforms.join(', ')}</span>
                      <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SplunkInvestigatePanel.displayName = 'SplunkInvestigatePanel';
export default SplunkInvestigatePanel;
