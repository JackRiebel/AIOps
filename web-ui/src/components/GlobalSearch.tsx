'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'page' | 'network' | 'device' | 'incident';
  title: string;
  subtitle?: string;
  icon: string;
  href?: string;
  action?: () => void;
}

const PAGES: SearchResult[] = [
  { id: 'dashboard', type: 'page', title: 'Dashboard', subtitle: 'Overview and metrics', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/' },
  { id: 'network', type: 'page', title: 'AI Network Manager', subtitle: 'AI-powered network assistant', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', href: '/chat-v2' },
  { id: 'incidents', type: 'page', title: 'Incident Timeline', subtitle: 'View and manage incidents', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', href: '/incidents' },
  { id: 'networks', type: 'page', title: 'Networks & Devices', subtitle: 'Meraki network management', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01', href: '/networks' },
  { id: 'thousandeyes', type: 'page', title: 'ThousandEyes', subtitle: 'Network monitoring', icon: 'M13 10V3L4 14h7v7l9-11h-7z', href: '/thousandeyes' },
  { id: 'splunk', type: 'page', title: 'Splunk Logs', subtitle: 'Log analysis', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/splunk' },
  { id: 'costs', type: 'page', title: 'AI Cost & ROI', subtitle: 'Usage and spending', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', href: '/costs' },
  { id: 'visualizations', type: 'page', title: 'Visualizations', subtitle: 'Network topology and charts', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', href: '/visualizations' },
  { id: 'security', type: 'page', title: 'Security', subtitle: 'Credentials management', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', href: '/security' },
  { id: 'ai-settings', type: 'page', title: 'AI Settings', subtitle: 'Model and API configuration', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', href: '/ai-settings' },
  { id: 'audit', type: 'page', title: 'Audit Logs', subtitle: 'API operation history', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/audit' },
  { id: 'health', type: 'page', title: 'System Health', subtitle: 'Backend status', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', href: '/health' },
  { id: 'docs', type: 'page', title: 'Documentation', subtitle: 'Help and guides', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', href: '/docs' },
  { id: 'organizations', type: 'page', title: 'Organizations', subtitle: 'Meraki organizations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', href: '/organizations' },
  { id: 'licenses', type: 'page', title: 'Licenses', subtitle: 'License management', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/licenses' },
];

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>(PAGES);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGES);
    } else {
      const filtered = PAGES.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    }
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            const result = results[selectedIndex];
            if (result.href) {
              router.push(result.href);
            } else if (result.action) {
              result.action();
            }
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [results, selectedIndex, router, onClose]
  );

  const handleResultClick = (result: SearchResult) => {
    if (result.href) {
      router.push(result.href);
    } else if (result.action) {
      result.action();
    }
    onClose();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page':
        return 'Page';
      case 'network':
        return 'Network';
      case 'device':
        return 'Device';
      case 'incident':
        return 'Incident';
      default:
        return type;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        <div
          className="w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, networks, devices..."
              className="flex-1 bg-transparent text-sm theme-text-primary placeholder:theme-text-muted focus:outline-none"
            />
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-12 h-12 theme-text-muted mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm theme-text-muted">No results found for &quot;{query}&quot;</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-cyan-500/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        index === selectedIndex
                          ? 'bg-cyan-500/20 text-cyan-500'
                          : 'bg-slate-100 dark:bg-slate-800 theme-text-muted'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={result.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${index === selectedIndex ? 'text-cyan-500' : 'theme-text-primary'}`}>
                        {result.title}
                      </p>
                      {result.subtitle && (
                        <p className="text-xs theme-text-muted truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded theme-text-muted" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      {getTypeLabel(result.type)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
