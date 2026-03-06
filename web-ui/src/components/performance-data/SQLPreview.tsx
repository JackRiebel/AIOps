'use client';

import { useState } from 'react';
import { Code2, Copy, Check, AlertTriangle } from 'lucide-react';

interface SQLPreviewProps {
  sql: string;
  valid: boolean;
  error: string | null;
  onChange?: (sql: string) => void;
  editable?: boolean;
}

export function SQLPreview({ sql, valid, error, onChange, editable = true }: SQLPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Generated SQL</span>
          {!valid && error && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="p-1 text-slate-400 hover:text-cyan-500 transition-colors rounded"
          title="Copy SQL"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {editable ? (
        <textarea
          value={sql}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-4 font-mono text-sm text-slate-900 dark:text-slate-100 bg-transparent resize-y min-h-[80px] focus:outline-none"
          rows={Math.max(3, sql.split('\n').length)}
        />
      ) : (
        <pre className="p-4 font-mono text-sm text-slate-900 dark:text-slate-100 overflow-x-auto whitespace-pre-wrap">
          {sql}
        </pre>
      )}
    </div>
  );
}
