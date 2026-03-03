/**
 * Shared utilities for converting TEPathHop[] → TopologyNode[] / TopologyLink[]
 * Single source of truth for zone classification in the ai-trace module.
 * Re-exports canonical zone helpers from thousandeyes/types.
 */

import {
  classifyZone as teClassifyZone,
  getLinkHealth,
  extractAsNumber as teExtractAsNumber,
  ZONE_CONFIG,
  type TopologyNode,
  type TopologyLink,
  type PathHop,
} from '@/components/thousandeyes/types';
import type { TEPathHop } from '@/types/journey-flow';

// Re-export canonical helpers for consumers
export { ZONE_CONFIG, getLinkHealth };
export type { TopologyNode, TopologyLink };

/**
 * Classify a TEPathHop into a zone using the canonical TE classifyZone function.
 * Bridges the TEPathHop shape to the PathHop shape expected by classifyZone.
 */
export function classifyZone(hop: TEPathHop, index: number, total: number): TopologyNode['zone'] {
  const pathHop: PathHop = {
    hopNumber: index + 1,
    ipAddress: hop.ip,
    hostname: hop.rdns || undefined,
    latency: hop.delay,
    loss: hop.loss,
    prefix: hop.prefix || undefined,
    network: hop.network || undefined,
  };
  return teClassifyZone(pathHop, index, total);
}

/**
 * Extract AS number from network string.
 */
export function extractAsNumber(network: string): string | null {
  const result = teExtractAsNumber(network);
  return result ? `AS${result}` : null;
}

/**
 * Extract AS organization name (the part after the AS number).
 */
export function extractAsOrg(network: string): string {
  return network.replace(/AS\s*\d+\s*/i, '').trim();
}

/**
 * Convert TEPathHop[] → { nodes: TopologyNode[], links: TopologyLink[] }
 * Used by NetworkPathsDashboard, JourneyDetailDrawer, and NetworkSegmentNode
 * to feed the canonical NetworkPathFlow and LatencyWaterfallChart components.
 */
export function hopsToTopology(hops: TEPathHop[]): { nodes: TopologyNode[]; links: TopologyLink[] } {
  if (hops.length === 0) return { nodes: [], links: [] };

  // Find bottleneck (highest latency hop, excluding first/last)
  let maxDelay = 0;
  let bottleneckIdx = -1;
  for (let i = 1; i < hops.length - 1; i++) {
    if (hops[i].delay > maxDelay) {
      maxDelay = hops[i].delay;
      bottleneckIdx = i;
    }
  }

  const nodes: TopologyNode[] = hops.map((hop, i) => {
    const zone = classifyZone(hop, i, hops.length);
    const asNum = teExtractAsNumber(hop.network);
    return {
      id: `hop-${i}`,
      label: hop.rdns || hop.ip,
      ip: hop.ip,
      zone,
      latency: hop.delay,
      loss: hop.loss,
      network: hop.network || undefined,
      hopNumber: i + 1,
      prefix: hop.prefix || undefined,
      asNumber: asNum || undefined,
    };
  });

  const links: TopologyLink[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    const latency = hops[i + 1].delay;
    const loss = Math.max(hops[i].loss, hops[i + 1].loss);
    links.push({
      from: `hop-${i}`,
      to: `hop-${i + 1}`,
      latency,
      loss,
      health: getLinkHealth(latency, loss),
    });
  }

  return { nodes, links };
}

/**
 * Group hops into zone bands for SVG visualization.
 */
export function groupHopsByZone(hops: TEPathHop[]): { zone: string; startIdx: number; endIdx: number }[] {
  if (hops.length === 0) return [];

  const bands: { zone: string; startIdx: number; endIdx: number }[] = [];
  let currentZone = classifyZone(hops[0], 0, hops.length);
  let bandStart = 0;

  for (let i = 1; i < hops.length; i++) {
    const zone = classifyZone(hops[i], i, hops.length);
    if (zone !== currentZone) {
      bands.push({ zone: currentZone, startIdx: bandStart, endIdx: i - 1 });
      currentZone = zone;
      bandStart = i;
    }
  }
  bands.push({ zone: currentZone, startIdx: bandStart, endIdx: hops.length - 1 });
  return bands;
}

/**
 * Find bottleneck hop index (highest latency, excluding first/last).
 */
export function findBottleneck(hops: TEPathHop[]): { index: number; delay: number; hasBottleneck: boolean } {
  let maxDelay = 0;
  let bottleneckIdx = -1;
  for (let i = 1; i < hops.length - 1; i++) {
    if (hops[i].delay > maxDelay) {
      maxDelay = hops[i].delay;
      bottleneckIdx = i;
    }
  }
  return { index: bottleneckIdx, delay: maxDelay, hasBottleneck: maxDelay > 50 };
}
