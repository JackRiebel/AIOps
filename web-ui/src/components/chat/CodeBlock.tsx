'use client';

import { memo, useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================================
// Types
// ============================================================================

export interface CodeBlockProps {
  children: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

// ============================================================================
// Language Display Names
// ============================================================================

const languageNames: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  scala: 'Scala',
  sql: 'SQL',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  graphql: 'GraphQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  md: 'Markdown',
  markdown: 'Markdown',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Zsh',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  docker: 'Docker',
  nginx: 'Nginx',
  apache: 'Apache',
  vim: 'Vim',
  diff: 'Diff',
  git: 'Git',
  ini: 'INI',
  toml: 'TOML',
  env: 'Environment',
  text: 'Plain Text',
  txt: 'Plain Text',
};

// ============================================================================
// Custom Styles
// ============================================================================

// Customize the one-dark theme for our UI
const customDarkStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    margin: 0,
    padding: '1rem',
    background: 'rgb(15, 23, 42)', // slate-900
    borderRadius: '0 0 0.5rem 0.5rem',
    fontSize: '0.8125rem',
    lineHeight: '1.5',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
};

const customLightStyle = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...oneLight['pre[class*="language-"]'],
    margin: 0,
    padding: '1rem',
    background: 'rgb(248, 250, 252)', // slate-50
    borderRadius: '0 0 0.5rem 0.5rem',
    fontSize: '0.8125rem',
    lineHeight: '1.5',
  },
  'code[class*="language-"]': {
    ...oneLight['code[class*="language-"]'],
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
};

// ============================================================================
// CodeBlock Component
// ============================================================================

export const CodeBlock = memo(({
  children,
  language = 'text',
  showLineNumbers = false,
  className = '',
}: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Observe dark mode changes
  useState(() => {
    if (typeof window === 'undefined') return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  });

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [children]);

  const displayLanguage = languageNames[language.toLowerCase()] || language.toUpperCase();
  const normalizedLanguage = language.toLowerCase();

  return (
    <div className={`relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 my-3 ${className}`}>
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {displayLanguage}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={isDark ? customDarkStyle : customLightStyle}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: isDark ? 'rgb(100, 116, 139)' : 'rgb(148, 163, 184)',
          userSelect: 'none',
        }}
        customStyle={{
          margin: 0,
          borderRadius: 0,
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// ============================================================================
// Inline Code Component
// ============================================================================

export const InlineCode = memo(({ children }: { children: React.ReactNode }) => {
  return (
    <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 text-sm font-mono">
      {children}
    </code>
  );
});

InlineCode.displayName = 'InlineCode';

export default CodeBlock;
