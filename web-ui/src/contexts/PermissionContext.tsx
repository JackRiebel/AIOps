'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { EffectivePermissions, RBACOrganization } from '@/types';

interface PermissionContextType {
  // Permission state
  permissions: Set<string>;
  roleIds: number[];
  roleNames: string[];
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;

  // Organization context
  currentOrganizationId: number | null;
  organizations: RBACOrganization[];
  setCurrentOrganization: (orgId: number | null) => void;

  // Permission checking
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (...permissionCodes: string[]) => boolean;
  hasAllPermissions: (...permissionCodes: string[]) => boolean;

  // Refresh permissions
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

// Permission constants for convenience
export const PERMISSIONS = {
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE_ROLES: 'users.manage_roles',

  // Incidents
  INCIDENTS_VIEW: 'incidents.view',
  INCIDENTS_CREATE: 'incidents.create',
  INCIDENTS_UPDATE: 'incidents.update',
  INCIDENTS_DELETE: 'incidents.delete',
  INCIDENTS_REFRESH: 'incidents.refresh',

  // Network
  NETWORK_VIEW: 'network.view',
  NETWORK_MANAGE: 'network.manage',
  NETWORK_DEVICES_VIEW: 'network.devices.view',
  NETWORK_DEVICES_MANAGE: 'network.devices.manage',

  // AI
  AI_CHAT: 'ai.chat',
  AI_SETTINGS: 'ai.settings',
  AI_COSTS_VIEW: 'ai.costs.view',
  AI_KNOWLEDGE_VIEW: 'ai.knowledge.view',
  AI_KNOWLEDGE_MANAGE: 'ai.knowledge.manage',

  // Audit
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // Admin
  ADMIN_SYSTEM_VIEW: 'admin.system.view',
  ADMIN_SYSTEM_MANAGE: 'admin.system.manage',
  ADMIN_SECURITY_VIEW: 'admin.security.view',
  ADMIN_SECURITY_MANAGE: 'admin.security.manage',
  ADMIN_EDIT_MODE: 'admin.edit_mode',

  // RBAC
  RBAC_PERMISSIONS_VIEW: 'rbac.permissions.view',
  RBAC_PERMISSIONS_MANAGE: 'rbac.permissions.manage',
  RBAC_ROLES_VIEW: 'rbac.roles.view',
  RBAC_ROLES_MANAGE: 'rbac.roles.manage',
  RBAC_ORGANIZATIONS_VIEW: 'rbac.organizations.view',
  RBAC_ORGANIZATIONS_MANAGE: 'rbac.organizations.manage',
  RBAC_DELEGATIONS_VIEW: 'rbac.delegations.view',
  RBAC_DELEGATIONS_MANAGE: 'rbac.delegations.manage',
  RBAC_REQUESTS_VIEW: 'rbac.requests.view',
  RBAC_REQUESTS_MANAGE: 'rbac.requests.manage',

  // Integrations
  INTEGRATIONS_VIEW: 'integrations.view',
  INTEGRATIONS_MANAGE: 'integrations.manage',
  INTEGRATIONS_SPLUNK: 'integrations.splunk',
  INTEGRATIONS_THOUSANDEYES: 'integrations.thousandeyes',

  // Workflows
  WORKFLOWS_VIEW: 'workflows.view',
  WORKFLOWS_CREATE: 'workflows.create',
  WORKFLOWS_EDIT: 'workflows.edit',
  WORKFLOWS_DELETE: 'workflows.delete',
  WORKFLOWS_APPROVE: 'workflows.approve',
  WORKFLOWS_EXECUTE: 'workflows.execute',
  WORKFLOWS_RECORD_OUTCOME: 'workflows.record_outcome',
  WORKFLOWS_ADMIN: 'workflows.admin',
} as const;

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentOrganizationId, setCurrentOrganizationId] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<RBACOrganization[]>([]);

  const fetchPermissions = useCallback(async () => {
    if (!isAuthenticated) {
      setPermissions(new Set());
      setRoleIds([]);
      setRoleNames([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's effective permissions
      const response = await fetch(`/api/rbac/me/permissions`, {
        credentials: 'include',
        headers: currentOrganizationId
          ? { 'X-Organization-ID': currentOrganizationId.toString() }
          : {},
      });

      if (!response.ok) {
        // If 403/401, user doesn't have RBAC permissions yet - use legacy role
        if (response.status === 401 || response.status === 403) {
          // Fall back to legacy role-based permissions
          const legacyPerms = getLegacyPermissions(user?.role);
          setPermissions(new Set(legacyPerms));
          setRoleIds([]);
          setRoleNames([user?.role || 'viewer']);
          setIsSuperAdmin(false);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch permissions');
      }

      const data: EffectivePermissions = await response.json();

      setPermissions(new Set(data.permissions));
      setRoleIds(data.role_ids);
      setRoleNames(data.role_names);
      setIsSuperAdmin(data.is_super_admin);

    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load permissions');

      // Fall back to legacy permissions on error
      if (user) {
        const legacyPerms = getLegacyPermissions(user.role);
        setPermissions(new Set(legacyPerms));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, currentOrganizationId]);

  const fetchOrganizations = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      return;
    }

    try {
      const response = await fetch(`/api/rbac/organizations`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  }, [isAuthenticated]);

  // Fetch permissions when auth state changes
  useEffect(() => {
    fetchPermissions();
    fetchOrganizations();
  }, [fetchPermissions, fetchOrganizations]);

  // Re-fetch when organization changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchPermissions();
    }
  }, [currentOrganizationId, isAuthenticated, fetchPermissions]);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    // Super admins have all permissions
    if (isSuperAdmin) return true;
    return permissions.has(permissionCode);
  }, [permissions, isSuperAdmin]);

  const hasAnyPermission = useCallback((...permissionCodes: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionCodes.some(code => permissions.has(code));
  }, [permissions, isSuperAdmin]);

  const hasAllPermissions = useCallback((...permissionCodes: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionCodes.every(code => permissions.has(code));
  }, [permissions, isSuperAdmin]);

  const setCurrentOrganization = useCallback((orgId: number | null) => {
    setCurrentOrganizationId(orgId);
    // Store in localStorage for persistence
    if (orgId) {
      localStorage.setItem('currentOrganizationId', orgId.toString());
    } else {
      localStorage.removeItem('currentOrganizationId');
    }
  }, []);

  // Load organization from localStorage on mount
  useEffect(() => {
    const storedOrgId = localStorage.getItem('currentOrganizationId');
    if (storedOrgId) {
      setCurrentOrganizationId(parseInt(storedOrgId, 10));
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  const value: PermissionContextType = {
    permissions,
    roleIds,
    roleNames,
    isSuperAdmin,
    loading,
    error,
    currentOrganizationId,
    organizations,
    setCurrentOrganization,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Hook for checking a single permission
export function useHasPermission(permissionCode: string): boolean {
  const { hasPermission, loading } = usePermissions();
  if (loading) return false;
  return hasPermission(permissionCode);
}

// Hook for requiring a permission (throws if not present)
export function useRequirePermission(permissionCode: string): void {
  const { hasPermission, loading } = usePermissions();
  if (!loading && !hasPermission(permissionCode)) {
    throw new Error(`Permission denied: ${permissionCode}`);
  }
}

// Legacy role to permission mapping for backwards compatibility
function getLegacyPermissions(role?: string): string[] {
  const viewerPermissions = [
    // Viewers can view everything (fixing the bug mentioned in requirements)
    PERMISSIONS.INCIDENTS_VIEW,
    PERMISSIONS.NETWORK_VIEW,
    PERMISSIONS.NETWORK_DEVICES_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AI_CHAT,
    PERMISSIONS.AI_COSTS_VIEW,
    PERMISSIONS.AI_KNOWLEDGE_VIEW,
    PERMISSIONS.ADMIN_SYSTEM_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.INTEGRATIONS_VIEW,
    PERMISSIONS.INTEGRATIONS_SPLUNK,
    PERMISSIONS.INTEGRATIONS_THOUSANDEYES,
    PERMISSIONS.RBAC_PERMISSIONS_VIEW,
    PERMISSIONS.RBAC_ROLES_VIEW,
    PERMISSIONS.RBAC_ORGANIZATIONS_VIEW,
    // Workflows
    PERMISSIONS.WORKFLOWS_VIEW,
  ];

  const operatorPermissions = [
    ...viewerPermissions,
    PERMISSIONS.INCIDENTS_REFRESH,
    // Workflows
    PERMISSIONS.WORKFLOWS_APPROVE,
    PERMISSIONS.WORKFLOWS_EXECUTE,
  ];

  const editorPermissions = [
    ...operatorPermissions,
    PERMISSIONS.INCIDENTS_CREATE,
    PERMISSIONS.INCIDENTS_UPDATE,
    PERMISSIONS.NETWORK_MANAGE,
    PERMISSIONS.NETWORK_DEVICES_MANAGE,
    PERMISSIONS.AI_SETTINGS,
    PERMISSIONS.AI_KNOWLEDGE_MANAGE,
    PERMISSIONS.AUDIT_EXPORT,
    // Workflows
    PERMISSIONS.WORKFLOWS_CREATE,
    PERMISSIONS.WORKFLOWS_EDIT,
  ];

  const adminPermissions = [
    ...editorPermissions,
    PERMISSIONS.INCIDENTS_DELETE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_MANAGE_ROLES,
    PERMISSIONS.ADMIN_SYSTEM_MANAGE,
    PERMISSIONS.ADMIN_SECURITY_VIEW,
    PERMISSIONS.ADMIN_SECURITY_MANAGE,
    PERMISSIONS.ADMIN_EDIT_MODE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.RBAC_PERMISSIONS_MANAGE,
    PERMISSIONS.RBAC_ROLES_MANAGE,
    PERMISSIONS.RBAC_ORGANIZATIONS_MANAGE,
    PERMISSIONS.RBAC_DELEGATIONS_VIEW,
    PERMISSIONS.RBAC_DELEGATIONS_MANAGE,
    PERMISSIONS.RBAC_REQUESTS_VIEW,
    PERMISSIONS.RBAC_REQUESTS_MANAGE,
    // Workflows
    PERMISSIONS.WORKFLOWS_DELETE,
    PERMISSIONS.WORKFLOWS_ADMIN,
  ];

  switch (role) {
    case 'admin':
      return adminPermissions;
    case 'editor':
      return editorPermissions;
    case 'operator':
      return operatorPermissions;
    case 'viewer':
    default:
      return viewerPermissions;
  }
}
