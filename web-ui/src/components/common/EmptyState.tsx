'use client';

import { ReactNode } from 'react';
import {
  FileText,
  Database,
  Search,
  Activity,
  AlertCircle,
  FolderOpen,
  Users,
  Settings,
  Network,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export type EmptyStateVariant =
  | 'default'
  | 'search'
  | 'filter'
  | 'data'
  | 'incidents'
  | 'workflows'
  | 'documents'
  | 'users'
  | 'network'
  | 'settings';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const variantConfig: Record<
  EmptyStateVariant,
  { icon: LucideIcon; title: string; description: string }
> = {
  default: {
    icon: FolderOpen,
    title: 'No data available',
    description: 'There is nothing to display at the moment.',
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
  filter: {
    icon: Search,
    title: 'No matches',
    description: 'No items match your current filter criteria.',
  },
  data: {
    icon: Database,
    title: 'No data',
    description: 'Data has not been loaded or is unavailable.',
  },
  incidents: {
    icon: Activity,
    title: 'No active incidents',
    description: 'All systems are operating normally.',
  },
  workflows: {
    icon: Workflow,
    title: 'No workflows yet',
    description: 'Create your first workflow to automate network tasks.',
  },
  documents: {
    icon: FileText,
    title: 'No documents',
    description: 'Upload your first document to get started.',
  },
  users: {
    icon: Users,
    title: 'No users found',
    description: 'No users match the current criteria.',
  },
  network: {
    icon: Network,
    title: 'No networks',
    description: 'Connect your first organization to view networks.',
  },
  settings: {
    icon: Settings,
    title: 'Not configured',
    description: 'This feature requires configuration.',
  },
};

const sizeConfig = {
  sm: {
    iconSize: 'w-8 h-8',
    titleSize: 'text-sm',
    descSize: 'text-xs',
    padding: 'py-6 px-4',
    gap: 'gap-2',
  },
  md: {
    iconSize: 'w-12 h-12',
    titleSize: 'text-base',
    descSize: 'text-sm',
    padding: 'py-10 px-6',
    gap: 'gap-3',
  },
  lg: {
    iconSize: 'w-16 h-16',
    titleSize: 'text-lg',
    descSize: 'text-base',
    padding: 'py-16 px-8',
    gap: 'gap-4',
  },
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
  size = 'md',
  children,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const sizes = sizeConfig[size];
  const Icon = icon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${sizes.padding} ${className}`}
    >
      <div
        className={`${sizes.iconSize} text-slate-300 dark:text-slate-600 mb-3`}
      >
        <Icon className="w-full h-full" strokeWidth={1.5} />
      </div>

      <div className={`flex flex-col items-center ${sizes.gap}`}>
        <h3
          className={`font-medium text-slate-700 dark:text-slate-300 ${sizes.titleSize}`}
        >
          {displayTitle}
        </h3>

        <p
          className={`text-slate-500 dark:text-slate-400 max-w-sm ${sizes.descSize}`}
        >
          {displayDescription}
        </p>

        {children}

        {(action || secondaryAction) && (
          <div className="flex items-center gap-3 mt-4">
            {action && (
              <button
                onClick={action.onClick}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Specialized empty states for common use cases
export function NoSearchResults({
  searchTerm,
  onClear,
}: {
  searchTerm?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={
        searchTerm
          ? `No results for "${searchTerm}". Try different keywords.`
          : 'Try adjusting your search terms.'
      }
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
    />
  );
}

export function NoFilterResults({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      variant="filter"
      title="No matches"
      description="No items match your current filters."
      action={onReset ? { label: 'Reset filters', onClick: onReset } : undefined}
    />
  );
}

export function AllSystemsOperational() {
  return (
    <EmptyState
      variant="incidents"
      title="All systems operational"
      description="No active incidents detected. Your network is running smoothly."
      icon={Activity}
    >
      <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-full">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Healthy
        </span>
      </div>
    </EmptyState>
  );
}
