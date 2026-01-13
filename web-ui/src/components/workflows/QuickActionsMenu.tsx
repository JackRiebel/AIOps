'use client';

import { memo, useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Play,
  Copy,
  Download,
  History,
  Edit,
  Trash2,
  Pause,
  Power,
  FlaskConical,
} from 'lucide-react';

/**
 * QuickActionsMenu - Dropdown menu for workflow quick actions
 */

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface QuickActionsMenuProps {
  workflowId: number;
  isActive: boolean;
  onRun: () => void;
  onTest?: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onViewHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  canExecute?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const QuickActionsMenu = memo(({
  workflowId,
  isActive,
  onRun,
  onTest,
  onDuplicate,
  onExport,
  onViewHistory,
  onEdit,
  onDelete,
  onToggle,
  canExecute = true,
  canEdit = true,
  canDelete = true,
}: QuickActionsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const actions: QuickAction[] = [
    {
      id: 'run',
      label: 'Run Now',
      icon: Play,
      onClick: () => { onRun(); setIsOpen(false); },
      disabled: !canExecute || !isActive,
    },
    ...(onTest ? [{
      id: 'test',
      label: 'Test Workflow',
      icon: FlaskConical,
      onClick: () => { onTest(); setIsOpen(false); },
      disabled: !canExecute,
    }] : []),
    {
      id: 'toggle',
      label: isActive ? 'Pause' : 'Activate',
      icon: isActive ? Pause : Power,
      onClick: () => { onToggle(); setIsOpen(false); },
      disabled: !canEdit,
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => { onDuplicate(); setIsOpen(false); },
      disabled: !canEdit,
    },
    {
      id: 'export',
      label: 'Export JSON',
      icon: Download,
      onClick: () => { onExport(); setIsOpen(false); },
    },
    {
      id: 'history',
      label: 'View History',
      icon: History,
      onClick: () => { onViewHistory(); setIsOpen(false); },
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Edit,
      onClick: () => { onEdit(); setIsOpen(false); },
      disabled: !canEdit,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => { onDelete(); setIsOpen(false); },
      variant: 'danger',
      disabled: !canDelete,
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
          {actions.map((action, index) => {
            const IconComponent = action.icon;
            const isLast = index === actions.length - 1;
            const showDivider = index === 4; // After "View History"

            return (
              <div key={action.id}>
                {showDivider && (
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                )}
                <button
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                    ${action.disabled
                      ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      : action.variant === 'danger'
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }
                  `}
                >
                  <IconComponent className="w-4 h-4" />
                  {action.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

QuickActionsMenu.displayName = 'QuickActionsMenu';

export default QuickActionsMenu;
