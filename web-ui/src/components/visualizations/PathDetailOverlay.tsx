'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Zap, Activity, Heart, Sparkles, X } from 'lucide-react';
import { NetworkPathFlow } from '../thousandeyes/NetworkPathFlow';
import {
  classifyZone,
  getLinkHealth,
  extractAsNumber,
  latencyColor,
  ZONE_CONFIG,
} from '../thousandeyes/types';
import type { TopologyNode, TopologyLink, PathHop } from '../thousandeyes/types';
import type { PathAgentTrace } from './hooks/useAIPathJourney';
import type { TEAnalysisPayload } from '@/app/chat-v2/hooks/useTEAnalysisIngestion';

// =============================================================================
// Props
// =============================================================================

interface PathDetailOverlayProps {
  trace: PathAgentTrace | null;
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function convertHopsToTopology(hops: PathHop[]): { nodes: TopologyNode[]; links: TopologyLink[] } {
  const nodes: TopologyNode[] = hops.map((hop, i) => {
    const zone = classifyZone(hop, i, hops.length);
    return {
      id: `hop-${hop.hopNumber ?? i + 1}`,
      label: hop.hostname || hop.ipAddress,
      ip: hop.ipAddress,
      zone,
      latency: hop.latency,
      loss: hop.loss,
      network: hop.network,
      hopNumber: hop.hopNumber ?? i + 1,
      prefix: hop.prefix,
      asNumber: extractAsNumber(hop.network),
    };
  });

  const links: TopologyLink[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const next = nodes[i + 1];
    links.push({
      from: nodes[i].id,
      to: next.id,
      latency: next.latency,
      loss: next.loss,
      health: getLinkHealth(next.latency, next.loss),
    });
  }

  return { nodes, links };
}

// =============================================================================
// Mini Stat Card
// =============================================================================

function MiniStat({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-[100px] p-2.5 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{value}</div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function PathDetailOverlay({ trace, isOpen, onClose }: PathDetailOverlayProps) {
  const router = useRouter();

  const { totalLatency, maxLoss, health, bottleneckIdx } = useMemo(() => {
    if (!trace) return { totalLatency: 0, maxLoss: 0, health: 'Healthy', bottleneckIdx: -1 };
    const hops = trace.hops;
    const total = hops.reduce((s, h) => s + h.latency, 0);
    const loss = Math.max(...hops.map(h => h.loss), 0);
    const h = loss > 5 ? 'Degraded' : total > 100 ? 'Elevated' : 'Healthy';
    let bIdx = -1;
    let maxLat = 0;
    hops.forEach((hop, i) => {
      if (hop.latency > maxLat) { maxLat = hop.latency; bIdx = i; }
    });
    if (maxLat <= 10) bIdx = -1; // Only mark bottleneck if significant
    return { totalLatency: total, maxLoss: loss, health: h, bottleneckIdx: bIdx };
  }, [trace]);

  const topology = useMemo(() => {
    if (!trace) return { nodes: [] as TopologyNode[], links: [] as TopologyLink[] };
    return convertHopsToTopology(trace.hops);
  }, [trace]);

  const handleAnalyzeWithAI = () => {
    if (!trace) return;

    const hopDetails = trace.hops.map(h =>
      `Hop ${h.hopNumber}: ${h.ipAddress}${h.hostname ? ` (${h.hostname})` : ''} — ${h.latency.toFixed(1)}ms latency, ${h.loss.toFixed(1)}% loss${h.network ? `, Network: ${h.network}` : ''}`
    ).join('\n');

    const message = `Analyze this network path from ${trace.agentName}:\n\nTotal Latency: ${totalLatency.toFixed(0)}ms | Hops: ${trace.hops.length} | Max Loss: ${maxLoss.toFixed(1)}% | Health: ${health}\n\nHop-by-hop path:\n${hopDetails}\n\nIdentify bottlenecks, potential issues, and recommend optimizations.`;

    const payload: TEAnalysisPayload = {
      message,
      context: {
        type: 'te_analysis',
        data: {
          category: 'path',
          title: `Path Analysis — ${trace.agentName}`,
          details: {
            Location: trace.agentName,
            'Total Latency': `${totalLatency.toFixed(0)}ms`,
            Hops: trace.hops.length,
            'Max Loss': `${maxLoss.toFixed(1)}%`,
            Health: health,
            'Agent ID': trace.agentId,
          },
          message,
        },
      },
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    router.push(`/chat-v2?new_session=true&te_analysis=${encodeURIComponent(encoded)}`);
  };

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!trace) return null;

  const healthColor = health === 'Degraded' ? 'text-red-500' : health === 'Elevated' ? 'text-amber-500' : 'text-emerald-500';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Blurred backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Centered card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl shadow-black/20 dark:shadow-black/50 flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label={`Path detail — ${trace.agentName}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-700/40 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10">
                    <Route className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Path Detail</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{trace.agentName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Summary stat cards */}
                <div className="grid grid-cols-4 gap-2">
                  <MiniStat label="Total Latency" value={`${totalLatency.toFixed(0)}ms`} icon={Zap} color={totalLatency > 100 ? 'text-red-500' : totalLatency > 50 ? 'text-amber-500' : 'text-cyan-500'} />
                  <MiniStat label="Hop Count" value={`${trace.hops.length}`} icon={Activity} color="text-blue-500" />
                  <MiniStat label="Max Loss" value={`${maxLoss.toFixed(1)}%`} icon={Activity} color={maxLoss > 5 ? 'text-red-500' : maxLoss > 1 ? 'text-amber-500' : 'text-emerald-500'} />
                  <MiniStat label="Health" value={health} icon={Heart} color={healthColor} />
                </div>

                {/* NetworkPathFlow SVG */}
                {topology.nodes.length > 0 && (
                  <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Path Flow</div>
                    <NetworkPathFlow nodes={topology.nodes} links={topology.links} />
                  </div>
                )}

                {/* Hop detail table */}
                <div className="rounded-xl border border-slate-200/50 dark:border-slate-700/30 bg-slate-50/60 dark:bg-slate-800/40 p-3">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">Hop Details</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
                          <th className="pr-2 pb-1.5 font-semibold w-8">#</th>
                          <th className="pr-2 pb-1.5 font-semibold">IP / Hostname</th>
                          <th className="pr-2 pb-1.5 font-semibold">Zone</th>
                          <th className="pr-2 pb-1.5 font-semibold">Network / ASN</th>
                          <th className="pr-2 pb-1.5 font-semibold text-right">Latency</th>
                          <th className="pb-1.5 font-semibold text-right">Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trace.hops.map((hop, i) => {
                          const zone = classifyZone(hop, i, trace.hops.length);
                          const zoneConfig = ZONE_CONFIG[zone];
                          const isBottleneck = i === bottleneckIdx;
                          const asn = extractAsNumber(hop.network);
                          return (
                            <tr
                              key={i}
                              className={`border-t border-slate-100 dark:border-slate-700/50 ${isBottleneck ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
                            >
                              <td className="pr-2 py-1.5 font-mono text-slate-400">{hop.hopNumber ?? i + 1}</td>
                              <td className="pr-2 py-1.5">
                                <div className="text-slate-700 dark:text-slate-300 font-mono font-medium">{hop.ipAddress}</div>
                                {hop.hostname && hop.hostname !== hop.ipAddress && (
                                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{hop.hostname}</div>
                                )}
                              </td>
                              <td className="pr-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zoneConfig.dotColorHex }} />
                                  <span className={`text-[10px] font-medium ${zoneConfig.color}`}>{zoneConfig.label}</span>
                                </div>
                              </td>
                              <td className="pr-2 py-1.5 text-slate-500 dark:text-slate-400">
                                {asn && <span className="text-cyan-600 dark:text-cyan-400 font-mono mr-1">AS{asn}</span>}
                                <span className="truncate">{hop.network?.replace(/AS\s*\d+\s*/i, '').trim() || '—'}</span>
                              </td>
                              <td className={`pr-2 py-1.5 text-right font-mono font-semibold ${latencyColor(hop.latency)}`}>
                                {hop.latency.toFixed(1)}ms
                              </td>
                              <td className={`py-1.5 text-right font-mono font-semibold ${hop.loss > 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {hop.loss.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Sticky footer with AI button */}
              <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-200/60 dark:border-slate-700/40 bg-slate-50/80 dark:bg-slate-800/80">
                <button
                  onClick={handleAnalyzeWithAI}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  Analyze with AI
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
