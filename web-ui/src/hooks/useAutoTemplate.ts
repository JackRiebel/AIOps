/**
 * useAutoTemplate - Automatically apply a template based on first query
 *
 * This hook detects when a user sends their first message in a session
 * and automatically applies a relevant canvas template based on the
 * query intent.
 *
 * Features:
 * - Only triggers on first message (when canvas is empty)
 * - Uses keyword matching to suggest templates
 * - Shows toast notification when template is applied
 * - Can be disabled via user preference
 */

import { useEffect, useRef, useCallback } from 'react';
import { suggestTemplateForQuery, templateToCanvasCards } from '@/config/canvas-templates';
import type { CanvasCard } from '@/types/session';

interface UseAutoTemplateOptions {
  /** Current message being sent or just sent */
  message: string | null;
  /** Whether this is the first query (no prior messages) */
  isFirstQuery: boolean;
  /** Current canvas cards */
  canvasCards: CanvasCard[];
  /** Function to set canvas cards */
  setCanvasCards: (cards: CanvasCard[]) => void;
  /** Optional network ID for card context */
  networkId?: string;
  /** Optional org ID for card context */
  orgId?: string;
  /** Whether auto-template is enabled (default: true) */
  enabled?: boolean;
  /** Callback when template is applied */
  onTemplateApplied?: (templateName: string) => void;
  /** Minimum confidence threshold (default: 0.5) */
  confidenceThreshold?: number;
}

interface UseAutoTemplateReturn {
  /** Whether auto-template is processing */
  isProcessing: boolean;
  /** Manually suggest a template for a query */
  suggestTemplate: (query: string) => { templateName: string; confidence: number } | null;
  /** Manually apply a template */
  applyTemplate: (templateId: string) => void;
}

export function useAutoTemplate({
  message,
  isFirstQuery,
  canvasCards,
  setCanvasCards,
  networkId,
  orgId,
  enabled = true,
  onTemplateApplied,
  confidenceThreshold = 0.5,
}: UseAutoTemplateOptions): UseAutoTemplateReturn {
  // Track if we've already processed this message
  const processedMessageRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  // Suggest template for a query
  const suggestTemplate = useCallback((query: string) => {
    const suggestion = suggestTemplateForQuery(query);
    if (suggestion && suggestion.confidence >= confidenceThreshold) {
      return {
        templateName: suggestion.template.name,
        confidence: suggestion.confidence,
      };
    }
    return null;
  }, [confidenceThreshold]);

  // Apply a template by ID
  const applyTemplate = useCallback((templateId: string) => {
    const { templateToCanvasCards: toCards, CANVAS_TEMPLATES } = require('@/config/canvas-templates');
    const template = CANVAS_TEMPLATES?.find((t: { id: string }) => t.id === templateId);
    if (template) {
      const cards = toCards(template, { networkId, orgId });
      setCanvasCards(cards);
      onTemplateApplied?.(template.name);
    }
  }, [networkId, orgId, setCanvasCards, onTemplateApplied]);

  // Auto-apply template on first query
  useEffect(() => {
    // Skip if disabled or not first query
    if (!enabled || !isFirstQuery) return;

    // Skip if no message or already processed
    if (!message || message === processedMessageRef.current) return;

    // Skip if canvas already has cards
    if (canvasCards.length > 0) return;

    // Prevent double processing
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    processedMessageRef.current = message;

    // Attempt to match a template
    const suggestion = suggestTemplateForQuery(message);

    if (suggestion && suggestion.confidence >= confidenceThreshold) {
      // Generate cards from template
      const cards = templateToCanvasCards(suggestion.template, { networkId, orgId });

      // Apply the template
      setCanvasCards(cards);

      // Notify about applied template
      onTemplateApplied?.(suggestion.template.name);

      console.log(
        `[useAutoTemplate] Applied template "${suggestion.template.name}" ` +
        `(confidence: ${(suggestion.confidence * 100).toFixed(0)}%, ` +
        `matched: ${suggestion.matchedKeywords.join(', ')})`
      );
    } else if (suggestion) {
      console.log(
        `[useAutoTemplate] Template "${suggestion.template.name}" suggested but ` +
        `confidence ${(suggestion.confidence * 100).toFixed(0)}% below threshold`
      );
    }

    isProcessingRef.current = false;
  }, [
    message,
    isFirstQuery,
    canvasCards.length,
    enabled,
    confidenceThreshold,
    networkId,
    orgId,
    setCanvasCards,
    onTemplateApplied,
  ]);

  return {
    isProcessing: isProcessingRef.current,
    suggestTemplate,
    applyTemplate,
  };
}

export default useAutoTemplate;
