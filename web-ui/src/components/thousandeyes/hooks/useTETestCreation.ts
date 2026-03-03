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
      if (!response.ok) { const e = await response.json(); throw new Error(e.detail || `HTTP ${response.status}`); }
      await fetchTests();
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
      if (!response.ok) { const e = await response.json(); throw new Error(e.detail || `HTTP ${response.status}`); }
      await fetchTests();
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
      if (!response.ok) { const e = await response.json(); throw new Error(e.detail || `HTTP ${response.status}`); }
      return await response.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run instant test');
      throw err;
    } finally { setLoadingTestCreation(false); }
  }, [setError]);

  return {
    showCreateModal,
    setShowCreateModal,
    aiProcessing,
    loadingTestCreation,
    createTestFromAI,
    createTestManual,
    runInstantTest,
  };
}
