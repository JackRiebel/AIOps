/**
 * Enterprise Canvas - Barrel Export
 *
 * Advanced workflow canvas with enterprise-grade features:
 * - Visual node-based workflow building
 * - Drag-and-drop from palette
 * - Undo/redo with history
 * - WCAG 2.1 keyboard accessibility
 * - Real-time validation
 * - Execution visualization
 * - Three creation modes: Cards, CLI, Python
 */

// Main component
export { EnterpriseCanvas, type EnterpriseCanvasProps } from './EnterpriseCanvas';

// Types
export * from './types';

// Hooks
export { useCanvasHistory, type UseCanvasHistoryOptions, type UseCanvasHistoryReturn } from './hooks/useCanvasHistory';
export { useKeyboardShortcuts, formatShortcut, groupShortcutsByCategory, type KeyboardShortcutHandlers } from './hooks/useKeyboardShortcuts';

// Components
export { CanvasToolbar } from './components/CanvasToolbar';
export { NodePalette } from './components/NodePalette';
export { PropertiesPanel } from './components/PropertiesPanel';
export { ModeSelector, WorkflowModeSelector } from './components/ModeSelector';
export { TemplateGallery } from './components/TemplateGallery';
export { CardGuidelines, type WorkflowPattern } from './components/CardGuidelines';
export { ModeConversionDialog } from './components/ModeConversionDialog';

// Node Components
export { ActionCardNode, type ActionCardNodeData } from './nodes';

// CLI Mode Components
export {
  CLIEditor,
  CLIReference,
  parseCLI,
  CLI_COMMANDS,
  CLI_KEYWORDS,
  CLI_TEMPLATES,
  type CLIValidationError,
  type ParseResult,
  type CLIPlatform,
} from './cli';

// Python Mode Components
export {
  PythonEditor,
  PythonReference,
  ALL_SDK_MODULES,
  PYTHON_TEMPLATES,
  FULL_PYTHON_TEMPLATE,
  getTemplateById as getPythonTemplateById,
  getTemplatesByCategory as getPythonTemplatesByCategory,
  searchTemplates as searchPythonTemplates,
  type PythonValidationError,
  type PythonTemplate,
  type SDKModule,
  type SDKMethod,
} from './python';

// Contexts
export {
  WorkflowModeProvider,
  useWorkflowMode,
  type WorkflowMode,
  type WorkflowModeContextType,
  type WorkflowModeState,
  type ModeHistoryEntry,
} from './contexts/WorkflowModeContext';

// Services - Mode Conversion
export {
  convertWorkflow,
  convertCardsToToCli,
  convertCardsToPython,
  convertCliToCards,
  convertCliToPython,
  canConvert,
  isLossyConversion,
  getConversionDescription,
  CONVERSION_SUPPORT,
  type ConversionDirection,
  type ConversionResult,
  type ConvertWorkflowOptions,
  type ConvertWorkflowResult,
  type WorkflowContent,
} from './services';

// Templates
export {
  CARD_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  type WorkflowTemplate,
} from './templates';
