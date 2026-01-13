/**
 * Types for SmartCardSuggestions
 */

import type { CanvasCard, CanvasCardType } from '@/types/session';

// Backend card suggestion from knowledge retrieval
export interface BackendCardSuggestion {
  type: string;
  title: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface SmartCardSuggestionsProps {
  query: string;
  responseContent: string;
  structuredData?: unknown;
  onAddCard: (card: Partial<CanvasCard>) => void;
  existingCards?: CanvasCard[];
  sourceMessageId?: string;
  toolName?: string;
  className?: string;
  // Backend-provided suggestions (e.g., knowledge sources)
  backendSuggestions?: BackendCardSuggestion[];
  // Only auto-add cards for the most recent message (prevents historical messages from adding cards)
  isLatestMessage?: boolean;
}

// Icon types for card suggestions
export type SuggestionIcon =
  | 'rf' | 'topology' | 'health' | 'alert' | 'path' | 'comparison'
  | 'table' | 'device' | 'bandwidth' | 'latency' | 'uptime' | 'sla'
  | 'wan' | 'traffic' | 'qos' | 'heatmap' | 'timeline' | 'throughput'
  | 'app' | 'security' | 'threat' | 'firewall' | 'shield' | 'compliance'
  | 'channel' | 'signal' | 'ssid' | 'roaming' | 'interference'
  | 'port' | 'vlan' | 'poe' | 'stp' | 'stack'
  | 'incident' | 'correlation' | 'mttr'
  | 'log' | 'error' | 'severity'
  | 'knowledge' | 'book' | 'datasheet';

// Suggestion configuration
export interface CardSuggestion {
  type: CanvasCardType;
  title: string;
  description: string;
  icon: SuggestionIcon;
  priority: number;  // Higher = show first
  condition: (query: string, data: any, response: string) => boolean;
  dataExtractor?: (data: any, response?: string) => any;
}

// Template card suggestion (from findRelevantCardsFromTemplates)
export interface TemplateCardSuggestion {
  type: CanvasCardType;
  title: string;
  description: string;
  icon: SuggestionIcon;
  priority: number;
  templateId: string;
  templateName: string;
}
