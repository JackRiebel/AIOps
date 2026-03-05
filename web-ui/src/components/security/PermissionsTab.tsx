'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Lock,
  Eye,
  Edit3,
  Trash2,
  Users,
  AlertTriangle,
  Network,
  Bot,
  FileText,
  Settings,
  Link2,
  Key,
  Info,
} from 'lucide-react';
import { Permission } from '@/types';

// Category icons and colors
const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  users: { icon: Users, color: 'text-blue-400', label: 'Users' },
  incidents: { icon: AlertTriangle, color: 'text-red-400', label: 'Incidents' },
  network: { icon: Network, color: 'text-green-400', label: 'Network' },
  ai: { icon: Bot, color: 'text-purple-400', label: 'AI' },
  audit: { icon: FileText, color: 'text-yellow-400', label: 'Audit' },
  admin: { icon: Settings, color: 'text-orange-400', label: 'Admin' },
  rbac: { icon: Key, color: 'text-pink-400', label: 'RBAC' },
  integrations: { icon: Link2, color: 'text-cyan-400', label: 'Integrations' },
};

// Permission action icons
const ACTION_ICONS: Record<string, React.ElementType> = {
  view: Eye,
  create: Edit3,
  update: Edit3,
  delete: Trash2,
  manage: Settings,
};

interface PermissionsTabProps {
  className?: string;
}

export function PermissionsTab({ className = '' }: PermissionsTabProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rbac/permissions', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const data = await response.json();
      setPermissions(data.permissions || data);
      // Expand all categories by default
      const categories = new Set<string>();
      (data.permissions || data).forEach((p: Permission) => {
        if (p.category) categories.add(p.category);
      });
      setExpandedCategories(categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};

    permissions.forEach(permission => {
      const category = permission.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(permission);
    });

    // Sort permissions within each category
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.code.localeCompare(b.code));
    });

    return grouped;
  }, [permissions]);

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    let filtered = permissions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.code.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    return filtered;
  }, [permissions, searchQuery, selectedCategory]);

  // Get categories for filter
  const categories = useMemo(() => {
    return Object.keys(permissionsByCategory).sort();
  }, [permissionsByCategory]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getActionIcon = (code: string) => {
    const action = code.split('.').pop() || '';
    return ACTION_ICONS[action] || Shield;
  };

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category] || {
      icon: Shield,
      color: 'text-gray-400',
      label: category.charAt(0).toUpperCase() + category.slice(1)
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-500 dark:text-gray-400">Loading permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchPermissions}
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">System Permissions</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {permissions.length} permissions available across {categories.length} categories
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search permissions by name, code, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="pl-10 pr-8 py-2 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(category => {
              const config = getCategoryConfig(category);
              return (
                <option key={category} value={category}>
                  {config.label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex gap-6">
        {/* Permissions List */}
        <div className="flex-1 space-y-4">
          {searchQuery || selectedCategory ? (
            // Flat list when filtering
            <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700 divide-y divide-slate-200 dark:divide-gray-700">
              {filteredPermissions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No permissions match your search criteria</p>
                </div>
              ) : (
                filteredPermissions.map(permission => (
                  <PermissionRow
                    key={permission.id}
                    permission={permission}
                    isSelected={selectedPermission?.id === permission.id}
                    onSelect={() => setSelectedPermission(permission)}
                    getCategoryConfig={getCategoryConfig}
                    getActionIcon={getActionIcon}
                  />
                ))
              )}
            </div>
          ) : (
            // Grouped by category when not filtering
            categories.map(category => {
              const config = getCategoryConfig(category);
              const CategoryIcon = config.icon;
              const categoryPermissions = permissionsByCategory[category] || [];
              const isExpanded = expandedCategories.has(category);

              return (
                <div
                  key={category}
                  className="bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-100 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CategoryIcon className={`h-5 w-5 ${config.color}`} />
                      <span className="font-medium text-slate-900 dark:text-white">{config.label}</span>
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-gray-700 rounded text-xs text-slate-600 dark:text-gray-300">
                        {categoryPermissions.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {/* Permissions List */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-gray-700 divide-y divide-slate-200 dark:divide-gray-700">
                      {categoryPermissions.map(permission => (
                        <PermissionRow
                          key={permission.id}
                          permission={permission}
                          isSelected={selectedPermission?.id === permission.id}
                          onSelect={() => setSelectedPermission(permission)}
                          getCategoryConfig={getCategoryConfig}
                          getActionIcon={getActionIcon}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Permission Details Panel */}
        {selectedPermission && (
          <div className="w-80 shrink-0">
            <PermissionDetailPanel
              permission={selectedPermission}
              onClose={() => setSelectedPermission(null)}
              getCategoryConfig={getCategoryConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Permission Row Component
interface PermissionRowProps {
  permission: Permission;
  isSelected: boolean;
  onSelect: () => void;
  getCategoryConfig: (category: string) => { icon: React.ElementType; color: string; label: string };
  getActionIcon: (code: string) => React.ElementType;
}

function PermissionRow({
  permission,
  isSelected,
  onSelect,
  getCategoryConfig,
  getActionIcon,
}: PermissionRowProps) {
  const config = getCategoryConfig(permission.category || 'other');
  // Get icon component - render using React.createElement to avoid static-component warning
  const IconComponent = getActionIcon(permission.code);

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
        isSelected
          ? 'bg-blue-500/20 border-l-2 border-blue-500'
          : 'hover:bg-slate-100 dark:hover:bg-gray-700/30 border-l-2 border-transparent'
      }`}
    >
      <div className={`p-2 rounded-lg bg-slate-100 dark:bg-gray-700/50 ${config.color}`}>
        {React.createElement(IconComponent, { className: 'h-4 w-4' })}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-white truncate">{permission.name}</span>
          {permission.is_system && (
            <span title="System permission">
              <Lock className="h-3 w-3 text-gray-500 shrink-0" />
            </span>
          )}
        </div>
        <code className="text-xs text-slate-500 dark:text-gray-400 font-mono">{permission.code}</code>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
    </button>
  );
}

// Permission Detail Panel Component
interface PermissionDetailPanelProps {
  permission: Permission;
  onClose: () => void;
  getCategoryConfig: (category: string) => { icon: React.ElementType; color: string; label: string };
}

function PermissionDetailPanel({
  permission,
  onClose,
  getCategoryConfig,
}: PermissionDetailPanelProps) {
  const config = getCategoryConfig(permission.category || 'other');
  const CategoryIcon = config.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700">
        <h3 className="font-medium text-slate-900 dark:text-white">Permission Details</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name and Code */}
        <div>
          <h4 className="text-lg font-medium text-slate-900 dark:text-white">{permission.name}</h4>
          <code className="text-sm text-blue-400 font-mono">{permission.code}</code>
        </div>

        {/* Description */}
        {permission.description && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
            <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">{permission.description}</p>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
          <div className="flex items-center gap-2 mt-1">
            <CategoryIcon className={`h-4 w-4 ${config.color}`} />
            <span className="text-sm text-slate-700 dark:text-gray-300">{config.label}</span>
          </div>
        </div>

        {/* Resource Type */}
        {permission.resource_type && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Resource Type</label>
            <p className="text-sm text-slate-700 dark:text-gray-300 mt-1">{permission.resource_type}</p>
          </div>
        )}

        {/* System Permission Badge */}
        {permission.is_system && (
          <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-gray-700/50 rounded-lg">
            <Lock className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">System Permission</p>
              <p className="text-xs text-gray-500">This permission cannot be modified or deleted</p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            Assign this permission to roles in the Roles tab, or grant it directly to users for specific resources.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PermissionsTab;
