'use client';

import { useMemo } from 'react';
import type { TopologyNode, TopologyEdge, DeviceType } from '@/types/visualization';
import type { LayoutType } from '../TopologyToolbar';

// ============================================================================
// Types
// ============================================================================

export interface LayoutOptions {
  width: number;
  height: number;
  padding?: number;
}

export interface PositionedNode extends TopologyNode {
  x: number;
  y: number;
}

// ============================================================================
// Device Hierarchy for Layout
// ============================================================================

const DEVICE_HIERARCHY: Record<DeviceType | string, number> = {
  MX: 0,    // Security Appliance - leftmost (gateway)
  Z: 0,     // Z-series Teleworker Gateway - WAN device
  MG: 0,    // Cellular Gateway - WAN device
  MS: 1,    // Switch - middle layer
  MR: 2,    // Wireless AP
  CW: 2,    // Cisco Wireless AP
  MV: 2,    // Camera - connected to switches
  MT: 3,    // IoT Sensor - connected to APs
  Client: 5, // Client devices - pushed further right with gap from IoT
  unknown: 2,
};

// ============================================================================
// Layout Algorithms
// ============================================================================

/**
 * Hierarchical layout - arranges nodes in tiers from left to right
 */
function applyHierarchicalLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: LayoutOptions
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const { width, height, padding = 60 } = options;

  // Group nodes by hierarchy level
  const levels: Map<number, TopologyNode[]> = new Map();

  nodes.forEach((node) => {
    const level = DEVICE_HIERARCHY[node.type] ?? 2;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(node);
  });

  // Calculate positions
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const levelCount = sortedLevels.length;
  const horizontalGap = (width - padding * 2) / (levelCount > 1 ? levelCount - 1 : 1);

  const positionedNodes: PositionedNode[] = [];

  sortedLevels.forEach((level, levelIndex) => {
    const levelNodes = levels.get(level)!;
    const xPos = padding + horizontalGap * levelIndex;

    // Calculate vertical positions
    const nodeCount = levelNodes.length;
    const isClientLevel = level === DEVICE_HIERARCHY['Client'];

    if (isClientLevel && nodeCount > 1) {
      // Clients: spread into multiple columns to avoid vertical stacking
      const clientCols = Math.max(2, Math.ceil(nodeCount / 8));
      const colWidth = 140;
      const rowGap = 55;

      levelNodes.forEach((node, nodeIndex) => {
        const col = nodeIndex % clientCols;
        const row = Math.floor(nodeIndex / clientCols);
        const totalColWidth = (clientCols - 1) * colWidth;

        positionedNodes.push({
          ...node,
          x: xPos + col * colWidth - totalColWidth / 2,
          y: padding + row * rowGap + 40,
        });
      });
    } else {
      // Non-client levels: standard vertical distribution
      const availableHeight = height - padding * 2;
      const minGap = 50;

      let verticalGap: number;
      if (nodeCount === 1) {
        verticalGap = 0;
      } else {
        const calculatedGap = availableHeight / (nodeCount + 1);
        verticalGap = Math.max(minGap, calculatedGap);
      }

      // Compress if needed
      const totalHeight = nodeCount === 1 ? 0 : verticalGap * (nodeCount + 1);
      if (totalHeight > availableHeight && nodeCount > 1) {
        verticalGap = availableHeight / (nodeCount + 1);
      }

      levelNodes.forEach((node, nodeIndex) => {
        let yPos: number;
        if (nodeCount === 1) {
          yPos = height / 2;
        } else {
          yPos = padding + verticalGap * (nodeIndex + 1);
        }

        positionedNodes.push({
          ...node,
          x: xPos,
          y: yPos,
        });
      });
    }
  });

  return positionedNodes;
}

/**
 * Force-directed layout - uses physics simulation for organic clustering
 * Simplified version without d3-force dependency
 */
function applyForceLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: LayoutOptions
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const { width, height, padding = 60 } = options;
  const centerX = width / 2;
  const centerY = height / 2;

  // Initialize positions in a spiral pattern
  const positionedNodes: PositionedNode[] = nodes.map((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const radius = Math.min(width, height) * 0.3 * (1 + (i / nodes.length) * 0.5);
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Simple force simulation (10 iterations)
  const nodeMap = new Map(positionedNodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < 10; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodeA.x -= fx;
        nodeA.y -= fy;
        nodeB.x += fx;
        nodeB.y += fy;
      }
    }

    // Attraction along edges
    edges.forEach((edge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);

      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        sourceNode.x += fx;
        sourceNode.y += fy;
        targetNode.x -= fx;
        targetNode.y -= fy;
      }
    });

    // Center gravity
    positionedNodes.forEach((node) => {
      node.x += (centerX - node.x) * 0.01;
      node.y += (centerY - node.y) * 0.01;
    });
  }

  // Constrain to bounds
  positionedNodes.forEach((node) => {
    node.x = Math.max(padding, Math.min(width - padding, node.x));
    node.y = Math.max(padding, Math.min(height - padding, node.y));
  });

  return positionedNodes;
}

/**
 * Radial layout - arranges nodes in concentric circles based on hierarchy
 */
function applyRadialLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: LayoutOptions
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const { width, height, padding = 60 } = options;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - padding;

  // Group nodes by hierarchy level
  const levels: Map<number, TopologyNode[]> = new Map();

  nodes.forEach((node) => {
    const level = DEVICE_HIERARCHY[node.type] ?? 2;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(node);
  });

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const levelCount = sortedLevels.length;
  const radiusStep = maxRadius / (levelCount || 1);

  const positionedNodes: PositionedNode[] = [];

  sortedLevels.forEach((level, levelIndex) => {
    const levelNodes = levels.get(level)!;
    const radius = radiusStep * (levelIndex + 0.5);
    const angleStep = (2 * Math.PI) / (levelNodes.length || 1);

    levelNodes.forEach((node, nodeIndex) => {
      const angle = angleStep * nodeIndex - Math.PI / 2; // Start from top
      positionedNodes.push({
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });
  });

  return positionedNodes;
}

// ============================================================================
// useTopologyLayout Hook
// ============================================================================

export function useTopologyLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  layout: LayoutType,
  dimensions: { width: number; height: number }
): PositionedNode[] {
  return useMemo(() => {
    if (nodes.length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      return [];
    }

    const options: LayoutOptions = {
      width: dimensions.width,
      height: dimensions.height,
      padding: 60,
    };

    switch (layout) {
      case 'hierarchical':
        return applyHierarchicalLayout(nodes, edges, options);
      case 'force':
        return applyForceLayout(nodes, edges, options);
      case 'radial':
        return applyRadialLayout(nodes, edges, options);
      default:
        return applyHierarchicalLayout(nodes, edges, options);
    }
  }, [nodes, edges, layout, dimensions.width, dimensions.height]);
}

export default useTopologyLayout;
