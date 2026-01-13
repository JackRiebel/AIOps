'use client';

import { memo } from 'react';
import { FileText, Database, HelpCircle, BarChart3 } from 'lucide-react';
import type { KnowledgeStats } from './types';
import { DOC_TYPES, PRODUCTS } from './types';

interface KnowledgeStatsCardsProps {
  stats: KnowledgeStats;
}

// Helper to get doc type badge
function DocTypeBadge({ docType }: { docType: string }) {
  const config = DOC_TYPES.find(dt => dt.value === docType);
  if (!config) return <span className="text-xs text-slate-500">{docType}</span>;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

// Helper to get product badge
function ProductBadge({ product }: { product: string }) {
  const config = PRODUCTS.find(p => p.value === product);
  if (!config) return <span className="text-xs text-slate-500">{product}</span>;
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
      {config.label}
    </span>
  );
}

export const KnowledgeStatsCards = memo(({ stats }: KnowledgeStatsCardsProps) => {
  return (
    <>
      {/* Main Stats Row */}
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

      {/* Coverage Breakdown */}
      {(Object.keys(stats.documents_by_type).length > 0 || Object.keys(stats.documents_by_product).length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Object.keys(stats.documents_by_type).length > 0 && (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">By Type</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats.documents_by_type).map(([type, count]) => (
                  <span key={type} className="inline-flex items-center gap-1">
                    <DocTypeBadge docType={type} />
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
                    <ProductBadge product={product} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
});

KnowledgeStatsCards.displayName = 'KnowledgeStatsCards';

export default KnowledgeStatsCards;
