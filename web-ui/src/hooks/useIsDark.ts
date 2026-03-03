'use client';

import { useState, useEffect } from 'react';

/**
 * Observes the `dark` class on <html> via MutationObserver.
 * Useful for SVG components that can't use Tailwind `dark:` for inline fill/stroke.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'));
    });

    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
