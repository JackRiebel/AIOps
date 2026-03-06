'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Database } from 'lucide-react';
import {
  PerformanceDataTabBar,
  DatasetUpload,
  DatasetList,
  DatasetSchema,
  QueryInterface,
  QueryHistory,
  ResultsTable,
  type DatasetInfo,
  type PerformanceDataTab,
  type PreviewData,
} from '@/components/performance-data';

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Content
// ============================================================================

function PerformanceDataContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = (searchParams.get('tab') || 'datasets') as PerformanceDataTab;
  const [activeTab, setActiveTab] = useState<PerformanceDataTab>(tabParam);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync tab with URL
  const handleTabChange = useCallback((tab: PerformanceDataTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/performance-data?${params.toString()}`);
  }, [searchParams, router]);

  // Fetch datasets
  const fetchDatasets = useCallback(async () => {
    try {
      const resp = await fetch('/api/structured-data/datasets');
      if (resp.ok) {
        const data = await resp.json();
        setDatasets(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  // Poll for processing datasets
  useEffect(() => {
    const hasProcessing = datasets.some(d => d.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(fetchDatasets, 3000);
    return () => clearInterval(interval);
  }, [datasets, fetchDatasets]);

  const handleDeleteDataset = useCallback(async (id: number) => {
    try {
      const resp = await fetch(`/api/structured-data/datasets/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        setDatasets(ds => ds.filter(d => d.id !== id));
        if (selectedDatasetId === id) setSelectedDatasetId(null);
      }
    } catch { /* ignore */ }
  }, [selectedDatasetId]);

  const handlePreview = useCallback(async (id: number) => {
    try {
      const resp = await fetch(`/api/structured-data/datasets/${id}/preview?limit=50`);
      if (resp.ok) {
        setPreview(await resp.json());
      }
    } catch { /* ignore */ }
  }, []);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId) || null;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Performance Data</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload data, ask questions in natural language, get SQL-powered answers
            </p>
          </div>
        </div>

        {/* Tab Bar */}
        <PerformanceDataTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          datasetCount={datasets.filter(d => d.status === 'ready').length}
        />

        {/* Tab Content */}
        {activeTab === 'datasets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <DatasetUpload onUploadComplete={fetchDatasets} />
              <DatasetList
                datasets={datasets}
                selectedDatasetId={selectedDatasetId}
                onSelect={(d) => setSelectedDatasetId(d.id)}
                onDelete={handleDeleteDataset}
                onPreview={handlePreview}
              />
            </div>
            <div className="space-y-4">
              {selectedDataset && <DatasetSchema dataset={selectedDataset} />}
              {preview && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Data Preview</h3>
                  <ResultsTable results={{ ...preview, execution_time_ms: 0, truncated: false }} />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'query' && (
          <QueryInterface
            datasets={datasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={(id) => setSelectedDatasetId(id)}
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Dataset:</label>
              <select
                value={selectedDatasetId || ''}
                onChange={(e) => setSelectedDatasetId(Number(e.target.value) || null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Select...</option>
                {datasets.filter(d => d.status === 'ready').map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <QueryHistory datasetId={selectedDatasetId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Page Export (with Suspense boundary for useSearchParams)
// ============================================================================

export default function PerformanceDataPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PerformanceDataContent />
    </Suspense>
  );
}
