'use client';

import React, { useState } from 'react';
import { Layers, Save, FolderOpen, MoreHorizontal, Plus } from 'lucide-react';
import type { CanvasCard } from '@/types/session';
import type { PresenceUser } from '@/hooks/useCanvasPresence';
import { PresenceAvatars } from './PresenceAvatars';
import SaveCanvasControls from './SaveCanvasControls';
import { CardPicker } from './CardPicker';

// =============================================================================
// Types
// =============================================================================

interface CanvasFloatingControlsProps {
  /** Current canvas cards */
  cards: CanvasCard[];
  /** Handler to load canvas state */
  onLoadCanvas: (cards: CanvasCard[]) => void;
  /** Handler to open template selector */
  onOpenTemplates: () => void;
  /** Handler to add a single card */
  onAddCard?: (card: CanvasCard) => void;
  /** Presence members for collaboration */
  presenceMembers?: PresenceUser[];
  /** Current user ID */
  currentUserId?: string;
  /** Whether presence is connected */
  presenceConnected?: boolean;
  /** Whether canvas has content */
  hasContent?: boolean;
  /** Network context for cards */
  networkId?: string;
  orgId?: string;
}

// =============================================================================
// Compact Floating Menu
// =============================================================================

interface FloatingMenuProps {
  cards: CanvasCard[];
  onLoadCanvas: (cards: CanvasCard[]) => void;
  onOpenTemplates: () => void;
  hasContent: boolean;
}

