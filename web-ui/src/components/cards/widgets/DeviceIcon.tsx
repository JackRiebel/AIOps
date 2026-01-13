'use client';

import React from 'react';
import { StatusLevel } from './StatusIndicator';

export type DeviceType = 'router' | 'switch' | 'ap' | 'firewall' | 'server' | 'client' | 'cloud';

export interface DeviceIconProps {
  type: DeviceType;
  model?: string;
  status?: StatusLevel;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

const SIZE_CONFIG = {
  sm: { icon: 24, label: 'text-xs', container: 'w-10 h-10' },
  md: { icon: 32, label: 'text-xs', container: 'w-14 h-14' },
  lg: { icon: 40, label: 'text-sm', container: 'w-20 h-20' },
  xl: { icon: 48, label: 'text-sm', container: 'w-24 h-24' },
};

// SVG icons for each device type
const DEVICE_ICONS: Record<DeviceType, (size: number, color: string) => React.ReactNode> = {
  router: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="6" cy="12" r="1.5" fill={color} />
      <circle cx="10" cy="12" r="1.5" fill={color} />
      <line x1="15" y1="10" x2="20" y2="10" />
      <line x1="15" y1="14" x2="20" y2="14" />
    </svg>
  ),
  switch: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="7" width="20" height="10" rx="1" />
      <line x1="6" y1="11" x2="6" y2="13" />
      <line x1="9" y1="11" x2="9" y2="13" />
      <line x1="12" y1="11" x2="12" y2="13" />
      <line x1="15" y1="11" x2="15" y2="13" />
      <line x1="18" y1="11" x2="18" y2="13" />
    </svg>
  ),
  ap: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="14" r="4" />
      <path d="M6 10c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M3 7c0-5 4-8 9-8s9 3 9 8" />
    </svg>
  ),
  firewall: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <path d="M7 8h2" />
      <path d="M15 8h2" />
      <path d="M7 16h2" />
      <path d="M15 16h2" />
    </svg>
  ),
  server: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="4" y="2" width="16" height="6" rx="1" />
      <rect x="4" y="9" width="16" height="6" rx="1" />
      <rect x="4" y="16" width="16" height="6" rx="1" />
      <circle cx="8" cy="5" r="1" fill={color} />
      <circle cx="8" cy="12" r="1" fill={color} />
      <circle cx="8" cy="19" r="1" fill={color} />
    </svg>
  ),
  client: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  cloud: (size, color) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
};

export function DeviceIcon({
  type,
  model,
  status = 'healthy',
  size = 'md',
  label,
  showLabel = true,
  onClick,
}: DeviceIconProps) {
  const config = SIZE_CONFIG[size];
  const statusColor = STATUS_COLORS[status];
  const iconColor = status === 'offline' ? '#8E8E93' : '#1A1A1A';

  return (
    <div
      className={`flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Icon container with status ring */}
      <div
        className={`${config.container} flex items-center justify-center rounded-lg
                   bg-white dark:bg-gray-800 border-2 transition-all
                   ${onClick ? 'hover:shadow-lg hover:scale-105' : ''}`}
        style={{ borderColor: statusColor }}
      >
        {DEVICE_ICONS[type](config.icon, iconColor)}
      </div>

      {/* Label */}
      {showLabel && (label || model) && (
        <div className={`${config.label} text-center text-gray-700 dark:text-gray-300 max-w-[80px] truncate`}>
          {label || model}
        </div>
      )}
    </div>
  );
}

export interface DeviceGridProps {
  devices: Array<{
    id: string;
    name: string;
    type: DeviceType;
    model?: string;
    status: StatusLevel;
  }>;
  size?: 'sm' | 'md' | 'lg';
  columns?: number;
  onDeviceClick?: (deviceId: string) => void;
}

export function DeviceGrid({
  devices,
  size = 'md',
  columns = 4,
  onDeviceClick,
}: DeviceGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {devices.map((device) => (
        <DeviceIcon
          key={device.id}
          type={device.type}
          model={device.model}
          status={device.status}
          label={device.name}
          size={size}
          onClick={onDeviceClick ? () => onDeviceClick(device.id) : undefined}
        />
      ))}
    </div>
  );
}

export default DeviceIcon;
