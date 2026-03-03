/**
 * templateService - Card Template CRUD Operations
 *
 * Manages card templates with localStorage persistence.
 * Future: Can be extended to use backend API for organization-wide templates.
 */

import localforage from 'localforage';
import type {
  CardTemplate,
  CreateTemplateOptions,
  CreateCardFromTemplateOptions,
  CardFromTemplateOptions,
  StoredTemplateData,
} from '../cards/types/template';
import {
  TEMPLATE_STORAGE_VERSION,
  TEMPLATE_STORAGE_KEY,
  generateTemplateId,
  inferScopeTemplate,
  inferCardSize,
} from '../cards/types/template';

// =============================================================================
// LocalForage Configuration
// =============================================================================

const templateStore = localforage.createInstance({
  name: 'lumen',
  storeName: 'card_templates',
  description: 'Card template storage',
});

// =============================================================================
// Storage Helpers
// =============================================================================

async function loadStoredData(): Promise<StoredTemplateData> {
  try {
    const data = await templateStore.getItem<StoredTemplateData>(TEMPLATE_STORAGE_KEY);

    if (!data) {
      return {
        version: TEMPLATE_STORAGE_VERSION,
        templates: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Handle version migration if needed
    if (data.version !== TEMPLATE_STORAGE_VERSION) {
      console.log('[templateService] Migrating template storage from v' + data.version + ' to v' + TEMPLATE_STORAGE_VERSION);
      // Add migration logic here as needed
      data.version = TEMPLATE_STORAGE_VERSION;
    }

    return data;
  } catch (error) {
    console.error('[templateService] Failed to load templates:', error);
    return {
      version: TEMPLATE_STORAGE_VERSION,
      templates: [],
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function saveStoredData(data: StoredTemplateData): Promise<void> {
  try {
    data.lastUpdated = new Date().toISOString();
    await templateStore.setItem(TEMPLATE_STORAGE_KEY, data);
  } catch (error) {
    console.error('[templateService] Failed to save templates:', error);
    throw new Error('Failed to save templates');
  }
}

// =============================================================================
// Template Service
// =============================================================================

export const templateService = {
  /**
   * List all templates
   */
  async list(): Promise<CardTemplate[]> {
    const data = await loadStoredData();
    return data.templates.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  /**
   * Get a template by ID
   */
  async get(id: string): Promise<CardTemplate | null> {
    const data = await loadStoredData();
    return data.templates.find(t => t.id === id) || null;
  },

  /**
   * Save a card as a new template
   */
  async saveFromCard(options: CreateTemplateOptions): Promise<CardTemplate> {
    const { card, name, description, tags, scope = 'personal' } = options;

    const now = new Date().toISOString();
    const template: CardTemplate = {
      id: generateTemplateId(),
      name,
      description,
      cardType: card.type,
      visualization: {
        // Default visualization config - can be customized later
        showLegend: true,
        showGrid: true,
      },
      size: inferCardSize(card.type),
      scopeTemplate: inferScopeTemplate(card),
      refreshInterval: card.refreshInterval || 60000,
      createdAt: now,
      updatedAt: now,
      scope,
      tags,
    };

    const data = await loadStoredData();
    data.templates.push(template);
    await saveStoredData(data);

    console.log('[templateService] Created template:', template.id, template.name);
    return template;
  },

  /**
   * Create card options from a template
   */
  createCardFromTemplate(options: CreateCardFromTemplateOptions): CardFromTemplateOptions {
    const { template, scope, titleOverride } = options;

    return {
      type: template.cardType,
      title: titleOverride || template.name,
      subtitle: template.description,
      toolCallId: `template-${template.id}-${Date.now()}`,
      refreshInterval: template.refreshInterval,
      scope: {
        organizationId: scope.organizationId || template.scopeTemplate.defaultOrganizationId,
        organizationName: scope.organizationName,
        networkId: scope.networkId || template.scopeTemplate.defaultNetworkId,
        networkName: scope.networkName,
      },
    };
  },

  /**
   * Delete a template
   */
  async delete(id: string): Promise<void> {
    const data = await loadStoredData();
    const index = data.templates.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error(`Template not found: ${id}`);
    }

    data.templates.splice(index, 1);
    await saveStoredData(data);

    console.log('[templateService] Deleted template:', id);
  },

  /**
   * Update a template
   */
  async update(id: string, updates: Partial<CardTemplate>): Promise<CardTemplate | null> {
    const data = await loadStoredData();
    const index = data.templates.findIndex(t => t.id === id);

    if (index === -1) {
      return null;
    }

    const template = data.templates[index];
    const updatedTemplate: CardTemplate = {
      ...template,
      ...updates,
      id: template.id, // Prevent ID from being changed
      createdAt: template.createdAt, // Prevent createdAt from being changed
      updatedAt: new Date().toISOString(),
    };

    data.templates[index] = updatedTemplate;
    await saveStoredData(data);

    console.log('[templateService] Updated template:', id);
    return updatedTemplate;
  },

  /**
   * Duplicate a template
   */
  async duplicate(id: string, newName?: string): Promise<CardTemplate | null> {
    const template = await this.get(id);
    if (!template) {
      return null;
    }

    const now = new Date().toISOString();
    const duplicated: CardTemplate = {
      ...template,
      id: generateTemplateId(),
      name: newName || `${template.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      sourceCardId: undefined, // Clear source reference
    };

    const data = await loadStoredData();
    data.templates.push(duplicated);
    await saveStoredData(data);

    console.log('[templateService] Duplicated template:', id, '->', duplicated.id);
    return duplicated;
  },

  /**
   * Search templates by name or tags
   */
  async search(query: string): Promise<CardTemplate[]> {
    const templates = await this.list();
    const lowerQuery = query.toLowerCase();

    return templates.filter(t =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery) ||
      t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      t.cardType.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Get templates by card type
   */
  async getByCardType(cardType: string): Promise<CardTemplate[]> {
    const templates = await this.list();
    return templates.filter(t => t.cardType === cardType);
  },

  /**
   * Clear all templates (use with caution)
   */
  async clearAll(): Promise<void> {
    await templateStore.removeItem(TEMPLATE_STORAGE_KEY);
    console.log('[templateService] Cleared all templates');
  },

  /**
   * Export templates as JSON (for backup)
   */
  async export(): Promise<string> {
    const data = await loadStoredData();
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import templates from JSON (for restore)
   */
  async import(json: string, merge = true): Promise<number> {
    const importedData = JSON.parse(json) as StoredTemplateData;

    if (!importedData.templates || !Array.isArray(importedData.templates)) {
      throw new Error('Invalid template data format');
    }

    const data = merge ? await loadStoredData() : {
      version: TEMPLATE_STORAGE_VERSION,
      templates: [],
      lastUpdated: new Date().toISOString(),
    };

    // Add imported templates (with new IDs to avoid conflicts)
    let importCount = 0;
    for (const template of importedData.templates) {
      const newTemplate: CardTemplate = {
        ...template,
        id: generateTemplateId(),
        updatedAt: new Date().toISOString(),
      };
      data.templates.push(newTemplate);
      importCount++;
    }

    await saveStoredData(data);
    console.log('[templateService] Imported', importCount, 'templates');
    return importCount;
  },
};

export default templateService;
