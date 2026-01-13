'use client';

import { memo } from 'react';
import { X, Wand2, FileCode, MessageSquare, PenTool, ChevronRight, Sparkles, Code2 } from 'lucide-react';

/**
 * CreateWorkflowModal - Modal that presents different workflow creation methods
 *
 * User-friendly options:
 * - AI Generate: Describe what you want in natural language
 * - Templates: Start from pre-built workflows
 * - Guided: Step-by-step wizard with dropdowns and selections
 *
 * Advanced option:
 * - Canvas: Visual drag-and-drop builder for power users
 */

export interface CreateWorkflowModalProps {
  onClose: () => void;
  onSelectAI: () => void;
  onSelectTemplates: () => void;
  onSelectGuided: () => void;
  onSelectCanvas: () => void;
  onSelectQuick: () => void;
}

interface CreationOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  badge?: string;
  badgeColor?: string;
  onClick: () => void;
  recommended?: boolean;
}

export const CreateWorkflowModal = memo(({
  onClose,
  onSelectAI,
  onSelectTemplates,
  onSelectGuided,
  onSelectCanvas,
  onSelectQuick,
}: CreateWorkflowModalProps) => {
  const easyOptions: CreationOption[] = [
    {
      id: 'ai',
      title: 'Describe with AI',
      description: 'Tell AI what you want to automate in plain English. Best for beginners.',
      icon: <MessageSquare className="w-6 h-6" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      badge: 'Recommended',
      badgeColor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      onClick: onSelectAI,
      recommended: true,
    },
    {
      id: 'templates',
      title: 'Start from Template',
      description: 'Choose from pre-built workflows for common network automation tasks.',
      icon: <FileCode className="w-6 h-6" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      onClick: onSelectTemplates,
    },
    {
      id: 'guided',
      title: 'Guided Setup',
      description: 'Step-by-step wizard with simple dropdown selections. No coding required.',
      icon: <Wand2 className="w-6 h-6" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      onClick: onSelectGuided,
    },
    {
      id: 'quick',
      title: 'Quick Create',
      description: 'Fill out a simple form to create a basic workflow in seconds.',
      icon: <Sparkles className="w-6 h-6" />,
      iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
      onClick: onSelectQuick,
    },
  ];

  const advancedOptions: CreationOption[] = [
    {
      id: 'canvas',
      title: 'Visual Canvas',
      description: 'Drag-and-drop workflow builder for complex automations. For advanced users.',
      icon: <PenTool className="w-6 h-6" />,
      iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      badge: 'Advanced',
      badgeColor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      onClick: onSelectCanvas,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Create Workflow
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose how you want to create your workflow
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Easy Options */}
            <div className="space-y-3">
              {easyOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={option.onClick}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-xl text-left
                    border-2 transition-all duration-200
                    ${option.recommended
                      ? 'border-purple-300 dark:border-purple-600/50 bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${option.iconBg}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {option.title}
                      </h3>
                      {option.badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${option.badgeColor}`}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">
                For Power Users
              </span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
            </div>

            {/* Advanced Options */}
            <div className="space-y-3">
              {advancedOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={option.onClick}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200"
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${option.iconBg}`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {option.title}
                      </h3>
                      {option.badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${option.badgeColor}`}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

CreateWorkflowModal.displayName = 'CreateWorkflowModal';

export default CreateWorkflowModal;
