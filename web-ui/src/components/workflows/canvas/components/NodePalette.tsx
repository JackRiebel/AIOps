'use client';

import { memo, useState, useCallback, useEffect, DragEvent } from 'react';
import {
  Zap, GitBranch, Brain, Wrench, Bell, Hand, Clock, Repeat,
  Workflow, MessageSquare, Search, ChevronRight, ChevronDown,
  Star, Filter, GripVertical, AlertTriangle, Shield, StarOff,
  LayoutGrid, Terminal, Code2
} from 'lucide-react';
import { CanvasNodeType, NODE_CATEGORIES, DragItem } from '../types';
import { ACTION_REGISTRY, type ActionDefinition } from '../../types';
import { useWorkflowMode, WorkflowMode } from '../contexts/WorkflowModeContext';

const FAVORITES_KEY = 'lumen-workflow-favorites';

// ============================================================================
// Node Definitions
// ============================================================================

interface NodeDefinition {
  type: CanvasNodeType;
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
  category: string;
  ports: {
    inputs: number;
    outputs: number;
  };
}

const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Start point for the workflow',
    icon: Zap,
    color: 'emerald',
    category: 'flow',
    ports: { inputs: 0, outputs: 1 },
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch based on conditions',
    icon: GitBranch,
    color: 'amber',
    category: 'flow',
    ports: { inputs: 1, outputs: 2 },
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Repeat actions for each item',
    icon: Repeat,
    color: 'orange',
    category: 'flow',
    ports: { inputs: 1, outputs: 2 },
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Wait before continuing',
    icon: Clock,
    color: 'slate',
    category: 'flow',
    ports: { inputs: 1, outputs: 1 },
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Execute an operation',
    icon: Wrench,
    color: 'cyan',
    category: 'actions',
    ports: { inputs: 1, outputs: 1 },
  },
  {
    type: 'ai',
    label: 'AI Decision',
    description: 'Use AI to analyze and decide',
    icon: Brain,
    color: 'purple',
    category: 'ai',
    ports: { inputs: 1, outputs: 1 },
  },
  {
    type: 'approval',
    label: 'Approval Gate',
    description: 'Wait for human approval',
    icon: Hand,
    color: 'orange',
    category: 'flow',
    ports: { inputs: 1, outputs: 2 },
  },
  {
    type: 'notify',
    label: 'Notification',
    description: 'Send alerts and messages',
    icon: Bell,
    color: 'blue',
    category: 'notifications',
    ports: { inputs: 1, outputs: 1 },
  },
  {
    type: 'subworkflow',
    label: 'Sub-workflow',
    description: 'Run another workflow',
    icon: Workflow,
    color: 'indigo',
    category: 'advanced',
    ports: { inputs: 1, outputs: 1 },
  },
  {
    type: 'comment',
    label: 'Comment',
    description: 'Add notes to the canvas',
    icon: MessageSquare,
    color: 'slate',
    category: 'advanced',
    ports: { inputs: 0, outputs: 0 },
  },
];

// ============================================================================
// Color Utilities
// ============================================================================

const getColorClasses = (color: string, isHover = false) => {
  const colors: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/30' },
    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', hover: 'hover:bg-amber-500/30' },
    orange: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', hover: 'hover:bg-orange-500/30' },
    cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', hover: 'hover:bg-cyan-500/30' },
    purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', hover: 'hover:bg-purple-500/30' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', hover: 'hover:bg-blue-500/30' },
    indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', hover: 'hover:bg-indigo-500/30' },
    slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', hover: 'hover:bg-slate-500/30' },
    red: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', hover: 'hover:bg-red-500/30' },
  };
  return colors[color] || colors.slate;
};

// ============================================================================
// Main Component
// ============================================================================

interface NodePaletteProps {
  onNodeDragStart?: (item: DragItem) => void;
  onNodeAdd?: (type: CanvasNodeType, data?: Record<string, unknown>) => void;
  onActionAdd?: (action: ActionDefinition) => void;
  onOpenTemplates?: () => void;
}

