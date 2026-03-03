'use client';

import { useState, useCallback, useRef } from 'react';
import { isEnabled } from '../types';
import type {
  Test,
  Alert,
  Agent,
  TEEvent,
  Outage,
} from '../types';

export interface UseTECoreFetchReturn {
  tests: Test[];
  alerts: Alert[];
  agents: Agent[];
  events: TEEvent[];
  outages: Outage[];
  endpointAgents: any[];
  loadingTests: boolean;
  loadingAlerts: boolean;
  loadingAgents: boolean;
  loadingEvents: boolean;
  loadingOutages: boolean;
  loadingEndpoints: boolean;
  isConfigured: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  fetchTests: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchEvents: () => Promise<void>;
  fetchOutages: () => Promise<void>;
  fetchEndpointAgents: () => Promise<void>;
  fetchAgentTypeFilter: () => Promise<void>;
}

export function useTECoreFetch(): UseTECoreFetchReturn {
  const [tests, setTests] = useState<Test[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<TEEvent[]>([]);
  const [outages, setOutages] = useState<Outage[]>([]);
  const [endpointAgents, setEndpointAgents] = useState<any[]>([]);

  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingOutages, setLoadingOutages] = useState(false);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);

  const [isConfigured, setIsConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const agentTypeFilterRef = useRef<string>('all');

  const fetchResource = useCallback(async <T>(
    url: string,
    setData: (data: T) => void,
    setLoading: (v: boolean) => void,
    extract: (data: any) => T,
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      setLoading(true);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
      });
      if (response.status === 503) {
        setIsConfigured(false);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setData(extract(data));
      setIsConfigured(true);
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  const hal = (key: string) => (d: any) => d?._embedded?.[key] || d?.[key] || [];

  const fetchTests = useCallback(() =>
    fetchResource('/api/thousandeyes/tests?organization=default', setTests, setLoadingTests, hal('tests')),
  [fetchResource]);

  const fetchAlerts = useCallback(() =>
    fetchResource('/api/thousandeyes/alerts?organization=default&active_only=true', setAlerts, setLoadingAlerts, hal('alerts')),
  [fetchResource]);

  const fetchAgentTypeFilter = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config/thousandeyes_agent_types', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const val = data?.current_value || data?.value || 'all';
        if (val && val !== 'all') {
          agentTypeFilterRef.current = val;
        }
      }
    } catch {
      // Silently use default 'all'
    }
  }, []);

  const fetchAgents = useCallback(() => {
    const filter = agentTypeFilterRef.current;
    const selectedTypes = filter.split(',').map(s => s.trim()).filter(Boolean);
    const isAll = selectedTypes.length === 0 || selectedTypes.includes('all');
    const apiTypes = selectedTypes.filter(t => ['cloud', 'enterprise', 'enterprise-cluster'].includes(t));
    const typeParam = !isAll && apiTypes.length > 0 ? `&agent_types=${apiTypes.join(',')}` : '';

    const clientFilter = (agents: any[]) => {
      if (isAll) return agents;
      return agents.filter((a: any) => {
        const type = (a.agentType || '').toLowerCase().replace(/\s+/g, '-');
        return selectedTypes.some(t => type.includes(t.toLowerCase()));
      });
    };

    return fetchResource(
      `/api/thousandeyes/agents?organization=default${typeParam}`,
      (data: Agent[]) => setAgents(clientFilter(data)),
      setLoadingAgents,
      hal('agents'),
    );
  }, [fetchResource]);

  const fetchEvents = useCallback(() =>
    fetchResource('/api/thousandeyes/events?organization=default', setEvents, setLoadingEvents, hal('events')),
  [fetchResource]);

  const fetchOutages = useCallback(() =>
    fetchResource('/api/thousandeyes/outages?organization=default', setOutages, setLoadingOutages, hal('outages')),
  [fetchResource]);

  const fetchEndpointAgents = useCallback(() =>
    fetchResource('/api/thousandeyes/endpoint-agents?organization=default', setEndpointAgents, setLoadingEndpoints,
      d => d?._embedded?.agents || d?._embedded?.endpointAgents || d?.agents || d?.endpointAgents || []),
  [fetchResource]);

  return {
    tests, alerts, agents, events, outages, endpointAgents,
    loadingTests, loadingAlerts, loadingAgents, loadingEvents, loadingOutages, loadingEndpoints,
    isConfigured, error, setError,
    fetchTests, fetchAlerts, fetchAgents, fetchEvents, fetchOutages, fetchEndpointAgents, fetchAgentTypeFilter,
  };
}
