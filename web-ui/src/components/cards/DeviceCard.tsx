'use client';

/**
 * DeviceCard component for displaying network device information.
 *
 * Used in network views, Canvas artifact renderers, and device lists
 * to show device details with status indicators.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import { getStatusBadgeClasses, getStatusIcon } from '@/lib/status-helpers';
import { cn } from '@/lib/utils';

export interface Device {
  /** Unique identifier */
  id: string;
  /** Device name/hostname */
  name: string;
  /** Device model */
  model?: string;
  /** Serial number */
  serial?: string;
  /** Current status */
  status: string;
  /** MAC address */
  mac?: string;
  /** LAN IP address */
  lanIp?: string;
  /** Public/WAN IP address */
  publicIp?: string;
  /** Last seen timestamp */
  lastSeen?: string;
  /** Device type/category */
  type?: string;
  /** Network ID */
  networkId?: string;
  /** Firmware version */
  firmware?: string;
  /** Tags */
  tags?: string[];
}

export interface DeviceCardProps {
  /** Device data to display */
  device: Device;
  /** Click handler */
  onClick?: (id: string) => void;
  /** Whether the card is selected */
  selected?: boolean;
  /** Show compact version */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DeviceCard displays network device information with status.
 *
 * @example
 * <DeviceCard
 *   device={{
 *     id: 'abc123',
 *     name: 'Main Router',
 *     model: 'MX67',
 *     status: 'online',
 *     lanIp: '192.168.1.1'
 *   }}
 *   onClick={(id) => navigate(`/devices/${id}`)}
 * />
 */
export function DeviceCard({
  device,
  onClick,
  selected = false,
  compact = false,
  className,
}: DeviceCardProps) {
  const StatusIcon = getStatusIcon(device.status);

  if (compact) {
    return (
      <Card
        className={cn(
          'transition-all duration-200',
          onClick && 'cursor-pointer hover:shadow-lg hover:border-blue-300',
          selected && 'ring-2 ring-blue-500 border-blue-500',
          className
        )}
        onClick={() => onClick?.(device.id)}
        padding="sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {device.name}
            </p>
            {device.model && (
              <p className="text-xs text-gray-500">{device.model}</p>
            )}
          </div>
          <span className={getStatusBadgeClasses(device.status)}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {device.status}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-lg hover:border-blue-300',
        selected && 'ring-2 ring-blue-500 border-blue-500',
        className
      )}
      onClick={() => onClick?.(device.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base truncate flex-1 mr-2">
            {device.name}
          </CardTitle>
          <span className={getStatusBadgeClasses(device.status)}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {device.status}
          </span>
        </div>
        {device.model && (
          <p className="text-sm text-gray-500">{device.model}</p>
        )}
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {device.serial && (
          <div className="flex justify-between">
            <span className="text-gray-500">Serial:</span>
            <span className="font-mono text-gray-700">{device.serial}</span>
          </div>
        )}
        {device.lanIp && (
          <div className="flex justify-between">
            <span className="text-gray-500">LAN IP:</span>
            <span className="font-mono text-gray-700">{device.lanIp}</span>
          </div>
        )}
        {device.publicIp && (
          <div className="flex justify-between">
            <span className="text-gray-500">Public IP:</span>
            <span className="font-mono text-gray-700">{device.publicIp}</span>
          </div>
        )}
        {device.mac && (
          <div className="flex justify-between">
            <span className="text-gray-500">MAC:</span>
            <span className="font-mono text-xs text-gray-700">{device.mac}</span>
          </div>
        )}
        {device.firmware && (
          <div className="flex justify-between">
            <span className="text-gray-500">Firmware:</span>
            <span className="text-gray-700 text-xs">{device.firmware}</span>
          </div>
        )}
        {device.tags && device.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {device.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
      {device.lastSeen && (
        <CardFooter className="text-xs text-gray-400">
          Last seen: {device.lastSeen}
        </CardFooter>
      )}
    </Card>
  );
}

export default DeviceCard;
