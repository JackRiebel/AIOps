'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';

// Store original fetch for patching
const originalFetch = typeof window !== 'undefined' ? window.fetch : null;

// Friendly page name mapping
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home Dashboard',
  '/chat-v2': 'AI Chat',
  '/splunk': 'Splunk Dashboard',
  '/thousandeyes': 'ThousandEyes Monitoring',
  '/meraki': 'Meraki Dashboard',
  '/catalyst': 'Catalyst Center',
  '/incidents': 'Incidents',
  '/admin': 'Administration',
  '/card-test': 'Card Testing',
  '/settings': 'Settings',
};

function getPageName(path: string): string {
  // Exact match first
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  // Check prefix matches for nested routes
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 1) {
    const basePath = '/' + segments[0];
    if (PAGE_NAMES[basePath]) return PAGE_NAMES[basePath];
  }
  // Fallback: capitalize the path
  return path.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Home';
}

// Model pricing type
interface ModelPricing {
  input: number;
  output: number;
}

interface AISession {
  id: number;
  name: string;
  status: string;
  started_at: string;
  ended_at?: string;
  last_activity_at: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  total_events: number;
  ai_query_count: number;
  api_call_count: number;
  navigation_count: number;
  click_count: number;
  edit_action_count: number;
  error_count: number;
  ai_summary?: any;
  // ROI fields (from backend after completion)
  time_saved_minutes?: number;
  roi_percentage?: number;
  manual_cost_estimate_usd?: number;
  session_type?: string;
  efficiency_score?: number;
  cost_breakdown?: Record<string, number>;
}

// Real-time metrics tracked during active session
interface RealTimeMetrics {
  cost: number;              // Running total cost (USD)
  costByType: {
    aiQueries: number;
    apiCalls: number;
    enrichment: number;
  };
  queryCount: number;
  lastQueryCost: number;     // Most recent query cost
  avgQueryCost: number;      // Average query cost
  responseTimesMs: number[]; // Track response times for avg calculation
  avgResponseTimeMs: number;
  slowestQueryMs: number;
  duration: number;          // Session duration in seconds
  costPerMinute: number;     // Current burn rate
}

interface SessionEvent {
  event_type: string;
  event_data: Record<string, any>;
  input_tokens?: number;
  output_tokens?: number;
  model?: string;
  api_endpoint?: string;
  api_method?: string;
  api_status?: number;
  api_duration_ms?: number;
  page_path?: string;
  element_id?: string;
  element_type?: string;
  // ROI tracking fields
  duration_ms?: number;       // How long this operation took
  action_type?: string;       // Maps to ROI_BASELINES keys
  cost_usd?: number;          // Calculated cost for this event
}

interface AISessionContextType {
  session: AISession | null;
  isActive: boolean;
  isLoading: boolean;
  // Real-time metrics during active session
  realTimeMetrics: RealTimeMetrics | null;
  startSession: (name?: string) => Promise<void>;
  stopSession: () => Promise<AISession | null>;
  logEvent: (event: SessionEvent) => void;
  logAIQuery: (query: string, response: string, model: string, inputTokens: number, outputTokens: number, metadata?: {
    chatSessionId?: string;
    toolsUsed?: string[];
    durationMs?: number;
    agentsConsulted?: string[];
    costUsd?: number;
  }) => void;
  logAPICall: (endpoint: string, method: string, status: number, durationMs: number) => void;
  logNavigation: (path: string) => void;
  logClick: (elementId: string, elementType: string, data?: Record<string, any>) => void;
  logEditAction: (action: string, data: Record<string, any>) => void;
  logError: (error: string, data?: Record<string, any>) => void;
  logCardInteraction: (action: 'view' | 'expand' | 'collapse' | 'refresh' | 'click', cardType: string, cardTitle?: string, data?: Record<string, any>) => void;
  completedSession: AISession | null;
  clearCompletedSession: () => void;
}

const AISessionContext = createContext<AISessionContextType | undefined>(undefined);

// Batch events for efficiency
const EVENT_BATCH_SIZE = 10;
const EVENT_BATCH_INTERVAL = 5000; // 5 seconds

