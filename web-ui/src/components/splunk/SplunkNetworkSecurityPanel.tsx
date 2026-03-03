'use client';

import { memo, useMemo } from 'react';
import {
  Shield, Wifi, Server, Sparkles, ArrowRight, Network,
  AlertTriangle, BrainCircuit, Search, Lock, Activity,
  MonitorSpeaker, Eye, Link2,
} from 'lucide-react';
import type { SplunkCorrelatedDevice, SplunkInsight } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkNetworkSecurityPanelProps {
  correlatedDevices: SplunkCorrelatedDevice[];
  merakiDevices: any[];
  catalystDevices: any[];
  insights: SplunkInsight[];
  totalEventCount: number;
  loadingCorrelation: boolean;
  onAskAI: (query: string) => void;
  onSearch: (query: string) => void;
}

// ============================================================================
// AI Query Cards
// ============================================================================

interface SecurityQuery {
  label: string;
  description: string;
  prompt: string;
  icon: typeof Search;
  platforms: string[];
}

// ============================================================================
// Component
// ============================================================================

export const SplunkNetworkSecurityPanel = memo(({
  correlatedDevices, merakiDevices, catalystDevices,
  insights, totalEventCount, loadingCorrelation,
  onAskAI, onSearch,
}: SplunkNetworkSecurityPanelProps) => {

  const hasMeraki = merakiDevices.length > 0;
  const hasCatalyst = catalystDevices.length > 0;
  const critInsights = insights.filter(i => i.severity === 'critical' || i.severity === 'high');

  // ---- Device Health Summary ----
  const deviceSummary = useMemo(() => {
    const merakiOnline = merakiDevices.filter((d: any) => d.status === 'online').length;
    const merakiOffline = merakiDevices.filter((d: any) => d.status === 'offline').length;
    const merakiAlerting = merakiDevices.filter((d: any) => d.status === 'alerting').length;
    const catReachable = catalystDevices.filter((d: any) =>
      d.reachabilityStatus === 'Reachable' || d.status === 'online'
    ).length;
    return { merakiOnline, merakiOffline, merakiAlerting, catReachable };
  }, [merakiDevices, catalystDevices]);

  // ---- Build AI queries dynamically ----
  const queries = useMemo(() => {
    const q: SecurityQuery[] = [];

    if (hasMeraki) {
      q.push({
        label: 'Meraki Firewall Events',
        description: `Search Splunk for firewall deny/drop events from ${merakiDevices.length} Meraki devices. Identify blocked connections, top denied sources, and potential intrusion attempts.`,
        prompt: `Search Splunk logs for firewall and security events related to Meraki devices. We have ${merakiDevices.length} Meraki devices (${deviceSummary.merakiOnline} online, ${deviceSummary.merakiAlerting} alerting). Look for: denied connections, blocked IPs, port scans, and any anomalous traffic patterns. Correlate with device status.`,
        icon: Shield,
        platforms: ['splunk', 'meraki'],
      });

      q.push({
        label: 'Meraki Device Status Changes',
        description: `Find Splunk events when Meraki devices go offline/alerting. ${deviceSummary.merakiOffline} currently offline, ${deviceSummary.merakiAlerting} alerting.`,
        prompt: `Search for Splunk events related to Meraki device status changes. Currently: ${deviceSummary.merakiOnline} online, ${deviceSummary.merakiOffline} offline, ${deviceSummary.merakiAlerting} alerting out of ${merakiDevices.length} total. Are there Splunk logs showing when devices went down? Any patterns in offline events?`,
        icon: Activity,
        platforms: ['splunk', 'meraki'],
      });
    }

    if (hasCatalyst) {
      q.push({
        label: 'Catalyst Security Posture',
        description: `Analyze switch/router security events from ${catalystDevices.length} Catalyst devices. Check ACL hits, port security violations, and DHCP snooping.`,
        prompt: `Analyze security posture of our Catalyst infrastructure via Splunk logs. ${catalystDevices.length} Catalyst devices, ${deviceSummary.catReachable} reachable. Search for: ACL violations, port security events, DHCP snooping alerts, unauthorized access attempts, and config changes.`,
        icon: Lock,
        platforms: ['splunk', 'catalyst'],
      });
    }

    if (hasMeraki || hasCatalyst) {
      q.push({
        label: 'Network Access Anomalies',
        description: 'Cross-reference Splunk authentication logs with network device inventory to detect unauthorized access or rogue devices.',
        prompt: `Cross-reference Splunk authentication and access logs with our network device inventory. Meraki: ${merakiDevices.length} devices. Catalyst: ${catalystDevices.length} devices. Are there login attempts or access events from unknown IPs not in our device inventory? Any failed authentication patterns?`,
        icon: Eye,
        platforms: ['splunk', ...(hasMeraki ? ['meraki'] : []), ...(hasCatalyst ? ['catalyst'] : [])],
      });
    }

    if (critInsights.length > 0) {
      q.push({
        label: 'Threat Impact on Network',
        description: `${critInsights.length} critical/high findings. Determine which network devices are affected and assess blast radius.`,
        prompt: `We have ${critInsights.length} critical/high severity findings in Splunk: ${critInsights.slice(0, 3).map(i => `"${i.title}" (${i.log_count} events)`).join(', ')}. Cross-reference these with our ${merakiDevices.length + catalystDevices.length} network devices. Which devices are affected? What's the blast radius? Recommend containment actions.`,
        icon: AlertTriangle,
        platforms: ['splunk', ...(hasMeraki ? ['meraki'] : []), ...(hasCatalyst ? ['catalyst'] : [])],
      });
    }

    // Always available
    q.push({
      label: 'Full Security Assessment',
      description: `Comprehensive security assessment combining Splunk logs with all connected network platforms.`,
      prompt: `Perform a comprehensive network security assessment. Splunk has ${totalEventCount.toLocaleString()} total events and ${insights.length} categorized findings (${critInsights.length} critical/high).${hasMeraki ? ` Meraki: ${merakiDevices.length} devices.` : ''}${hasCatalyst ? ` Catalyst: ${catalystDevices.length} devices.` : ''} ${correlatedDevices.length} devices found in log data. Assess overall security posture, identify top risks, and recommend actions.`,
      icon: BrainCircuit,
      platforms: ['splunk', ...(hasMeraki ? ['meraki'] : []), ...(hasCatalyst ? ['catalyst'] : [])],
    });

    return q;
  }, [hasMeraki, hasCatalyst, merakiDevices, catalystDevices, critInsights,
    deviceSummary, correlatedDevices, insights, totalEventCount]);

  // ---- Platform badge helper ----
  const PlatformBadge = ({ platform }: { platform: string }) => {
    const cfg: Record<string, { bg: string; text: string; border: string; label: string }> = {
      splunk: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20', label: 'Splunk' },
      meraki: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'Meraki' },
      catalyst: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/20', label: 'Catalyst' },
    };
    const c = cfg[platform] || { bg: 'bg-slate-50 dark:bg-slate-700/30', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600/50', label: platform };
    return <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border ${c.bg} ${c.text} ${c.border}`}>{c.label}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Device Status Strip */}
      {(hasMeraki || hasCatalyst) && (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Network className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Network Device Security</span>
            <span className="ml-auto px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
              {correlatedDevices.length} in logs
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* Meraki */}
            {hasMeraki && (
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-800/60">
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meraki</p>
                  <div className="flex items-center gap-2.5 text-[10px] mt-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{deviceSummary.merakiOnline} online</span>
                    {deviceSummary.merakiOffline > 0 && <span className="text-slate-400 dark:text-slate-500">{deviceSummary.merakiOffline} offline</span>}
                    {deviceSummary.merakiAlerting > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{deviceSummary.merakiAlerting} alerting</span>}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{merakiDevices.length}</span>
              </div>
            )}

            {/* Catalyst */}
            {hasCatalyst && (
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-blue-500 bg-white dark:bg-slate-800/60">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                  <Server className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catalyst Center</p>
                  <div className="flex items-center gap-2.5 text-[10px] mt-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{deviceSummary.catReachable} reachable</span>
                    {catalystDevices.length - deviceSummary.catReachable > 0 && (
                      <span className="text-slate-400 dark:text-slate-500">{catalystDevices.length - deviceSummary.catReachable} unreachable</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{catalystDevices.length}</span>
              </div>
            )}
          </div>

          {/* Correlated devices from logs */}
          {correlatedDevices.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  Devices Found in Logs
                </span>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {correlatedDevices.slice(0, 10).map((dev, i) => (
                  <div key={`${dev.ip}-${i}`} className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      dev.merakiDevice?.status === 'online' || dev.catalystDevice?.reachabilityStatus === 'Reachable'
                        ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 w-28 flex-shrink-0">{dev.ip}</span>
                    <span className="text-[11px] font-medium text-slate-900 dark:text-white truncate flex-1">
                      {dev.hostname || dev.merakiDevice?.name || dev.catalystDevice?.name || '\u2014'}
                    </span>
                    <div className="flex items-center gap-1">
                      {dev.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                    </div>
                    {dev.logCount && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 tabular-nums">{dev.logCount} logs</span>
                    )}
                  </div>
                ))}
                {correlatedDevices.length > 10 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-1.5">+{correlatedDevices.length - 10} more devices</p>
                )}
              </div>
            </div>
          )}

          {correlatedDevices.length === 0 && !loadingCorrelation && (
            <div className="py-6 text-center border-t border-slate-100 dark:border-slate-700/30 mt-1">
              <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
                <Link2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Run a search to correlate log data with network devices</p>
            </div>
          )}

          {loadingCorrelation && (
            <div className="py-6 text-center border-t border-slate-100 dark:border-slate-700/30 mt-1">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Correlating devices...</p>
            </div>
          )}
        </div>
      )}

      {/* AI Security Queries */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-1">
          <BrainCircuit className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">AI Security Intelligence</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 ml-6">
          AI-powered queries combining Splunk logs with network device data for deeper security analysis.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {queries.map((q, i) => {
            const Icon = q.icon;
            return (
              <button
                key={i}
                onClick={() => onAskAI(q.prompt)}
                className="text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60
                  hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:bg-cyan-50/30 dark:hover:bg-cyan-500/5
                  transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/40 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/15 transition-colors flex-shrink-0">
                    <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-1 group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors">
                      {q.label}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{q.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {q.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                    </div>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Hero CTA */}
        <div className="flex justify-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/30">
          <button
            onClick={() => onAskAI(
              `Run a comprehensive network security briefing. Analyze all Splunk data (${totalEventCount.toLocaleString()} events, ${insights.length} categorized findings, ${critInsights.length} critical/high).${hasMeraki ? ` Meraki: ${merakiDevices.length} devices (${deviceSummary.merakiOffline} offline, ${deviceSummary.merakiAlerting} alerting).` : ''}${hasCatalyst ? ` Catalyst: ${catalystDevices.length} devices.` : ''} Identify top security risks, correlate log events with network devices, assess threat posture, and provide actionable recommendations.`
            )}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium text-white
              bg-gradient-to-r from-purple-600 to-cyan-600
              hover:from-purple-700 hover:to-cyan-700
              transition-all duration-200"
          >
            <Sparkles className="w-4 h-4" />
            Run Security Intelligence Briefing
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

SplunkNetworkSecurityPanel.displayName = 'SplunkNetworkSecurityPanel';
export default SplunkNetworkSecurityPanel;
