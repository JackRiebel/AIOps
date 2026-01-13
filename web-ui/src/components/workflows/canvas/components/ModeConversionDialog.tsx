/**
 * Mode Conversion Dialog
 *
 * Confirmation dialog for workflow mode switching with conversion preview.
 */

'use client';

import React, { memo, useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, XCircle, Info } from 'lucide-react';
import { useWorkflowMode, type WorkflowMode } from '../contexts/WorkflowModeContext';
import { CONVERSION_SUPPORT, type ConversionDirection } from '../services/workflowModeConverter';

// ============================================================================
// Types
// ============================================================================

interface ModeConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Mode Info
// ============================================================================

const MODE_INFO: Record<WorkflowMode, {
  name: string;
  icon: string;
  color: string;
  description: string;
}> = {
  cards: {
    name: 'Cards',
    icon: '🎴',
    color: 'cyan',
    description: 'Visual drag-and-drop workflow builder',
  },
  cli: {
    name: 'CLI',
    icon: '💻',
    color: 'green',
    description: 'Text-based command scripting',
  },
  python: {
    name: 'Python',
    icon: '🐍',
    color: 'yellow',
    description: 'Full Python code with SDK access',
  },
};

// ============================================================================
// Component
// ============================================================================

export const ModeConversionDialog = memo(function ModeConversionDialog({
  isOpen,
  onClose,
}: ModeConversionDialogProps) {
  const {
    mode: currentMode,
    pendingModeSwitch,
    confirmPendingSwitch,
    cancelPendingSwitch,
    hasUnsavedChanges,
    canConvertTo,
    isLossyConversionTo,
    getConversionDescriptionTo,
  } = useWorkflowMode();

  const targetMode = pendingModeSwitch;

  // Get conversion info
  const conversionInfo = useMemo(() => {
    if (!targetMode || targetMode === currentMode) return null;

    const direction = `${currentMode}-to-${targetMode}` as ConversionDirection;
    const support = CONVERSION_SUPPORT[direction];

    return {
      direction,
      supported: support?.supported ?? false,
      lossy: support?.lossy ?? true,
      description: support?.description ?? 'Unknown conversion',
    };
  }, [currentMode, targetMode]);

  if (!isOpen || !targetMode || !conversionInfo) return null;

  const currentModeInfo = MODE_INFO[currentMode];
  const targetModeInfo = MODE_INFO[targetMode];

  const handleConfirm = () => {
    confirmPendingSwitch();
    onClose();
  };

  const handleCancel = () => {
    cancelPendingSwitch();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-cyan-400" />
            Switch Workflow Mode
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Mode Transition */}
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-slate-700/50 flex items-center justify-center text-3xl mb-2">
                {currentModeInfo.icon}
              </div>
              <div className="text-sm font-medium text-white">{currentModeInfo.name}</div>
              <div className="text-xs text-slate-500">Current</div>
            </div>

            <ArrowRight className="w-8 h-8 text-slate-600" />

            <div className="text-center">
              <div className={`w-16 h-16 rounded-xl bg-${targetModeInfo.color}-500/20 flex items-center justify-center text-3xl mb-2 ring-2 ring-${targetModeInfo.color}-500`}>
                {targetModeInfo.icon}
              </div>
              <div className="text-sm font-medium text-white">{targetModeInfo.name}</div>
              <div className="text-xs text-slate-500">Target</div>
            </div>
          </div>

          {/* Conversion Status */}
          <div className={`rounded-lg p-4 ${
            conversionInfo.supported
              ? conversionInfo.lossy
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-start gap-3">
              {conversionInfo.supported ? (
                conversionInfo.lossy ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                )
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className={`text-sm font-medium ${
                  conversionInfo.supported
                    ? conversionInfo.lossy
                      ? 'text-amber-300'
                      : 'text-green-300'
                    : 'text-red-300'
                }`}>
                  {conversionInfo.supported
                    ? conversionInfo.lossy
                      ? 'Lossy Conversion'
                      : 'Full Conversion'
                    : 'Not Supported'
                  }
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  {conversionInfo.description}
                </p>
              </div>
            </div>
          </div>

          {/* Unsaved Changes Warning */}
          {hasUnsavedChanges && (
            <div className="rounded-lg p-4 bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-amber-300">
                    Unsaved Changes
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    You have unsaved changes that will be included in the conversion.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conversion Details */}
          {conversionInfo.supported && (
            <div className="text-sm text-slate-400 space-y-2">
              <p>When you switch modes:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                {conversionInfo.lossy ? (
                  <>
                    <li>Some workflow details may be simplified</li>
                    <li>Review the converted content carefully</li>
                    <li>You can undo this switch if needed</li>
                  </>
                ) : (
                  <>
                    <li>Your workflow will be fully converted</li>
                    <li>All actions and logic will be preserved</li>
                    <li>You can switch back at any time</li>
                  </>
                )}
              </ul>
            </div>
          )}

          {!conversionInfo.supported && (
            <div className="text-sm text-slate-400">
              <p>
                {currentMode === 'python'
                  ? 'Python code cannot be reliably converted to other modes. Please manually recreate your workflow in the target mode, or continue using Python mode.'
                  : 'This conversion is not supported. Please try a different target mode.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-850 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {conversionInfo.supported ? (
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                conversionInfo.lossy
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {conversionInfo.lossy ? 'Convert Anyway' : 'Convert & Switch'}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-red-600 hover:bg-red-500"
            >
              Discard & Switch
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default ModeConversionDialog;