// Default fallback pricing (used before API response or on error)
const DEFAULT_PRICING: ModelPricing = { input: 0.80, output: 4.00 };
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';

// Pricing cache - populated from API
let pricingCache: Record<string, ModelPricing> = {};
let pricingLoaded = false;

// Fetch pricing from API (called once on init)
async function fetchModelPricing(): Promise<Record<string, ModelPricing>> {
  if (pricingLoaded && Object.keys(pricingCache).length > 0) {
    return pricingCache;
  }

  try {
    const response = await fetch('/api/config/model-pricing', {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      pricingCache = data.pricing || {};
      pricingLoaded = true;
      console.log('Loaded model pricing from API:', Object.keys(pricingCache).length, 'models');
      return pricingCache;
    }
  } catch (err) {
    console.warn('Failed to fetch model pricing, using defaults:', err);
  }

  return pricingCache;
}

// Calculate cost for a query using cached pricing
function calculateQueryCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = pricingCache[model] || pricingCache[DEFAULT_MODEL] || DEFAULT_PRICING;
  const inputCost = (pricing.input * inputTokens) / 1_000_000;
  const outputCost = (pricing.output * outputTokens) / 1_000_000;
  return inputCost + outputCost;
}

// Initial real-time metrics
function createInitialMetrics(): RealTimeMetrics {
  return {
    cost: 0,
    costByType: { aiQueries: 0, apiCalls: 0, enrichment: 0 },
    queryCount: 0,
    lastQueryCost: 0,
    avgQueryCost: 0,
    responseTimesMs: [],
    avgResponseTimeMs: 0,
    slowestQueryMs: 0,
    duration: 0,
    costPerMinute: 0,
  };
}

