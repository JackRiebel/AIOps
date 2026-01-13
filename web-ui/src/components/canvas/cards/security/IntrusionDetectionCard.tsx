'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface IDSAlert {
  id?: string;
  timestamp: string;
  signature: string;
  signatureId?: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sourceIp: string;
  destinationIp: string;
  destPort?: number;
  protocol?: string;
  action: 'blocked' | 'detected' | 'allowed';
  mitreTactic?: string;
  mitreTechnique?: string;
  mitreDescription?: string;
  killChainStage?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  isActive?: boolean;
  eventCount?: number;
  firstSeen?: string;
  threatActor?: string;
}

interface IntrusionDetectionCardData {
  alerts?: IDSAlert[];
  totalAlerts?: number;
  mode?: 'prevention' | 'detection';
  rulesetVersion?: string;
  timeRange?: string;
  networkId?: string;
  organizationId?: string;
}

interface IntrusionDetectionCardProps {
  data: IntrusionDetectionCardData;
  config?: {
    maxAlerts?: number;
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const KILL_CHAIN_STAGES = [
  { id: 'reconnaissance', label: 'Recon', icon: '🔍' },
  { id: 'weaponization', label: 'Weapon', icon: '🔧' },
  { id: 'delivery', label: 'Deliver', icon: '📧' },
  { id: 'exploitation', label: 'Exploit', icon: '💥' },
  { id: 'installation', label: 'Install', icon: '📥' },
  { id: 'command_control', label: 'C2', icon: '📡' },
  { id: 'lateral_movement', label: 'Lateral', icon: '↔️' },
  { id: 'exfiltration', label: 'Exfil', icon: '📤' },
  { id: 'actions_on_objectives', label: 'Actions', icon: '🎯' },
];

const TACTIC_COLORS: Record<string, string> = {
  'Reconnaissance': '#6366f1',
  'Initial Access': '#ef4444',
  'Execution': '#f97316',
  'Persistence': '#eab308',
  'Privilege Escalation': '#f59e0b',
  'Defense Evasion': '#84cc16',
  'Credential Access': '#22c55e',
  'Discovery': '#14b8a6',
  'Lateral Movement': '#06b6d4',
  'Collection': '#0ea5e9',
  'Command and Control': '#8b5cf6',
  'Exfiltration': '#d946ef',
  'Impact': '#ec4899',
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export const IntrusionDetectionCard = memo(({ data, config }: IntrusionDetectionCardProps) => {
  const maxAlerts = config?.maxAlerts ?? 10;
  const [selectedAlert, setSelectedAlert] = useState<IDSAlert | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [blockedSources, setBlockedSources] = useState<Set<string>>(new Set());
  const [exceptions, setExceptions] = useState<Set<string>>(new Set());
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Step 1: Try to get real data from props
    const realAlerts = Array.isArray(data?.alerts) ? data.alerts : [];

    let alerts: IDSAlert[];

    // Step 2: Determine data source based on real data availability and demo mode
    if (realAlerts.length > 0) {
      // Use real data (regardless of demo mode)
      alerts = realAlerts;
    } else if (demoMode) {
      // No real data AND demo mode is ON - generate demo data
      const now = new Date();
      alerts = [
        {
          id: 'demo-1',
          timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
          signature: 'ET SCAN Potential SSH Scan',
          signatureId: 'SID-2001219',
          category: 'Attempted Information Leak',
          severity: 'high',
          sourceIp: '185.220.101.42',
          destinationIp: '10.0.1.50',
          destPort: 22,
          protocol: 'TCP',
          action: 'blocked',
          mitreTactic: 'Reconnaissance',
          killChainStage: 'reconnaissance',
          countryCode: 'RU',
          country: 'Russia',
          eventCount: 47,
        },
        {
          id: 'demo-2',
          timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
          signature: 'ET TROJAN Possible Cobalt Strike Beacon',
          signatureId: 'SID-2024897',
          category: 'A Network Trojan was detected',
          severity: 'critical',
          sourceIp: '10.0.100.15',
          destinationIp: '45.33.32.156',
          destPort: 443,
          protocol: 'TCP',
          action: 'blocked',
          mitreTactic: 'Command and Control',
          killChainStage: 'command_control',
          countryCode: 'US',
          country: 'United States',
          eventCount: 3,
        },
        {
          id: 'demo-3',
          timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
          signature: 'ET POLICY DNS Query to .onion Domain',
          signatureId: 'SID-2023456',
          category: 'Potentially Bad Traffic',
          severity: 'medium',
          sourceIp: '10.0.100.22',
          destinationIp: '8.8.8.8',
          destPort: 53,
          protocol: 'UDP',
          action: 'detected',
          mitreTactic: 'Defense Evasion',
          killChainStage: 'lateral_movement',
          eventCount: 12,
        },
        {
          id: 'demo-4',
          timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
          signature: 'ET EXPLOIT Apache Log4j RCE Attempt',
          signatureId: 'SID-2034647',
          category: 'Attempted Administrator Privilege Gain',
          severity: 'critical',
          sourceIp: '103.94.157.5',
          destinationIp: '10.0.50.10',
          destPort: 8080,
          protocol: 'TCP',
          action: 'blocked',
          mitreTactic: 'Initial Access',
          killChainStage: 'exploitation',
          countryCode: 'CN',
          country: 'China',
          eventCount: 156,
        },
        {
          id: 'demo-5',
          timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
          signature: 'ET SCAN Nmap Scripting Engine User-Agent',
          signatureId: 'SID-2009358',
          category: 'Detection of a Network Scan',
          severity: 'low',
          sourceIp: '192.168.1.100',
          destinationIp: '10.0.1.1',
          destPort: 80,
          protocol: 'TCP',
          action: 'detected',
          mitreTactic: 'Discovery',
          killChainStage: 'reconnaissance',
          countryCode: 'US',
          country: 'United States',
          eventCount: 8,
        },
      ];
    } else {
      // No real data AND demo mode is OFF - return null to show "no data" message
      return null;
    }

    // Sort by severity then timestamp
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...alerts].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Kill chain stage counts
    const stageData: Record<string, { count: number; severity: string; alerts: IDSAlert[] }> = {};
    for (const alert of alerts) {
      const stage = alert.killChainStage || 'unknown';
      if (!stageData[stage]) {
        stageData[stage] = { count: 0, severity: 'low', alerts: [] };
      }
      stageData[stage].count++;
      stageData[stage].alerts.push(alert);
      if (severityOrder[alert.severity] < severityOrder[stageData[stage].severity]) {
        stageData[stage].severity = alert.severity;
      }
    }

    // MITRE tactics breakdown
    const tacticCounts: Record<string, number> = {};
    for (const alert of alerts) {
      const tactic = alert.mitreTactic || 'Unknown';
      tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1;
    }

    // Severity counts
    const severityCounts = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };

    // Active attacks
    const activeAlerts = alerts.filter(a => a.isActive);

    return {
      alerts: sorted.slice(0, maxAlerts),
      totalAlerts: data?.totalAlerts ?? alerts.length,
      stageData,
      tacticCounts,
      severityCounts,
      activeAlerts,
      mode: data?.mode,
    };
  }, [data, maxAlerts, demoMode]);

