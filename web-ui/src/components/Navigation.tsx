'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePermissions, PERMISSIONS } from '@/contexts/PermissionContext';

// Nav item with optional permission requirement
interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string;
  anyPermission?: string[];
  tourId?: string; // For onboarding tour targeting
  requiresIntegration?: 'meraki' | 'catalyst' | 'thousandeyes' | 'splunk' | 'networks'; // networks = meraki OR catalyst
}

// Integration status from API
interface IntegrationStatus {
  meraki: boolean;
  catalyst: boolean;
  thousandeyes: boolean;
  splunk: boolean;
}

export default function Navigation() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [manageExpanded, setManageExpanded] = useState(true);
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = usePermissions();
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    meraki: false,
    catalyst: false,
    thousandeyes: false,
    splunk: false,
  });
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false);

  // Fetch integration status
  const fetchIntegrationStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const configs = data.integrations_config?.configs || {};
        setIntegrations({
          meraki: configs?.meraki_api_key?.has_value || false,
          catalyst: configs?.catalyst_center_host?.has_value || false,
          thousandeyes: configs?.thousandeyes_oauth_token?.has_value || false,
          splunk: configs?.splunk_bearer_token?.has_value || configs?.splunk_host?.has_value || false,
        });
      }
    } catch (error) {
      // Silently fail - will show all nav items if we can't determine status
      console.warn('Failed to fetch integration status:', error);
    } finally {
      setIntegrationsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  useEffect(() => {
    const sidebarWidth = isExpanded ? '14rem' : '4.5rem';
    const topbarHeight = '69px'; // Match sidebar header: py-4 (32px) + logo 36px + border (1px)
    // Set CSS variables for layout positioning
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
    document.documentElement.style.setProperty('--topbar-height', topbarHeight);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
      document.documentElement.style.removeProperty('--topbar-height');
    };
  }, [isExpanded]);

  // Main navigation items with permissions
  const mainNavItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/network', label: 'Lumen AI', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', permission: PERMISSIONS.NETWORK_VIEW, tourId: 'ai-chat' },
    { href: '/incidents', label: 'Incident Timeline', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', permission: PERMISSIONS.INCIDENTS_VIEW, tourId: 'incidents' },
    { href: '/workflows', label: 'Workflows', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', permission: PERMISSIONS.WORKFLOWS_VIEW, tourId: 'workflows' },
    { href: '/networks', label: 'Networks & Devices', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01', permission: PERMISSIONS.NETWORK_VIEW, requiresIntegration: 'networks' },
    { href: '/visualizations', label: 'Visualizations', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', permission: PERMISSIONS.NETWORK_VIEW, requiresIntegration: 'networks' },
    { href: '/thousandeyes', label: 'ThousandEyes', icon: 'M13 10V3L4 14h7v7l9-11h-7z', permission: PERMISSIONS.INTEGRATIONS_THOUSANDEYES, requiresIntegration: 'thousandeyes' },
    { href: '/splunk', label: 'Splunk Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permission: PERMISSIONS.INTEGRATIONS_SPLUNK, requiresIntegration: 'splunk' },
    { href: '/knowledge', label: 'Knowledge Base', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }, // Accessible to all users
    { href: '/costs', label: 'AI Cost & ROI', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', permission: PERMISSIONS.AI_COSTS_VIEW, tourId: 'costs' },
  ];

  // Manage section items with permissions
  const manageItems: NavItem[] = [
    { href: '/admin/settings', label: 'System Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', anyPermission: [PERMISSIONS.ADMIN_SYSTEM_VIEW, PERMISSIONS.ADMIN_SYSTEM_MANAGE] },
    { href: '/ai-settings', label: 'AI Settings', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', permission: PERMISSIONS.AI_SETTINGS },
    { href: '/admin/knowledge', label: 'Knowledge Admin', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', permission: PERMISSIONS.AI_KNOWLEDGE_VIEW },
    { href: '/security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', anyPermission: [PERMISSIONS.ADMIN_SECURITY_VIEW, PERMISSIONS.ADMIN_SECURITY_MANAGE, PERMISSIONS.RBAC_ROLES_VIEW], tourId: 'security' },
    { href: '/audit', label: 'Audit Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permission: PERMISSIONS.AUDIT_VIEW },
    { href: '/health', label: 'System Health', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', permission: PERMISSIONS.ADMIN_SYSTEM_VIEW },
    { href: '/docs', label: 'Documentation', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }, // No permission needed - docs are public
    { href: '/licenses', label: 'Licenses', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permission: PERMISSIONS.ADMIN_SYSTEM_VIEW },
  ];

  // Check if an integration requirement is met
  const hasIntegration = (requirement: NavItem['requiresIntegration']): boolean => {
    if (!requirement) return true;
    if (!integrationsLoaded) return true; // Show while loading to prevent flash

    switch (requirement) {
      case 'meraki':
        return integrations.meraki;
      case 'catalyst':
        return integrations.catalyst;
      case 'thousandeyes':
        return integrations.thousandeyes;
      case 'splunk':
        return integrations.splunk;
      case 'networks':
        return integrations.meraki || integrations.catalyst;
      default:
        return true;
    }
  };

  // Filter items based on permissions and integrations
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    if (permissionsLoading) return items; // Show all while loading to prevent flash

    return items.filter(item => {
      // Check integration requirement first
      if (item.requiresIntegration && !hasIntegration(item.requiresIntegration)) {
        return false;
      }

      // No permission required - show if integration check passed
      if (!item.permission && !item.anyPermission) return true;

      // Check single permission
      if (item.permission) {
        return hasPermission(item.permission);
      }

      // Check any of multiple permissions
      if (item.anyPermission) {
        return hasAnyPermission(...item.anyPermission);
      }

      return true;
    });
  };

  // Filtered navigation items
  const filteredMainNavItems = useMemo(
    () => filterNavItems(mainNavItems),
    [permissionsLoading, hasPermission, hasAnyPermission, integrations, integrationsLoaded]
  );

  const filteredManageItems = useMemo(
    () => filterNavItems(manageItems),
    [permissionsLoading, hasPermission, hasAnyPermission, integrations, integrationsLoaded]
  );

  const isManageActive = filteredManageItems.some(item => pathname === item.href);
  const hasManageItems = filteredManageItems.length > 0;

  const handleSidebarClick = (e: React.MouseEvent) => {
    if (!isExpanded && !(e.target as HTMLElement).closest('a, button')) {
      setIsExpanded(true);
      setManageExpanded(true);
    }
  };

  const handleManageClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setManageExpanded(true);
    } else {
      setManageExpanded(prev => !prev);
    }
  };

  return (
    <aside
      onClick={handleSidebarClick}
      className={`fixed inset-y-0 left-0 z-50 flex flex-col theme-sidebar border-r backdrop-blur-sm transition-all duration-300 ${
        isExpanded ? 'w-56' : 'w-18'
      }`}
      style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <Link href="/" className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          {isExpanded && (
            <div>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Lumen</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Network Intelligence</p>
            </div>
          )}
        </Link>

        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-2 rounded-lg transition-all"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredMainNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={e => e.stopPropagation()}
              className="group relative block"
              data-tour={item.tourId}
            >
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                  isActive
                    ? 'border'
                    : ''
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                  borderColor: isActive ? 'var(--sidebar-active-border)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                }}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {isExpanded && <span className="font-medium truncate">{item.label}</span>}
              </div>

              {!isExpanded && (
                <div
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border shadow-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}

        {/* Divider - only show if there are manage items */}
        {hasManageItems && (
          <div className="my-4 h-px" style={{ backgroundColor: 'var(--border-primary)' }} />
        )}

        {/* Manage Section Header */}
        {hasManageItems && isExpanded && (
          <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Manage</p>
        )}

        {/* Manage Section */}
        {hasManageItems && <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleManageClick();
            }}
            className="group relative w-full block"
          >
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                isManageActive ? 'border' : ''
              }`}
              style={{
                backgroundColor: isManageActive ? 'var(--accent-purple-muted)' : 'transparent',
                borderColor: isManageActive ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                color: isManageActive ? 'var(--accent-purple)' : 'var(--text-tertiary)',
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isExpanded && (
                <>
                  <span className="flex-1 text-left font-medium">Settings</span>
                  <svg className={`w-4 h-4 transition-transform ${manageExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </div>

            {!isExpanded && (
              <div
                className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border shadow-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                Settings
              </div>
            )}
          </button>

          {/* Submenu */}
          {isExpanded && manageExpanded && (
            <div className="mt-1 ml-3 pl-3 border-l space-y-1" style={{ borderColor: 'var(--border-primary)' }}>
              {filteredManageItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      backgroundColor: isActive ? 'var(--accent-purple-muted)' : 'transparent',
                      color: isActive ? 'var(--accent-purple)' : 'var(--text-muted)',
                    }}
                    data-tour={item.tourId}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
        {isExpanded ? (
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>v1.0.0</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Online</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Expand Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="p-2 rounded-lg transition-all"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
