/**
 * Python Editor Component
 *
 * Monaco editor configured for Python workflow scripts with:
 * - Lumen SDK autocomplete
 * - Real-time validation
 * - Template selection
 */

'use client';

import React, { memo, useRef, useCallback, useEffect, useState } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { editor, languages, MarkerSeverity } from 'monaco-editor';
import {
  ALL_SDK_MODULES,
  FULL_PYTHON_TEMPLATE,
  SDKModule,
  SDKMethod,
} from './pythonSDK';
import { PYTHON_TEMPLATES, PythonTemplate } from './pythonTemplates';

// ============================================================================
// Types
// ============================================================================

export interface PythonValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface PythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (errors: PythonValidationError[]) => void;
  onRun?: () => void;
  readOnly?: boolean;
  height?: string;
}

// ============================================================================
// Validation
// ============================================================================

function validatePython(code: string): PythonValidationError[] {
  const errors: PythonValidationError[] = [];
  const lines = code.split('\n');

  // Forbidden imports
  const forbiddenImports = ['os', 'subprocess', 'sys', 'eval', 'exec', 'open', '__import__'];

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Check for forbidden imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      for (const forbidden of forbiddenImports) {
        if (line.includes(forbidden)) {
          errors.push({
            line: lineNum,
            column: line.indexOf(forbidden) + 1,
            message: `Import '${forbidden}' is not allowed in workflow scripts for security reasons`,
            severity: 'error',
          });
        }
      }
    }

    // Check for forbidden built-ins
    const forbiddenCalls = ['eval(', 'exec(', 'compile(', '__import__(', 'open('];
    for (const forbidden of forbiddenCalls) {
      if (line.includes(forbidden)) {
        errors.push({
          line: lineNum,
          column: line.indexOf(forbidden) + 1,
          message: `'${forbidden.slice(0, -1)}' is not allowed in workflow scripts`,
          severity: 'error',
        });
      }
    }

    // Check for syntax errors in strings
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    const tripleDoubleQuotes = (line.match(/"""/g) || []).length;
    const tripleSingleQuotes = (line.match(/'''/g) || []).length;

    // Basic unclosed string detection (simplified)
    if ((singleQuotes - tripleSingleQuotes * 3) % 2 !== 0 && !line.includes('#')) {
      // This is a simplified check - real validation would be more complex
    }

    // Check for missing await on async calls
    const asyncMethods = ['meraki.', 'splunk.', 'thousandeyes.', 'notify.', 'ai.'];
    for (const method of asyncMethods) {
      const methodIndex = line.indexOf(method);
      if (methodIndex !== -1 && !trimmed.startsWith('#')) {
        const beforeMethod = line.substring(0, methodIndex).trim();
        if (!beforeMethod.endsWith('await') && !beforeMethod.includes('await ') && !line.includes('= await')) {
          // Check if it's not just a reference
          if (line.includes('(')) {
            errors.push({
              line: lineNum,
              column: methodIndex + 1,
              message: `SDK calls should use 'await' - did you forget 'await ${method}...'?`,
              severity: 'warning',
            });
          }
        }
      }
    }
  });

  // Check for required workflow function
  if (!code.includes('async def workflow(') && !code.includes('async def workflow (')) {
    errors.push({
      line: 1,
      column: 1,
      message: "Missing required 'async def workflow(context):' function",
      severity: 'error',
    });
  }

  return errors;
}

// ============================================================================
// SDK Completions
// ============================================================================

function createSDKCompletions(monaco: Monaco): languages.CompletionItem[] {
  const completions: languages.CompletionItem[] = [];

  for (const module of ALL_SDK_MODULES) {
    // Module completion
    completions.push({
      label: module.name,
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: module.name,
      detail: module.description,
      documentation: { value: module.description },
      range: {
        startLineNumber: 0,
        startColumn: 0,
        endLineNumber: 0,
        endColumn: 0,
      },
    });

    // Method completions
    for (const method of module.methods) {
      const params = method.params
        .map((p, i) => `\${${i + 1}:${p.name}}`)
        .join(', ');

      completions.push({
        label: `${module.name}.${method.name}`,
        kind: monaco.languages.CompletionItemKind.Method,
        insertText: method.isAsync
          ? `await ${module.name}.${method.name}(${params})`
          : `${module.name}.${method.name}(${params})`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: method.signature,
        documentation: {
          value: `${method.description}\n\n**Example:**\n\`\`\`python\n${method.example}\n\`\`\``,
        },
        range: {
          startLineNumber: 0,
          startColumn: 0,
          endLineNumber: 0,
          endColumn: 0,
        },
      });
    }
  }

  return completions;
}

// ============================================================================
// Component
// ============================================================================

export const PythonEditor = memo(function PythonEditor({
  value,
  onChange,
  onValidate,
  onRun,
  readOnly = false,
  height = '500px',
}: PythonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Validate on value change
  useEffect(() => {
    if (onValidate && monacoRef.current && editorRef.current) {
      const errors = validatePython(value);
      onValidate(errors);

      // Update editor markers
      const model = editorRef.current.getModel();
      if (model) {
        const markers = errors.map((error) => ({
          severity:
            error.severity === 'error'
              ? MarkerSeverity.Error
              : error.severity === 'warning'
                ? MarkerSeverity.Warning
                : MarkerSeverity.Info,
          message: error.message,
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.line,
          endColumn: error.column + 10,
        }));
        monacoRef.current.editor.setModelMarkers(model, 'python-validator', markers);
      }
    }
  }, [value, onValidate]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register SDK completions
    const sdkCompletions = createSDKCompletions(monaco);

    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        // Get line content for context-aware completions
        const lineContent = model.getLineContent(position.lineNumber);
        const beforeCursor = lineContent.substring(0, position.column - 1);

        // If after a dot, filter to that module's methods
        const dotMatch = beforeCursor.match(/(\w+)\.$/);
        if (dotMatch) {
          const moduleName = dotMatch[1];
          const moduleCompletions = sdkCompletions
            .filter((c) => c.label.toString().startsWith(`${moduleName}.`))
            .map((c) => ({
              ...c,
              label: c.label.toString().split('.')[1],
              insertText: c.insertText?.toString().replace(`${moduleName}.`, '') || '',
              range,
            }));
          return { suggestions: moduleCompletions };
        }

        // Return all SDK module names
        const suggestions = sdkCompletions
          .filter((c) => !c.label.toString().includes('.'))
          .map((c) => ({ ...c, range }));

        return { suggestions };
      },
      triggerCharacters: ['.'],
    });

    // Register hover provider for SDK
    monaco.languages.registerHoverProvider('python', {
      provideHover: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const lineContent = model.getLineContent(position.lineNumber);

        // Check if it's a module or method
        for (const module of ALL_SDK_MODULES) {
          if (word.word === module.name) {
            return {
              contents: [
                { value: `**${module.name}**` },
                { value: module.description },
                { value: `*Methods:* ${module.methods.map((m) => m.name).join(', ')}` },
              ],
            };
          }

          // Check for method hover
          const methodMatch = lineContent.match(new RegExp(`${module.name}\\.(\\w+)`));
          if (methodMatch) {
            const method = module.methods.find((m) => m.name === methodMatch[1]);
            if (method && word.word === method.name) {
              return {
                contents: [
                  { value: `**${module.name}.${method.name}**` },
                  { value: `\`\`\`python\n${method.signature}\n\`\`\`` },
                  { value: method.description },
                  { value: `**Example:**\n\`\`\`python\n${method.example}\n\`\`\`` },
                ],
              };
            }
          }
        }

        return null;
      },
    });

    // Initial validation
    if (onValidate) {
      const errors = validatePython(value);
      onValidate(errors);
    }
  }, [value, onValidate]);

  const handleLoadTemplate = useCallback((template: PythonTemplate) => {
    onChange(template.code);
    setShowTemplates(false);
    setSelectedTemplate('');
  }, [onChange]);

  const handleFormat = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-mono text-sm">Python</span>
          <span className="text-gray-500 text-sm">|</span>
          <span className="text-gray-400 text-xs">Lumen SDK Enabled</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Template Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Templates
            </button>

            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-2 border-b border-gray-700">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {PYTHON_TEMPLATES
                    .filter((t) =>
                      t.name.toLowerCase().includes(selectedTemplate.toLowerCase()) ||
                      t.description.toLowerCase().includes(selectedTemplate.toLowerCase())
                    )
                    .map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleLoadTemplate(template)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-700 border-b border-gray-700 last:border-0"
                      >
                        <div className="text-sm font-medium text-gray-200">{template.name}</div>
                        <div className="text-xs text-gray-500">{template.description}</div>
                        <div className="flex gap-1 mt-1">
                          {template.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleFormat}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
            title="Format Code"
          >
            Format
          </button>

          <button
            onClick={onRun}
            disabled={!onRun}
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-500 text-white rounded flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run
          </button>
        </div>
      </div>

      {/* SDK Quick Reference */}
      <div className="px-4 py-2 bg-gray-850 border-b border-gray-700 flex items-center gap-4 text-xs overflow-x-auto">
        <span className="text-gray-500">Quick:</span>
        {ALL_SDK_MODULES.slice(0, 5).map((module) => (
          <button
            key={module.name}
            onClick={() => {
              if (editorRef.current) {
                const selection = editorRef.current.getSelection();
                if (selection) {
                  editorRef.current.executeEdits('', [
                    {
                      range: selection,
                      text: `await ${module.name}.`,
                    },
                  ]);
                  editorRef.current.focus();
                }
              }
            }}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-mono"
          >
            {module.name}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1" style={{ height }}>
        <Editor
          defaultLanguage="python"
          value={value}
          onChange={(v) => onChange(v || '')}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"Fira Code", "JetBrains Mono", Consolas, monospace',
            fontLigatures: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            parameterHints: { enabled: true },
            folding: true,
            foldingHighlight: true,
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
});

export default PythonEditor;
