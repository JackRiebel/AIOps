// ============================================================================
// Structured Data / Performance Data Types
// ============================================================================

export type PerformanceDataTab = 'datasets' | 'query' | 'history';

export interface ColumnInfo {
  type: string;
  distinct_count: number;
  null_count: number;
  min?: number;
  max?: number;
  avg?: number;
  sample_values?: string[];
}

export interface SchemaInfo {
  total_rows: number;
  columns: Record<string, ColumnInfo>;
}

export interface DatasetInfo {
  id: number;
  name: string;
  table_name: string;
  source_filename: string;
  row_count: number;
  column_count: number;
  schema_info: SchemaInfo | null;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  execution_time_ms: number;
  truncated: boolean;
}

export interface QueryResponse {
  sql: string;
  valid: boolean;
  error: string | null;
  provider?: string;
  model?: string;
  attempts?: number;
  results?: SQLQueryResult | { error: string };
  generation_metadata?: GenerationMetadata;
}

// ─── Process View Metadata Types ──────────────────────────────────────────────

export interface GenerationAttempt {
  attempt: number;
  system_prompt: string;
  user_prompt: string;
  raw_response: string;
  extracted_sql: string;
  safety_error: string | null;
  explain_error: string | null;
}

export interface GenerationMetadata {
  schema_context: string;
  glossary_context: string;
  examples_context: string;
  attempts: GenerationAttempt[];
}

export interface InterpretationMetadata {
  prompt: string;
  raw_response: string;
}

export interface SchemaMetadataItem {
  id: number;
  table_name: string;
  column_name: string | null;
  data_type: string | null;
  description: string;
  sample_values: string | null;
  business_term: string | null;
  is_filterable: boolean;
  is_metric: boolean;
}

export interface GlossaryTerm {
  id: number;
  term: string;
  synonyms: string | null;
  definition: string;
  sql_expression: string;
  applies_to: string | null;
}

export interface QueryHistoryItem {
  id: number;
  natural_language: string;
  generated_sql: string;
  was_executed: boolean;
  execution_time_ms: number | null;
  row_count: number | null;
  error_message: string | null;
  feedback: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  model: string;
  available: boolean;
}

export interface OllamaStatus {
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'error' | 'disabled';
  models?: string[];
  model_count?: number;
  detail?: string;
}

export interface PreviewData {
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
}

export interface ColumnRenameSuggestion {
  original: string;
  suggested: string;
  sample_values: string[];
}

export interface ColumnAnalysisResponse {
  columns: ColumnRenameSuggestion[];
}
