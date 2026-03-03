'use client';

import { useMemo } from 'react';
import { isEnabled } from '../types';
import type { Test, TestResult, Alert, TEEvent, Outage, TestHealthCell, TimelineItem } from '../types';
import { mapSeverity } from './utils';

export interface UseTETestHealthParams {
  tests: Test[];
  alerts: Alert[];
  events: TEEvent[];
  outages: Outage[];
  testResults: Record<number, TestResult[]>;
}

export interface UseTETestHealthReturn {
  enrichedTests: Test[];
  testHealthMap: TestHealthCell[];
  issueTimeline: TimelineItem[];
}

export function useTETestHealth({ tests, alerts, events, outages, testResults }: UseTETestHealthParams): UseTETestHealthReturn {
  // Enrich tests with latest metrics from fetched results
  const enrichedTests: Test[] = useMemo(() => {
    return tests.map(test => {
      const results = testResults[test.testId];
      if (!results || results.length === 0) return test;
      const last = results[results.length - 1];
      return {
        ...test,
        _latestMetrics: {
          latency: last.latency,
          loss: last.loss,
          availability: last.availability,
          responseTime: last.responseTime,
        },
      };
    });
  }, [tests, testResults]);

  const testHealthMap: TestHealthCell[] = useMemo(() => {
    const alertsByTestId = new Map<number, Alert[]>();
    alerts.forEach(a => {
      if (a.testId) {
        const existing = alertsByTestId.get(a.testId) || [];
        existing.push(a);
        alertsByTestId.set(a.testId, existing);
      }
    });

    return enrichedTests.map(test => {
      if (!isEnabled(test.enabled)) {
        return { testId: test.testId, testName: test.testName, type: test.type, health: 'disabled' as const };
      }
      const testAlerts = alertsByTestId.get(test.testId) || [];
      const activeTestAlerts = testAlerts.filter(a => isEnabled(a.active));
      const hasCritical = activeTestAlerts.some(a => mapSeverity(a.severity) === 'critical' || mapSeverity(a.severity) === 'major');

      let health: 'healthy' | 'degraded' | 'failing' = 'healthy';
      if (hasCritical) health = 'failing';
      else if (activeTestAlerts.length > 0) health = 'degraded';

      return {
        testId: test.testId,
        testName: test.testName,
        type: test.type,
        health,
        latestMetrics: test._latestMetrics ? {
          latency: test._latestMetrics.latency,
          loss: test._latestMetrics.loss,
          availability: test._latestMetrics.availability,
        } : undefined,
      };
    });
  }, [enrichedTests, alerts]);

  // Issue timeline (merged alerts + events + outages)
  const issueTimeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];

    alerts.forEach(a => {
      items.push({
        id: `alert-${a.alertId}`,
        type: 'alert',
        severity: mapSeverity(a.severity),
        title: a.testName || `Alert #${a.alertId}`,
        description: a.ruleExpression || 'Alert triggered',
        timestamp: a.dateStart,
        endTimestamp: a.dateEnd,
        isActive: isEnabled(a.active),
        source: a,
      });
    });

    events.forEach(e => {
      items.push({
        id: `event-${e.eventId}`,
        type: 'event',
        severity: mapSeverity(e.severity),
        title: e.summary || `Event ${e.eventId}`,
        description: `${e.type}${e.affectedTargets ? ` — ${e.affectedTargets} targets affected` : ''}`,
        timestamp: e.startDate,
        endTimestamp: e.endDate,
        isActive: !e.endDate,
        source: e,
      });
    });

    outages.forEach(o => {
      items.push({
        id: `outage-${o.id}`,
        type: 'outage',
        severity: !o.endDate ? 'critical' : 'major',
        title: `${o.type} outage — ${o.provider}`,
        description: `${o.affectedTests} tests affected${o.server ? ` (${o.server})` : ''}`,
        timestamp: o.startDate,
        endTimestamp: o.endDate,
        isActive: !o.endDate,
        source: o,
      });
    });

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, events, outages]);

  return {
    enrichedTests,
    testHealthMap,
    issueTimeline,
  };
}
