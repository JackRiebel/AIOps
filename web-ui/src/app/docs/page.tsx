'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  ChevronRight,
  Search,
  Menu,
  X,
  ArrowUp,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Network,
  Shield,
  Activity,
  Settings,
  Users,
  FileText,
  Zap,
  Database
} from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Icon mapping for different section types
const sectionIcons: Record<string, React.ReactNode> = {
  'getting-started': <Zap className="w-4 h-4" />,
  'dashboard': <Activity className="w-4 h-4" />,
  'ai-network-manager': <Sparkles className="w-4 h-4" />,
  'networks': <Network className="w-4 h-4" />,
  'incident': <FileText className="w-4 h-4" />,
  'thousandeyes': <Activity className="w-4 h-4" />,
  'splunk': <Database className="w-4 h-4" />,
  'ai-settings': <Settings className="w-4 h-4" />,
  'cost': <FileText className="w-4 h-4" />,
  'security': <Shield className="w-4 h-4" />,
  'audit': <FileText className="w-4 h-4" />,
  'admin': <Settings className="w-4 h-4" />,
  'troubleshooting': <Settings className="w-4 h-4" />,
  'best-practices': <BookOpen className="w-4 h-4" />,
  'keyboard': <Settings className="w-4 h-4" />,
  'help': <Users className="w-4 h-4" />,
};

function getSectionIcon(text: string): React.ReactNode {
  const lowerText = text.toLowerCase();
  for (const [key, icon] of Object.entries(sectionIcons)) {
    if (lowerText.includes(key.replace('-', ' ')) || lowerText.includes(key)) {
      return icon;
    }
  }
  return <ChevronRight className="w-4 h-4" />;
}

