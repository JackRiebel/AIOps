'use client';

import { memo, useState, useCallback } from 'react';
import { Check, X, Edit3, AlertTriangle, Play, Pause } from 'lucide-react';

/**
 * ActionConfirmation - Displays proposed AI actions with confirm/modify/cancel buttons
 *
 * Ensures AI accountability - no changes execute without explicit user approval.
 * Follows "Show, Don't Tell" - uses icons and short labels, no long explanations.
 */

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'create'      // Creating something new (card, session, etc.)
  | 'modify'      // Modifying existing data
  | 'delete'      // Deleting/removing something
  | 'execute'     // Running a command/query
  | 'configure';  // Changing settings

export interface ProposedAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  target?: string;           // What will be affected
  preview?: React.ReactNode; // Optional preview of the result
  isDestructive?: boolean;   // Highlights dangerous actions
  metadata?: Record<string, any>;
}

export interface ActionConfirmationProps {
  /** The proposed action to confirm */
  action: ProposedAction;
  /** Called when user confirms the action */
  onConfirm: (action: ProposedAction) => void;
  /** Called when user wants to modify the action */
  onModify?: (action: ProposedAction) => void;
  /** Called when user cancels the action */
  onCancel: (action: ProposedAction) => void;
  /** Whether the action is currently executing */
  isExecuting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Action Type Config
// ============================================================================

const actionConfig: Record<ActionType, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  create: { icon: Play, color: 'text-emerald-500', label: 'Create' },
  modify: { icon: Edit3, color: 'text-blue-500', label: 'Modify' },
  delete: { icon: X, color: 'text-red-500', label: 'Delete' },
  execute: { icon: Play, color: 'text-cyan-500', label: 'Execute' },
  configure: { icon: Edit3, color: 'text-purple-500', label: 'Configure' },
};

// ============================================================================
// Main Component
// ============================================================================

export const ActionConfirmation = memo(({
  action,
  onConfirm,
  onModify,
  onCancel,
  isExecuting = false,
  className = '',
}: ActionConfirmationProps) => {
  const config = actionConfig[action.type];
  const Icon = config.icon;

  const handleConfirm = useCallback(() => {
    if (!isExecuting) {
      onConfirm(action);
    }
  }, [action, onConfirm, isExecuting]);

  const handleModify = useCallback(() => {
    if (!isExecuting && onModify) {
      onModify(action);
    }
  }, [action, onModify, isExecuting]);

  const handleCancel = useCallback(() => {
    if (!isExecuting) {
      onCancel(action);
    }
  }, [action, onCancel, isExecuting]);

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${action.isDestructive
        ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10'
        : 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10'
      }
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200/50 dark:border-amber-800/30">
        {action.isDestructive ? (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        ) : (
          <Icon className={`w-4 h-4 ${config.color}`} />
        )}
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          {action.isDestructive ? 'Confirm destructive action' : 'Confirm action'}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {action.title}
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          {action.description}
        </div>
        {action.target && (
          <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 font-mono">
            Target: {action.target}
          </div>
        )}

        {/* Preview */}
        {action.preview && (
          <div className="mt-2 p-2 rounded bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            {action.preview}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-800/30 border-t border-amber-200/50 dark:border-amber-800/30">
        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={isExecuting}
          className={`
            flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
            text-xs font-medium transition-colors
            ${isExecuting
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-wait'
              : action.isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }
          `}
        >
          {isExecuting ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              {action.isDestructive ? 'Confirm' : 'Execute'}
            </>
          )}
        </button>

        {/* Modify (optional) */}
        {onModify && (
          <button
            onClick={handleModify}
            disabled={isExecuting}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modify
          </button>
        )}

        {/* Cancel */}
        <button
          onClick={handleCancel}
          disabled={isExecuting}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
});

ActionConfirmation.displayName = 'ActionConfirmation';

// ============================================================================
// Multiple Actions Component (for batched confirmations)
// ============================================================================

export interface ActionConfirmationListProps {
  actions: ProposedAction[];
  onConfirmAll: (actions: ProposedAction[]) => void;
  onConfirmOne: (action: ProposedAction) => void;
  onModify?: (action: ProposedAction) => void;
  onCancel: (action: ProposedAction) => void;
  onCancelAll: () => void;
  isExecuting?: boolean;
  className?: string;
}

export const ActionConfirmationList = memo(({
  actions,
  onConfirmAll,
  onConfirmOne,
  onModify,
  onCancel,
  onCancelAll,
  isExecuting = false,
  className = '',
}: ActionConfirmationListProps) => {
  if (actions.length === 0) return null;

  const hasDestructive = actions.some(a => a.isDestructive);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with batch actions */}
      {actions.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {actions.length} actions pending
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onConfirmAll(actions)}
              disabled={isExecuting}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-50"
            >
              Execute all
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              onClick={onCancelAll}
              disabled={isExecuting}
              className="text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
            >
              Cancel all
            </button>
          </div>
        </div>
      )}

      {/* Individual actions */}
      {actions.map((action) => (
        <ActionConfirmation
          key={action.id}
          action={action}
          onConfirm={onConfirmOne}
          onModify={onModify}
          onCancel={onCancel}
          isExecuting={isExecuting}
        />
      ))}
    </div>
  );
});

ActionConfirmationList.displayName = 'ActionConfirmationList';

export default ActionConfirmation;
