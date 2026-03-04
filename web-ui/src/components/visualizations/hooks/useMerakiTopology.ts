'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { TopologyNode, TopologyEdge } from '@/types/visualization';
import { getDeviceType, getDeviceStatus } from '@/types/visualization';

export interface UseMerakiTopologyParams {
  selectedOrg: string;
  selectedNetwork: string;
}

export interface UseMerakiTopologyReturn {
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  topologyLoading: boolean;
  includeClients: boolean;
  setIncludeClients: (include: boolean) => void;
  fetchTopology: () => Promise<void>;
}

export function useMerakiTopology({ selectedOrg, selectedNetwork }: UseMerakiTopologyParams): UseMerakiTopologyReturn {
  const [topologyNodes, setTopologyNodes] = useState<TopologyNode[]>([]);
  const [topologyEdges, setTopologyEdges] = useState<TopologyEdge[]>([]);
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [includeClients, setIncludeClients] = useState(false);

  const fetchTopology = useCallback(async () => {
    if (!selectedOrg || !selectedNetwork) return;
    setTopologyLoading(true);
    try {
      const resp: any = await apiClient.getNetworkTopology(selectedOrg, selectedNetwork, includeClients);

      // Handle nested API response: { topology: { nodes, links } } or flat { nodes, edges }
      let rawNodes: any[] = [];
      if (resp.topology?.nodes) {
        rawNodes = resp.topology.nodes;
      } else if (resp.nodes) {
        rawNodes = resp.nodes;
      } else if (Array.isArray(resp)) {
        rawNodes = resp;
      }

      const typedNodes: TopologyNode[] = rawNodes.map((n: any) => ({
        id: n.derivedId || n.id || n.serial || n.mac || `node-${Math.random()}`,
        serial: n.serial || n.device?.serial || '',
        name: n.name || n.device?.name || n.description || '',
        model: n.model || n.device?.model || '',
        type: getDeviceType(n.model || n.device?.model || ''),
        status: getDeviceStatus(n.status || n.device?.status),
        networkId: n.networkId || '',
        networkName: n.networkName || '',
        lat: n.lat,
        lng: n.lng,
        lanIp: n.lanIp || n.device?.lanIp,
        wan1Ip: n.wan1Ip || n.device?.wan1Ip,
        mac: n.mac || n.device?.mac,
        firmware: n.firmware || n.device?.firmware,
        isClient: n.isClient || false,
        manufacturer: n.manufacturer,
        os: n.os,
        vlan: n.vlan,
        ssid: n.ssid,
        usage: n.usage,
        connectedDeviceSerial: n.connectedDeviceSerial,
        connectedDeviceName: n.connectedDeviceName,
        recentDeviceName: n.recentDeviceName,
      }));

      // Handle nested links: { topology: { links } } or flat { links, edges }
      let rawLinks: any[] = [];
      if (resp.topology?.links) {
        rawLinks = resp.topology.links;
      } else if (resp.links) {
        rawLinks = resp.links;
      } else if (resp.edges) {
        rawLinks = resp.edges;
      }

      const nodeIds = new Set(typedNodes.map(n => n.id));

      // Build derivedId → node ID lookup so edges using derivedId values
      // can resolve to actual node IDs (serials) present in nodeIds
      const derivedIdToNodeId = new Map<string, string>();
      for (const n of rawNodes) {
        const nodeId = n.derivedId || n.id || n.serial || n.mac;
        const serial = n.serial || n.device?.serial;
        if (serial && nodeId !== serial && nodeIds.has(serial)) {
          derivedIdToNodeId.set(nodeId, serial);
        }
        // Also map mac → serial if present
        const mac = n.mac || n.device?.mac;
        if (mac && serial && mac !== serial && nodeIds.has(serial)) {
          derivedIdToNodeId.set(mac, serial);
        }
      }

      const typedEdges: TopologyEdge[] = [];

      for (const link of rawLinks) {
        let sourceId: string | undefined;
        let targetId: string | undefined;
        let portFrom: string | undefined;
        let portTo: string | undefined;

        // Handle Meraki link.ends[] array format
        if (link.ends && Array.isArray(link.ends) && link.ends.length >= 2) {
          const end0 = link.ends[0];
          const end1 = link.ends[1];
          sourceId = end0.node?.derivedId || end0.device?.serial || end0.node?.mac;
          targetId = end1.node?.derivedId || end1.device?.serial || end1.node?.mac;
          portFrom = end0.discovered?.lldp?.portId || end0.discovered?.cdp?.portId;
          portTo = end1.discovered?.lldp?.portId || end1.discovered?.cdp?.portId;
        } else {
          if (typeof link.source === 'string') {
            sourceId = link.source;
          } else {
            sourceId = link.source?.derivedId || link.source?.serial || link.source?.mac || link.sourceSerial;
          }
          if (typeof link.target === 'string') {
            targetId = link.target;
          } else {
            targetId = link.target?.derivedId || link.target?.serial || link.target?.mac || link.targetSerial;
          }
          portFrom = link.portFrom || link.sourcePort;
          portTo = link.portTo || link.targetPort;
        }

        if (!sourceId || !targetId) continue;

        // Resolve derivedId/mac values to actual node IDs
        const resolvedSource = derivedIdToNodeId.get(sourceId) || sourceId;
        const resolvedTarget = derivedIdToNodeId.get(targetId) || targetId;

        if (!nodeIds.has(resolvedSource) || !nodeIds.has(resolvedTarget)) {
          continue;
        }

        sourceId = resolvedSource;
        targetId = resolvedTarget;

        typedEdges.push({
          source: sourceId,
          target: targetId,
          type: (['ethernet', 'wireless', 'vpn', 'stack'].includes(link.type) ? link.type : 'ethernet') as TopologyEdge['type'],
          speed: link.speed,
          portFrom,
          portTo,
        });
      }

      setTopologyNodes(typedNodes);
      setTopologyEdges(typedEdges);
    } catch (err) {
      console.error('Failed to fetch topology:', err);
    } finally {
      setTopologyLoading(false);
    }
  }, [selectedOrg, selectedNetwork, includeClients]);

  // Auto-fetch topology when network changes
  useEffect(() => {
    if (selectedNetwork) {
      fetchTopology();
    }
  }, [selectedNetwork, fetchTopology]);

  return {
    topologyNodes,
    topologyEdges,
    topologyLoading,
    includeClients,
    setIncludeClients,
    fetchTopology,
  };
}
