'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CanvasCard, CardSubscription } from '@/types/session';
import { TopicUpdate } from './useWebSocket';

// ============================================================================
// Types
// ============================================================================

export interface LiveCardState {
  liveData: any;
  lastUpdate: Date | null;
  isLive: boolean;
  isSubscribed: boolean;
  updateCount: number;
}

export interface UseLiveCardOptions {
  card: CanvasCard;
  subscribe: (topic: string) => boolean;
  unsubscribe: (topic: string) => boolean;
  lastTopicUpdate: TopicUpdate | null;
  isConnected: boolean;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Named transform functions that can be referenced by cards.
 * These transform incoming WebSocket data into the format the card expects.
 */
const transformFunctions: Record<string, (data: any, existingData: any) => any> = {
  // =========================================================================
  // VLANs - replace with updated list
  // =========================================================================
  'vlans-transform': (data: any, existingData: any) => {
    const vlans = data.vlans || data;
    if (!vlans) return existingData;
    return Array.isArray(vlans) ? vlans : existingData;
  },

  // =========================================================================
  // Firewall Rules - replace with updated list
  // =========================================================================
  'firewall_rules-transform': (data: any, existingData: any) => {
    const rules = data.rules || data;
    if (!rules) return existingData;
    return Array.isArray(rules) ? rules : existingData;
  },

  // =========================================================================
  // SSIDs - replace with updated list
  // =========================================================================
  'ssids-transform': (data: any, existingData: any) => {
    const ssids = data.ssids || data;
    if (!ssids) return existingData;
    return Array.isArray(ssids) ? ssids : existingData;
  },

  // =========================================================================
  // Clients - merge by MAC address, update status
  // =========================================================================
  'clients-transform': (data: any, existingData: any) => {
    const clients = data.clients || data;
    if (!Array.isArray(clients)) return existingData;

    const clientMap = new Map();
    // Add existing first, then overwrite with new
    if (Array.isArray(existingData)) {
      existingData.forEach((c: any) => c.mac && clientMap.set(c.mac, c));
    }
    clients.forEach((c: any) => c.mac && clientMap.set(c.mac, c));

    return Array.from(clientMap.values());
  },

  // =========================================================================
  // Switch Ports - replace with updated list
  // =========================================================================
  'switch_ports-transform': (data: any, existingData: any) => {
    const ports = data.ports || data;
    if (!ports) return existingData;
    return Array.isArray(ports) ? ports : existingData;
  },

  // =========================================================================
  // Devices - merge by serial, update status
  // =========================================================================
  'devices-transform': (data: any, existingData: any) => {
    const devices = data.devices || data;
    if (!Array.isArray(devices)) return existingData;

    const deviceMap = new Map();
    // Add existing first, then overwrite with new
    if (Array.isArray(existingData)) {
      existingData.forEach((d: any) => d.serial && deviceMap.set(d.serial, d));
    }
    devices.forEach((d: any) => d.serial && deviceMap.set(d.serial, d));

    return Array.from(deviceMap.values());
  },

  // =========================================================================
  // RF Analysis - merge AP metrics, keep historical utilization
  // =========================================================================
  'rf-analysis-transform': (data: any, existingData: any) => {
    const accessPoints = data.accessPoints || [];
    const utilization = data.utilization || [];

    if (!Array.isArray(accessPoints)) return existingData;

    // Merge access points by serial
    const apMap = new Map();
    if (existingData?.accessPoints) {
      existingData.accessPoints.forEach((ap: any) => apMap.set(ap.serial, ap));
    }
    accessPoints.forEach((ap: any) => apMap.set(ap.serial, ap));

    return {
      accessPoints: Array.from(apMap.values()),
      networkId: data.networkId || existingData?.networkId,
      networkName: data.networkName || existingData?.networkName,
      utilization: utilization.length > 0 ? utilization : existingData?.utilization,
      recommendations: data.recommendations || existingData?.recommendations,
      lastUpdated: new Date().toISOString(),
    };
  },

  // =========================================================================
  // Health Trend - append to timeseries, limit to last 100 points
  // =========================================================================
  'health-trend-transform': (data: any, existingData: any) => {
    const current = data.current;
    if (!current) return existingData;

    // Append to history
    const existingHistory = existingData?.history || [];
    const newPoint = {
      timestamp: current.timestamp || new Date().toISOString(),
      score: current.score,
      category: current.score >= 80 ? 'good' : current.score >= 60 ? 'warning' : 'critical',
    };

    const history = [...existingHistory, newPoint].slice(-100); // Keep last 100 points

    // Calculate delta from previous point
    const delta = existingHistory.length > 0
      ? current.score - existingHistory[existingHistory.length - 1].score
      : undefined;

    return {
      history,
      current: { ...current, delta },
      thresholds: data.thresholds || existingData?.thresholds || { warning: 80, critical: 60 },
      networkId: data.networkId || existingData?.networkId,
      networkName: data.networkName || existingData?.networkName,
      lastUpdated: new Date().toISOString(),
    };
  },

  // =========================================================================
  // Topology - merge nodes by serial, update connectivity status
  // =========================================================================
  'topology-transform': (data: any, existingData: any) => {
    const nodes = data.nodes || [];
    const links = data.links || [];

    if (!Array.isArray(nodes)) return existingData;

    // Merge nodes by serial
    const nodeMap = new Map();
    if (existingData?.nodes) {
      existingData.nodes.forEach((n: any) => nodeMap.set(n.serial, n));
    }
    nodes.forEach((n: any) => {
      const existing = nodeMap.get(n.serial);
      nodeMap.set(n.serial, {
        ...existing,
        ...n,
        // Track if status changed
        statusChanged: existing && existing.status !== n.status,
        previousStatus: existing?.status,
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: links.length > 0 ? links : existingData?.links || [],
      networkId: data.networkId || existingData?.networkId,
      lastUpdated: new Date().toISOString(),
    };
  },

  // =========================================================================
  // Path Analysis - update hops and status
  // =========================================================================
  'path-analysis-transform': (data: any, existingData: any) => {
    return {
      source: data.source || existingData?.source,
      destination: data.destination || existingData?.destination,
      hops: data.hops || existingData?.hops || [],
      overallStatus: data.overallStatus || existingData?.overallStatus,
      totalLatency: data.totalLatency ?? existingData?.totalLatency,
      issues: data.issues || existingData?.issues || [],
      lastUpdated: new Date().toISOString(),
    };
  },

  // =========================================================================
  // Comparison - update with new metrics
  // =========================================================================
  'comparison-transform': (data: any, existingData: any) => {
    return {
      before: existingData?.before || data.before,
      after: data.after || existingData?.after,
      changes: data.changes || existingData?.changes || [],
      summary: data.summary || existingData?.summary,
      lastUpdated: new Date().toISOString(),
    };
  },

  // =========================================================================
  // Default - simple replace
  // =========================================================================
  'default-transform': (data: any, existingData: any) => {
    return data || existingData;
  },

  // =========================================================================
  // Legacy transforms (for backwards compatibility)
  // =========================================================================

  // Meraki device status - merge new statuses with existing
  'meraki-devices': (data: any, existingData: any) => {
    if (!data.devices) return existingData;

    // If we have a full device list, replace entirely
    if (Array.isArray(data.devices) && data.devices.length > 0) {
      return {
        ...existingData,
        devices: data.devices,
        summary: data.summary || existingData?.summary,
        lastUpdated: new Date().toISOString(),
      };
    }

    return existingData;
  },

  // Meraki alerts - prepend new alerts to existing list
  'meraki-alerts': (data: any, existingData: any) => {
    const existingAlerts = existingData?.alerts || [];
    const newAlerts = data.alerts || [];

    // Merge and dedupe by alert ID
    const alertMap = new Map();
    [...newAlerts, ...existingAlerts].forEach((alert: any) => {
      if (alert.id && !alertMap.has(alert.id)) {
        alertMap.set(alert.id, alert);
      }
    });

    return {
      ...existingData,
      alerts: Array.from(alertMap.values()).slice(0, 50), // Keep last 50
      count: data.count || alertMap.size,
      lastUpdated: new Date().toISOString(),
    };
  },

  // ThousandEyes alerts
  'thousandeyes-alerts': (data: any, existingData: any) => {
    const existingAlerts = existingData?.alerts || [];
    const newAlerts = data.alerts || [];

    // Merge alerts
    const alertMap = new Map();
    [...newAlerts, ...existingAlerts].forEach((alert: any) => {
      const key = alert.event_id || alert.alertId || JSON.stringify(alert);
      if (!alertMap.has(key)) {
        alertMap.set(key, alert);
      }
    });

    return {
      ...existingData,
      alerts: Array.from(alertMap.values()).slice(0, 50),
      count: alertMap.size,
      lastUpdated: new Date().toISOString(),
    };
  },

  // Splunk events
  'splunk-events': (data: any, existingData: any) => {
    const existingEvents = existingData?.events || [];
    const newEvents = data.events || data.results || [];

    // Merge events
    const eventMap = new Map();
    [...newEvents, ...existingEvents].forEach((event: any) => {
      const key = event.search_id || event._cd || JSON.stringify(event);
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    });

    return {
      ...existingData,
      events: Array.from(eventMap.values()).slice(0, 50),
      count: eventMap.size,
      lastUpdated: new Date().toISOString(),
    };
  },

  // Health metrics - update with latest values
  'health-metrics': (data: any, existingData: any) => {
    return {
      ...existingData,
      ...data,
      lastUpdated: new Date().toISOString(),
    };
  },

  // Default - replace data entirely
  'default': (data: any, _existingData: any) => {
    return {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
  },
};

/**
 * Get the appropriate transform function for a subscription
 */
function getTransformFunction(subscription?: CardSubscription): (data: any, existingData: any) => any {
  if (!subscription) return transformFunctions['default'];

  // Use named transform if specified (e.g., "vlans-transform", "firewall_rules-transform")
  if (subscription.transformFn && transformFunctions[subscription.transformFn]) {
    return transformFunctions[subscription.transformFn];
  }

  // Infer from topic pattern (e.g., "meraki:vlans:N_123")
  const topic = subscription.topic;

  // New data type patterns
  if (topic.includes(':vlans:')) {
    return transformFunctions['vlans-transform'];
  }
  if (topic.includes(':firewall_rules:')) {
    return transformFunctions['firewall_rules-transform'];
  }
  if (topic.includes(':ssids:')) {
    return transformFunctions['ssids-transform'];
  }
  if (topic.includes(':clients:')) {
    return transformFunctions['clients-transform'];
  }
  if (topic.includes(':switch_ports:')) {
    return transformFunctions['switch_ports-transform'];
  }
  if (topic.includes(':devices:')) {
    return transformFunctions['devices-transform'];
  }

  // New Phase 2 card type patterns
  if (topic.includes(':rf:')) {
    return transformFunctions['rf-analysis-transform'];
  }
  if (topic.includes(':health:') && !topic.startsWith('health:')) {
    return transformFunctions['health-trend-transform'];
  }
  if (topic.includes(':topology:')) {
    return transformFunctions['topology-transform'];
  }
  if (topic.includes(':path:') || topic.includes(':path_analysis:')) {
    return transformFunctions['path-analysis-transform'];
  }
  if (topic.includes(':comparison:') || topic.includes(':config_diff:')) {
    return transformFunctions['comparison-transform'];
  }

  // Legacy patterns (backwards compatibility)
  if (topic.startsWith('meraki:devices')) {
    return transformFunctions['meraki-devices'];
  }
  if (topic.startsWith('meraki:alerts')) {
    return transformFunctions['meraki-alerts'];
  }
  if (topic.startsWith('thousandeyes:')) {
    return transformFunctions['thousandeyes-alerts'];
  }
  if (topic.startsWith('splunk:')) {
    return transformFunctions['splunk-events'];
  }
  if (topic.startsWith('health:')) {
    return transformFunctions['health-metrics'];
  }

  return transformFunctions['default'];
}

/**
 * Extract data using a simple path (e.g., "data.devices")
 */
function extractByPath(data: any, path?: string): any {
  if (!path) return data;

  const parts = path.split('.');
  let result = data;

  for (const part of parts) {
    if (result === null || result === undefined) return null;
    result = result[part];
  }

  return result;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing live data updates for a canvas card.
 *
 * Automatically subscribes to the card's topic when the card is marked as live,
 * and updates the card data when new updates arrive via WebSocket.
 */
// Default throttle interval in milliseconds (1 update per second)
const DEFAULT_THROTTLE_MS = 1000;

export function useLiveCard({
  card,
  subscribe,
  unsubscribe,
  lastTopicUpdate,
  isConnected,
}: UseLiveCardOptions): LiveCardState {
  const [liveData, setLiveData] = useState<any>(card.data);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  const cardIdRef = useRef(card.id);
  const subscriptionRef = useRef<CardSubscription | undefined>(card.metadata.subscription);

  // Throttling refs - prevents more than 1 update per second
  const lastProcessedTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{ data: any; timestamp: number } | null>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if this card should be live
  const isLive = card.metadata.isLive && !!card.metadata.subscription?.topic;
  const topic = card.metadata.subscription?.topic;

  // Track the actually subscribed topic to ensure proper cleanup
  const subscribedTopicRef = useRef<string | null>(null);

  // Subscribe/unsubscribe when card changes or connection state changes
  useEffect(() => {
    // If not live or no topic, ensure we're unsubscribed
    if (!isLive || !topic) {
      if (subscribedTopicRef.current) {
        unsubscribe(subscribedTopicRef.current);
        subscribedTopicRef.current = null;
      }
      setIsSubscribed(false);
      return;
    }

    // Subscribe when connected
    if (isConnected) {
      // Unsubscribe from old topic if different
      if (subscribedTopicRef.current && subscribedTopicRef.current !== topic) {
        unsubscribe(subscribedTopicRef.current);
        subscribedTopicRef.current = null;
      }

      // Subscribe to new topic
      const success = subscribe(topic);
      if (success) {
        subscribedTopicRef.current = topic;
      }
      setIsSubscribed(success);
    }

    // Cleanup: only unsubscribe from topics we actually subscribed to
    return () => {
      if (subscribedTopicRef.current) {
        unsubscribe(subscribedTopicRef.current);
        subscribedTopicRef.current = null;
        setIsSubscribed(false);
      }
    };
  }, [isLive, topic, isConnected, subscribe, unsubscribe]);

  // Apply update (used by throttling logic)
  const applyUpdate = useCallback((data: any) => {
    const transform = getTransformFunction(subscriptionRef.current);
    setLiveData((prevData: any) => transform(data, prevData));
    setLastUpdate(new Date());
    setUpdateCount((prev) => prev + 1);
    lastProcessedTimeRef.current = Date.now();
  }, []);

  // Process incoming topic updates with throttling
  useEffect(() => {
    if (!lastTopicUpdate) return;
    if (!isLive || !topic) return;

    // Check if this update is for our topic
    if (lastTopicUpdate.topic !== topic) return;

    const extractedData = extractByPath(lastTopicUpdate.data, subscriptionRef.current?.dataPath);
    const now = Date.now();
    const timeSinceLastUpdate = now - lastProcessedTimeRef.current;
    const throttleInterval = card.metadata.refreshInterval || DEFAULT_THROTTLE_MS;

    // If enough time has passed, apply immediately
    if (timeSinceLastUpdate >= throttleInterval) {
      applyUpdate(extractedData);
      pendingUpdateRef.current = null;

      // Clear any pending timeout
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    } else {
      // Store as pending update and schedule delayed application
      pendingUpdateRef.current = { data: extractedData, timestamp: now };

      // Only set a new timeout if one isn't already pending
      if (!throttleTimeoutRef.current) {
        const delay = throttleInterval - timeSinceLastUpdate;
        throttleTimeoutRef.current = setTimeout(() => {
          if (pendingUpdateRef.current) {
            applyUpdate(pendingUpdateRef.current.data);
            pendingUpdateRef.current = null;
          }
          throttleTimeoutRef.current = null;
        }, delay);
      }
    }
  }, [lastTopicUpdate, isLive, topic, applyUpdate, card.metadata.refreshInterval]);

  // Cleanup throttle timeout on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  // Update refs when card changes
  useEffect(() => {
    cardIdRef.current = card.id;
    subscriptionRef.current = card.metadata.subscription;

    // Reset live data if card data changes externally
    if (card.data !== liveData && !lastUpdate) {
      setLiveData(card.data);
    }
  }, [card.id, card.metadata.subscription, card.data]);

  return {
    liveData,
    lastUpdate,
    isLive,
    isSubscribed,
    updateCount,
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to format a relative time string (e.g., "2s ago", "5m ago")
 */
export function useRelativeTime(date: Date | null, updateInterval = 1000): string {
  const [relative, setRelative] = useState('');

  useEffect(() => {
    if (!date) {
      setRelative('');
      return;
    }

    const update = () => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 5) {
        setRelative('just now');
      } else if (diffSec < 60) {
        setRelative(`${diffSec}s ago`);
      } else if (diffSec < 3600) {
        setRelative(`${Math.floor(diffSec / 60)}m ago`);
      } else if (diffSec < 86400) {
        setRelative(`${Math.floor(diffSec / 3600)}h ago`);
      } else {
        setRelative(`${Math.floor(diffSec / 86400)}d ago`);
      }
    };

    update();
    const interval = setInterval(update, updateInterval);
    return () => clearInterval(interval);
  }, [date, updateInterval]);

  return relative;
}

/**
 * Generate a topic string for a card based on its type and context
 */
export function generateCardTopic(
  cardType: string,
  source: string,
  orgId?: string
): string {
  const topicMap: Record<string, string> = {
    'device-table': `${source}:devices`,
    'alert-summary': `${source}:alerts`,
    'network-health': 'health',
    'performance-chart': `${source}:metrics`,
  };

  const baseTopic = topicMap[cardType] || `${source}:events`;

  if (orgId) {
    return `${baseTopic}:${orgId}`;
  }

  return baseTopic;
}
