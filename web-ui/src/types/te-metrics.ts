export interface TEMetricPoint {
  timestamp: string;
  avg_latency_ms: number | null;
  loss_pct: number | null;
  jitter_ms: number | null;
  response_time_ms: number | null;
  connect_time_ms: number | null;
  dns_time_ms: number | null;
  wait_time_ms: number | null;
  test_id: number;
  test_name: string;
  test_type: string;
  agent_id: number | null;
  agent_name: string | null;
  round_id: number;
  error_type: string | null;
  path_hops: Array<{
    hop: number;
    ip: string;
    prefix: string | null;
    rtt: number | null;
    loss: number | null;
  }> | null;
}

export interface TEMetricAggregate {
  bucket: string;
  avg_latency: number;
  p95_latency: number;
  max_latency: number;
  avg_loss: number;
  avg_jitter: number;
  sample_count: number;
}

export interface TEBottleneck {
  test_id: number;
  test_name: string;
  mean_latency: number;
  p95_latency: number;
  mean_loss: number;
  latency_stddev: number;
  sample_count: number;
}

export interface TETrend {
  test_id: number;
  test_name: string;
  avg_1h: number;
  avg_24h: number;
  delta_pct: number;
  status: 'improving' | 'stable' | 'degrading';
}

export interface TEMetricsStatus {
  total_rows: number;
  last_collection: string | null;
  oldest_record: string | null;
  unique_tests: number;
}
