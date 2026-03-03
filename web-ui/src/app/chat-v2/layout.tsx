'use client';

/**
 * Chat V2 Layout
 *
 * This layout ensures the chat page fills exactly the viewport
 * with no body scrolling - only internal panels scroll.
 */

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function ChatV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Create QueryClient once per component lifecycle
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        gcTime: 60000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  // Prevent all parent scrolling for this route
  useEffect(() => {
    // Find the parent <main> element from ProtectedRoute and disable its scroll
    const mainElement = containerRef.current?.closest('main');

    const originalStyles: Array<{ el: HTMLElement; overflow: string; height: string }> = [];

    // Store and override main element
    if (mainElement) {
      originalStyles.push({
        el: mainElement,
        overflow: mainElement.style.overflow,
        height: mainElement.style.height,
      });
      mainElement.style.overflow = 'hidden';
    }

    // Store and override body
    originalStyles.push({
      el: document.body,
      overflow: document.body.style.overflow,
      height: document.body.style.height,
    });
    document.body.style.overflow = 'hidden';

    // Store and override html
    originalStyles.push({
      el: document.documentElement,
      overflow: document.documentElement.style.overflow,
      height: document.documentElement.style.height,
    });
    document.documentElement.style.overflow = 'hidden';

    return () => {
      // Restore all original styles on unmount
      originalStyles.forEach(({ el, overflow, height }) => {
        el.style.overflow = overflow;
        el.style.height = height;
      });
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        {children}
      </div>
    </QueryClientProvider>
  );
}
