/**
 * Pending Actions Service
 *
 * Service for managing AI pending actions that require user approval.
 */

export interface PendingAction {
  id: string;
  session_id: string;
  user_id?: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  description?: string;
  organization_id?: string;
  network_id?: string;
  device_serial?: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  impact_summary?: string;
  reversible?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
  created_at: string;
  expires_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  executed_at?: string;
  execution_result?: Record<string, unknown>;
  error_message?: string;
}

export interface PendingActionsResponse {
  actions: PendingAction[];
  total: number;
}

const API_BASE = '/api/pending-actions';

/**
 * Fetch all pending actions for the current user's session
 */
export async function fetchPendingActions(
  sessionId?: string,
  status: string = 'pending'
): Promise<PendingActionsResponse> {
  const params = new URLSearchParams();
  if (sessionId) params.set('session_id', sessionId);
  if (status) params.set('status', status);

  const response = await fetch(`${API_BASE}?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending actions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get count of pending actions
 */
export async function fetchPendingActionCount(): Promise<number> {
  const response = await fetch(`${API_BASE}/count`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending action count: ${response.statusText}`);
  }

  const data = await response.json();
  return data.count || 0;
}

/**
 * Get a single pending action by ID
 */
export async function fetchPendingAction(actionId: string): Promise<PendingAction> {
  const response = await fetch(`${API_BASE}/${actionId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending action: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Approve a pending action
 */
export async function approvePendingAction(actionId: string): Promise<PendingAction> {
  const response = await fetch(`${API_BASE}/${actionId}/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to approve action: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Reject a pending action
 */
export async function rejectPendingAction(
  actionId: string,
  reason?: string
): Promise<PendingAction> {
  const response = await fetch(`${API_BASE}/${actionId}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to reject action: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a pending action
 */
export async function deletePendingAction(actionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${actionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to delete action: ${response.statusText}`);
  }
}
