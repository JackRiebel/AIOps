'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/contexts/PermissionContext';

interface PermissionGateProps {
  children: ReactNode;
  /** Single permission required */
  permission?: string;
  /** Multiple permissions - user must have ALL */
  permissions?: string[];
  /** Multiple permissions - user must have ANY */
  anyPermission?: string[];
  /** Fallback component when permission denied */
  fallback?: ReactNode;
  /** Show nothing when denied (default: true) */
  hideWhenDenied?: boolean;
  /** Loading placeholder */
  loadingPlaceholder?: ReactNode;
}

/**
 * PermissionGate - Conditionally render children based on user permissions.
 *
 * Usage:
 * ```tsx
 * // Single permission
 * <PermissionGate permission="users.manage">
 *   <AdminOnlyContent />
 * </PermissionGate>
 *
 * // Multiple permissions (ALL required)
 * <PermissionGate permissions={["users.view", "users.manage"]}>
 *   <UserManagement />
 * </PermissionGate>
 *
 * // Multiple permissions (ANY required)
 * <PermissionGate anyPermission={["admin.system.view", "admin.security.view"]}>
 *   <AdminDashboard />
 * </PermissionGate>
 *
 * // With fallback
 * <PermissionGate permission="admin.system.manage" fallback={<AccessDenied />}>
 *   <SystemSettings />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  children,
  permission,
  permissions,
  anyPermission,
  fallback = null,
  hideWhenDenied = true,
  loadingPlaceholder = null,
}: PermissionGateProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission, loading } = usePermissions();

  // Show loading state
  if (loading) {
    return <>{loadingPlaceholder}</>;
  }

  // Check permissions
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = hasAllPermissions(...permissions);
  } else if (anyPermission && anyPermission.length > 0) {
    hasAccess = hasAnyPermission(...anyPermission);
  } else {
    // No permission specified - allow access
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Permission denied
  if (hideWhenDenied && !fallback) {
    return null;
  }

  return <>{fallback}</>;
}

/**
 * SuperAdminGate - Only renders for super admins
 */
export function SuperAdminGate({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isSuperAdmin, loading } = usePermissions();

  if (loading) return null;
  if (isSuperAdmin) return <>{children}</>;
  return <>{fallback}</>;
}

/**
 * OrganizationGate - Only renders when in a specific organization context
 */
export function OrganizationGate({
  children,
  organizationId,
  fallback = null,
}: {
  children: ReactNode;
  organizationId?: number;
  fallback?: ReactNode;
}) {
  const { currentOrganizationId, loading } = usePermissions();

  if (loading) return null;

  // If specific org required, check it matches
  if (organizationId !== undefined) {
    if (currentOrganizationId === organizationId) {
      return <>{children}</>;
    }
    return <>{fallback}</>;
  }

  // Just check that we have an org context
  if (currentOrganizationId !== null) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

export default PermissionGate;
