'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { Organization } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface TopNavbarProps {
  organizations: Organization[];
  selectedOrg: string | null;
  onOrgChange: (org: string) => void;
  showAgentFlow: boolean;
  onToggleAgentFlow: () => void;
  autoRemediate: boolean;
  onToggleAutoRemediate: () => void;
  onOpenCommandBar: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  systemStatus: 'healthy' | 'degraded' | 'offline';
  className?: string;
}

// ============================================================================
// Dark Mode Hook
// ============================================================================

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial state
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);

    // Watch for changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const newValue = !isDark;
    if (newValue) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setIsDark(newValue);
  }, [isDark]);

  return { isDark, toggle };
}

// ============================================================================
// Status Indicator
// ============================================================================

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'offline' }) {
  const config = {
    healthy: { color: 'bg-green-500', pulse: true, label: 'Operational' },
    degraded: { color: 'bg-amber-500', pulse: true, label: 'Degraded' },
    offline: { color: 'bg-red-500', pulse: false, label: 'Offline' },
  };
  const { color, pulse, label } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-slate-600 dark:text-slate-400 hidden sm:inline">{label}</span>
    </div>
  );
}

// ============================================================================
// Toggle Button
// ============================================================================

function ToggleButton({
  isActive,
  onClick,
  icon,
  label,
  activeColor = 'cyan',
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColor?: 'cyan' | 'amber' | 'green';
}) {
  const colorMap = {
    cyan: {
      active: 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400',
      inactive: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    },
    amber: {
      active: 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400',
      inactive: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    },
    green: {
      active: 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-400',
      inactive: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
    },
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
        isActive ? colorMap[activeColor].active : colorMap[activeColor].inactive
      }`}
      title={label}
    >
      {icon}
      <span className="text-sm font-medium hidden lg:inline">{label}</span>
    </button>
  );
}

// ============================================================================
// TopNavbar Component
// ============================================================================

export const TopNavbar = memo(({
  organizations,
  selectedOrg,
  onOrgChange,
  showAgentFlow,
  onToggleAgentFlow,
  autoRemediate,
  onToggleAutoRemediate,
  onOpenCommandBar,
  onToggleMobileMenu,
  isMobileMenuOpen,
  systemStatus,
  className = '',
}: TopNavbarProps) => {
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className={`flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50 backdrop-blur-sm ${className}`}>
      {/* Left Section - Logo & Status */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 lg:hidden"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 dark:text-white hidden sm:inline">Lumen AI</span>
        </Link>

        {/* System Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
          <StatusIndicator status={systemStatus} />
        </div>
      </div>

      {/* Center Section - Search & Org Selector */}
      <div className="flex-1 flex items-center justify-center gap-3 max-w-2xl mx-4">
        {/* Command Bar Trigger / Search */}
        <button
          onClick={onOpenCommandBar}
          className="flex-1 max-w-md flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm hidden sm:inline">Search or type a command...</span>
        </button>

        {/* Organization Selector */}
        <select
          value={selectedOrg || ''}
          onChange={(e) => onOrgChange(e.target.value)}
          className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 hidden md:block"
        >
          <option value="" disabled>Select Organization</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.name}>
              {org.display_name || org.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right Section - Toggles & User */}
      <div className="flex items-center gap-2">
        {/* Agent Flow Toggle */}
        <ToggleButton
          isActive={showAgentFlow}
          onClick={onToggleAgentFlow}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          label="Agent Flow"
          activeColor="cyan"
        />

        {/* Auto-Remediate Toggle */}
        <ToggleButton
          isActive={autoRemediate}
          onClick={onToggleAutoRemediate}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          label="Auto-Fix"
          activeColor="amber"
        />

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Quick Actions Dropdown */}
        <div className="relative hidden md:block">
          <button
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            title="Quick Actions"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
              U
            </div>
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                <Link
                  href="/ai-settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  API Keys & Settings
                </Link>
                <Link
                  href="/admin/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Settings
                </Link>
                <hr className="my-1 border-slate-200 dark:border-slate-700" />
                <Link
                  href="/docs"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Documentation
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
});

TopNavbar.displayName = 'TopNavbar';

export default TopNavbar;
