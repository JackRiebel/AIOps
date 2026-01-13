'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface ModelCost {
  name: string;
  cost: number;
  percentage: number;
  color: string;
}

export interface DailyCost {
  date: string;
  cost: number;
}

export interface TopOperation {
  name: string;
  cost: number;
  requests: number;
}

export interface BudgetInfo {
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
}

export interface CostTrackingData {
  models: ModelCost[];
  daily_costs: DailyCost[];
  top_operations: TopOperation[];
  sparkline: number[];
  metrics: Array<{
    label: string;
    value: string | number;
    status?: StatusLevel;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
  }>;
  budget: BudgetInfo;
  time_range: string;
}

export interface CostTrackingCardProps {
  orgId: string;
  title?: string;
  pollingInterval?: number;
  initialData?: CostTrackingData;
  onDataUpdate?: (data: CostTrackingData) => void;
}

export function CostTrackingCard({
  orgId,
  title = 'AI Cost Tracking',
  pollingInterval = 60000,
  initialData,
  onDataUpdate,
}: CostTrackingCardProps) {
  const [viewMode, setViewMode] = useState<'models' | 'operations'>('models');

  const endpoint = `/api/cards/cost-tracking/${orgId}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<CostTrackingData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: CostTrackingData };
      return response.data || (raw as CostTrackingData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const formatCurrency = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  // Calculate sparkline path
  const getSparklinePath = (values: number[]) => {
    if (!values || values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 24;
    const step = width / (values.length - 1);

    return values
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load cost data</p>
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
          {data?.time_range && (
            <p className="enterprise-card-subtitle">{data.time_range}</p>
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
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded" />
              ))}
            </div>
            <div className="skeleton h-24 rounded" />
            <div className="skeleton h-32 rounded" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.metrics.map((metric, i) => (
                  <MetricTile key={i} {...metric} size="sm" />
                ))}
              </div>
            )}

            {/* Sparkline */}
            {data.sparkline && data.sparkline.length > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Daily Spend Trend
                </div>
                <svg className="w-full h-6" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <path
                    d={getSparklinePath(data.sparkline)}
                    fill="none"
                    stroke="#049FD9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}

            {/* Budget Progress */}
            {data.budget && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Budget Usage
                  </span>
                  <span className="font-medium">
                    {formatCurrency(data.budget.used)} / {formatCurrency(data.budget.limit)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(data.budget.percentage, 100)}%`,
                      backgroundColor:
                        data.budget.percentage > 90 ? '#D0021B' :
                        data.budget.percentage > 75 ? '#F5A623' : '#00A86B',
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {formatCurrency(data.budget.remaining)} remaining
                </div>
              </div>
            )}

            {/* Toggle Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                onClick={() => setViewMode('models')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode === 'models'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                By Model
              </button>
              <button
                onClick={() => setViewMode('operations')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode === 'operations'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                By Operation
              </button>
            </div>

            {/* Model Breakdown */}
            {viewMode === 'models' && data.models && (
              <div className="space-y-3">
                {/* Distribution Bar */}
                <div className="flex gap-0.5 h-3 rounded overflow-hidden">
                  {data.models.map((model, i) => (
                    <div
                      key={i}
                      className="transition-all"
                      style={{
                        backgroundColor: model.color,
                        flex: model.percentage,
                      }}
                      title={`${model.name}: ${formatCurrency(model.cost)} (${model.percentage}%)`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {data.models.map((model, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: model.color }}
                        />
                        <span className="text-sm">{model.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(model.cost)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {model.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operations Breakdown */}
            {viewMode === 'operations' && data.top_operations && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {data.top_operations.map((op, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div>
                      <div className="text-sm font-medium">{op.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {op.requests.toLocaleString()} requests
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      {formatCurrency(op.cost)}
                    </div>
                  </div>
                ))}
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
          <span>{isPaused ? 'Paused' : 'Tracking'}</span>
        </span>
      </div>
    </div>
  );
}

export default CostTrackingCard;
