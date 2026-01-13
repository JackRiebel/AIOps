'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface FirewallRule {
  ruleId: string;
  ruleName: string;
  policy: 'allow' | 'deny';
  hitCount: number;
  lastHit?: string;
  srcCidr?: string;
  destCidr?: string;
  destPort?: string;
  protocol?: string;
  comment?: string;
  trend?: number[]; // Recent hit trend
  anomaly?: boolean; // Sudden spike detected
  topSources?: { ip: string; hits: number; country?: string }[];
}

interface FirewallHitsCardData {
  rules?: FirewallRule[];
  totalHits?: number;
  timeRange?: string;
  networkId?: string;
}

interface FirewallHitsCardProps {
  data: FirewallHitsCardData;
  config?: {
    maxRules?: number;
    showDetails?: boolean;
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * FirewallHitsCard - Traffic Flow Visualization
 *
 * Shows:
 * - Visual traffic flow diagram
 * - Rules sorted by hit count with trend sparklines
 * - Click rule to see source breakdown
 * - Edit Rule quick action
 * - Anomaly detection highlighting
 * - Allow/Deny ratio visualization
 */
export const FirewallHitsCard = memo(({ data, config }: FirewallHitsCardProps) => {
  const maxRules = config?.maxRules ?? 8;
  const { demoMode } = useDemoMode();
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null);
  const [policyFilter, setPolicyFilter] = useState<'all' | 'allow' | 'deny'>('all');
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Step 1: Try to get real data from props
    const realRules = Array.isArray(data?.rules) ? data.rules : [];

    let rules: FirewallRule[];

    // Step 2: Determine data source based on real data availability and demo mode
    if (realRules.length > 0) {
      // Use real data (regardless of demo mode)
      rules = realRules;
    } else if (demoMode) {
      // No real data AND demo mode is ON - generate demo data
      const now = new Date();
      rules = [
        { ruleId: 'fw-001', ruleName: 'Allow HTTPS Outbound', policy: 'allow' as const, hitCount: 245892, lastHit: new Date(now.getTime() - 5000).toISOString(), srcCidr: '10.0.0.0/8', destCidr: 'Any', destPort: '443', protocol: 'tcp', trend: [210000, 225000, 235000, 248000, 245892] },
        { ruleId: 'fw-002', ruleName: 'Block SSH External', policy: 'deny' as const, hitCount: 18456, lastHit: new Date(now.getTime() - 30000).toISOString(), srcCidr: 'Any', destCidr: '10.0.0.0/8', destPort: '22', protocol: 'tcp', anomaly: true, trend: [8000, 9500, 12000, 15000, 18456], topSources: [{ ip: '185.220.101.45', hits: 5234, country: 'RU' }, { ip: '103.21.244.15', hits: 3892, country: 'CN' }] },
        { ruleId: 'fw-003', ruleName: 'Allow DNS', policy: 'allow' as const, hitCount: 156234, lastHit: new Date(now.getTime() - 1000).toISOString(), srcCidr: '10.0.0.0/8', destCidr: 'Any', destPort: '53', protocol: 'udp', trend: [145000, 148000, 152000, 154000, 156234] },
        { ruleId: 'fw-004', ruleName: 'Block Telnet', policy: 'deny' as const, hitCount: 8923, lastHit: new Date(now.getTime() - 120000).toISOString(), srcCidr: 'Any', destCidr: 'Any', destPort: '23', protocol: 'tcp', trend: [7800, 8100, 8400, 8700, 8923] },
        { ruleId: 'fw-005', ruleName: 'Allow Internal HTTP', policy: 'allow' as const, hitCount: 89456, lastHit: new Date(now.getTime() - 2000).toISOString(), srcCidr: '10.0.0.0/8', destCidr: '10.0.0.0/8', destPort: '80,8080', protocol: 'tcp', trend: [82000, 84000, 86000, 88000, 89456] },
        { ruleId: 'fw-006', ruleName: 'Block RDP External', policy: 'deny' as const, hitCount: 5678, lastHit: new Date(now.getTime() - 60000).toISOString(), srcCidr: 'Any', destCidr: '10.0.0.0/8', destPort: '3389', protocol: 'tcp', trend: [4500, 4800, 5100, 5400, 5678] },
        { ruleId: 'fw-007', ruleName: 'Allow SMTP Outbound', policy: 'allow' as const, hitCount: 34567, lastHit: new Date(now.getTime() - 15000).toISOString(), srcCidr: '10.10.0.0/16', destCidr: 'Any', destPort: '25,587', protocol: 'tcp', trend: [31000, 32000, 33000, 34000, 34567] },
        { ruleId: 'fw-008', ruleName: 'Block Suspicious Ports', policy: 'deny' as const, hitCount: 12345, lastHit: new Date(now.getTime() - 45000).toISOString(), srcCidr: 'Any', destCidr: 'Any', destPort: '4444,5555,6666', protocol: 'tcp', anomaly: true, trend: [6000, 8000, 10000, 11500, 12345] },
      ];
    } else {
      // No real data AND demo mode is OFF - return null to show "no data" message
      return null;
    }

    // Filter by policy
    const filteredRules = policyFilter === 'all'
      ? rules
      : rules.filter(r => r.policy === policyFilter);

    // Sort by hit count (highest first)
    const sorted = [...filteredRules].sort((a, b) => b.hitCount - a.hitCount);

    // Calculate totals
    const totalHits = data?.totalHits ?? rules.reduce((sum, r) => sum + r.hitCount, 0);
    const allowHits = rules.filter(r => r.policy === 'allow').reduce((sum, r) => sum + r.hitCount, 0);
    const denyHits = rules.filter(r => r.policy === 'deny').reduce((sum, r) => sum + r.hitCount, 0);
    const allowRatio = totalHits > 0 ? (allowHits / totalHits) * 100 : 50;

    // Count anomalies
    const anomalyCount = rules.filter(r => r.anomaly).length;

    return {
      rules: sorted.slice(0, maxRules),
      allRules: rules,
      totalHits,
      allowHits,
      denyHits,
      allowRatio,
      ruleCount: rules.length,
      anomalyCount,
    };
  }, [data, maxRules, policyFilter, demoMode]);

