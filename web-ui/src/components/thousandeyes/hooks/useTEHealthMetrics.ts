'use client';

import { useMemo } from 'react';
import { isEnabled, isAgentOnline } from '../types';
import type { Test, TestResult, Alert, Agent, TEEvent, Outage, HealthMetric } from '../types';

export interface UseTEHealthMetricsParams {
  tests: Test[];
  agents: Agent[];
  alerts: Alert[];
  events: TEEvent[];
  outages: Outage[];
  testResults: Record<number, TestResult[]>;
}

export interface UseTEHealthMetricsReturn {
  activeAlertCount: number;
  enabledAgentsCount: number;
  activeOutageCount: number;
  healthScore: number;
  metrics: HealthMetric[];
  aggregatedMetrics: {
    avgLatency: number | null;
    avgLoss: number | null;
    avgAvailability: number | null;
    latencyHistory: number[];
    lossHistory: number[];
    availHistory: number[];
  };
}

export function useTEHealthMetrics({ tests, agents, alerts, events, outages, testResults }: UseTEHealthMetricsParams): UseTEHealthMetricsReturn {
  const activeAlertCount = useMemo(() => alerts.filter(a => isEnabled(a.active)).length, [alerts]);
  const enabledAgentsCount = useMemo(() => agents.filter(a => isAgentOnline(a)).length, [agents]);
  const activeOutageCount = useMemo(() => outages.filter(o => !o.endDate).length, [outages]);

  const healthScore = useMemo(() => {
    if (tests.length === 0 && agents.length === 0) return 100;
    let score = 100;

    if (agents.length > 0) {
      const agentRatio = enabledAgentsCount / agents.length;
      score -= (1 - agentRatio) * 40;
    }

    const alertPenalty = Math.min(activeAlertCount * 5, 30);
    score -= alertPenalty;

    const outagePenalty = Math.min(activeOutageCount * 10, 20);
    score -= outagePenalty;

    const eventPenalty = Math.min(events.length * 1, 10);
    score -= eventPenalty;

    return Math.max(0, Math.round(score));
  }, [tests.length, agents.length, enabledAgentsCount, activeAlertCount, activeOutageCount, events.length]);

  const aggregatedMetrics = useMemo(() => {
    const resultsEntries = Object.entries(testResults);
    if (resultsEntries.length === 0) return { avgLatency: null, avgLoss: null, avgAvailability: null, latencyHistory: [] as number[], lossHistory: [] as number[], availHistory: [] as number[] };

    let latencySum = 0, latencyCount = 0;
    let lossSum = 0, lossCount = 0;
    let availSum = 0, availCount = 0;
    const latencyHistory: number[] = [];
    const lossHistory: number[] = [];
    const availHistory: number[] = [];

    resultsEntries.forEach(([, results]) => {
      if (!results || results.length === 0) return;
      const last = results[results.length - 1];
      if (last.latency != null) { latencySum += last.latency; latencyCount++; }
      if (last.loss != null) { lossSum += last.loss; lossCount++; }
      if (last.availability != null) { availSum += last.availability; availCount++; }
      results.slice(-12).forEach((r, i) => {
        if (r.latency != null) { latencyHistory[i] = (latencyHistory[i] || 0) + r.latency; }
        if (r.loss != null) { lossHistory[i] = (lossHistory[i] || 0) + r.loss; }
        if (r.availability != null) { availHistory[i] = (availHistory[i] || 0) + r.availability; }
      });
    });

    return {
      avgLatency: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
      avgLoss: lossCount > 0 ? Math.round((lossSum / lossCount) * 10) / 10 : null,
      avgAvailability: availCount > 0 ? Math.round((availSum / availCount) * 10) / 10 : null,
      latencyHistory: latencyHistory.map(v => Math.round(v / Math.max(latencyCount, 1))),
      lossHistory: lossHistory.map(v => Math.round((v / Math.max(lossCount, 1)) * 10) / 10),
      availHistory: availHistory.map(v => Math.round((v / Math.max(availCount, 1)) * 10) / 10),
    };
  }, [testResults]);

  const metrics: HealthMetric[] = useMemo(() => {
    const enabledTests = tests.filter(t => isEnabled(t.enabled)).length;
    const agentHealth = agents.length > 0 ? Math.round((enabledAgentsCount / agents.length) * 100) : 100;
    const { avgLatency, avgLoss, avgAvailability, latencyHistory, lossHistory, availHistory } = aggregatedMetrics;

    // Use real data only — no fabricated fallback values
    const availValue = avgAvailability ?? 0;
    const latencyValue = avgLatency ?? 0;
    const lossValue = avgLoss ?? 0;
    const hasRealData = avgAvailability !== null || avgLatency !== null || avgLoss !== null;

    return [
      {
        id: 'availability',
        label: 'Availability',
        value: hasRealData ? availValue : (enabledTests > 0 ? 0 : 100),
        unit: '%',
        sparklineData: availHistory.length >= 3 ? availHistory : [],
        trend: hasRealData && availValue < 99 ? 'down' as const : 'stable' as const,
        trendPercent: hasRealData && availValue < 99 ? Math.round((100 - availValue) * 10) / 10 : 0,
        status: !hasRealData ? 'healthy' as const : availValue < 90 ? 'critical' as const : availValue < 99 ? 'warning' as const : 'healthy' as const,
      },
      {
        id: 'latency',
        label: 'Avg Latency',
        value: latencyValue,
        unit: 'ms',
        sparklineData: latencyHistory.length >= 3 ? latencyHistory : [],
        trend: latencyValue > 100 ? 'up' as const : 'stable' as const,
        trendPercent: 0,
        status: latencyValue > 200 ? 'critical' as const : latencyValue > 100 ? 'warning' as const : 'healthy' as const,
      },
      {
        id: 'loss',
        label: 'Packet Loss',
        value: lossValue,
        unit: '%',
        sparklineData: lossHistory.length >= 3 ? lossHistory : [],
        trend: lossValue > 0 ? 'up' as const : 'stable' as const,
        trendPercent: 0,
        status: lossValue > 2 ? 'critical' as const : lossValue > 0.5 ? 'warning' as const : 'healthy' as const,
      },
      {
        id: 'alerts',
        label: 'Active Alerts',
        value: activeAlertCount,
        unit: '',
        sparklineData: [],
        trend: activeAlertCount > 0 ? 'up' as const : 'stable' as const,
        trendPercent: 0,
        status: activeAlertCount > 3 ? 'critical' as const : activeAlertCount > 0 ? 'warning' as const : 'healthy' as const,
      },
      {
        id: 'agentHealth',
        label: 'Agent Health',
        value: agentHealth,
        unit: '%',
        sparklineData: [],
        trend: agentHealth < 80 ? 'down' as const : 'stable' as const,
        trendPercent: 0,
        status: agentHealth < 50 ? 'critical' as const : agentHealth < 80 ? 'warning' as const : 'healthy' as const,
      },
      {
        id: 'activeTests',
        label: 'Active Tests',
        value: enabledTests,
        unit: '',
        sparklineData: [],
        trend: 'stable' as const,
        trendPercent: 0,
        status: enabledTests === 0 ? 'warning' as const : 'healthy' as const,
      },
    ];
  }, [tests, agents.length, enabledAgentsCount, activeAlertCount, activeOutageCount, aggregatedMetrics]);

  return {
    activeAlertCount,
    enabledAgentsCount,
    activeOutageCount,
    healthScore,
    metrics,
    aggregatedMetrics,
  };
}
