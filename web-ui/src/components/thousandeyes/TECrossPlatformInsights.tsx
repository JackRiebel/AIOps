'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Layers, AlertTriangle, CheckCircle, XCircle, Link2, Sparkles, ChevronDown, ChevronRight, Server } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { CrossPlatformInsight, PlatformHealthSummary, CorrelatedDevice, SiteHealthSummary } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TECrossPlatformInsightsProps {
  insights: CrossPlatformInsight[];
  platformHealth: PlatformHealthSummary[];
  correlatedDevices: CorrelatedDevice[];
  siteHealth: SiteHealthSummary[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const severityBorder: Record<CrossPlatformInsight['severity'], string> = {
  info: 'border-l-blue-400',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500',
};

const severityDot: Record<CrossPlatformInsight['severity'], string> = {
  info: 'bg-blue-400',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const platformColors: Record<string, { bg: string; text: string; label: string }> = {
  thousandeyes: { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400', label: 'TE' },
  meraki: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Meraki' },
  catalyst: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400', label: 'Catalyst' },
};

const healthStatusConfig = {
  healthy: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  degraded: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500' },
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
  offline: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' },
};

type PanelTab = 'insights' | 'platforms' | 'devices';

// ============================================================================
// Sub-components
// ============================================================================

const PlatformStatusRow = memo(({ platform }: { platform: PlatformHealthSummary }) => {
  const p = platformColors[platform.platform] || platformColors.thousandeyes;
  const isHealthy = platform.healthPercent >= 90;
  const isDegraded = platform.healthPercent >= 50;

  return (
    <div className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${p.bg} ${p.text} min-w-[52px] text-center`}>
        {p.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${platform.healthPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300 min-w-[32px] text-right">
            {platform.healthPercent}%
          </span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[11px] text-slate-600 dark:text-slate-300">
          <span className="font-medium">{platform.onlineCount}</span>
          <span className="text-slate-400 dark:text-slate-500">/{platform.deviceCount}</span>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500">
          {platform.networkCount} net{platform.networkCount !== 1 ? 's' : ''}
          {platform.alertCount > 0 && (
            <span className="text-red-500 ml-1">{platform.alertCount} alert{platform.alertCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
});
PlatformStatusRow.displayName = 'PlatformStatusRow';

// ============================================================================
// Main Component
// ============================================================================

export const TECrossPlatformInsights = memo(({
  insights,
  platformHealth,
  correlatedDevices,
  siteHealth,
  loading,
  onAskAI,
}: TECrossPlatformInsightsProps) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('insights');
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const hasPlatforms = platformHealth.length > 1;
  const hasDevices = correlatedDevices.length > 0;
  const criticalInsights = useMemo(() => insights.filter(i => i.severity === 'critical'), [insights]);

  const handleAIAnalysis = useCallback((insight: CrossPlatformInsight) => {
    if (!onAskAI || !insight.aiContext) return;
    onAskAI(`Analyze this cross-platform correlation: ${insight.aiContext}. Provide root cause analysis and recommended actions.`);
  }, [onAskAI]);

  // Not configured state
  if (platformHealth.length <= 1 && insights.length === 0) {
    return (
      <DashboardCard
        title="Cross-Platform Intelligence"
        icon={<Layers className="w-4 h-4" />}
        accent="purple"
        loading={loading}
        compact
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Layers className="w-6 h-6 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Multi-Platform Correlation</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[240px]">
            Configure Meraki or Catalyst Center to enable cross-platform intelligence with ThousandEyes.
          </p>
        </div>
      </DashboardCard>
    );
  }

  const badge = criticalInsights.length > 0 ? (
    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full">
      {criticalInsights.length} critical
    </span>
  ) : null;

  return (
    <DashboardCard
      title="Cross-Platform Intelligence"
      icon={<Layers className="w-4 h-4" />}
      accent="purple"
      loading={loading}
      badge={badge}
      compact
    >
      <div className="space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-100 dark:border-slate-700/40 pb-0.5">
          {(['insights', 'platforms', ...(hasDevices ? ['devices'] : [])] as PanelTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-t transition ${
                activeTab === tab
                  ? 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-b-2 border-purple-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'insights' && `Insights${insights.length > 0 ? ` (${insights.length})` : ''}`}
              {tab === 'platforms' && `Platforms (${platformHealth.length})`}
              {tab === 'devices' && `Correlated (${correlatedDevices.length})`}
            </button>
          ))}
        </div>

        {/* Insights tab */}
        {activeTab === 'insights' && (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {insights.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                No cross-platform insights detected
              </div>
            ) : (
              insights.map(insight => {
                const isExpanded = expandedInsight === insight.id;
                return (
                  <div
                    key={insight.id}
                    className={`rounded-lg border border-l-4 ${severityBorder[insight.severity]} border-slate-100 dark:border-slate-700/40 bg-white dark:bg-slate-800/30 transition-all`}
                  >
                    <button
                      onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                      className="w-full text-left p-2.5 flex items-start gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${severityDot[insight.severity]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight">{insight.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{insight.description}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {insight.platforms.map(p => {
                            const pc = platformColors[p];
                            return pc ? (
                              <span key={p} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${pc.bg} ${pc.text}`}>
                                {pc.label}
                              </span>
                            ) : null;
                          })}
                          {insight.category && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 capitalize">{insight.category}</span>
                          )}
                        </div>
                      </div>
                      {insight.aiContext ? (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      ) : null}
                    </button>
                    {isExpanded && insight.aiContext && (
                      <div className="px-2.5 pb-2.5 border-t border-slate-100 dark:border-slate-700/30 pt-2">
                        {insight.relatedItems.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {insight.relatedItems.map((item, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                {item.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleAIAnalysis(insight)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition"
                        >
                          <Sparkles className="w-3 h-3" />
                          AI Root Cause Analysis
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Platforms tab */}
        {activeTab === 'platforms' && (
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {platformHealth.map(p => (
              <PlatformStatusRow key={p.platform} platform={p} />
            ))}

            {/* Site health summary */}
            {siteHealth.length > 0 && (
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700/40">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 px-2">
                  Site Health
                </p>
                {siteHealth.slice(0, 6).map(site => {
                  const cfg = healthStatusConfig[site.overallHealth];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={site.siteName} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <StatusIcon className={`w-3.5 h-3.5 ${cfg.color} flex-shrink-0`} />
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{site.siteName}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {site.merakiDeviceCount > 0 && (
                          <span className="text-[10px] text-green-600 dark:text-green-400">
                            M:{site.merakiOnline}/{site.merakiDeviceCount}
                          </span>
                        )}
                        {site.catalystDeviceCount > 0 && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                            C:{site.catalystReachable}/{site.catalystDeviceCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Correlated Devices tab */}
        {activeTab === 'devices' && (
          <div className="max-h-[320px] overflow-y-auto">
            {correlatedDevices.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                No IP-matched devices across platforms
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
                  Devices matched by IP across ThousandEyes, Meraki, and Catalyst
                </p>
                {correlatedDevices.map(device => {
                  const cfg = healthStatusConfig[device.healthStatus];
                  return (
                    <div key={device.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.color} bg-opacity-10`}>
                        <Link2 className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{device.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{device.matchedIp}</span>
                          {device.platforms.map(p => {
                            const pc = platformColors[p];
                            return pc ? (
                              <span key={p} className={`px-1 py-0 text-[8px] font-bold rounded ${pc.bg} ${pc.text}`}>
                                {pc.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${cfg.bg}`} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardCard>
  );
});

TECrossPlatformInsights.displayName = 'TECrossPlatformInsights';
export default TECrossPlatformInsights;
