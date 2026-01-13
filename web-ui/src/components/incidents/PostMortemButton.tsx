'use client';

import { useState, useCallback } from 'react';
import { FileText, X, Copy, Download, CheckCircle, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface PostMortemButtonProps {
  /** Incident ID */
  incidentId: number;
  /** Incident title for display */
  incidentTitle: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

interface PostMortemData {
  markdown: string;
  incident_id: number;
  generated_at: string;
}

// ============================================================================
// Modal Component
// ============================================================================

interface PostMortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdown: string;
  incidentTitle: string;
  isLoading: boolean;
  error: string | null;
}

function PostMortemModal({
  isOpen,
  onClose,
  markdown,
  incidentTitle,
  isLoading,
  error,
}: PostMortemModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = markdown;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-mortem-${incidentTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, incidentTitle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-cyan-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Post-Mortem Report
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {incidentTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && !error && (
              <>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                Generating post-mortem report...
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                This may take a few moments
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-slate-900 dark:text-white font-medium mb-2">
                Failed to generate report
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {error}
              </p>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {/* Render markdown as preformatted text for now */}
              <pre className="whitespace-pre-wrap text-sm font-mono bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 overflow-auto">
                {markdown}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PostMortemButton({
  incidentId,
  incidentTitle,
  disabled = false,
  className = '',
}: PostMortemButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState('');

  const generatePostMortem = useCallback(async () => {
    setIsModalOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/incidents/${incidentId}/post-mortem`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate post-mortem');
      }

      const data: PostMortemData = await response.json();
      setMarkdown(data.markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [incidentId]);

  return (
    <>
      <button
        onClick={generatePostMortem}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            : 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30'
        } ${className}`}
      >
        <FileText className="w-4 h-4" />
        Generate Post-Mortem
      </button>

      <PostMortemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        markdown={markdown}
        incidentTitle={incidentTitle}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}

export default PostMortemButton;
