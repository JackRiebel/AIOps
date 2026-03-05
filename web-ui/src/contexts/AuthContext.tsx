'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, setSessionExpiredHandler } from '@/lib/api-client';
import type { User, LoginRequest } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Register global session expiration handler
    // This will be called when any API request returns 401
    // Don't redirect if already on a public page (avoids redirect loops on fresh install)
    setSessionExpiredHandler(() => {
      setUser(null);
      const path = window.location.pathname;
      const isPublic = path === '/login' || path === '/register' || path === '/setup' || path.startsWith('/setup/');
      if (!isPublic) {
        router.push('/login');
      }
    });

    checkAuth();
  }, [router]);

  async function checkAuth() {
    // Use direct fetch instead of apiClient.getCurrentUser() to avoid
    // triggering the global sessionExpiredHandler on 401. During initial
    // auth check, a 401 is expected (not-logged-in) — not an expired session.
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.status === 401) {
          // Not authenticated — expected on first visit or expired session
          console.debug('[Auth] checkAuth: 401 — not authenticated');
          setUser(null);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          // Transient server error — retry
          const text = await res.text().catch(() => '');
          console.warn(`[Auth] checkAuth attempt ${attempt + 1}: ${res.status} ${text}`);
          throw new Error(`Auth check failed: ${res.status}`);
        }

        const currentUser = await res.json();
        setUser(currentUser);
        setLoading(false);
        return;
      } catch (error: any) {
        if (error?.message?.startsWith('Auth check failed:')) {
          // Non-401 HTTP error — retry
        } else {
          // Network/fetch error — retry
          console.warn(`[Auth] checkAuth attempt ${attempt + 1} error:`, error?.message);
        }

        if (attempt >= maxRetries) {
          console.error('[Auth] checkAuth: all retries exhausted, clearing user');
          setUser(null);
          setLoading(false);
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
  }

  async function login(credentials: LoginRequest) {
    const response = await apiClient.login(credentials);

    // Check if MFA is required
    if (response.mfa_required) {
      // Throw the response so the login page can handle MFA
      throw response;
    }

    if (response.user) {
      setUser(response.user);
      router.push('/');
    }
  }

  async function logout() {
    await apiClient.logout();
    setUser(null);
    router.push('/login');
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
