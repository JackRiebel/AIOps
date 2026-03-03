'use client';

import { memo, useMemo } from 'react';
import {
  Network, Server, Activity, Wifi, Sparkles, ArrowRight,
  Globe, MonitorSpeaker, AlertTriangle, CheckCircle2,
  XCircle, Info, Zap, Search, MessageSquare, BrainCircuit,
  Layers, Link2,
} from 'lucide-react';
import type {
  PlatformHealthSummary,
  CorrelatedDevice,
  CrossPlatformInsight,
  TESplunkCorrelation,
  MerakiCachedDevice,
  CatalystCachedDevice,
  Agent,
  Test,
} from './types';

// ============================================================================
// Props
// ============================================================================

export interface TECrossPlatformViewProps {
  platformHealth: PlatformHealthSummary[];
  correlatedDevices: CorrelatedDevice[];
  crossPlatformInsights: CrossPlatformInsight[];
  splunkCorrelation: TESplunkCorrelation | null;
  merakiDevices: MerakiCachedDevice[];
  catalystDevices: CatalystCachedDevice[];
  agents: Agent[];
  tests: Test[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PLATFORM_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  thousandeyes: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', label: 'ThousandEyes' },
  meraki: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Meraki' },
  catalyst: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'Catalyst' },
  splunk: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', label: 'Splunk' },
};

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-blue-400',
  warning: 'border-l-amber-400',
  critical: 'border-l-red-400',
};

const SEVERITY_ICON: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  critical: { icon: XCircle, color: 'text-red-500' },
};

const healthDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-slate-400',
};

// ============================================================================
// Helpers
// ============================================================================

