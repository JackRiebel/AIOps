'use client';

import React, { memo } from 'react';

/**
 * GridBackground - Canvas Grid Pattern Component
 *
 * Provides the animated grid background with glowing orbs for the canvas workspace.
 * Extracted from the login page styling.
 */

interface GridBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  /** Show animated orbs (default: true) */
  showOrbs?: boolean;
  /** Grid cell size in pixels (default: 50) */
  gridSize?: number;
}

export const GridBackground = memo(function GridBackground({
  children,
  className = '',
  showOrbs = true,
  gridSize = 50,
}: GridBackgroundProps) {
  return (
    <div className={`relative overflow-hidden bg-slate-50 dark:bg-slate-900 ${className}`}>
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
        aria-hidden="true"
      />

      {/* Animated glowing orbs */}
      {showOrbs && (
        <>
          {/* Top-left cyan orb */}
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl animate-pulse pointer-events-none"
            aria-hidden="true"
          />

          {/* Bottom-right purple orb */}
          <div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl animate-pulse pointer-events-none"
            style={{ animationDelay: '1s' }}
            aria-hidden="true"
          />

          {/* Center blue orb (subtle) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse pointer-events-none"
            style={{ animationDelay: '2s' }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Content layer */}
      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
});

GridBackground.displayName = 'GridBackground';

export default GridBackground;
