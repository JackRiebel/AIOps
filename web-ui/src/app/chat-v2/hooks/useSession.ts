'use client';

/**
 * useSession - Session Management Hook
 *
 * Manages chat sessions with IndexedDB persistence.
 * V2: Uses SmartCard instead of CanvasCard with automatic migration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import type {
  ChatSession,
  LegacyChatSession,
  SessionListItem,
  ChatMessage,
  CanvasCard,
  AgentFlowData,
} from '../types';
import { CURRENT_SESSION_VERSION } from '../types';
import type { SmartCard, AllCardTypes, CreateCardOptions } from '../cards/types';
import { createCard, toggleCardPin as toggleSmartCardPin } from '../cards/factory';

// Storage configuration
const sessionStore = localforage.createInstance({
  name: 'lumen-chat-v2',
  storeName: 'sessions',
});

const CURRENT_SESSION_KEY = 'lumen-chat-v2-current';
const SAVE_DEBOUNCE_MS = 500;

// =============================================================================
// Migration: Convert CanvasCard to SmartCard
// =============================================================================

function migrateCanvasCardToSmartCard(card: CanvasCard): SmartCard {
  const now = new Date().toISOString();

  // Map old card types to new SmartCard types
  const typeMapping: Record<string, AllCardTypes> = {
    'network-health': 'meraki_network_health',
    'device-table': 'meraki_device_table',
    'client-distribution': 'meraki_ssid_clients',
    'alert-summary': 'meraki_alert_summary',
    'topology': 'network_stp_topology',
    'performance-chart': 'meraki_bandwidth_usage',
    'security-events': 'meraki_security_events',
    'custom': 'meraki_network_health', // Default fallback
  };

  const smartCardType = typeMapping[card.type] || 'meraki_network_health';

  return createCard({
    type: smartCardType,
    title: card.title,
    data: card.data,
    toolCallId: `migrated-${card.id}`,
    sourceMessageId: card.config?.sourceMessageId as string,
    originalQuery: 'Migrated from legacy card',
  });
}

function migrateSession(legacy: LegacyChatSession): ChatSession {
  return {
    ...legacy,
    version: CURRENT_SESSION_VERSION,
    cards: legacy.cards.map(migrateCanvasCardToSmartCard),
  };
}

function isLegacySession(session: ChatSession | LegacyChatSession): session is LegacyChatSession {
  return !session.version || session.version < CURRENT_SESSION_VERSION;
}

// =============================================================================
// Helper Functions
// =============================================================================

function createEmptySession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'New Chat',
    messages: [],
    cards: [],
    agentFlow: {
      toolExecutions: [],
      agentTurns: [],
    },
    createdAt: now,
    updatedAt: now,
    version: CURRENT_SESSION_VERSION,
    metrics: {
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCost: 0,
      messageCount: 0,
      cardCount: 0,
    },
  };
}

function computeMetrics(messages: ChatMessage[], cards: SmartCard[]) {
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCost = 0;

  for (const msg of messages) {
    if (msg.metadata) {
      totalTokensIn += msg.metadata.inputTokens || 0;
      totalTokensOut += msg.metadata.outputTokens || 0;
      totalCost += msg.metadata.costUsd || 0;
    }
  }

  return {
    totalTokensIn,
    totalTokensOut,
    totalCost,
    messageCount: messages.length,
    cardCount: cards.length,
  };
}

function generateSessionName(firstMessage: string): string {
  return firstMessage
    .replace(/[^\w\s]/g, '')
    .trim()
    .slice(0, 40) || 'New Chat';
}

// =============================================================================
// Hook Definition
// =============================================================================

export interface AddCardOptions {
  type: AllCardTypes;
  title: string;
  subtitle?: string;
  data: unknown;
  toolCallId: string;
  sourceMessageId?: string;
  originalQuery?: string;
  refreshEndpoint?: string;
  refreshInterval?: number;
  scope?: {
    organizationId?: string;
    organizationName?: string;
    networkId?: string;
    networkName?: string;
    testId?: string;
  };
}

export interface UseSessionReturn {
  // State
  session: ChatSession | null;
  sessions: SessionListItem[];
  isLoading: boolean;

  // Session Actions
  newSession: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;

  // Message Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

  // Card Actions (now using SmartCard)
  addCard: (options: AddCardOptions) => SmartCard;
  removeCard: (cardId: string) => void;
  removeCardWithUndo: (cardId: string) => { card: SmartCard; restore: () => void } | null;
  toggleCardPin: (cardId: string) => void;
  clearUnpinnedCards: () => { cards: SmartCard[]; restore: () => void } | null;
  updateCardData: (cardId: string, data: unknown) => void;

  // Agent Flow Actions
  updateAgentFlow: (agentFlow: AgentFlowData) => void;
  clearAgentFlow: () => void;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Debounced save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSessionRef = useRef<ChatSession | null>(null);

  // Save session to storage (debounced)
  const saveSession = useCallback((sessionToSave: ChatSession) => {
    pendingSessionRef.current = sessionToSave;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const s = pendingSessionRef.current;
      if (s) {
        try {
          await sessionStore.setItem(s.id, s);
          pendingSessionRef.current = null;
        } catch (err) {
          console.error('[useSession] Save failed:', err);
        }
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Refresh session list
  const refreshSessionList = useCallback(async () => {
    const list: SessionListItem[] = [];
    await sessionStore.iterate<ChatSession | LegacyChatSession, void>((s) => {
      list.push({
        id: s.id,
        name: s.name,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      });
    });
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setSessions(list);
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await refreshSessionList();

        // Try to load current session
        const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
        if (currentId) {
          const loaded = await sessionStore.getItem<ChatSession | LegacyChatSession>(currentId);
          if (loaded) {
            // Migrate if needed
            const migrated = isLegacySession(loaded) ? migrateSession(loaded) : loaded;
            if (isLegacySession(loaded)) {
              // Save migrated session
              await sessionStore.setItem(migrated.id, migrated);
            }
            setSession(migrated);
            setIsLoading(false);
            return;
          }
        }

        // Create new session
        const newSession = createEmptySession();
        await sessionStore.setItem(newSession.id, newSession);
        localStorage.setItem(CURRENT_SESSION_KEY, newSession.id);
        setSession(newSession);
        await refreshSessionList();
      } catch (err) {
        console.error('[useSession] Init failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [refreshSessionList]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Force save pending changes
      if (pendingSessionRef.current) {
        sessionStore.setItem(pendingSessionRef.current.id, pendingSessionRef.current);
      }
    };
  }, []);

  // Update session helper
  const updateSession = useCallback(
    (updater: (prev: ChatSession) => ChatSession) => {
      setSession((prev) => {
        if (!prev) return prev;

        const updated = updater(prev);
        const withMetrics: ChatSession = {
          ...updated,
          updatedAt: new Date().toISOString(),
          metrics: computeMetrics(updated.messages, updated.cards),
        };

        // Auto-name from first user message
        if (withMetrics.name === 'New Chat' && withMetrics.messages.length > 0) {
          const firstUser = withMetrics.messages.find((m) => m.role === 'user');
          if (firstUser) {
            withMetrics.name = generateSessionName(firstUser.content);
          }
        }

        saveSession(withMetrics);
        return withMetrics;
      });
    },
    [saveSession]
  );

  // Session actions
  const newSession = useCallback(async () => {
    const s = createEmptySession();
    await sessionStore.setItem(s.id, s);
    localStorage.setItem(CURRENT_SESSION_KEY, s.id);
    setSession(s);
    await refreshSessionList();
  }, [refreshSessionList]);

  const loadSession = useCallback(
    async (id: string) => {
      const loaded = await sessionStore.getItem<ChatSession | LegacyChatSession>(id);
      if (loaded) {
        // Migrate if needed
        const migrated = isLegacySession(loaded) ? migrateSession(loaded) : loaded;
        if (isLegacySession(loaded)) {
          await sessionStore.setItem(migrated.id, migrated);
        }
        localStorage.setItem(CURRENT_SESSION_KEY, id);
        setSession(migrated);
      }
    },
    []
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        console.log('[useSession] Deleting session:', id);
        await sessionStore.removeItem(id);
        console.log('[useSession] Session removed from storage');

        if (session?.id === id) {
          console.log('[useSession] Deleted current session, creating new one');
          await newSession();
        }

        await refreshSessionList();
        console.log('[useSession] Session list refreshed');
      } catch (err) {
        console.error('[useSession] Failed to delete session:', err);
      }
    },
    [session, newSession, refreshSessionList]
  );

  const renameSession = useCallback(
    async (id: string, name: string) => {
      const s = await sessionStore.getItem<ChatSession>(id);
      if (s) {
        const updated = { ...s, name: name.trim(), updatedAt: new Date().toISOString() };
        await sessionStore.setItem(id, updated);
        if (session?.id === id) {
          setSession(updated);
        }
        await refreshSessionList();
      }
    },
    [session, refreshSessionList]
  );

  // Message actions
  const addMessage = useCallback(
    (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const fullMessage: ChatMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      updateSession((prev) => ({
        ...prev,
        messages: [...prev.messages, fullMessage],
      }));
    },
    [updateSession]
  );

  // Card actions - now using SmartCard factory
  const addCard = useCallback(
    (options: AddCardOptions): SmartCard => {
      const smartCard = createCard({
        type: options.type,
        title: options.title,
        subtitle: options.subtitle,
        data: options.data,
        toolCallId: options.toolCallId,
        sourceMessageId: options.sourceMessageId,
        originalQuery: options.originalQuery,
        refreshEndpoint: options.refreshEndpoint,
        refreshInterval: options.refreshInterval,
        scope: options.scope,
      });

      updateSession((prev) => ({
        ...prev,
        cards: [...prev.cards, smartCard],
      }));

      return smartCard;
    },
    [updateSession]
  );

  const removeCard = useCallback(
    (cardId: string) => {
      updateSession((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== cardId),
      }));
    },
    [updateSession]
  );

  // Remove card with undo capability (returns restore function)
  const removeCardWithUndo = useCallback(
    (cardId: string): { card: SmartCard; restore: () => void } | null => {
      const currentSession = session;
      if (!currentSession) return null;

      const cardToRemove = currentSession.cards.find((c) => c.id === cardId);
      if (!cardToRemove) return null;

      // Remove the card
      updateSession((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== cardId),
      }));

      // Return restore function
      return {
        card: cardToRemove,
        restore: () => {
          updateSession((prev) => ({
            ...prev,
            cards: [...prev.cards, cardToRemove],
          }));
        },
      };
    },
    [session, updateSession]
  );

  // Toggle card pin state
  const toggleCardPin = useCallback(
    (cardId: string) => {
      updateSession((prev) => ({
        ...prev,
        cards: prev.cards.map((c) =>
          c.id === cardId ? toggleSmartCardPin(c) : c
        ),
      }));
    },
    [updateSession]
  );

  // Clear all unpinned cards with undo capability
  const clearUnpinnedCards = useCallback((): { cards: SmartCard[]; restore: () => void } | null => {
    const currentSession = session;
    if (!currentSession) return null;

    const unpinnedCards = currentSession.cards.filter((c) => !c.pinned);
    if (unpinnedCards.length === 0) return null;

    // Remove unpinned cards
    updateSession((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.pinned),
    }));

    // Return restore function
    return {
      cards: unpinnedCards,
      restore: () => {
        updateSession((prev) => ({
          ...prev,
          cards: [...prev.cards, ...unpinnedCards],
        }));
      },
    };
  }, [session, updateSession]);

  const updateCardData = useCallback(
    (cardId: string, data: unknown) => {
      updateSession((prev) => ({
        ...prev,
        cards: prev.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                data: { ...c.data, current: data, lastUpdated: new Date().toISOString() },
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
      }));
    },
    [updateSession]
  );

  // Agent flow actions - persist agent flow data per session
  const updateAgentFlow = useCallback(
    (agentFlow: AgentFlowData) => {
      updateSession((prev) => ({
        ...prev,
        agentFlow: {
          ...agentFlow,
          lastUpdated: new Date().toISOString(),
        },
      }));
    },
    [updateSession]
  );

  const clearAgentFlow = useCallback(() => {
    updateSession((prev) => ({
      ...prev,
      agentFlow: {
        toolExecutions: [],
        agentTurns: [],
        lastUpdated: new Date().toISOString(),
      },
    }));
  }, [updateSession]);

  return {
    session,
    sessions,
    isLoading,
    newSession,
    loadSession,
    deleteSession,
    renameSession,
    addMessage,
    addCard,
    removeCard,
    removeCardWithUndo,
    toggleCardPin,
    clearUnpinnedCards,
    updateCardData,
    updateAgentFlow,
    clearAgentFlow,
  };
}

export default useSession;
