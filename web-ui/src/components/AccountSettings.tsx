'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSettings({ isOpen, onClose }: AccountSettingsProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold theme-text-primary">Account Settings</h2>
                <p className="text-xs theme-text-muted">Manage your profile and security</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
            {/* Message */}
            {message && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
              }`}>
                {message.text}
              </div>
            )}

            {/* Profile Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold theme-text-primary mb-4">Profile Information</h3>

              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                    {getInitials()}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${getRoleBadgeColor()}`}>
                    {user?.role}
                  </span>
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-medium theme-text-muted mb-1.5">Username</label>
                    <input
                      type="text"
                      value={user?.username || ''}
                      disabled
                      className="w-full px-3 py-2 rounded-lg border text-sm theme-text-muted cursor-not-allowed"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium theme-text-muted mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-3 py-2 rounded-lg border text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium theme-text-muted mb-1.5">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full px-3 py-2 rounded-lg border text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px my-6" style={{ backgroundColor: 'var(--border-primary)' }} />

            {/* Password Section */}
            <div>
              <h3 className="text-sm font-semibold theme-text-primary mb-4">Change Password</h3>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium theme-text-muted mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 rounded-lg border text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium theme-text-muted mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3 py-2 rounded-lg border text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium theme-text-muted mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 rounded-lg border text-sm theme-text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px my-6" style={{ backgroundColor: 'var(--border-primary)' }} />

            {/* Session Info */}
            <div>
              <h3 className="text-sm font-semibold theme-text-primary mb-4">Session Information</h3>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <p className="text-xs theme-text-muted mb-1">Last Login</p>
                  <p className="theme-text-secondary font-medium">
                    {user?.last_login ? new Date(user.last_login).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <p className="text-xs theme-text-muted mb-1">Account Created</p>
                  <p className="theme-text-secondary font-medium">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium theme-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
