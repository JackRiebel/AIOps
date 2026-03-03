'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isEnabled } from '../types';
import type { Test, TestResult } from '../types';

export interface UseTETestResultsParams {
  tests: Test[];
  loadingTests: boolean;
}

export interface UseTETestResultsReturn {
  testResults: Record<number, TestResult[]>;
  loadingResults: Record<number, boolean>;
  fetchTestResults: (testId: number, testType: string) => Promise<void>;
}

export function useTETestResults({ tests, loadingTests }: UseTETestResultsParams): UseTETestResultsReturn {
  const [testResults, setTestResults] = useState<Record<number, TestResult[]>>({});
  const [loadingResults, setLoadingResults] = useState<Record<number, boolean>>({});
  const autoFetchRef = useRef(false);

  const fetchTestResults = useCallback(async (testId: number, testType: string) => {
    if (testResults[testId]) return;
    try {
      setLoadingResults(prev => ({ ...prev, [testId]: true }));
      const response = await fetch(
        `/api/thousandeyes/tests/${testId}/results?organization=default&test_type=${encodeURIComponent(testType)}&window=12h`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const raw = data.results || data;
      const results = raw?._embedded?.results || raw?.results || raw?._embedded?.['test-results'] || [];
      interface ApiTestResult {
        date?: string; roundId?: number; responseTime?: number; avgLatency?: number;
        totalTime?: number; availability?: number; loss?: number; latency?: number;
        jitter?: number; throughput?: number;
      }
      const chartData: TestResult[] = results.map((r: ApiTestResult) => ({
        timestamp: r.date || (r.roundId ? new Date(r.roundId * 1000).toISOString() : new Date().toISOString()),
        responseTime: r.responseTime || r.avgLatency || r.totalTime,
        availability: r.availability,
        loss: r.loss,
        latency: r.avgLatency || r.latency,
        jitter: r.jitter,
        throughput: r.throughput,
      }));
      setTestResults(prev => ({ ...prev, [testId]: chartData }));
    } catch (err) {
      console.error('Failed to fetch test results:', err);
    } finally {
      setLoadingResults(prev => ({ ...prev, [testId]: false }));
    }
  }, [testResults]);

  // Auto-fetch latest results for all enabled tests
  useEffect(() => {
    if (autoFetchRef.current || tests.length === 0 || loadingTests) return;
    const enabledTests = tests.filter(t => isEnabled(t.enabled));
    if (enabledTests.length === 0) return;
    autoFetchRef.current = true;

    const batchFetch = async () => {
      const batchSize = 5;
      for (let i = 0; i < enabledTests.length; i += batchSize) {
        const batch = enabledTests.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(t => fetchTestResults(t.testId, t.type))
        );
      }
    };
    batchFetch();
  }, [tests, loadingTests, fetchTestResults]);

  return {
    testResults,
    loadingResults,
    fetchTestResults,
  };
}
