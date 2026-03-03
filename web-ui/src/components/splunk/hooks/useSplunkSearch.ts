'use client';

import { useState, useCallback } from 'react';
import type { SplunkLog } from '../types';

export interface UseSplunkSearchParams {
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
  setError: (err: string | null) => void;
}

export interface UseSplunkSearchReturn {
  searchResults: any[];
  rawLogs: SplunkLog[];
  loadingSearch: boolean;
  searchLogs: (query: string, timeRange: string, maxResults: number) => Promise<void>;
}

export function useSplunkSearch({ fetchApi, setError }: UseSplunkSearchParams): UseSplunkSearchReturn {
  const selectedOrg = 'default';
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<SplunkLog[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const searchLogs = useCallback(async (query: string, timeRange: string, maxResults: number) => {
    try {
      setLoadingSearch(true);
      setError(null);
      const data = await fetchApi<any>(`/api/splunk/search?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({
          search: query,
          earliest_time: timeRange,
          latest_time: 'now',
          max_results: maxResults,
        }),
      });
      if (!data) return;

      const results = data.results || [];
      if (Array.isArray(results)) {
        const parsed = results.map((r: any) => {
          if (typeof r === 'string') {
            try { return JSON.parse(r); } catch { return { _raw: r }; }
          }
          if (r.text) {
            try { return JSON.parse(r.text); } catch { return { _raw: r.text }; }
          }
          return r;
        });
        const flat = parsed.length === 1 && Array.isArray(parsed[0]) ? parsed[0] : parsed;
        setSearchResults(flat);
        setRawLogs(flat);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoadingSearch(false);
    }
  }, [fetchApi, selectedOrg, setError]);

  return {
    searchResults,
    rawLogs,
    loadingSearch,
    searchLogs,
  };
}