  const handleBlockSource = useCallback(async (ip: string, alert?: IDSAlert) => {
    // Immediately update UI
    setBlockedSources(prev => new Set([...prev, ip]));

    // Get networkId from data
    const networkId = data?.networkId;
    if (!networkId) {
      console.warn('[IntrusionDetection] No networkId available - IP blocked locally only');
      return;
    }

    try {
      const response = await fetch('/api/cards/security/block-ip', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip_address: ip,
          network_id: networkId,
          reason: alert
            ? `IDS Alert: ${alert.signature} (${alert.category})`
            : `Blocked from IntrusionDetectionCard`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[IntrusionDetection] Failed to block IP:', errorData);
        // Revert UI on failure
        setBlockedSources(prev => {
          const next = new Set(prev);
          next.delete(ip);
          return next;
        });
        return;
      }

      const result = await response.json();
      console.log('[IntrusionDetection] IP blocked successfully:', result);
    } catch (error) {
      console.error('[IntrusionDetection] Error blocking IP:', error);
      // Revert UI on error
      setBlockedSources(prev => {
        const next = new Set(prev);
        next.delete(ip);
        return next;
      });
    }
  }, [data?.networkId]);

  const handleCreateException = useCallback((signatureId: string) => {
    // Update local UI state
    setExceptions(prev => new Set([...prev, signatureId]));
    // Note: Meraki doesn't have a direct API for IDS exceptions.
    // This would typically be done through IDS whitelist rules.
    console.log('[IntrusionDetection] Exception created locally for:', signatureId);
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No IDS/IPS Alerts
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          No intrusion detection alerts in the past 24 hours
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          Enable Demo Mode to see sample data
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Intrusion Detection
            </span>
            {processedData.mode && (
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                processedData.mode === 'prevention'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              }`}>
                {processedData.mode === 'prevention' ? 'IPS' : 'IDS'}
              </span>
            )}
            {processedData.activeAlerts.length > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {processedData.activeAlerts.length} Active
              </span>
            )}
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            {processedData.totalAlerts} alerts
          </span>
        </div>
      </div>

      {/* Kill Chain Visualization */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          {KILL_CHAIN_STAGES.map((stage, idx) => {
            const stageInfo = processedData.stageData[stage.id];
            const hasAlerts = stageInfo && stageInfo.count > 0;
            const isHovered = hoveredStage === stage.id;
            const severity = stageInfo?.severity || 'low';
            const color = hasAlerts ? SEVERITY_COLORS[severity] : '#334155';

            return (
              <div
                key={stage.id}
                className="flex-1 relative cursor-pointer group"
                onMouseEnter={() => setHoveredStage(stage.id)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                {/* Connector line */}
                {idx > 0 && (
                  <div className="absolute left-0 top-1/2 w-full h-0.5 -translate-y-1/2 bg-slate-700 -z-10" />
                )}

                {/* Stage indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-200 ${
                      hasAlerts
                        ? isHovered ? 'scale-125 ring-2 ring-white/30' : ''
                        : 'opacity-40'
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow: hasAlerts ? `0 0 10px ${color}80` : 'none',
                    }}
                  >
                    {hasAlerts ? stageInfo.count : stage.icon}
                  </div>
                  <span className={`text-[8px] mt-1 ${
                    hasAlerts ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {stage.label}
                  </span>
                </div>

                {/* Hover tooltip */}
                {isHovered && hasAlerts && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-[9px] text-white whitespace-nowrap z-10 shadow-lg">
                    {stageInfo.count} {stageInfo.severity} alert{stageInfo.count > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MITRE ATT&CK Tactics */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="flex gap-1">
          {Object.entries(processedData.tacticCounts).slice(0, 5).map(([tactic, count]) => {
            const color = TACTIC_COLORS[tactic] || '#6b7280';
            return (
              <a
                key={tactic}
                href={`https://attack.mitre.org/tactics/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium hover:opacity-80 transition-opacity"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <span>{tactic}</span>
                <span className="opacity-70">({count})</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {processedData.alerts.map((alert, idx) => {
            const isBlocked = blockedSources.has(alert.sourceIp);
            const hasException = exceptions.has(alert.signatureId || '');
            const tacticColor = TACTIC_COLORS[alert.mitreTactic || ''] || '#6b7280';

            return (
              <div
                key={alert.id || idx}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  alert.isActive ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                } hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  isBlocked || hasException ? 'opacity-50' : ''
                }`}
                onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {/* Active indicator */}
                    {alert.isActive && (
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                    )}
                    {!alert.isActive && (
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }}
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {alert.signature}
                        </span>
                        {alert.threatActor && (
                          <span className="px-1 py-0.5 text-[8px] font-medium rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            {alert.threatActor}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{getFlagEmoji(alert.countryCode || '')}</span>
                        <code className="font-mono">{alert.sourceIp}</code>
                        <span>→</span>
                        <code className="font-mono">{alert.destinationIp}:{alert.destPort}</code>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* MITRE technique badge */}
                    {alert.mitreTechnique && (
                      <a
                        href={`https://attack.mitre.org/techniques/${alert.mitreTechnique.replace('.', '/')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-1 py-0.5 text-[8px] font-mono font-medium rounded hover:opacity-80"
                        style={{ backgroundColor: `${tacticColor}20`, color: tacticColor }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {alert.mitreTechnique}
                      </a>
                    )}

                    <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                      alert.action === 'blocked'
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    }`}>
                      {alert.action}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedAlert?.id === alert.id && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400">Signature ID:</span>
                        <span className="ml-1 text-slate-600 dark:text-slate-300 font-mono">
                          {alert.signatureId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Events:</span>
                        <span className="ml-1 text-slate-600 dark:text-slate-300">
                          {alert.eventCount?.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">First seen:</span>
                        <span className="ml-1 text-slate-600 dark:text-slate-300">
                          {alert.firstSeen ? formatTimeAgo(alert.firstSeen) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Last seen:</span>
                        <span className="ml-1 text-slate-600 dark:text-slate-300">
                          {formatTimeAgo(alert.timestamp)}
                        </span>
                      </div>
                    </div>

                    {alert.mitreDescription && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                        MITRE: {alert.mitreDescription}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {isBlocked ? (
                        <span className="flex-1 text-center py-1.5 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded">
                          ✓ Source Blocked
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlockSource(alert.sourceIp, alert);
                          }}
                          className="flex-1 py-1.5 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded transition-colors font-medium"
                        >
                          Block Source
                        </button>
                      )}
                      {hasException ? (
                        <span className="flex-1 text-center py-1.5 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded">
                          ✓ Exception Created
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateException(alert.signatureId || '');
                          }}
                          className="flex-1 py-1.5 text-[10px] bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors font-medium"
                        >
                          Create Exception
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Severity summary footer */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex justify-around text-center">
          {processedData.severityCounts.critical > 0 && (
            <div>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {processedData.severityCounts.critical}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-1">crit</span>
            </div>
          )}
          {processedData.severityCounts.high > 0 && (
            <div>
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {processedData.severityCounts.high}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-1">high</span>
            </div>
          )}
          {processedData.severityCounts.medium > 0 && (
            <div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {processedData.severityCounts.medium}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-1">med</span>
            </div>
          )}
          {processedData.severityCounts.low > 0 && (
            <div>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {processedData.severityCounts.low}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-1">low</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

IntrusionDetectionCard.displayName = 'IntrusionDetectionCard';

export default IntrusionDetectionCard;
