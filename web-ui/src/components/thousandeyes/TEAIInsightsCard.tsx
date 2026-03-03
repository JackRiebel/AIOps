'use client';

import { memo, useState, useCallback, useRef } from 'react';
import { Sparkles, RefreshCw, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// Types
// ============================================================================

export interface TEAIInsightsCardProps {
  testCount: number;
  activeAlerts: number;
  agentsOnline: number;
  agentsTotal: number;
  eventCount: number;
  outageCount: number;
  onAskMore: (context: string) => void;
  className?: string;
}

// ============================================================================
// TEAIInsightsCard Component
// ============================================================================

export const TEAIInsightsCard = memo(({
  testCount,
  activeAlerts,
  agentsOnline,
  agentsTotal,
  eventCount,
  outageCount,
  onAskMore,
  className = '',
}: TEAIInsightsCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (loading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setInsights('');
    setExpanded(true);

    const prompt = `Analyze this ThousandEyes monitoring snapshot and provide actionable insights:
- Tests running: ${testCount}
- Active alerts: ${activeAlerts}
- Agents online: ${agentsOnline} of ${agentsTotal}
- Events detected: ${eventCount}
- Active outages: ${outageCount}

Provide a brief health assessment, highlight any concerns, and suggest next steps. Use markdown formatting with headers and bullet points. Keep it concise (3-5 paragraphs max).`;

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: prompt,
          session_id: `te-insights-${Date.now()}`,
          stream: true,
        }),
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
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.content || parsed.delta?.content || parsed.text || parsed.token || '';
            if (token) {
              setInsights(prev => (prev || '') + token);
            }
          } catch {
            // Non-JSON SSE data — treat as raw token
            if (data && data !== '[DONE]') {
              setInsights(prev => (prev || '') + data);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('AI analysis failed:', err);
      setInsights('Failed to generate analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, testCount, activeAlerts, agentsOnline, agentsTotal, eventCount, outageCount]);

  const handleAskMore = useCallback(() => {
    const context = insights
      ? `Here is the ThousandEyes AI analysis:\n\n${insights}\n\nPlease provide more detailed analysis.`
      : `Analyze my ThousandEyes environment: ${testCount} tests, ${activeAlerts} active alerts, ${agentsOnline}/${agentsTotal} agents online, ${eventCount} events, ${outageCount} outages.`;
    onAskMore(context);
  }, [insights, testCount, activeAlerts, agentsOnline, agentsTotal, eventCount, outageCount, onAskMore]);

  return (
    <div className={`bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-500/30 overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">AI ThousandEyes Analysis</h3>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {loading ? 'Analyzing...' : insights ? 'Click to view insights' : 'Generate AI-powered monitoring analysis'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!insights && !loading && (
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              Generate Analysis
            </button>
          )}
          {loading && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
          <ChevronDown className={`w-5 h-5 text-purple-500 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </div>
      </div>

      {/* Expandable Content */}
      {expanded && (
        <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-200">
          {loading && !insights ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Analyzing your monitoring data...</p>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">This may take a few seconds</p>
            </div>
          ) : insights ? (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-purple-100 dark:border-purple-500/20 shadow-sm">
                <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-purple-900 dark:prose-headings:text-purple-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-strong:text-purple-800 dark:prose-strong:text-purple-200 prose-ul:my-2 prose-li:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-100 dark:border-purple-500/20">
                    <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />
                    <span className="text-xs text-purple-500">Generating...</span>
                  </div>
                )}
              </div>

              {!loading && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Analysis
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAskMore(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-lg transition-colors"
                  >
                    Ask AI for more details
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-white/50 dark:bg-slate-800/30 rounded-lg border border-purple-100 dark:border-purple-500/20">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">No analysis yet</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-4">
                Generate an AI-powered analysis of your ThousandEyes monitoring
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Generate Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TEAIInsightsCard.displayName = 'TEAIInsightsCard';

export default TEAIInsightsCard;
