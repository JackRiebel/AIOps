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

  const sections: { items: QuickAction[] }[] = [
    {
      items: [
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
          label: isActive ? 'Pause Workflow' : 'Activate Workflow',
          icon: isActive ? Pause : Power,
          onClick: () => { onToggle(); setIsOpen(false); },
          disabled: !canEdit,
        },
      ],
    },
    {
      items: [
        {
          id: 'edit',
          label: 'Edit in Canvas',
          icon: Edit,
          onClick: () => { onEdit(); setIsOpen(false); },
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
      ],
    },
    {
      items: [
        {
          id: 'delete',
          label: 'Delete',
          icon: Trash2,
          onClick: () => { onDelete(); setIsOpen(false); },
          variant: 'danger',
          disabled: !canDelete,
        },
      ],
    },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700/60 py-1.5 z-50 backdrop-blur-sm">
          {sections.map((section, si) => (
            <div key={si}>
              {si > 0 && <div className="my-1.5 mx-3 border-t border-slate-100 dark:border-slate-700/50" />}
              {section.items.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                      action.disabled
                        ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                        : action.variant === 'danger'
                          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

QuickActionsMenu.displayName = 'QuickActionsMenu';

export default QuickActionsMenu;
