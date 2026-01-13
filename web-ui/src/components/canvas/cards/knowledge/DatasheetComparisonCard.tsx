'use client';

import React, { memo, useState } from 'react';
import {
  FileSpreadsheet,
  Check,
  X,
  Minus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

export interface ProductSpec {
  name: string;
  specs: Record<string, string | number | boolean>;
  source_doc_id?: number;
  source_url?: string;
}

export interface DatasheetComparisonData {
  query: string;
  products: ProductSpec[];
  features?: string[]; // Ordered list of feature names to display
}

const FeatureValue = memo(({ value }: { value: string | number | boolean | undefined }) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-slate-400">—</span>;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-4 h-4 text-green-500" />
    ) : (
      <X className="w-4 h-4 text-red-400" />
    );
  }

  return <span className="text-sm text-slate-700 dark:text-slate-300">{String(value)}</span>;
});

FeatureValue.displayName = 'FeatureValue';

export const DatasheetComparisonCard = memo(({ data, config }: { data: DatasheetComparisonData; config?: Record<string, unknown> }) => {
  const [expanded, setExpanded] = useState(false);

  if (!data?.products?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <FileSpreadsheet className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No comparison data</p>
      </div>
    );
  }

  // Get all unique feature keys from all products
  const allFeatures = data.features ||
    Array.from(new Set(data.products.flatMap(p => Object.keys(p.specs))));

  // Show first 6 features by default
  const visibleFeatures = expanded ? allFeatures : allFeatures.slice(0, 6);
  const hasMore = allFeatures.length > 6;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Product Comparison
            </h3>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {data.products.length} products
          </span>
        </div>
        {data.query && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
            &ldquo;{data.query}&rdquo;
          </p>
        )}
      </div>

      {/* Comparison Table */}
      <div className="flex-1 overflow-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Feature
              </th>
              {data.products.map((product, idx) => (
                <th
                  key={idx}
                  className="text-center py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {product.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleFeatures.map((feature, idx) => (
              <tr
                key={feature}
                className={idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}
              >
                <td className="py-2 px-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {feature}
                </td>
                {data.products.map((product, pidx) => (
                  <td key={pidx} className="py-2 px-2 text-center">
                    <FeatureValue value={product.specs[feature]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse */}
      {hasMore && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show All {allFeatures.length} Features
              </>
            )}
          </button>
        </div>
      )}

      {/* Source links */}
      {data.products.some(p => p.source_url) && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap gap-2">
          {data.products.filter(p => p.source_url).map((product, idx) => (
            <a
              key={idx}
              href={product.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              {product.name} Datasheet
            </a>
          ))}
        </div>
      )}
    </div>
  );
});

DatasheetComparisonCard.displayName = 'DatasheetComparisonCard';
