/**
 * Network Change Actions Service
 *
 * Handles actions from network performance change cards,
 * including revert operations and metric updates.
 */

export interface NetworkChangeAction {
  type: 'revert_change' | 'keep_change' | 'view_change' | 'update_metrics';
  changeId: string;
  networkId?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Handle network change card actions
 */
export async function handleNetworkChangeAction(
  action: NetworkChangeAction,
  token?: string
): Promise<ActionResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    switch (action.type) {
      case 'revert_change':
        return await revertChange(action.changeId, headers);

      case 'update_metrics':
        return await updateMetrics(action.changeId, headers);

      case 'view_change':
        // This is handled by the card's onAction callback to navigate/expand
        return {
          success: true,
          message: 'View action triggered',
          data: { changeId: action.changeId },
        };

      case 'keep_change':
        // No API call needed, just acknowledge
        return {
          success: true,
          message: 'Changes kept',
          data: { changeId: action.changeId },
        };

      default:
        return {
          success: false,
          message: `Unknown action type: ${(action as NetworkChangeAction).type}`,
        };
    }
  } catch (error) {
    console.error('[NetworkChangeActions] Error:', error);
    return {
      success: false,
      message: 'Action failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revert a network change
 */
async function revertChange(
  changeId: string,
  headers: Record<string, string>
): Promise<ActionResult> {
  const response = await fetch(`/api/network-changes/${changeId}/revert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      message: errorData.detail || 'Failed to revert change',
      error: `HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  return {
    success: true,
    message: 'Change reverted successfully',
    data: data.data,
  };
}

/**
 * Update metrics for a change (trigger post-change metric capture)
 */
async function updateMetrics(
  changeId: string,
  headers: Record<string, string>
): Promise<ActionResult> {
  const response = await fetch(`/api/network-changes/${changeId}/update-metrics`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      message: errorData.detail || 'Failed to update metrics',
      error: `HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  return {
    success: true,
    message: 'Metrics updated',
    data: data.data,
  };
}

/**
 * Get change comparison data
 */
export async function getChangeComparison(
  networkId: string,
  changeId: string,
  token?: string
): Promise<ActionResult> {
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(
      `/api/network-changes/${networkId}/comparison/${changeId}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.detail || 'Failed to get comparison',
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Comparison loaded',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load comparison',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current network metrics
 */
export async function getCurrentMetrics(
  networkId: string,
  orgId: string,
  token?: string
): Promise<ActionResult> {
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const params = new URLSearchParams({ org_id: orgId });
    const response = await fetch(
      `/api/network-changes/${networkId}/metrics?${params}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.detail || 'Failed to get metrics',
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'Metrics loaded',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get change history for a network
 */
export async function getChangeHistory(
  networkId: string,
  orgId: string,
  limit: number = 10,
  token?: string
): Promise<ActionResult> {
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const params = new URLSearchParams({
      org_id: orgId,
      limit: limit.toString(),
    });
    const response = await fetch(
      `/api/network-changes/${networkId}/history?${params}`,
      { headers }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errorData.detail || 'Failed to get history',
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      message: 'History loaded',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to load history',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
