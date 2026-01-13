'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SetupCheckProps {
  children: React.ReactNode;
}

/**
 * SetupCheck component that redirects to /setup if first-run setup is needed.
 *
 * This component:
 * 1. Checks if setup is required on mount
 * 2. Redirects to /setup if no admin user exists or AI provider isn't configured
 * 3. Allows /setup and /login pages to render without redirect
 */
export function SetupCheck({ children }: SetupCheckProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    // Don't check on setup pages or registration
    if (pathname === '/setup' || pathname.startsWith('/setup/') || pathname === '/register') {
      setChecking(false);
      return;
    }

    async function checkSetup() {
      try {
        const res = await fetch('/api/setup/status');
        if (!res.ok) {
          // API might not be available yet, continue loading app
          setChecking(false);
          return;
        }

        const data = await res.json();

        if (data.setup_required) {
          setSetupRequired(true);
          router.push('/setup');
        } else {
          setChecking(false);
        }
      } catch (error) {
        // If setup API fails, just continue - might be a network issue
        console.warn('Setup check failed:', error);
        setChecking(false);
      }
    }

    checkSetup();
  }, [pathname, router]);

  // Pages that bypass setup check entirely
  const bypassPages = ['/setup', '/register'];
  const isBypassPage = bypassPages.includes(pathname) || pathname.startsWith('/setup/');

  // Show loading state while checking setup
  if (checking && !isBypassPage) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" />
          <p className="mt-4 text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If setup is required and we're not on a bypass page, don't render anything
  // (redirect is in progress)
  if (setupRequired && !isBypassPage) {
    return null;
  }

  return <>{children}</>;
}
