'use client';

import { memo, useState, useMemo } from 'react';
import {
  Search, X, Clock, Tag, ChevronRight, Check,
  Shield, Wrench, Activity, Zap, Link2, Code, Terminal, Grid
} from 'lucide-react';
import { CARD_TEMPLATES, WorkflowTemplate } from '../templates/cardTemplates';
import { PYTHON_TEMPLATES, type PythonTemplate } from '../python/pythonTemplates';
import { CLI_TEMPLATES, type CLITemplate } from '../cli/cliTemplates';

// ============================================================================
// Types
// ============================================================================

export type TemplateMode = 'cards' | 'cli' | 'python';

export interface UnifiedTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  mode: TemplateMode;
  icon: string;
  difficulty?: string;
  estimatedTime?: string;
  nodeCount?: number;
  edgeCount?: number;
  original: WorkflowTemplate | CLITemplate | PythonTemplate;
}

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: UnifiedTemplate) => void;
  initialMode?: TemplateMode | 'all';
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  monitoring: { label: 'Monitoring', icon: Activity, color: 'cyan' },
  security: { label: 'Security', icon: Shield, color: 'red' },
  operations: { label: 'Operations', icon: Wrench, color: 'amber' },
  automation: { label: 'Automation', icon: Zap, color: 'purple' },
  integration: { label: 'Integration', icon: Link2, color: 'green' },
  analysis: { label: 'Analysis', icon: Search, color: 'blue' },
  reporting: { label: 'Reporting', icon: Activity, color: 'indigo' },
};

const MODE_CONFIG: Record<TemplateMode, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  cards: { label: 'Cards', icon: Grid, color: 'blue' },
  cli: { label: 'CLI', icon: Terminal, color: 'green' },
  python: { label: 'Python', icon: Code, color: 'yellow' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-amber-500/20 text-amber-400',
  advanced: 'bg-red-500/20 text-red-400',
};

const CATEGORY_ICONS: Record<string, string> = {
  monitoring: '📊',
  security: '🛡️',
  operations: '⚙️',
  automation: '🤖',
  integration: '🔗',
  analysis: '🔍',
  reporting: '📋',
};

// ============================================================================
// Helper Functions
// ============================================================================

function unifyTemplates(): UnifiedTemplate[] {
  const unified: UnifiedTemplate[] = [];

  // Add card templates
  CARD_TEMPLATES.forEach((t) => {
    unified.push({
      id: `cards-${t.id}`,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      mode: 'cards',
      icon: t.icon,
      difficulty: t.difficulty,
      estimatedTime: t.estimatedTime,
      nodeCount: t.nodes.length,
      edgeCount: t.edges.length,
      original: t,
    });
  });

  // Add CLI templates
  CLI_TEMPLATES.forEach((t) => {
    unified.push({
      id: `cli-${t.id}`,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      mode: 'cli',
      icon: CATEGORY_ICONS[t.category] || '💻',
      original: t,
    });
  });

  // Add Python templates
  PYTHON_TEMPLATES.forEach((t) => {
    unified.push({
      id: `python-${t.id}`,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      mode: 'python',
      icon: CATEGORY_ICONS[t.category] || '🐍',
      original: t,
    });
  });

  return unified;
}

export const TemplateGallery = memo(({ isOpen, onClose, onSelectTemplate, initialMode = 'all' }: TemplateGalleryProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<TemplateMode | 'all'>(initialMode);
  const [previewTemplate, setPreviewTemplate] = useState<UnifiedTemplate | null>(null);

  // Memoize unified templates
  const allTemplates = useMemo(() => unifyTemplates(), []);

  const filteredTemplates = useMemo(() => {
    let templates = allTemplates;

    // Filter by mode
    if (selectedMode !== 'all') {
      templates = templates.filter(t => t.mode === selectedMode);
    }

    // Filter by category
    if (selectedCategory) {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return templates;
  }, [allTemplates, searchQuery, selectedCategory, selectedMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-white">Workflow Templates</h2>
            <p className="text-sm text-slate-400 mt-1">
              Start with a pre-built template and customize it for your needs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-slate-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700
                       text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2
                       focus:ring-cyan-500/50"
            />
          </div>

          {/* Mode Filters */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Mode:</span>
            <button
              onClick={() => setSelectedMode('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedMode === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {Object.entries(MODE_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMode(key as TemplateMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedMode === key
                      ? `bg-${config.color}-500/20 text-${config.color}-400`
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 mr-1">Category:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === key
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredTemplates.map((template) => {
                const modeConfig = MODE_CONFIG[template.mode];
                const ModeIcon = modeConfig?.icon;

                return (
                  <div
                    key={template.id}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      previewTemplate?.id === template.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                    onClick={() => setPreviewTemplate(template)}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white truncate">{template.name}</h3>
                          {/* Mode Badge */}
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                            template.mode === 'cards' ? 'bg-blue-500/20 text-blue-400' :
                            template.mode === 'cli' ? 'bg-green-500/20 text-green-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {ModeIcon && <ModeIcon className="w-3 h-3" />}
                            {modeConfig?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {template.difficulty && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              DIFFICULTY_COLORS[template.difficulty] || 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {template.difficulty}
                            </span>
                          )}
                          {template.estimatedTime && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {template.estimatedTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                      {template.description}
                    </p>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50 text-xs text-slate-400"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{template.tags.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Footer with info and action */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                      <span className="text-xs text-slate-500">
                        {template.mode === 'cards' && template.nodeCount ? `${template.nodeCount} nodes` :
                         template.mode === 'cli' ? 'CLI Script' :
                         template.mode === 'python' ? 'Python Script' : ''}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTemplate(template);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500
                                 text-white text-xs font-medium transition-colors"
                      >
                        Use Template
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview Panel (when a template is selected) */}
        {previewTemplate && (
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{previewTemplate.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{previewTemplate.name}</h3>
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                      previewTemplate.mode === 'cards' ? 'bg-blue-500/20 text-blue-400' :
                      previewTemplate.mode === 'cli' ? 'bg-green-500/20 text-green-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {MODE_CONFIG[previewTemplate.mode]?.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {previewTemplate.mode === 'cards' && previewTemplate.nodeCount
                      ? `${previewTemplate.nodeCount} nodes • ${previewTemplate.edgeCount || 0} connections`
                      : previewTemplate.mode === 'cli'
                      ? 'CLI workflow script'
                      : 'Python workflow script'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600
                           text-slate-300 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onSelectTemplate(previewTemplate);
                    onClose();
                  }}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500
                           text-white text-sm font-medium transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TemplateGallery.displayName = 'TemplateGallery';

export default TemplateGallery;
