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
    setSessionExpiredHandler(() => {
      setUser(null);
      router.push('/login');
    });

    checkAuth();
  }, [router]);

  async function checkAuth() {
    try {
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
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
