'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SplunkIndex,
  SplunkIndexDetail,
  SplunkIndexMetadata,
} from '../types';

export interface UseSplunkIndexesParams {
  indexes: SplunkIndex[];
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
}

export interface UseSplunkIndexesReturn {
  indexDetails: Record<string, SplunkIndexDetail>;
  indexMetadata: Record<string, SplunkIndexMetadata>;
  fetchIndexDetail: (name: string) => Promise<void>;
  fetchIndexMetadata: (name: string, metadataType: string) => Promise<void>;
}

export function useSplunkIndexes({ indexes, fetchApi }: UseSplunkIndexesParams): UseSplunkIndexesReturn {
  const selectedOrg = 'default';
  const [indexDetails, setIndexDetails] = useState<Record<string, SplunkIndexDetail>>({});
  const [indexMetadata, setIndexMetadata] = useState<Record<string, SplunkIndexMetadata>>({});
  const metadataFetchDone = useRef(false);

  const fetchIndexDetail = useCallback(async (name: string) => {
    try {
      const data = await fetchApi<any>(`/api/splunk/indexes/${encodeURIComponent(name)}?organization=${selectedOrg}`);
      if (!data) return;
      setIndexDetails(prev => ({ ...prev, [name]: data.index }));
    } catch (err) {
      console.error(`Failed to fetch index detail for ${name}:`, err);
    }
  }, [fetchApi, selectedOrg]);

  const fetchIndexMetadata = useCallback(async (name: string, metadataType: string) => {
    try {
      const data = await fetchApi<any>(
        `/api/splunk/indexes/${encodeURIComponent(name)}/metadata?metadata_type=${metadataType}&organization=${selectedOrg}`
      );
      if (!data) return;

      setIndexMetadata(prev => {
        const existing = prev[name] || {};
        const metadata = data.metadata;
        let values: string[] = [];
        if (Array.isArray(metadata)) {
          values = metadata;
        } else if (metadata && typeof metadata === 'object') {
          values = Object.keys(metadata);
        }
        return {
          ...prev,
          [name]: { ...existing, [metadataType]: values } as SplunkIndexMetadata,
        };
      });
    } catch (err) {
      console.error(`Failed to fetch metadata for ${name}:`, err);
    }
  }, [fetchApi, selectedOrg]);

  // Auto-fetch metadata for top indexes
  useEffect(() => {
    if (metadataFetchDone.current || indexes.length === 0) return;
    metadataFetchDone.current = true;

    const topIndexes = indexes
      .filter(idx => {
        const count = typeof idx.totalEventCount === 'string'
          ? parseInt(idx.totalEventCount, 10) || 0
          : (idx.totalEventCount || 0);
        return count > 0;
      })
      .sort((a, b) => {
        const ac = typeof a.totalEventCount === 'string' ? parseInt(a.totalEventCount, 10) : (a.totalEventCount || 0);
        const bc = typeof b.totalEventCount === 'string' ? parseInt(b.totalEventCount, 10) : (b.totalEventCount || 0);
        return bc - ac;
      })
      .slice(0, 5);

    for (const idx of topIndexes) {
      fetchIndexMetadata(idx.name, 'hosts');
      fetchIndexMetadata(idx.name, 'sources');
    }
  }, [indexes, fetchIndexMetadata]);

  return {
    indexDetails,
    indexMetadata,
    fetchIndexDetail,
    fetchIndexMetadata,
  };
}
