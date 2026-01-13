'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface ComplianceCheck {
  id: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'not-applicable';
  description?: string;
  remediation?: string;
  weight?: number;  // Importance weight for scoring
}

interface ComplianceScoreCardData {
  checks?: ComplianceCheck[];
  overallScore?: number;  // 0-100
  framework?: string;  // e.g., "CIS", "NIST", "PCI-DSS"
  lastScan?: string;
  networkId?: string;
}

interface ComplianceScoreCardProps {
  data: ComplianceScoreCardData;
  config?: {
    showFailedOnly?: boolean;
    maxChecks?: number;
  };
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  pass: { icon: '✓', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Pass' },
  fail: { icon: '✕', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Fail' },
  warning: { icon: '!', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Warning' },
  'not-applicable': { icon: '-', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700', label: 'N/A' },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 90) return '#10b981'; // emerald-500
  if (score >= 70) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

/**
 * ComplianceScoreCard - Security compliance status
 *
 * Shows:
 * - Overall compliance score (radial progress)
 * - Pass/fail/warning counts
 * - Failed checks checklist
 * - Framework info
 */
export const ComplianceScoreCard = memo(({ data, config }: ComplianceScoreCardProps) => {
  const showFailedOnly = config?.showFailedOnly ?? true;
  const maxChecks = config?.maxChecks ?? 10;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Ensure checks is an array
    let rawChecks = data?.checks || [];
    let checks = Array.isArray(rawChecks) ? rawChecks : [];

    // Generate mock data if no real data available and demo mode is enabled
    if (demoMode && (!data || checks.length === 0)) {
      checks = [
        { id: 'cc-001', name: 'Enforce MFA for all users', category: 'Access Control', status: 'pass' as const, description: 'Multi-factor authentication enabled for all accounts' },
        { id: 'cc-002', name: 'Network segmentation', category: 'Network Security', status: 'pass' as const, description: 'VLANs properly configured for network isolation' },
        { id: 'cc-003', name: 'Encryption at rest', category: 'Data Protection', status: 'pass' as const, description: 'All stored data is encrypted with AES-256' },
        { id: 'cc-004', name: 'Firewall rules review', category: 'Network Security', status: 'warning' as const, description: 'Some rules have not been reviewed in 90+ days', remediation: 'Review and update stale firewall rules' },
        { id: 'cc-005', name: 'Password complexity', category: 'Access Control', status: 'pass' as const, description: 'Strong password policy enforced' },
        { id: 'cc-006', name: 'Patch management', category: 'Vulnerability Management', status: 'fail' as const, description: '3 devices have critical patches pending', remediation: 'Apply pending security patches immediately' },
        { id: 'cc-007', name: 'Logging and monitoring', category: 'Audit', status: 'pass' as const, description: 'Comprehensive logging enabled across all systems' },
        { id: 'cc-008', name: 'Backup verification', category: 'Data Protection', status: 'pass' as const, description: 'Backups tested and verified weekly' },
        { id: 'cc-009', name: 'Vendor access controls', category: 'Access Control', status: 'warning' as const, description: '2 vendor accounts have excessive permissions', remediation: 'Review and restrict vendor access levels' },
        { id: 'cc-010', name: 'SSL/TLS configuration', category: 'Network Security', status: 'pass' as const, description: 'TLS 1.3 enforced, weak ciphers disabled' },
        { id: 'cc-011', name: 'Endpoint protection', category: 'Endpoint Security', status: 'pass' as const, description: 'EDR solution deployed on all endpoints' },
        { id: 'cc-012', name: 'Incident response plan', category: 'Governance', status: 'not-applicable' as const, description: 'Documented and tested quarterly' },
      ];
    }

    // Return null if still no checks
    if (checks.length === 0) return null;

    // Calculate status counts
    const statusCounts = {
      pass: checks.filter(c => c.status === 'pass').length,
      fail: checks.filter(c => c.status === 'fail').length,
      warning: checks.filter(c => c.status === 'warning').length,
      'not-applicable': checks.filter(c => c.status === 'not-applicable').length,
    };

    // Calculate score if not provided
    const applicableChecks = checks.filter(c => c.status !== 'not-applicable');
    const passedChecks = checks.filter(c => c.status === 'pass');
    const calculatedScore = applicableChecks.length > 0
      ? Math.round((passedChecks.length / applicableChecks.length) * 100)
      : 0;
    const overallScore = data?.overallScore ?? calculatedScore;

    // Filter and sort checks
    let displayChecks = showFailedOnly
      ? checks.filter(c => c.status === 'fail' || c.status === 'warning')
      : checks;

    // Sort: fail first, then warning, then pass
    const statusOrder = { fail: 0, warning: 1, pass: 2, 'not-applicable': 3 };
    displayChecks = [...displayChecks].sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    );

    // Group by category
    const categories: Record<string, ComplianceCheck[]> = {};
    for (const check of displayChecks.slice(0, maxChecks)) {
      const cat = check.category || 'General';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(check);
    }

    return {
      checks: displayChecks.slice(0, maxChecks),
      categories,
      statusCounts,
      overallScore,
      totalChecks: checks.length,
    };
  }, [data, showFailedOnly, maxChecks, demoMode]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No compliance data
      </div>
    );
  }

  const scoreColor = getScoreColor(processedData.overallScore);
  const ringColor = getScoreRingColor(processedData.overallScore);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (processedData.overallScore / 100) * circumference;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Compliance Score
            </span>
            {data.framework && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {data.framework}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {processedData.totalChecks} checks
          </span>
        </div>
      </div>

      {/* Score ring and summary */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {/* Score ring */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-200 dark:text-slate-700"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${scoreColor}`}>
                {processedData.overallScore}%
              </span>
            </div>
          </div>

          {/* Status counts */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                {processedData.statusCounts.pass}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">Passed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-bold">
                {processedData.statusCounts.fail}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold">
                {processedData.statusCounts.warning}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">Warnings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold">
                {processedData.statusCounts['not-applicable']}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">N/A</span>
            </div>
          </div>
        </div>
      </div>

      {/* Checks list */}
      <div className="flex-1 overflow-auto p-3">
        {Object.entries(processedData.categories).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(processedData.categories).map(([category, checks]) => (
              <div key={category}>
                <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  {category}
                </div>
                <div className="space-y-1.5">
                  {checks.map((check, idx) => {
                    const statusConfig = STATUS_CONFIG[check.status] || STATUS_CONFIG.pass;
                    return (
                      <div
                        key={check.id || idx}
                        className="flex items-start gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-800/50"
                      >
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1">
                            {check.name}
                          </span>
                          {check.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {check.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 py-4">
            All checks passed!
          </div>
        )}
      </div>

      {/* Footer */}
      {data.lastScan && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            Last scan: {new Date(data.lastScan).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
});

ComplianceScoreCard.displayName = 'ComplianceScoreCard';

export default ComplianceScoreCard;
