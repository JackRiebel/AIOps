'use client';

import { useState, useCallback } from 'react';

export interface UseSplunkSAIAParams {
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
  setError: (err: string | null) => void;
  logAIQuery?: (
    query: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: { durationMs?: number; toolsUsed?: string[]; costUsd?: number },
  ) => void;
  isAISessionActive?: boolean;
}

export interface UseSplunkSAIAReturn {
  generatedSpl: string | null;
  splExplanation: string | null;
  optimizedSpl: string | null;
  saiaAnswer: string | null;
  loadingSaia: boolean;
  generateSpl: (prompt: string) => Promise<void>;
  optimizeSpl: (spl: string) => Promise<void>;
  explainSpl: (spl: string) => Promise<void>;
  askSplunk: (question: string) => Promise<void>;
  clearSaiaResults: () => void;
}

/**
 * Check if a SAIA response is a real answer vs a status/error message.
 * The MCP server returns strings like "Tool executed successfully (0 results)."
 * when the SAIA tool runs but produces no actual output.
 */
function isValidSaiaResponse(value: unknown): value is string {
  if (!value) return false;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (!s || s === 'null' || s === 'None' || s === '[]' || s === '{}') return false;
  if (s.startsWith('Tool executed')) return false;
  if (s.startsWith('MCP tool error')) return false;
  return true;
}

export function useSplunkSAIA({ fetchApi, setError, logAIQuery, isAISessionActive }: UseSplunkSAIAParams): UseSplunkSAIAReturn {
  const selectedOrg = 'default';
  const [generatedSpl, setGeneratedSpl] = useState<string | null>(null);
  const [splExplanation, setSplExplanation] = useState<string | null>(null);
  const [optimizedSpl, setOptimizedSpl] = useState<string | null>(null);
  const [saiaAnswer, setSaiaAnswer] = useState<string | null>(null);
  const [loadingSaia, setLoadingSaia] = useState(false);

  const generateSpl = useCallback(async (prompt: string) => {
    const startTime = Date.now();
    try {
      setLoadingSaia(true);
      setError(null);
      setGeneratedSpl(null);
      const data = await fetchApi<any>(`/api/splunk/saia/generate-spl?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      if (!data) {
        setError('Splunk AI Assistant is not available');
        return;
      }
      const spl = typeof data.spl === 'string' ? data.spl : JSON.stringify(data.spl);
      if (isValidSaiaResponse(spl)) {
        setGeneratedSpl(spl);
        if (isAISessionActive && logAIQuery) {
          logAIQuery(prompt, spl, 'splunk-saia', 0, 0, { durationMs: Date.now() - startTime });
        }
      } else {
        setError('SAIA returned no SPL. The Splunk AI Assistant may need to be configured on the Splunk server, or the tool parameters may not match. Check the backend logs for details.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SPL');
    } finally {
      setLoadingSaia(false);
    }
  }, [fetchApi, selectedOrg, setError, logAIQuery, isAISessionActive]);

  const optimizeSpl = useCallback(async (spl: string) => {
    const startTime = Date.now();
    try {
      setLoadingSaia(true);
      setError(null);
      setOptimizedSpl(null);
      const data = await fetchApi<any>(`/api/splunk/saia/optimize-spl?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({ spl }),
      });
      if (!data) {
        setError('Splunk AI Assistant is not available');
        return;
      }
      const result = typeof data.optimized === 'string' ? data.optimized : JSON.stringify(data.optimized);
      if (isValidSaiaResponse(result)) {
        setOptimizedSpl(result);
        if (isAISessionActive && logAIQuery) {
          logAIQuery(spl, result, 'splunk-saia', 0, 0, { durationMs: Date.now() - startTime });
        }
      } else {
        setError('SAIA could not optimize this query. Check backend logs for details.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize SPL');
    } finally {
      setLoadingSaia(false);
    }
  }, [fetchApi, selectedOrg, setError, logAIQuery, isAISessionActive]);

  const explainSpl = useCallback(async (spl: string) => {
    const startTime = Date.now();
    try {
      setLoadingSaia(true);
      setError(null);
      setSplExplanation(null);
      const data = await fetchApi<any>(`/api/splunk/saia/explain-spl?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({ spl }),
      });
      if (!data) {
        setError('Splunk AI Assistant is not available');
        return;
      }
      const explanation = typeof data.explanation === 'string' ? data.explanation : JSON.stringify(data.explanation);
      if (isValidSaiaResponse(explanation)) {
        setSplExplanation(explanation);
        if (isAISessionActive && logAIQuery) {
          logAIQuery(spl, explanation, 'splunk-saia', 0, 0, { durationMs: Date.now() - startTime });
        }
      } else {
        setError('SAIA could not explain this query. Check backend logs for details.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to explain SPL');
    } finally {
      setLoadingSaia(false);
    }
  }, [fetchApi, selectedOrg, setError, logAIQuery, isAISessionActive]);

  const askSplunk = useCallback(async (question: string) => {
    const startTime = Date.now();
    try {
      setLoadingSaia(true);
      setError(null);
      setSaiaAnswer(null);
      const data = await fetchApi<any>(`/api/splunk/saia/ask?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({ question }),
      });
      if (!data) {
        setError('Splunk AI Assistant is not available');
        return;
      }
      const answer = typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer);
      if (isValidSaiaResponse(answer)) {
        setSaiaAnswer(answer);
        if (isAISessionActive && logAIQuery) {
          logAIQuery(question, answer, 'splunk-saia', 0, 0, { durationMs: Date.now() - startTime });
        }
      } else {
        // Set a human-readable error as the answer so it appears in chat history
        setSaiaAnswer('Sorry, SAIA could not answer this question. The Splunk AI Assistant tool returned no content. This usually means the SAIA app needs to be configured on your Splunk server. Check the backend logs for the raw MCP response.');
      }
    } catch (err) {
      setSaiaAnswer(`Error: ${err instanceof Error ? err.message : 'Failed to ask question'}`);
    } finally {
      setLoadingSaia(false);
    }
  }, [fetchApi, selectedOrg, setError, logAIQuery, isAISessionActive]);

  const clearSaiaResults = useCallback(() => {
    setGeneratedSpl(null);
    setSplExplanation(null);
    setOptimizedSpl(null);
    setSaiaAnswer(null);
  }, []);

  return {
    generatedSpl,
    splExplanation,
    optimizedSpl,
    saiaAnswer,
    loadingSaia,
    generateSpl,
    optimizeSpl,
    explainSpl,
    askSplunk,
    clearSaiaResults,
  };
}
