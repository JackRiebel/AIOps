'use client';

import { useMemo } from 'react';
import type { TopologyNode, DeviceAnnotation, LinkAnnotation } from '@/types/visualization';
import type { Agent, Test, Alert, TestHealthCell, TestResult } from '@/components/thousandeyes/types';

export interface UseCrossPlatformAnnotationsParams {
  topologyNodes: TopologyNode[];
  teAgents: Agent[];
  teTests: Test[];
  teAlerts: Alert[];
  teTestHealthMap: TestHealthCell[];
  teTestResults?: Record<number, TestResult[]>;
}

export interface UseCrossPlatformAnnotationsReturn {
  deviceAnnotations: Map<string, DeviceAnnotation>;
  linkAnnotations: Map<string, LinkAnnotation>;
}

export function useCrossPlatformAnnotations({
  topologyNodes,
  teAgents,
  teTests,
  teAlerts,
  teTestHealthMap,
  teTestResults,
}: UseCrossPlatformAnnotationsParams): UseCrossPlatformAnnotationsReturn {
  // Build device annotations by matching device IPs against TE agent IPs
  const deviceAnnotations = useMemo(() => {
    const map = new Map<string, DeviceAnnotation>();
    if (!teAgents.length || !topologyNodes.length) return map;

    const agentIpMap = new Map<string, Agent>();
    teAgents.forEach(agent => {
      (agent.ipAddresses || []).forEach(ip => {
        agentIpMap.set(ip, agent);
      });
    });

    topologyNodes.forEach(node => {
      const ips = [node.lanIp, node.wan1Ip].filter(Boolean) as string[];
      const matchedAgentIds: number[] = [];
      const matchedIps: string[] = [];

      ips.forEach(ip => {
        const agent = agentIpMap.get(ip);
        if (agent) {
          matchedAgentIds.push(agent.agentId);
          matchedIps.push(ip);
        }
      });

      // Count TE tests running through matched agents
      let teTestCount = 0;
      let teAlertCount = 0;
      if (matchedAgentIds.length > 0) {
        teTests.forEach(test => {
          if (test.agents?.some(a => matchedAgentIds.includes(a.agentId))) {
            teTestCount++;
          }
        });
        teAlerts.forEach(alert => {
          if (alert.agents?.some(a => matchedAgentIds.includes(a.agentId))) {
            teAlertCount++;
          }
        });
      }

      if (matchedAgentIds.length > 0 || teTestCount > 0) {
        map.set(node.id, {
          deviceId: node.id,
          deviceName: node.name,
          teAgentIds: matchedAgentIds,
          teTestCount,
          teAlertCount,
          splunkEventCount: 0,
          matchedIps,
        });
      }
    });

    return map;
  }, [topologyNodes, teAgents, teTests, teAlerts]);

  // Build link annotations from TE test results
  const linkAnnotations = useMemo(() => {
    const map = new Map<string, LinkAnnotation>();

    // Build a map: agentId -> Set of topology node IDs
    const agentToNodeIds = new Map<number, Set<string>>();
    deviceAnnotations.forEach((ann) => {
      ann.teAgentIds.forEach(agentId => {
        if (!agentToNodeIds.has(agentId)) agentToNodeIds.set(agentId, new Set());
        agentToNodeIds.get(agentId)!.add(ann.deviceId);
      });
    });

    // Helper to add annotation for a test
    type HealthStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';
    const addAnnotation = (
      testId: number, testName: string, health: HealthStatus,
      latency: number | undefined, loss: number | undefined,
      testAgentIds: number[]
    ) => {
      const nodeIds = new Set<string>();
      testAgentIds.forEach(agentId => {
        agentToNodeIds.get(agentId)?.forEach(nodeId => nodeIds.add(nodeId));
      });
      if (nodeIds.size === 0 && latency === undefined) return;

      const key = `te-${testId}`;
      map.set(key, {
        edgeKey: key,
        teLatency: latency,
        teLoss: loss,
        teTestId: testId,
        teTestName: testName,
        teHealth: health,
        splunkEvents: 0,
        _nodeIds: Array.from(nodeIds),
      });

      nodeIds.forEach(nodeId => {
        const nodeKey = `node-${nodeId}`;
        const existing = map.get(nodeKey);
        if (!existing || (latency && (!existing.teLatency || latency > existing.teLatency))) {
          map.set(nodeKey, {
            edgeKey: nodeKey,
            teLatency: latency,
            teLoss: loss,
            teTestId: testId,
            teTestName: testName,
            teHealth: health,
            splunkEvents: 0,
          });
        }
      });
    };

    // Track which tests got annotations from testHealthMap
    const annotatedTestIds = new Set<number>();

    // Primary source: testHealthMap cells with metrics
    teTestHealthMap.forEach(cell => {
      const metrics = cell.latestMetrics;
      if (!metrics) return;

      const health = cell.health === 'healthy' ? 'healthy'
        : cell.health === 'degraded' ? 'degraded'
        : cell.health === 'failing' ? 'failing'
        : 'unknown';

      const test = teTests.find(t => t.testId === cell.testId);
      const testAgentIds = (test?.agents || []).map(a => a.agentId);
      addAnnotation(cell.testId, cell.testName, health, metrics.latency, metrics.loss, testAgentIds);
      annotatedTestIds.add(cell.testId);
    });

    // Fallback: for tests without testHealthMap metrics, use raw testResults
    if (teTestResults) {
      teTests.forEach(test => {
        if (annotatedTestIds.has(test.testId)) return;
        const results = teTestResults[test.testId];
        if (!results || results.length === 0) return;

        const last = results[results.length - 1];
        const latency = last.latency ?? last.responseTime;
        if (latency === undefined) return;

        const testAgentIds = (test.agents || []).map(a => a.agentId);
        // Derive health from latency/loss thresholds
        const loss = last.loss ?? 0;
        const health: HealthStatus = loss > 2 || (latency > 200) ? 'failing'
          : loss > 0.5 || (latency > 100) ? 'degraded'
          : 'healthy';

        addAnnotation(test.testId, test.testName, health, latency, loss, testAgentIds);
      });
    }

    return map;
  }, [teTestHealthMap, teTests, teTestResults, deviceAnnotations]);

  return { deviceAnnotations, linkAnnotations };
}
