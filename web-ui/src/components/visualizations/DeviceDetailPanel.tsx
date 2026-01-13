'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { TopologyNode, DEVICE_COLORS, STATUS_COLORS } from '@/types/visualization';

interface DeviceDetailPanelProps {
  device: TopologyNode | null;
  organization: string;
  onClose: () => void;
  isOpen: boolean;
}

interface HealthData {
  lossAndLatency?: {
    timeSeries?: Array<{
      ts: string;
      lossPercent: number;
      latencyMs: number;
    }>;
  };
  uplink?: {
    interface?: string;
    status?: string;
    ip?: string;
    gateway?: string;
    publicIp?: string;
    dns?: string;
    speed?: string;
  };
}

export default function DeviceDetailPanel({
  device,
  organization,
  onClose,
  isOpen,
}: DeviceDetailPanelProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch device health when device changes
  useEffect(() => {
    if (!device || !isOpen) {
      setHealthData(null);
      return;
    }

    const serial = device.serial;
    if (!serial) return;

    async function fetchHealth() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getDeviceHealth(organization, serial, 86400);
        setHealthData(data);
      } catch (err) {
        console.error('Failed to fetch device health:', err);
        setError('Health data unavailable');
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.serial, organization, isOpen]); // Only refetch when serial changes, not entire device

  if (!device) return null;

  const colors = DEVICE_COLORS[device.type] || DEVICE_COLORS.unknown;
  const statusColors = STATUS_COLORS[device.status] || STATUS_COLORS.unknown;

  // Calculate average metrics from time series
  const avgLatency =
    healthData?.lossAndLatency?.timeSeries && healthData.lossAndLatency.timeSeries.length > 0
      ? (
          healthData.lossAndLatency.timeSeries.reduce((acc, d) => acc + (d.latencyMs || 0), 0) /
          healthData.lossAndLatency.timeSeries.length
        ).toFixed(1)
      : null;

  const avgLoss =
    healthData?.lossAndLatency?.timeSeries && healthData.lossAndLatency.timeSeries.length > 0
      ? (
          healthData.lossAndLatency.timeSeries.reduce((acc, d) => acc + (d.lossPercent || 0), 0) /
          healthData.lossAndLatency.timeSeries.length
        ).toFixed(2)
      : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 dark:bg-black/50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-full theme-bg-primary border-l theme-border z-50 transform transition-transform shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 theme-bg-primary px-4 py-4 border-b theme-border flex items-center justify-between">
          <h3 className="font-semibold theme-text-primary">Device Details</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition theme-text-tertiary hover:theme-text-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Device Header Card */}
        <div className="p-4 border-b theme-border">
          <div className="flex items-center gap-4">
            {/* Device Icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center border-2"
              style={{
                backgroundColor: colors.fill,
                borderColor: colors.stroke,
                boxShadow: `0 0 12px ${statusColors.glow}`,
              }}
            >
              <span className="text-white font-bold text-lg">{device.type}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-semibold theme-text-primary text-lg truncate">
                {device.name || 'Unnamed Device'}
              </h4>
              <p className="text-sm theme-text-muted font-mono">{device.model}</p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium border`}
                style={{
                  backgroundColor: `${statusColors.border}15`,
                  borderColor: `${statusColors.border}40`,
                  color: statusColors.border,
                }}
              >
                {device.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-180px)] p-4 space-y-6">
          {/* Basic Info */}
          <div>
            <h5 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-3">
              Device Information
            </h5>
            <div className="space-y-2">
              <InfoRow label="Serial" value={device.serial} mono />
              <InfoRow label="Model" value={device.model} />
              <InfoRow label="Type" value={colors.label} />
              {device.mac && <InfoRow label="MAC" value={device.mac} mono />}
              {device.lanIp && <InfoRow label="LAN IP" value={device.lanIp} mono />}
              {device.wan1Ip && <InfoRow label="WAN IP" value={device.wan1Ip} mono />}
              {device.firmware && <InfoRow label="Firmware" value={device.firmware} />}
            </div>
          </div>

          {/* Health Metrics */}
          <div>
            <h5 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-3">
              Health Metrics (24h)
            </h5>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <p className="text-sm theme-text-muted py-4 text-center">{error}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Avg Latency"
                  value={avgLatency ? `${avgLatency} ms` : 'N/A'}
                  color="cyan"
                />
                <MetricCard
                  label="Avg Packet Loss"
                  value={avgLoss ? `${avgLoss}%` : 'N/A'}
                  color={avgLoss && parseFloat(avgLoss) > 1 ? 'red' : 'green'}
                />
              </div>
            )}
          </div>

          {/* Uplink Info */}
          {healthData?.uplink && (
            <div>
              <h5 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-3">
                Uplink Status
              </h5>
              <div className="space-y-2">
                {healthData.uplink.interface && (
                  <InfoRow label="Interface" value={healthData.uplink.interface} />
                )}
                {healthData.uplink.status && (
                  <InfoRow label="Status" value={healthData.uplink.status} />
                )}
                {healthData.uplink.publicIp && (
                  <InfoRow label="Public IP" value={healthData.uplink.publicIp} mono />
                )}
                {healthData.uplink.gateway && (
                  <InfoRow label="Gateway" value={healthData.uplink.gateway} mono />
                )}
                {healthData.uplink.dns && (
                  <InfoRow label="DNS" value={healthData.uplink.dns} mono />
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {device.lat && device.lng && (
            <div>
              <h5 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-3">
                Location
              </h5>
              <div className="space-y-2">
                <InfoRow label="Latitude" value={device.lat.toFixed(6)} mono />
                <InfoRow label="Longitude" value={device.lng.toFixed(6)} mono />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t theme-border space-y-2">
            <button
              onClick={() => {
                window.open(`https://dashboard.meraki.com/go/device/${device.serial}`, '_blank');
              }}
              className="w-full px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Open in Meraki Dashboard
            </button>

            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-lg theme-bg-secondary border theme-border theme-text-secondary hover:theme-text-primary text-sm font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm theme-text-muted">{label}</span>
      <span className={`text-sm theme-text-primary ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'cyan' | 'green' | 'red' | 'amber';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-xs opacity-80 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
