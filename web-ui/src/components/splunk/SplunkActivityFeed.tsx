'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, ChevronRight, ChevronDown, ChevronUp,
  Wifi, Shield, Globe, Key, Radio, Server,
  Search, ExternalLink,
} from 'lucide-react';
import type { SplunkLog } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkActivityFeedProps {
  logs: SplunkLog[];
  loading: boolean;
  onViewAll: () => void;
}

interface ParsedEvent {
  type: string;
  label: string;
  description: string;
  network?: string;
  category: 'security' | 'dhcp' | 'vpn' | 'network' | 'system';
  time: string;
  host: string;
  source: string;
  raw: string;
  severity?: string;
}

// ============================================================================
// Event parsing
// ============================================================================

const EVENT_TYPE_MAP: Record<string, { label: string; category: ParsedEvent['category'] }> = {
  martian_vlan: { label: 'Martian VLAN', category: 'security' },
  ids_alerted: { label: 'IDS Alert', category: 'security' },
  security_event: { label: 'Security Event', category: 'security' },
  aps_association_reject: { label: 'AP Reject', category: 'security' },
  dhcp_lease: { label: 'DHCP Lease', category: 'dhcp' },
  dhcp_offer: { label: 'DHCP Offer', category: 'dhcp' },
  dhcp_no_offer: { label: 'DHCP No Offer', category: 'dhcp' },
  dhcp6na_ren_success: { label: 'DHCPv6 Renew', category: 'dhcp' },
  anyconnect_vpn_connection_success: { label: 'VPN Connected', category: 'vpn' },
  anyconnect_vpn_session_started: { label: 'VPN Session', category: 'vpn' },
  anyconnect_vpn_auth_success: { label: 'VPN Auth OK', category: 'vpn' },
  anyconnect_vpn_connect: { label: 'VPN Connect', category: 'vpn' },
  vpn_connectivity_change: { label: 'VPN Change', category: 'vpn' },
  association: { label: 'WiFi Join', category: 'network' },
  disassociation: { label: 'WiFi Leave', category: 'network' },
  wpa_auth: { label: 'WPA Auth', category: 'network' },
  splash_auth: { label: 'Splash Auth', category: 'network' },
  aps_association: { label: 'AP Associate', category: 'network' },
  flows: { label: 'Flow', category: 'network' },
  port_status: { label: 'Port Status', category: 'network' },
  failover_event: { label: 'Failover', category: 'system' },
};

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; color: string; bg: string; border: string; badgeBg: string; badgeBorder: string }> = {
  security: { icon: Shield, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-l-red-500', badgeBg: 'bg-red-50 dark:bg-red-500/10', badgeBorder: 'border-red-200 dark:border-red-500/20' },
  dhcp: { icon: Server, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-l-blue-400', badgeBg: 'bg-blue-50 dark:bg-blue-500/10', badgeBorder: 'border-blue-200 dark:border-blue-500/20' },
  vpn: { icon: Key, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-l-emerald-500', badgeBg: 'bg-emerald-50 dark:bg-emerald-500/10', badgeBorder: 'border-emerald-200 dark:border-emerald-500/20' },
  network: { icon: Wifi, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10', border: 'border-l-cyan-400', badgeBg: 'bg-cyan-50 dark:bg-cyan-500/10', badgeBorder: 'border-cyan-200 dark:border-cyan-500/20' },
  system: { icon: Globe, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-l-purple-400', badgeBg: 'bg-purple-50 dark:bg-purple-500/10', badgeBorder: 'border-purple-200 dark:border-purple-500/20' },
};

function parseEvent(log: SplunkLog): ParsedEvent {
  let type = '';
  let description = '';
  let network: string | undefined;

  if (log._raw) {
    try {
      const parsed = JSON.parse(log._raw);
      type = parsed.type || '';
      description = parsed.description || parsed.descr || parsed.message || '';
      if (parsed.networkId) network = parsed.networkId;
      if (parsed.networkName) network = parsed.networkName;
    } catch {
      description = log._raw.slice(0, 200);
    }
  }

  const typeInfo = EVENT_TYPE_MAP[type] || {
    label: type
      ? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : (log.severity || log.level || 'Event'),
    category: 'system' as const,
  };

  let time = '';
  const timeStr = log._time;
  if (timeStr) {
    try {
      const d = new Date(timeStr);
      time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      time = timeStr.slice(0, 19);
    }
  }

  if (description.length > 150) description = description.slice(0, 147) + '...';

  return {
    type, label: typeInfo.label, description, network,
    category: typeInfo.category, time,
    host: log.host || '', source: log.source || '',
    raw: log._raw || '', severity: log.severity || log.level,
  };
}

function formatSource(source: string): string {
  if (source.includes('cisco_meraki')) {
    if (source.includes('securityappliances')) return 'Meraki MX';
    if (source.includes('switches')) return 'Meraki Switch';
    if (source.includes('wireless')) return 'Meraki Wireless';
    return 'Meraki';
  }
  if (source.includes('cisco_catalyst') || source.includes('dnac')) return 'Catalyst Center';
  const parts = source.split(/[:/]/);
  return parts[parts.length - 1]?.slice(0, 30) || source.slice(0, 30);
}

// ============================================================================
// Component
// ============================================================================

export const SplunkActivityFeed = memo(({ logs, loading, onViewAll }: SplunkActivityFeedProps) => {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const parsed = useMemo(() => logs.map(parseEvent), [logs]);
  const displayLogs = showAll ? parsed : parsed.slice(0, 10);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    parsed.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [parsed]);

  const handleInvestigate = useCallback((event: ParsedEvent) => {
    const q = `Investigate Splunk event: ${event.label}${event.description ? ` - ${event.description.slice(0, 100)}` : ''} from host ${event.host}`;
    router.push(`/chat-v2?q=${encodeURIComponent(q)}`);
  }, [router]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Recent Activity</h3>
          {parsed.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 tabular-nums">
              {parsed.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(categoryCounts).slice(0, 4).map(([cat, count]) => {
            const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.system;
            return (
              <span
                key={cat}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeBg} ${cfg.color} ${cfg.badgeBorder}`}
              >
                {count} {cat}
              </span>
            );
          })}
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition"
          >
            View All
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {parsed.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No recent activity</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Events will appear as they stream in</p>
        </div>
      ) : (
        <>
          {/* Table Header Row */}
          <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center px-4 py-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 w-16 flex-shrink-0">Time</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 w-8 flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 w-24 flex-shrink-0">Type</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 w-28 flex-shrink-0 hidden sm:block">Source</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 flex-1">Description</span>
              <span className="w-4 flex-shrink-0" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[420px] overflow-y-auto">
            {displayLogs.map((event, i) => {
              const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.system;
              const Icon = cfg.icon;
              const isExpanded = expandedIndex === i;

              return (
                <div key={i} className={`border-l-[3px] ${cfg.border} transition-colors`}>
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0 w-16 font-mono">
                        {event.time}
                      </span>
                      <div className={`w-5 h-5 rounded-md ${cfg.bg} flex items-center justify-center flex-shrink-0 mr-2`}>
                        <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                      </div>
                      <span className={`text-[11px] font-semibold flex-shrink-0 w-24 truncate ${cfg.color}`}>
                        {event.label}
                      </span>
                      {event.source && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate hidden sm:inline-block w-28 flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-700/30">
                          {formatSource(event.source)}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex-1 min-w-0">
                        {event.description.slice(0, 60)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 ml-[76px] space-y-2">
                      {event.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{event.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {event.host && (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-lg">
                            <Globe className="w-2.5 h-2.5" /> {event.host}
                          </span>
                        )}
                        {event.source && (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-lg">
                            <Radio className="w-2.5 h-2.5" /> {formatSource(event.source)}
                          </span>
                        )}
                        {event.network && (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-lg">
                            <Wifi className="w-2.5 h-2.5" /> {event.network}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleInvestigate(event); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition"
                        >
                          <Search className="w-2.5 h-2.5" /> Investigate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const q = `search index=* host="${event.host}" "${event.type}" | head 50`;
                            router.push(`/splunk?view=investigate&q=${encodeURIComponent(q)}`);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Find Similar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {parsed.length > 10 && (
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/40">
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
              >
                {showAll ? 'Show less' : `Show all ${parsed.length} events`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

SplunkActivityFeed.displayName = 'SplunkActivityFeed';
export default SplunkActivityFeed;