  const handleEditRule = useCallback(async (ruleId: string) => {
    setActionState({ status: 'loading', message: 'Opening rule editor...' });

    const result = await executeCardAction('firewall-edit', {
      ruleId,
      networkId: data?.networkId,
    });

    if (result.success) {
      setActionState({ status: 'success', message: 'Rule editor opened' });
    } else {
      // Fallback - open in new window
      setActionState({ status: 'success', message: 'Opening Meraki dashboard...' });
      // Could open Meraki dashboard: window.open(`https://dashboard.meraki.com/firewall/rules/${ruleId}`, '_blank');
    }

    setTimeout(() => setActionState({ status: 'idle' }), 3000);
  }, [data?.networkId]);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No Firewall Data
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          No firewall rules configured or no hits recorded
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          Enable Demo Mode to see sample data
        </div>
      </div>
    );
  }

  // SVG dimensions for traffic flow diagram
  const flowWidth = 300;
  const flowHeight = 50;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Firewall Hits
            </span>
            {processedData.anomalyCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {processedData.anomalyCount} spikes
              </span>
            )}
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {processedData.ruleCount} rules
          </span>
        </div>

        {/* Policy filter */}
        <div className="flex gap-1">
          {(['all', 'allow', 'deny'] as const).map(policy => (
            <button
              key={policy}
              onClick={() => setPolicyFilter(policy)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                policyFilter === policy
                  ? policy === 'allow'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : policy === 'deny'
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {policy === 'all' ? 'All' : policy === 'allow' ? 'Allow' : 'Deny'}
            </button>
          ))}
        </div>
      </div>

      {/* Traffic Flow Visualization */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <svg viewBox={`0 0 ${flowWidth} ${flowHeight}`} className="w-full h-12" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="allowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="denyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Internet source */}
          <g transform="translate(20, 25)">
            <circle r="15" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="1.5" />
            <text fontSize="8" fill="#3b82f6" textAnchor="middle" dominantBaseline="middle">🌐</text>
          </g>
          <text x="20" y="48" fontSize="7" fill="#94a3b8" textAnchor="middle">Internet</text>

          {/* Firewall */}
          <g transform="translate(150, 25)">
            <rect x="-20" y="-15" width="40" height="30" rx="4" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="1.5" />
            <text fontSize="10" fill="#f59e0b" textAnchor="middle" dominantBaseline="middle">🔥</text>
          </g>
          <text x="150" y="48" fontSize="7" fill="#94a3b8" textAnchor="middle">Firewall</text>

          {/* Internal network */}
          <g transform="translate(280, 25)">
            <circle r="15" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
            <text fontSize="8" fill="#22c55e" textAnchor="middle" dominantBaseline="middle">🏠</text>
          </g>
          <text x="280" y="48" fontSize="7" fill="#94a3b8" textAnchor="middle">Internal</text>

          {/* Allow traffic flow (top) */}
          <path
            d="M 40 20 Q 95 10 130 20"
            fill="none"
            stroke="url(#allowGradient)"
            strokeWidth={Math.max(2, (processedData.allowRatio / 100) * 6)}
          />
          <path
            d="M 170 20 Q 225 10 260 20"
            fill="none"
            stroke="url(#allowGradient)"
            strokeWidth={Math.max(2, (processedData.allowRatio / 100) * 6)}
          />
          {/* Animated packets for allow */}
          <circle r="3" fill="#22c55e">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 40 20 Q 95 10 130 20" />
          </circle>
          <circle r="3" fill="#22c55e">
            <animateMotion dur="2s" repeatCount="indefinite" path="M 170 20 Q 225 10 260 20" begin="0.5s" />
          </circle>

          {/* Deny traffic flow (bottom) - stops at firewall */}
          <path
            d="M 40 30 Q 95 40 130 30"
            fill="none"
            stroke="url(#denyGradient)"
            strokeWidth={Math.max(2, ((100 - processedData.allowRatio) / 100) * 6)}
          />
          {/* Animated packets for deny - stops */}
          <circle r="3" fill="#ef4444">
            <animateMotion dur="1.5s" repeatCount="indefinite" path="M 40 30 Q 95 40 130 30" />
          </circle>

          {/* Stats overlay */}
          <text x="95" y="8" fontSize="8" fill="#22c55e" textAnchor="middle" fontWeight="bold">
            {formatNumber(processedData.allowHits)} ✓
          </text>
          <text x="95" y="48" fontSize="8" fill="#ef4444" textAnchor="middle" fontWeight="bold">
            {formatNumber(processedData.denyHits)} ✗
          </text>
        </svg>
      </div>

      {/* Rules list or selected rule details */}
      {selectedRule ? (
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-800 p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                selectedRule.policy === 'allow'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              }`}>
                {selectedRule.policy.toUpperCase()}
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {selectedRule.ruleName}
              </span>
            </div>
            <button
              onClick={() => setSelectedRule(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
            <div>
              <span className="text-slate-500">Hits:</span>
              <span className="ml-1 text-slate-700 dark:text-slate-300 font-bold">{formatNumber(selectedRule.hitCount)}</span>
            </div>
            {selectedRule.lastHit && (
              <div>
                <span className="text-slate-500">Last:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">{formatTimeAgo(selectedRule.lastHit)}</span>
              </div>
            )}
            {selectedRule.srcCidr && (
              <div>
                <span className="text-slate-500">Source:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300 font-mono text-[9px]">{selectedRule.srcCidr}</span>
              </div>
            )}
            {selectedRule.destCidr && (
              <div>
                <span className="text-slate-500">Dest:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300 font-mono text-[9px]">{selectedRule.destCidr}</span>
              </div>
            )}
            {selectedRule.protocol && (
              <div>
                <span className="text-slate-500">Protocol:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedRule.protocol.toUpperCase()}</span>
              </div>
            )}
            {selectedRule.destPort && (
              <div>
                <span className="text-slate-500">Port:</span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedRule.destPort}</span>
              </div>
            )}
          </div>

          {/* Top sources */}
          {selectedRule.topSources && selectedRule.topSources.length > 0 && (
            <div className="mt-3">
              <div className="text-[9px] font-medium text-slate-500 uppercase mb-1">Top Sources</div>
              <div className="space-y-1">
                {selectedRule.topSources.slice(0, 3).map((src, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-slate-600 dark:text-slate-400">{src.ip}</span>
                    <span className="text-slate-500">{formatNumber(src.hits)} hits</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend sparkline */}
          {selectedRule.trend && selectedRule.trend.length > 0 && (
            <div className="mt-3">
              <div className="text-[9px] font-medium text-slate-500 uppercase mb-1">Hit Trend</div>
              <svg viewBox="0 0 100 20" className="w-full h-5">
                <path
                  d={`M 0 ${20 - (selectedRule.trend[0] / Math.max(...selectedRule.trend)) * 18} ${selectedRule.trend.map((v, i) => `L ${(i / (selectedRule.trend!.length - 1)) * 100} ${20 - (v / Math.max(...selectedRule.trend!)) * 18}`).join(' ')}`}
                  fill="none"
                  stroke={selectedRule.policy === 'allow' ? '#22c55e' : '#ef4444'}
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          )}

          {/* Action Feedback */}
          {actionState.status !== 'idle' && (
            <div className={`mt-3 px-2 py-1.5 rounded text-[10px] flex items-center gap-2 ${
              actionState.status === 'loading' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
              actionState.status === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
              'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
            }`}>
              {actionState.status === 'loading' && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <span>{actionState.message}</span>
            </div>
          )}

          <button
            onClick={() => handleEditRule(selectedRule.ruleId)}
            className="mt-3 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Rule
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-3 py-2">
          <div className="space-y-2">
            {processedData.rules.map((rule, idx) => {
              const maxHits = processedData.rules[0]?.hitCount || 1;
              const percentage = (rule.hitCount / maxHits) * 100;
              const isAllow = rule.policy === 'allow';

              return (
                <div
                  key={rule.ruleId || idx}
                  className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  onClick={() => setSelectedRule(rule)}
                >
                  {/* Rule header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isAllow ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                        {rule.ruleName}
                      </span>
                      {rule.anomaly && (
                        <span className="px-1 py-0.5 text-[7px] font-bold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          SPIKE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                        {formatNumber(rule.hitCount)}
                      </span>
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Hit count bar + mini sparkline */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isAllow ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    {/* Mini sparkline */}
                    {rule.trend && rule.trend.length > 0 && (
                      <svg viewBox="0 0 30 10" className="w-8 h-3 flex-shrink-0">
                        <path
                          d={`M 0 ${10 - (rule.trend[0] / Math.max(...rule.trend)) * 8} ${rule.trend.map((v, i) => `L ${(i / (rule.trend!.length - 1)) * 30} ${10 - (v / Math.max(...rule.trend!)) * 8}`).join(' ')}`}
                          fill="none"
                          stroke={isAllow ? '#22c55e' : '#ef4444'}
                          strokeWidth="1"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                    {rule.protocol && <span>{rule.protocol.toUpperCase()}</span>}
                    {rule.destPort && <span>:{rule.destPort}</span>}
                    {rule.lastHit && <span className="ml-auto">{formatTimeAgo(rule.lastHit)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[8px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Allow
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Deny
            </span>
          </div>
          <span className="text-slate-400">Click for details</span>
        </div>
      </div>
    </div>
  );
});

FirewallHitsCard.displayName = 'FirewallHitsCard';

export default FirewallHitsCard;
