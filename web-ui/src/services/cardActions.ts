/**
 * Card Actions Service
 *
 * Centralized service for executing card actions with consistent
 * error handling, loading states, and API communication patterns.
 */

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ActionState {
  status: ActionStatus;
  message?: string;
  data?: unknown;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Execute a card action against the backend API
 */
export async function executeCardAction(
  actionType: string,
  payload: Record<string, unknown> = {}
): Promise<ActionResult> {
  try {
    const response = await fetch(`/api/actions/${actionType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        return { success: false, message: 'Authentication required. Please log in.' };
      }
      if (response.status === 403) {
        return { success: false, message: 'You do not have permission to perform this action.' };
      }
      if (response.status === 423) {
        return { success: false, message: 'Edit mode required to perform this action.' };
      }
      if (response.status === 501) {
        return { success: false, message: 'This action is not yet implemented.' };
      }

      return {
        success: false,
        message: result.detail || result.error || result.message || 'Action failed'
      };
    }

    return {
      success: true,
      message: result.message || 'Action completed successfully',
      data: result.data
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'An unexpected error occurred' };
  }
}

// ============================================================================
// Traffic Actions
// ============================================================================

/**
 * Block traffic flow between source and destination
 */
export async function blockTrafficFlow(params: {
  sourceIp: string;
  destinationIp?: string;
  protocol?: string;
  port?: number;
  duration?: number; // minutes, 0 = permanent
  networkId?: string;
}): Promise<ActionResult> {
  return executeCardAction('block-traffic', params);
}

/**
 * Block an application by name or ID
 */
export async function blockApplication(params: {
  applicationId: string;
  applicationName?: string;
  networkId?: string;
  duration?: number; // minutes, 0 = permanent
}): Promise<ActionResult> {
  return executeCardAction('block-app', params);
}

/**
 * Adjust QoS settings for a traffic class
 */
export async function adjustQoS(params: {
  trafficClass: string;
  priority: 'high' | 'normal' | 'low';
  bandwidthLimit?: number; // Mbps
  networkId?: string;
}): Promise<ActionResult> {
  return executeCardAction('qos-adjust', params);
}

// ============================================================================
// Device Actions
// ============================================================================

/**
 * Run MTR (traceroute) to a destination
 */
export async function runMTR(params: {
  serial: string;
  destination: string;
  count?: number;
}): Promise<ActionResult> {
  return executeCardAction('mtr', params);
}

/**
 * Configure a switch port
 */
export async function configurePort(params: {
  serial: string;
  portId: string;
  enabled?: boolean;
  poeEnabled?: boolean;
  name?: string;
  vlan?: number;
}): Promise<ActionResult> {
  return executeCardAction('port-config', params);
}

/**
 * Run cable test on ports
 */
export async function runCableTest(params: {
  serial: string;
  ports: string[];
}): Promise<ActionResult> {
  return executeCardAction('cable-test', params);
}

/**
 * Ping a device or IP
 */
export async function pingDevice(params: {
  serial: string;
  target: string;
  count?: number;
}): Promise<ActionResult> {
  return executeCardAction('ping', params);
}

/**
 * Blink device LEDs for identification
 */
export async function blinkLED(params: {
  serial: string;
  duration?: number; // seconds
}): Promise<ActionResult> {
  return executeCardAction('blink-led', params);
}

/**
 * Reboot a device
 */
export async function rebootDevice(params: {
  serial: string;
}): Promise<ActionResult> {
  return executeCardAction('reboot', params);
}

// ============================================================================
// Security Actions
// ============================================================================

/**
 * Acknowledge a security event
 */
export async function acknowledgeSecurityEvent(params: {
  eventId: string;
  notes?: string;
}): Promise<ActionResult> {
  return executeCardAction('acknowledge-event', params);
}

/**
 * Dismiss a security event
 */
export async function dismissSecurityEvent(params: {
  eventId: string;
  reason?: string;
}): Promise<ActionResult> {
  return executeCardAction('dismiss-event', params);
}

/**
 * Block a source IP (intrusion detection)
 */
export async function blockSource(params: {
  sourceIp: string;
  duration?: number; // minutes
  reason?: string;
}): Promise<ActionResult> {
  return executeCardAction('block-source', params);
}

/**
 * Create a firewall exception
 */
export async function createFirewallException(params: {
  sourceIp?: string;
  destinationIp?: string;
  port?: number;
  protocol?: string;
  reason: string;
}): Promise<ActionResult> {
  return executeCardAction('create-exception', params);
}

// ============================================================================
// Wireless Actions
// ============================================================================

/**
 * Enable or disable an SSID
 */
export async function configureSSID(params: {
  networkId: string;
  ssidNumber: number;
  enabled: boolean;
}): Promise<ActionResult> {
  return executeCardAction('ssid-config', params);
}

/**
 * Set client policy (block, whitelist, etc.)
 */
export async function setClientPolicy(params: {
  networkId: string;
  clientId: string;
  policy: 'normal' | 'blocked' | 'whitelisted';
}): Promise<ActionResult> {
  return executeCardAction('client-policy', params);
}

// ============================================================================
// VLAN Actions
// ============================================================================

/**
 * Configure VLAN settings
 */
export async function configureVLAN(params: {
  networkId: string;
  vlanId: number;
  name?: string;
  subnet?: string;
  enabled?: boolean;
}): Promise<ActionResult> {
  return executeCardAction('vlan-config', params);
}

/**
 * Create a new VLAN
 */
export async function createVLAN(params: {
  networkId: string;
  vlanId: number;
  name: string;
  subnet?: string;
  applianceIp?: string;
}): Promise<ActionResult> {
  return executeCardAction('vlan-create', params);
}

/**
 * Get routing table for a network
 */
export async function getRoutingTable(params: {
  networkId: string;
}): Promise<ActionResult> {
  try {
    const response = await fetch(`/api/networks/${params.networkId}/routing`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.detail || result.error || 'Failed to fetch routing table'
      };
    }

    return {
      success: true,
      message: 'Routing table fetched',
      data: result
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch routing table'
    };
  }
}

/**
 * Get devices in a VLAN
 */
export async function getVLANDevices(params: {
  networkId: string;
  vlanId: number;
}): Promise<ActionResult> {
  try {
    const response = await fetch(`/api/networks/${params.networkId}/vlans/${params.vlanId}/devices`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.detail || result.error || 'Failed to fetch VLAN devices'
      };
    }

    return {
      success: true,
      message: 'Devices fetched',
      data: result
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch VLAN devices'
    };
  }
}

// ============================================================================
// Incident Actions
// ============================================================================

/**
 * Create a new incident
 */
export async function createIncident(params: {
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee?: string;
  relatedAlerts?: string[];
}): Promise<ActionResult> {
  try {
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.detail || result.error || 'Failed to create incident'
      };
    }

    return {
      success: true,
      message: 'Incident created successfully',
      data: result
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create incident'
    };
  }
}

/**
 * Update incident status
 */
export async function updateIncident(params: {
  incidentId: string;
  status?: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assignee?: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const { incidentId, ...updateData } = params;
    const response = await fetch(`/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.detail || result.error || 'Failed to update incident'
      };
    }

    return {
      success: true,
      message: 'Incident updated successfully',
      data: result
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update incident'
    };
  }
}

