'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptTemplate, AssertionRule } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

interface CreateTemplatePayload {
  name: string;
  provider: string;
  prompt_text: string;
  model_id?: string;
  assertions: AssertionRule[];
}

export interface UsePromptTemplatesReturn {
  templates: PromptTemplate[];
  loading: boolean;
  createTemplate: (payload: CreateTemplatePayload) => Promise<boolean>;
  refreshTemplates: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function usePromptTemplates(): UsePromptTemplatesReturn {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTemplates = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch('/api/thousandeyes/ai-assurance/prompt-templates', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('usePromptTemplates fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async (payload: CreateTemplatePayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/thousandeyes/ai-assurance/prompt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh the list after creation
      await fetchTemplates();
      return true;
    } catch (err: unknown) {
      console.error('usePromptTemplates create error:', err);
      return false;
    }
  }, [fetchTemplates]);

  useEffect(() => {
    fetchTemplates();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchTemplates]);

  return { templates, loading, createTemplate, refreshTemplates: fetchTemplates };
}
