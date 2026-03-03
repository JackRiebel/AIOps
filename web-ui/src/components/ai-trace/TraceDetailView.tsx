'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { AITraceDetail, AITraceSpan, WaterfallBar } from '@/types/ai-trace';
import { PLATFORM_COLORS } from '@/types/ai-trace';
import type { JourneyCostSummary } from '@/types/journey-flow';
import { WaterfallView } from './WaterfallView';
import { NetworkPathsDashboard } from './NetworkPathsDashboard';
import { JourneyFlowView } from './JourneyFlowView';
import {
  ArrowLeft,
  Clock,
  Wifi,
  Activity,
  Wrench,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type TabKey = 'flow' | 'network' | 'waterfall';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'flow', label: 'Journey Flow' },
  { key: 'network', label: 'Network Paths' },
  { key: 'waterfall', label: 'Waterfall' },
];

interface TraceDetailViewProps {
  trace: AITraceDetail;
  waterfall: WaterfallBar[];
  costSummary?: JourneyCostSummary | null;
}

export function TraceDetailView({ trace, waterfall, costSummary }: TraceDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('flow');

  const root = trace.root_span;
  const query = (root.metadata?.query as string) || root.span_name || 'AI Query';
  const isSuccess = root.status === 'success';
  const toolStats = collectToolStats(root);

  // Derive network timing from spans when costSummary is missing or has 0 network latency
  const networkLatencyMs = useMemo(() => {
    if (costSummary?.totalNetworkTaxMs) return costSummary.totalNetworkTaxMs;
    let total = 0, count = 0;
    function walk(span: AITraceSpan) {
      const tcp = span.tcp_connect_ms || 0;
      const tls = span.tls_ms || 0;
      if (tcp > 0 || tls > 0) { total += tcp + tls; count++; }
      span.children?.forEach(walk);
    }
    walk(trace.root_span);
    return count > 0 ? total / count : null;
  }, [trace, costSummary]);

  const pathHealth = useMemo(() => {
    if (costSummary?.networkTaxPct != null && costSummary.networkTaxPct > 0) {
      return costSummary.networkTaxPct > 5 ? 'Degraded' : costSummary.networkTaxPct > 1 ? 'Fair' : 'Healthy';
    }
    if (networkLatencyMs != null) {
      return networkLatencyMs > 100 ? 'Degraded' : networkLatencyMs > 50 ? 'Fair' : 'Healthy';
    }
    return null;
  }, [costSummary, networkLatencyMs]);

  const pathHealthClass = useMemo(() => {
    if (!pathHealth) return undefined;
    return pathHealth === 'Degraded' ? 'text-red-600 dark:text-red-400'
      : pathHealth === 'Fair' ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';
  }, [pathHealth]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/thousandeyes?tab=platform"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            AI Journey
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
            Trace #{trace.trace_id.slice(0, 8)}
          </span>
        </div>

        {/* Status + query */}
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-medium shrink-0">
              <CheckCircle className="w-3.5 h-3.5" /> Success
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-medium shrink-0">
              <XCircle className="w-3.5 h-3.5" /> {root.status}
            </span>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {query}
          </p>
        </div>

        {/* Stat cards strip */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={<Clock className="w-4 h-4 text-blue-500" />}
            label="Duration"
            value={root.duration_ms ? `${(root.duration_ms / 1000).toFixed(1)}s` : 'Running'}
          />
          <StatCard
            icon={<Wifi className="w-4 h-4 text-blue-500" />}
            label="Network Latency"
            value={networkLatencyMs != null ? `${networkLatencyMs.toFixed(0)}ms` : '—'}
            valueClass={networkLatencyMs != null && networkLatencyMs > 100 ? 'text-red-600 dark:text-red-400' : networkLatencyMs != null && networkLatencyMs > 50 ? 'text-amber-600 dark:text-amber-400' : undefined}
          />
          <StatCard
            icon={<Activity className="w-4 h-4 text-emerald-500" />}
            label="Path Health"
            value={pathHealth || '—'}
            valueClass={pathHealthClass}
          />
          <StatCard
            icon={<Wrench className="w-4 h-4 text-amber-500" />}
            label="Tool Calls"
            value={`${trace.tool_count}`}
          />
        </div>

        {/* Platform chips */}
        {Object.keys(toolStats).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(toolStats).map(([platform, stats]) => (
              <span
                key={platform}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[platform] || '#94a3b8' }}
                />
                <span className="capitalize">{platform}</span>
                <span className="text-slate-400 dark:text-slate-500 font-mono">
                  {stats.success}{stats.failed > 0 ? `/${stats.failed}f` : ''}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Pill tab bar */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'flow' && (
          <JourneyFlowView trace={trace} waterfall={waterfall} costSummary={costSummary} />
        )}

        {activeTab === 'network' && (
          <NetworkPathsDashboard trace={trace} waterfall={waterfall} />
        )}

        {activeTab === 'waterfall' && (
          <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/40 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Waterfall Timeline
            </h2>
            <WaterfallView bars={waterfall} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-gray-800/80 shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</div>
        <div className={`text-sm font-semibold font-mono ${valueClass || 'text-slate-800 dark:text-slate-200'}`}>{value}</div>
      </div>
    </div>
  );
}

interface ToolPlatformStats {
  success: number;
  failed: number;
}

function collectToolStats(span: AITraceSpan): Record<string, ToolPlatformStats> {
  const stats: Record<string, ToolPlatformStats> = {};

  function walk(node: AITraceSpan) {
    if (node.span_type === 'tool_execution') {
      const platform = node.tool_platform || 'other';
      if (!stats[platform]) stats[platform] = { success: 0, failed: 0 };
      if (node.tool_success === false) {
        stats[platform].failed++;
      } else {
        stats[platform].success++;
      }
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(span);
  return stats;
}
