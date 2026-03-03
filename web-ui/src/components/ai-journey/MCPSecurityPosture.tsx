'use client';

import { memo } from 'react';
import { Shield, Lock, LockOpen, Key, AlertTriangle, Server } from 'lucide-react';
import type { MCPSecurityPosture as MCPSecurityPostureType } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPSecurityPostureProps {
  posture: MCPSecurityPostureType | null;
}

// ============================================================================
// Helpers
// ============================================================================

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981'; // emerald-500
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function scoreTrackColor(score: number): string {
  if (score >= 80) return '#d1fae5'; // emerald-100 (light mode reference)
  if (score >= 60) return '#fef3c7'; // amber-100
  return '#fee2e2'; // red-100
}

function tlsDisplay(status: 'secure' | 'insecure' | 'unknown') {
  switch (status) {
    case 'secure':
      return { icon: Lock, label: 'Secure', color: 'text-emerald-600 dark:text-emerald-400' };
    case 'insecure':
      return { icon: LockOpen, label: 'Insecure', color: 'text-red-600 dark:text-red-400' };
    case 'unknown':
    default:
      return { icon: Shield, label: 'Unknown', color: 'text-slate-500 dark:text-slate-400' };
  }
}

// ============================================================================
// MCPSecurityPosture Component
// ============================================================================

export const MCPSecurityPosture = memo(({ posture }: MCPSecurityPostureProps) => {
  if (!posture) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <div className="flex flex-col items-center justify-center py-6">
          <Shield className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-[13px] text-slate-500 dark:text-slate-400">
            Security posture unavailable
          </p>
        </div>
      </div>
    );
  }

  const color = scoreColor(posture.overall_score);
  const trackColor = scoreTrackColor(posture.overall_score);
  const tls = tlsDisplay(posture.tls_status);
  const TlsIcon = tls.icon;

  // SVG gauge params
  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, posture.overall_score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Security Posture
      </h4>

      {/* Score gauge */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={trackColor}
              strokeWidth={strokeWidth}
              className="dark:opacity-20"
            />
            {/* Progress arc */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>
              {Math.round(posture.overall_score)}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {/* TLS status */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">TLS</span>
            <span className={`flex items-center gap-1 text-[11px] font-medium ${tls.color}`}>
              <TlsIcon className="w-3 h-3" />
              {tls.label}
            </span>
          </div>

          {/* Auth method */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Auth</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <Key className="w-3 h-3" />
              {posture.auth_method}
            </span>
          </div>

          {/* Cert expiry */}
          {posture.cert_days_remaining != null && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Cert expiry</span>
              <span
                className={`text-[11px] font-medium ${
                  posture.cert_days_remaining < 30
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {posture.cert_days_remaining < 30 && (
                  <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                )}
                {posture.cert_days_remaining}d remaining
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200/60 dark:border-slate-700/40 pt-3 space-y-1.5">
        {/* Sensitive tools */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Sensitive tools exposed
          </span>
          <span
            className={`text-[11px] font-semibold ${
              posture.sensitive_tools_exposed > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {posture.sensitive_tools_exposed} / {posture.total_tools}
          </span>
        </div>

        {/* Servers connected */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Server className="w-3 h-3" />
            Servers online
          </span>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {posture.servers_connected} / {posture.servers_total}
          </span>
        </div>
      </div>
    </div>
  );
});

MCPSecurityPosture.displayName = 'MCPSecurityPosture';

export default MCPSecurityPosture;
