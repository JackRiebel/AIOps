'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  BookOpen, Upload, Search, RefreshCw, Trash2, Eye, Database,
  FileText, HelpCircle, BarChart3, X, Globe, Download, Shield, Layers
} from 'lucide-react';
import BulkImportTab from '@/components/admin/BulkImportTab';
import HygieneTab from '@/components/admin/HygieneTab';
import MergeTab from '@/components/admin/MergeTab';

interface KnowledgeDocument {
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

interface KnowledgeStats {
  total_documents: number;
  total_chunks: number;
  total_queries: number;
  documents_by_type: Record<string, number>;
  documents_by_product: Record<string, number>;
  embedding_coverage: number;
}

interface SearchResult {
  id: number;
  content: string;
  document_filename: string;
  document_title: string | null;
  document_type: string;
  document_product: string | null;
  relevance: number;
}

// Document type options
const DOC_TYPES = [
  { value: 'api_spec', label: 'API Spec', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { value: 'guide', label: 'Guide', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { value: 'datasheet', label: 'Datasheet', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
  { value: 'cli_reference', label: 'CLI Ref', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  { value: 'cvd', label: 'CVD', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { value: 'troubleshooting', label: 'Troubleshoot', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
];

// Product options
const PRODUCTS = [
  { value: 'meraki', label: 'Meraki' },
  { value: 'catalyst', label: 'Catalyst' },
  { value: 'ios-xe', label: 'IOS-XE' },
  { value: 'ise', label: 'ISE' },
  { value: 'thousandeyes', label: 'ThousandEyes' },
  { value: 'general', label: 'General' },
];

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [activeTab, setActiveTab] = useState<'documents' | 'bulk-import' | 'hygiene' | 'merge'>('documents');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [filterDocType, setFilterDocType] = useState<string>('');
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [uploadMetadata, setUploadMetadata] = useState({
    doc_type: 'guide',
    product: '',
    title: '',
    description: '',
    version: '',
  });
  const [uploading, setUploading] = useState(false);

  // Search modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Delete state
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [previewChunks, setPreviewChunks] = useState<Array<{
    id: number;
    chunk_index: number;
    content: string;
    content_tokens: number | null;
  }>>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsRes, statsRes] = await Promise.all([
        apiClient.getKnowledgeDocuments({
          doc_type: filterDocType || undefined,
          product: filterProduct || undefined,
          limit: 100,
        }),
        apiClient.getKnowledgeStats(),
      ]);
      setDocuments(docsRes);
      setStats(statsRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, [filterDocType, filterProduct]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter documents by search query (client-side)
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter(doc =>
      doc.filename.toLowerCase().includes(query) ||
      doc.title?.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  // Handle file upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setError(null);

    try {
      await apiClient.uploadKnowledgeDocument(uploadFile, {
        doc_type: uploadMetadata.doc_type,
        product: uploadMetadata.product || undefined,
        title: uploadMetadata.title || undefined,
        description: uploadMetadata.description || undefined,
        version: uploadMetadata.version || undefined,
      });

      setSuccess(`Document "${uploadFile.name}" uploaded successfully`);
      closeUploadModal();
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Handle URL import
  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;

    setUploading(true);
    setError(null);

    try {
      await apiClient.ingestKnowledgeFromUrl({
        url: importUrl.trim(),
        doc_type: uploadMetadata.doc_type,
        product: uploadMetadata.product || undefined,
        title: uploadMetadata.title || undefined,
        description: uploadMetadata.description || undefined,
      });

      setSuccess(`Content from URL imported successfully`);
      closeUploadModal();
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from URL');
    } finally {
      setUploading(false);
    }
  };

  // Close and reset upload modal
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setImportUrl('');
    setImportMode('file');
    setUploadMetadata({
      doc_type: 'guide',
      product: '',
      title: '',
      description: '',
      version: '',
    });
  };

  // Handle document deletion
  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!confirm(`Delete "${doc.title || doc.filename}"? This will remove all ${doc.total_chunks} chunks.`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(doc.id));
    setError(null);

    try {
      await apiClient.deleteKnowledgeDocument(doc.id);
      setSuccess(`Document "${doc.title || doc.filename}" deleted`);
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  // Handle semantic search
  const handleSearch = async () => {
    if (!semanticQuery.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const results = await apiClient.searchKnowledge({
        query: semanticQuery,
        top_k: 10,
        filters: {
          doc_type: filterDocType || undefined,
          product: filterProduct || undefined,
        },
      });
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Handle document preview
  const handlePreview = async (doc: KnowledgeDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    setPreviewChunks([]);

    try {
      const chunks = await apiClient.getDocumentChunks(doc.id);
      setPreviewChunks(chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document chunks');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Get doc type badge
  const getDocTypeBadge = (docType: string) => {
    const type = DOC_TYPES.find(t => t.value === docType);
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${type?.bg || 'bg-slate-100 dark:bg-slate-700'} ${type?.color || 'text-slate-600 dark:text-slate-400'}`}>
        {type?.label || docType}
      </span>
    );
  };

  // Get product badge
  const getProductBadge = (product: string | null) => {
    if (!product) return null;
    const prod = PRODUCTS.find(p => p.value === product);
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
        {prod?.label || product}
      </span>
    );
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-cyan-500 border-r-transparent"></div>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-xs">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Knowledge Admin</h1>
              <p className="text-xs text-slate-500">Manage RAG documents and embeddings</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NextLink
              href="/admin/knowledge/analytics"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </NextLink>
            {activeTab === 'documents' && (
              <>
                <button
                  onClick={() => setShowSearchModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  Test Search
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  aria-label={loading ? 'Refreshing documents' : 'Refresh documents'}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'documents'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Documents
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bulk-import')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'bulk-import'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Bulk Import
            </div>
          </button>
          <button
            onClick={() => setActiveTab('hygiene')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'hygiene'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Hygiene
            </div>
          </button>
          <button
            onClick={() => setActiveTab('merge')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'merge'
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Merge
            </div>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div role="alert" className="mb-3 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg flex items-center justify-between">
            <span className="text-xs text-rose-700 dark:text-rose-400">{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-rose-500 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 rounded">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {success && (
          <div role="status" className="mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg flex items-center justify-between">
            <span className="text-xs text-emerald-700 dark:text-emerald-400">{success}</span>
            <button onClick={() => setSuccess(null)} aria-label="Dismiss success message" className="text-emerald-500 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Bulk Import Tab */}
        {activeTab === 'bulk-import' && (
          <BulkImportTab onSuccess={fetchData} />
        )}

        {/* Hygiene Tab */}
        {activeTab === 'hygiene' && (
          <HygieneTab onSuccess={fetchData} />
        )}

        {/* Merge Tab */}
        {activeTab === 'merge' && (
          <MergeTab onSuccess={fetchData} />
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <>
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{stats.total_documents}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Documents</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{stats.total_chunks.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Chunks</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{stats.total_queries}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Queries</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.round(stats.embedding_coverage * 100)}%</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Embedded</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coverage breakdown - inline */}
        {stats && (Object.keys(stats.documents_by_type).length > 0 || Object.keys(stats.documents_by_product).length > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Object.keys(stats.documents_by_type).length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">By Type</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.documents_by_type).map(([type, count]) => (
                    <span key={type} className="inline-flex items-center gap-1">
                      {getDocTypeBadge(type)}
                      <span className="text-xs text-slate-600 dark:text-slate-400">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(stats.documents_by_product).length > 0 && (
              <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">By Product</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.documents_by_product).map(([product, count]) => (
                    <span key={product} className="inline-flex items-center gap-1">
                      {getProductBadge(product) || <span className="text-xs text-slate-500">{product}</span>}
                      <span className="text-xs text-slate-600 dark:text-slate-400">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="mb-3 flex gap-2">
          <div className="flex-grow relative">
            <label htmlFor="kb-search-filter" className="sr-only">Filter documents by filename or title</label>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              id="kb-search-filter"
              type="text"
              placeholder="Filter documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <label htmlFor="kb-type-filter" className="sr-only">Filter by document type</label>
          <select
            id="kb-type-filter"
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
            aria-label="Filter by document type"
            className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">All Types</option>
            {DOC_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <label htmlFor="kb-product-filter" className="sr-only">Filter by product</label>
          <select
            id="kb-product-filter"
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            aria-label="Filter by product"
            className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">All Products</option>
            {PRODUCTS.map(prod => (
              <option key={prod.value} value={prod.value}>{prod.label}</option>
            ))}
          </select>
        </div>

        {/* Documents Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-cyan-500 border-r-transparent"></div>
              <p className="mt-2 text-slate-500 dark:text-slate-400 text-xs">Loading...</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No documents found</p>
            <p className="text-xs text-slate-500 mt-0.5">Upload documents to populate the knowledge base</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-3 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Document</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Product</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Chunks</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Updated</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900 dark:text-white truncate max-w-xs">{doc.title || doc.filename}</p>
                      {doc.title && doc.title !== doc.filename && (
                        <p className="text-[10px] text-slate-400 truncate max-w-xs">{doc.filename}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {getDocTypeBadge(doc.doc_type)}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {getProductBadge(doc.product) || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-medium ${doc.total_chunks > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {doc.total_chunks}
                      </span>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell text-slate-500">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-1 rounded bg-slate-100 dark:bg-slate-700/50 hover:bg-cyan-100 dark:hover:bg-cyan-500/10 text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          aria-label={`Preview chunks for ${doc.title || doc.filename}`}
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={deletingIds.has(doc.id)}
                          className="p-1 rounded bg-slate-100 dark:bg-slate-700/50 hover:bg-rose-100 dark:hover:bg-rose-500/10 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                          aria-label={deletingIds.has(doc.id) ? `Deleting ${doc.title || doc.filename}` : `Delete ${doc.title || doc.filename}`}
                        >
                          {deletingIds.has(doc.id) ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Results count */}
        {!loading && filteredDocuments.length > 0 && (
          <div className="mt-2 text-[10px] text-slate-500">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
          </div>
        )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-md w-full">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
              <h3 id="upload-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white">Add Document</h3>
              <button
                onClick={closeUploadModal}
                aria-label="Close upload dialog"
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Import Mode Tabs */}
            <div className="px-4 pt-3 flex gap-1">
              <button
                onClick={() => setImportMode('file')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  importMode === 'file'
                    ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File
              </button>
              <button
                onClick={() => setImportMode('url')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  importMode === 'url'
                    ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Import from URL
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* File input (shown when importMode === 'file') */}
              {importMode === 'file' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    File (.txt, .md, .json, .pdf)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.json,.pdf,.docx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-medium file:bg-cyan-50 file:text-cyan-700 dark:file:bg-cyan-500/10 dark:file:text-cyan-400"
                  />
                </div>
              )}

              {/* URL input (shown when importMode === 'url') */}
              {importMode === 'url' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Webpage URL
                  </label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://example.com/docs/guide"
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Supports HTML pages, JSON (including OpenAPI specs), and plain text
                  </p>
                </div>
              )}

              {/* Two-column layout */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Type *</label>
                  <select
                    value={uploadMetadata.doc_type}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, doc_type: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {DOC_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Product</label>
                  <select
                    value={uploadMetadata.product}
                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, product: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">Select...</option>
                    {PRODUCTS.map(prod => (
                      <option key={prod.value} value={prod.value}>{prod.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Title {importMode === 'url' && <span className="font-normal text-slate-400">(auto-detected if empty)</span>}
                </label>
                <input
                  type="text"
                  value={uploadMetadata.title}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Document title"
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={uploadMetadata.description}
                  onChange={(e) => setUploadMetadata(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description"
                  rows={2}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-2">
              <button
                onClick={closeUploadModal}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              {importMode === 'file' ? (
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleUrlImport}
                  disabled={!importUrl.trim() || uploading}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      Import
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="search-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-2xl w-full max-h-[70vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
              <h3 id="search-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white">Test Semantic Search</h3>
              <button
                onClick={() => { setShowSearchModal(false); setSearchResults([]); setSemanticQuery(''); }}
                aria-label="Close search dialog"
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Search input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={semanticQuery}
                  onChange={(e) => setSemanticQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ask a question..."
                  className="flex-grow px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={!semanticQuery.trim() || searching}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                >
                  {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Search
                </button>
              </div>

              {/* Results */}
              <div className="overflow-auto max-h-[45vh]">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <Search className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                    <p className="text-xs">Enter a query to search</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div key={result.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700/50">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {getDocTypeBadge(result.document_type)}
                            {getProductBadge(result.document_product)}
                          </div>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            result.relevance >= 0.8 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                            result.relevance >= 0.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            {Math.round(result.relevance * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">{result.content}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {result.document_title || result.document_filename}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 id="preview-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                  {previewDoc.title || previewDoc.filename}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  {getDocTypeBadge(previewDoc.doc_type)}
                  {getProductBadge(previewDoc.product)}
                  <span className="text-[10px] text-slate-500">{previewDoc.total_chunks} chunks</span>
                </div>
              </div>
              <button
                onClick={() => { setPreviewDoc(null); setPreviewChunks([]); }}
                aria-label="Close preview dialog"
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-cyan-500 border-r-transparent"></div>
                </div>
              ) : previewChunks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No chunks found</div>
              ) : (
                <div className="space-y-2">
                  {previewChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-700/50 p-3"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold text-slate-500">Chunk {chunk.chunk_index + 1}</span>
                        {chunk.content_tokens && <span className="text-[10px] text-slate-400">{chunk.content_tokens} tokens</span>}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{chunk.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 flex justify-end flex-shrink-0">
              <button
                onClick={() => { setPreviewDoc(null); setPreviewChunks([]); }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
