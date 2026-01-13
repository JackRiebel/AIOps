'use client';

import React, { memo, useState } from 'react';
import {
  Package,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Cpu,
  Activity,
  FileText,
} from 'lucide-react';

export interface ProductDetailData {
  product: {
    name: string;
    model?: string;
    family?: string;
    description?: string;
  };
  specs: Record<string, string | number | boolean>;
  categories?: Array<{
    name: string;
    specs: Record<string, string | number | boolean>;
  }>;
  models?: Array<{
    name: string;
    description?: string;
  }>;
  features?: string[];
  useCases?: string[];
  sources?: Array<{
    id: number;
    title: string;
    relevance: number;
  }>;
}

const SpecValue = memo(({ value }: { value: string | number | boolean | undefined }) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-slate-400">-</span>;
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

SpecValue.displayName = 'SpecValue';

const CategoryIcon = ({ name }: { name: string }) => {
  const iconClass = "w-4 h-4 text-cyan-500";
  const lowerName = name.toLowerCase();

  if (lowerName.includes('hardware') || lowerName.includes('physical')) {
    return <Cpu className={iconClass} />;
  }
  if (lowerName.includes('performance') || lowerName.includes('capacity')) {
    return <Activity className={iconClass} />;
  }
  if (lowerName.includes('software') || lowerName.includes('feature')) {
    return <Layers className={iconClass} />;
  }
  return <FileText className={iconClass} />;
};

export const ProductDetailCard = memo(({ data, config }: { data: ProductDetailData; config?: Record<string, unknown> }) => {
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

  if (!data?.product) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 mb-3 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <Package className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No product data</p>
      </div>
    );
  }

  // Get specs either from categories or flat specs
  const hasCategories = data.categories && data.categories.length > 0;
  const flatSpecs = Object.entries(data.specs || {});
  const visibleSpecs = showAllSpecs ? flatSpecs : flatSpecs.slice(0, 8);
  const hasMoreSpecs = flatSpecs.length > 8;

  // Models list
  const models = data.models || [];
  const visibleModels = showAllModels ? models : models.slice(0, 4);
  const hasMoreModels = models.length > 4;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-900/20 dark:to-blue-900/20">
        <div className="flex items-start gap-2">
          <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/50 rounded-md">
            <Package className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {data.product.name}
            </h3>
            {data.product.family && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {data.product.family}
              </p>
            )}
          </div>
        </div>
        {data.product.description && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            {data.product.description}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Categorized Specs */}
        {hasCategories && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.categories!.map((category, idx) => (
              <div key={idx} className="px-3 py-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <CategoryIcon name={category.name} />
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {category.name}
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {Object.entries(category.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate pr-1">
                        {key}
                      </span>
                      <SpecValue value={value} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Flat Specs (if no categories) */}
        {!hasCategories && flatSpecs.length > 0 && (
          <div className="px-3 py-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Specifications
            </h4>
            <div className="space-y-1.5">
              {visibleSpecs.map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {key}
                  </span>
                  <SpecValue value={value} />
                </div>
              ))}
            </div>
            {hasMoreSpecs && (
              <button
                onClick={() => setShowAllSpecs(!showAllSpecs)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
              >
                {showAllSpecs ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show All {flatSpecs.length} Specs
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Available Models */}
        {models.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Available Models
            </h4>
            <div className="space-y-1">
              {visibleModels.map((model, idx) => (
                <div key={idx} className="text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {model.name}
                  </span>
                  {model.description && (
                    <span className="text-slate-500 dark:text-slate-400 ml-2">
                      - {model.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {hasMoreModels && (
              <button
                onClick={() => setShowAllModels(!showAllModels)}
                className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400"
              >
                {showAllModels ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show All {models.length} Models
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Key Features */}
        {data.features && data.features.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Key Features
            </h4>
            <ul className="space-y-1">
              {data.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Use Cases */}
        {data.useCases && data.useCases.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700/50">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Recommended For
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {data.useCases.map((useCase, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sources Footer */}
      {data.sources && data.sources.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-[9px] text-slate-400">
            Based on {data.sources.length} source{data.sources.length > 1 ? 's' : ''}: {data.sources.map(s => s.title).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
});

ProductDetailCard.displayName = 'ProductDetailCard';
