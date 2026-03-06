'use client';

import { TableProperties, Hash, Type, Calendar } from 'lucide-react';
import type { DatasetInfo, ColumnInfo } from './types';

interface DatasetSchemaProps {
  dataset: DatasetInfo;
}

function typeIcon(type: string) {
  if (type === 'TEXT') return <Type className="w-3.5 h-3.5 text-amber-500" />;
  if (type === 'TIMESTAMP') return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
  return <Hash className="w-3.5 h-3.5 text-cyan-500" />;
}

export function DatasetSchema({ dataset }: DatasetSchemaProps) {
  const columns = dataset.schema_info?.columns || {};

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <TableProperties className="w-4 h-4 text-cyan-500" />
        Schema: {dataset.name}
        <span className="text-xs font-normal text-slate-400">
          ({dataset.row_count?.toLocaleString()} rows)
        </span>
      </h3>

      <div className="space-y-2">
        {Object.entries(columns).map(([name, info]: [string, ColumnInfo]) => (
          <div key={name} className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              {typeIcon(info.type)}
              <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">{name}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded">
                {info.type}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{info.distinct_count} distinct</span>
              {info.null_count > 0 && (
                <span className="text-amber-500">{info.null_count} nulls</span>
              )}
              {info.min != null && (
                <span>Range: {info.min} – {info.max}</span>
              )}
              {info.avg != null && (
                <span>Avg: {info.avg}</span>
              )}
            </div>
            {info.sample_values && info.sample_values.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {info.sample_values.slice(0, 10).map((v, i) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400 rounded">
                    {v}
                  </span>
                ))}
                {info.sample_values.length > 10 && (
                  <span className="text-[10px] text-slate-400">+{info.sample_values.length - 10}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