function FloatingMenu({ cards, onLoadCanvas, onOpenTemplates, hasContent }: FloatingMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  // Auto-collapse after action
  const handleAction = (action: () => void) => {
    action();
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      {/* Expanded Menu */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-1 p-1 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-xl min-w-[140px]">
          <button
            onClick={() => handleAction(onOpenTemplates)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left"
          >
            <Layers className="w-4 h-4" />
            <span>Templates</span>
          </button>
          <button
            onClick={() => handleAction(() => setShowSaveModal(true))}
            disabled={cards.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button
            onClick={() => handleAction(() => setShowLoadModal(true))}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Load</span>
          </button>
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-2.5 rounded-xl transition-all ${
          isExpanded
            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
            : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/90 border border-slate-700/50'
        } backdrop-blur-sm`}
        title="Canvas actions"
        aria-expanded={isExpanded}
        aria-haspopup="menu"
      >
        <MoreHorizontal className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Click outside to close */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Modals rendered via SaveCanvasControls hidden trigger */}
      <SaveCanvasControlsModals
        showSaveModal={showSaveModal}
        showLoadModal={showLoadModal}
        onCloseSave={() => setShowSaveModal(false)}
        onCloseLoad={() => setShowLoadModal(false)}
        cards={cards}
        onLoadCanvas={onLoadCanvas}
      />
    </div>
  );
}

// Separate modals component to handle save/load
interface SaveCanvasControlsModalsProps {
  showSaveModal: boolean;
  showLoadModal: boolean;
  onCloseSave: () => void;
  onCloseLoad: () => void;
  cards: CanvasCard[];
  onLoadCanvas: (cards: CanvasCard[]) => void;
}

function SaveCanvasControlsModals({
  showSaveModal,
  showLoadModal,
  onCloseSave,
  onCloseLoad,
  cards,
  onLoadCanvas,
}: SaveCanvasControlsModalsProps) {
  // Render SaveCanvasControls but with controlled modal state
  // We'll need to refactor SaveCanvasControls to accept controlled props
  // For now, use the existing component with a hidden trigger
  return (
    <div className="hidden">
      <SaveCanvasControls
        cards={cards}
        onLoadCanvas={onLoadCanvas}
      />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CanvasFloatingControls({
  cards,
  onLoadCanvas,
  onOpenTemplates,
  onAddCard,
  presenceMembers = [],
  currentUserId,
  presenceConnected = false,
  hasContent = false,
  networkId,
  orgId,
}: CanvasFloatingControlsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);

  return (
    <>
      {/* Top-right: Presence avatars */}
      <div className="absolute top-3 right-3 z-20">
        <PresenceAvatars
          members={presenceMembers}
          currentUserId={currentUserId}
          isConnected={presenceConnected}
          size="sm"
        />
      </div>

      {/* Top-left: Action menu (moved from bottom-right to avoid blocking card resize handles) */}
      <div className="absolute top-3 left-3 z-20">
        <div className="relative">
          {/* Expanded Menu */}
          {menuExpanded && (
            <div className="absolute top-full left-0 mt-2 flex flex-col gap-1 p-1.5 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-xl min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-150">
              {onAddCard && (
                <button
                  onClick={() => {
                    setShowCardPicker(true);
                    setMenuExpanded(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Add Card</span>
                </button>
              )}
              <button
                onClick={() => {
                  onOpenTemplates();
                  setMenuExpanded(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Templates</span>
              </button>
              <div className="h-px bg-slate-700/50 my-1" />
              <button
                onClick={() => {
                  setShowSaveModal(true);
                  setMenuExpanded(false);
                }}
                disabled={cards.length === 0}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 text-cyan-400" />
                <span>Save Canvas</span>
              </button>
              <button
                onClick={() => {
                  setShowLoadModal(true);
                  setMenuExpanded(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-left"
              >
                <FolderOpen className="w-4 h-4 text-green-400" />
                <span>Load Canvas</span>
              </button>
            </div>
          )}

          {/* Trigger Button */}
          <button
            onClick={() => setMenuExpanded(!menuExpanded)}
            className={`p-2.5 rounded-xl transition-all shadow-lg ${
              menuExpanded
                ? 'bg-cyan-600 text-white shadow-cyan-500/25'
                : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/50 shadow-black/20'
            } backdrop-blur-sm`}
            title="Canvas actions"
            aria-expanded={menuExpanded}
            aria-haspopup="menu"
          >
            <MoreHorizontal className={`w-5 h-5 transition-transform duration-200 ${menuExpanded ? 'rotate-90' : ''}`} />
          </button>

          {/* Click outside to close */}
          {menuExpanded && (
            <div
              className="fixed inset-0 z-[-1]"
              onClick={() => setMenuExpanded(false)}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Modals - using SaveCanvasControls internal modals */}
      {/* We expose controlled state via a hidden SaveCanvasControls that we trigger */}
      <SaveCanvasControlsControlled
        cards={cards}
        onLoadCanvas={onLoadCanvas}
        showSaveModal={showSaveModal}
        showLoadModal={showLoadModal}
        onCloseSave={() => setShowSaveModal(false)}
        onCloseLoad={() => setShowLoadModal(false)}
      />

      {/* Card Picker Modal */}
      {onAddCard && (
        <CardPicker
          isOpen={showCardPicker}
          onClose={() => setShowCardPicker(false)}
          onAddCard={onAddCard}
          networkId={networkId}
          orgId={orgId}
          existingCards={cards}
        />
      )}
    </>
  );
}

// Controlled version that exposes modal state
interface SaveCanvasControlsControlledProps {
  cards: CanvasCard[];
  onLoadCanvas: (cards: CanvasCard[]) => void;
  showSaveModal: boolean;
  showLoadModal: boolean;
  onCloseSave: () => void;
  onCloseLoad: () => void;
}

function SaveCanvasControlsControlled({
  cards,
  onLoadCanvas,
  showSaveModal,
  showLoadModal,
  onCloseSave,
  onCloseLoad,
}: SaveCanvasControlsControlledProps) {
  const [shareCanvas, setShareCanvas] = useState<{ id: number; name: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <>
      {/* Save Modal */}
      {showSaveModal && (
        <SaveModal
          isOpen={showSaveModal}
          onClose={onCloseSave}
          cards={cards}
        />
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <LoadModal
          isOpen={showLoadModal}
          onClose={onCloseLoad}
          onLoad={onLoadCanvas}
          onShare={(canvas) => {
            setShareCanvas(canvas);
            setShowShareModal(true);
          }}
        />
      )}

      {/* Share Modal */}
      {showShareModal && shareCanvas && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setShareCanvas(null);
          }}
          canvas={shareCanvas}
        />
      )}
    </>
  );
}

// =============================================================================
// Inline Modal Components (simplified versions)
// =============================================================================

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CanvasCard[];
}

function SaveModal({ isOpen, onClose, cards }: SaveModalProps) {
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
          canvas_state: { cards, positions: {}, config: {} },
        }),
      });

      if (!response.ok) throw new Error('Failed to save canvas');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Save Canvas</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Dashboard"
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dashboard for monitoring..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="w-4 h-4 text-cyan-600 rounded border-slate-500 focus:ring-cyan-500 bg-slate-700"
            />
            <span className="text-sm text-slate-400">Save as template</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg"
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
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface LoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (cards: CanvasCard[]) => void;
  onShare: (canvas: { id: number; name: string }) => void;
}

interface SavedCanvas {
  id: number;
  name: string;
  description?: string;
  is_template: boolean;
  updated_at: string;
}

function LoadModal({ isOpen, onClose, onLoad, onShare }: LoadModalProps) {
  const [canvases, setCanvases] = useState<SavedCanvas[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/canvases?include_templates=true', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setCanvases(d.canvases || []))
        .catch(() => setError('Failed to load canvases'))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleLoad = async (canvasId: number) => {
    setLoadingId(canvasId);
    try {
      const response = await fetch(`/api/canvases/${canvasId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      onLoad(data.canvas_state?.cards || []);
      onClose();
    } catch {
      setError('Failed to load canvas');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (canvasId: number) => {
    if (!confirm('Delete this canvas?')) return;
    try {
      await fetch(`/api/canvases/${canvasId}`, { method: 'DELETE', credentials: 'include' });
      setCanvases((prev) => prev.filter((c) => c.id !== canvasId));
    } catch {
      setError('Failed to delete');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] flex flex-col border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Load Canvas</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : canvases.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No saved canvases</div>
          ) : (
            canvases.map((canvas) => (
              <div
                key={canvas.id}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{canvas.name}</span>
                    {canvas.is_template && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded">
                        Template
                      </span>
                    )}
                  </div>
                  {canvas.description && (
                    <p className="text-sm text-slate-400 truncate">{canvas.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleLoad(canvas.id)}
                    disabled={loadingId === canvas.id}
                    className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg disabled:opacity-50"
                    title="Load"
                  >
                    {loadingId === canvas.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <FolderOpen className="w-5 h-5" />
                    )}
                  </button>
                  {!canvas.is_template && (
                    <button
                      onClick={() => handleDelete(canvas.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: { id: number; name: string };
}

function ShareModal({ isOpen, onClose, canvas }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const response = await fetch(`/api/canvases/${canvas.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_public: true }),
      });
      if (!response.ok) throw new Error('Failed to share');
      const data = await response.json();
      setShareUrl(`${window.location.origin}${data.share_url}`);
    } catch {
      // Handle error
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Share Canvas</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {shareUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-slate-600 rounded-lg bg-slate-700 text-white"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  copied ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                }`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
          >
            {sharing ? 'Generating...' : 'Generate Share Link'}
          </button>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default CanvasFloatingControls;
