'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cloud,
  Server,
  Eye,
  Database,
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface IntegrationHealth {
  id: string;
  name: string;
  displayName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'not_configured';
  connectedCount?: number;
  totalCount?: number;
  issueCount?: number;
  lastChecked?: Date;
  href: string;
}

export interface UnifiedHealthWidgetProps {
  integrations: IntegrationHealth[];
  overallScore?: number; // 0-100
  trend?: 'improving' | 'stable' | 'degrading';
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Integration Icons
// ============================================================================

const integrationIcons: Record<string, React.ElementType> = {
  meraki: Cloud,
  catalyst: Server,
  thousandeyes: Eye,
  splunk: Database,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusCounts(integrations: IntegrationHealth[]) {
  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;
  let notConfigured = 0;

  integrations.forEach((i) => {
    switch (i.status) {
      case 'healthy':
        healthy++;
        break;
      case 'degraded':
        degraded++;
        break;
      case 'unhealthy':
        unhealthy++;
        break;
      case 'not_configured':
      case 'unknown':
        notConfigured++;
        break;
    }
  });

  return { healthy, degraded, unhealthy, notConfigured, total: integrations.length };
}

// ============================================================================
// HealthRing Component
// ============================================================================

function HealthRing({ integrations }: { integrations: IntegrationHealth[] }) {
  // Count by status
  const configured = integrations.filter(i => i.status !== 'not_configured' && i.status !== 'unknown');
  const healthy = configured.filter(i => i.status === 'healthy').length;
  const degraded = configured.filter(i => i.status === 'degraded').length;
  const unhealthy = configured.filter(i => i.status === 'unhealthy').length;
  const total = configured.length;

  const healthPercent = total > 0 ? Math.round((healthy / total) * 100) : 0;

  // SVG ring parameters
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Only include segments with values > 0
  const segments = [
    { value: healthy, color: '#22c55e' }, // Green for healthy
    { value: degraded, color: '#f59e0b' }, // Amber for degraded
    { value: unhealthy, color: '#ef4444' }, // Red for unhealthy
  ].filter(s => s.value > 0);

  let offset = 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-200 dark:text-slate-700"
        />

        {/* Segments - only render those with value > 0 */}
        {total > 0 && segments.map((segment, i) => {
          const segmentLength = (segment.value / total) * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference}`}
              strokeDashoffset={-offset}
              fill="none"
              className="transition-all duration-500"
            />
          );
          offset += segmentLength;
          return el;
        })}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-900 dark:text-white">{healthPercent}%</span>
        <span className="text-[9px] text-slate-500 dark:text-slate-400">Health</span>
      </div>
    </div>
  );
}

// ============================================================================
// IntegrationRow Component
// ============================================================================

function IntegrationRow({ integration }: { integration: IntegrationHealth }) {
  const Icon = integrationIcons[integration.name] || Activity;
  const isConfigured = integration.status !== 'not_configured' && integration.status !== 'unknown';
  const connected = integration.connectedCount ?? (isConfigured ? 1 : 0);
  const total = integration.totalCount ?? (isConfigured ? 1 : 0);

  const healthPercent = total > 0 ? Math.round((connected / total) * 100) : 0;

  // Status text
  const statusText = isConfigured
    ? `${connected}/${total} connected`
    : 'Not configured';

  return (
    <Link href={integration.href} className="flex items-center justify-between py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-1 px-1 rounded transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
          <Icon className="w-3 h-3 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-900 dark:text-white">{integration.displayName}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {statusText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Status indicator */}
        {isConfigured ? (
          healthPercent === 100 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          ) : healthPercent > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          )
        ) : (
          <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
        )}

        {/* Health bar */}
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              healthPercent === 100
                ? 'bg-green-500'
                : healthPercent > 0
                ? 'bg-amber-500'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// UnifiedHealthWidget Component
// ============================================================================

export const UnifiedHealthWidget = memo(({
  integrations,
  loading,
  className = '',
}: UnifiedHealthWidgetProps) => {
  const counts = useMemo(() => getStatusCounts(integrations), [integrations]);
  const configured = counts.healthy + counts.degraded + counts.unhealthy;
  const issues = counts.degraded + counts.unhealthy;

  return (
    <DashboardCard
      title="System Health"
      icon={<Activity className="w-4 h-4" />}
      href="/health"
      linkText="Details →"
      accent="green"
      loading={loading}
      className={className}
    >
      <div className="h-full flex flex-col">
        {/* Health Ring */}
        <div className="flex items-center justify-center mb-3">
          <HealthRing integrations={integrations} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-1 mb-3 p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
          <div className="text-center">
            <p className="text-base font-bold text-slate-900 dark:text-white">{counts.total}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total</p>
          </div>
          <div className="text-center border-x border-slate-200 dark:border-slate-700">
            <p className="text-base font-bold text-green-600 dark:text-green-400">{configured}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Active</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-amber-600 dark:text-amber-400">{issues}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Issues</p>
          </div>
        </div>

        {/* Integration Rows */}
        <div className="flex-1 space-y-0.5 border-t border-slate-200 dark:border-slate-700 pt-3 overflow-auto">
          <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
            By Integration
          </p>
          {integrations.map((integration) => (
            <IntegrationRow key={integration.id} integration={integration} />
          ))}
        </div>
      </div>
    </DashboardCard>
  );
});

UnifiedHealthWidget.displayName = 'UnifiedHealthWidget';

export default UnifiedHealthWidget;
