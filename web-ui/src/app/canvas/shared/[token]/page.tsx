'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CanvasWorkspace } from '@/components/canvas';
import type { CanvasCard } from '@/types/session';

// =============================================================================
// Types
// =============================================================================

interface SharedCanvasData {
  id: number;
  name: string;
  description?: string;
  canvas_state: {
    cards: CanvasCard[];
    positions: Record<string, unknown>;
    config: Record<string, unknown>;
  };
  is_template: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Shared Canvas Page
// =============================================================================

export default function SharedCanvasPage() {
  const params = useParams();
  const token = params.token as string;

  const [canvas, setCanvas] = useState<SharedCanvasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shared canvas
  useEffect(() => {
    async function fetchCanvas() {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/canvases/shared/${token}`);

        if (response.status === 404) {
          setError('Canvas not found or share link has expired');
          return;
        }

        if (response.status === 410) {
          setError('This share link has expired');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load canvas');
        }

        const data = await response.json();
        setCanvas(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load canvas');
      } finally {
        setLoading(false);
      }
    }

    fetchCanvas();
  }, [token]);

  // Read-only handlers (no-ops)
  const handleLayoutChange = useCallback(() => {}, []);
  const handleCardRemove = useCallback(() => {}, []);
  const handleCardLockToggle = useCallback(() => {}, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-400">Loading shared canvas...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4" role="alert">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Unable to Load Canvas</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Canvas view
  if (!canvas) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Lumen Logo */}
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-white">Lumen</span>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-700" aria-hidden="true" />

            {/* Canvas Info */}
            <div>
              <h1 className="text-lg font-semibold text-white">{canvas.name}</h1>
              {canvas.description && (
                <p className="text-sm text-slate-400">{canvas.description}</p>
              )}
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm text-slate-400" aria-label="Canvas information">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span aria-label={`${canvas.view_count} views`}>{canvas.view_count} views</span>
            </span>
            {canvas.is_template && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                Template
              </span>
            )}
            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs" aria-label="This canvas is read-only">
              Read-only
            </span>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <main className="flex-1 overflow-hidden" aria-label="Shared canvas content">
        {canvas.canvas_state.cards.length === 0 ? (
          <div className="h-full flex items-center justify-center" role="status">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <p className="text-slate-400">This canvas is empty</p>
            </div>
          </div>
        ) : (
          <CanvasWorkspace
            cards={canvas.canvas_state.cards}
            onLayoutChange={handleLayoutChange}
            onCardRemove={handleCardRemove}
            onCardLockToggle={handleCardLockToggle}
            disabled={true}
            className="h-full"
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800/30 border-t border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto text-sm text-slate-500">
          <span>Shared via Lumen AI Canvas</span>
          <span>Last updated {new Date(canvas.updated_at).toLocaleDateString()}</span>
        </div>
      </footer>
    </div>
  );
}