function PlatformBadge({ platform }: { platform: string }) {
  const cfg = PLATFORM_BADGE[platform];
  if (!cfg) return null;
  return <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

function SectionWrapper({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Section 1: Data Sources — compact strip showing what feeds AI
// ============================================================================

function DataSourcesStrip({
  platformHealth, splunkCorrelation, agents, tests, merakiDevices, catalystDevices,
}: {
  platformHealth: PlatformHealthSummary[];
  splunkCorrelation: TESplunkCorrelation | null;
  agents: Agent[];
  tests: Test[];
  merakiDevices: MerakiCachedDevice[];
  catalystDevices: CatalystCachedDevice[];
}) {
  const sources = useMemo(() => {
    const s: Array<{ key: string; label: string; icon: typeof Globe; color: string; bg: string; connected: boolean; summary: string }> = [];

    const teOnline = agents.filter(a => a.agentState?.toLowerCase() === 'online').length;
    s.push({
      key: 'thousandeyes', label: 'ThousandEyes', icon: Globe,
      color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      connected: agents.length > 0 || tests.length > 0,
      summary: `${teOnline} agents, ${tests.length} tests`,
    });

    const mk = platformHealth.find(p => p.platform === 'meraki');
    s.push({
      key: 'meraki', label: 'Meraki', icon: Wifi,
      color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      connected: mk?.configured ?? merakiDevices.length > 0,
      summary: mk?.configured ? `${mk.onlineCount}/${mk.deviceCount} online` : 'Not connected',
    });

    const cc = platformHealth.find(p => p.platform === 'catalyst');
    s.push({
      key: 'catalyst', label: 'Catalyst Center', icon: Server,
      color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10',
      connected: cc?.configured ?? catalystDevices.length > 0,
      summary: cc?.configured ? `${cc.onlineCount}/${cc.deviceCount} reachable` : 'Not connected',
    });

    const splunkHosts = splunkCorrelation?.splunkMatches?.length ?? 0;
    s.push({
      key: 'splunk', label: 'Splunk', icon: MonitorSpeaker,
      color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10',
      connected: !!splunkCorrelation,
      summary: splunkCorrelation ? `${splunkHosts} host matches` : 'Not connected',
    });

    return s;
  }, [platformHealth, splunkCorrelation, agents, tests, merakiDevices.length, catalystDevices.length]);

  const connectedCount = sources.filter(s => s.connected).length;

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-semibold text-slate-900 dark:text-white">AI Data Sources</span>
        <span className="text-[10px] text-slate-400">{connectedCount} of 4 feeding intelligence</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {sources.map(src => {
          const Icon = src.icon;
          return (
            <div
              key={src.key}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${
                src.connected
                  ? 'border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/10'
                  : 'border-dashed border-slate-200 dark:border-slate-700/30 opacity-50'
              }`}
            >
              <div className={`p-1.5 rounded-md ${src.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${src.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{src.label}</p>
                <p className="text-[10px] text-slate-400 truncate">{src.summary}</p>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src.connected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Section 2: AI-Powered Queries — curated multi-platform questions
// ============================================================================

interface AIQuery {
  label: string;
  description: string;
  prompt: string;
  platforms: string[];
  icon: typeof Search;
}

function AIQueriesSection({
  agents, tests, merakiDevices, catalystDevices, splunkCorrelation, platformHealth, correlatedDevices, onAskAI,
}: TECrossPlatformViewProps) {
  const queries = useMemo(() => {
    const q: AIQuery[] = [];
    const hasMeraki = platformHealth.some(p => p.platform === 'meraki' && p.configured) || merakiDevices.length > 0;
    const hasCatalyst = platformHealth.some(p => p.platform === 'catalyst' && p.configured) || catalystDevices.length > 0;
    const hasSplunk = !!splunkCorrelation;
    const teOnline = agents.filter(a => a.agentState?.toLowerCase() === 'online').length;

    // Always available — TE-centric
    q.push({
      label: 'Full-Stack Health Analysis',
      description: `Correlate ThousandEyes test results${hasMeraki ? ', Meraki device health' : ''}${hasCatalyst ? ', Catalyst reachability' : ''}${hasSplunk ? ', and Splunk logs' : ''} for a unified network assessment.`,
      prompt: `Perform a full-stack network health analysis using all available platforms. ThousandEyes: ${teOnline}/${agents.length} agents online, ${tests.length} tests running.${hasMeraki ? ` Meraki: ${merakiDevices.length} devices.` : ''}${hasCatalyst ? ` Catalyst: ${catalystDevices.length} devices.` : ''}${hasSplunk ? ` Splunk: ${splunkCorrelation!.splunkMatches.length} host matches.` : ''} Identify any issues, correlate across platforms, and provide actionable recommendations.`,
      platforms: ['thousandeyes', ...(hasMeraki ? ['meraki'] : []), ...(hasCatalyst ? ['catalyst'] : []), ...(hasSplunk ? ['splunk'] : [])],
      icon: BrainCircuit,
    });

    if (hasMeraki) {
      q.push({
        label: 'TE + Meraki: Path vs Device Health',
        description: 'Compare ThousandEyes path analysis and latency data against Meraki device and uplink status to pinpoint where network issues originate.',
        prompt: `Cross-reference ThousandEyes test results and agent paths with Meraki device health. Are there any Meraki devices showing degradation that correlate with ThousandEyes test failures or latency spikes? ThousandEyes has ${tests.length} tests across ${teOnline} agents. Meraki has ${merakiDevices.length} devices. Focus on correlation — where TE sees a problem, what does Meraki say about the underlying device?`,
        platforms: ['thousandeyes', 'meraki'],
        icon: Search,
      });
    }

    if (hasCatalyst) {
      q.push({
        label: 'TE + Catalyst: Agent-to-Switch Mapping',
        description: 'Map ThousandEyes enterprise agents to Catalyst switches and routers to understand which infrastructure supports which monitoring points.',
        prompt: `Map ThousandEyes agents to Catalyst Center infrastructure. For each TE agent, identify which Catalyst switches and routers it traverses. ThousandEyes: ${agents.length} agents. Catalyst: ${catalystDevices.length} devices. Are there any unreachable Catalyst devices that could affect TE agent connectivity or test results?`,
        platforms: ['thousandeyes', 'catalyst'],
        icon: Link2,
      });
    }

    if (hasSplunk) {
      q.push({
        label: 'TE + Splunk: Alert Log Correlation',
        description: 'When ThousandEyes triggers an alert, search Splunk logs for related events at the same time window to find root cause faster.',
        prompt: `Correlate ThousandEyes alerts and test failures with Splunk log events. Splunk found ${splunkCorrelation!.splunkMatches.length} host matches for TE agent IPs. Are there any Splunk log patterns (errors, config changes, interface flaps) that coincide with TE performance issues? Provide timeline correlation.`,
        platforms: ['thousandeyes', 'splunk'],
        icon: Search,
      });
    }

    if (hasMeraki && hasCatalyst) {
      q.push({
        label: 'TE as Overlay: Meraki + Catalyst Health',
        description: 'Use ThousandEyes as an external observer to validate that both Meraki and Catalyst networks are performing as expected from the user perspective.',
        prompt: `ThousandEyes monitors network performance from the outside. Meraki and Catalyst manage it from the inside. Compare: are there gaps where TE sees degradation but Meraki/Catalyst show healthy? Or devices reporting issues that TE tests haven't caught? ThousandEyes: ${tests.length} tests, ${teOnline} agents. Meraki: ${merakiDevices.length} devices. Catalyst: ${catalystDevices.length} devices.`,
        platforms: ['thousandeyes', 'meraki', 'catalyst'],
        icon: Layers,
      });
    }

    if (correlatedDevices.length > 0) {
      q.push({
        label: 'Investigate Correlated Devices',
        description: `${correlatedDevices.length} device${correlatedDevices.length > 1 ? 's' : ''} found across multiple platforms sharing the same IP. Deep-dive into their health from each platform's perspective.`,
        prompt: `Investigate ${correlatedDevices.length} IP-correlated devices found across platforms: ${correlatedDevices.slice(0, 5).map(d => `"${d.name}" at ${d.matchedIp} (${d.platforms.join('+')}) — ${d.healthStatus}`).join('; ')}. For each device, compare what ThousandEyes sees vs what the network platform reports. Any discrepancies or issues?`,
        platforms: [...new Set(correlatedDevices.flatMap(d => d.platforms))],
        icon: Network,
      });
    }

    return q;
  }, [agents, tests, merakiDevices, catalystDevices, splunkCorrelation, platformHealth, correlatedDevices]);

  if (!onAskAI) return null;

  return (
    <SectionWrapper title="AI Cross-Platform Intelligence" icon={<BrainCircuit className="w-4 h-4 text-violet-500" />}>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-4">
        Ask AI questions that combine ThousandEyes monitoring with your other network platforms for deeper answers.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {queries.map((q, i) => {
          const Icon = q.icon;
          return (
            <button
              key={i}
              onClick={() => onAskAI(q.prompt)}
              className="text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/10
                hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-50/50 dark:hover:bg-violet-500/5
                transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/15 group-hover:bg-violet-200 dark:group-hover:bg-violet-500/25 transition-colors flex-shrink-0">
                  <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                    {q.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{q.description}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {q.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                  </div>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0 mt-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

// ============================================================================
// Section 3: Cross-Platform Insights (from useTECommandCenter)
// ============================================================================

function InsightsSection({
  insights, configuredCount, onAskAI,
}: {
  insights: CrossPlatformInsight[];
  configuredCount: number;
  onAskAI?: (context: string) => void;
}) {
  if (insights.length === 0) {
    if (configuredCount < 2) return null; // Don't show empty state when there's nothing to correlate
    return (
      <SectionWrapper title="Cross-Platform Findings" icon={<Activity className="w-4 h-4 text-emerald-500" />}>
        <div className="py-6 text-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600 dark:text-slate-400">All platforms healthy — no cross-platform anomalies detected</p>
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper title="Cross-Platform Findings" icon={<Activity className="w-4 h-4 text-emerald-500" />} count={insights.length}>
      <div className="space-y-2">
        {insights.map(insight => {
          const sev = SEVERITY_ICON[insight.severity] ?? SEVERITY_ICON.info;
          const SevIcon = sev.icon;
          return (
            <div
              key={insight.id}
              className={`border-l-4 ${SEVERITY_BORDER[insight.severity] ?? 'border-l-slate-300'} rounded-lg bg-slate-50 dark:bg-slate-700/10 border border-slate-200/80 dark:border-slate-700/40 p-3`}
            >
              <div className="flex items-start gap-2">
                <SevIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${sev.color}`} />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium text-slate-900 dark:text-white">{insight.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{insight.description}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {insight.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                  </div>
                </div>
                {insight.aiContext && onAskAI && (
                  <button
                    onClick={() => onAskAI(insight.aiContext!)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                    title="Investigate with AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

// ============================================================================
// Section 4: IP-Correlated Devices (compact, TE-centric framing)
// ============================================================================

function CorrelatedDevicesSection({
  devices, agents, onAskAI,
}: {
  devices: CorrelatedDevice[];
  agents: Agent[];
  onAskAI?: (context: string) => void;
}) {
  if (devices.length === 0 && agents.length === 0) return null;

  return (
    <SectionWrapper title="TE Agent ↔ Network Device Correlation" icon={<Link2 className="w-4 h-4 text-cyan-500" />} count={devices.length}>
      {devices.length === 0 ? (
        <div className="py-5 text-center">
          <Link2 className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            No TE agent IPs match Meraki or Catalyst device IPs. Deploy enterprise agents on managed infrastructure to see how TE monitoring maps to your network devices.
          </p>
          {onAskAI && (
            <button
              onClick={() => onAskAI('Analyze ThousandEyes agent deployment against our Meraki and Catalyst infrastructure. Which TE agents could be deployed on managed network devices for better visibility? What monitoring gaps exist?')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Find monitoring gaps
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {devices.map(dev => (
            <div key={dev.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/10 group">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthDot[dev.healthStatus] ?? 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-900 dark:text-white">{dev.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{dev.matchedIp}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {dev.teAgent && <span className="text-cyan-600 dark:text-cyan-400">TE: {dev.teAgent.agentType} ({dev.teAgent.agentState ?? 'enabled'})</span>}
                  {dev.merakiDevice && <span className="text-emerald-600 dark:text-emerald-400">MK: {dev.merakiDevice.model} ({dev.merakiDevice.status})</span>}
                  {dev.catalystDevice && <span className="text-blue-600 dark:text-blue-400">CC: {dev.catalystDevice.model} ({dev.catalystDevice.reachabilityStatus ?? dev.catalystDevice.status})</span>}
                </div>
              </div>
              {onAskAI && (
                <button
                  onClick={() => onAskAI(`Deep-dive into device "${dev.name}" at ${dev.matchedIp}. It's visible on ${dev.platforms.join(' + ')}. Compare what ThousandEyes sees vs the network platform. Any health discrepancies or issues?`)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionWrapper>
  );
}

// ============================================================================
// Hero AI Button
// ============================================================================

function HeroAIButton({
  platformHealth, correlatedDevices, crossPlatformInsights, splunkCorrelation,
  agents, tests, merakiDevices, catalystDevices, onAskAI,
}: TECrossPlatformViewProps) {
  if (!onAskAI) return null;

  const handleClick = () => {
    const parts: string[] = [
      'Give me a comprehensive cross-platform network intelligence briefing.',
    ];

    const teOnline = agents.filter(a => a.agentState?.toLowerCase() === 'online').length;
    if (agents.length > 0) {
      parts.push(`ThousandEyes: ${teOnline}/${agents.length} agents online, ${tests.length} active tests.`);
    }

    const mk = platformHealth.find(p => p.platform === 'meraki');
    if (mk?.configured) {
      const offlineCount = merakiDevices.filter(d => d.status === 'offline').length;
      const alertingCount = merakiDevices.filter(d => d.status === 'alerting').length;
      parts.push(`Meraki: ${mk.onlineCount}/${mk.deviceCount} devices across ${mk.networkCount} networks.${offlineCount > 0 ? ` ${offlineCount} offline.` : ''}${alertingCount > 0 ? ` ${alertingCount} alerting.` : ''}`);
    }

    const cc = platformHealth.find(p => p.platform === 'catalyst');
    if (cc?.configured) {
      parts.push(`Catalyst: ${cc.onlineCount}/${cc.deviceCount} reachable across ${cc.networkCount} sites.`);
    }

    if (splunkCorrelation?.splunkMatches?.length) {
      parts.push(`Splunk: ${splunkCorrelation.splunkMatches.length} TE host matches in logs.`);
    }

    if (correlatedDevices.length > 0) {
      parts.push(`${correlatedDevices.length} IP-correlated devices across platforms.`);
    }

    if (crossPlatformInsights.length > 0) {
      const crit = crossPlatformInsights.filter(i => i.severity === 'critical').length;
      const warn = crossPlatformInsights.filter(i => i.severity === 'warning').length;
      parts.push(`Active findings: ${crit} critical, ${warn} warnings.`);
    }

    parts.push('Summarize the network state, highlight issues requiring attention, and recommend actions that leverage multiple platforms together.');
    onAskAI(parts.join(' '));
  };

  return (
    <div className="flex justify-center pt-2">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white
          bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500
          hover:from-violet-700 hover:via-purple-700 hover:to-cyan-600
          shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-200"
      >
        <Sparkles className="w-4 h-4" />
        Run Cross-Platform Intelligence Briefing
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CrossPlatformSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/40" />
      <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800/40" />
      <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800/40" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const TECrossPlatformView = memo((props: TECrossPlatformViewProps) => {
  const {
    platformHealth, correlatedDevices, crossPlatformInsights,
    splunkCorrelation, merakiDevices, catalystDevices,
    agents, tests, loading, onAskAI,
  } = props;

  const configuredCount = useMemo(() => {
    let count = agents.length > 0 || tests.length > 0 ? 1 : 0;
    count += platformHealth.filter(p => p.platform !== 'thousandeyes' && p.configured).length;
    if (splunkCorrelation) count += 1;
    return count;
  }, [agents.length, tests.length, platformHealth, splunkCorrelation]);

  if (loading) return <CrossPlatformSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BrainCircuit className="w-5 h-5 text-violet-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Cross-Platform AI Intelligence</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 ml-7">
          AI combines ThousandEyes monitoring with {configuredCount > 1 ? `${configuredCount - 1} other platform${configuredCount > 2 ? 's' : ''}` : 'connected platforms'} to deliver deeper network insights.
        </p>
      </div>

      {/* Data Sources Strip */}
      <DataSourcesStrip
        platformHealth={platformHealth}
        splunkCorrelation={splunkCorrelation}
        agents={agents}
        tests={tests}
        merakiDevices={merakiDevices}
        catalystDevices={catalystDevices}
      />

      {/* AI-Powered Queries — the core value */}
      <AIQueriesSection {...props} />

      {/* Cross-Platform Findings */}
      <InsightsSection
        insights={crossPlatformInsights}
        configuredCount={configuredCount}
        onAskAI={onAskAI}
      />

      {/* TE Agent ↔ Device Correlation */}
      <CorrelatedDevicesSection
        devices={correlatedDevices}
        agents={agents}
        onAskAI={onAskAI}
      />

      {/* Hero CTA */}
      <HeroAIButton {...props} />
    </div>
  );
});

TECrossPlatformView.displayName = 'TECrossPlatformView';
export default TECrossPlatformView;
