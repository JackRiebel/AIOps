/**
 * useCardTemplates - Hook for managing card templates
 *
 * Provides React-friendly interface to the template service with state management.
 */

import { useState, useEffect, useCallback } from 'react';
import { templateService } from '../services/templateService';
import type {
  CardTemplate,
  CreateTemplateOptions,
  CardFromTemplateOptions,
} from '../cards/types/template';
import type { AllCardTypes } from '../cards/types';

// =============================================================================
// Types
// =============================================================================

export interface CardScope {
  organizationId?: string;
  organizationName?: string;
  networkId?: string;
  networkName?: string;
}

export interface SaveableCard {
  type: AllCardTypes;
  title: string;
  subtitle?: string;
  refreshInterval?: number;
  scope?: CardScope;
}

export interface UseCardTemplatesReturn {
  /** List of all templates */
  templates: CardTemplate[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Save a card as a new template */
  saveAsTemplate: (
    card: SaveableCard,
    name: string,
    description?: string
  ) => Promise<CardTemplate>;
  /** Delete a template by ID */
  deleteTemplate: (id: string) => Promise<void>;
  /** Create card options from a template */
  applyTemplate: (template: CardTemplate, scope: CardScope) => CardFromTemplateOptions;
  /** Duplicate an existing template */
  duplicateTemplate: (id: string, newName?: string) => Promise<CardTemplate | null>;
  /** Update a template */
  updateTemplate: (id: string, updates: Partial<CardTemplate>) => Promise<CardTemplate | null>;
  /** Search templates */
  searchTemplates: (query: string) => Promise<CardTemplate[]>;
  /** Refresh templates from storage */
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCardTemplates(): UseCardTemplatesReturn {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoading(true);
        const loaded = await templateService.list();
        setTemplates(loaded);
        setError(null);
      } catch (err) {
        console.error('[useCardTemplates] Failed to load templates:', err);
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, []);

  // Refresh templates
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const loaded = await templateService.list();
      setTemplates(loaded);
      setError(null);
    } catch (err) {
      console.error('[useCardTemplates] Failed to refresh templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a card as a template
  const saveAsTemplate = useCallback(async (
    card: SaveableCard,
    name: string,
    description?: string
  ): Promise<CardTemplate> => {
    try {
      const options: CreateTemplateOptions = {
        card,
        name,
        description,
        scope: 'personal',
      };

      const template = await templateService.saveFromCard(options);

      // Update local state
      setTemplates(prev => [template, ...prev]);

      return template;
    } catch (err) {
      console.error('[useCardTemplates] Failed to save template:', err);
      throw err;
    }
  }, []);

  // Delete a template
  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      await templateService.delete(id);

      // Update local state
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('[useCardTemplates] Failed to delete template:', err);
      throw err;
    }
  }, []);

  // Apply a template to create card options
  const applyTemplate = useCallback((
    template: CardTemplate,
    scope: CardScope
  ): CardFromTemplateOptions => {
    return templateService.createCardFromTemplate({ template, scope });
  }, []);

  // Duplicate a template
  const duplicateTemplate = useCallback(async (
    id: string,
    newName?: string
  ): Promise<CardTemplate | null> => {
    try {
      const duplicated = await templateService.duplicate(id, newName);

      if (duplicated) {
        // Update local state
        setTemplates(prev => [duplicated, ...prev]);
      }

      return duplicated;
    } catch (err) {
      console.error('[useCardTemplates] Failed to duplicate template:', err);
      throw err;
    }
  }, []);

  // Update a template
  const updateTemplate = useCallback(async (
    id: string,
    updates: Partial<CardTemplate>
  ): Promise<CardTemplate | null> => {
    try {
      const updated = await templateService.update(id, updates);

      if (updated) {
        // Update local state
        setTemplates(prev =>
          prev.map(t => t.id === id ? updated : t)
        );
      }

      return updated;
    } catch (err) {
      console.error('[useCardTemplates] Failed to update template:', err);
      throw err;
    }
  }, []);

  // Search templates
  const searchTemplates = useCallback(async (query: string): Promise<CardTemplate[]> => {
    try {
      return await templateService.search(query);
    } catch (err) {
      console.error('[useCardTemplates] Failed to search templates:', err);
      throw err;
    }
  }, []);

  return {
    templates,
    isLoading,
    error,
    saveAsTemplate,
    deleteTemplate,
    applyTemplate,
    duplicateTemplate,
    updateTemplate,
    searchTemplates,
    refresh,
  };
}
