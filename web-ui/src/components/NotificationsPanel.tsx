'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Notification {
  id: string;
  type: 'alert' | 'incident' | 'system' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  href?: string;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationCountChange: (count: number) => void;
}

export default function NotificationsPanel({ isOpen, onClose, onNotificationCountChange }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch from multiple sources and combine into notifications
      const notifs: Notification[] = [];

      // Try to fetch incidents
      try {
        const response = await fetch('/api/incidents?limit=5', { credentials: 'include' });
        if (response.ok) {
          const incidents = await response.json();
          if (Array.isArray(incidents)) {
            incidents.slice(0, 3).forEach((incident: any) => {
              notifs.push({
                id: `incident-${incident.id}`,
                type: 'incident',
                title: `Incident: ${incident.title || 'New Incident'}`,
                message: incident.description || 'A new incident has been detected',
                timestamp: incident.created_at || new Date().toISOString(),
                read: incident.status === 'resolved',
                href: '/incidents',
              });
            });
          }
        }
      } catch (e) {
        // Incidents endpoint may not exist
      }

      // Try to fetch recent audit logs for system notifications
      try {
        const auditLogs = await apiClient.getAuditLogs({ limit: 5 });
        if (Array.isArray(auditLogs)) {
          const failedOps = auditLogs.filter((log: any) => log.response_status >= 400).slice(0, 2);
          failedOps.forEach((log: any) => {
            notifs.push({
              id: `audit-${log.id}`,
              type: 'alert',
              title: 'API Error',
              message: `${log.http_method} ${log.path} returned ${log.response_status}`,
              timestamp: log.timestamp,
              read: false,
              href: '/audit',
            });
          });
        }
      } catch (e) {
        // Audit endpoint may not exist
      }

      // Try to fetch ThousandEyes alerts
      try {
        const response = await fetch('/api/thousandeyes/alerts?limit=5', { credentials: 'include' });
        if (response.ok) {
          const teAlerts = await response.json();
          const alertsArray = teAlerts?.alerts;
          if (alertsArray && Array.isArray(alertsArray)) {
            alertsArray.slice(0, 2).forEach((alert: any) => {
              notifs.push({
                id: `te-${alert.alertId || Math.random()}`,
                type: 'alert',
                title: alert.ruleName || 'ThousandEyes Alert',
                message: alert.testName || 'Network alert detected',
                timestamp: alert.dateStart || new Date().toISOString(),
                read: alert.state === 'CLEARED',
                href: '/thousandeyes',
              });
            });
          }
        }
      } catch (e) {
        // ThousandEyes endpoint may not exist
      }

      // Add a system notification if no other notifications
      if (notifs.length === 0) {
        notifs.push({
          id: 'system-welcome',
          type: 'info',
          title: 'Welcome to Lumen',
          message: 'Your network intelligence platform is ready',
          timestamp: new Date().toISOString(),
          read: true,
        });
      }

      // Sort by timestamp (newest first)
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(notifs);
      onNotificationCountChange(notifs.filter(n => !n.read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [onNotificationCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Poll for new notifications every 30 seconds when panel is closed
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      onNotificationCountChange(updated.filter(n => !n.read).length);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onNotificationCountChange(0);
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.href) {
      router.push(notif.href);
      onClose();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'incident':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'system':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 rounded-xl border shadow-xl overflow-hidden z-50"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
        <h3 className="font-semibold theme-text-primary">Notifications</h3>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-cyan-500 hover:text-cyan-600 font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-12 h-12 theme-text-muted mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm theme-text-muted">No notifications</p>
          </div>
        ) : (
          <div>
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
                  !notif.read ? 'bg-cyan-500/5' : ''
                }`}
              >
                {getTypeIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${!notif.read ? 'theme-text-primary' : 'theme-text-secondary'}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <div className="w-2 h-2 bg-cyan-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs theme-text-muted truncate mt-0.5">{notif.message}</p>
                  <p className="text-[10px] theme-text-muted mt-1">{formatTime(notif.timestamp)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t text-center" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => {
            router.push('/incidents');
            onClose();
          }}
          className="text-xs text-cyan-500 hover:text-cyan-600 font-medium"
        >
          View all activity
        </button>
      </div>
    </div>
  );
}
