'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TimeRange, PerformanceData } from '@/types/visualization';
import { TIME_RANGE_SECONDS } from '@/types/visualization';

export interface UseMerakiPerformanceParams {
  selectedOrg: string;
  selectedNetwork: string;
}

export interface UseMerakiPerformanceReturn {
  performanceData: PerformanceData[];
  performanceLoading: boolean;
  fetchPerformance: (timeRange: TimeRange) => Promise<void>;
}

export function useMerakiPerformance({ selectedOrg, selectedNetwork }: UseMerakiPerformanceParams): UseMerakiPerformanceReturn {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  const fetchPerformance = useCallback(async (timeRange: TimeRange) => {
    if (!selectedOrg || !selectedNetwork) return;
    setPerformanceLoading(true);
    try {
      const timeSpan = TIME_RANGE_SECONDS[timeRange];
      const data = await apiClient.getNetworkPerformance(selectedOrg, selectedNetwork, timeSpan);

      const points: PerformanceData[] = [];
      if (data.trafficAnalysis) {
        data.trafficAnalysis.forEach((d: any) => {
          points.push({
            timestamp: d.timestamp,
            throughputSent: d.sent,
            throughputRecv: d.recv,
            source: 'meraki',
          });
        });
      }
      setPerformanceData(points);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setPerformanceLoading(false);
    }
  }, [selectedOrg, selectedNetwork]);

  return {
    performanceData,
    performanceLoading,
    fetchPerformance,
  };
}
