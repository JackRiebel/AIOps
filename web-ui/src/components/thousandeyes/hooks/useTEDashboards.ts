'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TEDashboard, TEDashboardWidget } from '../types';

export interface UseTEDashboardsReturn {
  mcpAvailable: boolean;
  mcpTools: string[];
  dashboards: TEDashboard[];
  dashboardWidgets: Record<string, TEDashboardWidget[]>;
  loadingDashboards: boolean;
  checkMcpStatus: () => Promise<void>;
  fetchDashboards: () => Promise<void>;
  fetchDashboardWidgets: (dashboardId: string) => Promise<void>;
}

export function useTEDashboards(): UseTEDashboardsReturn {
  const [mcpAvailable, setMcpAvailable] = useState(false);
  const [mcpTools, setMcpTools] = useState<string[]>([]);
  const [dashboards, setDashboards] = useState<TEDashboard[]>([]);
  const [dashboardWidgets, setDashboardWidgets] = useState<Record<string, TEDashboardWidget[]>>({});
  const [loadingDashboards, setLoadingDashboards] = useState(false);

  const checkMcpStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/thousandeyes/mcp/status?organization=default', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return;
      const data = await response.json();
      setMcpAvailable(data.available || false);
      setMcpTools(data.tools || []);
    } catch {
      setMcpAvailable(false);
    }
  }, []);

  const fetchDashboards = useCallback(async () => {
    try {
      setLoadingDashboards(true);
      const response = await fetch('/api/thousandeyes/dashboards?organization=default', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return;
      const data = await response.json();
      setDashboards(data.dashboards || []);
    } catch {
      // Dashboards not available
    } finally {
      setLoadingDashboards(false);
    }
  }, []);

  const fetchDashboardWidgets = useCallback(async (dashboardId: string) => {
    try {
      const response = await fetch(`/api/thousandeyes/dashboards/${dashboardId}?organization=default`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return;
      const data = await response.json();
      const widgets = data.dashboard?.widgets || data.dashboard?._embedded?.widgets || [];
      setDashboardWidgets(prev => ({ ...prev, [dashboardId]: widgets }));
    } catch {
      // Widget fetch failed
    }
  }, []);

  // Fetch dashboards when MCP becomes available
  useEffect(() => {
    if (mcpAvailable && dashboards.length === 0) {
      fetchDashboards();
    }
  }, [mcpAvailable, dashboards.length, fetchDashboards]);

  return {
    mcpAvailable,
    mcpTools,
    dashboards,
    dashboardWidgets,
    loadingDashboards,
    checkMcpStatus,
    fetchDashboards,
    fetchDashboardWidgets,
  };
}
