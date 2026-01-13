'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  Key,
  UserCheck,
  FileText,
  Lock,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { SecurityConfig } from '@/types';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';
import { PermissionGate } from '@/components/rbac';
import {
  UsersTab,
  RolesTab,
  PermissionsTab,
  DelegationsTab,
  RequestsTab,
  RestrictionsTab,
} from '@/components/security';

type TabType = 'users' | 'roles' | 'permissions' | 'delegations' | 'requests' | 'restrictions' | 'settings';

const TABS: { id: TabType; label: string; icon: React.ElementType; permission?: string }[] = [
  { id: 'users', label: 'Users & Access', icon: Users, permission: PERMISSIONS.USERS_VIEW },
  { id: 'roles', label: 'Roles', icon: Key, permission: PERMISSIONS.RBAC_ROLES_VIEW },
  { id: 'permissions', label: 'Permissions', icon: Shield, permission: PERMISSIONS.RBAC_PERMISSIONS_VIEW },
  { id: 'delegations', label: 'Delegations', icon: UserCheck, permission: PERMISSIONS.RBAC_DELEGATIONS_VIEW },
  { id: 'requests', label: 'Requests', icon: FileText, permission: PERMISSIONS.RBAC_REQUESTS_VIEW },
  { id: 'restrictions', label: 'Restrictions', icon: Lock, permission: PERMISSIONS.ADMIN_SECURITY_VIEW },
  { id: 'settings', label: 'Settings', icon: Settings, permission: PERMISSIONS.ADMIN_SECURITY_VIEW },
];

