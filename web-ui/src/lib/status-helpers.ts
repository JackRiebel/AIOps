import React from 'react';

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'online' || s === 'active' || s === 'healthy' || s === 'up' || s === 'ok' || s === 'success' || s === 'running') {
    return 'text-green-500';
  }
  if (s === 'alerting' || s === 'warning' || s === 'degraded' || s === 'slow') {
    return 'text-amber-500';
  }
  if (s === 'offline' || s === 'down' || s === 'error' || s === 'critical' || s === 'failed' || s === 'unreachable') {
    return 'text-red-500';
  }
  if (s === 'dormant' || s === 'inactive' || s === 'disabled') {
    return 'text-slate-400';
  }
  return 'text-slate-500';
}

export function getStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'online' || s === 'active' || s === 'healthy' || s === 'up' || s === 'ok' || s === 'success' || s === 'running') {
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
  }
  if (s === 'alerting' || s === 'warning' || s === 'degraded' || s === 'slow') {
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
  }
  if (s === 'offline' || s === 'down' || s === 'error' || s === 'critical' || s === 'failed' || s === 'unreachable') {
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  }
  if (s === 'dormant' || s === 'inactive' || s === 'disabled') {
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400';
  }
  return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400';
}

type IconComponent = React.FC<{ className?: string }>;

function createCircleIcon(fill: string): IconComponent {
  return function StatusCircle({ className }: { className?: string }) {
    return React.createElement('svg', {
      className,
      viewBox: '0 0 24 24',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
    }, React.createElement('circle', { cx: '12', cy: '12', r: '8', fill }));
  };
}

function WarningIcon({ className }: { className?: string }) {
  return React.createElement('svg', {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }, React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' }),
     React.createElement('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
     React.createElement('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }));
}

function XIcon({ className }: { className?: string }) {
  return React.createElement('svg', {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }, React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
     React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }));
}

function MinusCircleIcon({ className }: { className?: string }) {
  return React.createElement('svg', {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }, React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
     React.createElement('line', { x1: '8', y1: '12', x2: '16', y2: '12' }));
}

export function getStatusIcon(status: string): IconComponent {
  const s = status.toLowerCase();
  if (s === 'online' || s === 'active' || s === 'healthy' || s === 'up' || s === 'ok' || s === 'success' || s === 'running') {
    return createCircleIcon('currentColor');
  }
  if (s === 'alerting' || s === 'warning' || s === 'degraded' || s === 'slow') {
    return WarningIcon;
  }
  if (s === 'offline' || s === 'down' || s === 'error' || s === 'critical' || s === 'failed' || s === 'unreachable') {
    return XIcon;
  }
  if (s === 'dormant' || s === 'inactive' || s === 'disabled') {
    return MinusCircleIcon;
  }
  return MinusCircleIcon;
}

export function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
