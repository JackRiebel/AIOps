'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricGrid } from '../widgets/MetricTile';
import { DataTable, Column } from '../widgets/DataTable';
import '../styles/cisco-theme.css';

export interface VLANInfo {
  id: number;
  name: string;
  subnet?: string;
  gateway?: string;
  status: StatusLevel;
  deviceCount: number;
  color: string;
}

export interface PortInfo {
  port: string;
  vlan: number;
  mode: 'access' | 'trunk';
  status: StatusLevel;
  device?: string;
}

export interface VLANDiagramData {
  vlans: VLANInfo[];
  ports: PortInfo[];
  trunks: Array<{
    source: string;
    target: string;
    vlans: number[];
    status: StatusLevel;
  }>;
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    status?: StatusLevel;
  }>;
  device_name: string;
}

export interface VLANDiagramCardProps {
  networkId: string;
  deviceSerial?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: VLANDiagramData;
  onVlanClick?: (vlanId: number) => void;
  onDataUpdate?: (data: VLANDiagramData) => void;
}

const PORT_COLUMNS: Column<PortInfo>[] = [
  { key: 'port', label: 'Port', width: '20%' },
  { key: 'vlan', label: 'VLAN', width: '15%' },
  { key: 'mode', label: 'Mode', width: '20%' },
  { key: 'device', label: 'Connected Device', width: '30%' },
  {
    key: 'status',
    label: 'Status',
    align: 'center',
    width: '15%',
    render: (value) => (
      <StatusIndicator
        status={value as StatusLevel}
        size="sm"
        showLabel={false}
      />
    ),
  },
];

export function VLANDiagramCard({
  networkId,
  deviceSerial,
  title = 'VLAN Diagram',
  pollingInterval = 60000,
  initialData,
  onVlanClick,
  onDataUpdate,
}: VLANDiagramCardProps) {
  const [selectedVlan, setSelectedVlan] = useState<number | null>(null);

  const endpoint = deviceSerial
    ? `/api/cards/vlan/${networkId}/data?device=${deviceSerial}`
    : `/api/cards/vlan/${networkId}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<VLANDiagramData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: VLANDiagramData };
      return response.data || (raw as VLANDiagramData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const handleVlanClick = (vlanId: number) => {
    setSelectedVlan(selectedVlan === vlanId ? null : vlanId);
    onVlanClick?.(vlanId);
  };

  const filteredPorts = selectedVlan
    ? data?.ports?.filter((p) => p.vlan === selectedVlan) || []
    : data?.ports || [];

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load VLAN data</p>
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
          {data?.device_name && (
            <p className="enterprise-card-subtitle">{data.device_name}</p>
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
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-16 w-24 rounded" />
              ))}
            </div>
            <div className="skeleton h-40 rounded" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <MetricGrid metrics={data.metrics} columns={4} size="sm" />
            )}

            {/* VLAN Segments */}
            {data.vlans && data.vlans.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  VLANs
                </h4>
                <div className="flex flex-wrap gap-2">
                  {data.vlans.map((vlan) => (
                    <button
                      key={vlan.id}
                      onClick={() => handleVlanClick(vlan.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        selectedVlan === vlan.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: vlan.color }}
                      />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          VLAN {vlan.id}
                        </div>
                        <div className="text-xs text-gray-500">{vlan.name}</div>
                      </div>
                      <div className="ml-2 flex items-center gap-1">
                        <StatusIndicator status={vlan.status} size="sm" showLabel={false} />
                        <span className="text-xs text-gray-500">{vlan.deviceCount}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Diagram */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-center min-h-[120px]">
                {data.vlans && data.vlans.length > 0 ? (
                  <div className="flex items-end gap-1">
                    {data.vlans.map((vlan) => (
                      <div
                        key={vlan.id}
                        className={`flex flex-col items-center cursor-pointer transition-transform ${
                          selectedVlan === vlan.id ? 'scale-110' : ''
                        }`}
                        onClick={() => handleVlanClick(vlan.id)}
                      >
                        <div
                          className="w-12 rounded-t-md flex items-end justify-center text-white text-xs font-medium pb-1"
                          style={{
                            backgroundColor: vlan.color,
                            height: `${Math.max(40, Math.min(100, vlan.deviceCount * 10))}px`,
                            opacity: selectedVlan && selectedVlan !== vlan.id ? 0.4 : 1,
                          }}
                        >
                          {vlan.deviceCount}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {vlan.id}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No VLANs configured</p>
                )}
              </div>
            </div>

            {/* Trunk Links */}
            {data.trunks && data.trunks.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trunk Links
                </h4>
                <div className="space-y-2">
                  {data.trunks.map((trunk, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={trunk.status} size="sm" showLabel={false} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {trunk.source} → {trunk.target}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {trunk.vlans.slice(0, 5).map((vlanId) => {
                          const vlan = data.vlans?.find((v) => v.id === vlanId);
                          return (
                            <span
                              key={vlanId}
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: vlan?.color || '#6B7280',
                                color: '#fff',
                              }}
                            >
                              {vlanId}
                            </span>
                          );
                        })}
                        {trunk.vlans.length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{trunk.vlans.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Port Table */}
            {filteredPorts.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {selectedVlan ? `Ports on VLAN ${selectedVlan}` : 'All Ports'}
                </h4>
                <DataTable
                  columns={PORT_COLUMNS}
                  data={filteredPorts}
                  maxRows={8}
                  size="sm"
                />
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

export default VLANDiagramCard;
