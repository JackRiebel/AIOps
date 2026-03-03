// ============================================================================
// AI Response Quality Testing Types
// ============================================================================

export interface AIQualityResult {
  timestamp: string;
  response_time_ms: number;
  ttfb_ms: number;
  status_code: number;
  token_count?: number;
  model_id?: string;
  agent_location: string;
  assertions_passed: number;
  assertions_failed: number;
  assertion_results: AssertionResult[];
}

export interface AssertionResult {
  type: string;
  target: string;
  operator: string;
  expected: string;
  actual: string;
  passed: boolean;
  description?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  provider: string;
  prompt_text: string;
  model_id?: string;
  assertions: AssertionRule[];
  is_builtin: boolean;
}

export interface AssertionRule {
  type: string;       // "status_code" | "response_contains" | "response_time_lt" | "json_path"
  target: string;
  operator: string;   // "equals" | "contains" | "less_than" | "matches_regex"
  expected: string;
  description?: string;
}

export interface AIQualitySummary {
  avg_response_time_ms: number;
  token_efficiency: number;
  assertion_pass_rate: number;
  availability_pct: number;
}

export interface RegionalMetric {
  agent_location: string;
  avg_response_time_ms: number;
  avg_latency_ms: number;
  assertion_pass_rate: number;
  sample_count: number;
  health: 'healthy' | 'degraded' | 'failing';
}

export interface PromptTestExecution {
  id: string;
  timestamp: string;
  template_name: string;
  provider: string;
  model_id?: string;
  response_time_ms: number;
  status_code: number;
  assertions_passed: number;
  assertions_total: number;
  agent_location: string;
  health: 'healthy' | 'degraded' | 'failing';
}
