'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import ProfileDropdown from './ProfileDropdown';
import GlobalSearch from './GlobalSearch';
import NotificationsPanel from './NotificationsPanel';
import AccountSettings from './AccountSettings';
import AISessionToggle from './AISessionToggle';
import EditModeIndicator from './EditModeIndicator';

export default function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();
  const { toggleTheme } = useTheme();

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Cmd+K or Ctrl+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
      setNotificationsOpen(false);
      setAccountSettingsOpen(false);
    }

    // Cmd+Shift+L to toggle theme
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      toggleTheme();
    }

    // G+D for Dashboard, G+N for Networks, etc.
    if (e.key === 'g') {
      const handleNextKey = (nextEvent: KeyboardEvent) => {
        document.removeEventListener('keydown', handleNextKey);
        switch (nextEvent.key.toLowerCase()) {
          case 'd':
            router.push('/');
            break;
          case 'n':
            router.push('/networks');
            break;
          case 'i':
            router.push('/incidents');
            break;
          case 's':
            router.push('/ai-settings');
            break;
        }
      };
      document.addEventListener('keydown', handleNextKey, { once: true });
      // Auto-remove after 1 second if no second key pressed
      setTimeout(() => document.removeEventListener('keydown', handleNextKey), 1000);
    }
  }, [router, toggleTheme]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <header
        className="fixed top-0 right-0 z-40 flex items-center justify-between px-6 border-b backdrop-blur-sm"
        style={{
          left: 'var(--sidebar-width, 14rem)',
          height: 'var(--topbar-height, 69px)',
          backgroundColor: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          transition: 'left 300ms ease',
        }}
      >
        {/* Left Side - Search Bar */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <svg className="w-4 h-4 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm theme-text-muted">Search...</span>
        </button>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Edit Mode Indicator */}
          <EditModeIndicator />

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* AI Session Toggle - Always Visible */}
          <AISessionToggle />

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setSearchOpen(false);
                setAccountSettingsOpen(false);
              }}
              className="relative p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Notifications"
            >
              <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            <NotificationsPanel
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onNotificationCountChange={setNotificationCount}
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Profile Dropdown */}
          <ProfileDropdown onOpenAccountSettings={() => setAccountSettingsOpen(true)} />
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Account Settings Modal */}
      <AccountSettings
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </>
  );
}
