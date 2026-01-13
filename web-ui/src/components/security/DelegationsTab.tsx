'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Clock,
  AlertTriangle,
  Trash2,
  Calendar,
  User,
  ArrowRight,
  Shield,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { Delegation, Permission } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface DelegationsTabProps {
  className?: string;
}

interface UserBasic {
  id: number;
  username: string;
  email: string;
  display_name?: string;
}

export function DelegationsTab({ className = '' }: DelegationsTabProps) {
  const { user: currentUser } = useAuth();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'expired' | 'revoked'>('all');

  useEffect(() => {
    fetchDelegations();
  }, []);

  const fetchDelegations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rbac/delegations', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch delegations');
      }

      const data = await response.json();
      setDelegations(data.delegations || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load delegations');
    } finally {
      setLoading(false);
    }
  };

  const revokeDelegation = async (delegationId: number) => {
    if (!confirm('Are you sure you want to revoke this delegation?')) return;

    try {
      const response = await fetch(`/api/rbac/delegations/${delegationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke delegation');
      }

      setDelegations(prev =>
        prev.map(d =>
          d.id === delegationId ? { ...d, revoked_at: new Date().toISOString() } : d
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke delegation');
    }
  };

  const getStatusBadge = (delegation: Delegation) => {
    const now = new Date();
    const startDate = new Date(delegation.starts_at);
    const endDate = new Date(delegation.ends_at);

    if (delegation.revoked_at) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          <XCircle className="h-3 w-3" />
          Revoked
        </span>
      );
    }

    if (now < startDate) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    }

    if (now > endDate) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
        <CheckCircle className="h-3 w-3" />
        Active
      </span>
    );
  };

  const getDelegationStatus = (delegation: Delegation): string => {
    if (delegation.revoked_at) return 'revoked';
    const now = new Date();
    const startDate = new Date(delegation.starts_at);
    const endDate = new Date(delegation.ends_at);
    if (now < startDate) return 'pending';
    if (now > endDate) return 'expired';
    return 'active';
  };

  const filteredDelegations = delegations.filter(delegation => {
    const status = getDelegationStatus(delegation);
    if (statusFilter !== 'all' && status !== statusFilter) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        delegation.delegator_name?.toLowerCase().includes(query) ||
        delegation.delegate_name?.toLowerCase().includes(query) ||
        delegation.reason?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    return true;
  });

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      if (diffHours > -24) return `${Math.abs(diffHours)} hours ago`;
      return `${Math.abs(diffDays)} days ago`;
    } else {
      if (diffHours < 24) return `in ${diffHours} hours`;
      return `in ${diffDays} days`;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading delegations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchDelegations}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Permission Delegations</h2>
          <p className="text-sm text-gray-400 mt-1">
            Temporarily grant your permissions to other users
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Delegation
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium">About Permission Delegations</p>
          <p className="mt-1 text-blue-300/80">
            Delegations allow you to temporarily grant your permissions to another user.
            This is useful for covering during vacations, emergencies, or task handoffs.
            Delegations have a start and end time and can be revoked at any time.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {(['all', 'active', 'pending', 'expired', 'revoked'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Delegations List */}
      {filteredDelegations.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-12 text-center">
          <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No Delegations Found</h3>
          <p className="text-gray-400 mb-4">
            {statusFilter !== 'all'
              ? `No ${statusFilter} delegations found.`
              : 'Create a delegation to temporarily grant your permissions to another user.'}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create First Delegation
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700">
          {filteredDelegations.map(delegation => (
            <DelegationRow
              key={delegation.id}
              delegation={delegation}
              currentUserId={currentUser?.id}
              getStatusBadge={getStatusBadge}
              formatDateTime={formatDateTime}
              formatRelativeTime={formatRelativeTime}
              onRevoke={() => revokeDelegation(delegation.id)}
            />
          ))}
        </div>
      )}

      {/* Create Delegation Modal */}
      {showCreateModal && (
        <CreateDelegationModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchDelegations();
          }}
        />
      )}
    </div>
  );
}

// Delegation Row Component
interface DelegationRowProps {
  delegation: Delegation;
  currentUserId?: number;
  getStatusBadge: (delegation: Delegation) => React.ReactNode;
  formatDateTime: (dateString: string) => string;
  formatRelativeTime: (dateString: string) => string;
  onRevoke: () => void;
}

function DelegationRow({
  delegation,
  currentUserId,
  getStatusBadge,
  formatDateTime,
  formatRelativeTime,
  onRevoke,
}: DelegationRowProps) {
  const isMyDelegation = delegation.delegator_id === currentUserId;
  const canRevoke = isMyDelegation && !delegation.revoked_at;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Delegator -> Delegatee */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {delegation.delegator_name || `User ${delegation.delegator_id}`}
                </p>
                <p className="text-xs text-gray-500">Delegator</p>
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-gray-500" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {delegation.delegate_name || `User ${delegation.delegate_id}`}
                </p>
                <p className="text-xs text-gray-500">Delegatee</p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="hidden lg:flex items-center gap-2">
            <Shield className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              {delegation.scope?.permissions?.length || 0} permissions
            </span>
          </div>

          {/* Time Range */}
          <div className="hidden md:flex flex-col text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="h-3 w-3" />
              <span>{formatDateTime(delegation.starts_at)}</span>
              <span>→</span>
              <span>{formatDateTime(delegation.ends_at)}</span>
            </div>
            <span className="text-xs text-gray-500">
              Expires {formatRelativeTime(delegation.ends_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {getStatusBadge(delegation)}
          {canRevoke && (
            <button
              onClick={onRevoke}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Revoke delegation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Reason */}
      {delegation.reason && (
        <div className="mt-3 pl-11">
          <p className="text-sm text-gray-400 italic">&ldquo;{delegation.reason}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

// Create Delegation Modal
interface CreateDelegationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateDelegationModal({ onClose, onCreated }: CreateDelegationModalProps) {
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, permsRes] = await Promise.all([
          fetch('/api/auth/users', { credentials: 'include' }),
          fetch('/api/rbac/permissions', { credentials: 'include' }),
        ]);

        if (usersRes.ok) {
          const userData = await usersRes.json();
          setUsers(userData.users || userData || []);
        }

        if (permsRes.ok) {
          const permsData = await permsRes.json();
          setPermissions(permsData.permissions || permsData || []);
        }

        // Set default dates
        const now = new Date();
        const start = now.toISOString().slice(0, 16);
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
        setStartsAt(start);
        setExpiresAt(end);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || selectedPermissions.length === 0) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/rbac/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          delegate_id: selectedUserId,
          permission_codes: selectedPermissions,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(expiresAt).toISOString(),
          reason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create delegation');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create delegation');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (code: string) => {
    setSelectedPermissions(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(permissions.map(p => p.code));
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    const category = perm.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Create Permission Delegation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Select User */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Delegate to User *
                </label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.display_name || user.username} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Expires At *
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Covering during vacation..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">
                    Permissions to Delegate *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <span className="text-gray-500">|</span>
                    <button
                      type="button"
                      onClick={clearAllPermissions}
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg border border-gray-600 max-h-64 overflow-auto">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="border-b border-gray-600 last:border-b-0">
                      <div className="px-3 py-2 bg-gray-700/50 text-xs font-medium text-gray-400 uppercase">
                        {category}
                      </div>
                      <div className="p-2 grid grid-cols-2 gap-1">
                        {perms.map(perm => (
                          <label
                            key={perm.code}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-600/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.code)}
                              onChange={() => togglePermission(perm.code)}
                              className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                            />
                            <span className="text-sm text-gray-300">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedPermissions.length} permissions selected
                </p>
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || submitting || !selectedUserId || selectedPermissions.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Delegation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DelegationsTab;
