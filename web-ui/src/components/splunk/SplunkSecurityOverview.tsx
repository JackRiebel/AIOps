'use client';

import { memo, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, AlertTriangle, Activity, Server, Wifi,
  Lock, Eye, Zap, Bug, ShieldAlert, Search, ExternalLink,
} from 'lucide-react';
import type { SplunkInsight, SplunkCorrelatedDevice, SeverityLevel } from './types';
import { SEVERITY_CONFIGS } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkSecurityOverviewProps {
  insights: SplunkInsight[];
  correlatedDevices: SplunkCorrelatedDevice[];
  merakiDevices: any[];
  catalystDevices: any[];
  totalEventCount: number;
  hostCount: number;
  loading: boolean;
}

// ============================================================================
// Security Category Icons
// ============================================================================

const CATEGORY_ICONS: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  authentication: { icon: Lock, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  firewall: { icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  intrusion: { icon: Bug, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10' },
  network: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  access: { icon: Eye, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  system: { icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  default: { icon: Shield, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-500/10' },
};

function getCategoryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('auth') || t.includes('login') || t.includes('password') || t.includes('credential')) return 'authentication';
  if (t.includes('firewall') || t.includes('blocked') || t.includes('deny') || t.includes('drop')) return 'firewall';
  if (t.includes('intrusion') || t.includes('exploit') || t.includes('attack') || t.includes('malware')) return 'intrusion';
  if (t.includes('network') || t.includes('interface') || t.includes('link') || t.includes('vlan') || t.includes('martian') || t.includes('dhcp')) return 'network';
  if (t.includes('access') || t.includes('permission') || t.includes('privilege') || t.includes('unauthorized')) return 'access';
  if (t.includes('system') || t.includes('service') || t.includes('process') || t.includes('cpu') || t.includes('memory') || t.includes('vpn')) return 'system';
  return 'default';
}

// ============================================================================
// Component
// ============================================================================

export const SplunkSecurityOverview = memo(({
  insights, correlatedDevices, merakiDevices, catalystDevices,
  totalEventCount, hostCount, loading,
}: SplunkSecurityOverviewProps) => {
  const router = useRouter();

  const threatCards = useMemo(() => {
    return insights
      .filter(i => i.severity === 'critical' || i.severity === 'high' || i.severity === 'medium')
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || b.log_count - a.log_count;
      })
      .slice(0, 6);
  }, [insights]);

  const securityStats = useMemo(() => {
    const critCount = insights.filter(i => i.severity === 'critical').length;
    const highCount = insights.filter(i => i.severity === 'high').length;
    const critEvents = insights.filter(i => i.severity === 'critical').reduce((s, i) => s + i.log_count, 0);
    const highEvents = insights.filter(i => i.severity === 'high').reduce((s, i) => s + i.log_count, 0);
    const networkDeviceCount = merakiDevices.length + catalystDevices.length;
    const networkDevicesInLogs = correlatedDevices.length;
    const totalInsightEvents = insights.reduce((s, i) => s + i.log_count, 0);

    return { critCount, highCount, critEvents, highEvents, networkDeviceCount, networkDevicesInLogs, totalInsightEvents };
  }, [insights, correlatedDevices, merakiDevices, catalystDevices]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Security Overview</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-4 h-4 text-red-500" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Security Overview</span>
        {insights.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50">
            {insights.length} findings
          </span>
        )}
      </div>

      {/* Stat Metric Cards - TE border-l-4 pattern */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-red-500 p-3 transition-colors">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Critical</p>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">{securityStats.critCount}</span>
            <AlertTriangle className="w-3 h-3 text-red-500" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{securityStats.critEvents.toLocaleString()} events</p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-orange-500 p-3 transition-colors">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">High</p>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">{securityStats.highCount}</span>
            <AlertTriangle className="w-3 h-3 text-orange-500" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{securityStats.highEvents.toLocaleString()} events</p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-blue-500 p-3 transition-colors">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Network Devices</p>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">
              {securityStats.networkDeviceCount || '\u2014'}
            </span>
            <Wifi className="w-3 h-3 text-blue-500" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {securityStats.networkDevicesInLogs > 0
              ? `${securityStats.networkDevicesInLogs} in logs`
              : securityStats.networkDeviceCount > 0 ? 'monitoring' : 'not connected'
            }
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-purple-500 p-3 transition-colors">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Findings</p>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">{insights.length}</span>
            <Activity className="w-3 h-3 text-purple-500" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{totalEventCount.toLocaleString()} events total</p>
        </div>
      </div>

      {/* Threat Cards */}
      {threatCards.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3 pt-1 border-t border-slate-100 dark:border-slate-700/30">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Active Threats</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {threatCards.map(card => {
              const cfg = SEVERITY_CONFIGS[card.severity as SeverityLevel] || SEVERITY_CONFIGS.info;
              const category = getCategoryFromTitle(card.title);
              const catCfg = CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
              const CatIcon = catCfg.icon;

              return (
                <div
                  key={card.id}
                  className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${cfg.leftBorder} p-3 group hover:shadow-sm transition-all`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`p-1.5 rounded-lg ${catCfg.bg} flex-shrink-0`}>
                      <CatIcon className={`w-3.5 h-3.5 ${catCfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h5 className="text-xs font-medium text-slate-900 dark:text-white truncate">{card.title}</h5>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border ${cfg.badge} flex-shrink-0`}>
                          {card.severity.toUpperCase()}
                        </span>
                      </div>
                      {card.description && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{card.description}</p>
                      )}
                      <div className="flex items-center gap-2.5 mt-1.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{card.log_count.toLocaleString()} occurrences</span>
                        <button
                          onClick={() => {
                            const prompt = `Investigate Splunk security finding: "${card.title}" (${card.severity} severity, ${card.log_count} occurrences). ${card.description || ''} Provide root cause analysis, impact assessment, and remediation steps.`;
                            router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
                          }}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition"
                        >
                          <Search className="w-2.5 h-2.5" /> Investigate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {threatCards.length === 0 && insights.length > 0 && (
        <div className="py-6 text-center border-t border-slate-100 dark:border-slate-700/30 mt-1">
          <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">No critical or high severity threats detected</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{insights.length} informational findings</p>
        </div>
      )}

      {insights.length === 0 && (
        <div className="py-6 text-center border-t border-slate-100 dark:border-slate-700/30 mt-1">
          <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Generating security insights...</p>
        </div>
      )}
    </div>
  );
});

SplunkSecurityOverview.displayName = 'SplunkSecurityOverview';
export default SplunkSecurityOverview;
