import type { User, LoginRequest } from '@/types';

let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 401) {
    sessionExpiredHandler?.();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || `Request failed: ${response.status}`);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export const apiClient = {
  // Generic HTTP methods
  async get<T>(url: string): Promise<T> {
    return request<T>(url);
  },

  async put<T>(url: string, body?: unknown): Promise<T> {
    return request<T>(url, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  // Auth
  async login(credentials: LoginRequest) {
    return request<{ user?: User; mfa_required?: boolean; challenge_id?: string; message?: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(credentials) }
    );
  },

  async logout() {
    await request<void>('/api/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  // Organizations & Networks
  async getOrganizations() {
    return request<any[]>('/api/network/organizations');
  },

  async getNetworkPlatformOrgs() {
    return request<any[]>('/api/network/platform-orgs');
  },

  async listNetworks(organizationName: string) {
    return request<any>('/api/network/list', {
      method: 'POST',
      body: JSON.stringify({ organization: organizationName, type: 'networks' }),
    });
  },

  async listDevices(organizationName: string) {
    return request<any>('/api/network/list', {
      method: 'POST',
      body: JSON.stringify({ organization: organizationName, type: 'devices' }),
    });
  },

  async getMerakiNetworks(organizationName: string) {
    return request<any[]>(`/api/meraki/networks?organization=${encodeURIComponent(organizationName)}`);
  },

  // Network Topology & Visualization
  async getNetworkTopology(organizationName: string, networkId: string, includeClients = false) {
    return request<any>(
      `/api/network/topology?organization=${encodeURIComponent(organizationName)}&network_id=${encodeURIComponent(networkId)}&include_clients=${includeClients}`
    );
  },

  async getNetworkPerformance(organizationName: string, networkId: string, timespan: number) {
    return request<any>(
      `/api/network/performance?organization=${encodeURIComponent(organizationName)}&network_id=${encodeURIComponent(networkId)}&timespan=${timespan}`
    );
  },

  async getDeviceHealth(organizationName: string, serial: string, timespan: number) {
    return request<any>(
      `/api/network/device-health?organization=${encodeURIComponent(organizationName)}&serial=${encodeURIComponent(serial)}&timespan=${timespan}`
    );
  },

  async getOrgVpnTopology(organizationName: string, organizationId: string) {
    return request<any>(
      `/api/network/vpn-topology?organization=${encodeURIComponent(organizationName)}&organization_id=${encodeURIComponent(organizationId)}`
    );
  },

  // Device Operations
  async rebootDevice(organizationName: string, serial: string) {
    return request<any>('/api/network/device/reboot', {
      method: 'POST',
      body: JSON.stringify({ organization: organizationName, serial }),
    });
  },

  async removeDevice(organizationName: string, serial: string) {
    return request<any>('/api/network/device/remove', {
      method: 'POST',
      body: JSON.stringify({ organization: organizationName, serial }),
    });
  },

  // System Config
  async getSystemConfig() {
    return request<{ configs: Record<string, any> }>('/api/admin/config');
  },

  async updateSystemConfig(key: string, value: string) {
    return request<void>('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  },

  async deleteSystemConfig(key: string) {
    return request<void>(`/api/admin/config/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  },

  async testIntegration(integration: 'anthropic' | 'openai' | 'google' | 'meraki' | 'catalyst' | 'thousandeyes' | 'splunk' | 'slack' | 'teams' | 'email') {
    return request<{ success: boolean; message: string }>(`/api/admin/test/${integration}`, {
      method: 'POST',
    });
  },

  // Health & Status
  async getHealth() {
    return request<any>('/api/health');
  },

  async getLicenses() {
    return request<any>('/api/licenses');
  },

  // Security
  async getSecurityConfig() {
    return request<any>('/api/security/config');
  },

  async updateSecurityConfig(config: Record<string, any>) {
    return request<any>('/api/security/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  // Audit
  async getAuditLogs(params: { limit?: number; offset?: number; user_id?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));
    if (params.user_id) searchParams.set('user_id', String(params.user_id));
    const qs = searchParams.toString();
    return request<any[]>(`/api/audit/logs${qs ? `?${qs}` : ''}`);
  },

  async getAuditStats() {
    return request<any>('/api/audit/stats');
  },

  // Knowledge Base
  async getKnowledgeDocuments(options: { doc_type?: string; product?: string; limit?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (options.doc_type) searchParams.set('doc_type', options.doc_type);
    if (options.product) searchParams.set('product', options.product);
    if (options.limit) searchParams.set('limit', String(options.limit));
    const qs = searchParams.toString();
    return request<any[]>(`/api/knowledge/documents${qs ? `?${qs}` : ''}`);
  },

  async getKnowledgeStats() {
    return request<any>('/api/knowledge/stats');
  },

  async uploadKnowledgeDocument(file: File, metadata: { doc_type: string; product?: string; title?: string; description?: string; version?: string }) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    const response = await fetch('/api/knowledge/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (response.status === 401) {
      sessionExpiredHandler?.();
      throw new Error('Session expired');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Upload failed');
    }
  },

  async ingestKnowledgeFromUrl(options: { url: string; doc_type: string; product?: string; title?: string; description?: string }) {
    return request<void>('/api/knowledge/ingest-url', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async deleteKnowledgeDocument(docId: number) {
    return request<void>(`/api/knowledge/documents/${docId}`, {
      method: 'DELETE',
    });
  },

  async getDocumentChunks(docId: number) {
    return request<any[]>(`/api/knowledge/documents/${docId}/chunks`);
  },

  async searchKnowledge(options: { query: string; top_k: number; filters?: { doc_type?: string; product?: string } }) {
    return request<any[]>('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async queryKnowledge(options: { query: string; top_k: number; filters?: { doc_type?: string; product?: string } }) {
    return request<any>('/api/knowledge/query', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  },

  async submitKnowledgeFeedback(feedback: { query: string; feedback_type: 'positive' | 'negative'; feedback_target: 'search_result' | 'ai_answer'; chunk_id?: number; metadata?: Record<string, any> }) {
    return request<void>('/api/knowledge/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  },

  // AI Settings
  async getAvailableModels() {
    return request<{ models: string[] }>('/api/ai/models');
  },

  async getUserModel() {
    return request<{ model: string }>('/api/ai/model');
  },

  async setUserModel(model: string) {
    return request<void>('/api/ai/model', {
      method: 'PUT',
      body: JSON.stringify({ model }),
    });
  },

  async getAISettings() {
    return request<{ temperature: number; max_tokens: number }>('/api/ai/settings');
  },

  async updateAISettings(settings: { temperature?: number; max_tokens?: number }) {
    return request<void>('/api/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getAPIKeyStatus() {
    return request<{ configured: boolean; provider: string }>('/api/ai/key-status');
  },

  // Setup
  async createSetupAdmin(adminData: { username: string; password: string; email?: string }) {
    return request<{ success: boolean }>('/api/setup/admin-user', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  },
};
