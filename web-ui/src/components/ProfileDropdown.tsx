'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface ProfileDropdownProps {
  onOpenAccountSettings?: () => void;
}

export default function ProfileDropdown({ onOpenAccountSettings }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { demoMode, toggleDemoMode } = useDemoMode();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.username?.slice(0, 2).toUpperCase() || 'U';
  };

  // Get role badge color
  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'admin':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'editor':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'operator':
        return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
      case 'viewer':
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
          {getInitials()}
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 theme-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl border shadow-xl z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)'
          }}
        >
          {/* User Info Header */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-lg font-semibold">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold theme-text-primary truncate">
                  {user.full_name || user.username}
                </p>
                <p className="text-sm theme-text-muted truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${getRoleBadgeColor()}`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Theme Toggle */}
            <button
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                <span className="theme-text-secondary">Theme</span>
              </div>
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
              >
                {theme === 'dark' ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="theme-text-muted">Dark</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="theme-text-muted">Light</span>
                  </>
                )}
              </div>
            </button>

            {/* Demo Data Toggle */}
            <button
              onClick={() => {
                toggleDemoMode();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 ${demoMode ? 'text-purple-500' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="theme-text-secondary">Demo Data</span>
              </div>
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
              >
                {demoMode ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="theme-text-muted">On</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    <span className="theme-text-muted">Off</span>
                  </>
                )}
              </div>
            </button>

            {/* Divider */}
            <div className="my-2 h-px mx-4" style={{ backgroundColor: 'var(--border-primary)' }} />

            {/* Account Settings */}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAccountSettings?.();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="theme-text-secondary">Account Settings</span>
            </button>

            {/* Help & Support */}
            <a
              href="/docs"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="theme-text-secondary">Help & Documentation</span>
            </a>

            {/* Divider */}
            <div className="my-2 h-px mx-4" style={{ backgroundColor: 'var(--border-primary)' }} />

            {/* Sign Out */}
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs theme-text-muted">Online</span>
            </div>
            <span className="text-xs theme-text-muted">v1.0.0</span>
          </div>
        </div>
      )}
    </div>
  );
}
