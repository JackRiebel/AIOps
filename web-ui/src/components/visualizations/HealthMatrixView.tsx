'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Server,
  Globe,
  Database,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Radio,
  Wifi,
  MapPin,
  Link2,
  Zap,
  Clock,
  Activity,
  XCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import type { VisualizationHubState } from './useVisualizationHub';
import type { HealthMatrixRow } from '@/types/visualization';
import { isEnabled, isAgentOnline } from '@/components/thousandeyes/types';

// ============================================================================
// Types
// ============================================================================

interface HealthMatrixViewProps {
  hub: VisualizationHubState;
}

type SortBy = 'name' | 'platform' | 'health' | 'alerts';
type ViewMode = 'matrix' | 'agents' | 'outages' | 'insights';

// ============================================================================
// Platform Health Card
// ============================================================================

function PlatformHealthCard({ label, icon: Icon, configured, deviceCount, onlinePercent, color, subtitle }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  configured: boolean;
  deviceCount: number;
  onlinePercent: number;
  color: string;
  subtitle?: string;
}) {
  const healthColor = !configured ? 'bg-slate-400' : onlinePercent >= 90 ? 'bg-emerald-500' : onlinePercent >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const barColor = !configured ? 'bg-slate-300 dark:bg-slate-600' : onlinePercent >= 90 ? 'bg-emerald-500' : onlinePercent >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <span style={{ color }}><Icon className="w-4 h-4" /></span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {configured ? (subtitle || `${deviceCount} devices`) : 'Not configured'}
            </div>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${healthColor}`} />
      </div>

      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: configured ? `${onlinePercent}%` : '0%' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {configured ? `${onlinePercent}% online` : '--'}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {configured ? deviceCount : 0}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Health Matrix Row
// ============================================================================

function MatrixRow({ row, expanded, onToggle }: {
  row: HealthMatrixRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const platformIcon = row.platform === 'meraki' ? Shield
    : row.platform === 'thousandeyes' ? Globe
    : Server;
  const platformColor = row.platform === 'meraki' ? '#22c55e'
    : row.platform === 'thousandeyes' ? '#ff6b35'
    : '#3b82f6';

  const healthBg = row.worstHealth === 'healthy' ? 'bg-emerald-500'
    : row.worstHealth === 'degraded' ? 'bg-amber-500'
    : row.worstHealth === 'critical' ? 'bg-red-500'
    : 'bg-slate-400';

  const PlatformIcon = platformIcon;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/20 rounded-lg transition group"
      >
        <div className="text-slate-400">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>

        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${platformColor}15` }}>
          <span style={{ color: platformColor }}><PlatformIcon className="w-3 h-3" /></span>
        </div>

        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1 text-left min-w-0">
          {row.name}
        </span>

        {/* Entity type badge */}
        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400 flex-shrink-0">
          {row.entityType}
        </span>

        {/* Health cells */}
        <div className="flex gap-0.5 flex-shrink-0">
          {row.cells.slice(0, 24).map((cell, i) => {
            const cellColor = cell.status === 'healthy' ? 'bg-emerald-500'
              : cell.status === 'degraded' ? 'bg-amber-500'
              : cell.status === 'critical' ? 'bg-red-500'
              : 'bg-slate-300 dark:bg-slate-600';

            return (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${cellColor} transition-all hover:scale-150 cursor-pointer`}
                title={`${cell.timestamp}: ${cell.status}${cell.metrics?.latency ? ` (${cell.metrics.latency.toFixed(0)}ms)` : ''}`}
              />
            );
          })}
        </div>

        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthBg}`} />

        {row.alertCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-full flex-shrink-0">
            {row.alertCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-12 mr-3 mb-2 p-3 bg-slate-50 dark:bg-slate-700/20 rounded-lg">
              <div className="grid grid-cols-4 gap-3 text-xs">
                {row.cells.slice(-4).map((cell, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      {new Date(cell.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`text-xs font-medium ${
                      cell.status === 'healthy' ? 'text-emerald-500'
                        : cell.status === 'degraded' ? 'text-amber-500'
                        : cell.status === 'critical' ? 'text-red-500'
                        : 'text-slate-400'
                    }`}>
                      {cell.status.charAt(0).toUpperCase() + cell.status.slice(1)}
                    </div>
                    {cell.metrics?.latency !== undefined && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {cell.metrics.latency.toFixed(0)}ms latency
                      </div>
                    )}
                    {cell.metrics?.loss !== undefined && cell.metrics.loss > 0 && (
                      <div className="text-[10px] text-red-400">
                        {cell.metrics.loss.toFixed(1)}% loss
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// TE Agent Card — shows agent details and stats
// ============================================================================

function TEAgentCard({ agent, hub }: { agent: any; hub: VisualizationHubState }) {
  const online = isAgentOnline(agent);
  const agentAlerts = hub.teAlerts.filter(a => a.active && a.agents?.some((ag: any) => ag.agentId === agent.agentId));
  const agentTests = hub.teTests.filter(t => t.agents?.some((a: any) => a.agentId === agent.agentId));

  // Get latest test results for tests this agent runs
  const latestMetrics: { latency: number; loss: number; jitter: number }[] = [];
  agentTests.forEach(test => {
    const results = hub.teTestResults[test.testId];
    if (results && results.length > 0) {
      const latest = results[results.length - 1];
      latestMetrics.push({
        latency: latest.latency || 0,
        loss: latest.loss || 0,
        jitter: latest.jitter || 0,
      });
    }
  });

  const avgLatency = latestMetrics.length > 0 ? latestMetrics.reduce((s, m) => s + m.latency, 0) / latestMetrics.length : 0;
  const avgLoss = latestMetrics.length > 0 ? latestMetrics.reduce((s, m) => s + m.loss, 0) / latestMetrics.length : 0;
  const avgJitter = latestMetrics.length > 0 ? latestMetrics.reduce((s, m) => s + m.jitter, 0) / latestMetrics.length : 0;

  // Find correlated device if any
  const correlated = hub.teCorrelatedDevices.find(c => c.teAgent?.agentId === agent.agentId);

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-lg border p-3 transition-shadow hover:shadow-md ${
      !online ? 'border-red-300 dark:border-red-500/30' : agentAlerts.length > 0 ? 'border-amber-300 dark:border-amber-500/30' : 'border-slate-200 dark:border-slate-700/50'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
            {agent.agentName}
          </span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
          online ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Agent details */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <Radio className="w-2.5 h-2.5" />
          <span>{agent.agentType || 'Enterprise'}</span>
          {agent.location && <><span className="text-slate-300 dark:text-slate-600">|</span><MapPin className="w-2.5 h-2.5" /><span>{agent.location}</span></>}
        </div>
        {agent.ipAddresses?.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            <Wifi className="w-2.5 h-2.5" />
            <span>{agent.ipAddresses.slice(0, 2).join(', ')}</span>
          </div>
        )}
        {correlated && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <Link2 className="w-2.5 h-2.5 text-slate-400" />
            {correlated.merakiDevice && <span className="text-emerald-500">Meraki: {correlated.merakiDevice.name}</span>}
            {correlated.catalystDevice && <span className="text-blue-500">Catalyst: {correlated.catalystDevice.name}</span>}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-slate-50 dark:bg-slate-700/30 rounded px-2 py-1">
          <div className="text-[9px] text-slate-400">Tests</div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{agentTests.length}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/30 rounded px-2 py-1">
          <div className="text-[9px] text-slate-400">Latency</div>
          <div className={`text-xs font-semibold ${avgLatency > 100 ? 'text-red-500' : avgLatency > 50 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {avgLatency > 0 ? `${avgLatency.toFixed(0)}ms` : '--'}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/30 rounded px-2 py-1">
          <div className="text-[9px] text-slate-400">Loss</div>
          <div className={`text-xs font-semibold ${avgLoss > 1 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
            {avgLoss > 0 ? `${avgLoss.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      {/* Alert badges */}
      {agentAlerts.length > 0 && (
        <div className="mt-2 space-y-1">
          {agentAlerts.slice(0, 2).map((alert, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[9px] text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span className="truncate">{alert.testName}: {alert.ruleExpression}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Outage Card
// ============================================================================

function OutageCard({ outage }: { outage: any }) {
  const isActive = !outage.endDate;
  const duration = outage.endDate
    ? Math.round((new Date(outage.endDate).getTime() - new Date(outage.startDate).getTime()) / 60000)
    : Math.round((Date.now() - new Date(outage.startDate).getTime()) / 60000);
  const durationText = duration > 1440 ? `${(duration / 1440).toFixed(1)}d` : duration > 60 ? `${(duration / 60).toFixed(1)}h` : `${duration}m`;

  return (
    <div className={`rounded-lg border-l-3 p-3 ${
      isActive ? 'bg-red-500/5 border-red-500 border' : 'bg-slate-50 dark:bg-slate-700/20 border-slate-300 dark:border-slate-600 border'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isActive ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          <span className={`text-[10px] font-semibold uppercase ${isActive ? 'text-red-500' : 'text-emerald-500'}`}>
            {isActive ? 'Active Outage' : 'Resolved'}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {durationText}
        </span>
      </div>

      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {outage.provider || outage.type || 'Network Outage'}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
        {outage.server && <span>Server: {outage.server}</span>}
        <span>{outage.affectedTests} tests affected</span>
        {outage.affectedInterfaces > 0 && <span>{outage.affectedInterfaces} interfaces</span>}
      </div>

      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-500 mt-1">
        <Clock className="w-2.5 h-2.5" />
        <span>Started: {new Date(outage.startDate).toLocaleString()}</span>
        {outage.endDate && <span> | Ended: {new Date(outage.endDate).toLocaleString()}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Cross-Platform Insight Card
// ============================================================================

function InsightCard({ insight }: { insight: any }) {
  const sevColor = insight.severity === 'critical' ? 'border-red-500 bg-red-500/5'
    : insight.severity === 'warning' ? 'border-amber-500 bg-amber-500/5'
    : 'border-cyan-500 bg-cyan-500/5';
  const sevIcon = insight.severity === 'critical' ? AlertTriangle
    : insight.severity === 'warning' ? AlertTriangle
    : Info;
  const SevIcon = sevIcon;

  return (
    <div className={`rounded-lg border-l-3 p-3 border ${sevColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <SevIcon className={`w-3.5 h-3.5 ${
          insight.severity === 'critical' ? 'text-red-500' : insight.severity === 'warning' ? 'text-amber-500' : 'text-cyan-500'
        }`} />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{insight.title}</span>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">{insight.description}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {insight.platforms?.map((p: string) => (
          <span key={p} className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400">
            {p}
          </span>
        ))}
        {insight.category && (
          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400 italic">
            {insight.category}
          </span>
        )}
      </div>
      {insight.relatedItems?.length > 0 && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {insight.relatedItems.slice(0, 3).map((item: any, i: number) => (
            <span key={i} className="text-[9px] text-cyan-500">{item.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Health Matrix View
// ============================================================================

export function HealthMatrixView({ hub }: HealthMatrixViewProps) {
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('health');
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  // Build matrix rows from all platforms
  const matrixRows = useMemo((): HealthMatrixRow[] => {
    const rows: HealthMatrixRow[] = [];
    const now = Date.now();

    // Meraki devices
    hub.topologyNodes.filter(n => !n.isClient).forEach(node => {
      const status = node.status === 'online' ? 'healthy'
        : node.status === 'alerting' ? 'degraded'
        : node.status === 'offline' ? 'critical'
        : 'unknown';

      const cells = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (23 - i) * 3600000).toISOString(),
        status: status as 'healthy' | 'degraded' | 'critical' | 'unknown',
        metrics: undefined,
      }));

      const annotation = hub.deviceAnnotations.get(node.id);

      rows.push({
        id: `meraki-${node.id}`,
        name: node.name || node.serial,
        platform: 'meraki',
        entityType: 'device',
        cells,
        worstHealth: status as 'healthy' | 'degraded' | 'critical' | 'unknown',
        alertCount: annotation?.teAlertCount || 0,
      });
    });

    // ThousandEyes tests — use REAL test results for heatmap cells
    hub.teTestHealth.forEach(cell => {
      const testResults = hub.teTestResults[cell.testId] || [];
      const status = cell.health === 'healthy' ? 'healthy'
        : cell.health === 'degraded' ? 'degraded'
        : cell.health === 'failing' ? 'critical'
        : 'unknown';

      let cells;
      if (testResults.length > 0) {
        // Build cells from actual test results, bucketed into 24 time slots
        const slotDuration = 3600000; // 1 hour
        cells = Array.from({ length: 24 }, (_, i) => {
          const slotStart = now - (23 - i) * slotDuration;
          const slotEnd = slotStart + slotDuration;
          const slotResults = testResults.filter(r => {
            const t = new Date(r.timestamp).getTime();
            return t >= slotStart && t < slotEnd;
          });

          if (slotResults.length === 0) {
            return {
              timestamp: new Date(slotStart).toISOString(),
              status: 'unknown' as const,
              metrics: undefined,
            };
          }

          const avgLatency = slotResults.reduce((s, r) => s + (r.latency || 0), 0) / slotResults.length;
          const avgLoss = slotResults.reduce((s, r) => s + (r.loss || 0), 0) / slotResults.length;
          const avgAvail = slotResults.reduce((s, r) => s + (r.availability || 100), 0) / slotResults.length;

          const slotStatus = avgLoss > 5 || avgAvail < 90 ? 'critical'
            : avgLoss > 1 || avgLatency > 100 || avgAvail < 99 ? 'degraded'
            : 'healthy';

          return {
            timestamp: new Date(slotStart).toISOString(),
            status: slotStatus as 'healthy' | 'degraded' | 'critical',
            metrics: { latency: avgLatency, loss: avgLoss, availability: avgAvail },
          };
        });
      } else {
        // Fallback: show current status
        cells = Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(now - (23 - i) * 3600000).toISOString(),
          status: status as 'healthy' | 'degraded' | 'critical' | 'unknown',
          metrics: cell.latestMetrics ? {
            latency: cell.latestMetrics.latency,
            loss: cell.latestMetrics.loss,
            availability: cell.latestMetrics.availability,
          } : undefined,
        }));
      }

      rows.push({
        id: `te-${cell.testId}`,
        name: cell.testName,
        platform: 'thousandeyes',
        entityType: 'test',
        cells,
        worstHealth: status as 'healthy' | 'degraded' | 'critical' | 'unknown',
        alertCount: hub.teAlerts.filter(a => a.active && a.testId === cell.testId).length,
      });
    });

    // TE agents
    hub.teAgents.forEach(agent => {
      const online = isAgentOnline(agent);
      const status = online ? 'healthy' : 'critical';

      const cells = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now - (23 - i) * 3600000).toISOString(),
        status: status as 'healthy' | 'critical',
        metrics: undefined,
      }));

      // Count alerts for this agent
      const agentAlertCount = hub.teAlerts.filter(a => a.active && a.agents?.some((ag: any) => ag.agentId === agent.agentId)).length;

      rows.push({
        id: `agent-${agent.agentId}`,
        name: agent.agentName,
        platform: 'thousandeyes',
        entityType: 'agent',
        cells,
        worstHealth: status,
        alertCount: agentAlertCount,
      });
    });

    return rows;
  }, [hub.topologyNodes, hub.teTestHealth, hub.teAgents, hub.teAlerts, hub.deviceAnnotations, hub.teTestResults]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const healthOrder: Record<string, number> = { critical: 0, degraded: 1, unknown: 2, healthy: 3 };
    return [...matrixRows].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'platform': return a.platform.localeCompare(b.platform);
        case 'health': return (healthOrder[a.worstHealth] ?? 4) - (healthOrder[b.worstHealth] ?? 4);
        case 'alerts': return b.alertCount - a.alertCount;
        default: return 0;
      }
    });
  }, [matrixRows, sortBy]);

  // Active alerts combined
  const activeAlerts = useMemo(() => {
    const alerts: { id: string; title: string; severity: string; platform: string; timestamp: string }[] = [];

    hub.teAlerts.filter(a => a.active).forEach(a => {
      alerts.push({
        id: `te-alert-${a.alertId}`,
        title: `${a.testName}: ${a.ruleExpression}`,
        severity: a.severity || 'warning',
        platform: 'ThousandEyes',
        timestamp: a.dateStart,
      });
    });

    hub.splunkInsights.slice(0, 5).forEach((insight: any, i: number) => {
      alerts.push({
        id: `splunk-insight-${i}`,
        title: insight.title || insight.summary || 'Splunk Insight',
        severity: insight.severity || 'info',
        platform: 'Splunk',
        timestamp: insight.timestamp || new Date().toISOString(),
      });
    });

    return alerts.sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, major: 1, warning: 2, minor: 3, info: 4 };
      return (sevOrder[a.severity] ?? 5) - (sevOrder[b.severity] ?? 5);
    });
  }, [hub.teAlerts, hub.splunkInsights]);

  // Issue timeline items
  const issueTimeline = hub.teIssueTimeline || [];

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Platform health data
  const merakiStatus = hub.platformStatuses.find(p => p.platform === 'meraki');
  const teStatus = hub.platformStatuses.find(p => p.platform === 'thousandeyes');
  const catalystStatus = hub.platformStatuses.find(p => p.platform === 'catalyst');
  const splunkStatus = hub.platformStatuses.find(p => p.platform === 'splunk');

  // Counts for tabs
  const onlineAgents = hub.teAgents.filter(a => isAgentOnline(a)).length;
  const offlineAgents = hub.teAgents.length - onlineAgents;
  const activeOutages = hub.teOutages.filter(o => !o.endDate).length;
  const insightCount = hub.teCrossPlatformInsights.length;

  // AI analysis
  const analyzeHealth = useCallback(() => {
    const criticalCount = matrixRows.filter(r => r.worstHealth === 'critical').length;
    const degradedCount = matrixRows.filter(r => r.worstHealth === 'degraded').length;
    const totalAlerts = activeAlerts.length;
    const platforms = hub.platformStatuses.filter(p => p.configured).map(p => p.platform).join(', ');
    const outageInfo = activeOutages > 0 ? ` ${activeOutages} active outages detected.` : '';
    const agentInfo = offlineAgents > 0 ? ` ${offlineAgents} TE agents offline.` : '';
    const insightInfo = hub.teCrossPlatformInsights.length > 0
      ? ` Cross-platform insights: ${hub.teCrossPlatformInsights.map(i => i.title).join('; ')}.`
      : '';

    const prompt = `Cross-platform health analysis. Platforms: ${platforms}. ${matrixRows.length} monitored entities: ${criticalCount} critical, ${degradedCount} degraded. ${totalAlerts} active alerts.${outageInfo}${agentInfo} ${hub.teTests.length} TE tests, ${hub.topologyNodes.filter(n => !n.isClient).length} Meraki devices, ${hub.teAgents.length} TE agents (${onlineAgents} online).${insightInfo} Identify patterns, correlations, and recommend actions.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [matrixRows, activeAlerts, hub, router, activeOutages, offlineAgents, onlineAgents]);

  return (
    <div className="space-y-4">
      {/* Platform Health Strip */}
      <div className="grid grid-cols-4 gap-3">
        <PlatformHealthCard
          label="Meraki"
          icon={Shield}
          configured={merakiStatus?.configured || false}
          deviceCount={merakiStatus?.deviceCount || 0}
          onlinePercent={merakiStatus?.onlinePercent || 0}
          color="#22c55e"
        />
        <PlatformHealthCard
          label="ThousandEyes"
          icon={Globe}
          configured={teStatus?.configured || false}
          deviceCount={hub.teAgents.length}
          onlinePercent={teStatus?.onlinePercent || 0}
          color="#ff6b35"
          subtitle={`${hub.teAgents.length} agents, ${hub.teTests.length} tests`}
        />
        <PlatformHealthCard
          label="Catalyst"
          icon={Server}
          configured={catalystStatus?.configured || false}
          deviceCount={catalystStatus?.deviceCount || 0}
          onlinePercent={catalystStatus?.onlinePercent || 0}
          color="#3b82f6"
        />
        <PlatformHealthCard
          label="Splunk"
          icon={Database}
          configured={splunkStatus?.configured || false}
          deviceCount={splunkStatus?.deviceCount || 0}
          onlinePercent={splunkStatus?.onlinePercent || 0}
          color="#65a637"
        />
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit">
        {([
          { id: 'matrix' as ViewMode, label: 'Health Matrix', count: matrixRows.length },
          { id: 'agents' as ViewMode, label: 'TE Agents', count: hub.teAgents.length, highlight: offlineAgents > 0 },
          { id: 'outages' as ViewMode, label: 'Outages', count: hub.teOutages.length, highlight: activeOutages > 0 },
          { id: 'insights' as ViewMode, label: 'Insights', count: insightCount },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                tab.highlight ? 'bg-red-500/10 text-red-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* ========== Matrix View ========== */}
          {viewMode === 'matrix' && (
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Health Matrix</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400">
                    {matrixRows.length} entities
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortBy)}
                    className="px-2 py-1 text-[10px] bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 rounded text-slate-600 dark:text-slate-400"
                  >
                    <option value="health">Sort: Health</option>
                    <option value="name">Sort: Name</option>
                    <option value="platform">Sort: Platform</option>
                    <option value="alerts">Sort: Alerts</option>
                  </select>
                  <button
                    onClick={analyzeHealth}
                    className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Analyze
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status:</span>
                {[
                  { label: 'Healthy', color: 'bg-emerald-500' },
                  { label: 'Degraded', color: 'bg-amber-500' },
                  { label: 'Critical', color: 'bg-red-500' },
                  { label: 'No Data', color: 'bg-slate-300 dark:bg-slate-600' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
                    <span className="text-[9px] text-slate-500 dark:text-slate-400">{s.label}</span>
                  </div>
                ))}
                <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-auto">Last 24h (hourly)</span>
              </div>

              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/30">
                {sortedRows.length > 0 ? (
                  sortedRows.map(row => (
                    <MatrixRow
                      key={row.id}
                      row={row}
                      expanded={expandedRows.has(row.id)}
                      onToggle={() => toggleRow(row.id)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Server className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">No monitored entities found</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Select an organization and network to see health data</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== TE Agents View ========== */}
          {viewMode === 'agents' && (
            <div>
              {/* Agent summary strip */}
              <div className="flex items-center gap-4 mb-3 px-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 dark:text-slate-400">{onlineAgents} Online</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-slate-600 dark:text-slate-400">{offlineAgents} Offline</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {hub.teCorrelatedDevices.length > 0 && `${hub.teCorrelatedDevices.length} correlated with infrastructure`}
                </div>
              </div>

              {/* Agents by region */}
              {Object.keys(hub.teAgentsByRegion).length > 0 && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  {Object.entries(hub.teAgentsByRegion).map(([region, summary]) => (
                    <span key={region} className="text-[9px] px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400">
                      {region}: {summary.online}/{summary.total}
                    </span>
                  ))}
                </div>
              )}

              {hub.teAgents.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {/* Show offline agents first */}
                  {[...hub.teAgents]
                    .sort((a, b) => {
                      const aOnline = isAgentOnline(a) ? 1 : 0;
                      const bOnline = isAgentOnline(b) ? 1 : 0;
                      return aOnline - bOnline;
                    })
                    .map(agent => (
                      <TEAgentCard key={agent.agentId} agent={agent} hub={hub} />
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <Radio className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {hub.teConfigured ? 'No TE agents found' : 'ThousandEyes not configured'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========== Outages View ========== */}
          {viewMode === 'outages' && (
            <div>
              {/* Outage summary */}
              {activeOutages > 0 && (
                <div className="mb-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-red-500">{activeOutages} Active Outage{activeOutages !== 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Affecting {hub.teOutages.filter(o => !o.endDate).reduce((s, o) => s + (o.affectedTests || 0), 0)} tests
                    </div>
                  </div>
                </div>
              )}

              {hub.teOutages.length > 0 ? (
                <div className="space-y-2">
                  {/* Active outages first */}
                  {[...hub.teOutages]
                    .sort((a, b) => {
                      if (!a.endDate && b.endDate) return -1;
                      if (a.endDate && !b.endDate) return 1;
                      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
                    })
                    .map(outage => (
                      <OutageCard key={outage.id} outage={outage} />
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <CheckCircle className="w-10 h-10 text-emerald-500/50 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {hub.teConfigured ? 'No outages detected' : 'ThousandEyes not configured'}
                  </p>
                </div>
              )}

              {/* Recent TE Events */}
              {hub.teEvents.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Events</h3>
                  <div className="space-y-1.5">
                    {hub.teEvents.slice(0, 10).map(event => (
                      <div key={event.eventId} className="flex items-start gap-2 py-1.5 px-3 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                          event.severity === 'critical' ? 'bg-red-500'
                            : event.severity === 'major' ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {event.summary}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-500">
                            <span>{event.type}</span>
                            <span>{new Date(event.startDate).toLocaleString()}</span>
                            {event.affectedTargets && <span>{event.affectedTargets} targets</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== Insights View ========== */}
          {viewMode === 'insights' && (
            <div>
              {hub.teCrossPlatformInsights.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cross-Platform Insights</h3>
                  {hub.teCrossPlatformInsights.map(insight => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-4">
                  <Info className="w-10 h-10 text-slate-400/50 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No cross-platform insights available
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Configure multiple platforms for correlation insights
                  </p>
                </div>
              )}

              {/* Correlated Devices Section */}
              {hub.teCorrelatedDevices.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Correlated Devices ({hub.teCorrelatedDevices.length})
                  </h3>
                  <div className="space-y-1.5">
                    {hub.teCorrelatedDevices.map(device => (
                      <div key={device.id} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          device.healthStatus === 'healthy' ? 'bg-emerald-500'
                            : device.healthStatus === 'degraded' ? 'bg-amber-500'
                            : device.healthStatus === 'critical' ? 'bg-red-500'
                            : 'bg-slate-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{device.name}</div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500">
                            {device.matchedIp} | {device.platforms.join(' + ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {device.platforms.map(p => (
                            <span key={p} className={`text-[8px] px-1 py-0.5 rounded ${
                              p === 'thousandeyes' ? 'bg-orange-500/10 text-orange-500'
                                : p === 'meraki' ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {p === 'thousandeyes' ? 'TE' : p === 'meraki' ? 'MRK' : 'CAT'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Site Health */}
              {hub.teSiteHealth.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Site Health ({hub.teSiteHealth.length})
                  </h3>
                  <div className="space-y-1.5">
                    {hub.teSiteHealth.map(site => (
                      <div key={site.siteName} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          site.overallHealth === 'healthy' ? 'bg-emerald-500'
                            : site.overallHealth === 'degraded' ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{site.siteName}</div>
                          <div className="flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-500">
                            {site.merakiDeviceCount > 0 && <span>Meraki: {site.merakiOnline}/{site.merakiDeviceCount}</span>}
                            {site.catalystDeviceCount > 0 && <span>Catalyst: {site.catalystReachable}/{site.catalystDeviceCount}</span>}
                            {site.teAgentCount > 0 && <span>TE: {site.teAgentsOnline}/{site.teAgentCount}</span>}
                            {site.teActiveAlerts > 0 && <span className="text-amber-500">{site.teActiveAlerts} alerts</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue Timeline */}
              {issueTimeline.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Issue Timeline
                  </h3>
                  <div className="space-y-1">
                    {issueTimeline.slice(0, 15).map(item => (
                      <div key={item.id} className="flex items-start gap-2 py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                          item.severity === 'critical' ? 'bg-red-500'
                            : item.severity === 'major' ? 'bg-amber-500'
                            : item.severity === 'minor' ? 'bg-blue-500'
                            : 'bg-slate-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">{item.title}</div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500">
                            {item.type} | {new Date(item.timestamp).toLocaleString()} {item.isActive ? '(active)' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Alerts Sidebar */}
        <div className="w-[300px] flex-shrink-0 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active Alerts</h3>
              {activeAlerts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-full">
                  {activeAlerts.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeAlerts.length > 0 ? (
              activeAlerts.map(alert => {
                const sevColor = alert.severity === 'critical' ? 'border-red-500 bg-red-500/5'
                  : alert.severity === 'major' ? 'border-amber-500 bg-amber-500/5'
                  : alert.severity === 'warning' ? 'border-amber-400 bg-amber-400/5'
                  : 'border-blue-400 bg-blue-400/5';

                return (
                  <div key={alert.id} className={`p-3 rounded-lg border-l-2 ${sevColor}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                        {alert.platform}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        alert.severity === 'critical' ? 'bg-red-500/10 text-red-400'
                          : alert.severity === 'major' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                      {alert.title}
                    </p>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Shield className="w-8 h-8 text-emerald-500/50 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">No active alerts</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">All systems healthy</p>
              </div>
            )}
          </div>

          {/* TE Health Score */}
          {hub.teConfigured && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">TE Health Score</span>
                <span className={`text-sm font-bold ${
                  hub.teHealthScore >= 80 ? 'text-emerald-500' : hub.teHealthScore >= 60 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {hub.teHealthScore}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    hub.teHealthScore >= 80 ? 'bg-emerald-500' : hub.teHealthScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${hub.teHealthScore}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HealthMatrixView;
