// ============================================================================
// MCP Server Monitoring Types
// ============================================================================

export interface MCPServer {
  id: string;
  name: string;
  endpoint_url: string;
  auth_type: string;
  status: 'connected' | 'degraded' | 'disconnected';
  last_seen: string;
  tool_count: number;
  resource_count: number;
  tls_enabled: boolean;
  tls_version?: string;
  description?: string;
  te_network_test_id?: number;
  te_http_test_id?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  validation_status: 'valid' | 'degraded' | 'unknown' | 'failed';
  last_validated?: string;
  is_sensitive: boolean;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
}

export interface MCPSecurityPosture {
  overall_score: number;
  tls_status: 'secure' | 'insecure' | 'unknown';
  auth_method: string;
  cert_days_remaining?: number;
  sensitive_tools_exposed: number;
  total_tools: number;
  servers_connected: number;
  servers_total: number;
}

export interface MCPHealthEvent {
  id: string;
  timestamp: string;
  server_id: string;
  server_name: string;
  event_type: 'connection' | 'tool_change' | 'error' | 'discovery';
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface MCPToolHealth {
  timestamp: string;
  available_tools: number;
  total_tools: number;
  availability_pct: number;
}

export interface MCPNetworkHealth {
  server_id: string;
  has_te_tests: boolean;
  network_test_id?: number;
  http_test_id?: number;
  metrics?: {
    avg_latency_ms: number;
    loss_pct: number;
    jitter_ms: number;
    response_time_ms: number;
    availability_pct: number;
    hop_count: number;
  };
  path_visualization?: { results: unknown[] };
  network_results?: unknown[];
  http_results?: unknown[];
}
