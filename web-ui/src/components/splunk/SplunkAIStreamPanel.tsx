'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw, MessageSquare, Loader2, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// Types
// ============================================================================

export interface SplunkAIStreamPanelProps {
  indexCount: number;
  totalEventCount: number;
  sourceCount: number;
  hostCount: number;
  saiaAvailable: boolean;
  insightCount: number;
  dataReady: boolean;
  logAIQuery?: (
    query: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: { durationMs?: number; toolsUsed?: string[]; costUsd?: number },
  ) => void;
  isAISessionActive?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkAIStreamPanel = memo(({
  indexCount,
  totalEventCount,
  sourceCount,
  hostCount,
  saiaAvailable,
  insightCount,
  dataReady,
  logAIQuery,
  isAISessionActive,
}: SplunkAIStreamPanelProps) => {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(`splunk-ai-${Date.now()}`);

  const streamAnalysis = useCallback(async (prompt: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    const startTime = Date.now();

    setContent('');
    setStreaming(true);

    let accumulatedContent = '';
    let toolsUsed: string[] = [];
    let usageData: { inputTokens: number; outputTokens: number; costUsd?: number } | undefined;

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: prompt,
          session_id: sessionIdRef.current,
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
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text_delta' && event.text) {
              accumulatedContent += event.text;
              setContent(prev => prev + event.text);
            } else if (event.type === 'done' || event.type === 'multi_agent_done') {
              if (event.usage) {
                usageData = {
                  inputTokens: event.usage.input_tokens || 0,
                  outputTokens: event.usage.output_tokens || 0,
                  costUsd: event.usage.cost_usd,
                };
              }
              toolsUsed = event.tools_used || event.agents_consulted || [];
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (accumulatedContent && isAISessionActive && logAIQuery) {
        logAIQuery(
          prompt,
          accumulatedContent,
          usageData ? 'ai-provider' : 'splunk-ai',
          usageData?.inputTokens || 0,
          usageData?.outputTokens || 0,
          {
            durationMs: Date.now() - startTime,
            toolsUsed,
            costUsd: usageData?.costUsd,
          },
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setContent(prev => prev || 'Analysis timed out. Click refresh to try again.');
      } else {
        console.error('Splunk AI analysis failed:', err);
        setContent('Unable to generate analysis. Click refresh to retry.');
      }
    } finally {
      clearTimeout(timeout);
      setStreaming(false);
    }
  }, [isAISessionActive, logAIQuery]);

  const buildPrompt = useCallback(() => {
    return `You are a Splunk operations analyst. Provide a concise executive intelligence briefing for this Splunk environment.

Current State:
- ${indexCount} indexes configured
- ${totalEventCount.toLocaleString()} total events
- ${sourceCount} unique sources, ${hostCount} hosts
- SAIA (Splunk AI Assistant): ${saiaAvailable ? 'Available' : 'Not configured'}
- AI Insights generated: ${insightCount}

Provide:
1. **Status Summary** — One-line health assessment
2. **Key Findings** — Top 3-4 observations about this environment
3. **Recommendations** — 1-2 actionable next steps

Keep it concise and actionable. Use bullet points.`;
  }, [indexCount, totalEventCount, sourceCount, hostCount, saiaAvailable, insightCount]);

  useEffect(() => {
    if (autoTriggered || !dataReady || indexCount === 0) return;
    setAutoTriggered(true);
    streamAnalysis(buildPrompt());
  }, [autoTriggered, dataReady, indexCount, buildPrompt, streamAnalysis]);

  const handleRefresh = useCallback(() => {
    sessionIdRef.current = `splunk-ai-${Date.now()}`;
    streamAnalysis(buildPrompt());
  }, [buildPrompt, streamAnalysis]);

  return (
    <div className="flex flex-col">
      {/* Title Row - matches DashboardCard pattern */}
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            AI Intelligence Briefing
          </h3>
          {streaming && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-full">
              <Zap className="w-2.5 h-2.5 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            disabled={streaming}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${streaming ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/chat-v2?q=Analyze+my+Splunk+environment')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition"
          >
            <MessageSquare className="w-3 h-3" />
            Deep Dive
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 transition-colors hover:border-cyan-300 dark:hover:border-cyan-500/30 focus-within:ring-2 focus-within:ring-cyan-500/40">
        <div className="min-h-[180px]">
          {streaming && !content && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Analyzing environment...</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Generating intelligence briefing</p>
              </div>
            </div>
          )}
          {content ? (
            <div className="relative">
              <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 space-y-2 [&_ul]:space-y-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:marker:text-cyan-400 [&_ol]:space-y-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:text-[13px] [&_li]:leading-snug [&_p]:text-[13px] [&_p]:leading-relaxed [&_strong]:text-slate-900 [&_strong]:dark:text-white [&_strong]:font-semibold [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:dark:text-white [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-white [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:dark:text-slate-100 [&_h3]:mt-2 [&_h3]:mb-1 [&_code]:text-[11px] [&_code]:bg-cyan-50 [&_code]:dark:bg-cyan-500/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-cyan-700 [&_code]:dark:text-cyan-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
              {streaming && (
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40">
                  <Loader2 className="w-3 h-3 text-cyan-500 animate-spin" />
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Generating...</span>
                </div>
              )}
            </div>
          ) : !streaming ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {indexCount === 0 ? 'Waiting for Splunk data...' : 'Ready to analyze'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {indexCount === 0 ? 'Data will stream in once connected' : 'Click Refresh to generate AI analysis'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

SplunkAIStreamPanel.displayName = 'SplunkAIStreamPanel';
export default SplunkAIStreamPanel;
