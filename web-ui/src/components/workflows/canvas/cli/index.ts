/**
 * CLI Mode Components
 *
 * Provides CLI-based workflow creation with:
 * - Monaco editor with custom syntax highlighting
 * - Command parser and validator
 * - Command reference panel
 */

// Editor
export { CLIEditor, type CLIValidationError } from './CLIEditor';

// Reference panel
export { CLIReference } from './CLIReference';

// Parser
export {
  parseCLI,
  astToWorkflowNodes,
  type ParseResult,
  type ParseError,
  type ParseWarning,
  type ASTNode,
  type ProgramNode,
  type CommandNode,
  type IfNode,
  type LoopNode,
  type WaitNode,
  type SetNode,
  type ConditionExpression,
} from './cliParser';

// Grammar and language configuration
export {
  CLI_LANGUAGE_ID,
  CLI_LANGUAGE_CONFIG,
  CLI_MONARCH_TOKENS,
  CLI_THEME_RULES,
  CLI_COMMANDS,
  CLI_KEYWORDS,
  CLI_OPERATORS,
  CLI_TEMPLATES,
  getCompletionItems,
  type CLIPlatform,
  type CLIKeyword,
  type CLIOperator,
  type CLITemplateId,
  type CLIToken,
  type CLITokenType,
  type CLICompletionItem,
} from './cliGrammar';

// Templates (comprehensive workflow templates)
export {
  CLI_TEMPLATES as CLI_WORKFLOW_TEMPLATES,
  getTemplateById as getCLITemplateById,
  getTemplatesByCategory as getCLITemplatesByCategory,
  getTemplatesByTag as getCLITemplatesByTag,
  searchTemplates as searchCLITemplates,
  type CLITemplate,
} from './cliTemplates';
