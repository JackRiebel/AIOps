// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface KnowledgeDocument {
  id: number;
  filename: string;
  doc_type: string;
  product: string | null;
  version: string | null;
  title: string | null;
  description: string | null;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  documents_by_type: Record<string, number>;
  documents_by_product: Record<string, number>;
  embedding_coverage: number;
}

export interface SearchResult {
  id: number;
  content: string;
  document_filename: string;
  document_title: string | null;
  document_type: string;
  document_product: string | null;
  relevance: number;
}

export interface ChunkPreview {
  id: number;
  chunk_index: number;
  content: string;
  content_tokens: number | null;
}

export interface UploadMetadata {
  doc_type: string;
  product: string;
  title: string;
  description: string;
  version: string;
}

// ============================================================================
// Constants
// ============================================================================

export interface DocTypeOption {
  value: string;
  label: string;
  color: string;
  bg: string;
}

export interface ProductOption {
  value: string;
  label: string;
}

export const DOC_TYPES: DocTypeOption[] = [
  { value: 'api_spec', label: 'API Spec', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { value: 'guide', label: 'Guide', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { value: 'datasheet', label: 'Datasheet', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  { value: 'cli_reference', label: 'CLI Ref', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  { value: 'cvd', label: 'CVD', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { value: 'troubleshooting', label: 'Troubleshoot', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
];

export const PRODUCTS: ProductOption[] = [
  { value: 'meraki', label: 'Meraki' },
  { value: 'catalyst', label: 'Catalyst' },
  { value: 'ios-xe', label: 'IOS-XE' },
  { value: 'ise', label: 'ISE' },
  { value: 'thousandeyes', label: 'ThousandEyes' },
  { value: 'general', label: 'General' },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getDocTypeConfig(docType: string): DocTypeOption | undefined {
  return DOC_TYPES.find(dt => dt.value === docType);
}

export function getProductConfig(product: string): ProductOption | undefined {
  return PRODUCTS.find(p => p.value === product);
}
