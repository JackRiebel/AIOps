'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { CanvasCard } from '@/types/session';

// =============================================================================
// Types
// =============================================================================

interface SavedCanvas {
  id: number;
  name: string;
  description?: string;
  is_template: boolean;
  is_public: boolean;
  share_token?: string;
  tags?: string[];
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface SavedCanvasDetail extends SavedCanvas {
  canvas_state: {
    cards: CanvasCard[];
    positions: Record<string, unknown>;
    config: Record<string, unknown>;
  };
}

interface SaveCanvasControlsProps {
  /** Current canvas cards */
  cards: CanvasCard[];
  /** Handler to load canvas state */
  onLoadCanvas: (cards: CanvasCard[]) => void;
  /** Optional class name */
  className?: string;
}

// =============================================================================
// Save Canvas Modal
// =============================================================================

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CanvasCard[];
  onSaved: () => void;
}

function SaveCanvasModal({ isOpen, onClose, cards, onSaved }: SaveModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_template: isTemplate,
          canvas_state: {
            cards,
            positions: {},
            config: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save canvas');
      }

      onSaved();
      onClose();
      setName('');
      setDescription('');
      setIsTemplate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Save Canvas
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dashboard for monitoring..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Save as template (others can use this)
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Canvas
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Share Canvas Modal
// =============================================================================

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: SavedCanvas | null;
  onShared: (canvas: SavedCanvas) => void;
}

function ShareCanvasModal({ isOpen, onClose, canvas, onShared }: ShareModalProps) {
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresHours, setExpiresHours] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when canvas changes
  useEffect(() => {
    if (canvas?.share_token && canvas.is_public) {
      setShareUrl(`${window.location.origin}/canvas/shared/${canvas.share_token}`);
    } else {
      setShareUrl(null);
    }
    setCopied(false);
    setError(null);
  }, [canvas]);

  const handleShare = async () => {
    if (!canvas) return;

    setSharing(true);
    setError(null);

    try {
      const response = await fetch(`/api/canvases/${canvas.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          is_public: true,
          expires_hours: expiresHours ? parseInt(expiresHours) : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to share canvas');
      }

      const data = await response.json();
      const fullUrl = `${window.location.origin}${data.share_url}`;
      setShareUrl(fullUrl);
      onShared({ ...canvas, share_token: data.share_token, is_public: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy link');
    }
  };

  if (!isOpen || !canvas) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Share Canvas
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Share <span className="font-medium text-slate-900 dark:text-white">{canvas.name}</span> with others via a link.
          </p>

          {shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    copied
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Anyone with this link can view this canvas (read-only).
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link expiration (optional)
                </label>
                <select
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Never expires</option>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            {shareUrl ? 'Done' : 'Cancel'}
          </button>
          {!shareUrl && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sharing && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Generate Link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Load Canvas Modal
// =============================================================================

interface LoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (cards: CanvasCard[]) => void;
  onShare: (canvas: SavedCanvas) => void;
}

function LoadCanvasModal({ isOpen, onClose, onLoad, onShare }: LoadModalProps) {
  const [canvases, setCanvases] = useState<SavedCanvas[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeTemplates, setIncludeTemplates] = useState(true);

  const fetchCanvases = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/canvases?include_templates=${includeTemplates}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load canvases');
      }

      const data = await response.json();
      setCanvases(data.canvases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [includeTemplates]);

  useEffect(() => {
    if (isOpen) {
      fetchCanvases();
    }
  }, [isOpen, fetchCanvases]);

  const handleLoad = async (canvasId: number) => {
    setLoadingId(canvasId);

    try {
      const response = await fetch(`/api/canvases/${canvasId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load canvas');
      }

      const data: SavedCanvasDetail = await response.json();
      onLoad(data.canvas_state.cards || []);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (canvasId: number) => {
    if (!confirm('Are you sure you want to delete this canvas?')) return;

    try {
      const response = await fetch(`/api/canvases/${canvasId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      setCanvases(prev => prev.filter(c => c.id !== canvasId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Load Canvas
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={includeTemplates}
            onChange={(e) => setIncludeTemplates(e.target.checked)}
            className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Include templates
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : canvases.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No saved canvases yet
            </div>
          ) : (
            canvases.map((canvas) => (
              <div
                key={canvas.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {canvas.name}
                    </span>
                    {canvas.is_template && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                        Template
                      </span>
                    )}
                  </div>
                  {canvas.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {canvas.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Updated {new Date(canvas.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleLoad(canvas.id)}
                    disabled={loadingId === canvas.id}
                    className="p-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg disabled:opacity-50"
                    title="Load canvas"
                  >
                    {loadingId === canvas.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                  </button>
                  {!canvas.is_template && (
                    <>
                      <button
                        onClick={() => onShare(canvas)}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        title="Share canvas"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(canvas.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        title="Delete canvas"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SaveCanvasControls({ cards, onLoadCanvas, className = '' }: SaveCanvasControlsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedCanvas, setSelectedCanvas] = useState<SavedCanvas | null>(null);

  const handleSaved = useCallback(() => {
    // Could show a toast notification here
    console.log('Canvas saved successfully');
  }, []);

  const handleShareCanvas = useCallback((canvas: SavedCanvas) => {
    setSelectedCanvas(canvas);
    setShowShareModal(true);
  }, []);

  const handleCanvasShared = useCallback((updatedCanvas: SavedCanvas) => {
    setSelectedCanvas(updatedCanvas);
  }, []);

  return (
    <>
      {/* Controls */}
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={cards.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Save current canvas"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>

        <button
          onClick={() => setShowLoadModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Load saved canvas"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Load
        </button>
      </div>

      {/* Modals */}
      <SaveCanvasModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        cards={cards}
        onSaved={handleSaved}
      />

      <LoadCanvasModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={onLoadCanvas}
        onShare={handleShareCanvas}
      />

      <ShareCanvasModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedCanvas(null);
        }}
        canvas={selectedCanvas}
        onShared={handleCanvasShared}
      />
    </>
  );
}

export default SaveCanvasControls;