/**
 * Resolve an incident
 */
export async function resolveIncident(params: {
  incidentId: string;
  resolution?: string;
}): Promise<ActionResult> {
  return updateIncident({
    incidentId: params.incidentId,
    status: 'resolved',
    notes: params.resolution,
  });
}

/**
 * Escalate an incident
 */
export async function escalateIncident(params: {
  incidentId: string;
  reason?: string;
}): Promise<ActionResult> {
  return updateIncident({
    incidentId: params.incidentId,
    priority: 'critical',
    notes: `Escalated: ${params.reason || 'Priority increased'}`,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a managed action state with auto-clear
 */
export function createActionStateManager(
  setActionState: (state: ActionState) => void,
  successTimeout = 3000,
  errorTimeout = 5000
) {
  return {
    setLoading: () => {
      setActionState({ status: 'loading' });
    },
    setSuccess: (message: string, data?: unknown) => {
      setActionState({ status: 'success', message, data });
      setTimeout(() => setActionState({ status: 'idle' }), successTimeout);
    },
    setError: (message: string) => {
      setActionState({ status: 'error', message });
      setTimeout(() => setActionState({ status: 'idle' }), errorTimeout);
    },
    reset: () => {
      setActionState({ status: 'idle' });
    },
  };
}

/**
 * Execute an action with automatic state management
 */
export async function executeWithState(
  action: () => Promise<ActionResult>,
  stateManager: ReturnType<typeof createActionStateManager>
): Promise<ActionResult> {
  stateManager.setLoading();

  const result = await action();

  if (result.success) {
    stateManager.setSuccess(result.message, result.data);
  } else {
    stateManager.setError(result.message);
  }

  return result;
}
