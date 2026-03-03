'use client';

/**
 * HighlightContext - Bidirectional Highlighting State
 *
 * Manages highlight state for message-card linking.
 * Hover on message highlights related cards, and vice versa.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface HighlightState {
  // Currently highlighted message ID (from hover/click)
  highlightedMessageId: string | null;
  // Currently highlighted card ID (from hover/click)
  highlightedCardId: string | null;
  // Source of highlight (which element triggered it)
  highlightSource: 'message' | 'card' | null;
}

interface HighlightContextValue extends HighlightState {
  // Set highlight from message hover
  highlightFromMessage: (messageId: string | null) => void;
  // Set highlight from card hover
  highlightFromCard: (cardId: string, sourceMessageId: string | null) => void;
  // Clear all highlights
  clearHighlight: () => void;
  // Check if a message should be highlighted
  isMessageHighlighted: (messageId: string) => boolean;
  // Check if a card should be highlighted
  isCardHighlighted: (cardId: string) => boolean;
}

const HighlightContext = createContext<HighlightContextValue | null>(null);

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HighlightState>({
    highlightedMessageId: null,
    highlightedCardId: null,
    highlightSource: null,
  });

  // Map of card ID to source message ID (for bidirectional linking)
  const [cardToMessageMap, setCardToMessageMap] = useState<Map<string, string>>(new Map());

  const highlightFromMessage = useCallback((messageId: string | null) => {
    setState({
      highlightedMessageId: messageId,
      highlightedCardId: null,
      highlightSource: messageId ? 'message' : null,
    });
  }, []);

  const highlightFromCard = useCallback((cardId: string, sourceMessageId: string | null) => {
    // Update the map
    if (sourceMessageId) {
      setCardToMessageMap(prev => {
        const next = new Map(prev);
        next.set(cardId, sourceMessageId);
        return next;
      });
    }

    setState({
      highlightedMessageId: sourceMessageId,
      highlightedCardId: cardId,
      highlightSource: 'card',
    });
  }, []);

  const clearHighlight = useCallback(() => {
    setState({
      highlightedMessageId: null,
      highlightedCardId: null,
      highlightSource: null,
    });
  }, []);

  const isMessageHighlighted = useCallback((messageId: string) => {
    return state.highlightedMessageId === messageId;
  }, [state.highlightedMessageId]);

  const isCardHighlighted = useCallback((cardId: string) => {
    // Card is highlighted if:
    // 1. It's directly highlighted (from card hover)
    // 2. Its source message is highlighted (from message hover)
    if (state.highlightedCardId === cardId) return true;

    const sourceMessageId = cardToMessageMap.get(cardId);
    if (sourceMessageId && state.highlightedMessageId === sourceMessageId) return true;

    return false;
  }, [state.highlightedCardId, state.highlightedMessageId, cardToMessageMap]);

  const value = useMemo<HighlightContextValue>(() => ({
    ...state,
    highlightFromMessage,
    highlightFromCard,
    clearHighlight,
    isMessageHighlighted,
    isCardHighlighted,
  }), [state, highlightFromMessage, highlightFromCard, clearHighlight, isMessageHighlighted, isCardHighlighted]);

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error('useHighlight must be used within a HighlightProvider');
  }
  return context;
}

export default HighlightContext;
