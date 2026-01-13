// Network component types

export interface NetworkSummary {
  id: string;
  name: string;
  productTypes: string[];
  deviceCount?: number;
}

export interface DeviceSummary {
  serial: string;
  name: string;
  model: string;
  status: 'online' | 'offline' | 'alerting';
  networkId?: string;
}

export interface AlertSummary {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  deviceSerial?: string;
}

export type StatusType = 'online' | 'offline' | 'alerting' | 'healthy' | 'degraded';

export type MetricColor = 'slate' | 'green' | 'amber' | 'red' | 'cyan';
