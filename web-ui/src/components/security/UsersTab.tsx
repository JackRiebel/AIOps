'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Shield,
  Building2,
  Key,
  UserCog,
  Crown,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';
import { PermissionGate } from '@/components/rbac';
import type { User, UserRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  priority: number;
  is_system: boolean;
}

interface Organization {
  id: number;
  name: string;
  display_name: string;
}

interface UserOrganization {
  organization_id: number;
  organization_name: string;
  role_id: number;
  role_name: string;
}

interface UserWithRBAC extends User {
  is_super_admin: boolean;
  primary_organization_id: number | null;
  organizations: UserOrganization[];
}

interface CreateUserFormData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  full_name: string;
  is_super_admin: boolean;
  primary_organization_id: number | null;
}

// ============================================================================
// UsersTab Component
// ============================================================================

export default function UsersTab() {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin } = usePermissions();

  // State
  const [users, setUsers] = useState<UserWithRBAC[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_roles, setRoles] = useState<Role[]>([]); // Fetched for future use
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRBAC | null>(null);
  const [formData, setFormData] = useState<CreateUserFormData>({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
    full_name: '',
    is_super_admin: false,
    primary_organization_id: null,
  });

  // Permissions modal
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<UserWithRBAC | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();

      // Enrich users with RBAC data
      const enrichedUsers: UserWithRBAC[] = data.map((user: Partial<UserWithRBAC>) => ({
        ...user,
        is_super_admin: user.is_super_admin || false,
        primary_organization_id: user.primary_organization_id || null,
        organizations: user.organizations || [],
      }));

      setUsers(enrichedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/rbac/roles', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setRoles(data);
    } catch {
      // Silently fail - roles are optional enhancement
    }
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/rbac/organizations', { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      setOrganizations(data);
    } catch {
      // Silently fail - organizations are optional enhancement
    }
  }, []);

  const fetchUserPermissions = useCallback(async (userId: number) => {
    try {
      setLoadingPermissions(true);
      const response = await fetch(`/api/rbac/users/${userId}/permissions`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setUserPermissions(data.permissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user permissions');
      setUserPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchOrganizations();
  }, [fetchUsers, fetchRoles, fetchOrganizations]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCreateUser = async () => {
    try {
      setError(null);
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          full_name: formData.full_name || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to create user');
      }

      setSuccess('User created successfully');
      setShowModal(false);
      resetForm();
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      setError(null);
      const updateData: {
        email: string;
        role: UserRole;
        full_name?: string;
        password?: string;
        is_super_admin?: boolean;
      } = {
        email: formData.email,
        role: formData.role,
        full_name: formData.full_name || undefined,
      };
      if (formData.password) updateData.password = formData.password;

      // Update super admin status if current user is super admin
      if (isSuperAdmin && formData.is_super_admin !== editingUser.is_super_admin) {
        updateData.is_super_admin = formData.is_super_admin;
      }

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to update user');
      }

      setSuccess('User updated successfully');
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      setError(null);
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to delete user');
      }

      setSuccess('User deleted successfully');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (user: UserWithRBAC) => {
    try {
      setError(null);
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to update user status');
      }

      setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleToggleSuperAdmin = async (user: UserWithRBAC) => {
    if (!isSuperAdmin) return;
    if (user.id === currentUser?.id) {
      setError('You cannot remove your own super admin status');
      return;
    }

    const action = user.is_super_admin ? 'remove super admin status from' : 'grant super admin status to';
    if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) return;

    try {
      setError(null);
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_super_admin: !user.is_super_admin }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to update super admin status');
      }

      setSuccess(`Super admin status ${user.is_super_admin ? 'removed' : 'granted'} successfully`);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update super admin status');
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (user: UserWithRBAC) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      full_name: user.full_name || '',
      is_super_admin: user.is_super_admin,
      primary_organization_id: user.primary_organization_id,
    });
    setShowModal(true);
  };

  const openPermissionsModal = (user: UserWithRBAC) => {
    setSelectedUserPermissions(user);
    setShowPermissionsModal(true);
    fetchUserPermissions(user.id);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'viewer',
      full_name: '',
      is_super_admin: false,
      primary_organization_id: null,
    });
  };

  const toggleUserExpanded = (userId: number) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // ============================================================================
  // Filtering
  // ============================================================================

  const filteredUsers = users.filter(user => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.full_name && user.full_name.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;

    // Status filter
    if (statusFilter === 'active' && !user.is_active) return false;
    if (statusFilter === 'inactive' && user.is_active) return false;

    return true;
  });

  // ============================================================================
  // UI Helpers
  // ============================================================================

  const getRoleBadge = (role: UserRole, isSuperAdmin: boolean = false) => {
    if (isSuperAdmin) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30">
          <Crown className="w-3 h-3" />
          Super Admin
        </span>
      );
    }

    const config: Record<UserRole, string> = {
      admin: 'bg-red-500/10 text-red-400 border-red-500/20',
      editor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      operator: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${config[role] || config.viewer}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

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

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
          <p className="mt-3 text-slate-400 text-sm">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">User Management</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.USERS_CREATE}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="operator">Operator</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-3 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center">
            <UserCog className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700/30">
            {filteredUsers.map(user => (
              <div key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                {/* Main User Row */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Expand Button */}
                    <button
                      onClick={() => toggleUserExpanded(user.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {expandedUsers.has(user.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.username}</span>
                        {user.id === currentUser?.id && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] rounded font-medium">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 truncate">{user.email}</span>
                        {user.full_name && (
                          <>
                            <span className="text-slate-700">•</span>
                            <span className="text-xs text-slate-500 truncate">{user.full_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="hidden sm:block">
                      {getRoleBadge(user.role, user.is_super_admin)}
                    </div>

                    {/* Status */}
                    <div className="hidden md:block">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.is_active ? 'bg-green-500' : 'bg-slate-500'
                          }`}
                        />
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Last Login */}
                    <div className="hidden lg:block text-xs text-slate-500 w-24 text-right">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => openPermissionsModal(user)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                      title="View Permissions"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <PermissionGate permission={PERMISSIONS.USERS_UPDATE}>
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission={PERMISSIONS.USERS_UPDATE}>
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors ${
                          user.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-green-400 hover:text-green-300'
                        }`}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                    </PermissionGate>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleToggleSuperAdmin(user)}
                        disabled={user.id === currentUser?.id}
                        className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          user.is_super_admin ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-amber-400'
                        }`}
                        title={user.is_super_admin ? 'Remove Super Admin' : 'Grant Super Admin'}
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    )}
                    <PermissionGate permission={PERMISSIONS.USERS_DELETE}>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === currentUser?.id}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </PermissionGate>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedUsers.has(user.id) && (
                  <div className="px-4 pb-4 pl-16 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/30">
                      {/* Role Info */}
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Key className="w-3.5 h-3.5" />
                          Role
                        </div>
                        {getRoleBadge(user.role, user.is_super_admin)}
                        {user.is_super_admin && (
                          <p className="text-xs text-amber-400/70 mt-2">
                            Full access across all organizations
                          </p>
                        )}
                      </div>

                      {/* Organization Info */}
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Building2 className="w-3.5 h-3.5" />
                          Organizations
                        </div>
                        {user.organizations && user.organizations.length > 0 ? (
                          <div className="space-y-1">
                            {user.organizations.map((org, idx) => (
                              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300">
                                {org.organization_name}
                                <span className="text-slate-500 ml-1">({org.role_name})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {user.is_super_admin ? 'All organizations' : 'No organization assigned'}
                          </span>
                        )}
                      </div>

                      {/* Account Info */}
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Shield className="w-3.5 h-3.5" />
                          Account Details
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="text-slate-400">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                          </div>
                          {user.last_login && (
                            <div className="text-slate-400">
                              Last Login: {new Date(user.last_login).toLocaleString()}
                            </div>
                          )}
                          {user.mfa_enabled && (
                            <div className="text-green-400">MFA Enabled</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editingUser ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                  {editingUser ? (
                    <Edit2 className={`w-5 h-5 ${editingUser ? 'text-blue-400' : 'text-green-400'}`} />
                  ) : (
                    <Plus className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {editingUser ? 'Edit User' : 'Create New User'}
                  </h3>
                  {editingUser && (
                    <p className="text-xs text-slate-500">Editing {editingUser.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Account Information Section */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Account Information
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Username <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        disabled={!!editingUser}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        placeholder="johndoe"
                      />
                      {editingUser && (
                        <p className="text-[10px] text-slate-600 mt-1">Username cannot be changed</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Password {editingUser ? (
                        <span className="text-slate-600 font-normal">(leave blank to keep current)</span>
                      ) : (
                        <span className="text-red-400">*</span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      placeholder={editingUser ? '••••••••' : 'Min. 8 characters'}
                    />
                  </div>
                </div>
              </div>

              {/* Role & Permissions Section */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Role & Permissions
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      System Role <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Admin */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'admin' })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.role === 'admin'
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600/50'
                        }`}
                      >
                        <div className={`text-sm font-medium ${formData.role === 'admin' ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          Admin
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Full system access</div>
                      </button>

                      {/* Editor */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'editor' })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.role === 'editor'
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600/50'
                        }`}
                      >
                        <div className={`text-sm font-medium ${formData.role === 'editor' ? 'text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                          Editor
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Create & modify content</div>
                      </button>

                      {/* Operator */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'operator' })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.role === 'operator'
                            ? 'border-purple-500/50 bg-purple-500/10'
                            : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600/50'
                        }`}
                      >
                        <div className={`text-sm font-medium ${formData.role === 'operator' ? 'text-purple-400' : 'text-slate-900 dark:text-white'}`}>
                          Operator
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Limited operations</div>
                      </button>

                      {/* Viewer */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'viewer' })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.role === 'viewer'
                            ? 'border-slate-500/50 bg-slate-500/10'
                            : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600/50'
                        }`}
                      >
                        <div className={`text-sm font-medium ${formData.role === 'viewer' ? 'text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                          Viewer
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Read-only access</div>
                      </button>
                    </div>
                  </div>

                  {/* Organization Assignment */}
                  {organizations.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Primary Organization
                      </label>
                      <select
                        value={formData.primary_organization_id || ''}
                        onChange={e => setFormData({ ...formData, primary_organization_id: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                      >
                        <option value="">No organization</option>
                        {organizations.map(org => (
                          <option key={org.id} value={org.id}>
                            {org.display_name || org.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-600 mt-1">
                        The default organization for this user
                      </p>
                    </div>
                  )}

                  {/* Super Admin toggle - only for super admins */}
                  {isSuperAdmin && (
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      formData.is_super_admin
                        ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-yellow-500/10'
                        : 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${formData.is_super_admin ? 'bg-amber-500/20' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
                            <Crown className={`w-5 h-5 ${formData.is_super_admin ? 'text-amber-400' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${formData.is_super_admin ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                              Super Admin
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Bypass all permission checks, access all organizations
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_super_admin: !formData.is_super_admin })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.is_super_admin ? 'bg-amber-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              formData.is_super_admin ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {formData.is_super_admin && (
                        <div className="mt-3 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                          <p className="text-[10px] text-amber-400/80">
                            Warning: Super admins have unrestricted access to the entire system including all organizations and sensitive operations.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Mode: Account Status & Info */}
              {editingUser && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Account Status
                  </h4>
                  <div className="space-y-3">
                    {/* Account Status Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Created</div>
                        <div className="text-sm text-slate-900 dark:text-white">
                          {new Date(editingUser.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/30">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Last Login</div>
                        <div className="text-sm text-slate-900 dark:text-white">
                          {editingUser.last_login
                            ? new Date(editingUser.last_login).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        editingUser.is_active
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${editingUser.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {editingUser.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {editingUser.mfa_enabled && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Shield className="w-3 h-3" />
                          MFA Enabled
                        </span>
                      )}
                      {editingUser.is_super_admin && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Crown className="w-3 h-3" />
                          Super Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between sticky bottom-0 bg-white dark:bg-slate-900 z-10">
              <div className="text-xs text-slate-500">
                <span className="text-red-400">*</span> Required fields
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  disabled={!formData.username || !formData.email || (!editingUser && !formData.password)}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {editingUser ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Permissions Modal */}
      {showPermissionsModal && selectedUserPermissions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">User Permissions</h3>
                <p className="text-sm text-slate-400">{selectedUserPermissions.username}</p>
              </div>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedUserPermissions(null);
                  setUserPermissions([]);
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {loadingPermissions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                </div>
              ) : userPermissions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <p>No direct permissions assigned</p>
                  <p className="text-sm mt-1">Permissions are inherited from the user&apos;s role</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userPermissions.map((perm, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      {perm}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