export default function SecurityPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get accessible tabs based on permissions
  const accessibleTabs = TABS.filter(tab => !tab.permission || hasPermission(tab.permission));

  // Set initial tab to first accessible tab
  useEffect(() => {
    if (!permissionsLoading && accessibleTabs.length > 0) {
      const currentTabAccessible = accessibleTabs.some(t => t.id === activeTab);
      if (!currentTabAccessible) {
        setActiveTab(accessibleTabs[0].id);
      }
    }
  }, [permissionsLoading, accessibleTabs, activeTab]);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSecurityConfig();
    }
  }, [activeTab]);

  async function fetchSecurityConfig() {
    try {
      setLoading(true);
      const data = await apiClient.getSecurityConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load security configuration:', err);
      setError('Failed to load security configuration');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAuditLogging() {
    if (!config) return;
    try {
      setError(null);
      setSuccess(null);
      const updated = await apiClient.updateSecurityConfig({ audit_logging: !config.audit_logging });
      setConfig(updated);
      setSuccess(`Audit logging ${updated.audit_logging ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  // Clear alerts after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="h-full bg-slate-900 overflow-auto">
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Security & Access Control</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Manage users, roles, permissions, and security policies
            </p>
          </div>
        </div>

        {/* Global Alerts (for settings tab) */}
        {activeTab === 'settings' && error && (
          <div role="alert" className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <XCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error message"
              className="text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50 rounded"
            >
              <XCircle className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {activeTab === 'settings' && success && (
          <div role="status" className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
              <span className="text-sm text-green-400">{success}</span>
            </div>
            <button
              onClick={() => setSuccess(null)}
              aria-label="Dismiss success message"
              className="text-green-400 hover:text-green-300 focus:outline-none focus:ring-2 focus:ring-green-500/50 rounded"
            >
              <XCircle className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div
            role="tablist"
            aria-label="Security management sections"
            className="flex gap-1 border-b border-slate-700/50 overflow-x-auto"
          >
            {accessibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-slate-900 ${
                    isActive
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users">
              <PermissionGate permission={PERMISSIONS.USERS_VIEW} fallback={<AccessDeniedMessage />}>
                <UsersTab />
              </PermissionGate>
            </div>
          )}

          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div role="tabpanel" id="tabpanel-roles" aria-labelledby="tab-roles">
              <PermissionGate permission={PERMISSIONS.RBAC_ROLES_VIEW} fallback={<AccessDeniedMessage />}>
                <RolesTab />
              </PermissionGate>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div role="tabpanel" id="tabpanel-permissions" aria-labelledby="tab-permissions">
              <PermissionGate permission={PERMISSIONS.RBAC_PERMISSIONS_VIEW} fallback={<AccessDeniedMessage />}>
                <PermissionsTab />
              </PermissionGate>
            </div>
          )}

          {/* Delegations Tab */}
          {activeTab === 'delegations' && (
            <div role="tabpanel" id="tabpanel-delegations" aria-labelledby="tab-delegations">
              <PermissionGate permission={PERMISSIONS.RBAC_DELEGATIONS_VIEW} fallback={<AccessDeniedMessage />}>
                <DelegationsTab />
              </PermissionGate>
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div role="tabpanel" id="tabpanel-requests" aria-labelledby="tab-requests">
              <PermissionGate permission={PERMISSIONS.RBAC_REQUESTS_VIEW} fallback={<AccessDeniedMessage />}>
                <RequestsTab />
              </PermissionGate>
            </div>
          )}

          {/* Restrictions Tab */}
          {activeTab === 'restrictions' && (
            <div role="tabpanel" id="tabpanel-restrictions" aria-labelledby="tab-restrictions">
              <PermissionGate permission={PERMISSIONS.ADMIN_SECURITY_VIEW} fallback={<AccessDeniedMessage />}>
                <RestrictionsTab />
              </PermissionGate>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div role="tabpanel" id="tabpanel-settings" aria-labelledby="tab-settings">
              <PermissionGate permission={PERMISSIONS.ADMIN_SECURITY_VIEW} fallback={<AccessDeniedMessage />}>
                {loading ? (
                  <LoadingSpinner />
                ) : config ? (
                  <div className="space-y-6">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                      Security Configuration
                    </h2>

                    {/* Audit Logging Card */}
                    <div
                      className={`rounded-xl border p-6 ${
                        config.audit_logging
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-slate-800/30 border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-3 rounded-lg ${
                              config.audit_logging
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-slate-700/50 text-slate-400'
                            }`}
                          >
                            <FileText className="w-6 h-6" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Audit Logging</h3>
                            <p className="text-sm text-slate-400 mt-1">
                              {config.audit_logging
                                ? 'All API operations are being recorded for compliance.'
                                : 'No operation history is retained. Enable for production environments.'}
                            </p>
                          </div>
                        </div>
                        <PermissionGate permission={PERMISSIONS.ADMIN_SECURITY_MANAGE}>
                          <button
                            onClick={handleToggleAuditLogging}
                            aria-label={config.audit_logging ? 'Disable audit logging' : 'Enable audit logging'}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                              config.audit_logging
                                ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300 focus:ring-slate-500'
                                : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                            }`}
                          >
                            {config.audit_logging ? 'Disable' : 'Enable'}
                          </button>
                        </PermissionGate>
                      </div>
                    </div>

                    {/* Session Settings Card */}
                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-slate-700/50 text-slate-400">
                          <Lock className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Session Security</h3>
                          <p className="text-sm text-slate-400 mt-1">
                            Sessions expire after 24 hours of inactivity. HTTP-only secure cookies are used.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Password Policy Card */}
                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-slate-700/50 text-slate-400">
                          <Key className="w-6 h-6" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">Password Policy</h3>
                          <p className="text-sm text-slate-400 mt-1">
                            Passwords are hashed using bcrypt. Minimum 8 characters required.
                          </p>
                        </div>
                      </div>
                  </div>
                </div>
              ) : null}
              </PermissionGate>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent"></div>
        <p className="mt-3 text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Access Denied Message Component
function AccessDeniedMessage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-red-500/10 rounded-full mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Access Denied</h3>
      <p className="text-sm text-slate-400 max-w-md">
        You don&apos;t have permission to view this section. Contact your administrator if you believe this is an error.
      </p>
    </div>
  );
}
