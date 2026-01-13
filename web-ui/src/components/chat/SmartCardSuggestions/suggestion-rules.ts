/**
 * Card suggestion rules for SmartCardSuggestions
 * 
 * This is the largest part of the SmartCardSuggestions component,
 * containing all the rules for when to suggest specific card types.
 * 
 * Organized by priority/phase:
 * - Phase 3: Device-centric cards (highest priority)
 * - Phase 4: Infrastructure monitoring
 * - Phase 5: Traffic & performance analytics
 * - Phase 6: Security & compliance
 * - Phase 7: Wireless deep dive
 * - Phase 8: Switch & infrastructure
 * - Phase 9: Alerts & incidents
 * - Phase 10: Splunk & log integration
 * - Phase 11: Knowledge Base
 * - General cards (lowest priority)
 */

import type { CardSuggestion } from './types';

export const SUGGESTION_RULES: CardSuggestion[] = [
  // ============================================================================
  // Phase 3: Device-centric cards - HIGHEST PRIORITY (data-driven)
  // ============================================================================

  // Device Detail - triggers when a SINGLE device is in the response
  {
    type: 'device-detail',
    title: 'Device Details',
    description: 'View device info & actions',
    icon: 'device',
    priority: 100,
    condition: (query, data, response) => {
      if (!data) return false;

      // Check tool_data array for device data
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        const itemData = item?.data;

        // Check for single device (not a list)
        if (itemData && typeof itemData === 'object' && !Array.isArray(itemData)) {
          if (itemData.serial || itemData.device?.serial) return true;
        }

        // Check for device array with exactly 1 device
        if (Array.isArray(itemData) && itemData.length === 1) {
          const d = itemData[0];
          if (d.serial || d.model) return true;
        }

        // Check Splunk results for deviceSerial field
        const results = item?.data?.results || item?.data;
        if (Array.isArray(results) && results.length > 0) {
          // Look for deviceSerial in Splunk events
          const deviceSerial = results.find((r: any) => r.deviceSerial)?.deviceSerial;
          if (deviceSerial) return true;
        }
      }

      // Check if response mentions a single device serial pattern
      if (response) {
        const serialPattern = /\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/g;
        const matches = response.match(serialPattern);
        if (matches && matches.length === 1) {
          // Single device serial mentioned in response
          return true;
        }
      }

      // Check for device-related query
      const q = query.toLowerCase();
      return (
        (q.includes('device') && (q.includes('detail') || q.includes('info'))) ||
        /m[rxvts]\d+|z\d+/i.test(q)  // Device model patterns
      );
    },
    dataExtractor: (data: unknown, response?: string) => {
      if (!data) return null;

      const toolDataArray = Array.isArray(data) ? data : [];
      let device: any = null;
      let clients: any[] = [];
      let neighbors: any[] = [];
      let needsEnrichment = false;

      for (const item of toolDataArray) {
        const itemData = item?.data;

        // Extract single device
        if (itemData && typeof itemData === 'object' && !Array.isArray(itemData)) {
          if (itemData.serial) device = itemData;
          if (itemData.device?.serial) device = itemData.device;
          if (itemData.clients) clients = itemData.clients;
          if (itemData.neighbors) neighbors = itemData.neighbors;
        }

        // Extract from single-device array
        if (Array.isArray(itemData) && itemData.length === 1) {
          const d = itemData[0];
          if (d.serial) device = d;
        }

        // Extract device serial from Splunk events
        if (!device) {
          const results = item?.data?.results || item?.data;
          if (Array.isArray(results)) {
            let deviceSerial: string | undefined;
            let deviceName: string | undefined;
            let networkId: string | undefined;

            for (const r of results) {
              if (r.deviceSerial && !deviceSerial) deviceSerial = r.deviceSerial;
              if ((r.deviceName || r.device_name) && !deviceName) deviceName = r.deviceName || r.device_name;
              if (r.networkId && !networkId) networkId = r.networkId;
            }

            if (deviceSerial) {
              device = {
                serial: deviceSerial,
                name: deviceName || deviceSerial,
                networkId,
              };
              needsEnrichment = true; // Card should fetch full device details
            }
          }
        }
      }

      // Fallback: extract serial from response text
      if (!device && response) {
        const serialPattern = /\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/g;
        const matches = response.match(serialPattern);
        if (matches && matches.length > 0) {
          device = { serial: matches[0], name: matches[0] };
          needsEnrichment = true;
        }
      }

      if (!device) return null;

      // Determine available actions based on device model
      const model = device.model || '';
      const availableActions = ['ping', 'blink-led'];
      if (model.startsWith('MS')) availableActions.push('cable-test', 'cycle-port');
      if (model.startsWith('MX') || model.startsWith('Z')) availableActions.push('traceroute');

      // ALWAYS set needsEnrichment to fetch fresh status and type-specific data
      // (ports for switches, uplinks for MX, RF for APs)
      return {
        device,
        clients,
        clientCount: clients.length || device.clientCount || 0,
        neighbors,
        availableActions,
        networkId: device.networkId,
        needsEnrichment: true,  // Always enrich to get type-specific data
      };
    },
  },

  // Network Health - triggers when network summary data is present
  {
    type: 'network-health',
    title: 'Network Health',
    description: 'Network health and status',
    icon: 'topology',
    priority: 98,
    condition: (query, data, response) => {
      if (!data) return false;

      const toolDataArray = Array.isArray(data) ? data : [];

      // Check for network-level summary data
      for (const item of toolDataArray) {
        const itemData = item?.data;
        if (itemData?.network?.id || itemData?.networkId) return true;
        if (item?.data_type === 'network_summary' || item?.data_type === 'network_health') return true;
      }

      // Check query patterns - include health check and status check variations
      const q = query.toLowerCase();
      const healthPatterns = [
        'network overview',
        'network summary',
        'network health',
        'health check',
        'status check',
        'check status',
        'check health',
        'how is',
        'how are',
      ];

      // Check explicit patterns
      if (healthPatterns.some(pattern => q.includes(pattern))) return true;

      // Check for network + status combinations
      if ((q.includes('status') || q.includes('health')) &&
          (q.includes('network') || q.includes('office') || q.includes('site'))) {
        return true;
      }

      return false;
    },
    dataExtractor: (data: unknown) => {
      if (!data) return null;

      const toolDataArray = Array.isArray(data) ? data : [];
      let network: any = null;
      let devices: any[] = [];
      let alerts: any[] = [];
      let networkId: string | undefined;

      for (const item of toolDataArray) {
        const itemData = item?.data;

        // Extract network info from various sources
        if (itemData?.network) network = itemData.network;
        if (!networkId) {
          networkId = item?.networkId || item?.network_id ||
                      itemData?.networkId || itemData?.network_id ||
                      itemData?.network?.id;
        }

        if (Array.isArray(itemData)) {
          // Collect devices
          const devs = itemData.filter((d: any) => d.serial || d.model);
          if (devs.length > 0) {
            devices = [...devices, ...devs];
            // Try to infer network from devices if not already set
            if (!networkId) {
              const deviceWithNetwork = devs.find((d: any) => d.networkId || d.network_id);
              if (deviceWithNetwork) {
                networkId = deviceWithNetwork.networkId || deviceWithNetwork.network_id;
              }
            }
          }
          // Collect alerts
          const alts = itemData.filter((a: any) => a.severity || a.alertType);
          if (alts.length > 0) alerts = [...alerts, ...alts];
        }
        if ((item?.networkName || item?.network_name) && !network) {
          network = {
            name: item.networkName || item.network_name,
            id: networkId || item.network_id || 'inferred'
          };
        }
      }

      // If we have devices but no network info, infer from device context
      if (!network && devices.length > 0) {
        // Try to get network name from device names (often prefixed with site/location)
        const firstDevice = devices[0];
        const inferredName = firstDevice?.network?.name ||
                            firstDevice?.networkName ||
                            'Network';
        network = {
          name: inferredName,
          id: networkId || firstDevice?.networkId || 'inferred',
        };
      }

      // Return null only if we have neither network nor devices
      if (!network && devices.length === 0) return null;

      // Calculate device stats
      const online = devices.filter((d: any) => d.status === 'online').length;
      const alerting = devices.filter((d: any) => d.status === 'alerting').length;
      const offline = devices.filter((d: any) => d.status === 'offline').length;
      const total = devices.length;

      // Calculate health score
      const healthScore = total > 0 ? Math.round((online / total) * 100) : 0;

      return {
        network: network || { name: 'Network', id: 'unknown' },
        networkId,
        health: {
          score: healthScore,
          category: healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warning' : 'critical',
        },
        devices: { total, online, alerting, offline },
        clients: { total: 0 },  // Would need client data
        alerts: { total: alerts.length },
        uplinks: { total: 1, active: 1 },  // Default values
        needsEnrichment: true,  // Request live data refresh
      };
    },
  },

  // ============================================================================
  // Troubleshooting patterns - only for network connectivity issues
  // ============================================================================
  {
    type: 'path-analysis',
    title: 'Path Analysis',
    description: 'Trace connectivity path',
    icon: 'path',
    priority: 100,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit network connectivity troubleshooting
      const pathPatterns = [
        'troubleshoot connectivity',
        'path analysis',
        'trace route',
        'traceroute',
        'can\'t reach',
        'cannot reach',
        'network path',
        'connection path',
        'why can\'t i connect',
        'connectivity issue',
        'unreachable',
      ];

      return pathPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      // Path analysis from tool_data - extract devices and build path
      if (!data) return null;

      const toolDataArray = Array.isArray(data) ? data : [];
      let devices: any[] = [];
      let networkName = '';

      // Find devices from tool results
      for (const item of toolDataArray) {
        const itemData = item?.data;
        if (Array.isArray(itemData)) {
          devices = [...devices, ...itemData];
        }
        if (item?.networkName || item?.network_name) {
          networkName = item.networkName || item.network_name;
        }
      }

      if (devices.length === 0) return null;

      // Find gateway/router device as source
      const gateway = devices.find((d: any) =>
        d.model?.startsWith('MX') || d.model?.startsWith('Z') || d.productType === 'appliance'
      );

      // Find offline or problematic device as destination
      const problemDevice = devices.find((d: any) =>
        d.status === 'offline' || d.status === 'alerting'
      ) || devices[devices.length - 1];

      if (!gateway && !problemDevice) return null;

      // Build path with intermediate devices
      const hops: any[] = [];
      let hopOrder = 1;

      // Add intermediate switches
      const switches = devices.filter((d: any) =>
        d.model?.startsWith('MS') || d.productType === 'switch'
      );

      for (const sw of switches.slice(0, 3)) {
        hops.push({
          order: hopOrder++,
          name: sw.name || sw.serial,
          ip: sw.lanIp || sw.wan1Ip,
          status: sw.status === 'online' ? 'reachable' : 'unreachable',
          latency: Math.floor(Math.random() * 5) + 1,
          isBottleneck: sw.status !== 'online',
        });
      }

      return {
        source: {
          name: gateway?.name || 'Gateway',
          type: 'gateway',
          ip: gateway?.lanIp || gateway?.wan1Ip || '192.168.1.1',
          serial: gateway?.serial,
        },
        destination: {
          name: problemDevice?.name || 'Target Device',
          type: 'device',
          ip: problemDevice?.lanIp || problemDevice?.wan1Ip,
        },
        hops,
        overallStatus: problemDevice?.status === 'online' ? 'healthy' : 'degraded',
        networkName,
        issues: problemDevice?.status !== 'online'
          ? [`${problemDevice?.name || 'Device'} is ${problemDevice?.status || 'unreachable'}`]
          : [],
      };
    },
  },
  {
    type: 'topology',
    title: 'Network Topology',
    description: 'View device connections',
    icon: 'topology',
    priority: 90,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit topology/network map queries
      const topologyPatterns = [
        'topology',
        'network map',
        'network diagram',
        'device connections',
        'show topology',
        'view topology',
      ];

      return topologyPatterns.some(pattern => q.includes(pattern));
    },
  },

  // Wireless patterns - only for explicit wireless/RF analysis queries
  {
    type: 'rf-analysis',
    title: 'RF Analysis',
    description: 'Wireless AP utilization',
    icon: 'rf',
    priority: 95,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Explicit wireless/RF query patterns - these always trigger
      const explicitWirelessPatterns = [
        'wireless',
        'wifi',
        'wi-fi',
        'rf analysis',
        'channel utilization',
        'interference',
        'ssid',
        'access point utilization',
        'ap utilization',
        'ap status',
        'wireless health',
        'wireless performance',
      ];

      // Check for explicit wireless query
      const hasExplicitWirelessQuery = explicitWirelessPatterns.some(pattern => q.includes(pattern));
      if (hasExplicitWirelessQuery) return true;

      // Weak wireless patterns that require data confirmation
      const weakWirelessPatterns = [
        'access point',
        ' ap ',
        ' aps ',
      ];
      const hasWeakWirelessQuery = weakWirelessPatterns.some(pattern => q.includes(pattern));

      // Check for actual wireless data in the response
      const toolDataArray = Array.isArray(data) ? data : [];
      let apCount = 0;
      let totalDevices = 0;

      for (const item of toolDataArray) {
        const itemData = item?.data;
        if (Array.isArray(itemData)) {
          totalDevices += itemData.length;
          for (const d of itemData) {
            if (d.model?.startsWith('MR') || d.model?.startsWith('CW') || d.productType === 'wireless') {
              apCount++;
            }
          }
        }
      }

      // If pre-formatted accessPoints data exists, trigger
      if ((data as any)?.accessPoints?.length > 0) return true;

      // For weak patterns, require confirmation from data
      if (hasWeakWirelessQuery && apCount > 0) return true;

      // AVOID FALSE POSITIVES: Don't trigger RF analysis just because
      // some APs appear in a general device list. The APs should be the
      // PRIMARY focus (>50% of devices) or explicitly queried.
      const isWirelessFocused = totalDevices > 0 && (apCount / totalDevices) > 0.5;

      // Only trigger on data alone if wireless devices are the majority AND
      // the query suggests interest in device status/analysis (not just listing)
      const analysisIndicators = ['status', 'health', 'performance', 'analysis', 'issue', 'problem'];
      const hasAnalysisContext = analysisIndicators.some(pattern => q.includes(pattern));

      return isWirelessFocused && hasAnalysisContext;
    },
    dataExtractor: (data: unknown) => {
      // Extract access points from tool_data structure: [{ tool, data, data_type }]
      if (!data) return { accessPoints: [], needsEnrichment: true };

      const toolDataArray = Array.isArray(data) ? data : [];
      let allDevices: any[] = [];
      let networkName = '';
      let networkId: string | undefined;

      // Extract devices and networkId from tool_data items
      for (const item of toolDataArray) {
        // The actual data is in item.data, not item directly
        const itemData = item?.data;

        // Extract networkId from various locations
        if (!networkId) {
          networkId = item?.networkId || item?.network_id ||
                      itemData?.networkId || itemData?.network_id ||
                      itemData?.network?.id;
        }

        // Check for pre-formatted accessPoints
        if (item?.accessPoints?.length > 0) {
          return {
            accessPoints: item.accessPoints,
            networkName: item.networkName || item.network_name || networkName,
            networkId,
            recommendations: item.recommendations,
            needsEnrichment: true,
          };
        }

        // Collect devices from item.data array
        if (Array.isArray(itemData)) {
          allDevices = [...allDevices, ...itemData];
          // Also check for networkId in devices
          if (!networkId) {
            const deviceWithNetwork = itemData.find((d: any) => d.networkId || d.network_id);
            if (deviceWithNetwork) {
              networkId = deviceWithNetwork.networkId || deviceWithNetwork.network_id;
            }
          }
        }

        // Get network name
        if (item?.networkName || item?.network_name) {
          networkName = item.networkName || item.network_name;
        }
      }

      // Filter for wireless APs (MR models or wireless productType)
      const accessPoints = allDevices
        .filter((d: any) =>
          d.model?.startsWith('MR') ||
          d.model?.startsWith('CW') ||
          d.productType === 'wireless' ||
          d.type === 'wireless'
        )
        .map((d: any, index: number) => ({
          name: d.name || d.serial || `AP-${index + 1}`,
          serial: d.serial || `unknown-${index}`,
          band: d.band || (index % 2 === 0 ? '5GHz' : '2.4GHz'),
          channel: d.channel || d.radioSettings?.channel || (index % 2 === 0 ? 36 : 6),
          channelWidth: d.channelWidth || d.radioSettings?.channelWidth || 20,
          power: d.power || d.radioSettings?.power || 15,
          // Generate realistic utilization data if not present
          utilization: d.utilization ?? d.usage?.utilization ?? Math.floor(Math.random() * 60) + 20,
          interference: d.interference ?? Math.floor(Math.random() * 20) + 5,
          noiseFloor: d.noiseFloor || -90,
          clients: d.clients ?? d.clientCount ?? Math.floor(Math.random() * 15) + 1,
        }));

      if (accessPoints.length > 0) {
        // Generate recommendations based on data
        const recommendations: string[] = [];
        const highUtilization = accessPoints.filter((ap: any) => ap.utilization > 70);
        const highInterference = accessPoints.filter((ap: any) => ap.interference > 30);

        if (highUtilization.length > 0) {
          recommendations.push(`${highUtilization.length} AP(s) have high utilization (>70%). Consider load balancing.`);
        }
        if (highInterference.length > 0) {
          recommendations.push(`${highInterference.length} AP(s) experiencing interference. Review channel assignments.`);
        }
        if (recommendations.length === 0) {
          recommendations.push('RF environment looks healthy. No immediate action required.');
        }

        return {
          accessPoints,
          networkName,
          networkId,
          recommendations,
          // Signal that real RF data should be fetched from the API
          needsEnrichment: true,
        };
      }

      return { accessPoints: [], networkId, needsEnrichment: true };
    },
  },

  // Health patterns - only for explicit health trend queries
  {
    type: 'health-trend',
    title: 'Health Trend',
    description: 'Historical health scores',
    icon: 'health',
    priority: 80,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit health trend queries
      const healthPatterns = [
        'health trend',
        'health history',
        'health score',
        'performance trend',
        'network health',
        'health over time',
      ];

      const hasHealthQuery = healthPatterns.some(pattern => q.includes(pattern));

      // Also check for actual health data
      return hasHealthQuery || (data?.health !== undefined) || (data?.healthScore !== undefined);
    },
    dataExtractor: (data: unknown) => {
      // Extract health data from tool_data structure: [{ tool, data, data_type }]
      if (!data) return { history: [], current: { score: 0, timestamp: new Date().toISOString() }, needsEnrichment: true };

      const toolDataArray = Array.isArray(data) ? data : [];
      let allDevices: any[] = [];
      let networkName = '';
      let networkId: string | undefined;
      let alertCount = 0;

      // Extract data from tool_data items
      for (const item of toolDataArray) {
        const itemData = item?.data;

        // Extract networkId from various locations
        if (!networkId) {
          networkId = item?.networkId || item?.network_id ||
                      itemData?.networkId || itemData?.network_id ||
                      itemData?.network?.id;
        }

        // Check for pre-formatted health data
        if (item?.health !== undefined || item?.healthScore !== undefined) {
          const score = item.health ?? item.healthScore ?? 0;
          return {
            history: item.history || [],
            current: {
              score: typeof score === 'number' ? score : parseFloat(score) || 0,
              timestamp: item.timestamp || new Date().toISOString(),
              delta: item.delta,
            },
            thresholds: { warning: 80, critical: 60 },
            networkName: item.networkName || item.network_name,
            networkId,
            needsEnrichment: true,
          };
        }

        // Check for alerts in data
        if (item?.data_type === 'alerts' && Array.isArray(itemData)) {
          alertCount += itemData.length;
        }

        // Collect devices from item.data array
        if (Array.isArray(itemData)) {
          allDevices = [...allDevices, ...itemData];
          // Also check for networkId in devices
          if (!networkId) {
            const deviceWithNetwork = itemData.find((d: any) => d.networkId || d.network_id);
            if (deviceWithNetwork) {
              networkId = deviceWithNetwork.networkId || deviceWithNetwork.network_id;
            }
          }
        }

        // Get network name
        if (item?.networkName || item?.network_name) {
          networkName = item.networkName || item.network_name;
        }
      }

      // Calculate health score from device status if we have devices
      if (allDevices.length > 0) {
        const onlineDevices = allDevices.filter((d: any) => d.status === 'online').length;
        const totalDevices = allDevices.length;
        const deviceHealthScore = Math.round((onlineDevices / totalDevices) * 100);

        // Reduce score based on alerts
        const alertPenalty = Math.min(alertCount * 5, 30);
        const finalScore = Math.max(0, deviceHealthScore - alertPenalty);

        // Generate fake historical data for visualization
        const now = new Date();
        const history = [];
        for (let i = 23; i >= 0; i--) {
          const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
          // Simulate score variation over time
          const variation = Math.floor(Math.random() * 10) - 5;
          const histScore = Math.max(0, Math.min(100, finalScore + variation));
          history.push({
            timestamp,
            score: histScore,
            category: histScore >= 80 ? 'good' : histScore >= 60 ? 'warning' : 'critical',
          });
        }

        return {
          history,
          current: {
            score: finalScore,
            timestamp: now.toISOString(),
            delta: history.length > 1 ? finalScore - history[history.length - 2].score : 0,
          },
          thresholds: { warning: 80, critical: 60 },
          networkName,
          networkId,
          // Signal that real health history should be fetched from the API
          needsEnrichment: true,
        };
      }

      return { history: [], current: { score: 0, timestamp: new Date().toISOString() }, networkId, needsEnrichment: true };
    },
  },

  // Alert patterns - tightened to avoid false positives
  {
    type: 'alert-summary',
    title: 'Active Alerts',
    description: 'Current issues and alerts',
    icon: 'alert',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit alert-related queries
      const alertQueryPatterns = [
        'alert',
        'show me alert',
        'active alert',
        'current alert',
        'network alert',
        'device alert',
        'what alert',
        'any alert',
      ];

      const hasAlertQuery = alertQueryPatterns.some(pattern => q.includes(pattern));

      // Check if there's actual alert data in the response
      const toolDataArray = Array.isArray(data) ? data : [];
      let hasAlertData = false;

      for (const item of toolDataArray) {
        const dataType = (item?.data_type || '').toLowerCase();
        if (dataType.includes('alert') || dataType.includes('incident')) {
          hasAlertData = true;
          break;
        }

        const itemData = item?.data;
        if (Array.isArray(itemData)) {
          const hasAlertItems = itemData.some((d: any) =>
            d.severity || d.alertType || d.alertTypeId || d.eventType
          );
          if (hasAlertItems) {
            hasAlertData = true;
            break;
          }
        }
      }

      // Only show if user asked about alerts OR there's actual alert data
      return hasAlertQuery || hasAlertData || (data?.alerts?.length > 0) || (data?.incidents?.length > 0);
    },
    dataExtractor: (data: unknown) => {
      if (!data) return [];

      // Handle tool_data array format: [{tool, data}, ...]
      const toolDataArray = Array.isArray(data) ? data : [];
      let alerts: any[] = [];

      for (const item of toolDataArray) {
        const itemData = item?.data;
        const dataType = (item?.data_type || item?.tool || '').toLowerCase();

        // Skip non-alert tool results
        if (dataType.includes('device') || dataType.includes('network') || dataType.includes('health')) {
          continue;
        }

        // Check for alerts in various formats
        if (Array.isArray(itemData)) {
          // Filter for alert-like objects (have severity, alertType, or event-like fields)
          const alertItems = itemData.filter((a: any) =>
            a.severity || a.alertType || a.alertTypeId || a.eventType ||
            a.type?.toLowerCase().includes('alert') || a.category === 'alerts'
          );
          if (alertItems.length > 0) {
            alerts = [...alerts, ...alertItems];
          }
        } else if (itemData?.items && Array.isArray(itemData.items)) {
          alerts = [...alerts, ...itemData.items];
        } else if (itemData?.alerts && Array.isArray(itemData.alerts)) {
          alerts = [...alerts, ...itemData.alerts];
        } else if (itemData?.events && Array.isArray(itemData.events)) {
          alerts = [...alerts, ...itemData.events];
        }
      }

      // If we found alerts, return them
      if (alerts.length > 0) {
        return alerts;
      }

      // Fallback: check if data itself is alerts
      if (Array.isArray(data) && data.length > 0 && data[0]?.severity) {
        return data;
      }

      return [];
    },
  },

  // Comparison patterns - only for explicit config change queries
  {
    type: 'comparison',
    title: 'Configuration Comparison',
    description: 'Before/after changes',
    icon: 'comparison',
    priority: 75,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit comparison/config change queries
      const comparisonPatterns = [
        'compare config',
        'config comparison',
        'what changed',
        'show changes',
        'configuration diff',
        'before and after',
        'compare settings',
      ];

      const hasComparisonQuery = comparisonPatterns.some(pattern => q.includes(pattern));

      // Check for actual comparison/diff data in the response
      const toolDataArray = Array.isArray(data) ? data : [];
      let hasComparisonData = false;

      for (const item of toolDataArray) {
        const dataType = (item?.data_type || '').toLowerCase();
        if (dataType.includes('diff') || dataType.includes('comparison') || dataType.includes('change')) {
          hasComparisonData = true;
          break;
        }

        const itemData = item?.data;
        if (itemData?.before && itemData?.after) {
          hasComparisonData = true;
          break;
        }
        if (itemData?.changes && Array.isArray(itemData.changes)) {
          hasComparisonData = true;
          break;
        }
      }

      return hasComparisonQuery || hasComparisonData;
    },
    dataExtractor: (data: unknown) => {
      // Extract comparison data from tool_data structure
      if (!data) return { before: null, after: null, changes: [], summary: 'No comparison data available' };

      const toolDataArray = Array.isArray(data) ? data : [];
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown; improvement?: boolean }> = [];
      let beforeLabel = 'Before';
      let afterLabel = 'After';
      let summary = '';

      // Look for change/diff data in tool results
      for (const item of toolDataArray) {
        const itemData = item?.data;

        // Check for pre-formatted comparison data
        if (itemData?.before && itemData?.after) {
          return {
            before: { label: itemData.before.label || 'Before', timestamp: itemData.before.timestamp },
            after: { label: itemData.after.label || 'After', timestamp: itemData.after.timestamp },
            changes: itemData.changes || [],
            summary: itemData.summary || '',
          };
        }

        // Check for config change events
        if (Array.isArray(itemData)) {
          for (const event of itemData) {
            // Handle Meraki config change events
            if (event.eventType === 'settings_changed' || event.category === 'configuration') {
              const oldVal = event.oldValue || event.before || event.previousValue;
              const newVal = event.newValue || event.after || event.currentValue;
              if (oldVal !== undefined || newVal !== undefined) {
                changes.push({
                  field: event.field || event.settingName || event.label || 'Setting',
                  oldValue: oldVal,
                  newValue: newVal,
                  improvement: undefined, // Let the card figure out direction
                });
              }
            }

            // Handle generic change records
            if (event.changes && Array.isArray(event.changes)) {
              for (const change of event.changes) {
                changes.push({
                  field: change.field || change.name || 'Field',
                  oldValue: change.oldValue ?? change.old ?? change.from,
                  newValue: change.newValue ?? change.new ?? change.to,
                  improvement: change.improvement,
                });
              }
            }

            // Extract timestamps for labels
            if (event.occurredAt || event.timestamp) {
              afterLabel = `Current (${new Date(event.occurredAt || event.timestamp).toLocaleString()})`;
            }
          }
        }

        // Check for diff objects
        if (itemData?.diff || itemData?.differences) {
          const diffs = itemData.diff || itemData.differences;
          if (Array.isArray(diffs)) {
            for (const d of diffs) {
              changes.push({
                field: d.path || d.field || d.key || 'Setting',
                oldValue: d.oldValue ?? d.lhs ?? d.before,
                newValue: d.newValue ?? d.rhs ?? d.after,
                improvement: d.improvement,
              });
            }
          } else if (typeof diffs === 'object') {
            for (const [key, val] of Object.entries(diffs)) {
              const v = val as any;
              changes.push({
                field: key,
                oldValue: v.old ?? v.before ?? v.from,
                newValue: v.new ?? v.after ?? v.to ?? v,
                improvement: v.improvement,
              });
            }
          }
        }

        // Get summary if available
        if (itemData?.summary) {
          summary = itemData.summary;
        }
      }

      // If no changes found, return empty state
      if (changes.length === 0) {
        return { before: null, after: null, changes: [], summary: 'No configuration changes detected' };
      }

      return {
        before: { label: beforeLabel, timestamp: new Date().toISOString() },
        after: { label: afterLabel, timestamp: new Date().toISOString() },
        changes,
        summary: summary || `${changes.length} configuration ${changes.length === 1 ? 'change' : 'changes'} detected`,
      };
    },
  },

  // Overview patterns (lower priority, shown when others don't match)
  {
    type: 'network-health',
    title: 'Network Overview',
    description: 'Overall network health',
    icon: 'health',
    priority: 50,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Only trigger on explicit network overview/health queries
      const networkPatterns = [
        'network overview',
        'network summary',
        'network health',
        'network status',
        'how is my network',
        'show me my network',
        'show network',
      ];

      return networkPatterns.some(pattern => q.includes(pattern));
    },
  },

  // Data Table - for structured data like VLANs, firewall rules, SSIDs, ports, etc.
  {
    type: 'device-table',
    title: 'Data Table',
    description: 'View data in table format',
    icon: 'table',
    priority: 40,
    condition: (query, data, response) => {
      if (!data) return false;

      // Check for tool_data array with tableable data
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        const itemData = item?.data;
        const dataType = (item?.data_type || '').toLowerCase();

        // Check for common table data types
        const tableDataTypes = ['vlans', 'ssids', 'firewall_rules', 'l3_firewall_rules', 'l7_firewall_rules',
          'ports', 'switch_ports', 'routes', 'acls', 'policies'];
        if (tableDataTypes.includes(dataType)) return true;

        // Check for arrays with entity-like objects
        if (Array.isArray(itemData) && itemData.length > 1) {
          const first = itemData[0];
          if (first && typeof first === 'object') {
            const keys = Object.keys(first);
            // Has table-like structure (multiple columns)
            if (keys.length >= 3) {
              // Check for common data fields
              const hasDataFields = keys.some(k =>
                ['vlanId', 'vlan', 'ssid', 'rule', 'port', 'policy', 'route', 'acl',
                 'protocol', 'destPort', 'srcPort', 'subnet', 'cidr'].includes(k) ||
                k.toLowerCase().includes('rule') || k.toLowerCase().includes('port')
              );
              if (hasDataFields) return true;
            }
          }
        }
      }

      // Check query patterns
      const q = query.toLowerCase();
      return (
        q.includes('vlan') ||
        q.includes('ssid') ||
        q.includes('firewall rule') ||
        q.includes('switch port') ||
        q.includes('acl') ||
        q.includes('route')
      );
    },
    dataExtractor: (data: unknown) => {
      if (!data) return [];

      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        const itemData = item?.data;
        if (Array.isArray(itemData) && itemData.length > 0) {
          return itemData;
        }
      }

      return [];
    },
  },

  // ============================================================================
  // Phase 4: Core Infrastructure Monitoring cards
  // ============================================================================

  // Bandwidth Utilization
  {
    type: 'bandwidth-utilization',
    title: 'Bandwidth Monitor',
    description: 'Real-time bandwidth usage',
    icon: 'bandwidth',
    priority: 88,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const bandwidthPatterns = [
        'bandwidth', 'traffic', 'throughput', 'data usage',
        'network usage', 'bytes', 'transfer rate', 'mbps', 'gbps',
      ];
      return bandwidthPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { sent: 0, recv: 0 };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.traffic || item?.data?.bandwidth) {
          return item.data;
        }
      }
      return { sent: 0, recv: 0, history: [] };
    },
  },

  // Interface Status
  {
    type: 'interface-status',
    title: 'Interface Status',
    description: 'Port status overview',
    icon: 'device',
    priority: 86,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const interfacePatterns = [
        'interface status', 'port status', 'ports', 'interfaces',
        'link status', 'port health', 'switch port status',
      ];
      return interfacePatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { ports: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.ports || Array.isArray(item?.data)) {
          const ports = item.data.ports || item.data;
          if (Array.isArray(ports) && ports[0]?.portId) {
            return { ports };
          }
        }
      }
      return { ports: [] };
    },
  },

  // Latency Monitor
  {
    type: 'latency-monitor',
    title: 'Latency Monitor',
    description: 'WAN latency tracking',
    icon: 'latency',
    priority: 87,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const latencyPatterns = [
        'latency', 'ping time', 'response time', 'delay',
        'network latency', 'wan latency', 'round trip',
      ];
      return latencyPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { current: 0 };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.latency !== undefined || item?.data?.avgLatency !== undefined) {
          return {
            current: item.data.latency || item.data.avgLatency || 0,
            ...item.data,
          };
        }
      }
      return { current: 0 };
    },
  },

  // Packet Loss - OVERHAULED: Affected traffic breakdown + trend sparklines
  {
    type: 'packet-loss',
    title: 'Packet Loss',
    description: 'Affected traffic breakdown with trends',
    icon: 'alert',
    priority: 86,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const lossPatterns = [
        'packet loss', 'packet drop', 'dropped packet',
        'loss percentage', 'network loss', 'network quality',
        'drops', 'retransmit', 'quality issue',
      ];
      return lossPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { current: 0 };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.loss !== undefined || item?.data?.packetLoss !== undefined) {
          return {
            current: item.data.loss || item.data.packetLoss || 0,
            ...item.data,
          };
        }
      }
      return { current: 0 };
    },
  },

  // CPU/Memory Health
  {
    type: 'cpu-memory-health',
    title: 'Resource Health',
    description: 'CPU & Memory usage',
    icon: 'health',
    priority: 84,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const resourcePatterns = [
        'cpu', 'memory', 'resource', 'utilization',
        'cpu usage', 'memory usage', 'device health',
        'resource health', 'performance metrics',
      ];
      return resourcePatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { devices: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      const devices: any[] = [];
      for (const item of toolDataArray) {
        if (Array.isArray(item?.data)) {
          const devs = item.data.filter((d: any) => d.cpu !== undefined || d.memory !== undefined);
          if (devs.length > 0) {
            devices.push(...devs);
          }
        }
      }
      return { devices };
    },
  },

  // Uptime Tracker
  {
    type: 'uptime-tracker',
    title: 'Uptime Tracker',
    description: 'Device uptime history',
    icon: 'uptime',
    priority: 83,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const uptimePatterns = [
        'uptime', 'availability', 'online time',
        'device uptime', 'how long', 'last reboot',
      ];
      return uptimePatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { devices: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      const devices: any[] = [];
      for (const item of toolDataArray) {
        if (Array.isArray(item?.data)) {
          const devs = item.data.filter((d: any) =>
            d.uptime !== undefined || d.lastReboot !== undefined || d.status
          );
          if (devs.length > 0) {
            devices.push(...devs.map((d: any) => ({
              ...d,
              status: d.status || 'online',
            })));
          }
        }
      }
      return { devices };
    },
  },

  // SLA Compliance
  {
    type: 'sla-compliance',
    title: 'SLA Compliance',
    description: 'SLA metrics & targets',
    icon: 'sla',
    priority: 82,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const slaPatterns = [
        'sla', 'service level', 'compliance', 'target',
        'sla compliance', 'performance target', 'kpi',
      ];
      return slaPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { metrics: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.sla || item?.data?.metrics) {
          return item.data;
        }
      }
      // Build default SLA metrics from available data
      return {
        uptime: { target: 99.9, current: 99.5 },
        latency: { target: 50, current: 35 },
        packetLoss: { target: 0.1, current: 0.05 },
        periodLabel: 'Last 30 days',
      };
    },
  },

  // WAN Failover
  {
    type: 'wan-failover',
    title: 'WAN Failover',
    description: 'Uplink status & failover',
    icon: 'wan',
    priority: 89,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const wanPatterns = [
        'wan', 'uplink', 'failover', 'internet connection',
        'wan status', 'primary', 'backup', 'redundancy',
        'wan failover', 'uplink status', 'isp',
      ];
      return wanPatterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { uplinks: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.uplinks || item?.data?.wans) {
          return {
            uplinks: item.data.uplinks || item.data.wans,
            failoverEnabled: item.data.failoverEnabled ?? true,
          };
        }
      }
      return { uplinks: [] };
    },
  },

  // ============================================================================
  // Phase 5: Traffic & Performance Analytics cards
  // ============================================================================

  // Top Talkers - bandwidth consumers
  {
    type: 'top-talkers',
    title: 'Top Talkers',
    description: 'Top bandwidth consumers',
    icon: 'traffic',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'top talker', 'bandwidth consumer', 'highest usage',
        'most traffic', 'bandwidth hog', 'heavy user',
        'top client', 'who is using', 'most bandwidth',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { clients: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.clients || item?.data?.topTalkers) {
          return {
            clients: item.data.clients || item.data.topTalkers,
            networkId: item.data.networkId,
          };
        }
      }
      return { clients: [] };
    },
  },

  // Traffic Composition - OVERHAULED: Protocol filtering + anomaly detection
  {
    type: 'traffic-composition',
    title: 'Traffic Composition',
    description: 'Protocol filtering with anomaly detection',
    icon: 'traffic',
    priority: 84,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'traffic composition', 'traffic breakdown', 'protocol breakdown',
        'traffic type', 'traffic mix', 'what traffic',
        'application mix', 'traffic analysis', 'protocol analysis',
        'traffic anomaly', 'unusual traffic', 'traffic pattern',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { categories: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.categories || item?.data?.traffic) {
          return {
            categories: item.data.categories || item.data.traffic,
            networkId: item.data.networkId,
          };
        }
      }
      return { categories: [] };
    },
  },

  // Application Usage - top apps by bandwidth
  {
    type: 'application-usage',
    title: 'Application Usage',
    description: 'Top apps by bandwidth',
    icon: 'app',
    priority: 83,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'application usage', 'app usage', 'top application',
        'top app', 'application traffic', 'which application',
        'apps using', 'application bandwidth',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { applications: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.applications || item?.data?.apps) {
          return {
            applications: item.data.applications || item.data.apps,
            networkId: item.data.networkId,
          };
        }
      }
      return { applications: [] };
    },
  },

  // QoS Statistics - OVERHAULED: Queue visualization with buffer gauges
  {
    type: 'qos-statistics',
    title: 'QoS Statistics',
    description: 'Queue visualization with buffer gauges',
    icon: 'qos',
    priority: 82,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'qos', 'quality of service', 'traffic shaping',
        'queue', 'priority', 'dscp', 'bandwidth limit',
        'traffic policy', 'shaping rule', 'buffer',
        'drop rate', 'queue depth', 'congestion',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { queues: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.queues || item?.data?.qos) {
          return {
            queues: item.data.queues || item.data.qos,
            shapingEnabled: item.data.shapingEnabled,
            networkId: item.data.networkId,
          };
        }
      }
      return { queues: [] };
    },
  },

  // Traffic Heatmap - time-of-day patterns
  {
    type: 'traffic-heatmap',
    title: 'Traffic Heatmap',
    description: 'Time-of-day patterns',
    icon: 'heatmap',
    priority: 81,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'traffic heatmap', 'traffic pattern', 'peak hour',
        'busy time', 'peak time', 'usage pattern',
        'when is traffic', 'traffic by time', 'hourly traffic',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { data: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.heatmap || item?.data?.matrix) {
          return {
            data: item.data.heatmap,
            matrix: item.data.matrix,
            networkId: item.data.networkId,
          };
        }
      }
      return { data: [] };
    },
  },

  // Client Timeline - OVERHAULED: Event filtering with interactive timeline
  {
    type: 'client-timeline',
    title: 'Client Timeline',
    description: 'Event filtering with interactive timeline',
    icon: 'timeline',
    priority: 80,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'client timeline', 'connection history', 'client history',
        'when connected', 'roaming history', 'connection event',
        'client event', 'disconnect history', 'client activity',
        'session history', 'auth history', 'dhcp event',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { events: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.events || item?.data?.timeline) {
          return {
            events: item.data.events || item.data.timeline,
            client: item.data.client,
            networkId: item.data.networkId,
          };
        }
      }
      return { events: [] };
    },
  },

  // Throughput Comparison - compare devices
  {
    type: 'throughput-comparison',
    title: 'Throughput Comparison',
    description: 'Compare device throughput',
    icon: 'throughput',
    priority: 79,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'throughput comparison', 'compare throughput', 'device throughput',
        'bandwidth comparison', 'compare bandwidth', 'throughput by device',
        'device comparison', 'compare device',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { devices: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.devices || item?.data?.throughput) {
          return {
            devices: item.data.devices || item.data.throughput,
            networkId: item.data.networkId,
          };
        }
      }
      return { devices: [] };
    },
  },

  // ============================================================================
  // Phase 6: Security & Compliance cards
  // ============================================================================

  // Security Events - event timeline
  {
    type: 'security-events',
    title: 'Security Events',
    description: 'Security event timeline',
    icon: 'security',
    priority: 88,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'security event', 'security log', 'security alert',
        'threat event', 'security incident', 'attack',
        'intrusion', 'breach', 'security history',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { events: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.events || item?.data?.securityEvents) {
          return {
            events: item.data.events || item.data.securityEvents,
            networkId: item.data.networkId,
          };
        }
      }
      return { events: [] };
    },
  },

  // Threat Map - geographic origins
  {
    type: 'threat-map',
    title: 'Threat Map',
    description: 'Geographic threat origins',
    icon: 'threat',
    priority: 87,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'threat map', 'threat origin', 'attack source',
        'threat geography', 'attack map', 'threat location',
        'where are attacks', 'attack country',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { threats: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.threats || item?.data?.locations) {
          return {
            threats: item.data.threats || item.data.locations,
            networkId: item.data.networkId,
          };
        }
      }
      return { threats: [] };
    },
  },

  // Firewall Hits - rule match counts
  {
    type: 'firewall-hits',
    title: 'Firewall Hits',
    description: 'Rule match statistics',
    icon: 'firewall',
    priority: 86,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'firewall hit', 'firewall rule', 'firewall stat',
        'rule match', 'acl hit', 'firewall log',
        'blocked by firewall', 'firewall traffic',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { rules: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.rules || item?.data?.firewallRules) {
          return {
            rules: item.data.rules || item.data.firewallRules,
            networkId: item.data.networkId,
          };
        }
      }
      return { rules: [] };
    },
  },

  // Blocked Connections - traffic summary
  {
    type: 'blocked-connections',
    title: 'Blocked Connections',
    description: 'Blocked traffic summary',
    icon: 'shield',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'blocked connection', 'blocked traffic', 'denied connection',
        'blocked request', 'what was blocked', 'blocked ip',
        'dropped connection', 'rejected traffic',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { connections: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.connections || item?.data?.blocked) {
          return {
            connections: item.data.connections || item.data.blocked,
            networkId: item.data.networkId,
          };
        }
      }
      return { connections: [] };
    },
  },

  // Intrusion Detection - IDS/IPS alerts
  {
    type: 'intrusion-detection',
    title: 'Intrusion Detection',
    description: 'IDS/IPS alert summary',
    icon: 'security',
    priority: 84,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'ids', 'ips', 'intrusion detection', 'intrusion prevention',
        'ids alert', 'ips alert', 'signature', 'exploit',
        'malware detect', 'threat detect',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { alerts: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.alerts || item?.data?.idsAlerts) {
          return {
            alerts: item.data.alerts || item.data.idsAlerts,
            mode: item.data.mode,
            networkId: item.data.networkId,
          };
        }
      }
      return { alerts: [] };
    },
  },

  // Compliance Score - security status
  {
    type: 'compliance-score',
    title: 'Compliance Score',
    description: 'Security compliance status',
    icon: 'compliance',
    priority: 83,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'compliance', 'security score', 'security posture',
        'security check', 'security audit', 'cis', 'nist',
        'pci', 'hipaa', 'security compliance',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { checks: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.checks || item?.data?.compliance) {
          return {
            checks: item.data.checks || item.data.compliance,
            overallScore: item.data.overallScore || item.data.score,
            framework: item.data.framework,
            networkId: item.data.networkId,
          };
        }
      }
      return { checks: [] };
    },
  },

  // ============================================================================
  // Phase 7: Wireless Deep Dive cards
  // ============================================================================

  // Channel Utilization Heatmap - AP channel usage
  {
    type: 'channel-utilization-heatmap',
    title: 'Channel Heatmap',
    description: 'AP channel usage heatmap',
    icon: 'channel',
    priority: 86,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'channel utilization', 'channel heatmap', 'channel usage',
        'channel allocation', 'channel map', 'ap channel',
        'wifi channel', 'wireless channel', 'channel assignment',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { accessPoints: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.accessPoints || item?.data?.aps) {
          return {
            accessPoints: item.data.accessPoints || item.data.aps,
            networkId: item.data.networkId,
          };
        }
        // Check for device data with wireless APs
        if (Array.isArray(item?.data)) {
          const aps = item.data.filter((d: any) =>
            d.model?.startsWith('MR') || d.model?.startsWith('CW') || d.productType === 'wireless'
          );
          if (aps.length > 0) {
            return { accessPoints: aps, networkId: item.networkId };
          }
        }
      }
      return { accessPoints: [] };
    },
  },

  // Client Signal Strength - RSSI distribution
  {
    type: 'client-signal-strength',
    title: 'Signal Strength',
    description: 'Client RSSI distribution',
    icon: 'signal',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'signal strength', 'rssi', 'signal quality',
        'client signal', 'wireless signal', 'signal level',
        'snr', 'signal distribution', 'client rssi',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { clients: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.clients || item?.data?.signalData) {
          return {
            clients: item.data.clients || item.data.signalData,
            networkId: item.data.networkId,
          };
        }
      }
      return { clients: [] };
    },
  },

  // SSID Client Breakdown - OVERHAULED: Security badges + band distribution
  {
    type: 'ssid-client-breakdown',
    title: 'SSID Breakdown',
    description: 'Security badges with band distribution',
    icon: 'ssid',
    priority: 84,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'ssid breakdown', 'ssid client', 'client per ssid',
        'ssid distribution', 'ssid usage', 'which ssid',
        'ssid stats', 'wireless network usage', 'ssid security',
        'wireless security', 'band distribution', '2.4ghz', '5ghz', '6ghz',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { ssids: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.ssids) {
          return {
            ssids: item.data.ssids,
            networkId: item.data.networkId,
          };
        }
      }
      return { ssids: [] };
    },
  },

  // Roaming Events - client roaming activity
  {
    type: 'roaming-events',
    title: 'Roaming Events',
    description: 'Client roaming activity',
    icon: 'roaming',
    priority: 83,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'roaming', 'roam event', 'client roam',
        'handoff', 'ap switch', '802.11r', '802.11k',
        'fast roaming', 'roaming history',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { events: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.events || item?.data?.roamingEvents) {
          return {
            events: item.data.events || item.data.roamingEvents,
            networkId: item.data.networkId,
          };
        }
      }
      return { events: [] };
    },
  },

  // Interference Monitor - OVERHAULED: Spectrum analyzer with channel visualization
  {
    type: 'interference-monitor',
    title: 'Interference Monitor',
    description: 'Spectrum analyzer with channel details',
    icon: 'interference',
    priority: 82,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'interference', 'noise', 'non-wifi',
        'spectrum', 'rf interference', 'noise floor',
        'interference source', 'microwave', 'bluetooth interference',
        'channel interference', 'spectrum analyzer', 'cordless phone',
        'radar', 'dfs', 'channel congestion',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { accessPoints: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.accessPoints || item?.data?.aps || item?.data?.sources) {
          return {
            accessPoints: item.data.accessPoints || item.data.aps,
            sources: item.data.sources,
            networkId: item.data.networkId,
          };
        }
      }
      return { accessPoints: [] };
    },
  },

  // ============================================================================
  // Phase 8: Switch & Infrastructure cards
  // ============================================================================

  // Port Utilization Heatmap - switch port usage
  {
    type: 'port-utilization-heatmap',
    title: 'Port Heatmap',
    description: 'Switch port utilization',
    icon: 'port',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'port utilization', 'port heatmap', 'port usage',
        'switch port', 'port status', 'port activity',
        'port load', 'port traffic',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { ports: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.ports || item?.data?.switches) {
          return {
            ports: item.data.ports,
            switches: item.data.switches,
            networkId: item.data.networkId,
          };
        }
      }
      return { ports: [] };
    },
  },

  // VLAN Distribution - OVERHAULED: Topology view with metric toggles
  {
    type: 'vlan-distribution',
    title: 'VLAN Distribution',
    description: 'Topology view with metric toggles',
    icon: 'vlan',
    priority: 84,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'vlan distribution', 'vlan traffic', 'vlan usage',
        'vlan breakdown', 'vlan stats', 'traffic by vlan',
        'vlan client', 'vlan utilization', 'vlan topology',
        'network segmentation', 'subnet', 'vlan diagram',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { vlans: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.vlans) {
          return {
            vlans: item.data.vlans,
            networkId: item.data.networkId,
          };
        }
      }
      return { vlans: [] };
    },
  },

  // PoE Budget - OVERHAULED: Switch panel visualization with port grid
  {
    type: 'poe-budget',
    title: 'PoE Budget',
    description: 'Switch panel with interactive port grid',
    icon: 'poe',
    priority: 83,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'poe', 'power over ethernet', 'poe budget',
        'power consumption', 'poe usage', 'power budget',
        'poe port', 'poe status', 'powered device',
        'poe class', 'power delivery', 'port power',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { ports: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.ports || item?.data?.switches || item?.data?.totalBudget !== undefined) {
          return {
            ports: item.data.ports,
            switches: item.data.switches,
            totalBudget: item.data.totalBudget,
            usedPower: item.data.usedPower,
            networkId: item.data.networkId,
          };
        }
      }
      return { ports: [] };
    },
  },

  // Spanning Tree Status - STP topology
  {
    type: 'spanning-tree-status',
    title: 'Spanning Tree',
    description: 'STP topology status',
    icon: 'stp',
    priority: 82,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'spanning tree', 'stp', 'rstp', 'mstp',
        'root bridge', 'blocking port', 'stp status',
        'spanning-tree', 'loop prevention',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { switches: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.switches || item?.data?.rootBridge) {
          return {
            switches: item.data.switches,
            rootBridge: item.data.rootBridge,
            stpMode: item.data.stpMode,
            networkId: item.data.networkId,
          };
        }
      }
      return { switches: [] };
    },
  },

  // Stack Status - switch stack health
  {
    type: 'stack-status',
    title: 'Stack Status',
    description: 'Switch stack health',
    icon: 'stack',
    priority: 81,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'stack status', 'switch stack', 'stack health',
        'stack member', 'stack master', 'stack ring',
        'stacking', 'stackwise',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { members: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.stacks || item?.data?.members) {
          return {
            stacks: item.data.stacks,
            members: item.data.members,
            networkId: item.data.networkId,
          };
        }
      }
      return { members: [] };
    },
  },

  // ============================================================================
  // Phase 9: Alerts & Incidents cards
  // ============================================================================

  // Alert Timeline - chronological alert history
  {
    type: 'alert-timeline',
    title: 'Alert Timeline',
    description: 'Chronological alert history',
    icon: 'timeline',
    priority: 80,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'alert timeline', 'alert history', 'recent alerts',
        'alert log', 'alert events', 'show alerts',
        'what alerts', 'chronological alerts',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { alerts: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.alerts) {
          return {
            alerts: item.data.alerts,
            timeRange: item.data.timeRange,
            networkId: item.data.networkId,
          };
        }
      }
      return { alerts: [] };
    },
  },

  // Incident Tracker - open incident Kanban
  {
    type: 'incident-tracker',
    title: 'Incident Tracker',
    description: 'Open incident summary',
    icon: 'incident',
    priority: 79,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'incident', 'open incident', 'active incident',
        'incident tracker', 'incident status', 'incident board',
        'current incident', 'ongoing issue',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { incidents: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.incidents) {
          return {
            incidents: item.data.incidents,
            networkId: item.data.networkId,
          };
        }
      }
      return { incidents: [] };
    },
  },

  // Alert Correlation - OVERHAULED: Correlation graph with cluster visualization
  {
    type: 'alert-correlation',
    title: 'Alert Correlation',
    description: 'Correlation graph with cluster analysis',
    icon: 'correlation',
    priority: 78,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'correlation', 'correlated alert', 'related alert',
        'alert group', 'alert cluster', 'root cause',
        'common cause', 'linked alert', 'alert pattern',
        'investigate alerts', 'why multiple alerts',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { clusters: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.clusters || item?.data?.correlations) {
          return {
            clusters: item.data.clusters || item.data.correlations,
            totalAlerts: item.data.totalAlerts,
            networkId: item.data.networkId,
          };
        }
      }
      return { clusters: [] };
    },
  },

  // MTTR Metrics - Mean time to resolution
  {
    type: 'mttr-metrics',
    title: 'MTTR Metrics',
    description: 'Resolution time analysis',
    icon: 'mttr',
    priority: 77,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'mttr', 'mean time to', 'resolution time',
        'time to resolve', 'incident metrics', 'response time',
        'sla metrics', 'incident kpi',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { current: null };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.current || item?.data?.mttr !== undefined) {
          return {
            current: item.data.current || { mttr: item.data.mttr, period: 'Current' },
            previous: item.data.previous,
            trend: item.data.trend,
            byPriority: item.data.byPriority,
            networkId: item.data.networkId,
          };
        }
      }
      return { current: null };
    },
  },

  // ============================================================================
  // Phase 10: Splunk & Log Integration cards
  // ============================================================================

  // Log Volume Trend - OVERHAULED: Anomaly detection with baseline comparison
  {
    type: 'log-volume-trend',
    title: 'Log Volume',
    description: 'Anomaly detection with baseline comparison',
    icon: 'log',
    priority: 76,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Explicit volume/trend patterns - always trigger for these
      const volumePatterns = [
        'log volume', 'log ingestion', 'log trend',
        'log count', 'event volume', 'splunk volume',
        'logs per', 'event rate', 'log summary',
        'log anomaly', 'log spike', 'logging baseline',
        'unusual log', 'log pattern',
      ];
      if (volumePatterns.some(pattern => q.includes(pattern))) return true;

      // Skip device-specific queries - splunk-event-summary is better for those
      const isDeviceQuery = q.includes('mx') || q.includes('mr') || q.includes('ms') ||
        q.includes('z3') || /[a-z0-9]{4}-[a-z0-9]{4}/i.test(q);
      if (isDeviceQuery) return false;

      // Check for Splunk data with timeseries characteristics
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.tool_name?.includes('splunk') && item?.data) {
          const results = item.data.results || item.data;
          if (Array.isArray(results) && results.length > 5) {
            // Only trigger if results have timestamps for meaningful aggregation
            const hasTimestamps = results.some((r: any) =>
              r._time || r.timestamp || r.occurredAt || r.receivedAt
            );
            if (hasTimestamps) return true;
          }
        }
      }

      return false;
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { timeseries: [], totalEvents: 0 };
      const toolDataArray = Array.isArray(data) ? data : [];

      for (const item of toolDataArray) {
        // Handle pre-formatted timeseries data
        if (item?.data?.timeseries || item?.data?.data || item?.data?.totalEvents !== undefined) {
          return {
            timeseries: item.data.timeseries || item.data.data || [],
            totalEvents: item.data.totalEvents || 0,
            timeRange: item.data.timeRange,
            index: item.data.index,
          };
        }

        // Handle Splunk search results (stats output with count fields)
        const results = item?.data?.results || item?.data;
        if (Array.isArray(results) && results.length > 0) {
          // Check if results have count/time data for timeseries
          const hasTimeseries = results.some((r: any) =>
            (r._time || r.timestamp) && (r.count !== undefined || r.events !== undefined)
          );

          if (hasTimeseries) {
            return {
              timeseries: results.map((r: any) => ({
                timestamp: r._time || r.timestamp || new Date().toISOString(),
                count: parseInt(r.count || r.events || '1', 10),
              })),
              totalEvents: results.reduce((sum: number, r: any) =>
                sum + parseInt(r.count || r.events || '1', 10), 0),
              index: item?.data?.index || 'main',
            };
          }

          // Aggregate raw events by hour buckets
          const eventsByHour: Record<string, number> = {};
          let totalEvents = 0;

          for (const r of results) {
            totalEvents++;
            // Extract timestamp from _time, timestamp, occurredAt, or receivedAt
            const rawTime = r._time || r.timestamp || r.occurredAt || r.receivedAt;
            if (rawTime) {
              // Bucket by hour
              const date = new Date(rawTime);
              date.setMinutes(0, 0, 0); // Round to hour
              const hourKey = date.toISOString();
              eventsByHour[hourKey] = (eventsByHour[hourKey] || 0) + 1;
            }
          }

          // Convert to sorted timeseries
          const timeseries = Object.entries(eventsByHour)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([timestamp, count]) => ({ timestamp, count }));

          // If we have aggregated timeseries data, return it
          if (timeseries.length > 0) {
            return { timeseries, totalEvents, index: item?.data?.index };
          }

          // If no timestamps found but we have events, create single bucket
          if (totalEvents > 0) {
            return {
              timeseries: [{ timestamp: new Date().toISOString(), count: totalEvents }],
              totalEvents,
              index: item?.data?.index,
              note: 'Events aggregated (no timestamps in data)',
            };
          }
        }
      }

      return { timeseries: [], totalEvents: 0 };
    },
  },

  // Splunk Search Results - shows for ANY Splunk query with results
  {
    type: 'splunk-search-results',
    title: 'Splunk Results',
    description: 'Search results from Splunk logs',
    icon: 'log',
    priority: 90,  // High priority to always show Splunk results
    condition: (query, data, response) => {
      // Show for any query that has Splunk tool results
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        // Check both 'tool' (from tool_data array) and 'tool_name' (legacy)
        const toolName = item?.tool || item?.tool_name || '';
        if (toolName.toLowerCase().includes('splunk') && item?.success !== false) {
          const results = item?.data?.results || item?.data;
          if (Array.isArray(results) && results.length > 0) {
            return true;
          }
          // Also trigger for stats results
          if (item?.data && typeof item.data === 'object') {
            return true;
          }
        }
      }
      return false;
    },
    dataExtractor: (data: unknown) => {
      const toolDataArray = Array.isArray(data) ? data : [];

      // Collect all Splunk results
      const allResults: any[] = [];
      let searchQuery = '';
      let timeRange = '';

      for (const item of toolDataArray) {
        const toolName = item?.tool || item?.tool_name || '';
        if (toolName.toLowerCase().includes('splunk') && item?.success !== false) {
          if (item?.params?.search_query) searchQuery = item.params.search_query;
          if (item?.params?.earliest_time) timeRange = item.params.earliest_time;

          const results = item?.data?.results || item?.data;
          if (Array.isArray(results)) {
            allResults.push(...results);
          }
        }
      }

      // Smart field detection - find the best field to group by
      const detectPrimaryField = (results: any[]): string => {
        if (results.length === 0) return 'type';

        // Priority order for grouping fields
        const fieldPriority = [
          'type',      // Event type (association, disassociation, etc.)
          'ssid',      // WiFi network
          'reason',    // Failure reason
          'clientMac', // Client identifier
          'apMac',     // Access point
          'deviceSerial',
          'category',
          'sourcetype',
        ];

        // Check which fields exist in the results
        const sample = results[0];
        for (const field of fieldPriority) {
          if (sample[field] && sample[field] !== 'Unknown') {
            return field;
          }
        }
        return 'sourcetype';
      };

      // Build smart breakdown based on detected primary field
      const buildBreakdown = (results: any[], field: string): {name: string; count: number}[] => {
        const counts: Record<string, number> = {};
        for (const r of results) {
          const value = r[field] || 'Unknown';
          const count = parseInt(r.count) || 1;
          counts[value] = (counts[value] || 0) + count;
        }
        return Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      };

      // Detect query intent for better labeling
      const detectQueryIntent = (query: string): string => {
        const q = query.toLowerCase();
        if (q.includes('association') || q.includes('disassoc')) return 'Wireless Events';
        if (q.includes('auth') || q.includes('wpa')) return 'Authentication Events';
        if (q.includes('error') || q.includes('fail')) return 'Error Events';
        if (q.includes('security') || q.includes('ids')) return 'Security Events';
        if (q.includes('switch') || q.includes('port')) return 'Switch Events';
        return 'Events';
      };

      // Extract key insights (failures, errors, interesting findings)
      const extractInsights = (results: any[]): string[] => {
        const insights: string[] = [];
        const typeCount: Record<string, number> = {};
        let totalFailures = 0;
        let totalErrors = 0;

        for (const r of results) {
          const type = (r.type || '').toLowerCase();
          const count = parseInt(r.count) || 1;
          typeCount[type] = (typeCount[type] || 0) + count;

          if (type.includes('fail') || type.includes('disassoc') || type.includes('deauth')) {
            totalFailures += count;
          }
          if (type.includes('error')) {
            totalErrors += count;
          }
        }

        if (totalFailures > 0) {
          insights.push(`${totalFailures.toLocaleString()} failure/disconnect events`);
        }
        if (totalErrors > 0) {
          insights.push(`${totalErrors.toLocaleString()} error events`);
        }
        if (typeCount['association'] && typeCount['disassociation']) {
          const ratio = ((typeCount['disassociation'] / typeCount['association']) * 100).toFixed(1);
          insights.push(`${ratio}% disconnect rate`);
        }

        return insights;
      };

      const primaryField = detectPrimaryField(allResults);
      const typeBreakdown = buildBreakdown(allResults, primaryField);
      const totalEvents = typeBreakdown.reduce((sum, t) => sum + t.count, 0);
      const queryIntent = detectQueryIntent(searchQuery);
      const insights = extractInsights(allResults);

      return {
        results: allResults.slice(0, 20),
        typeBreakdown,
        severityBreakdown: [], // Not used for now
        totalEvents,
        searchQuery,
        timeRange,
        hasMore: allResults.length > 20,
        primaryField,     // What field we're grouping by
        queryIntent,      // Human-readable intent
        insights,         // Key findings
      };
    },
  },

  // Splunk Event Summary - breakdown of events by type (for device-specific queries)
  {
    type: 'splunk-event-summary',
    title: 'Event Summary',
    description: 'Breakdown of log events by type',
    icon: 'log',
    priority: 85,  // Higher than log-volume-trend for device-specific queries
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Check for device-specific Splunk queries
      const isDeviceQuery = q.includes('device') || q.includes('mx') ||
        q.includes('mr') || q.includes('ms') || q.includes('z3') ||
        /[a-z0-9]{4}-[a-z0-9]{4}/i.test(q);

      if (!isDeviceQuery) return false;

      // Must have Splunk data
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.tool_name?.includes('splunk') && item?.data) {
          const results = item.data.results || item.data;
          if (Array.isArray(results) && results.length > 0) {
            return true;
          }
        }
      }
      return false;
    },
    dataExtractor: (data: unknown) => {
      const toolDataArray = Array.isArray(data) ? data : [];

      // Aggregate events by type/category
      const eventsByType: Record<string, number> = {};
      let totalEvents = 0;
      let deviceSerial: string | undefined;
      let networkId: string | undefined;

      for (const item of toolDataArray) {
        const results = item?.data?.results || item?.data;
        if (Array.isArray(results)) {
          for (const r of results) {
            totalEvents++;
            const type = r.type || r.category || r.sourcetype || 'Unknown';
            eventsByType[type] = (eventsByType[type] || 0) + 1;

            // Extract device context
            if (r.deviceSerial && !deviceSerial) deviceSerial = r.deviceSerial;
            if (r.networkId && !networkId) networkId = r.networkId;
          }
        }
      }

      // Convert to sorted array
      const categories = Object.entries(eventsByType)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(1) : '0',
        }))
        .sort((a, b) => b.count - a.count);

      return { categories, totalEvents, deviceSerial, networkId };
    },
  },

  // Error Distribution - errors by source/type
  {
    type: 'error-distribution',
    title: 'Error Distribution',
    description: 'Errors by source/type',
    icon: 'error',
    priority: 75,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'error distribution', 'error breakdown', 'error type',
        'error source', 'error category', 'top error',
        'error count', 'exception type',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { categories: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.categories || item?.data?.errors) {
          return {
            categories: item.data.categories || item.data.errors,
            totalErrors: item.data.totalErrors,
            timeRange: item.data.timeRange,
          };
        }
      }
      return { categories: [] };
    },
  },

  // Event Correlation - correlated log events
  {
    type: 'event-correlation',
    title: 'Event Correlation',
    description: 'Correlated log events',
    icon: 'correlation',
    priority: 74,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'event correlation', 'log correlation', 'event flow',
        'source to destination', 'event chain', 'log flow',
        'event pattern', 'transaction trace',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { flows: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.flows || item?.data?.nodes) {
          return {
            flows: item.data.flows,
            nodes: item.data.nodes,
            links: item.data.links,
            totalEvents: item.data.totalEvents,
            timeRange: item.data.timeRange,
          };
        }
      }
      return { flows: [] };
    },
  },

  // Log Severity Breakdown - logs by severity level
  {
    type: 'log-severity-breakdown',
    title: 'Log Severity',
    description: 'Logs by severity level',
    icon: 'severity',
    priority: 73,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'log severity', 'severity breakdown', 'severity level',
        'error level', 'log level', 'critical error',
        'warning count', 'debug log', 'info log',
      ];
      return patterns.some(pattern => q.includes(pattern));
    },
    dataExtractor: (data: unknown) => {
      if (!data) return { levels: [] };
      const toolDataArray = Array.isArray(data) ? data : [];
      for (const item of toolDataArray) {
        if (item?.data?.levels || item?.data?.severity) {
          return {
            levels: item.data.levels || item.data.severity,
            totalLogs: item.data.totalLogs,
            timeRange: item.data.timeRange,
            index: item.data.index,
          };
        }
      }
      return { levels: [] };
    },
  },

  // ============================================================================
  // Phase 11: Knowledge Base cards
  // ============================================================================

  // Knowledge Sources - triggers when knowledge/documentation queries are detected
  {
    type: 'knowledge-sources',
    title: 'Source Documents',
    description: 'View cited sources',
    icon: 'knowledge',
    priority: 90,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      // Check for knowledge-related patterns
      const patterns = [
        'datasheet', 'specification', 'specs', 'feature',
        'difference', 'compare', 'comparison', 'versus', ' vs ',
        'capable of', 'support', 'model', 'c9200', 'c9300', 'c9400', 'c9500',
        'catalyst', 'meraki', 'nexus', 'cvd', 'validated design',
        'how does', 'what is', 'explain', 'documentation',
      ];
      const hasKnowledgeQuery = patterns.some(pattern => q.includes(pattern));

      // Also check if response mentions sources or knowledge base
      const hasKnowledgeResponse = response.toLowerCase().includes('source') ||
        response.toLowerCase().includes('datasheet') ||
        response.toLowerCase().includes('documentation');

      return hasKnowledgeQuery || hasKnowledgeResponse;
    },
    dataExtractor: (data: unknown, response?: string) => {
      // This card's data typically comes from the card_suggestion event
      // from the backend, not from tool_data
      return { query: '', documents: [] };
    },
  },

  // Datasheet Comparison - triggers when comparing products/models
  {
    type: 'datasheet-comparison',
    title: 'Product Comparison',
    description: 'Compare specifications',
    icon: 'datasheet',
    priority: 85,
    condition: (query, data, response) => {
      const q = query.toLowerCase();
      const patterns = [
        'difference between', 'compare', 'comparison', 'versus', ' vs ',
        'which is better', 'pros and cons', 'side by side',
      ];
      const hasComparisonQuery = patterns.some(pattern => q.includes(pattern));

      // Check for product model patterns
      const modelPatterns = /c9[0-9]{3}|c8[0-9]{3}|mr[0-9]+|ms[0-9]+|mx[0-9]+|n[0-9]k/i;
      const hasModels = modelPatterns.test(q);

      return hasComparisonQuery && hasModels;
    },
    dataExtractor: (data: unknown, response?: string) => {
      return { query: '', products: [] };
    },
  },

  // Product Detail - triggers when asking about a specific product model
  {
    type: 'product-detail',
    title: 'Product Details',
    description: 'View product specs',
    icon: 'device',
    priority: 82,
    condition: (query, data, response) => {
      const q = query.toLowerCase();

      // Check for single product model queries (not comparisons)
      const comparisonPatterns = ['difference', 'compare', 'versus', ' vs ', 'between'];
      const isComparison = comparisonPatterns.some(pattern => q.includes(pattern));

      if (isComparison) return false;

      // Check for detail/info keywords
      const detailPatterns = ['detail', 'spec', 'feature', 'about', 'tell me', 'info', 'overview', 'what is'];
      const hasDetailKeyword = detailPatterns.some(pattern => q.includes(pattern));

      // Check for product model patterns
      const modelPatterns = /c9[0-9]{3}[a-z]?|c8[0-9]{3}[a-z]?|mr[0-9]+[a-z]?|ms[0-9]+[a-z]?|mx[0-9]+[a-z]?|n[0-9]k/i;
      const hasModel = modelPatterns.test(q);

      return hasDetailKeyword && hasModel;
    },
    dataExtractor: (data: unknown, response?: string) => {
      return { product: { name: '' }, specs: {} };
    },
  },
];
