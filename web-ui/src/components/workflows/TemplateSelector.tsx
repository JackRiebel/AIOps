'use client';

import { memo, useState, useMemo } from 'react';
import { X, Zap, Calendar, Shield, Activity, ChevronRight } from 'lucide-react';
import type { WorkflowTemplate } from './types';

interface TemplateSelectorProps {
  templates: WorkflowTemplate[];
  onSelect: (template: WorkflowTemplate) => void;
  onClose: () => void;
}

const CATEGORY_CONFIG = {
  network_health: {
    label: 'Network Health',
    icon: Activity,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  compliance: {
    label: 'Compliance & Drift',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  security: {
    label: 'Security',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  custom: {
    label: 'Custom',
    icon: Zap,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
};

export const TemplateSelector = memo(({
  templates,
  onSelect,
  onClose,
}: TemplateSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Group templates by category
  const categorizedTemplates = useMemo(() => {
    const groups: Record<string, WorkflowTemplate[]> = {};
    templates.forEach((template) => {
      const category = template.category || 'custom';
      if (!groups[category]) groups[category] = [];
      groups[category].push(template);
    });
    return groups;
  }, [templates]);

  // Filter templates by search and category
  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (selectedCategory) {
      result = result.filter((t) => (t.category || 'custom') === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, selectedCategory, searchQuery]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Workflow Templates
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Start with a pre-built template and customize it
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
          />

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`
                px-3 py-1.5 text-sm rounded-full transition-colors
                ${!selectedCategory
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              All ({templates.length})
            </button>
            {Object.entries(categorizedTemplates).map(([category, items]) => {
              const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.custom;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`
                    px-3 py-1.5 text-sm rounded-full transition-colors
                    ${selectedCategory === category
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {config.label} ({items.length})
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <Zap className="w-12 h-12 mb-3" />
              <p className="font-medium">No templates found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => {
                const category = template.category || 'custom';
                const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.custom;
                const Icon = config.icon;

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template)}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 transition-colors" />
                    </div>

                    <h3 className="font-medium text-slate-900 dark:text-white mb-1">
                      {template.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                      {template.description}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {template.trigger_type === 'splunk_query' && (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Splunk
                        </span>
                      )}
                      {template.trigger_type === 'schedule' && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Scheduled
                        </span>
                      )}
                      {template.ai_enabled && (
                        <span className="text-purple-600 dark:text-purple-400">
                          AI-Powered
                        </span>
                      )}
                      <span>{template.action_count} actions</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});

TemplateSelector.displayName = 'TemplateSelector';
