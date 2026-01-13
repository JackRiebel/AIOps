'use client';

import React from 'react';
import { LayoutGrid, Terminal, Code2, HelpCircle, AlertTriangle, Ban } from 'lucide-react';
import { useWorkflowMode, WorkflowMode } from '../contexts/WorkflowModeContext';

interface ModeOption {
  id: WorkflowMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  helpUrl?: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'cards',
    label: 'Cards',
    icon: LayoutGrid,
    description: 'Visual drag-and-drop workflow builder with pre-built action cards',
    helpUrl: '/docs/workflows/cards',
  },
  {
    id: 'cli',
    label: 'CLI',
    icon: Terminal,
    description: 'Script workflows using CLI-style commands with conditionals and loops',
    helpUrl: '/docs/workflows/cli',
  },
  {
    id: 'python',
    label: 'Python',
    icon: Code2,
    description: 'Write workflows in Python with full SDK access for advanced automation',
    helpUrl: '/docs/workflows/python',
  },
];

interface ModeSelectorProps {
  compact?: boolean;
  showHelp?: boolean;
  className?: string;
}

export function ModeSelector({ compact = false, showHelp = true, className = '' }: ModeSelectorProps) {
  const { mode, setMode, canSwitchMode, canConvertTo, isLossyConversionTo } = useWorkflowMode();
  const [hoveredMode, setHoveredMode] = React.useState<WorkflowMode | null>(null);

  const handleModeSelect = (newMode: WorkflowMode) => {
    if (newMode !== mode) {
      setMode(newMode);
    }
  };

  const activeOption = MODE_OPTIONS.find(opt => opt.id === mode);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Mode Buttons */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = mode === option.id;
          const isHovered = hoveredMode === option.id;

          return (
            <div key={option.id} className="relative">
              <button
                onClick={() => handleModeSelect(option.id)}
                onMouseEnter={() => setHoveredMode(option.id)}
                onMouseLeave={() => setHoveredMode(null)}
                disabled={!canSwitchMode && !isActive}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }
                  ${!canSwitchMode && !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1
                `}
                title={option.description}
                aria-pressed={isActive}
                aria-label={`${option.label} mode: ${option.description}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-500' : ''}`} />
                {!compact && <span>{option.label}</span>}
              </button>

              {/* Tooltip on hover */}
              {isHovered && !compact && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
                  <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-[220px] whitespace-normal">
                    <div className="font-medium mb-1">{option.label} Mode</div>
                    <div className="text-slate-300 dark:text-slate-400">{option.description}</div>
                    {/* Conversion indicator */}
                    {!isActive && (
                      <div className="mt-2 pt-2 border-t border-slate-600">
                        {!canConvertTo(option.id) ? (
                          <div className="flex items-center gap-1 text-red-400">
                            <Ban className="w-3 h-3" />
                            <span>Cannot convert from {MODE_OPTIONS.find(o => o.id === mode)?.label}</span>
                          </div>
                        ) : isLossyConversionTo(option.id) ? (
                          <div className="flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Some details may be lost</span>
                          </div>
                        ) : (
                          <div className="text-green-400">Full conversion available</div>
                        )}
                      </div>
                    )}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Icon */}
      {showHelp && activeOption?.helpUrl && (
        <a
          href={activeOption.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={`Learn more about ${activeOption.label} mode`}
        >
          <HelpCircle className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

// Also export as a standalone component for use outside the toolbar
export function WorkflowModeSelector({
  onModeChange
}: {
  onModeChange?: (mode: WorkflowMode) => void
}) {
  const { mode, setMode, canSwitchMode, canConvertTo, isLossyConversionTo } = useWorkflowMode();

  const handleModeSelect = (newMode: WorkflowMode) => {
    if (newMode !== mode) {
      setMode(newMode);
      onModeChange?.(newMode);
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Choose Workflow Mode
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = mode === option.id;
          const canConvert = canConvertTo(option.id);
          const isLossy = isLossyConversionTo(option.id);

          return (
            <button
              key={option.id}
              onClick={() => handleModeSelect(option.id)}
              disabled={(!canSwitchMode && !isActive) || (!canConvert && !isActive)}
              className={`
                relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-150
                ${isActive
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                  : canConvert
                    ? 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    : 'border-red-200 dark:border-red-900/50 opacity-50'
                }
                ${(!canSwitchMode && !isActive) || (!canConvert && !isActive) ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Conversion indicator badge */}
              {!isActive && !canConvert && (
                <div className="absolute top-2 right-2">
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
              )}
              {!isActive && canConvert && isLossy && (
                <div className="absolute top-2 right-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
              )}

              <div className={`
                w-12 h-12 rounded-lg flex items-center justify-center mb-2
                ${isActive
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }
              `}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={`
                font-medium text-sm
                ${isActive ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}
              `}>
                {option.label}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 line-clamp-2">
                {option.description}
              </span>

              {/* Conversion status text */}
              {!isActive && (
                <span className={`text-xs mt-2 ${
                  !canConvert
                    ? 'text-red-400'
                    : isLossy
                      ? 'text-amber-400'
                      : 'text-green-400'
                }`}>
                  {!canConvert
                    ? 'Not available'
                    : isLossy
                      ? 'Lossy conversion'
                      : 'Full conversion'
                  }
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ModeSelector;
