/**
 * SmartCardSuggestions - AI-like card recommendations based on context
 *
 * This module has been split into multiple files for maintainability:
 * - types.ts: TypeScript interfaces and types
 * - suggestion-rules.ts: The large array of card suggestion rules (~2,700 lines)
 * - index.ts: Barrel export (this file)
 *
 * The main component remains in the parent SmartCardSuggestions.tsx
 */

// Re-export types
export type {
  BackendCardSuggestion,
  SmartCardSuggestionsProps,
  CardSuggestion,
  SuggestionIcon,
  TemplateCardSuggestion,
} from './types';

// Re-export rules
export { SUGGESTION_RULES } from './suggestion-rules';

// Re-export context utilities
export {
  isMerakiNetworkId,
  isMerakiSerial,
  extractContextFromData,
  type ExtractedContext,
} from './context-utils';

// Re-export card keyword utilities
export {
  CARD_TYPE_KEYWORDS,
  EXCLUSIVE_CARD_GROUPS,
  SPECIFICITY_INDICATORS,
  isSpecificQuery,
  getExclusiveGroup,
  calculateKeywordScore,
} from './card-keywords';
