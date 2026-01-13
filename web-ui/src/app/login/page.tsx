'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
// OAuth requires direct browser redirect to backend (can't go through proxy)
const OAUTH_BASE = process.env.NEXT_PUBLIC_OAUTH_URL || process.env.NEXT_PUBLIC_API_URL || '';

interface AuthConfig {
  oauth_enabled: boolean;
  oauth_providers: string[];
  mfa_enabled: boolean;
  mfa_provider: string | null;
}

interface SetupStatus {
  setup_required: boolean;
  setup_complete: boolean;
  steps: {
    admin: { completed: boolean };
    encryption: { completed: boolean };
    ai_provider: { completed: boolean };
  };
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<'push' | 'passcode'>('push');
  const [mfaPasscode, setMfaPasscode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const { login } = useAuth();
  const searchParams = useSearchParams();
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus username input on mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  // Fetch auth config and setup status on mount
  useEffect(() => {
    async function fetchAuthConfig() {
      try {
        const response = await fetch(`${API_BASE}/api/auth/config`, {
          credentials: 'include',
        });
        if (response.ok) {
          const config = await response.json();
          setAuthConfig(config);
        }
      } catch (err) {
        console.error('Failed to fetch auth config:', err);
      }
    }

    async function fetchSetupStatus() {
      try {
        const response = await fetch(`${API_BASE}/api/setup/status`, {
          credentials: 'include',
        });
        if (response.ok) {
          const status = await response.json();
          setSetupStatus(status);
        }
      } catch (err) {
        console.error('Failed to fetch setup status:', err);
      }
    }

    fetchAuthConfig();
    fetchSetupStatus();
  }, []);

  // Check for MFA challenge from URL params (OAuth callback)
  useEffect(() => {
    const mfaReq = searchParams.get('mfa_required');
    const challengeId = searchParams.get('challenge_id');
    const errorParam = searchParams.get('error');

    if (mfaReq === 'true' && challengeId) {
      setMfaRequired(true);
      setMfaChallengeId(challengeId);
    }

    if (errorParam === 'oauth_failed') {
      setError('OAuth login failed. Please try again or use username/password.');
    } else if (errorParam === 'no_account') {
      setError('No account exists for this email. Please contact an administrator to create your account.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ username, password });
    } catch (err) {
      // Check if MFA is required (custom error with MFA challenge)
      const errorData = err as { mfa_required?: boolean; challenge_id?: string; message?: string };
      if (errorData.mfa_required) {
        setMfaRequired(true);
        setMfaChallengeId(errorData.challenge_id || '');
      } else {
        setError(err instanceof Error ? err.message : (errorData.message || 'Invalid username or password'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    // Redirect directly to backend OAuth endpoint (browser must redirect to Google)
    window.location.href = `${OAUTH_BASE}/api/auth/oauth/google?redirect_after=/`;
  }

  async function handleMfaVerify() {
    if (!mfaChallengeId) return;

    setMfaLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challenge_id: mfaChallengeId,
          method: mfaMethod,
          passcode: mfaMethod === 'passcode' ? mfaPasscode : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // MFA verified, refresh auth state
        window.location.href = '/';
      } else {
        setError(data.message || 'MFA verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setMfaLoading(false);
    }
  }

  // MFA Verification UI
  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800/50 p-8 shadow-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Two-Factor Authentication</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Verify your identity with Duo Security</p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl"
              >
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* MFA Method Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMfaMethod('push')}
                  aria-pressed={mfaMethod === 'push'}
                  aria-label="Duo Push notification"
                  className={`p-4 rounded-xl border-2 transition-all ${
                    mfaMethod === 'push'
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <svg className={`w-8 h-8 mx-auto mb-2 ${mfaMethod === 'push' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-sm font-medium ${mfaMethod === 'push' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    Duo Push
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMfaMethod('passcode')}
                  aria-pressed={mfaMethod === 'passcode'}
                  aria-label="Enter passcode manually"
                  className={`p-4 rounded-xl border-2 transition-all ${
                    mfaMethod === 'passcode'
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <svg className={`w-8 h-8 mx-auto mb-2 ${mfaMethod === 'passcode' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <span className={`text-sm font-medium ${mfaMethod === 'passcode' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    Passcode
                  </span>
                </button>
              </div>

              {/* Passcode Input */}
              {mfaMethod === 'passcode' && (
                <div>
                  <label htmlFor="mfa-passcode" className="sr-only">
                    Enter 6-digit passcode
                  </label>
                  <input
                    id="mfa-passcode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={mfaPasscode}
                    onChange={(e) => setMfaPasscode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit passcode"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    maxLength={6}
                  />
                </div>
              )}

              {/* Push Message */}
              {mfaMethod === 'push' && (
                <div className="text-center py-4 text-slate-600 dark:text-slate-400 text-sm">
                  Click verify to send a push notification to your device
                </div>
              )}

              <button
                type="button"
                onClick={handleMfaVerify}
                disabled={mfaLoading || (mfaMethod === 'passcode' && mfaPasscode.length !== 6)}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
              >
                {mfaLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {mfaMethod === 'push' ? 'Waiting for approval...' : 'Verifying...'}
                  </span>
                ) : (
                  'Verify'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaChallengeId(null);
                  setError(null);
                }}
                className="w-full py-2 text-slate-600 dark:text-slate-400 text-sm hover:text-slate-900 dark:hover:text-white transition"
              >
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-20 dark:opacity-10" style={{
            backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />

          {/* Glowing orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          {/* Logo */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Lumen</h1>
                <p className="text-cyan-600 dark:text-cyan-400 font-medium">Illuminating Your Network</p>
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="mb-10">
            <h2 className="text-3xl xl:text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-4">
              Illuminate your network.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-purple-600 dark:from-cyan-400 dark:to-purple-400">Just ask.</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Skip the CLI and vendor dashboards. Lumen lets you query, troubleshoot, and take action across your entire infrastructure — through simple conversation.
            </p>
          </div>

          {/* Example Queries */}
          <div className="space-y-3 mb-10">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">Shed light on any issue</p>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">&quot;What devices went offline in the last hour?&quot;</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">&quot;Why are users in Building 3 having slow WiFi?&quot;</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">&quot;Create a guest SSID for the conference&quot;</span>
            </div>
          </div>

          {/* Integrations */}
          <div className="pt-8 border-t border-slate-300/50 dark:border-slate-700/30">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-4">One conversation across</p>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">M</span>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Meraki</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">C</span>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Catalyst</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">TE</span>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">ThousandEyes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">S</span>
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Splunk</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lumen</h1>
            <p className="text-cyan-600 dark:text-cyan-400 text-sm font-medium">Illuminating Your Network</p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800/50 p-8 shadow-xl dark:shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sign In</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Enter your credentials to access the dashboard</p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-red-200 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            {/* OAuth Buttons */}
            {authConfig?.oauth_enabled && authConfig.oauth_providers.includes('google') && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full mb-4 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-slate-900/50 text-slate-500">or continue with email</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    ref={usernameInputRef}
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:border-cyan-500/50 transition-all"
                    placeholder="Enter username or email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:border-cyan-500/50 transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Show setup link only if no admin user exists yet */}
            {setupStatus && !setupStatus.steps?.admin?.completed && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/50">
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Don&apos;t have an account? </span>
                  <Link
                    href="/register"
                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-medium text-sm transition"
                  >
                    Set up Lumen
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-600">
              Lumen &bull; Illuminating your network with AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
