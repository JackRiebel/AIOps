'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, Sparkles, Loader2, MessageSquare, ChevronDown, ChevronRight, RotateCcw, Code2, Eye } from 'lucide-react';
import type { DatasetInfo, QueryResponse, SQLQueryResult, GenerationMetadata, InterpretationMetadata } from './types';
import { LLMProviderSelector } from './LLMProviderSelector';
import { SQLPreview } from './SQLPreview';
import { ResultsTable } from './ResultsTable';
import { ResultsChart, type ChartType } from './ResultsChart';
import { ProcessView } from './ProcessView';

interface QueryInterfaceProps {
  datasets: DatasetInfo[];
  selectedDatasetId: number | null;
  onSelectDataset: (id: number) => void;
}

export function QueryInterface({ datasets, selectedDatasetId, onSelectDataset }: QueryInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [provider, setProvider] = useState('');
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [editedSql, setEditedSql] = useState('');
  const [results, setResults] = useState<SQLQueryResult | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [suggestedChart, setSuggestedChart] = useState<ChartType | undefined>(undefined);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlEdited, setSqlEdited] = useState(false);

  // Follow-up questions
  const [followUps, setFollowUps] = useState<string[]>([]);

  // Process view
  const [showProcess, setShowProcess] = useState(false);
  const [generationMetadata, setGenerationMetadata] = useState<GenerationMetadata | undefined>(undefined);
  const [interpretationMetadata, setInterpretationMetadata] = useState<InterpretationMetadata | undefined>(undefined);

  // Follow-up auto-trigger ref
  const pendingFollowUp = useRef(false);

  const readyDatasets = datasets.filter(d => d.status === 'ready');

  // Pipeline refs for chaining: generate → execute → interpret
  const pendingAutoExecute = useRef(false);
  const pendingAutoInterpret = useRef(false);

  // ── Execute SQL ──────────────────────────────────────────────────────
  const doExecute = useCallback(async (sql: string) => {
    if (!selectedDatasetId || !sql.trim()) return;
    setExecuting(true);
    setError(null);

    try {
      const resp = await fetch(`/api/structured-data/datasets/${selectedDatasetId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql.trim() }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || `Execution failed (${resp.status})`);
      }
      const execResults = await resp.json();
      setResults(execResults);
      // Chain: auto-interpret after execution
      pendingAutoInterpret.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  }, [selectedDatasetId]);

  // ── Interpret results ────────────────────────────────────────────────
  const doInterpret = useCallback(async (execResults: SQLQueryResult, sql: string) => {
    if (!selectedDatasetId) return;
    setInterpreting(true);

    try {
      const resp = await fetch(`/api/structured-data/datasets/${selectedDatasetId}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          sql,
          results: execResults,
          provider: provider || undefined,
          include_metadata: showProcess,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setInterpretation(data.interpretation);
        if (data.suggested_chart) setSuggestedChart(data.suggested_chart as ChartType);
        if (data.follow_up_questions) setFollowUps(data.follow_up_questions);
        if (data.interpretation_metadata) setInterpretationMetadata(data.interpretation_metadata);
      }
    } catch { /* ignore */ }
    finally { setInterpreting(false); }
  }, [selectedDatasetId, question, provider, showProcess]);

  // ── Generate SQL (kicks off the whole pipeline) ──────────────────────
  const handleGenerate = useCallback(async () => {
    if (!selectedDatasetId || !question.trim()) return;
    setGenerating(true);
    setError(null);
    setResults(null);
    setInterpretation(null);
    setSuggestedChart(undefined);
    setQueryResponse(null);
    setSqlEdited(false);
    setShowDetails(false);
    setFollowUps([]);
    setGenerationMetadata(undefined);
    setInterpretationMetadata(undefined);

    try {
      const resp = await fetch(`/api/structured-data/datasets/${selectedDatasetId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          provider: provider || undefined,
          include_metadata: showProcess,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || `Request failed (${resp.status})`);
      }
      const data: QueryResponse & { generation_metadata?: GenerationMetadata } = await resp.json();
      setQueryResponse(data);
      setEditedSql(data.sql);
      if (data.generation_metadata) setGenerationMetadata(data.generation_metadata);

      if (data.valid) {
        pendingAutoExecute.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate SQL');
    } finally {
      setGenerating(false);
    }
  }, [selectedDatasetId, question, provider, showProcess]);

  // Chain: generate → execute
  useEffect(() => {
    if (pendingAutoExecute.current && editedSql && !executing) {
      pendingAutoExecute.current = false;
      doExecute(editedSql);
    }
  }, [editedSql, executing, doExecute]);

  // Chain: execute → interpret
  useEffect(() => {
    if (pendingAutoInterpret.current && results && !interpreting && !interpretation) {
      pendingAutoInterpret.current = false;
      doInterpret(results, editedSql);
    }
  }, [results, interpreting, interpretation, doInterpret, editedSql]);

  // Follow-up auto-trigger: when question changes via follow-up, auto-run
  useEffect(() => {
    if (pendingFollowUp.current && question.trim()) {
      pendingFollowUp.current = false;
      handleGenerate();
    }
  }, [question, handleGenerate]);

  const handleExecute = useCallback(() => {
    doExecute(editedSql);
  }, [doExecute, editedSql]);

  const handleSqlChange = useCallback((sql: string) => {
    setEditedSql(sql);
    setSqlEdited(true);
  }, []);

  const handleFollowUp = useCallback((q: string) => {
    setQuestion(q);
    pendingFollowUp.current = true;
  }, []);

  const isBusy = generating || executing;
  const pipelineActive = generating || executing || interpreting;

  // Status text for the progress indicator
  const statusText = generating
    ? 'Generating SQL...'
    : executing
      ? 'Running query...'
      : interpreting
        ? 'Analyzing results...'
        : null;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Dataset</label>
            <select
              value={selectedDatasetId || ''}
              onChange={(e) => onSelectDataset(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="">Select a dataset...</option>
              {readyDatasets.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.row_count?.toLocaleString()} rows)</option>
              ))}
            </select>
          </div>
          <LLMProviderSelector value={provider} onChange={setProvider} />
        </div>

        {/* Question input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isBusy && handleGenerate()}
              placeholder="Ask a question about your data..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedDatasetId || !question.trim() || isBusy}
            className="px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
          >
            {pipelineActive ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {statusText}</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Ask</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Pipeline progress */}
      {pipelineActive && !error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-600 dark:text-cyan-400" />
          <div className="flex items-center gap-2">
            {['Generating SQL', 'Running query', 'Analyzing results'].map((step, i) => {
              const active = (i === 0 && generating) || (i === 1 && executing) || (i === 2 && interpreting);
              const done = (i === 0 && !generating && (executing || interpreting || results))
                || (i === 1 && !executing && (interpreting || interpretation))
                || (i === 2 && !!interpretation);
              return (
                <span key={step} className={`text-xs font-medium ${
                  active ? 'text-cyan-700 dark:text-cyan-300' : done ? 'text-cyan-500/60 dark:text-cyan-500/40' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {done ? '\u2713' : active ? '\u25CF' : '\u25CB'} {step}
                  {i < 2 && <span className="ml-2 text-slate-300 dark:text-slate-600">&rarr;</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI Answer (primary, shown first) ────────────────────────── */}
      {interpretation && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/40">
              <MessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Answer</span>
            {results && (
              <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
                {results.row_count} row{results.row_count !== 1 ? 's' : ''} &middot; {results.execution_time_ms}ms
                {queryResponse?.provider && (
                  <> &middot; {queryResponse.provider}/{queryResponse.model}</>
                )}
              </span>
            )}
          </div>
          <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-purple-900 dark:prose-headings:text-purple-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-strong:text-purple-800 dark:prose-strong:text-purple-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{interpretation}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ── Follow-up Questions ────────────────────────────────────── */}
      {followUps.length > 0 && !pipelineActive && (
        <div className="flex flex-wrap gap-2">
          {followUps.map((q, i) => (
            <button
              key={i}
              onClick={() => handleFollowUp(q)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                i === 0
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 font-medium shadow-sm'
                  : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Visualization (shown prominently, above the collapsible SQL & Data) ── */}
      {results && (
        <ResultsChart results={results} suggestedChart={suggestedChart} />
      )}

      {/* ── Details toggle (SQL, table) + Process toggle ──────────── */}
      {results && (
        <div className="space-y-3">
          {/* Toggle bar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
            >
              {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Code2 className="w-3.5 h-3.5" />
              SQL &amp; Data
            </button>
            <button
              onClick={() => setShowProcess(!showProcess)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showProcess
                  ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Process
            </button>
            {sqlEdited && (
              <button
                onClick={handleExecute}
                disabled={!editedSql.trim() || executing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Re-Execute
              </button>
            )}
          </div>

          {/* Process View */}
          {showProcess && (
            <ProcessView
              generationMetadata={generationMetadata}
              interpretationMetadata={interpretationMetadata}
              results={results}
              finalSql={editedSql}
            />
          )}

          {/* Collapsible details panel */}
          {showDetails && (
            <div className="space-y-3">
              {queryResponse && (
                <div>
                  <SQLPreview
                    sql={editedSql}
                    valid={queryResponse.valid}
                    error={queryResponse.error}
                    onChange={handleSqlChange}
                  />
                  {queryResponse.provider && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        via {queryResponse.provider}/{queryResponse.model}
                        {(queryResponse.attempts ?? 0) > 1 && (
                          <span className="ml-1 text-amber-500">
                            ({queryResponse.attempts} attempts — self-corrected)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <ResultsTable results={results} />
            </div>
          )}
        </div>
      )}

      {/* Show SQL preview when query failed (no results) */}
      {queryResponse && !results && !executing && (
        <div>
          <SQLPreview
            sql={editedSql}
            valid={queryResponse.valid}
            error={queryResponse.error}
            onChange={handleSqlChange}
          />
          {queryResponse.provider && (
            <div className="mt-1.5">
              <span className="text-xs text-slate-400">
                via {queryResponse.provider}/{queryResponse.model}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
