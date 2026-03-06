'use client';

import { useEffect, useState } from 'react';
import { Cpu, Cloud, Loader2 } from 'lucide-react';
import type { LLMProvider } from './types';

interface LLMProviderSelectorProps {
  value: string;
  onChange: (provider: string) => void;
}

export function LLMProviderSelector({ value, onChange }: LLMProviderSelectorProps) {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/structured-data/llm-providers')
      .then(r => r.json())
      .then(data => {
        setProviders(data.providers || []);
        // Default to ollama if available, otherwise first provider
        if (!value && data.providers?.length > 0) {
          const ollama = data.providers.find((p: LLMProvider) => p.id === 'ollama');
          onChange(ollama ? 'ollama' : data.providers[0].id);
        }
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading providers...
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="text-xs text-amber-500">No LLM providers configured</p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">LLM:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.available}>
            {p.id === 'ollama' ? '🖥️' : '☁️'} {p.name} ({p.model})
          </option>
        ))}
      </select>
    </div>
  );
}
