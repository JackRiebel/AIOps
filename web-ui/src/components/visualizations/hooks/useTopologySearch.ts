'use client';

import { useMemo, useState, useCallback } from 'react';
import type { TopologyNode, DeviceType, DeviceStatus } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

export interface TopologySearchResult {
  filteredNodes: TopologyNode[];
  matchingIds: Set<string>;
  hasActiveFilters: boolean;
}

export interface UseTopologySearchReturn {
  // State
  searchQuery: string;
  statusFilter: DeviceStatus | 'all';
  typeFilter: DeviceType | 'all';

  // Setters
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: DeviceStatus | 'all') => void;
  setTypeFilter: (type: DeviceType | 'all') => void;
  clearFilters: () => void;

  // Results
  filteredNodes: TopologyNode[];
  matchingIds: Set<string>;
  hasActiveFilters: boolean;
  highlightedNodeId: string | null;
  setHighlightedNodeId: (id: string | null) => void;
}

// ============================================================================
// useTopologySearch Hook
// ============================================================================

export function useTopologySearch(nodes: TopologyNode[]): UseTopologySearchReturn {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DeviceType | 'all'>('all');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setHighlightedNodeId(null);
  }, []);

  // Filter nodes based on search and filters
  const searchResults = useMemo<TopologySearchResult>(() => {
    const query = searchQuery.toLowerCase().trim();
    const hasStatusFilter = statusFilter !== 'all';
    const hasTypeFilter = typeFilter !== 'all';
    const hasSearch = query.length > 0;
    const hasActiveFilters = hasStatusFilter || hasTypeFilter || hasSearch;

    if (!hasActiveFilters) {
      return {
        filteredNodes: nodes,
        matchingIds: new Set(nodes.map((n) => n.id)),
        hasActiveFilters: false,
      };
    }

    const filtered = nodes.filter((node) => {
      // Status filter
      if (hasStatusFilter && node.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (hasTypeFilter && node.type !== typeFilter) {
        return false;
      }

      // Search query
      if (hasSearch) {
        const searchFields = [
          node.name,
          node.serial,
          node.model,
          node.type,
          node.lanIp,
          node.wan1Ip,
          node.mac,
        ]
          .filter(Boolean)
          .map((s) => s!.toLowerCase());

        const matches = searchFields.some((field) => field.includes(query));
        if (!matches) {
          return false;
        }
      }

      return true;
    });

    return {
      filteredNodes: filtered,
      matchingIds: new Set(filtered.map((n) => n.id)),
      hasActiveFilters,
    };
  }, [nodes, searchQuery, statusFilter, typeFilter]);

  return {
    // State
    searchQuery,
    statusFilter,
    typeFilter,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
    clearFilters,

    // Results
    filteredNodes: searchResults.filteredNodes,
    matchingIds: searchResults.matchingIds,
    hasActiveFilters: searchResults.hasActiveFilters,
    highlightedNodeId,
    setHighlightedNodeId,
  };
}

export default useTopologySearch;
