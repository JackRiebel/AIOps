export type SpanType = 'query' | 'llm_call' | 'tool_execution' | 'synthesis';
export type SpanStatus = 'running' | 'success' | 'error' | 'timeout';

export interface AITraceSpan {
  id: number;
  trace_id: string;
  parent_span_id: number | null;
  span_type: SpanType;
  span_name: string | null;
  iteration: number;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  // LLM fields
  model: string | null;
  provider: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  // Tool fields
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output_summary: string | null;
  tool_success: boolean | null;
  tool_platform: string | null;
  tool_error: string | null;
  // Network timing
  dns_ms: number | null;
  tcp_connect_ms: number | null;
  tls_ms: number | null;
  ttfb_ms: number | null;
  // Network path info
  server_ip: string | null;
  server_port: number | null;
  tls_version: string | null;
  http_version: string | null;
  network_path: NetworkHop[] | null;
  // Status
  status: SpanStatus;
  error_message: string | null;
  metadata?: Record<string, unknown>;
  children?: AITraceSpan[];
  // Journey enrichment (from /journey endpoint)
  baseline?: { tcpMs: number | null; tlsMs: number | null; ttfbMs: number | null; durationMs: number | null; isValid: boolean };
  anomalies?: { tcpSlow: boolean; tlsSlow: boolean; ttfbSlow: boolean; durationSlow: boolean };
  // TE enrichment (from /journey endpoint with full TE data)
  te_enrichment?: {
    path_hops: { ip: string; prefix: string; delay: number; loss: number; network: string; rdns: string; asNumber?: string; location?: string }[];
    network_metrics: { loss: number; latency: number; jitter: number; bandwidth?: number } | null;
    bgp_routes: { prefix: string; asPath: number[]; reachability: number; updates: number; monitor: string }[];
    http_timing: { dnsTime: number; connectTime: number; sslTime: number; waitTime: number; receiveTime: number; responseTime: number; wireSize: number; throughput?: number } | null;
    test_id: number | null;
    test_type: string | null;
    agent_name: string | null;
  };
  cost_impact?: {
    cost_usd: number;
    baseline_latency_ms: number | null;
    actual_latency_ms: number | null;
    excess_latency_ms: number;
    wasted_compute_usd: number;
  };
}

export interface AITraceSummary {
  trace_id: string;
  query: string;
  start_time: string;
  duration_ms: number | null;
  status: SpanStatus;
  tool_count: number;
  cost_usd: number;
  network_latency_ms?: number | null;
  provider?: string;
  model?: string;
}

export interface NetworkHop {
  ip: string;
  prefix?: string;
  delay: number;
  loss?: number;
  network?: string;    // e.g., "AS15169 Google LLC"
  rdns?: string;       // Reverse DNS hostname
}

export interface WaterfallBar {
  span_id: number;
  span_type: SpanType;
  span_name: string;
  offset_ms: number;
  duration_ms: number;
  depth: number;
  status: SpanStatus;
  tool_name?: string;
  tool_platform?: string;
  model?: string;
  tokens?: { input: number; output: number };
  cost_usd?: number;
  network_timing?: { dns_ms?: number; tcp_ms?: number; tls_ms?: number; ttfb_ms?: number };
  server_ip?: string;
  server_port?: number;
  tls_version?: string;
  http_version?: string;
  network_path?: NetworkHop[];
}

export interface AITraceDetail {
  trace_id: string;
  root_span: AITraceSpan;
  total_tokens: number;
  total_cost: number;
  tool_count: number;
  span_count: number;
  cost_summary?: {
    total_cost_usd: number;
    total_network_tax_ms: number;
    total_wasted_usd: number;
    network_tax_pct: number;
  };
  te_monitoring?: Record<string, boolean>;
}

export const SPAN_COLORS: Record<SpanType, { bg: string; hex: string }> = {
  query: { bg: 'bg-slate-500', hex: '#64748b' },
  llm_call: { bg: 'bg-blue-500', hex: '#3b82f6' },
  tool_execution: { bg: 'bg-emerald-500', hex: '#10b981' },
  synthesis: { bg: 'bg-purple-500', hex: '#a855f7' },
};

export const PLATFORM_COLORS: Record<string, string> = {
  meraki: '#00bceb',
  catalyst: '#049fd9',
  thousandeyes: '#ff6b35',
  splunk: '#65a637',
  knowledge: '#9333ea',
  canvas: '#6366f1',
};
