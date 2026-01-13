'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { HealthGauge } from '../widgets/HealthGauge';
import { ProgressBar } from '../widgets/ProgressBar';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface ComplianceCategory {
  name: string;
  score: number;
  status: StatusLevel;
  items_checked: number;
  items_passed: number;
}

export interface NonCompliantItem {
  device: string;
  issue: string;
  severity: StatusLevel;
  category: string;
}

export interface ComplianceData {
  overall: {
    value: number;
    label: string;
    threshold_warning?: number;
    threshold_critical?: number;
  };
  categories: ComplianceCategory[];
  non_compliant_items: NonCompliantItem[];
  last_scan: string;
}

export interface ComplianceCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: ComplianceData;
  onDataUpdate?: (data: ComplianceData) => void;
}

export function ComplianceCard({
  networkId,
  orgId,
  title = 'Compliance Status',
  pollingInterval = 60000,
  initialData,
  onDataUpdate,
}: ComplianceCardProps) {
  const endpoint = `/api/cards/compliance/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<ComplianceData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: ComplianceData };
      return response.data || (raw as ComplianceData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const formatScanTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load compliance data</p>
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
          {data?.last_scan && (
            <p className="enterprise-card-subtitle">
              Last scan: {formatScanTime(data.last_scan)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? resume : pause}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isPaused ? 'Resume polling' : 'Pause polling'}
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
            title="Refresh now"
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
          <div className="flex flex-col gap-4">
            <div className="skeleton h-24 w-24 mx-auto rounded-full" />
            <div className="space-y-3">
              <div className="skeleton h-8 rounded" />
              <div className="skeleton h-8 rounded" />
              <div className="skeleton h-8 rounded" />
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overall Compliance Gauge */}
            <div className="flex justify-center">
              <HealthGauge
                value={data.overall.value}
                label={data.overall.label}
                size="lg"
                thresholds={{
                  warning: data.overall.threshold_warning || 90,
                  critical: data.overall.threshold_critical || 70,
                }}
              />
            </div>

            {/* Category Progress Bars */}
            {data.categories && data.categories.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Compliance by Category
                </h4>
                {data.categories.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <ProgressBar
                      label={cat.name}
                      value={cat.score}
                      status={cat.status}
                      size="sm"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                      {cat.items_passed} / {cat.items_checked} checks passed
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Non-Compliant Items */}
            {data.non_compliant_items && data.non_compliant_items.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Issues Requiring Attention ({data.non_compliant_items.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {data.non_compliant_items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                    >
                      <StatusIndicator status={item.severity} size="sm" showLabel={false} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.device}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {item.issue}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {item.category}
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

export default ComplianceCard;
