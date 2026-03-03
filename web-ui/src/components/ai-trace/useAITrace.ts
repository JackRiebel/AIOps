'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AITraceSummary, AITraceDetail, WaterfallBar } from '@/types/ai-trace';
import type { JourneyCostSummary } from '@/types/journey-flow';

export function useRecentTraces(limit = 15, provider?: string | null) {
  const [traces, setTraces] = useState<AITraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: String(limit) });
      if (provider) params.set('provider', provider);
      const res = await fetch(`/api/ai-traces/recent?${params}`, {
        signal: controller.signal,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to fetch traces: ${res.status}`);
      const data = await res.json();
      setTraces(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit, provider]);

  useEffect(() => {
    refresh();
    // Auto-refresh on tab focus
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      abortRef.current?.abort();
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { traces, loading, error, refresh };
}

export function useAITrace(traceId: string | null) {
  const [trace, setTrace] = useState<AITraceDetail | null>(null);
  const [waterfall, setWaterfall] = useState<WaterfallBar[]>([]);
  const [costSummary, setCostSummary] = useState<JourneyCostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!traceId) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const [traceRes, waterfallRes] = await Promise.all([
        // Use /journey endpoint for baseline+anomaly enriched data, fall back to plain trace
        fetch(`/api/ai-traces/${traceId}/journey`, {
          signal: controller.signal,
          credentials: 'include',
        }).then((r) => r.ok ? r : fetch(`/api/ai-traces/${traceId}`, {
          signal: controller.signal,
          credentials: 'include',
        })),
        fetch(`/api/ai-traces/${traceId}/waterfall`, {
          signal: controller.signal,
          credentials: 'include',
        }),
      ]);

      if (!traceRes.ok) throw new Error(`Failed to fetch trace: ${traceRes.status}`);
      if (!waterfallRes.ok) throw new Error(`Failed to fetch waterfall: ${waterfallRes.status}`);

      const [traceData, waterfallData] = await Promise.all([
        traceRes.json(),
        waterfallRes.json(),
      ]);

      setTrace(traceData);
      setWaterfall(waterfallData);

      // Extract cost summary from journey-enriched response
      if (traceData.cost_summary) {
        const cs = traceData.cost_summary;
        setCostSummary({
          totalCostUsd: cs.total_cost_usd,
          totalNetworkTaxMs: cs.total_network_tax_ms || cs.total_raw_network_ms || 0,
          totalRawNetworkMs: cs.total_raw_network_ms,
          avgRawNetworkMs: cs.avg_raw_network_ms,
          totalWastedUsd: cs.total_wasted_usd,
          networkTaxPct: cs.network_tax_pct,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);

  return { trace, waterfall, costSummary, loading, error, refresh };
}