export default function DocsPage() {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract TOC from markdown
  const extractToc = useCallback((md: string): TocItem[] => {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(md)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      // Create slug from text
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      items.push({ id, text, level });
    }

    return items;
  }, []);

  // Fetch documentation
  useEffect(() => {
    async function fetchDocs() {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_BASE_URL}/api/docs`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to load documentation');
        const data = await response.json();
        const content = data.content || '# Documentation Unavailable';
        setMarkdown(content);
        setToc(extractToc(content));
      } catch (err) {
        console.error('Failed to fetch documentation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load documentation');
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();
  }, [extractToc]);

  // Handle scroll for active section and scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const container = contentRef.current;
      if (!container) return;

      // Show/hide scroll-to-top button
      setShowScrollTop(container.scrollTop > 400);

      // Find active section
      const headings = container.querySelectorAll('h1[id], h2[id], h3[id]');
      let currentActive = '';

      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top <= containerRect.top + 100) {
          currentActive = heading.id;
        }
      });

      if (currentActive) {
        setActiveSection(currentActive);
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [markdown]);

  // Scroll to section
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element && contentRef.current) {
      const containerTop = contentRef.current.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const offset = elementTop - containerTop + contentRef.current.scrollTop - 20;

      contentRef.current.scrollTo({
        top: offset,
        behavior: 'smooth'
      });
      setActiveSection(id);
      setShowMobileToc(false);
    }
  };

  // Scroll to top
  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Copy code to clipboard
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filter TOC by search
  const filteredToc = toc.filter(item =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group TOC items by top-level sections
  const groupedToc = filteredToc.reduce((acc, item) => {
    if (item.level === 2) {
      acc.push({ ...item, children: [] });
    } else if (item.level === 3 && acc.length > 0) {
      acc[acc.length - 1].children?.push(item);
    }
    return acc;
  }, [] as (TocItem & { children?: TocItem[] })[]);

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex">
      {/* Mobile TOC Toggle */}
      <button
        onClick={() => setShowMobileToc(!showMobileToc)}
        aria-expanded={showMobileToc}
        aria-label={showMobileToc ? 'Close table of contents' : 'Open table of contents'}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-3 bg-cyan-500 text-white rounded-full shadow-lg hover:bg-cyan-600 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        {showMobileToc ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-20 lg:right-6 z-50 p-3 bg-slate-700 dark:bg-slate-600 text-white rounded-full shadow-lg hover:bg-slate-600 dark:hover:bg-slate-500 transition-all opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* Sidebar TOC */}
      <aside
        aria-label="Table of contents"
        className={`
          fixed lg:relative inset-y-0 left-0 z-40
          w-72 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700/50
          transform transition-transform duration-300 ease-in-out
          ${showMobileToc ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* TOC Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-cyan-500" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Documentation</h2>
          </div>

          {/* Search */}
          <div className="relative" role="search">
            <label htmlFor="toc-search" className="sr-only">Search documentation sections</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              id="toc-search"
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>

        {/* TOC List */}
        <nav aria-label="Documentation sections" className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-r-transparent" aria-hidden="true" />
              <span className="sr-only">Loading table of contents</span>
            </div>
          ) : (
            groupedToc.map((section) => (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => scrollToSection(section.id)}
                  aria-current={activeSection === section.id ? 'true' : undefined}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all text-left focus:outline-none focus:ring-2 focus:ring-cyan-500
                    ${activeSection === section.id
                      ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                >
                  <span className="flex-shrink-0 opacity-70" aria-hidden="true">
                    {getSectionIcon(section.text)}
                  </span>
                  <span className="truncate">{section.text}</span>
                </button>

                {/* Sub-sections */}
                {section.children && section.children.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-slate-200 dark:border-slate-700/50 pl-2">
                    {section.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => scrollToSection(child.id)}
                        aria-current={activeSection === child.id ? 'true' : undefined}
                        className={`
                          w-full text-left px-2 py-1.5 text-xs rounded transition-all truncate focus:outline-none focus:ring-2 focus:ring-cyan-500
                          ${activeSection === child.id
                            ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5'
                            : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }
                        `}
                      >
                        {child.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </nav>

        {/* TOC Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700/50">
          <a
            href="https://github.com/your-org/lumen"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on GitHub (opens in new tab)"
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            View on GitHub
          </a>
        </div>
      </aside>

      {/* Mobile TOC Overlay */}
      {showMobileToc && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setShowMobileToc(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main
        ref={contentRef}
        className="flex-1 overflow-y-auto"
        aria-label="Documentation content"
      >
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Hero Header */}
          <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg" aria-hidden="true">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lumen User Guide</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Complete documentation for the Lumen platform</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-4" aria-label="Documentation statistics">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{toc.filter(t => t.level === 2).length} sections</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Covers all features</span>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-32" role="status" aria-live="polite">
              <div className="text-center">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true" />
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading documentation...</p>
              </div>
            </div>
          ) : error ? (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-center gap-3" role="alert">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg" aria-hidden="true">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Failed to load documentation</p>
                <p className="text-sm text-red-600 dark:text-red-400/80">{error}</p>
              </div>
            </div>
          ) : (
            <article className="prose prose-slate dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                    return (
                      <h1
                        id={id}
                        className="text-3xl font-bold text-slate-900 dark:text-white mb-6 mt-12 first:mt-0 scroll-mt-6"
                      >
                        {children}
                      </h1>
                    );
                  },
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                    return (
                      <h2
                        id={id}
                        className="group text-xl font-semibold text-slate-900 dark:text-white mb-4 mt-10 pb-2 border-b border-slate-200 dark:border-slate-700/50 scroll-mt-6 flex items-center gap-2"
                      >
                        <span className="p-1.5 bg-cyan-50 dark:bg-cyan-500/10 rounded-md text-cyan-600 dark:text-cyan-400">
                          {getSectionIcon(text)}
                        </span>
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                    return (
                      <h3
                        id={id}
                        className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 mt-8 scroll-mt-6"
                      >
                        {children}
                      </h3>
                    );
                  },
                  h4: ({ children }) => (
                    <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-2 mt-6">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 my-4 ml-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-2 my-4 ml-1 list-decimal list-inside">
                      {children}
                    </ol>
                  ),
                  li: ({ children, ordered }: { children?: React.ReactNode; ordered?: boolean }) => (
                    <li className="text-slate-600 dark:text-slate-400 flex items-start gap-2">
                      {!ordered && (
                        <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2 flex-shrink-0" />
                      )}
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
                    const isBlock = className?.includes('language-');

                    if (isBlock) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }

                    return (
                      <code className="bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded text-[13px] font-mono">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => {
                    const codeElement = (children as React.ReactElement<{ children?: string }>)?.props?.children;
                    const codeString = String(codeElement || '').replace(/\n$/, '');

                    return (
                      <div className="my-4 group relative">
                        <button
                          onClick={() => copyCode(codeString)}
                          aria-label={copiedCode === codeString ? 'Code copied' : 'Copy code to clipboard'}
                          className="absolute right-2 top-2 p-1.5 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          {copiedCode === codeString ? (
                            <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
                          ) : (
                            <Copy className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                        <pre className="bg-slate-900 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 overflow-x-auto text-sm text-slate-300">
                          {children}
                        </pre>
                      </div>
                    );
                  },
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/30 hover:decoration-cyan-500 transition-colors inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                    >
                      {children}
                      <ExternalLink className="w-3 h-3 opacity-50" aria-hidden="true" />
                    </a>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-slate-900 dark:text-white font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-slate-700 dark:text-slate-300 italic">{children}</em>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-cyan-500 bg-cyan-50/50 dark:bg-cyan-500/5 pl-4 pr-4 py-3 my-4 text-slate-600 dark:text-slate-400 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/50 text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/30 bg-white dark:bg-slate-800/20">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {children}
                    </td>
                  ),
                  hr: () => (
                    <hr className="my-8 border-slate-200 dark:border-slate-700/50" />
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </article>
          )}

          {/* Footer */}
          {!loading && !error && (
            <footer className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
                <p>Lumen Network Intelligence Platform</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={scrollToTop}
                    aria-label="Back to top of page"
                    className="flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-2 py-1"
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    Back to top
                  </button>
                </div>
              </div>
            </footer>
          )}
        </div>
      </main>
    </div>
  );
}