export function AISessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [session, setSession] = useState<AISession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedSession, setCompletedSession] = useState<AISession | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);

  // Event batching
  const eventQueue = useRef<SessionEvent[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Time-on-page tracking
  const lastPageRef = useRef<{ path: string; enteredAt: number } | null>(null);

  // Stable ref for queueEvent callback (prevents fetch patch effect from re-running)
  const queueEventRef = useRef<((event: SessionEvent) => void) | null>(null);

  // Flush event batch
  const flushEvents = useCallback(async () => {
    if (eventQueue.current.length === 0 || !session) return;

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch('/api/ai-sessions/batch-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(events),
      });
    } catch (err) {
      console.error('Failed to log events:', err);
      // Put events back in queue
      eventQueue.current = [...events, ...eventQueue.current];
    }
  }, [session]);

  // Queue an event
  const queueEvent = useCallback((event: SessionEvent) => {
    if (!session) return;

    eventQueue.current.push(event);

    // Flush if batch size reached
    if (eventQueue.current.length >= EVENT_BATCH_SIZE) {
      flushEvents();
    }

    // Reset batch timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    batchTimerRef.current = setTimeout(flushEvents, EVENT_BATCH_INTERVAL);
  }, [session, flushEvents]);

  // Keep the ref updated with the latest queueEvent callback
  // This allows fetch patching to use a stable ref while getting the latest callback
  useEffect(() => {
    queueEventRef.current = queueEvent;
  }, [queueEvent]);

  // Fetch model pricing on mount (before session check)
  useEffect(() => {
    fetchModelPricing();
  }, []);

  // Check for existing active session on mount
  useEffect(() => {
    const checkActiveSession = async () => {
      console.log('Checking for active AI session, user:', user?.username);
      if (!user) {
        console.log('No user, skipping active session check');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Fetching active AI session...');
        const response = await fetch('/api/ai-sessions/active', {
          credentials: 'include',
        });
        console.log('Active session check response:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Active session data:', data);
          if (data.active && data.session) {
            setSession(data.session);
            // Store in localStorage for resilience
            localStorage.setItem('ai_session_id', data.session.id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to check active session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkActiveSession();
  }, [user]);

  // Track navigation changes with friendly names and time-on-page
  useEffect(() => {
    if (session && pathname) {
      const now = Date.now();
      const pageName = getPageName(pathname);

      // Log time spent on the previous page
      if (lastPageRef.current && lastPageRef.current.path !== pathname) {
        const timeOnPageMs = now - lastPageRef.current.enteredAt;
        if (timeOnPageMs > 500) { // Only log if they spent meaningful time
          queueEvent({
            event_type: 'page_exit',
            event_data: {
              path: lastPageRef.current.path,
              page_name: getPageName(lastPageRef.current.path),
              time_on_page_ms: timeOnPageMs,
              time_on_page_seconds: Math.round(timeOnPageMs / 1000),
            },
            page_path: lastPageRef.current.path,
          });
        }
      }

      // Log the new navigation
      lastPageRef.current = { path: pathname, enteredAt: now };
      queueEvent({
        event_type: 'navigation',
        event_data: { path: pathname, page_name: pageName },
        page_path: pathname,
      });
    }
  }, [pathname, session, queueEvent]);

  // Flush events on unmount or session end
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      flushEvents();
    };
  }, [flushEvents]);

  // Before unload - try to persist
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session && eventQueue.current.length > 0) {
        // Use sendBeacon for reliable delivery
        navigator.sendBeacon(
          '/api/ai-sessions/batch-events',
          JSON.stringify(eventQueue.current)
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  // Duration timer - updates every second when session is active
  useEffect(() => {
    if (!session?.started_at) {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      return;
    }

    // Initialize metrics when session starts
    if (!realTimeMetrics) {
      setRealTimeMetrics(createInitialMetrics());
    }

    const updateDuration = () => {
      const startTime = new Date(session.started_at).getTime();
      const now = Date.now();
      const durationSeconds = Math.floor((now - startTime) / 1000);

      setRealTimeMetrics(prev => {
        if (!prev) return prev;
        const durationMinutes = durationSeconds / 60;
        return {
          ...prev,
          duration: durationSeconds,
          costPerMinute: durationMinutes > 0 ? prev.cost / durationMinutes : 0,
        };
      });
    };

    // Update immediately
    updateDuration();

    // Then update every second
    durationTimerRef.current = setInterval(updateDuration, 1000);

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [session?.started_at, session?.id]);

  // Global click tracking
  useEffect(() => {
    if (!session) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Find the closest interactive element
      const interactive = target.closest('button, a, [role="button"], [data-track]');
      if (!interactive) return;

      // Get element info
      const elementId = interactive.id ||
        interactive.getAttribute('data-track') ||
        interactive.getAttribute('aria-label') ||
        interactive.textContent?.slice(0, 50) ||
        'unknown';
      const elementType = interactive.tagName.toLowerCase();

      queueEvent({
        event_type: 'click',
        event_data: {
          element_id: elementId,
          element_type: elementType,
          class_name: interactive.className?.slice?.(0, 100),
        },
        element_id: elementId,
        element_type: elementType,
      });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [session, queueEvent]);

  // Track if we've patched fetch to prevent double-patching
  const fetchPatchedRef = useRef(false);

  // API call tracking via fetch patching
  // Uses queueEventRef instead of queueEvent to prevent effect re-runs when queueEvent changes
  useEffect(() => {
    if (!session || !originalFetch) return;

    // Prevent double-patching if effect runs multiple times
    if (fetchPatchedRef.current) {
      return;
    }

    const trackedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';

      // Skip tracking for AI session endpoints to avoid recursion
      if (url.includes('/api/ai-sessions')) {
        return originalFetch(input, init);
      }

      // Only track /api/ calls
      if (!url.includes('/api/')) {
        return originalFetch(input, init);
      }

      const startTime = Date.now();
      try {
        const response = await originalFetch(input, init);
        const durationMs = Date.now() - startTime;

        // Queue the API call event using the ref (stable reference to latest callback)
        queueEventRef.current?.({
          event_type: 'api_call',
          event_data: {
            endpoint: url.split('?')[0], // Remove query params
            method,
            status: response.status,
            duration_ms: durationMs,
          },
          api_endpoint: url.split('?')[0],
          api_method: method,
          api_status: response.status,
          api_duration_ms: durationMs,
        });

        return response;
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Log error API call using the ref
        queueEventRef.current?.({
          event_type: 'api_call',
          event_data: {
            endpoint: url.split('?')[0],
            method,
            status: 0,
            duration_ms: durationMs,
            error: String(error),
          },
          api_endpoint: url.split('?')[0],
          api_method: method,
          api_status: 0,
          api_duration_ms: durationMs,
        });

        throw error;
      }
    };

    // Safely patch window.fetch with error handling
    try {
      window.fetch = trackedFetch as typeof fetch;
      fetchPatchedRef.current = true;
    } catch (error) {
      // If patching fails, log but don't crash - just skip API tracking
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AISession] Failed to patch fetch for API tracking:', error);
      }
      return;
    }

    return () => {
      // Restore original fetch on cleanup - always try to restore
      try {
        if (fetchPatchedRef.current && originalFetch) {
          window.fetch = originalFetch;
          fetchPatchedRef.current = false;
        }
      } catch (error) {
        // If restoration fails, log but don't crash
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AISession] Failed to restore original fetch:', error);
        }
      }
    };
  }, [session]); // Removed queueEvent dependency - using queueEventRef instead

  const startSession = useCallback(async (name?: string) => {
    if (!user) {
      console.error('Cannot start AI session: user not authenticated');
      return;
    }

    try {
      console.log('Starting AI session...');
      const response = await fetch('/api/ai-sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      console.log('AI session start response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('AI session started:', data);
        setSession({
          ...data,
          total_input_tokens: 0,
          total_output_tokens: 0,
          total_tokens: 0,
          total_cost_usd: 0,
          total_events: 0,
          ai_query_count: 0,
          api_call_count: 0,
          navigation_count: 0,
          click_count: 0,
          edit_action_count: 0,
          error_count: 0,
        });
        localStorage.setItem('ai_session_id', data.id.toString());

        // Initialize real-time metrics
        setRealTimeMetrics(createInitialMetrics());

        // Log initial navigation with friendly name
        if (pathname) {
          lastPageRef.current = { path: pathname, enteredAt: Date.now() };
          queueEvent({
            event_type: 'navigation',
            event_data: { path: pathname, page_name: getPageName(pathname), initial: true },
            page_path: pathname,
          });
        }
      } else {
        const errorData = await response.text();
        console.error('Failed to start AI session:', response.status, errorData);
      }
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }, [user, pathname, queueEvent]);

  const stopSession = useCallback(async (): Promise<AISession | null> => {
    if (!session) return null;

    // Log time on the final page before stopping
    if (lastPageRef.current) {
      const timeOnPageMs = Date.now() - lastPageRef.current.enteredAt;
      if (timeOnPageMs > 500) {
        queueEvent({
          event_type: 'page_exit',
          event_data: {
            path: lastPageRef.current.path,
            page_name: getPageName(lastPageRef.current.path),
            time_on_page_ms: timeOnPageMs,
            time_on_page_seconds: Math.round(timeOnPageMs / 1000),
          },
          page_path: lastPageRef.current.path,
        });
      }
      lastPageRef.current = null;
    }

    // Flush remaining events
    await flushEvents();

    try {
      const response = await fetch(`/api/ai-sessions/stop/${session.id}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const completedData = await response.json();
        setCompletedSession(completedData);
        setSession(null);
        setRealTimeMetrics(null); // Clear real-time metrics
        localStorage.removeItem('ai_session_id');

        // Clear duration timer
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }

        return completedData;
      }
    } catch (err) {
      console.error('Failed to stop session:', err);
    }

    return null;
  }, [session, flushEvents]);

  const logEvent = useCallback((event: SessionEvent) => {
    queueEvent(event);
  }, [queueEvent]);

  const logAIQuery = useCallback((
    query: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: {
      chatSessionId?: string;
      toolsUsed?: string[];
      durationMs?: number;
      agentsConsulted?: string[];
      costUsd?: number;
    }
  ) => {
    // Calculate cost for this query
    const queryCost = metadata?.costUsd ?? calculateQueryCost(model, inputTokens, outputTokens);
    const durationMs = metadata?.durationMs ?? 0;

    // Update real-time metrics
    setRealTimeMetrics(prev => {
      if (!prev) return prev;

      const newQueryCount = prev.queryCount + 1;
      const newCost = prev.cost + queryCost;
      const newResponseTimes = durationMs > 0 ? [...prev.responseTimesMs, durationMs] : prev.responseTimesMs;
      const avgResponseTime = newResponseTimes.length > 0
        ? Math.round(newResponseTimes.reduce((a, b) => a + b, 0) / newResponseTimes.length)
        : 0;

      return {
        ...prev,
        cost: newCost,
        costByType: {
          ...prev.costByType,
          aiQueries: prev.costByType.aiQueries + queryCost,
        },
        queryCount: newQueryCount,
        lastQueryCost: queryCost,
        avgQueryCost: newCost / newQueryCount,
        responseTimesMs: newResponseTimes.slice(-50), // Keep last 50 for memory
        avgResponseTimeMs: avgResponseTime,
        slowestQueryMs: Math.max(prev.slowestQueryMs, durationMs),
      };
    });

    // Queue the event with ROI tracking fields
    queueEvent({
      event_type: 'ai_query',
      event_data: {
        query: query.substring(0, 2000),
        response: response.substring(0, 3000),
        model,
        cost_usd: queryCost,
        ...(metadata?.chatSessionId && { chat_session_id: metadata.chatSessionId }),
        ...(metadata?.toolsUsed && { tools_used: metadata.toolsUsed }),
        ...(metadata?.durationMs && { duration_ms: metadata.durationMs }),
        ...(metadata?.agentsConsulted && { agents_consulted: metadata.agentsConsulted }),
      },
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model,
      duration_ms: durationMs,
      cost_usd: queryCost,
      action_type: 'troubleshooting_research', // Default, can be refined based on query content
    });
  }, [queueEvent]);

  const logAPICall = useCallback((
    endpoint: string,
    method: string,
    status: number,
    durationMs: number
  ) => {
    queueEvent({
      event_type: 'api_call',
      event_data: { endpoint, method, status, duration_ms: durationMs },
      api_endpoint: endpoint,
      api_method: method,
      api_status: status,
      api_duration_ms: durationMs,
    });
  }, [queueEvent]);

  const logNavigation = useCallback((path: string) => {
    queueEvent({
      event_type: 'navigation',
      event_data: { path, page_name: getPageName(path) },
      page_path: path,
    });
  }, [queueEvent]);

  const logClick = useCallback((
    elementId: string,
    elementType: string,
    data?: Record<string, any>
  ) => {
    queueEvent({
      event_type: 'click',
      event_data: { ...data, element_id: elementId, element_type: elementType },
      element_id: elementId,
      element_type: elementType,
    });
  }, [queueEvent]);

  const logEditAction = useCallback((action: string, data: Record<string, any>) => {
    queueEvent({
      event_type: 'edit_action',
      event_data: { action, ...data },
    });
  }, [queueEvent]);

  const logError = useCallback((error: string, data?: Record<string, any>) => {
    queueEvent({
      event_type: 'error',
      event_data: { error, ...data },
    });
  }, [queueEvent]);

  const logCardInteraction = useCallback((
    action: 'view' | 'expand' | 'collapse' | 'refresh' | 'click',
    cardType: string,
    cardTitle?: string,
    data?: Record<string, any>
  ) => {
    queueEvent({
      event_type: 'card_interaction',
      event_data: {
        action,
        card_type: cardType,
        ...(cardTitle && { card_title: cardTitle }),
        ...data,
      },
    });
  }, [queueEvent]);

  const clearCompletedSession = useCallback(() => {
    setCompletedSession(null);
  }, []);

  return (
    <AISessionContext.Provider
      value={{
        session,
        isActive: !!session,
        isLoading,
        realTimeMetrics,
        startSession,
        stopSession,
        logEvent,
        logAIQuery,
        logAPICall,
        logNavigation,
        logClick,
        logEditAction,
        logError,
        logCardInteraction,
        completedSession,
        clearCompletedSession,
      }}
    >
      {children}
    </AISessionContext.Provider>
  );
}

export function useAISession() {
  const context = useContext(AISessionContext);
  if (context === undefined) {
    throw new Error('useAISession must be used within an AISessionProvider');
  }
  return context;
}
