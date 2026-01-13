'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { HealthGauge } from '../widgets/HealthGauge';
import { MetricGrid } from '../widgets/MetricTile';
import { SparklineChart } from '../widgets/SparklineChart';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface PerformanceGauge {
  label: string;
  value: number;
  unit: string;
  status: StatusLevel;
  thresholds: { good: number; warning: number };
  sparkline: number[];
}

export interface PerformanceTarget {
  name: string;
  ip: string;
  latency: number;
  loss: number;
  status: StatusLevel;
}

export interface PerformanceData {
  gauges: PerformanceGauge[];
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    status?: StatusLevel;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
  }>;
  targets: PerformanceTarget[];
  summary: {
    overall_status: StatusLevel;
    message: string;
    last_updated: string;
  };
}

export interface PerformanceCardProps {
  testId: string;
  title?: string;
  pollingInterval?: number;
  initialData?: PerformanceData;
  onTargetClick?: (targetName: string) => void;
  onDataUpdate?: (data: PerformanceData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function PerformanceCard({
  testId,
  title = 'Network Performance',
  pollingInterval = 15000,
  initialData,
  onTargetClick,
  onDataUpdate,
}: PerformanceCardProps) {
  const endpoint = `/api/cards/performance/${testId}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<PerformanceData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: PerformanceData };
      return response.data || (raw as PerformanceData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load performance data</p>
          <button
            onClick={refresh}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-card">
      {/* Header */}
      <div className="enterprise-card-header">
        <div>
          <h3 className="enterprise-card-title">{title}</h3>
          {data?.summary && (
            <p
              className="enterprise-card-subtitle"
              style={{ color: STATUS_COLORS[data.summary.overall_status] }}
            >
              {data.summary.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? resume : pause}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isPaused ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            )}
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="enterprise-card-body">
        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Performance Gauges */}
            {data.gauges && data.gauges.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {data.gauges.map((gauge, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className="relative">
                      <HealthGauge
                        value={100 - (gauge.value / gauge.thresholds.warning * 50)}
                        label=""
                        size="md"
                        showValue={false}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className="text-xl font-bold"
                          style={{ color: STATUS_COLORS[gauge.status] }}
                        >
                          {gauge.value}
                        </span>
                        <span className="text-xs text-gray-500">{gauge.unit}</span>
                      </div>
                    </div>
                    <span className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {gauge.label}
                    </span>
                    {gauge.sparkline && gauge.sparkline.length > 0 && (
                      <div className="w-full mt-2">
                        <SparklineChart
                          data={gauge.sparkline}
                          height={24}
                          color={STATUS_COLORS[gauge.status]}
                          showArea={false}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <MetricGrid metrics={data.metrics} columns={3} size="sm" />
              </div>
            )}

            {/* Targets */}
            {data.targets && data.targets.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Monitored Targets
                </h4>
                <div className="space-y-2">
                  {data.targets.map((target, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => onTargetClick?.(target.name)}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={target.status} size="sm" showLabel={false} />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {target.name}
                          </div>
                          <div className="text-xs text-gray-500">{target.ip}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {target.latency.toFixed(1)} ms
                        </div>
                        <div className="text-xs text-gray-500">
                          {target.loss.toFixed(1)}% loss
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="enterprise-card-footer">
        <span>Last updated: {formatTime(lastUpdated)}</span>
        <span className="flex items-center gap-1">
          <StatusIndicator
            status={isPaused ? 'offline' : 'healthy'}
            size="sm"
            showLabel={false}
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default PerformanceCard;
