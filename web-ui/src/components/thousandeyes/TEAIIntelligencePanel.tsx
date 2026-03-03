'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Loader2, AlertTriangle, CheckCircle, Activity, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { CrossPlatformInsight, TestHealthCell } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEAIIntelligencePanelProps {
  testCount: number;
  activeAlerts: number;
  agentsOnline: number;
  agentsTotal: number;
  eventCount: number;
  outageCount: number;
  healthScore: number;
  crossPlatformInsights: CrossPlatformInsight[];
  testHealthData: TestHealthCell[];
  externalQuery: string | null;
  onExternalQueryConsumed: () => void;
  dataReady: boolean;
  splunkCorrelation?: { splunkMatches: Array<{ host: string; count: string | number }>; correlatedDevices: any[] } | null;
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
// Persistent Stats Bar (always visible)
// ============================================================================

function StatsBar({
  healthScore, testCount, activeAlerts, agentsOnline, agentsTotal, outageCount,
}: Pick<TEAIIntelligencePanelProps, 'healthScore' | 'testCount' | 'activeAlerts' | 'agentsOnline' | 'agentsTotal' | 'outageCount'>) {
  const overallStatus = healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'degraded' : 'critical';
  const statusColor = overallStatus === 'healthy'
    ? 'text-green-600 dark:text-green-400'
    : overallStatus === 'degraded'
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';
  const statusBg = overallStatus === 'healthy'
    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
    : overallStatus === 'degraded'
    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20';
  const StatusIcon = overallStatus === 'healthy' ? CheckCircle : overallStatus === 'degraded' ? Activity : AlertTriangle;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${statusBg}`}>
      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
      <span className={`text-xs font-semibold ${statusColor}`}>
        {healthScore}%
      </span>
      <div className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span><strong className="text-slate-700 dark:text-slate-200">{testCount}</strong> tests</span>
        <span><strong className={activeAlerts > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}>{activeAlerts}</strong> alerts</span>
        <span><strong className="text-slate-700 dark:text-slate-200">{agentsOnline}/{agentsTotal}</strong> agents</span>
        {outageCount > 0 && (
          <span><strong className="text-amber-600 dark:text-amber-400">{outageCount}</strong> outages</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Structured Insights (bullet points from data)
// ============================================================================

function StructuredInsights({
  activeAlerts, agentsOnline, agentsTotal,
  eventCount, outageCount, crossPlatformInsights, splunkCorrelation,
}: Omit<TEAIIntelligencePanelProps, 'externalQuery' | 'onExternalQueryConsumed' | 'dataReady' | 'testCount' | 'healthScore' | 'testHealthData'>) {
  const insights: { icon: typeof AlertTriangle; color: string; text: string }[] = [];

  if (activeAlerts > 0) {
    insights.push({ icon: AlertTriangle, color: 'text-red-500', text: `${activeAlerts} active alert${activeAlerts > 1 ? 's' : ''} requiring attention` });
  }
  if (outageCount > 0) {
    insights.push({ icon: AlertTriangle, color: 'text-amber-500', text: `${outageCount} outage${outageCount > 1 ? 's' : ''} affecting services` });
  }
  if (agentsTotal > 0 && agentsOnline < agentsTotal) {
    const offline = agentsTotal - agentsOnline;
    insights.push({ icon: Activity, color: 'text-amber-500', text: `${offline} of ${agentsTotal} agent${agentsTotal > 1 ? 's' : ''} offline` });
  }
  if (agentsTotal > 0 && agentsOnline === agentsTotal) {
    insights.push({ icon: CheckCircle, color: 'text-green-500', text: `All ${agentsTotal} agents online` });
  }
  if (eventCount > 0) {
    insights.push({ icon: Activity, color: 'text-blue-500', text: `${eventCount} network event${eventCount > 1 ? 's' : ''} detected` });
  }
  for (const insight of crossPlatformInsights.slice(0, 3)) {
    const color = insight.severity === 'critical' ? 'text-red-500' : insight.severity === 'warning' ? 'text-amber-500' : 'text-blue-500';
    const icon = insight.severity === 'critical' ? AlertTriangle : insight.severity === 'warning' ? Activity : Shield;
    insights.push({ icon, color, text: `${insight.title}: ${insight.description}` });
  }
  if (splunkCorrelation && splunkCorrelation.splunkMatches.length > 0) {
    insights.push({
      icon: Shield, color: 'text-orange-500',
      text: `${splunkCorrelation.splunkMatches.length} TE agent IPs found in Splunk logs`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-1">
      {insights.slice(0, 5).map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <item.icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${item.color}`} />
          <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export const TEAIIntelligencePanel = memo(({
  testCount, activeAlerts, agentsOnline, agentsTotal,
  eventCount, outageCount, healthScore,
  crossPlatformInsights, testHealthData, externalQuery, onExternalQueryConsumed,
  dataReady, splunkCorrelation, logAIQuery, isAISessionActive,
}: TEAIIntelligencePanelProps) => {
  const [content, setContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [queryLabel, setQueryLabel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(`te-insight-${Date.now()}`);

  // ============================================================================
  // Stream AI response
  // ============================================================================

  const streamResponse = useCallback(async (prompt: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    const startTime = Date.now();

    setContent('');
    setStreaming(true);
    setAiFailed(false);

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
      let gotContent = false;

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
              gotContent = true;
              accumulatedContent += event.text;
              setContent(prev => prev + event.text);
            } else if (event.type === 'tool_use_start' && event.tool) {
              // Show tool activity so user knows work is happening
              setContent(prev => prev + `\n\n*Querying ${event.tool}...*\n\n`);
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

      if (!gotContent) setAiFailed(true);

      // Log to AI session if active
      if (gotContent && isAISessionActive && logAIQuery) {
        logAIQuery(
          prompt,
          accumulatedContent,
          usageData ? 'ai-provider' : 'thousandeyes-ai',
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
      clearTimeout(timeout);
      setAiFailed(true);
      if (err.name === 'AbortError') { setStreaming(false); return; }
      console.error('AI analysis failed:', err);
    } finally {
      clearTimeout(timeout);
      setStreaming(false);
    }
  }, [isAISessionActive, logAIQuery]);

  // ============================================================================
  // Build auto-analysis prompt
  // ============================================================================

  const buildAutoPrompt = useCallback(() => {
    const insightsSummary = crossPlatformInsights.length > 0
      ? crossPlatformInsights.map(i => `- ${i.title}: ${i.description}`).join('\n')
      : 'No cross-platform data available';

    let splunkContext = '';
    if (splunkCorrelation && splunkCorrelation.splunkMatches.length > 0) {
      const topMatches = splunkCorrelation.splunkMatches.slice(0, 5);
      splunkContext = `\nSplunk Log Correlation:\n- ${splunkCorrelation.splunkMatches.length} TE agent IPs found in Splunk logs\n- Top hosts: ${topMatches.map(m => `${m.host} (${m.count} events)`).join(', ')}\n- ${splunkCorrelation.correlatedDevices.length} devices correlated across platforms`;
    }

    // Build per-test details
    const healthCounts = { healthy: 0, degraded: 0, failing: 0, disabled: 0 };
    const testLines = testHealthData.map(t => {
      healthCounts[t.health]++;
      const metrics: string[] = [];
      if (t.latestMetrics?.latency != null) metrics.push(`latency: ${t.latestMetrics.latency}ms`);
      if (t.latestMetrics?.loss != null) metrics.push(`loss: ${t.latestMetrics.loss}%`);
      if (t.latestMetrics?.availability != null) metrics.push(`avail: ${t.latestMetrics.availability}%`);
      return `- "${t.testName}" (${t.type}) — ${t.health}${metrics.length ? ` | ${metrics.join(', ')}` : ''}`;
    }).join('\n');

    const statusLine = [
      healthCounts.healthy > 0 ? `${healthCounts.healthy} healthy` : '',
      healthCounts.degraded > 0 ? `${healthCounts.degraded} degraded` : '',
      healthCounts.failing > 0 ? `${healthCounts.failing} failing` : '',
      healthCounts.disabled > 0 ? `${healthCounts.disabled} disabled` : '',
    ].filter(Boolean).join(', ');

    return `You are a network operations analyst. These tests monitor DIFFERENT, UNRELATED targets (home networks, AI services, IoT devices, BGP routes). Do NOT summarize them collectively — call out each test individually by name with its specific metrics and status.

Overview: ${statusLine} (${testCount} total)
Active alerts: ${activeAlerts} | Agents: ${agentsOnline}/${agentsTotal} online | Events: ${eventCount} | Outages: ${outageCount}

Individual tests:
${testLines}

Cross-platform insights:
${insightsSummary}${splunkContext}

Format:
1. Start with one line: "X of Y tests healthy" (or note any failing/degraded).
2. Then a bullet for EACH test that has notable metrics — mention the test by name, its latency, loss, and any concerns. Skip tests that are disabled or have no data.
3. Flag any test with loss > 1%, latency > 100ms, or degraded/failing status.
4. End with one priority recommendation if applicable.
Keep it under 200 words. Be specific, not generic.`;
  }, [testCount, activeAlerts, agentsOnline, agentsTotal, eventCount, outageCount, crossPlatformInsights, testHealthData, splunkCorrelation]);

  // Auto-trigger once on initial data load — buildAutoPrompt is called imperatively,
  // not as a reactive dependency, so we exclude it to prevent re-triggers.
  const buildAutoPromptRef = useRef(buildAutoPrompt);
  buildAutoPromptRef.current = buildAutoPrompt;

  useEffect(() => {
    if (autoTriggered || !dataReady) return;
    setAutoTriggered(true);
    setQueryLabel(null);
    streamResponse(buildAutoPromptRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggered, dataReady, streamResponse]);

  // Handle external queries from command header or data point clicks
  useEffect(() => {
    if (!externalQuery) return;
    onExternalQueryConsumed();
    setQueryLabel(externalQuery);
    sessionIdRef.current = `te-insight-${Date.now()}`;

    // If the query already contains test data (from data point click), wrap it
    // with instructions to analyze directly instead of calling tools
    const isDataPointQuery = externalQuery.includes('**Test Information:**') || externalQuery.includes('**Metrics at this time:**');
    const prompt = isDataPointQuery
      ? `You are a ThousandEyes network analyst. All the data you need is provided below — analyze it directly without calling any tools. Do NOT say "let me investigate" or "let me gather data". Jump straight into the analysis.\n\n${externalQuery}\n\nRespond with:\n1. A direct, specific answer to the question\n2. The most likely root cause based on the metrics provided\n3. One actionable recommendation\nKeep it under 150 words. Be specific, not generic.`
      : externalQuery;

    streamResponse(prompt);
  }, [externalQuery, onExternalQueryConsumed, streamResponse]);

  // Regenerate
  const handleRegenerate = useCallback(() => {
    setQueryLabel(null);
    sessionIdRef.current = `te-insight-${Date.now()}`;
    streamResponse(buildAutoPrompt());
  }, [buildAutoPrompt, streamResponse]);

  // ============================================================================
  // Render
  // ============================================================================

  const badge = (
    <div className="flex items-center gap-2">
      {splunkCorrelation && splunkCorrelation.splunkMatches.length > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
          Splunk
        </span>
      )}
      {!streaming && (content || dataReady) && (
        <button
          onClick={handleRegenerate}
          className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:hover:text-purple-400 transition"
          title="Refresh analysis"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <DashboardCard
      title="Network Insights"
      icon={<Sparkles className="w-4 h-4" />}
      accent="purple"
      compact
      badge={badge}
    >
      <div className="space-y-3">
        {/* Persistent stats bar — always visible */}
        {dataReady && (
          <StatsBar
            healthScore={healthScore}
            testCount={testCount}
            activeAlerts={activeAlerts}
            agentsOnline={agentsOnline}
            agentsTotal={agentsTotal}
            outageCount={outageCount}
          />
        )}

        {/* External query label */}
        {queryLabel && (
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/40">
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 truncate">
              {queryLabel}
            </span>
          </div>
        )}

        {/* AI Content */}
        {content && (
          <div className="relative">
            <div className="te-insights-prose text-[13px] leading-relaxed text-slate-700 dark:text-slate-200 space-y-2 [&_ul]:space-y-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:marker:text-purple-400 [&_ol]:space-y-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:text-[13px] [&_li]:leading-snug [&_p]:text-[13px] [&_p]:leading-relaxed [&_strong]:text-slate-900 [&_strong]:dark:text-white [&_strong]:font-semibold [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:dark:text-white [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-white [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:dark:text-slate-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
            {streaming && (
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/40">
                <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
                <span className="text-[10px] text-purple-500">Generating...</span>
              </div>
            )}
          </div>
        )}

        {/* Streaming without content yet — show structured insights as placeholder */}
        {!content && streaming && dataReady && (
          <div>
            <StructuredInsights
              activeAlerts={activeAlerts} agentsOnline={agentsOnline} agentsTotal={agentsTotal}
              eventCount={eventCount} outageCount={outageCount}
              crossPlatformInsights={crossPlatformInsights} splunkCorrelation={splunkCorrelation}
            />
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/40">
              <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">AI analysis loading...</span>
            </div>
          </div>
        )}

        {/* Waiting for data */}
        {!content && !streaming && !dataReady && (
          <div className="flex flex-col items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-slate-300 dark:text-slate-600 animate-spin mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-500">Loading network data...</p>
          </div>
        )}

        {/* Data ready, no AI — show structured insights */}
        {!content && !streaming && dataReady && (
          <StructuredInsights
            activeAlerts={activeAlerts} agentsOnline={agentsOnline} agentsTotal={agentsTotal}
            eventCount={eventCount} outageCount={outageCount}
            crossPlatformInsights={crossPlatformInsights} splunkCorrelation={splunkCorrelation}
          />
        )}
      </div>
    </DashboardCard>
  );
});

TEAIIntelligencePanel.displayName = 'TEAIIntelligencePanel';
export default TEAIIntelligencePanel;
