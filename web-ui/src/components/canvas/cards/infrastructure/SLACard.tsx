'use client';

import { memo, useMemo, useState } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface SLAMetric {
  name: string;
  target: number;     // Target value (e.g., 99.9 for uptime)
  current: number;    // Current value
  unit: string;       // e.g., '%', 'ms', 's'
  inverted?: boolean; // If true, lower is better (e.g., latency)
  description?: string;
}

interface ProcessedMetric extends SLAMetric {
  compliance: number;
  status: 'met' | 'warning' | 'failed';
}

interface SLACardData {
  metrics?: SLAMetric[];
  // Or simple SLA data
  overallScore?: number;  // 0-100
  uptime?: { target: number; current: number };
  latency?: { target: number; current: number };
  packetLoss?: { target: number; current: number };
  networkId?: string;
  organizationId?: string;
  periodLabel?: string;  // e.g., "Last 30 days"
}

interface SLACardProps {
  data: SLACardData;
  config?: Record<string, unknown>;
}

function ProgressRing({
  progress,
  size = 60,
  strokeWidth = 6,
  color,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-200 dark:text-slate-700"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-500 ease-out"
      />
    </svg>
  );
}

/**
 * Metric Detail Panel - Shows drill-down information for a metric
 */
function MetricDetailPanel({
  metric,
  onClose
}: {
  metric: ProcessedMetric;
  onClose: () => void;
}) {
  const statusColors = {
    met: { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Compliant' },
    warning: { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'At Risk' },
    failed: { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Non-Compliant' },
  };

  const status = statusColors[metric.status];
  const gap = metric.inverted
    ? metric.current - metric.target
    : metric.target - metric.current;
  const gapPercent = ((Math.abs(gap) / metric.target) * 100).toFixed(1);

  // Get explanation based on metric type
  const getExplanation = () => {
    if (metric.status === 'met') {
      return `Currently meeting target. ${metric.name} is at ${metric.current}${metric.unit} which is ${metric.inverted ? 'below' : 'above'} the target of ${metric.target}${metric.unit}.`;
    }
    if (metric.status === 'warning') {
      return `Close to target but at risk. ${metric.name} is at ${metric.current}${metric.unit}, ${gapPercent}% ${metric.inverted ? 'above' : 'below'} the target of ${metric.target}${metric.unit}.`;
    }
    return `Not meeting target. ${metric.name} is at ${metric.current}${metric.unit}, ${gapPercent}% ${metric.inverted ? 'above' : 'below'} the target of ${metric.target}${metric.unit}.`;
  };

  // Get recommendations based on metric type and status
  const getRecommendations = () => {
    if (metric.status === 'met') return [];

    const recommendations: string[] = [];
    const name = metric.name.toLowerCase();

    if (name.includes('uptime')) {
      recommendations.push('Review device health and alerting configurations');
      recommendations.push('Check for recurring outage patterns in logs');
      recommendations.push('Consider redundancy improvements');
    } else if (name.includes('latency')) {
      recommendations.push('Check network path for congestion points');
      recommendations.push('Review QoS policies and traffic prioritization');
      recommendations.push('Consider WAN optimization or SD-WAN');
    } else if (name.includes('packet') || name.includes('loss')) {
      recommendations.push('Check interface error counters on network devices');
      recommendations.push('Review cable connections and physical layer');
      recommendations.push('Analyze traffic patterns for oversubscription');
    }
    return recommendations;
  };

  return (
    <div className="absolute inset-0 bg-white dark:bg-slate-800 z-10 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {metric.name} Details
          </span>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${status.bg} text-white`}>
          {status.label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Current Status */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Current Status</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400">Current</div>
              <div className={`text-lg font-bold ${status.text}`}>
                {metric.current}{metric.unit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Target</div>
              <div className="text-lg font-bold text-slate-600 dark:text-slate-300">
                {metric.inverted ? '≤' : '≥'}{metric.target}{metric.unit}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Compliance: <span className={`font-semibold ${status.text}`}>{metric.compliance.toFixed(1)}%</span>
          </div>
        </div>

        {/* Explanation */}
        <div>
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Analysis</div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {getExplanation()}
          </p>
        </div>

        {/* Recommendations (if not met) */}
        {metric.status !== 'met' && (
          <div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Recommended Actions
            </div>
            <ul className="space-y-1.5">
              {getRecommendations().map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Historical note */}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          Tip: Ask the AI assistant for detailed historical trends or to investigate specific issues.
        </div>
      </div>
    </div>
  );
}

/**
 * SLACard - SLA compliance metrics visualization
 *
 * Shows:
 * - Overall SLA score
 * - Individual metric compliance
 * - Progress rings for each metric
 * - Click on any metric for drill-down details
 */
export const SLACard = memo(({ data, config }: SLACardProps) => {
  const [selectedMetric, setSelectedMetric] = useState<ProcessedMetric | null>(null);
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    const hasRealData = data && ((data.metrics && data.metrics.length > 0) || data.overallScore !== undefined);
    const mockData: SLACardData = (!hasRealData && demoMode) ? {
      periodLabel: 'Last 30 days',
      metrics: [
        { name: 'Uptime', target: 99.9, current: 99.85, unit: '%', description: 'Network availability' },
        { name: 'Latency', target: 50, current: 42, unit: 'ms', inverted: true, description: 'Round-trip time' },
        { name: 'Packet Loss', target: 0.1, current: 0.08, unit: '%', inverted: true, description: 'Data loss rate' },
        { name: 'Throughput', target: 95, current: 97, unit: '%', description: 'Bandwidth utilization' },
        { name: 'Jitter', target: 30, current: 18, unit: 'ms', inverted: true, description: 'Latency variation' },
        { name: 'Availability', target: 99.5, current: 99.2, unit: '%', description: 'Service availability' },
      ],
    } : data;

    if (!mockData.metrics?.length && !mockData.uptime && !mockData.latency && !mockData.packetLoss) return null;

    // Build metrics array from data
    const metrics: Array<SLAMetric & { compliance: number; status: 'met' | 'warning' | 'failed' }> = [];

    if (mockData.metrics) {
      mockData.metrics.forEach(m => {
        const compliance = m.inverted
          ? m.current <= m.target ? 100 : (m.target / m.current) * 100
          : (m.current / m.target) * 100;

        metrics.push({
          ...m,
          compliance: Math.min(100, compliance),
          status: compliance >= 100 ? 'met' : compliance >= 95 ? 'warning' : 'failed',
        });
      });
    } else {
      // Build from individual fields
      if (mockData.uptime) {
        const compliance = (mockData.uptime.current / mockData.uptime.target) * 100;
        metrics.push({
          name: 'Uptime',
          target: mockData.uptime.target,
          current: mockData.uptime.current,
          unit: '%',
          compliance: Math.min(100, compliance),
          status: compliance >= 100 ? 'met' : compliance >= 95 ? 'warning' : 'failed',
        });
      }
      if (mockData.latency) {
        const compliance = mockData.latency.current <= mockData.latency.target
          ? 100
          : (mockData.latency.target / mockData.latency.current) * 100;
        metrics.push({
          name: 'Latency',
          target: mockData.latency.target,
          current: mockData.latency.current,
          unit: 'ms',
          inverted: true,
          compliance: Math.min(100, compliance),
          status: compliance >= 100 ? 'met' : compliance >= 95 ? 'warning' : 'failed',
        });
      }
      if (mockData.packetLoss) {
        const compliance = mockData.packetLoss.current <= mockData.packetLoss.target
          ? 100
          : (mockData.packetLoss.target / mockData.packetLoss.current) * 100;
        metrics.push({
          name: 'Packet Loss',
          target: mockData.packetLoss.target,
          current: mockData.packetLoss.current,
          unit: '%',
          inverted: true,
          compliance: Math.min(100, compliance),
          status: compliance >= 100 ? 'met' : compliance >= 95 ? 'warning' : 'failed',
        });
      }
    }

    // Calculate overall score
    const overallScore = mockData.overallScore ?? (
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.compliance, 0) / metrics.length
        : 0
    );

    const metCount = metrics.filter(m => m.status === 'met').length;
    const warningCount = metrics.filter(m => m.status === 'warning').length;
    const failedCount = metrics.filter(m => m.status === 'failed').length;

    return {
      metrics,
      overallScore,
      metCount,
      warningCount,
      failedCount,
      periodLabel: mockData.periodLabel || 'Current Period',
    };
  }, [data, demoMode]);

  if (!processedData || processedData.metrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No SLA data
      </div>
    );
  }

  const overallColor =
    processedData.overallScore >= 100 ? 'rgb(34, 197, 94)' :
    processedData.overallScore >= 95 ? 'rgb(245, 158, 11)' :
    'rgb(239, 68, 68)';

  const statusColors = {
    met: 'rgb(34, 197, 94)',
    warning: 'rgb(245, 158, 11)',
    failed: 'rgb(239, 68, 68)',
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Drill-down panel */}
      {selectedMetric && (
        <MetricDetailPanel
          metric={selectedMetric}
          onClose={() => setSelectedMetric(null)}
        />
      )}

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            SLA Compliance
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {processedData.periodLabel}
          </span>
        </div>
      </div>

      {/* Overall score */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center justify-center gap-4 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <ProgressRing
            progress={processedData.overallScore}
            size={80}
            strokeWidth={8}
            color={overallColor}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-xl font-bold tabular-nums"
              style={{ color: overallColor }}
            >
              {processedData.overallScore.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Overall Score
          </div>
          <div className="flex items-center gap-2 mt-1">
            {processedData.metCount > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {processedData.metCount} met
              </span>
            )}
            {processedData.warningCount > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                {processedData.warningCount} warning
              </span>
            )}
            {processedData.failedCount > 0 && (
              <span className="text-[10px] text-red-600 dark:text-red-400">
                {processedData.failedCount} failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Individual metrics - clickable for drill-down */}
      <div className="flex-1 overflow-auto p-3">
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-2 text-center">
          Click any metric for details
        </div>
        <div className="grid grid-cols-2 gap-3">
          {processedData.metrics.map((metric, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedMetric(metric)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                metric.status === 'met' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400' :
                metric.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-400' :
                'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  {metric.name}
                </span>
                <div className="relative">
                  <ProgressRing
                    progress={metric.compliance}
                    size={36}
                    strokeWidth={4}
                    color={statusColors[metric.status]}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {metric.status === 'met' ? (
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[9px] font-bold" style={{ color: statusColors[metric.status] }}>
                        {metric.compliance.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {metric.current}{metric.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Target:</span>
                  <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                    {metric.inverted ? '≤' : '≥'}{metric.target}{metric.unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SLACard.displayName = 'SLACard';

export default SLACard;
