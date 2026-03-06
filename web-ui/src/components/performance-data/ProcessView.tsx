'use client';

import { useState, memo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle, Database, Code2, Shield, Play, Sparkles } from 'lucide-react';
import type { GenerationMetadata, InterpretationMetadata, SQLQueryResult } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProcessViewProps {
  generationMetadata?: GenerationMetadata;
  interpretationMetadata?: InterpretationMetadata;
  results?: SQLQueryResult | null;
  finalSql?: string;
}

type StepStatus = 'success' | 'warning' | 'error' | 'neutral';

// ─── CodeBlock ───────────────────────────────────────────────────────────────

const CodeBlock = memo(({ children, label }: { children: string; label?: string }) => (
  <div className="relative group my-2">
    {label && (
      <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
        {label}
      </div>
    )}
    <pre className="overflow-x-auto rounded-lg bg-slate-900 dark:bg-slate-950 p-3 max-h-96 overflow-y-auto">
      <code className="text-xs text-slate-100 font-mono whitespace-pre-wrap break-words">{children}</code>
    </pre>
  </div>
));
CodeBlock.displayName = 'CodeBlock';

// ─── StepCard ────────────────────────────────────────────────────────────────

interface StepCardProps {
  title: string;
  icon: React.ElementType;
  status: StepStatus;
  stepNumber: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const STATUS_STYLES: Record<StepStatus, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  neutral: { icon: CheckCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

function StepCard({ title, icon: Icon, status, stepNumber, children, defaultOpen = false }: StepCardProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const statusStyle = STATUS_STYLES[status];
  const StatusIcon = statusStyle.icon;

  return (
    <div className="relative">
      {/* Timeline connector */}
      {stepNumber < 5 && (
        <div className="absolute left-[15px] top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
      )}

      <div className="relative">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 text-left group py-1.5"
        >
          {/* Step circle */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${statusStyle.bg} z-10`}>
            <StatusIcon className={`w-4 h-4 ${statusStyle.color}`} />
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</span>
          </div>

          {/* Expand chevron */}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          }
        </button>

        {expanded && (
          <div className="ml-11 mt-1 mb-4 space-y-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProcessView({ generationMetadata, interpretationMetadata, results, finalSql }: ProcessViewProps) {
  if (!generationMetadata && !interpretationMetadata) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
        <p className="text-sm text-purple-600 dark:text-purple-400">
          Toggle Process on before running a query to capture pipeline metadata.
        </p>
      </div>
    );
  }

  const attempts = generationMetadata?.attempts ?? [];
  const lastAttempt = attempts[attempts.length - 1];
  const allPassed = attempts.length > 0 && !lastAttempt?.safety_error && !lastAttempt?.explain_error;

  // Determine statuses
  const schemaStatus: StepStatus = generationMetadata ? 'success' : 'neutral';
  const genStatus: StepStatus = !attempts.length
    ? 'neutral'
    : allPassed
      ? (attempts.length === 1 ? 'success' : 'warning')
      : 'error';
  const validationStatus: StepStatus = allPassed ? 'success' : 'error';
  const execStatus: StepStatus = results ? 'success' : 'neutral';
  const interpretStatus: StepStatus = interpretationMetadata ? 'success' : 'neutral';

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-purple-200 dark:border-purple-700/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/40">
          <Code2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Pipeline Process</span>
        {attempts.length > 1 && (
          <span className="ml-auto text-xs text-amber-500 dark:text-amber-400">
            {attempts.length} attempts (self-corrected)
          </span>
        )}
      </div>

      {/* Step 1: Schema Context */}
      <StepCard title="Schema Context" icon={Database} status={schemaStatus} stepNumber={1}>
        {generationMetadata?.schema_context && (
          <CodeBlock label="Schema">{generationMetadata.schema_context}</CodeBlock>
        )}
        {generationMetadata?.glossary_context && (
          <>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3">
              Matched Glossary Terms
            </div>
            <CodeBlock>{generationMetadata.glossary_context}</CodeBlock>
          </>
        )}
        {generationMetadata?.examples_context && (
          <>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3">
              RAG Examples
            </div>
            <CodeBlock>{generationMetadata.examples_context}</CodeBlock>
          </>
        )}
        {!generationMetadata?.glossary_context && !generationMetadata?.examples_context && (
          <p className="text-xs text-slate-400">No glossary matches or RAG examples found.</p>
        )}
      </StepCard>

      {/* Step 2: SQL Generation */}
      <StepCard title="SQL Generation" icon={Code2} status={genStatus} stepNumber={2}>
        {attempts.map((attempt, i) => {
          const isLast = i === attempts.length - 1;
          const hasError = !!attempt.safety_error || !!attempt.explain_error;
          const statusColor = hasError
            ? (isLast ? 'border-red-300 dark:border-red-800' : 'border-amber-300 dark:border-amber-800')
            : 'border-emerald-300 dark:border-emerald-800';

          return (
            <div key={i} className={`rounded-lg border ${statusColor} p-3 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Attempt {attempt.attempt}
                </span>
                {hasError ? (
                  <span className="text-xs text-red-500">{attempt.safety_error || 'EXPLAIN failed'}</span>
                ) : (
                  <span className="text-xs text-emerald-500">Passed</span>
                )}
              </div>
              <CodeBlock label="Prompt Sent">{attempt.user_prompt}</CodeBlock>
              <CodeBlock label="Raw LLM Response">{attempt.raw_response}</CodeBlock>
              <CodeBlock label="Extracted SQL">{attempt.extracted_sql}</CodeBlock>
              {attempt.explain_error && (
                <div className="text-xs text-red-400 bg-red-950/30 rounded p-2 font-mono">
                  {attempt.explain_error}
                </div>
              )}
            </div>
          );
        })}
      </StepCard>

      {/* Step 3: SQL Validation */}
      <StepCard title="SQL Validation" icon={Shield} status={validationStatus} stepNumber={3}>
        {allPassed ? (
          <div className="text-xs text-emerald-500">EXPLAIN check passed — SQL syntax is valid.</div>
        ) : (
          <div className="text-xs text-red-400">Validation failed — see SQL Generation step for details.</div>
        )}
        {finalSql && (
          <CodeBlock label="Final SQL">{finalSql}</CodeBlock>
        )}
      </StepCard>

      {/* Step 4: Execution */}
      <StepCard title="Execution" icon={Play} status={execStatus} stepNumber={4}>
        {results ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{results.execution_time_ms}ms</p>
                <p className="text-[10px] text-slate-400">Duration</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{results.row_count}</p>
                <p className="text-[10px] text-slate-400">Rows</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{results.columns.length}</p>
                <p className="text-[10px] text-slate-400">Columns</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{results.truncated ? 'Yes' : 'No'}</p>
                <p className="text-[10px] text-slate-400">Truncated</p>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Columns: {results.columns.join(', ')}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Query not yet executed.</p>
        )}
      </StepCard>

      {/* Step 5: AI Interpretation */}
      <StepCard title="AI Interpretation" icon={Sparkles} status={interpretStatus} stepNumber={5}>
        {interpretationMetadata ? (
          <>
            <CodeBlock label="Full Prompt Sent">{interpretationMetadata.prompt}</CodeBlock>
            <CodeBlock label="Raw JSON Response">{interpretationMetadata.raw_response}</CodeBlock>
          </>
        ) : (
          <p className="text-xs text-slate-400">Interpretation not yet completed.</p>
        )}
      </StepCard>
    </div>
  );
}
