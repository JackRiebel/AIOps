'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type { editor, languages, IDisposable } from 'monaco-editor';
import {
  Play, AlertCircle, CheckCircle, Copy, Download, Upload,
  FileCode, Sparkles, Loader2
} from 'lucide-react';
import {
  CLI_LANGUAGE_ID,
  CLI_LANGUAGE_CONFIG,
  CLI_MONARCH_TOKENS,
  CLI_THEME_RULES,
  CLI_COMMANDS,
  CLI_KEYWORDS,
  getCompletionItems,
  CLI_TEMPLATES,
  type CLITemplateId,
} from './cliGrammar';

interface CLIEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (errors: CLIValidationError[]) => void;
  onRun?: () => void;
  readOnly?: boolean;
  height?: string | number;
}

export interface CLIValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Register the custom language
let languageRegistered = false;
let completionDisposable: IDisposable | null = null;

export const CLIEditor = memo(({
  value,
  onChange,
  onValidate,
  onRun,
  readOnly = false,
  height = '100%',
}: CLIEditorProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<CLIValidationError[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Handle editor mount
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      folding: true,
      renderLineHighlight: 'line',
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun?.();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      // Format document
      editor.getAction('editor.action.formatDocument')?.run();
    });
  }, [onRun]);

  // Register language before mount
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    if (languageRegistered) return;

    // Register the language
    monaco.languages.register({ id: CLI_LANGUAGE_ID });

    // Set language configuration
    monaco.languages.setLanguageConfiguration(CLI_LANGUAGE_ID, CLI_LANGUAGE_CONFIG as languages.LanguageConfiguration);

    // Set monarch tokenizer
    monaco.languages.setMonarchTokensProvider(CLI_LANGUAGE_ID, CLI_MONARCH_TOKENS as languages.IMonarchLanguage);

    // Define theme
    monaco.editor.defineTheme('lumen-cli-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: CLI_THEME_RULES as editor.ITokenThemeRule[],
      colors: {
        'editor.background': '#1e293b',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#64748b',
        'editorLineNumber.activeForeground': '#94a3b8',
        'editor.selectionBackground': '#334155',
        'editor.lineHighlightBackground': '#1e293b80',
        'editorCursor.foreground': '#06b6d4',
        'editorWhitespace.foreground': '#334155',
      },
    });

    // Register completion provider
    if (completionDisposable) {
      completionDisposable.dispose();
    }
    completionDisposable = monaco.languages.registerCompletionItemProvider(CLI_LANGUAGE_ID, {
      triggerCharacters: [' ', '-', '.'],
      provideCompletionItems: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const wordBefore = model.getWordUntilPosition(position).word;

        const items = getCompletionItems({ lineContent, wordBefore });

        return {
          suggestions: items.map(item => ({
            label: item.label,
            kind: getCompletionKind(monaco, item.kind),
            detail: item.detail,
            documentation: item.documentation,
            insertText: item.insertText,
            insertTextRules: item.insertTextRules as languages.CompletionItemInsertTextRule,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column - wordBefore.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          })),
        };
      },
    });

    // Register hover provider
    monaco.languages.registerHoverProvider(CLI_LANGUAGE_ID, {
      provideHover: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const wordText = word.word;

        // Check if it's a platform command
        if (CLI_COMMANDS[wordText as keyof typeof CLI_COMMANDS]) {
          const cmd = CLI_COMMANDS[wordText as keyof typeof CLI_COMMANDS];
          return {
            contents: [
              { value: `**${wordText}**` },
              { value: cmd.description },
              { value: `Available commands: ${cmd.subcommands.map(s => s.name).join(', ')}` },
            ],
          };
        }

        // Check if it's a keyword
        if (CLI_KEYWORDS.includes(wordText as typeof CLI_KEYWORDS[number])) {
          return {
            contents: [
              { value: `**${wordText}** (keyword)` },
              { value: getKeywordDescription(wordText) },
            ],
          };
        }

        return null;
      },
    });

    languageRegistered = true;
  }, []);

  // Validate CLI content
  const validateContent = useCallback((content: string) => {
    setIsValidating(true);
    const errors: CLIValidationError[] = [];
    const lines = content.split('\n');

    let inIfBlock = 0;
    let inLoopBlock = 0;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      // Check for unclosed strings
      const doubleQuotes = (trimmedLine.match(/"/g) || []).length;
      const singleQuotes = (trimmedLine.match(/'/g) || []).length;
      if (doubleQuotes % 2 !== 0) {
        errors.push({
          line: lineNum,
          column: trimmedLine.indexOf('"') + 1,
          message: 'Unclosed string literal',
          severity: 'error',
        });
      }
      if (singleQuotes % 2 !== 0) {
        errors.push({
          line: lineNum,
          column: trimmedLine.indexOf("'") + 1,
          message: 'Unclosed string literal',
          severity: 'error',
        });
      }

      // Check for unclosed variable interpolation
      const openVars = (trimmedLine.match(/\$\{/g) || []).length;
      const closeVars = (trimmedLine.match(/\}/g) || []).length;
      if (openVars > closeVars) {
        errors.push({
          line: lineNum,
          column: trimmedLine.lastIndexOf('${') + 1,
          message: 'Unclosed variable interpolation ${}',
          severity: 'error',
        });
      }

      // Track block structures
      if (trimmedLine.startsWith('if ') && trimmedLine.includes('then')) {
        inIfBlock++;
      } else if (trimmedLine.startsWith('loop ')) {
        inLoopBlock++;
      } else if (trimmedLine === 'end') {
        if (inIfBlock > 0) inIfBlock--;
        else if (inLoopBlock > 0) inLoopBlock--;
        else {
          errors.push({
            line: lineNum,
            column: 1,
            message: 'Unexpected "end" without matching "if" or "loop"',
            severity: 'error',
          });
        }
      }

      // Check for valid commands
      const commandMatch = trimmedLine.match(/^(\w+)\s+/);
      if (commandMatch) {
        const command = commandMatch[1];
        const isValidCommand = CLI_COMMANDS[command as keyof typeof CLI_COMMANDS] ||
          CLI_KEYWORDS.includes(command as typeof CLI_KEYWORDS[number]) ||
          command === 'set' || command === 'return';

        if (!isValidCommand) {
          errors.push({
            line: lineNum,
            column: 1,
            message: `Unknown command: "${command}"`,
            severity: 'warning',
          });
        }
      }

      // Check for deprecated patterns
      if (trimmedLine.includes('&&') || trimmedLine.includes('||')) {
        errors.push({
          line: lineNum,
          column: trimmedLine.indexOf('&&') > -1 ? trimmedLine.indexOf('&&') + 1 : trimmedLine.indexOf('||') + 1,
          message: 'Use "and" / "or" instead of "&&" / "||"',
          severity: 'info',
        });
      }
    });

    // Check for unclosed blocks at end
    if (inIfBlock > 0) {
      errors.push({
        line: lines.length,
        column: 1,
        message: `${inIfBlock} unclosed "if" block(s) - missing "end"`,
        severity: 'error',
      });
    }
    if (inLoopBlock > 0) {
      errors.push({
        line: lines.length,
        column: 1,
        message: `${inLoopBlock} unclosed "loop" block(s) - missing "end"`,
        severity: 'error',
      });
    }

    setValidationErrors(errors);
    onValidate?.(errors);
    setIsValidating(false);

    // Update editor markers
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'cli-validator', errors.map(err => ({
          startLineNumber: err.line,
          startColumn: err.column,
          endLineNumber: err.line,
          endColumn: err.column + 10,
          message: err.message,
          severity: err.severity === 'error'
            ? monacoRef.current!.MarkerSeverity.Error
            : err.severity === 'warning'
              ? monacoRef.current!.MarkerSeverity.Warning
              : monacoRef.current!.MarkerSeverity.Info,
        })));
      }
    }
  }, [onValidate]);

  // Debounced validation on content change
  useEffect(() => {
    const timer = setTimeout(() => {
      validateContent(value);
    }, 500);
    return () => clearTimeout(timer);
  }, [value, validateContent]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
  }, [value]);

  // Insert template
  const insertTemplate = useCallback((templateId: CLITemplateId) => {
    onChange(CLI_TEMPLATES[templateId]);
    setShowTemplates(false);
  }, [onChange]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">CLI Workflow Editor</span>

          {/* Validation Status */}
          <div className="flex items-center gap-1 ml-3">
            {isValidating ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : validationErrors.length === 0 ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <div className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400">
                  {validationErrors.filter(e => e.severity === 'error').length} errors
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Templates dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Templates
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 rounded-lg border border-slate-700 shadow-xl z-50">
                {Object.entries(CLI_TEMPLATES).map(([id, _]) => (
                  <button
                    key={id}
                    onClick={() => insertTemplate(id as CLITemplateId)}
                    className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="w-4 h-4" />
          </button>

          {onRun && (
            <button
              onClick={onRun}
              disabled={validationErrors.some(e => e.severity === 'error')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors ml-2"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height={height}
          language={CLI_LANGUAGE_ID}
          theme="lumen-cli-dark"
          value={value}
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          beforeMount={handleBeforeMount}
          options={{
            readOnly,
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-slate-900">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          }
        />
      </div>

      {/* Error Panel */}
      {validationErrors.length > 0 && (
        <div className="max-h-32 overflow-y-auto border-t border-slate-700 bg-slate-850">
          {validationErrors.map((error, idx) => (
            <div
              key={idx}
              onClick={() => {
                editorRef.current?.setPosition({ lineNumber: error.line, column: error.column });
                editorRef.current?.focus();
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-800 ${
                error.severity === 'error'
                  ? 'text-red-400'
                  : error.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-blue-400'
              }`}
            >
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span className="text-slate-500">Ln {error.line}</span>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

CLIEditor.displayName = 'CLIEditor';

// Helper functions
function getCompletionKind(
  monaco: typeof import('monaco-editor'),
  kind: string
): languages.CompletionItemKind {
  switch (kind) {
    case 'keyword': return monaco.languages.CompletionItemKind.Keyword;
    case 'command': return monaco.languages.CompletionItemKind.Module;
    case 'subcommand': return monaco.languages.CompletionItemKind.Function;
    case 'flag': return monaco.languages.CompletionItemKind.Property;
    case 'variable': return monaco.languages.CompletionItemKind.Variable;
    case 'snippet': return monaco.languages.CompletionItemKind.Snippet;
    default: return monaco.languages.CompletionItemKind.Text;
  }
}

function getKeywordDescription(keyword: string): string {
  const descriptions: Record<string, string> = {
    if: 'Conditional execution. Syntax: `if condition then ... end`',
    then: 'Marks the start of the conditional block',
    else: 'Alternative branch when condition is false',
    elif: 'Additional condition check (else if)',
    end: 'Closes an if or loop block',
    loop: 'Iterate over a collection. Syntax: `loop items as item ... end`',
    as: 'Assigns loop variable name',
    in: 'Specifies collection to iterate',
    wait: 'Pause execution. Syntax: `wait 30s` or `wait 5m`',
    set: 'Assign a variable. Syntax: `set name = value`',
    return: 'Return a value from the workflow',
    true: 'Boolean true value',
    false: 'Boolean false value',
    null: 'Null/empty value',
    and: 'Logical AND operator',
    or: 'Logical OR operator',
    not: 'Logical NOT operator',
  };
  return descriptions[keyword] || 'Keyword';
}

export default CLIEditor;
