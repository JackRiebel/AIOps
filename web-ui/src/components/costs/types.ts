// ============================================================================
// AI Cost & ROI Types
// ============================================================================

export interface ModelBreakdown {
  model: string;
  queries: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  avg_tokens_per_query: number;
  cost_per_1k_tokens: number;
}

export interface CostSummary {
  period_days: number;
  queries: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_cost_usd: number;
  avg_cost_per_query: number;
  avg_tokens_per_query: number;
  cost_per_1k_tokens: number;
  last_7_days: {
    queries: number;
    cost_usd: number;
  };
  model_breakdown: ModelBreakdown[];
}

export interface DailyCost {
  date: string;
  cost_usd: number;
  label: string;
}

export interface AISessionSummary {
  outcome?: string;
  narrative?: string;
  milestones?: string[];
  metrics?: {
    duration_minutes: number;
    total_cost_usd: number;
    total_tokens: number;
    ai_queries: number;
    api_calls: number;
    estimated_manual_time_minutes: number;
  };
  insights?: string[];
  recommendations?: string[];
}

export interface CostBreakdown {
  ai_queries?: number;
  api_calls?: number;
  summary?: number;
  other?: number;
}

export interface EfficiencyBreakdown {
  cost_efficiency: number;
  time_efficiency: number;
  query_efficiency: number;
  action_efficiency: number;
  mttr_efficiency?: number;
  overall: number;
}

export interface AISessionData {
  id: number;
  name: string;
  status: 'active' | 'completed';
  started_at: string;
  ended_at?: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  total_events: number;
  ai_query_count: number;
  api_call_count: number;
  navigation_count: number;
  click_count: number;
  edit_action_count: number;
  error_count: number;
  ai_summary?: AISessionSummary;
  // ROI fields
  time_saved_minutes?: number;
  roi_percentage?: number;
  manual_cost_estimate_usd?: number;
  session_type?: string;
  complexity_score?: number;
  efficiency_score?: number;
  avg_response_time_ms?: number;
  slowest_query_ms?: number;
  total_duration_ms?: number;
  cost_breakdown?: CostBreakdown;
  // Incident fields
  incident_id?: number;
  incident_resolved?: boolean;
  resolution_time_minutes?: number;
}

export type CostsTabType = 'costs' | 'sessions' | 'analytics' | 'rag' | 'network';

// ============================================================================
// Model Display Configuration
// ============================================================================

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-3-opus-20240229': 'Claude 3 Opus',
  'claude-opus-4-20250514': 'Claude Opus 4',
};

export const CHART_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#6366f1', // indigo
];

export function getModelDisplayName(model: string): string {
  return MODEL_DISPLAY_NAMES[model] || model;
}
