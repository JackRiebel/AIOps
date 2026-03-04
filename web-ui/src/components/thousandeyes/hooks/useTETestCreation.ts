'use client';

import { useState, useCallback } from 'react';

export interface UseTETestCreationParams {
  fetchTests: () => Promise<void>;
  setError: (err: string | null) => void;
}

export interface UseTETestCreationReturn {
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  aiProcessing: boolean;
  loadingTestCreation: boolean;
  createTestFromAI: (prompt: string) => Promise<void>;
  createTestManual: (config: { testName: string; url: string; testType: string; interval: number }) => Promise<void>;
  runInstantTest: (config: any) => Promise<any>;
  updateTest: (testId: number, data: Record<string, any>) => Promise<void>;
  deleteTest: (testId: number) => Promise<void>;
}

export function useTETestCreation({ fetchTests, setError }: UseTETestCreationParams): UseTETestCreationReturn {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [loadingTestCreation, setLoadingTestCreation] = useState(false);

  const createTestFromAI = useCallback(async (prompt: string) => {
    if (!prompt.trim()) { setError('Please describe what you want to test'); return; }
    try {
      setAiProcessing(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/tests/ai?organization=default', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = `HTTP ${response.status}`;
        try {
          const e = JSON.parse(text);
          if (typeof e.detail === 'string') detail = e.detail;
          else if (e.detail) detail = JSON.stringify(e.detail);
          else if (typeof e.error === 'string') detail = e.error;
          else if (typeof e.message === 'string') detail = e.message;
        } catch {
          if (text && text.length < 500) detail = text;
        }
        throw new Error(detail);
      }
      await fetchTests();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
      throw err;
    } finally { setAiProcessing(false); }
  }, [fetchTests, setError]);

  const createTestManual = useCallback(async (config: { testName: string; url: string; testType: string; interval: number }) => {
    if (!config.testName || !config.url) { setError('Please fill in all required fields'); return; }
    try {
      setLoadingTestCreation(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/tests?organization=default', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(config),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = `HTTP ${response.status}`;
        try {
          const e = JSON.parse(text);
          if (typeof e.detail === 'string') detail = e.detail;
          else if (e.detail) detail = JSON.stringify(e.detail);
          else if (typeof e.error === 'string') detail = e.error;
          else if (typeof e.message === 'string') detail = e.message;
        } catch {
          if (text && text.length < 500) detail = text;
        }
        throw new Error(detail);
      }
      await fetchTests();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
      throw err;
    } finally { setLoadingTestCreation(false); }
  }, [fetchTests, setError]);

  const runInstantTest = useCallback(async (testConfig: any) => {
    try {
      setLoadingTestCreation(true);
      setError(null);
      const response = await fetch('/api/thousandeyes/instant-tests?organization=default', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(testConfig),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        const detail = typeof e.detail === 'string' ? e.detail : e.detail ? JSON.stringify(e.detail) : `HTTP ${response.status}`;
        throw new Error(detail);
      }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run instant test');
      throw err;
    } finally { setLoadingTestCreation(false); }
  }, [setError]);

  const updateTest = useCallback(async (testId: number, data: Record<string, any>) => {
    try {
      setLoadingTestCreation(true);
      setError(null);
      const response = await fetch(`/api/thousandeyes/tests/${testId}?organization=default`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(data),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = `HTTP ${response.status}`;
        try {
          const e = JSON.parse(text);
          detail = typeof e.detail === 'string' ? e.detail : e.detail ? JSON.stringify(e.detail) : detail;
        } catch { if (text && text.length < 500) detail = text; }
        throw new Error(detail);
      }
      await fetchTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update test');
      throw err;
    } finally { setLoadingTestCreation(false); }
  }, [fetchTests, setError]);

  const deleteTest = useCallback(async (testId: number) => {
    try {
      setLoadingTestCreation(true);
      setError(null);
      const response = await fetch(`/api/thousandeyes/tests/${testId}?organization=default`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = `HTTP ${response.status}`;
        try {
          const e = JSON.parse(text);
          detail = typeof e.detail === 'string' ? e.detail : e.detail ? JSON.stringify(e.detail) : detail;
        } catch { if (text && text.length < 500) detail = text; }
        throw new Error(detail);
      }
      await fetchTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test');
      throw err;
    } finally { setLoadingTestCreation(false); }
  }, [fetchTests, setError]);

  return {
    showCreateModal,
    setShowCreateModal,
    aiProcessing,
    loadingTestCreation,
    createTestFromAI,
    createTestManual,
    runInstantTest,
    updateTest,
    deleteTest,
  };
}
