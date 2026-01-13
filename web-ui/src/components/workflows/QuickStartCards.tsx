'use client';

import { memo, useState } from 'react';
import {
  WifiOff,
  Activity,
  Shield,
  Calendar,
  Plus,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Download,
  Gauge,
  Network,
  Radio,
  Plug,
} from 'lucide-react';
import { QUICK_START_TEMPLATES, type QuickStartTemplate } from './triggerPresets';

/**
 * QuickStartCards - Compact template cards for the landing page
 *
 * Shows templates in a compact grid with option to expand.
 */

export interface QuickStartCardsProps {
  onSelectTemplate: (template: QuickStartTemplate) => void;
  onCreateCustom: () => void;
  disabled?: boolean;
}

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  WifiOff,
  Activity,
  Shield,
  Calendar,
  Plus,
  Lock,
  Download,
  Gauge,
  Network,
  Radio,
  Plug,
};

// Color configurations for template colors
const COLOR_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800/50 hover:border-red-300',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/50 hover:border-amber-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/50 hover:border-purple-300',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    border: 'border-cyan-200 dark:border-cyan-800/50 hover:border-cyan-300',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800/50 hover:border-green-300',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/50 hover:border-blue-300',
  },
};

interface TemplateCardProps {
  template: QuickStartTemplate;
  onClick: () => void;
  disabled?: boolean;
}

const TemplateCard = memo(({ template, onClick, disabled }: TemplateCardProps) => {
  const IconComponent = ICON_MAP[template.icon] || Activity;
  const colors = COLOR_CONFIG[template.color] || COLOR_CONFIG.cyan;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative flex items-start gap-3 p-3 rounded-lg border transition-all
        ${colors.border}
        bg-white dark:bg-slate-800/60
        hover:shadow-md hover:-translate-y-0.5
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
        text-left
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
        <IconComponent className={`w-4 h-4 ${colors.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium text-sm text-slate-900 dark:text-white truncate">
            {template.name}
          </h3>
          {template.aiEnabled && (
            <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
          {template.description}
        </p>
      </div>

      {/* Hover arrow */}
      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-cyan-500 transition-all flex-shrink-0 mt-1" />
    </button>
  );
});

TemplateCard.displayName = 'TemplateCard';

interface CreateCustomCardProps {
  onClick: () => void;
  disabled?: boolean;
}

const CreateCustomCard = memo(({ onClick, disabled }: CreateCustomCardProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      group relative flex items-start gap-3 p-3 rounded-lg border border-dashed transition-all
      border-slate-200 dark:border-slate-600
      hover:border-cyan-400 dark:hover:border-cyan-500
      hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10
      hover:shadow-md hover:-translate-y-0.5
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
      text-left
    `}
  >
    {/* Icon */}
    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/30 transition-colors">
      <Plus className="w-4 h-4 text-slate-400 group-hover:text-cyan-600 transition-colors" />
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-sm text-slate-900 dark:text-white">
        Create Custom
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        Build from scratch
      </p>
    </div>

    {/* Hover arrow */}
    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-cyan-500 transition-all flex-shrink-0 mt-1" />
  </button>
));

CreateCustomCard.displayName = 'CreateCustomCard';

export const QuickStartCards = memo(({
  onSelectTemplate,
  onCreateCustom,
  disabled = false,
}: QuickStartCardsProps) => {
  const [showAll, setShowAll] = useState(false);

  // Show first 4 by default, all when expanded
  const visibleTemplates = showAll
    ? QUICK_START_TEMPLATES
    : QUICK_START_TEMPLATES.slice(0, 4);

  const hasMore = QUICK_START_TEMPLATES.length > 4;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Quick Start Templates
        </h2>
        {hasMore && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 transition-colors"
          >
            {showAll ? 'Show less' : `View all ${QUICK_START_TEMPLATES.length}`}
            {showAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visibleTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onClick={() => onSelectTemplate(template)}
            disabled={disabled}
          />
        ))}
        <CreateCustomCard onClick={onCreateCustom} disabled={disabled} />
      </div>
    </div>
  );
});

QuickStartCards.displayName = 'QuickStartCards';

export default QuickStartCards;
