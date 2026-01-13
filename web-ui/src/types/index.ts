// Organization types (formerly Cluster)
export type OrganizationType = 'meraki' | 'thousandeyes' | 'splunk' | 'catalyst';

export interface Organization {
  id: number;
  name: string;
  display_name?: string;
  url: string;
  verify_ssl: boolean;
  is_active: boolean;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  name: string;
  display_name?: string;
  url: string;
  api_key: string;
  verify_ssl: boolean;
}

// Network Platform Organization (Meraki/Catalyst only)
export interface NetworkPlatformOrg {
  id: number;
  name: string;
  display_name?: string;
  platform: 'meraki' | 'catalyst';
  is_active: boolean;
}

// Security types
export interface SecurityConfig {
  edit_mode_enabled: boolean;
  allowed_operations: string[];
  audit_logging?: boolean;
}

// Audit log types
export interface AuditLog {
  id: number;
  organization_id?: number;
  organization_name?: string;
  organization_url?: string;
  user_id?: string;
  operation_id?: string;
  http_method: string;
  path?: string;
  request_body?: any;
  response_status?: number;
  response_body?: any;
  error_message?: string;
  timestamp: string;
  client_ip?: string;
}

export interface AuditStats {
  total: number;
  successful: number;
  failed: number;
  by_method: Record<string, number>;
  by_status: Record<string, number>;
}

// API types
export interface APIDefinition {
  name: string;
  display_name: string;
  base_path: string;
  description: string;
  enabled: boolean;
  operations_count?: number;
}

export interface APIHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  last_check: string;
  response_time_ms?: number;
}

// System types
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  response_time_ms?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: boolean;
  uptime_seconds: number;
  services: ServiceStatus[];
  timestamp: string;
}

export interface SystemStats {
  total_operations: number;
  organizations_configured: number;
  audit_logs_count: number;
  edit_mode_enabled: boolean;
}

// License types
export interface LicenseInfo {
  license_id: string;
  license_type: string;
  state: string;
  duration_in_days?: number;
  claim_date?: string;
  expiration_date?: string;
  device_serial?: string;
  network_id?: string;
  order_number?: string;
  seat_count?: number;
}

export interface OrganizationLicenses {
  organization_name: string;
  organization_id: string;
  licenses: LicenseInfo[];
  overview?: any;
  error?: string;
}

export interface UnifiedLicensesResponse {
  organizations: OrganizationLicenses[];
  total_licenses: number;
  total_organizations: number;
}

// Authentication types
export type UserRole = 'admin' | 'editor' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name?: string;
  is_active: boolean;
  mfa_enabled?: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  full_name?: string;
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role?: UserRole;
  full_name?: string;
  is_active?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user?: User;
  message: string;
  // MFA fields (when MFA is required)
  mfa_required?: boolean;
  challenge_id?: string;
  methods?: string[];
  user_id?: number;
  username?: string;
  enrollment_required?: boolean;
}

// ===================================================================
// RBAC Types
// ===================================================================

export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  resource_type?: string;
  is_system: boolean;
  created_at?: string;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  organization_id?: number;
  permission_count: number;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface RBACOrganization {
  id: number;
  name: string;
  display_name?: string;
  slug: string;
  parent_organization_id?: number;
  settings: Record<string, any>;
  is_active: boolean;
  member_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserOrganizationMembership {
  id: number;
  user_id: number;
  username?: string;
  organization_id: number;
  organization_name?: string;
  organization_slug?: string;
  role_id: number;
  role_name?: string;
  is_primary: boolean;
  joined_at?: string;
}

export interface EffectivePermissions {
  user_id: number;
  username: string;
  is_super_admin: boolean;
  organization_id?: number;
  permissions: string[];
  role_ids: number[];
  role_names: string[];
  direct_permissions: string[];
  delegated_permissions: string[];
}

export interface Delegation {
  id: number;
  delegator_id: number;
  delegator_name?: string;
  delegate_id: number;
  delegate_name?: string;
  organization_id?: number;
  organization_name?: string;
  scope: {
    permissions?: string[];
    resources?: string[];
  };
  starts_at: string;
  ends_at: string;
  reason?: string;
  is_active: boolean;
  is_effective: boolean;
  is_expired: boolean;
  created_at: string;
  revoked_at?: string;
}

export interface RoleChangeRequest {
  id: number;
  requester_id: number;
  requester_name?: string;
  target_user_id: number;
  target_user_name?: string;
  current_role_id?: number;
  current_role_name?: string;
  requested_role_id: number;
  requested_role_name?: string;
  organization_id?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id?: number;
  reviewer_name?: string;
  review_notes?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface AccessRestriction {
  id: number;
  user_id?: number;
  organization_id?: number;
  restriction_type: 'ip_whitelist' | 'ip_blacklist' | 'geo_allow' | 'geo_deny' | 'time_window';
  name?: string;
  value: Record<string, any>;
  is_active: boolean;
  priority: number;
  created_at: string;
  created_by?: number;
}

export interface PermissionAuditLog {
  id: number;
  user_id?: number;
  username?: string;
  action: string;
  permission_code?: string;
  resource_type?: string;
  resource_id?: string;
  organization_id?: number;
  result?: boolean;
  reason?: string;
  ip_address?: string;
  timestamp: string;
}

// Permission category grouping for UI
export interface PermissionCategory {
  name: string;
  permissions: Permission[];
}

// Create/Update types for RBAC
export interface CreateRoleRequest {
  name: string;
  display_name: string;
  description?: string;
  permission_codes: string[];
  organization_id?: number;
  priority?: number;
}

export interface UpdateRoleRequest {
  display_name?: string;
  description?: string;
  priority?: number;
  is_active?: boolean;
}

export interface CreateOrganizationRBACRequest {
  name: string;
  display_name?: string;
  slug: string;
  parent_organization_id?: number;
  settings?: Record<string, any>;
}

export interface CreateDelegationRequest {
  delegate_id: number;
  organization_id?: number;
  scope: {
    permissions?: string[];
    resources?: string[];
  };
  ends_at: string;
  reason?: string;
}

export interface CreateRoleChangeRequest {
  target_user_id: number;
  requested_role_id: number;
  reason: string;
  organization_id?: number;
}

export interface CreateAccessRestrictionRequest {
  user_id?: number;
  organization_id?: number;
  restriction_type: 'ip_whitelist' | 'ip_blacklist' | 'geo_allow' | 'geo_deny' | 'time_window';
  name?: string;
  value: Record<string, any>;
  priority?: number;
}