export const NodePalette = memo(({ onNodeDragStart, onNodeAdd, onActionAdd, onOpenTemplates }: NodePaletteProps) => {
  // Mode awareness - try to use context, fallback to 'cards' mode
  let mode: WorkflowMode = 'cards';
  try {
    const modeContext = useWorkflowMode();
    mode = modeContext.mode;
  } catch {
    // Context not available, default to cards mode
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['favorites', 'flow', 'actions', 'actions-meraki', 'actions-splunk', 'actions-thousandeyes', 'actions-catalyst', 'actions-custom'])
  );
  const [showActionsOnly, setShowActionsOnly] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        try {
          setFavorites(new Set(JSON.parse(stored)));
        } catch {
          // Invalid stored data
        }
      }
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    setFavorites(newFavorites);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...newFavorites]));
    }
  }, []);

  const toggleFavorite = useCallback((actionId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(actionId)) {
      newFavorites.delete(actionId);
    } else {
      newFavorites.add(actionId);
    }
    saveFavorites(newFavorites);
  }, [favorites, saveFavorites]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, item: DragItem) => {
    e.dataTransfer.setData('application/reactflow', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
    onNodeDragStart?.(item);
  }, [onNodeDragStart]);

  // Group nodes by category
  const nodesByCategory = NODE_DEFINITIONS.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, NodeDefinition[]>);

  // Filter actions based on search
  const filteredActions = ACTION_REGISTRY.filter((action) => {
    if (filterVerifiedOnly && !action.verified) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      action.name.toLowerCase().includes(query) ||
      action.description.toLowerCase().includes(query) ||
      action.category.toLowerCase().includes(query) ||
      (action.platform && action.platform.toLowerCase().includes(query))
    );
  });

  // Filter nodes based on search
  const filteredNodes = NODE_DEFINITIONS.filter((node) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      node.label.toLowerCase().includes(query) ||
      node.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-72 bg-slate-800/95 backdrop-blur border-r border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search nodes and actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700
                     text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2
                     focus:ring-cyan-500/50"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => setShowActionsOnly(!showActionsOnly)}
            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              showActionsOnly
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {showActionsOnly ? 'Actions Only' : 'All Nodes'}
          </button>
          <button
            onClick={() => setFilterVerifiedOnly(!filterVerifiedOnly)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              filterVerifiedOnly
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-3 h-3" />
            Verified
          </button>
        </div>

        {/* Templates Button */}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                     bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30
                     text-cyan-400 text-sm font-medium hover:from-cyan-500/30 hover:to-purple-500/30
                     transition-all"
          >
            <LayoutGrid className="w-4 h-4" />
            Browse Templates
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Mode Indicator */}
        {mode !== 'cards' && (
          <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600/50">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {mode === 'cli' ? (
                <>
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>CLI Mode - Use command editor</span>
                </>
              ) : (
                <>
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span>Python Mode - Use code editor</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Switch to Cards mode to use drag-and-drop nodes
            </p>
          </div>
        )}

        {/* Favorites Section */}
        {mode === 'cards' && favorites.size > 0 && (
          <div>
            <button
              onClick={() => toggleCategory('favorites')}
              className="flex items-center gap-2 w-full text-left mb-2 group"
            >
              {expandedCategories.has('favorites') ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                Favorites
              </span>
              <span className="text-xs text-slate-600">({favorites.size})</span>
            </button>

            {expandedCategories.has('favorites') && (
              <div className="space-y-1 ml-2">
                {ACTION_REGISTRY.filter(a => favorites.has(a.id)).map((action) => (
                  <ActionPaletteItem
                    key={`fav-${action.id}`}
                    action={action}
                    onDragStart={handleDragStart}
                    onClick={() => onActionAdd?.(action)}
                    isFavorite={true}
                    onToggleFavorite={() => toggleFavorite(action.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Node Categories */}
        {mode === 'cards' && !showActionsOnly && (
          <>
            {NODE_CATEGORIES.map((category) => {
              const nodes = (nodesByCategory[category.id] || []).filter((node) =>
                filteredNodes.includes(node)
              );
              if (nodes.length === 0) return null;

              const isExpanded = expandedCategories.has(category.id);

              return (
                <div key={category.id}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-2 w-full text-left mb-2 group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {category.label}
                    </span>
                    <span className="text-xs text-slate-600">({nodes.length})</span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-1 ml-2">
                      {nodes.map((node) => (
                        <NodePaletteItem
                          key={node.type}
                          node={node}
                          onDragStart={handleDragStart}
                          onClick={() => onNodeAdd?.(node.type)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Actions Section - Grouped by Platform/Category (Cards mode only) */}
        {mode === 'cards' && (() => {
          // Group actions by platform or category
          const actionGroups: Record<string, { label: string; icon: string; actions: typeof filteredActions }> = {};

          filteredActions.forEach(action => {
            let groupKey: string;
            let groupLabel: string;
            let groupIcon: string;

            if (action.platform === 'meraki') {
              groupKey = 'meraki';
              groupLabel = 'Meraki';
              groupIcon = '🌐';
            } else if (action.platform === 'splunk') {
              groupKey = 'splunk';
              groupLabel = 'Splunk';
              groupIcon = '🔍';
            } else if (action.platform === 'thousandeyes') {
              groupKey = 'thousandeyes';
              groupLabel = 'ThousandEyes';
              groupIcon = '👁️';
            } else if (action.platform === 'catalyst') {
              groupKey = 'catalyst';
              groupLabel = 'Catalyst';
              groupIcon = '🔧';
            } else if (action.category === 'custom') {
              groupKey = 'custom';
              groupLabel = 'AI & Custom';
              groupIcon = '🤖';
            } else {
              groupKey = 'other';
              groupLabel = 'Other';
              groupIcon = '⚡';
            }

            if (!actionGroups[groupKey]) {
              actionGroups[groupKey] = { label: groupLabel, icon: groupIcon, actions: [] };
            }
            actionGroups[groupKey].actions.push(action);
          });

          // Define order for groups
          const groupOrder = ['meraki', 'splunk', 'thousandeyes', 'catalyst', 'custom', 'other'];

          return groupOrder.map(groupKey => {
            const group = actionGroups[groupKey];
            if (!group || group.actions.length === 0) return null;

            const isExpanded = expandedCategories.has(`actions-${groupKey}`);

            return (
              <div key={groupKey}>
                <button
                  onClick={() => toggleCategory(`actions-${groupKey}`)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="text-base">{group.icon}</span>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {group.label}
                  </span>
                  <span className="text-xs text-slate-600">({group.actions.length})</span>
                </button>

                {isExpanded && (
                  <div className="space-y-1 ml-2">
                    {group.actions.map((action) => (
                      <ActionPaletteItem
                        key={action.id}
                        action={action}
                        onDragStart={handleDragStart}
                        onClick={() => onActionAdd?.(action)}
                        isFavorite={favorites.has(action.id)}
                        onToggleFavorite={() => toggleFavorite(action.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Footer - Drag Hint */}
      <div className="p-3 border-t border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <GripVertical className="w-3 h-3" />
          <span>Drag items to canvas or click to add</span>
        </div>
      </div>
    </div>
  );
});

NodePalette.displayName = 'NodePalette';

// ============================================================================
// Palette Item Components
// ============================================================================

interface NodePaletteItemProps {
  node: NodeDefinition;
  onDragStart: (e: DragEvent<HTMLDivElement>, item: DragItem) => void;
  onClick: () => void;
}

const NodePaletteItem = memo(({ node, onDragStart, onClick }: NodePaletteItemProps) => {
  const Icon = node.icon;
  const colors = getColorClasses(node.color);

  return (
    <div
      draggable
      onDragStart={(e) =>
        onDragStart(e, { type: 'node', nodeType: node.type })
      }
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-grab active:cursor-grabbing
                ${colors.bg} ${colors.hover} border ${colors.border}
                transition-all duration-150 group`}
    >
      <div className={`p-1.5 rounded ${colors.bg} ${colors.text}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{node.label}</div>
        <div className="text-xs text-slate-400 truncate">{node.description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
});

NodePaletteItem.displayName = 'NodePaletteItem';

interface ActionPaletteItemProps {
  action: ActionDefinition;
  onDragStart: (e: DragEvent<HTMLDivElement>, item: DragItem) => void;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const ActionPaletteItem = memo(({ action, onDragStart, onClick, isFavorite, onToggleFavorite }: ActionPaletteItemProps) => {
  const riskColors = {
    low: 'border-green-500/30 bg-green-500/10',
    medium: 'border-amber-500/30 bg-amber-500/10',
    high: 'border-red-500/30 bg-red-500/10',
  };

  // Check if action is coming soon (unverified with comingSoon flag)
  const isComingSoon = (action as ActionDefinition & { comingSoon?: boolean }).comingSoon;
  const comingSoonMessage = (action as ActionDefinition & { comingSoonMessage?: string }).comingSoonMessage;

  return (
    <div
      draggable={!isComingSoon}
      onDragStart={(e) => {
        if (isComingSoon) {
          e.preventDefault();
          return;
        }
        onDragStart(e, {
          type: 'action',
          actionId: action.id,
          data: { actionId: action.id, actionName: action.name },
        });
      }}
      onClick={() => {
        if (!isComingSoon) {
          onClick();
        }
      }}
      title={isComingSoon ? comingSoonMessage || 'Coming soon' : undefined}
      className={`flex items-center gap-2 p-2 rounded-lg
                ${isComingSoon
                  ? 'cursor-not-allowed opacity-60 bg-slate-800/30 border border-slate-700/30'
                  : 'cursor-grab active:cursor-grabbing bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50'}
                transition-all duration-150 group`}
    >
      <span className="text-lg">{action.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${isComingSoon ? 'text-slate-400' : 'text-slate-200'}`}>
            {action.name}
          </span>
          {isComingSoon && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-400 flex-shrink-0">
              Soon
            </span>
          )}
          {action.verified && !isComingSoon && (
            <span title="Verified">
              <Shield className="w-3 h-3 text-green-400 flex-shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {action.platform && (
            <span className="text-slate-400">{action.platform}</span>
          )}
          {!isComingSoon && (
            <span className={`px-1 py-0.5 rounded ${riskColors[action.riskLevel]} text-[10px]`}>
              {action.riskLevel}
            </span>
          )}
        </div>
      </div>
      {/* Favorite Toggle */}
      {onToggleFavorite && !isComingSoon && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
            isFavorite
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-slate-500 hover:text-amber-400'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? (
            <Star className="w-3.5 h-3.5 fill-current" />
          ) : (
            <StarOff className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
});

ActionPaletteItem.displayName = 'ActionPaletteItem';

export default NodePalette;
