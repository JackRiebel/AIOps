'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, MoreVertical, Layers } from 'lucide-react';
import type { CanvasCard as CanvasCardType } from '@/types/session';

// =============================================================================
// Types
// =============================================================================

export interface CompositeCardProps {
  /** Unique identifier for the composite card */
  id: string;
  /** Title of the composite card group */
  title: string;
  /** Description of what this composite view shows */
  description?: string;
  /** Child cards to render inside */
  cards: CanvasCardType[];
  /** Layout mode for child cards */
  layout?: 'grid' | 'stack' | 'tabs' | 'side-by-side';
  /** Number of columns for grid layout */
  columns?: 2 | 3 | 4;
  /** Whether the composite is collapsed */
  defaultCollapsed?: boolean;
  /** Callback when a child card is clicked */
  onCardClick?: (cardId: string) => void;
  /** Callback to expand a single card to full view */
  onExpandCard?: (card: CanvasCardType) => void;
  /** Additional CSS classes */
  className?: string;
}

interface TabState {
  activeTabId: string | null;
}

// =============================================================================
// Mini Card Preview Component
// =============================================================================

interface MiniCardProps {
  card: CanvasCardType;
  onClick?: () => void;
  onExpand?: () => void;
}

function MiniCard({ card, onClick, onExpand }: MiniCardProps) {
  // Simplified preview of card data
  const preview = useMemo(() => {
    if (!card.data) return null;

    // Try to extract key metrics from common data structures
    if (card.data.metrics && Array.isArray(card.data.metrics)) {
      return card.data.metrics.slice(0, 3);
    }
    if (card.data.value !== undefined) {
      return [{ label: card.title, value: card.data.value }];
    }
    if (card.data.count !== undefined) {
      return [{ label: 'Count', value: card.data.count }];
    }
    return null;
  }, [card.data, card.title]);

  return (
    <div
      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-white truncate flex-1">
          {card.title}
        </h4>
        {onExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-all"
            title="Expand to full view"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Preview content */}
      {preview ? (
        <div className="space-y-1">
          {preview.map((metric: { label: string; value: string | number }, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <span className="text-slate-400 truncate">{metric.label}</span>
              <span className="text-slate-200 font-medium">
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500 italic">
          {card.type}
        </div>
      )}

      {/* Live indicator */}
      {card.metadata?.isLive && (
        <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span>Live</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab Header Component
// =============================================================================

interface TabHeaderProps {
  cards: CanvasCardType[];
  activeId: string | null;
  onTabChange: (id: string) => void;
}

function TabHeader({ cards, activeId, onTabChange }: TabHeaderProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-700/50 mb-4 overflow-x-auto">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={() => onTabChange(card.id)}
          className={`
            px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors
            ${activeId === card.id
              ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-[2px]'
              : 'text-slate-400 hover:text-white'
            }
          `}
        >
          {card.title}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Composite Card Component
// =============================================================================

export function CompositeCard({
  id,
  title,
  description,
  cards,
  layout = 'grid',
  columns = 2,
  defaultCollapsed = false,
  onCardClick,
  onExpandCard,
  className = '',
}: CompositeCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [tabState, setTabState] = useState<TabState>({
    activeTabId: cards[0]?.id || null,
  });

  // Grid column class mapping
  const gridColsClass = useMemo(() => {
    switch (columns) {
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      case 4: return 'grid-cols-4';
      default: return 'grid-cols-2';
    }
  }, [columns]);

  // Render cards based on layout
  const renderCards = () => {
    if (cards.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No cards in this group</p>
        </div>
      );
    }

    switch (layout) {
      case 'grid':
        return (
          <div className={`grid ${gridColsClass} gap-3`}>
            {cards.map((card) => (
              <MiniCard
                key={card.id}
                card={card}
                onClick={() => onCardClick?.(card.id)}
                onExpand={() => onExpandCard?.(card)}
              />
            ))}
          </div>
        );

      case 'stack':
        return (
          <div className="space-y-3">
            {cards.map((card) => (
              <MiniCard
                key={card.id}
                card={card}
                onClick={() => onCardClick?.(card.id)}
                onExpand={() => onExpandCard?.(card)}
              />
            ))}
          </div>
        );

      case 'side-by-side':
        return (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cards.map((card) => (
              <div key={card.id} className="flex-shrink-0 w-64">
                <MiniCard
                  card={card}
                  onClick={() => onCardClick?.(card.id)}
                  onExpand={() => onExpandCard?.(card)}
                />
              </div>
            ))}
          </div>
        );

      case 'tabs':
        const activeCard = cards.find((c) => c.id === tabState.activeTabId) || cards[0];
        return (
          <div>
            <TabHeader
              cards={cards}
              activeId={tabState.activeTabId}
              onTabChange={(id) => setTabState({ activeTabId: id })}
            />
            {activeCard && (
              <MiniCard
                card={activeCard}
                onClick={() => onCardClick?.(activeCard.id)}
                onExpand={() => onExpandCard?.(activeCard)}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-800/50 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{title}</h3>
            {description && (
              <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Card count badge */}
          <span className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded">
            {cards.length} cards
          </span>

          {/* Collapse toggle */}
          <button
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4">
          {renderCards()}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Composite Card from Template Definition
// =============================================================================

export interface CompositeFromTemplateProps {
  templateId: string;
  cards: CanvasCardType[];
  onCardClick?: (cardId: string) => void;
  onExpandCard?: (card: CanvasCardType) => void;
}

/**
 * Create a composite card view from cards generated by a template
 */
export function CompositeFromTemplate({
  templateId,
  cards,
  onCardClick,
  onExpandCard,
}: CompositeFromTemplateProps) {
  // Group cards by their template source
  const templateCards = cards.filter(
    (c) => c.metadata?.templateSource === templateId
  );

  if (templateCards.length === 0) {
    return null;
  }

  return (
    <CompositeCard
      id={`composite-${templateId}`}
      title={`Template: ${templateId}`}
      cards={templateCards}
      layout="grid"
      columns={templateCards.length <= 2 ? 2 : 3}
      onCardClick={onCardClick}
      onExpandCard={onExpandCard}
    />
  );
}

export default CompositeCard;
