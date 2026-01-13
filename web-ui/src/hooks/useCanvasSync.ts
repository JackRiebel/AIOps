/**
 * useCanvasSync - Sync canvas state to backend for AI awareness
 *
 * This hook syncs the current canvas cards to the backend so the AI
 * can be aware of what the user is currently viewing. This enables:
 * - AI to reference visible data in responses
 * - AI to avoid suggesting duplicate cards
 * - Context-aware conversations about canvas content
 */

import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { CanvasCard } from '@/types/session';

interface CanvasCardState {
  card_id: string;
  card_type: string;
  title: string;
  data_summary: string;
  network_id?: string;
  org_id?: string;
}

interface UseCanvasSyncOptions {
  /** Current session ID */
  sessionId: string | null;
  /** Current canvas cards */
  canvasCards: CanvasCard[];
  /** Whether syncing is enabled (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
}

interface UseCanvasSyncReturn {
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Force a sync now */
  syncNow: () => Promise<void>;
  /** Last sync timestamp */
  lastSyncAt: Date | null;
}

/**
 * Generate a brief summary of card data for AI context
 */
function generateDataSummary(card: CanvasCard): string {
  const data = card.data;
  if (!data) return '';

  // Handle different card types
  switch (card.type) {
    case 'network-health':
      if (typeof data.healthScore === 'number') {
        return `${data.healthScore}% healthy`;
      }
      break;

    case 'ai-metric':
      if (data.value !== undefined) {
        return `${data.label || 'Value'}: ${data.value}${data.unit || ''}`;
      }
      break;

    case 'ai-stats-grid':
      if (Array.isArray(data.stats)) {
        const statCount = data.stats.length;
        return `${statCount} metrics`;
      }
      break;

    case 'alert-timeline':
    case 'alert-summary':
      if (typeof data.alertCount === 'number') {
        return `${data.alertCount} active alerts`;
      }
      if (Array.isArray(data.alerts)) {
        return `${data.alerts.length} alerts`;
      }
      break;

    case 'device-table':
      if (Array.isArray(data.devices)) {
        return `${data.devices.length} devices`;
      }
      break;

    case 'client-list':
      if (Array.isArray(data.clients)) {
        return `${data.clients.length} clients`;
      }
      break;

    case 'incident-tracker':
      if (Array.isArray(data.incidents)) {
        return `${data.incidents.length} incidents`;
      }
      break;

    case 'knowledge-sources':
      if (Array.isArray(data.documents)) {
        return `${data.documents.length} source documents`;
      }
      break;

    case 'datasheet-comparison':
      if (Array.isArray(data.products)) {
        return `Comparing ${data.products.length} products`;
      }
      break;

    case 'ai-finding':
      if (data.severity && data.title) {
        return `${data.severity}: ${data.title}`;
      }
      break;

    default:
      // Generic fallback - look for common data patterns
      if (data.status) return `Status: ${data.status}`;
      if (data.count !== undefined) return `Count: ${data.count}`;
      break;
  }

  return '';
}

/**
 * Convert canvas cards to state format for backend
 */
function summarizeCards(cards: CanvasCard[]): CanvasCardState[] {
  return cards.map(card => ({
    card_id: card.id,
    card_type: card.type,
    title: card.title,
    data_summary: generateDataSummary(card),
    network_id: card.config?.networkId,
    org_id: card.config?.orgId,
  }));
}

export function useCanvasSync({
  sessionId,
  canvasCards,
  enabled = true,
  debounceMs = 1000,
}: UseCanvasSyncOptions): UseCanvasSyncReturn {
  const isSyncingRef = useRef(false);
  const lastSyncAtRef = useRef<Date | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCardsHashRef = useRef<string>('');

  // Sync function
  const syncNow = useCallback(async () => {
    if (!sessionId || !enabled) return;
    if (isSyncingRef.current) return;

    // Create a hash of current cards to detect changes
    const cardsHash = JSON.stringify(canvasCards.map(c => ({ id: c.id, type: c.type })));
    if (cardsHash === lastCardsHashRef.current) return;

    isSyncingRef.current = true;

    try {
      const cardStates = summarizeCards(canvasCards);
      await apiClient.post(`/api/ai-sessions/${sessionId}/canvas-state`, {
        cards: cardStates,
      });

      lastCardsHashRef.current = cardsHash;
      lastSyncAtRef.current = new Date();

      console.log(`[useCanvasSync] Synced ${cardStates.length} cards to session ${sessionId}`);
    } catch (error) {
      console.warn('[useCanvasSync] Failed to sync canvas state:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [sessionId, canvasCards, enabled]);

  // Debounced sync on card changes
  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced sync
    debounceTimerRef.current = setTimeout(() => {
      syncNow();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sessionId, canvasCards, enabled, debounceMs, syncNow]);

  // Sync immediately when session changes
  useEffect(() => {
    if (sessionId && enabled && canvasCards.length > 0) {
      // Reset hash to force sync on session change
      lastCardsHashRef.current = '';
      syncNow();
    }
  }, [sessionId]);

  return {
    isSyncing: isSyncingRef.current,
    syncNow,
    lastSyncAt: lastSyncAtRef.current,
  };
}

export default useCanvasSync;
