/**
 * Card Template Types - Type definitions for the card template system
 *
 * Templates allow users to save card configurations and reuse them later.
 * They store the card type, visualization config, and scope requirements.
 */

import type { AllCardTypes } from '../types';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Card size configuration
 */
export type CardSize = 'small' | 'medium' | 'large' | 'wide' | 'tall';

/**
 * Visualization configuration for a card
 */
export interface VisualizationConfig {
  /** Chart type (e.g., 'bar', 'line', 'donut', 'table', 'metric') */
  chartType?: string;
  /** Color scheme */
  colorScheme?: string;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether to show grid lines */
  showGrid?: boolean;
  /** Custom options specific to the visualization type */
  options?: Record<string, unknown>;
}

/**
 * Scope template defining what context a card requires
 */
export interface ScopeTemplate {
  /** Whether the card requires an organization ID */
  requiresOrganization: boolean;
  /** Whether the card requires a network ID */
  requiresNetwork: boolean;
  /** Whether the card requires a device ID */
  requiresDevice: boolean;
  /** Default organization ID (optional) */
  defaultOrganizationId?: string;
  /** Default network ID (optional) */
  defaultNetworkId?: string;
}

/**
 * Card template - a saved card configuration
 */
export interface CardTemplate {
  /** Unique template ID */
  id: string;
  /** User-defined template name */
  name: string;
  /** Optional description */
  description?: string;
  /** The card type this template creates */
  cardType: AllCardTypes;
  /** Visualization configuration */
  visualization: VisualizationConfig;
  /** Size of the card */
  size: CardSize;
  /** Scope requirements */
  scopeTemplate: ScopeTemplate;
  /** Refresh interval in milliseconds */
  refreshInterval: number;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Template scope: personal (user-only) or organization (shared) */
  scope: 'personal' | 'organization';
  /** Tags for categorization */
  tags?: string[];
  /** Source card ID if created from existing card */
  sourceCardId?: string;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Options for creating a template from an existing card
 */
export interface CreateTemplateOptions {
  /** The card to create a template from */
  card: {
    type: AllCardTypes;
    title: string;
    subtitle?: string;
    refreshInterval?: number;
    scope?: {
      organizationId?: string;
      organizationName?: string;
      networkId?: string;
      networkName?: string;
    };
  };
  /** Template name */
  name: string;
  /** Optional description */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Template scope */
  scope?: 'personal' | 'organization';
}

/**
 * Options for creating a card from a template
 */
export interface CreateCardFromTemplateOptions {
  /** The template to use */
  template: CardTemplate;
  /** Scope to apply to the card */
  scope: {
    organizationId?: string;
    organizationName?: string;
    networkId?: string;
    networkName?: string;
  };
  /** Optional title override */
  titleOverride?: string;
}

/**
 * Card options returned when creating from template
 */
export interface CardFromTemplateOptions {
  type: AllCardTypes;
  title: string;
  subtitle?: string;
  toolCallId: string;
  refreshInterval?: number;
  scope?: {
    organizationId?: string;
    organizationName?: string;
    networkId?: string;
    networkName?: string;
  };
}

// =============================================================================
// Storage Types
// =============================================================================

/**
 * Stored template data (persisted to localStorage)
 */
export interface StoredTemplateData {
  version: number;
  templates: CardTemplate[];
  lastUpdated: string;
}

/**
 * Current storage version
 */
export const TEMPLATE_STORAGE_VERSION = 1;

/**
 * LocalStorage key for templates
 */
export const TEMPLATE_STORAGE_KEY = 'lumen-card-templates';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique template ID
 */
export function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Infer scope requirements from a card
 */
export function inferScopeTemplate(card: CreateTemplateOptions['card']): ScopeTemplate {
  const scope = card.scope || {};

  return {
    requiresOrganization: Boolean(scope.organizationId),
    requiresNetwork: Boolean(scope.networkId),
    requiresDevice: false, // Can be extended later
    defaultOrganizationId: scope.organizationId,
    defaultNetworkId: scope.networkId,
  };
}

/**
 * Infer card size from card type
 */
export function inferCardSize(cardType: AllCardTypes): CardSize {
  // Large cards (tables, complex visualizations)
  if (cardType.includes('table') || cardType.includes('device')) {
    return 'large';
  }

  // Wide cards (charts, timelines)
  if (cardType.includes('chart') || cardType.includes('bandwidth') || cardType.includes('usage')) {
    return 'wide';
  }

  // Small cards (metrics, counts)
  if (cardType.includes('metric') || cardType.includes('count') || cardType.includes('client_count')) {
    return 'small';
  }

  // Default to medium
  return 'medium';
}
