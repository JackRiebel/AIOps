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
    return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
  }
  if (s === 'alerting' || s === 'warning' || s === 'degraded' || s === 'slow') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
  }
  if (s === 'offline' || s === 'down' || s === 'error' || s === 'critical' || s === 'failed' || s === 'unreachable') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  }
  if (s === 'dormant' || s === 'inactive' || s === 'disabled') {
    return 'bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400';
}

export function getStatusIcon(status: string): string {
  const s = status.toLowerCase();
  if (s === 'online' || s === 'active' || s === 'healthy' || s === 'up' || s === 'ok' || s === 'success' || s === 'running') {
    return '●';
  }
  if (s === 'alerting' || s === 'warning' || s === 'degraded' || s === 'slow') {
    return '▲';
  }
  if (s === 'offline' || s === 'down' || s === 'error' || s === 'critical' || s === 'failed' || s === 'unreachable') {
    return '✕';
  }
  if (s === 'dormant' || s === 'inactive' || s === 'disabled') {
    return '○';
  }
  return '?';
}

export function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
