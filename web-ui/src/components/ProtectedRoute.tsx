'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navigation from './Navigation';
import TopBar from './TopBar';
import AISessionSummaryCard from './AISessionSummaryCard';
import { OnboardingProvider } from './onboarding';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Public pages that don't require authentication
  const publicPages = ['/login', '/register', '/setup', '/setup/wizard'];
  const isPublicPage = publicPages.includes(pathname) || pathname.startsWith('/setup/');

  useEffect(() => {
    // If not loading and no user, redirect to login (unless on public page)
    if (!loading && !user && !isPublicPage) {
      router.push('/login');
    }
  }, [user, loading, pathname, router, isPublicPage]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-300 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on public page, show nothing (will redirect)
  if (!user && !isPublicPage) {
    return null;
  }

  // Public pages (login, setup) don't need navigation
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Authenticated pages get navigation and top bar
  return (
    <OnboardingProvider userName={user?.username}>
      <Navigation />
      <TopBar />
      <main
        className="transition-all duration-300 overflow-auto"
        style={{
          marginLeft: 'var(--sidebar-width, 14rem)',
          marginTop: 'var(--topbar-height, 73px)',
          height: 'calc(100vh - var(--topbar-height, 73px))',
        }}
      >
        {children}
      </main>
      {/* Global AI Session Summary Modal - renders when completedSession is set */}
      <AISessionSummaryCard />
    </OnboardingProvider>
  );
}
