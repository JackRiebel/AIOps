'use client';

import { useState, useEffect } from 'react';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';
import { PermissionGate } from '@/components/rbac';
import type { Role, Permission } from '@/types';

interface RolesTabProps {
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  className?: string;
}

export default function RolesTab({ onError, onSuccess, className = '' }: RolesTabProps) {
  usePermissions(); // Hook required for permission context
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Internal error/success handlers that use either props or internal state
  const handleError = (msg: string) => {
    if (onError) {
      onError(msg);
    } else {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSuccess = (msg: string) => {
    if (onSuccess) {
      onSuccess(msg);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    priority: 0,
    permission_codes: [] as string[],
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial load only

  async function fetchRoles() {
    try {
      setLoading(true);
      const response = await fetch(`/api/rbac/roles`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPermissions() {
    try {
      const response = await fetch(`/api/rbac/permissions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setPermissions(data.permissions || []);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  }

  async function handleSave() {
    try {
      const url = isEditing && selectedRole
        ? `/api/rbac/roles/${selectedRole.id}`
        : `/api/rbac/roles`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save role');
      }

      handleSuccess(isEditing ? 'Role updated successfully' : 'Role created successfully');
      setShowModal(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to save role');
    }
  }

  // Reserved for future inline permission editing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function _handleUpdatePermissions(roleId: number, permissionCodes: string[]) {
    try {
      const response = await fetch(`/api/rbac/roles/${roleId}/permissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_codes: permissionCodes }),
      });

      if (!response.ok) throw new Error('Failed to update permissions');
      handleSuccess('Permissions updated successfully');
      fetchRoles();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to update permissions');
    }
  }

  async function handleDelete(roleId: number) {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`/api/rbac/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete role');
      }

      handleSuccess('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  }

  async function handleClone(role: Role) {
    const newName = prompt('Enter name for cloned role:', `${role.name}_copy`);
    if (!newName) return;

    try {
      const response = await fetch(
        `/api/rbac/roles/${role.id}/clone?new_name=${encodeURIComponent(newName)}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) throw new Error('Failed to clone role');
      handleSuccess('Role cloned successfully');
      fetchRoles();
    } catch (err) {
      handleError(err instanceof Error ? err.message : 'Failed to clone role');
    }
  }

  function openCreateModal() {
    setIsEditing(false);
    setSelectedRole(null);
    resetForm();
    setShowModal(true);
  }

  function openEditModal(role: Role) {
    setIsEditing(true);
    setSelectedRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      priority: role.priority,
      permission_codes: role.permissions,
    });
    setShowModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      priority: 0,
      permission_codes: [],
    });
  }

  function togglePermission(code: string) {
    setFormData(prev => ({
      ...prev,
      permission_codes: prev.permission_codes.includes(code)
        ? prev.permission_codes.filter(c => c !== code)
        : [...prev.permission_codes, code],
    }));
  }

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  function getPriorityBadge(priority: number) {
    if (priority >= 1000) return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20';
    if (priority >= 100) return 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20';
    if (priority >= 50) return 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
    if (priority >= 25) return 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
    return 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Internal error/success messages */}
      {error && !onError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {success && !onSuccess && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-green-400">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Role Management
        </h2>
        <PermissionGate permission={PERMISSIONS.RBAC_ROLES_MANAGE}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Role
          </button>
        </PermissionGate>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <div
            key={role.id}
            className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{role.display_name}</h3>
                  {role.is_system && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded">
                      SYSTEM
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{role.name}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityBadge(role.priority)}`}>
                P{role.priority}
              </span>
            </div>

            {role.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{role.description}</p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-500">{role.permission_count} permissions</span>
              <span className={`w-1.5 h-1.5 rounded-full ${role.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
              <span className="text-xs text-slate-500">{role.is_active ? 'Active' : 'Inactive'}</span>
            </div>

            {/* Permission tags preview */}
            <div className="flex flex-wrap gap-1 mb-3">
              {role.permissions.slice(0, 4).map(perm => (
                <span
                  key={perm}
                  className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 rounded"
                >
                  {perm}
                </span>
              ))}
              {role.permissions.length > 4 && (
                <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                  +{role.permissions.length - 4} more
                </span>
              )}
            </div>

            {/* Actions */}
            <PermissionGate permission={PERMISSIONS.RBAC_ROLES_MANAGE}>
              <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/30">
                <button
                  onClick={() => openEditModal(role)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleClone(role)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors"
                >
                  Clone
                </button>
                {!role.is_system && (
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </PermissionGate>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Role' : 'Create Role'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Role Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    disabled={isEditing && selectedRole?.is_system}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    placeholder="e.g., network_admin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                    placeholder="e.g., Network Administrator"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                  placeholder="Describe what this role is for..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Priority (higher = more authority)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={999}
                  className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              {/* Permissions Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  Permissions ({formData.permission_codes.length} selected)
                </label>
                <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700/50 rounded-lg p-3">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-2">
                        {category}
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {perms.map(perm => (
                          <label
                            key={perm.code}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.permission_codes.includes(perm.code)}
                              onChange={() => togglePermission(perm.code)}
                              className="rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500/50"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-300">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isEditing ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
