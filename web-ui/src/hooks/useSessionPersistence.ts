/**
 * useSessionPersistence - Session Management Hook
 *
 * Provides session persistence using localforage (IndexedDB) for storing
 * chat sessions, canvas layouts, and metrics across page reloads.
 *
 * IMPORTANT: Canvas card operations use a save queue to ensure persistence
 * completes before allowing subsequent operations. This prevents ghost cards
 * from appearing after page reload.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import type {
  ChatSession,
  SessionListItem,
  Message,
  CanvasCard,
  CanvasCardLayout,
  PersistedAgentFlowState,
} from '@/types/session';
import {
  createNewSession,
  generateSessionName,
  computeSessionMetrics,
} from '@/types/session';
import {
  findNextAvailablePosition,
  ensureValidLayout,
  resolveCollisions,
  GRID_COLS,
  DEFAULT_CARD_WIDTH,
  DEFAULT_CARD_HEIGHT,
} from '@/utils/canvas-layout';

// Configure localforage for sessions
const sessionsStore = localforage.createInstance({
  name: 'lumen-dashboard',
  storeName: 'sessions',
  description: 'AI Chat Sessions',
});

// Store for current session ID
const CURRENT_SESSION_KEY = 'lumen-current-session-id';

// Backup key for pending session (used during unmount since localforage is async)
const PENDING_SESSION_BACKUP_KEY = 'lumen-pending-session-backup';

// Maximum number of sessions to keep
const MAX_SESSIONS = 50;

// Debounce delay for auto-save (ms)
const AUTO_SAVE_DELAY = 1000;

// Validate session structure to prevent corrupted data
function validateSession(session: unknown): session is ChatSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string' &&
    Array.isArray(s.messages) &&
    Array.isArray(s.canvasCards)
  );
}

// Deduplicate cards by ID (keep last occurrence)
function deduplicateCards(cards: CanvasCard[]): CanvasCard[] {
  const seen = new Map<string, CanvasCard>();
  for (const card of cards) {
    seen.set(card.id, card);
  }
  return Array.from(seen.values());
}

// Note: Grid constants and findNextAvailablePosition are now imported from @/utils/canvas-layout
// This ensures a single source of truth for all layout calculations

// Sanitize cards to fix corrupted data from previous versions
// IMPORTANT: Trust existing layouts! Only set defaults for completely missing layouts.
// Uses smart positioning from canvas-layout.ts to avoid overlaps.
function sanitizeCards(cards: CanvasCard[]): CanvasCard[] {
  // First pass: fix config and ensure layouts have proper defaults
  const sanitizedCards = cards.map(card => {
    const config = sanitizeConfig(card.config);

    // If card has a valid layout, preserve it with defaults for missing dimensions
    if (card.layout && typeof card.layout.x === 'number' && typeof card.layout.y === 'number') {
      const layout: CanvasCardLayout = {
        x: card.layout.x,
        y: card.layout.y,
        w: card.layout.w ?? DEFAULT_CARD_WIDTH,
        h: card.layout.h ?? DEFAULT_CARD_HEIGHT,
        // Preserve optional constraints if present
        ...(card.layout.minW !== undefined && { minW: card.layout.minW }),
        ...(card.layout.minH !== undefined && { minH: card.layout.minH }),
        ...(card.layout.maxW !== undefined && { maxW: card.layout.maxW }),
        ...(card.layout.maxH !== undefined && { maxH: card.layout.maxH }),
      };
      return { ...card, layout, config };
    }

    // Card needs layout - mark it for positioning
    return { ...card, config, _needsLayout: true } as CanvasCard & { _needsLayout?: boolean };
  });

  // Second pass: use ensureValidLayout for cards that need positioning
  // This uses the centralized layout utilities for consistent collision detection
  const result: CanvasCard[] = [];

  for (const card of sanitizedCards) {
    if ((card as CanvasCard & { _needsLayout?: boolean })._needsLayout) {
      // Use ensureValidLayout from canvas-layout.ts
      const cardWithLayout = ensureValidLayout(card, result);
      // Remove the temporary marker
      const { _needsLayout, ...cleanCard } = cardWithLayout as CanvasCard & { _needsLayout?: boolean };
      result.push(cleanCard as CanvasCard);
      console.log('[SessionPersistence] Assigned layout during sanitize:', cleanCard.id, cleanCard.layout);
    } else {
      result.push(card);
    }
  }

  // Third pass: resolve any collisions in the final set
  // This handles cases where persisted layouts might overlap
  const validated = resolveCollisions(result);

  // Only log if collisions were resolved
  if (validated.some((card, i) =>
    card.layout.x !== result[i]?.layout?.x ||
    card.layout.y !== result[i]?.layout?.y
  )) {
    console.log('[SessionPersistence] Resolved collisions in sanitized cards');
  }

  return validated;
}

// Helper to fix config issues
function sanitizeConfig(config: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!config) return undefined;

  const fixed = { ...config };

  // Migrate organizationId -> orgId
  if ('organizationId' in fixed && !('orgId' in fixed)) {
    fixed.orgId = fixed.organizationId;
    delete fixed.organizationId;
  }

  // Ensure isLocked is explicitly false if not set
  if (fixed.isLocked !== true) {
    delete fixed.isLocked;
  }

  return fixed;
}

export interface UseSessionPersistenceReturn {
  // Current session
  currentSession: ChatSession | null;
  isLoading: boolean;
  error: string | null;

  // Session list
  sessions: SessionListItem[];

  // Actions
  createSession: (organization?: string) => Promise<ChatSession>;
  loadSession: (id: string) => Promise<ChatSession | null>;
  saveSession: (session: ChatSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  duplicateSession: (id: string, newName?: string) => Promise<ChatSession | null>;
  renameSession: (id: string, newName: string) => Promise<void>;
  refreshSessions: () => Promise<void>;

  // Convenience setters for current session
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setCanvasCards: (cards: CanvasCard[]) => void;
  addCanvasCard: (card: CanvasCard) => void;
  removeCanvasCard: (cardId: string) => void;
  updateCanvasCard: (cardId: string, updates: Partial<CanvasCard>) => void;

  // Agent flow persistence
  setAgentFlowState: (agentFlowState: PersistedAgentFlowState | undefined) => void;
}

export function useSessionPersistence(): UseSessionPersistenceReturn {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for debounced save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSessionRef = useRef<ChatSession | null>(null);

  // Save queue for canvas card operations - ensures operations complete in order
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isSavingRef = useRef(false);

  // Queue a save operation to ensure it completes before the next one starts
  const queueSave = useCallback(async (session: ChatSession): Promise<boolean> => {
    // Chain this save onto the queue
    const savePromise = saveQueueRef.current.then(async () => {
      isSavingRef.current = true;
      try {
        await sessionsStore.setItem(session.id, session);
        return true;
      } catch (err) {
        console.error('[SessionPersistence] Save failed:', err);
        return false;
      } finally {
        isSavingRef.current = false;
      }
    });

    // Update the queue reference
    saveQueueRef.current = savePromise.then(() => {});

    return savePromise;
  }, []);

  // Load sessions list
  const refreshSessions = useCallback(async () => {
    try {
      const sessionList: SessionListItem[] = [];
      await sessionsStore.iterate<ChatSession, void>((session) => {
        sessionList.push({
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metrics: session.metrics,
          thumbnail: session.thumbnail,
        });
      });

      // Sort by updatedAt (most recent first)
      sessionList.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setSessions(sessionList);
    } catch (err) {
      console.error('[SessionPersistence] Failed to load sessions:', err);
      setError('Failed to load sessions');
    }
  }, []);

  // Initialize: Load current session or create new one
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Check for backup from previous unmount and recover it
        const backupJson = localStorage.getItem(PENDING_SESSION_BACKUP_KEY);
        if (backupJson) {
          try {
            const backupSession = JSON.parse(backupJson) as ChatSession;
            if (validateSession(backupSession)) {
              console.info('[SessionPersistence] Recovering session from backup');
              // Save the backup to localforage
              await sessionsStore.setItem(backupSession.id, backupSession);
              // Clear the backup
              localStorage.removeItem(PENDING_SESSION_BACKUP_KEY);
            }
          } catch (e) {
            console.warn('[SessionPersistence] Failed to recover backup session:', e);
            localStorage.removeItem(PENDING_SESSION_BACKUP_KEY);
          }
        }

        // Load sessions list
        await refreshSessions();

        // Try to load current session from localStorage
        const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
        if (currentId) {
          const rawSession = await sessionsStore.getItem<unknown>(currentId);

          // Validate session structure
          if (validateSession(rawSession)) {
            // Deduplicate and sanitize cards to fix any corruption
            const deduplicatedCards = deduplicateCards(rawSession.canvasCards);
            const cleanedCards = sanitizeCards(deduplicatedCards);

            // Debug: Log card layouts when loading
            console.log('[SessionPersistence] Loading session with cards:', {
              sessionId: rawSession.id,
              cardCount: cleanedCards.length,
              cards: cleanedCards.map(c => ({
                id: c.id,
                type: c.type,
                layout: c.layout,
                isLocked: c.config?.isLocked,
              })),
            });

            const session: ChatSession = {
              ...rawSession,
              canvasCards: cleanedCards,
            };

            // If cards were changed, save the cleaned version
            const cardsChanged = cleanedCards.length !== rawSession.canvasCards.length ||
              JSON.stringify(cleanedCards) !== JSON.stringify(rawSession.canvasCards);
            if (cardsChanged) {
              console.warn('[SessionPersistence] Sanitized corrupted cards in session');
              await sessionsStore.setItem(session.id, session);
            }

            setCurrentSession(session);
            setIsLoading(false);
            return;
          } else {
            // Session is corrupted, remove it
            console.warn('[SessionPersistence] Corrupted session detected, creating new one');
            await sessionsStore.removeItem(currentId);
            localStorage.removeItem(CURRENT_SESSION_KEY);
          }
        }

        // No current session, create new one
        const newSession = createNewSession();
        await sessionsStore.setItem(newSession.id, newSession);
        localStorage.setItem(CURRENT_SESSION_KEY, newSession.id);
        setCurrentSession(newSession);
        await refreshSessions();
      } catch (err) {
        console.error('[SessionPersistence] Initialization failed:', err);
        setError('Failed to initialize session');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [refreshSessions]);

  // Debounced save function
  const debouncedSave = useCallback(async (session: ChatSession) => {
    pendingSessionRef.current = session;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const sessionToSave = pendingSessionRef.current;
      if (sessionToSave) {
        try {
          await sessionsStore.setItem(sessionToSave.id, sessionToSave);
          pendingSessionRef.current = null;
        } catch (err) {
          console.error('[SessionPersistence] Auto-save failed:', err);
        }
      }
    }, AUTO_SAVE_DELAY);
  }, []);

  // Save session immediately
  const saveSession = useCallback(async (session: ChatSession) => {
    try {
      // Update timestamp and metrics
      const updatedSession: ChatSession = {
        ...session,
        updatedAt: new Date().toISOString(),
        metrics: computeSessionMetrics(session.messages, session.canvasCards),
      };

      // Auto-generate name from first user message if still default
      if (updatedSession.name === 'New Session' && updatedSession.messages.length > 0) {
        const firstUserMsg = updatedSession.messages.find((m) => m.role === 'user');
        if (firstUserMsg) {
          updatedSession.name = generateSessionName(firstUserMsg.content);
        }
      }

      await sessionsStore.setItem(updatedSession.id, updatedSession);
      setCurrentSession(updatedSession);
      await refreshSessions();

      // Clean up old sessions if over limit
      await cleanupOldSessions();
    } catch (err) {
      console.error('[SessionPersistence] Save failed:', err);
      setError('Failed to save session');
      throw err;
    }
  }, [refreshSessions]);

  // Create new session
  const createSession = useCallback(async (organization?: string) => {
    try {
      const newSession = createNewSession(organization);
      await sessionsStore.setItem(newSession.id, newSession);
      localStorage.setItem(CURRENT_SESSION_KEY, newSession.id);
      setCurrentSession(newSession);
      await refreshSessions();
      return newSession;
    } catch (err) {
      console.error('[SessionPersistence] Create failed:', err);
      setError('Failed to create session');
      throw err;
    }
  }, [refreshSessions]);

  // Load session by ID
  const loadSession = useCallback(async (id: string) => {
    try {
      const rawSession = await sessionsStore.getItem<ChatSession>(id);
      if (rawSession) {
        // Sanitize cards when loading
        const cleanedCards = sanitizeCards(deduplicateCards(rawSession.canvasCards));

        // Debug: Log card layouts when switching sessions
        console.log('[SessionPersistence] loadSession - switching to session:', {
          sessionId: id,
          cardCount: cleanedCards.length,
          cards: cleanedCards.map(c => ({
            id: c.id,
            type: c.type,
            layout: c.layout,
            isLocked: c.config?.isLocked,
          })),
        });

        const session: ChatSession = {
          ...rawSession,
          canvasCards: cleanedCards,
        };

        localStorage.setItem(CURRENT_SESSION_KEY, id);
        setCurrentSession(session);

        // Save if cards were sanitized
        if (JSON.stringify(cleanedCards) !== JSON.stringify(rawSession.canvasCards)) {
          await sessionsStore.setItem(id, session);
        }

        return session;
      }
      return null;
    } catch (err) {
      console.error('[SessionPersistence] Load failed:', err);
      setError('Failed to load session');
      return null;
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (id: string) => {
    try {
      await sessionsStore.removeItem(id);

      // If deleting current session, create new one
      if (currentSession?.id === id) {
        const newSession = createNewSession(currentSession.organization);
        await sessionsStore.setItem(newSession.id, newSession);
        localStorage.setItem(CURRENT_SESSION_KEY, newSession.id);
        setCurrentSession(newSession);
      }

      await refreshSessions();
    } catch (err) {
      console.error('[SessionPersistence] Delete failed:', err);
      setError('Failed to delete session');
      throw err;
    }
  }, [currentSession, refreshSessions]);

  // Duplicate session ("Start from Session")
  const duplicateSession = useCallback(async (id: string, newName?: string) => {
    try {
      const original = await sessionsStore.getItem<ChatSession>(id);
      if (!original) return null;

      const now = new Date().toISOString();
      const duplicate: ChatSession = {
        ...original,
        id: crypto.randomUUID(),
        name: newName || `${original.name} (copy)`,
        createdAt: now,
        updatedAt: now,
        // Keep messages and cards, but reset metrics
        metrics: computeSessionMetrics(original.messages, original.canvasCards),
      };

      await sessionsStore.setItem(duplicate.id, duplicate);
      localStorage.setItem(CURRENT_SESSION_KEY, duplicate.id);
      setCurrentSession(duplicate);
      await refreshSessions();
      return duplicate;
    } catch (err) {
      console.error('[SessionPersistence] Duplicate failed:', err);
      setError('Failed to duplicate session');
      return null;
    }
  }, [refreshSessions]);

  // Rename session
  const renameSession = useCallback(async (id: string, newName: string) => {
    try {
      const session = await sessionsStore.getItem<ChatSession>(id);
      if (!session) return;

      const trimmedName = newName.trim();
      if (!trimmedName) return;

      const updatedSession: ChatSession = {
        ...session,
        name: trimmedName,
        updatedAt: new Date().toISOString(),
      };

      await sessionsStore.setItem(id, updatedSession);

      // Update current session if it's the one being renamed
      if (currentSession?.id === id) {
        setCurrentSession(updatedSession);
      }

      await refreshSessions();
    } catch (err) {
      console.error('[SessionPersistence] Rename failed:', err);
      setError('Failed to rename session');
      throw err;
    }
  }, [currentSession, refreshSessions]);

  // Clean up old sessions beyond MAX_SESSIONS
  const cleanupOldSessions = async () => {
    try {
      const allSessions: { id: string; updatedAt: string }[] = [];
      await sessionsStore.iterate<ChatSession, void>((session) => {
        allSessions.push({ id: session.id, updatedAt: session.updatedAt });
      });

      if (allSessions.length > MAX_SESSIONS) {
        // Sort by updatedAt (oldest first)
        allSessions.sort((a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );

        // Delete oldest sessions
        const toDelete = allSessions.slice(0, allSessions.length - MAX_SESSIONS);
        for (const { id } of toDelete) {
          await sessionsStore.removeItem(id);
        }
      }
    } catch (err) {
      console.error('[SessionPersistence] Cleanup failed:', err);
    }
  };

  // Convenience setters that auto-save
  // Use functional updates to avoid stale closure issues during async operations
  const setMessages = useCallback((messages: Message[]) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      // Recompute metrics when setting messages
      const metrics = computeSessionMetrics(messages, prev.canvasCards);
      const updated = { ...prev, messages, metrics };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const addMessage = useCallback((message: Message) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      const messages = [...prev.messages, message];
      // Recompute metrics when adding a message
      const metrics = computeSessionMetrics(messages, prev.canvasCards);
      const updated = { ...prev, messages, metrics };
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const setCanvasCards = useCallback((canvasCards: CanvasCard[]) => {
    // Deduplicate cards before setting
    const cleanedCards = deduplicateCards(canvasCards);

    // Resolve any collisions in the cards (safety net)
    const validatedCards = resolveCollisions(cleanedCards);

    // Debug logging for layout issues
    console.log('[SessionPersistence] setCanvasCards layouts:', validatedCards.map(c => ({
      id: c.id,
      type: c.type,
      layout: c.layout,
    })));

    setCurrentSession(prev => {
      if (!prev) return prev;
      const updated = { ...prev, canvasCards: validatedCards, updatedAt: new Date().toISOString() };
      // Queue the save to ensure it completes
      queueSave(updated).then(success => {
        if (!success) {
          console.error('[SessionPersistence] Failed to persist canvas cards');
        }
      });
      return updated;
    });
  }, [queueSave]);

  const addCanvasCard = useCallback((card: CanvasCard) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      // Check for duplicate card ID
      if (prev.canvasCards.some(c => c.id === card.id)) {
        console.warn('[SessionPersistence] Attempted to add duplicate card:', card.id);
        return prev;
      }

      // Use centralized layout utility to ensure valid, non-overlapping position
      // ensureValidLayout handles both missing layouts and collision detection
      const cardWithLayout = ensureValidLayout(card, prev.canvasCards);

      // Log if layout was assigned or changed
      if (cardWithLayout.layout !== card.layout) {
        console.log('[SessionPersistence] Assigned/adjusted layout for card:', cardWithLayout.id, cardWithLayout.layout);
      }

      const canvasCards = [...prev.canvasCards, cardWithLayout];
      const updated = { ...prev, canvasCards, updatedAt: new Date().toISOString() };
      // Queue the save to ensure it completes
      queueSave(updated).then(success => {
        if (!success) {
          console.error('[SessionPersistence] Failed to persist added card');
        }
      });
      return updated;
    });
  }, [queueSave]);

  const removeCanvasCard = useCallback((cardId: string) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      // Check if card exists
      const cardExists = prev.canvasCards.some(c => c.id === cardId);
      if (!cardExists) {
        console.warn('[SessionPersistence] Attempted to remove non-existent card:', cardId);
        return prev;
      }
      const canvasCards = prev.canvasCards.filter((c) => c.id !== cardId);
      const updated = { ...prev, canvasCards, updatedAt: new Date().toISOString() };
      // Queue the save to ensure it completes - this is critical for preventing ghost cards
      queueSave(updated).then(success => {
        if (!success) {
          console.error('[SessionPersistence] CRITICAL: Failed to persist card removal - card may reappear on reload');
        }
      });
      return updated;
    });
  }, [queueSave]);

  const updateCanvasCard = useCallback((cardId: string, updates: Partial<CanvasCard>) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      // Check if card exists
      const cardExists = prev.canvasCards.some(c => c.id === cardId);
      if (!cardExists) {
        console.warn('[SessionPersistence] Attempted to update non-existent card:', cardId);
        return prev;
      }
      const canvasCards = prev.canvasCards.map((c) =>
        c.id === cardId ? { ...c, ...updates, metadata: { ...c.metadata, updatedAt: new Date().toISOString() } } : c
      );
      const updated = { ...prev, canvasCards, updatedAt: new Date().toISOString() };
      // Queue the save to ensure it completes
      queueSave(updated).then(success => {
        if (!success) {
          console.error('[SessionPersistence] Failed to persist card update');
        }
      });
      return updated;
    });
  }, [queueSave]);

  // Set agent flow state for persistence
  const setAgentFlowState = useCallback((agentFlowState: PersistedAgentFlowState | undefined) => {
    setCurrentSession(prev => {
      if (!prev) return prev;
      const updated = { ...prev, agentFlowState, updatedAt: new Date().toISOString() };
      // Queue the save to ensure it completes
      queueSave(updated).then(success => {
        if (!success) {
          console.error('[SessionPersistence] Failed to persist agent flow state');
        } else {
          console.log('[SessionPersistence] Agent flow state persisted:', {
            hasState: !!agentFlowState,
            nodeCount: agentFlowState?.nodes?.length ?? 0,
            phase: agentFlowState?.currentPhase,
          });
        }
      });
      return updated;
    });
  }, [queueSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Force save any pending changes
      // Since localforage is async, we use both:
      // 1. localStorage as synchronous backup (will be recovered on next mount)
      // 2. localforage async save (best-effort)
      if (pendingSessionRef.current) {
        try {
          // Synchronous backup to localStorage (guaranteed to complete before unmount)
          localStorage.setItem(
            PENDING_SESSION_BACKUP_KEY,
            JSON.stringify(pendingSessionRef.current)
          );
        } catch (e) {
          // localStorage might be full or unavailable
          console.warn('[SessionPersistence] Failed to save backup:', e);
        }
        // Also attempt async save to localforage (best-effort)
        sessionsStore.setItem(pendingSessionRef.current.id, pendingSessionRef.current);
      }
    };
  }, []);

  // Handle page unload - wait for pending saves
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingRef.current) {
        // Prevent close if save is in progress
        e.preventDefault();
        e.returnValue = 'Changes are being saved...';
        return 'Changes are being saved...';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    currentSession,
    isLoading,
    error,
    sessions,
    createSession,
    loadSession,
    saveSession,
    deleteSession,
    duplicateSession,
    renameSession,
    refreshSessions,
    setMessages,
    addMessage,
    setCanvasCards,
    addCanvasCard,
    removeCanvasCard,
    updateCanvasCard,
    setAgentFlowState,
  };
}

export default useSessionPersistence;
