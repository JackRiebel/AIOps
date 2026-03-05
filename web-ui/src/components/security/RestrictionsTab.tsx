'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  Trash2,
  Edit2,
  Globe,
  Clock,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Save,
  X,
} from 'lucide-react';
import { AccessRestriction } from '@/types';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';

interface RestrictionsTabProps {
  className?: string;
}

type RestrictionType = 'ip_whitelist' | 'ip_blacklist' | 'geo_allow' | 'geo_deny' | 'time_window';

const RESTRICTION_TYPES: { value: RestrictionType; label: string; icon: typeof Wifi; description: string }[] = [
  { value: 'ip_whitelist', label: 'IP Whitelist', icon: Wifi, description: 'Only allow access from specific IPs' },
  { value: 'ip_blacklist', label: 'IP Blacklist', icon: WifiOff, description: 'Block access from specific IPs' },
  { value: 'geo_allow', label: 'Geo Allow', icon: MapPin, description: 'Only allow access from specific countries' },
  { value: 'geo_deny', label: 'Geo Deny', icon: Globe, description: 'Block access from specific countries' },
  { value: 'time_window', label: 'Time Window', icon: Clock, description: 'Only allow access during specific hours' },
];

export function RestrictionsTab({ className = '' }: RestrictionsTabProps) {
  const { hasPermission } = usePermissions();
  const [restrictions, setRestrictions] = useState<AccessRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRestriction, setEditingRestriction] = useState<AccessRestriction | null>(null);

  const canManage = hasPermission(PERMISSIONS.ADMIN_SECURITY_MANAGE);

  useEffect(() => {
    fetchRestrictions();
  }, []);

  const fetchRestrictions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rbac/restrictions', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch restrictions');
      }

      const data = await response.json();
      setRestrictions(data.restrictions || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load restrictions');
    } finally {
      setLoading(false);
    }
  };

  const deleteRestriction = async (restrictionId: number) => {
    if (!confirm('Are you sure you want to delete this restriction?')) return;

    try {
      const response = await fetch(`/api/rbac/restrictions/${restrictionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete restriction');
      }

      setRestrictions(prev => prev.filter(r => r.id !== restrictionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete restriction');
    }
  };

  const toggleRestriction = async (restriction: AccessRestriction) => {
    try {
      const response = await fetch(`/api/rbac/restrictions/${restriction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !restriction.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update restriction');
      }

      setRestrictions(prev =>
        prev.map(r =>
          r.id === restriction.id ? { ...r, is_active: !r.is_active } : r
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update restriction');
    }
  };

  const getTypeConfig = (type: string) => {
    return RESTRICTION_TYPES.find(t => t.value === type) || {
      value: type,
      label: type,
      icon: Shield,
      description: '',
    };
  };

  const filteredRestrictions = restrictions.filter(restriction => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const config = getTypeConfig(restriction.restriction_type);
      return (
        config.label.toLowerCase().includes(query) ||
        restriction.restriction_type.toLowerCase().includes(query) ||
        restriction.value?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const activeCount = restrictions.filter(r => r.is_active).length;

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-500 dark:text-gray-400">Loading restrictions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchRestrictions}
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Access Restrictions</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {restrictions.length} restriction{restrictions.length !== 1 ? 's' : ''} configured
            {activeCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                {activeCount} active
              </span>
            )}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Restriction
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium">About Access Restrictions</p>
          <p className="mt-1 text-blue-300/80">
            Access restrictions allow you to control when and from where users can access the system.
            You can whitelist or blacklist IP addresses, restrict access by geographic location,
            or limit access to specific time windows.
          </p>
        </div>
      </div>

      {/* Warning if no restrictions */}
      {restrictions.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-300">
            <p className="font-medium">No Access Restrictions Configured</p>
            <p className="mt-1 text-yellow-300/80">
              Your system has no access restrictions. Consider adding IP whitelists or time-based
              restrictions to enhance security.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      {restrictions.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search restrictions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Restriction Types Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {RESTRICTION_TYPES.map(type => {
          const TypeIcon = type.icon;
          const count = restrictions.filter(r => r.restriction_type === type.value).length;
          const activeCount = restrictions.filter(
            r => r.restriction_type === type.value && r.is_active
          ).length;

          return (
            <div
              key={type.value}
              className="bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 dark:bg-gray-700/50 rounded-lg">
                  <TypeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900 dark:text-white">{type.label}</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{type.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-slate-500 dark:text-gray-400">{count} rules</span>
                    {activeCount > 0 && (
                      <span className="text-xs text-green-400">({activeCount} active)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Restrictions List */}
      {filteredRestrictions.length > 0 && (
        <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700 divide-y divide-slate-200 dark:divide-gray-700">
          {filteredRestrictions.map(restriction => {
            const config = getTypeConfig(restriction.restriction_type);
            const TypeIcon = config.icon;

            return (
              <div key={restriction.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${restriction.is_active ? 'bg-green-500/20' : 'bg-slate-100 dark:bg-gray-700/50'}`}>
                      <TypeIcon className={`h-5 w-5 ${restriction.is_active ? 'text-green-400' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900 dark:text-white">{config.label}</h4>
                        {restriction.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                        {formatRestrictionValue(restriction)}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRestriction(restriction)}
                        className={`p-2 rounded-lg transition-colors ${
                          restriction.is_active
                            ? 'text-yellow-400 hover:bg-yellow-500/20'
                            : 'text-green-400 hover:bg-green-500/20'
                        }`}
                        title={restriction.is_active ? 'Disable' : 'Enable'}
                      >
                        {restriction.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setEditingRestriction(restriction)}
                        className="p-2 text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteRestriction(restriction.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRestriction) && (
        <RestrictionModal
          restriction={editingRestriction}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRestriction(null);
          }}
          onSaved={() => {
            setShowCreateModal(false);
            setEditingRestriction(null);
            fetchRestrictions();
          }}
        />
      )}
    </div>
  );
}

function formatRestrictionValue(restriction: AccessRestriction): string {
  switch (restriction.restriction_type) {
    case 'ip_whitelist':
    case 'ip_blacklist':
      return `IPs: ${JSON.stringify(restriction.value) || 'None configured'}`;
    case 'geo_allow':
    case 'geo_deny':
      return `Countries: ${JSON.stringify(restriction.value) || 'None configured'}`;
    case 'time_window':
      return `Time: ${JSON.stringify(restriction.value) || 'Not configured'}`;
    default:
      return JSON.stringify(restriction.value) || '';
  }
}

// Restriction Modal Component
interface RestrictionModalProps {
  restriction: AccessRestriction | null;
  onClose: () => void;
  onSaved: () => void;
}

function RestrictionModal({ restriction, onClose, onSaved }: RestrictionModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restrictionType, setRestrictionType] = useState<RestrictionType>(restriction?.restriction_type || 'ip_whitelist');
  // Store as string for textarea, convert to/from object for API
  const [valueInput, setValueInput] = useState(() => {
    if (!restriction?.value) return '';
    // Convert stored object back to string representation
    if (restriction.value.ips) return restriction.value.ips.join(', ');
    if (restriction.value.countries) return restriction.value.countries.join(', ');
    if (restriction.value.time_range) return restriction.value.time_range;
    return JSON.stringify(restriction.value);
  });
  const [isActive, setIsActive] = useState(restriction?.is_active ?? true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [name, _setName] = useState(restriction?.name || ''); // Name editing not implemented
  const [appliesToRole, setAppliesToRole] = useState(restriction?.value?.applies_to_role || '');

  const isEdit = !!restriction;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      // Convert string input to appropriate object format for API
      let value: Record<string, string | string[] | boolean>;
      const trimmedInput = valueInput.trim();
      switch (restrictionType) {
        case 'ip_whitelist':
        case 'ip_blacklist':
          value = { ips: trimmedInput.split(',').map((s: string) => s.trim()).filter(Boolean) };
          break;
        case 'geo_allow':
        case 'geo_deny':
          value = { countries: trimmedInput.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean) };
          break;
        case 'time_window':
          value = { time_range: trimmedInput };
          break;
        default:
          value = { raw: trimmedInput };
      }
      // Add applies_to_role if specified
      if (appliesToRole.trim()) {
        value.applies_to_role = appliesToRole.trim();
      }

      const payload = {
        restriction_type: restrictionType,
        value,
        is_active: isActive,
        name: name || null,
      };

      const url = isEdit
        ? `/api/rbac/restrictions/${restriction.id}`
        : '/api/rbac/restrictions';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `Failed to ${isEdit ? 'update' : 'create'} restriction`);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getValuePlaceholder = () => {
    switch (restrictionType) {
      case 'ip_whitelist':
      case 'ip_blacklist':
        return 'e.g., 192.168.1.0/24, 10.0.0.1';
      case 'geo_allow':
      case 'geo_deny':
        return 'e.g., US, CA, GB';
      case 'time_window':
        return 'e.g., 09:00-17:00 Mon-Fri';
      default:
        return '';
    }
  };

  const getValueHelp = () => {
    switch (restrictionType) {
      case 'ip_whitelist':
      case 'ip_blacklist':
        return 'Enter IP addresses or CIDR ranges, separated by commas';
      case 'geo_allow':
      case 'geo_deny':
        return 'Enter ISO 3166-1 alpha-2 country codes, separated by commas';
      case 'time_window':
        return 'Format: HH:MM-HH:MM Day-Day (e.g., 09:00-17:00 Mon-Fri)';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Restriction' : 'Add Access Restriction'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Restriction Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Restriction Type *
            </label>
            <select
              value={restrictionType}
              onChange={(e) => setRestrictionType(e.target.value as RestrictionType)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isEdit}
            >
              {RESTRICTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {RESTRICTION_TYPES.find(t => t.value === restrictionType)?.description}
            </p>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Value *
            </label>
            <textarea
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder={getValuePlaceholder()}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              required
            />
            <p className="mt-1 text-xs text-gray-500">{getValueHelp()}</p>
          </div>

          {/* Applies to Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Applies to Role (optional)
            </label>
            <input
              type="text"
              value={appliesToRole}
              onChange={(e) => setAppliesToRole(e.target.value)}
              placeholder="Leave empty to apply to all roles"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optionally restrict this rule to users with a specific role
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-green-600' : 'bg-slate-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-slate-700 dark:text-gray-300">
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !valueInput}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RestrictionsTab;
