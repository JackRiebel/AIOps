/**
 * Shared utility functions for card rendering
 * Extracted from CardContent.tsx to reduce file size
 */

import type { ActionType } from '@/types/session';

// Maximum rows to display (pagination-like limit for performance)
export const MAX_DISPLAY_ROWS = 100;

/**
 * Helper to check if a value is a Meraki network ID (L_ or N_ prefix)
 */
export function isMerakiNetworkId(val: unknown): val is string {
  return typeof val === 'string' && (val.startsWith('L_') || val.startsWith('N_'));
}

/**
 * Format a cell value for display in tables
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Get CSS class for status value
 */
export function getStatusClass(status: unknown): string {
  const s = String(status).toLowerCase();
  if (s === 'online' || s === 'active' || s === 'success' || s === 'up' || s === 'healthy') {
    return 'text-emerald-600 dark:text-emerald-400 font-medium';
  }
  if (s === 'offline' || s === 'inactive' || s === 'error' || s === 'down' || s === 'failed') {
    return 'text-red-600 dark:text-red-400 font-medium';
  }
  if (s === 'warning' || s === 'alerting' || s === 'dormant') {
    return 'text-amber-600 dark:text-amber-400 font-medium';
  }
  return '';
}

/**
 * Format metric value with K/M suffixes
 */
export function formatMetricValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(2);
  }
  return String(value);
}

/**
 * Format time string for display
 */
export function formatTime(time: string): string {
  try {
    const date = new Date(time);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return time;
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(time: string): string {
  try {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return time;
  }
}

/**
 * Compute basic metrics from an array of objects
 */
export function computeArrayMetrics(data: unknown[]): Record<string, number> {
  const metrics: Record<string, number> = {};

  if (data.length === 0) return metrics;

  const firstItem = data[0] as Record<string, unknown>;
  if (!firstItem || typeof firstItem !== 'object') return metrics;

  const numericKeys = Object.keys(firstItem).filter(k => typeof firstItem[k] === 'number');

  for (const key of numericKeys.slice(0, 3)) {
    const values = data
      .map(d => (d as Record<string, unknown>)[key])
      .filter((v): v is number => typeof v === 'number');
    if (values.length > 0) {
      metrics[`avg_${key}`] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  return metrics;
}

/**
 * Extract status from a row object
 */
export function extractStatus(item: Record<string, unknown>): string {
  // Check common status field names
  const statusFields = ['status', 'Status', 'deviceStatus', 'state', 'health'];
  for (const field of statusFields) {
    if (item[field]) {
      return String(item[field]).toLowerCase();
    }
  }
  return 'unknown';
}

/**
 * Get actions available for a device model
 */
export function getActionsForDevice(model: string | undefined): string[] {
  if (!model) return ['ping'];

  const modelLower = model.toLowerCase();

  // MX (Security Appliances) - support ping, traceroute
  if (modelLower.startsWith('mx') || modelLower.includes('security')) {
    return ['ping', 'traceroute'];
  }

  // MS (Switches) - support ping, blink, port cycle
  if (modelLower.startsWith('ms') || modelLower.includes('switch')) {
    return ['ping', 'blink-led', 'cycle-port'];
  }

  // MR (Access Points) - support ping, blink
  if (modelLower.startsWith('mr') || modelLower.includes('access point') || modelLower.includes('wireless')) {
    return ['ping', 'blink-led'];
  }

  // MV (Cameras) - support ping only
  if (modelLower.startsWith('mv') || modelLower.includes('camera')) {
    return ['ping'];
  }

  // MT (Sensors) - support ping only
  if (modelLower.startsWith('mt') || modelLower.includes('sensor')) {
    return ['ping'];
  }

  // Default: ping only
  return ['ping'];
}

/**
 * Execute a quick action on a device
 */
export async function executeQuickAction(
  actionType: string,
  serial: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`/api/actions/${actionType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ serial }),
    });

    const data = await response.json();
    return {
      success: response.ok && data.success !== false,
      message: data.message || data.error || (response.ok ? 'Success' : 'Failed'),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * Get color scheme for action type
 */
export function getActionColor(actionType: ActionType): { bg: string; hover: string; text: string } {
  const colors: Record<string, { bg: string; hover: string; text: string }> = {
    ping: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-blue-100' },
    traceroute: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-purple-100' },
    'cable-test': { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-amber-100' },
    'blink-led': { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', text: 'text-yellow-100' },
    reboot: { bg: 'bg-red-500', hover: 'hover:bg-red-600', text: 'text-red-100' },
    'wake-on-lan': { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-green-100' },
    'cycle-port': { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'text-orange-100' },
  };
  return colors[actionType] || { bg: 'bg-slate-500', hover: 'hover:bg-slate-600', text: 'text-slate-100' };
}

/**
 * Get label for action type
 */
export function getActionLabel(actionType: ActionType): string {
  const labels: Record<string, string> = {
    ping: 'Ping Device',
    traceroute: 'Traceroute',
    'cable-test': 'Cable Test',
    'blink-led': 'Blink LED',
    reboot: 'Reboot Device',
    'wake-on-lan': 'Wake on LAN',
    'cycle-port': 'Cycle Port',
  };
  return labels[actionType] || actionType;
}
