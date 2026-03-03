export function mapSeverity(sev: string): 'critical' | 'major' | 'minor' | 'info' {
  const s = sev?.toLowerCase() || '';
  if (s.includes('critical') || s.includes('crit')) return 'critical';
  if (s.includes('major') || s.includes('high') || s.includes('error')) return 'major';
  if (s.includes('minor') || s.includes('medium') || s.includes('warn')) return 'minor';
  return 'info';
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
