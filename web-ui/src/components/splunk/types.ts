// ============================================================================
// Splunk Types
// ============================================================================

export interface SplunkLog {
  _time: string;
  _raw: string;
  host?: string;
  source?: string;
  sourcetype?: string;
  index?: string;
  severity?: string;
  level?: string;
  [key: string]: any;
}

export interface SplunkInsight {
  id: number;
  organization: string;
  search_query: string | null;
  time_range: string | null;
  title: string;
  severity: SeverityLevel;
  description: string | null;
  log_count: number;
  examples: string[];
  source_system: string | null;
  ai_cost: number | null;
  token_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SeverityConfig {
  bg: string;
  border: string;
  text: string;
  dot: string;
  badge: string;
  leftBorder: string;
}

export const SEVERITY_CONFIGS: Record<SeverityLevel, SeverityConfig> = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40',
    leftBorder: 'border-l-red-500',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-500/10',
    border: 'border-orange-200 dark:border-orange-500/30',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/40',
    leftBorder: 'border-l-orange-500',
  },
  medium: {
    bg: 'bg-amber-100 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40',
    leftBorder: 'border-l-amber-500',
  },
  low: {
    bg: 'bg-blue-100 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/40',
    leftBorder: 'border-l-blue-500',
  },
  info: {
    bg: 'bg-slate-100 dark:bg-slate-500/10',
    border: 'border-slate-200 dark:border-slate-500/30',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500',
    badge: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-500/40',
    leftBorder: 'border-l-slate-500',
  },
};

export function getSeverityConfig(severity: string): SeverityConfig {
  return SEVERITY_CONFIGS[severity.toLowerCase() as SeverityLevel] || SEVERITY_CONFIGS.info;
}
