'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { MessageSquare, ChevronRight, ChevronLeft, Maximize2 } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export interface DashboardLayoutProps {
  children: React.ReactNode;
  chatPanel?: React.ReactNode;
  chatExpanded?: boolean;
  onToggleChat?: () => void;
  className?: string;
}

// ============================================================================
// DashboardLayout Component
// ============================================================================

export const DashboardLayout = memo(({
  children,
  chatPanel,
  chatExpanded = false,
  onToggleChat,
  className = '',
}: DashboardLayoutProps) => {
  const [localExpanded, setLocalExpanded] = useState(chatExpanded);

  // Sync with external state if provided
  useEffect(() => {
    setLocalExpanded(chatExpanded);
  }, [chatExpanded]);

  const handleToggle = useCallback(() => {
    if (onToggleChat) {
      onToggleChat();
    } else {
      setLocalExpanded(prev => !prev);
    }
  }, [onToggleChat]);

  const isExpanded = onToggleChat ? chatExpanded : localExpanded;

  // Only show chat elements if chatPanel is provided
  const showChat = !!chatPanel;

  return (
    <div className={`flex h-full overflow-hidden bg-slate-50 dark:bg-slate-900 ${className}`}>
      {/* Main Content Area */}
      <div
        className={`flex-1 overflow-auto transition-all duration-300 ease-in-out ${
          showChat && isExpanded ? 'mr-[400px]' : 'mr-0'
        }`}
      >
        {children}
      </div>

      {/* Chat Sidebar - only render if chatPanel is provided */}
      {showChat && (
        <>
          <aside
            className={`fixed right-0 top-0 bottom-0 z-40 flex flex-col transition-all duration-300 ease-in-out ${
              isExpanded ? 'w-[400px] translate-x-0' : 'w-[400px] translate-x-full'
            }`}
          >
            {/* Toggle Button - Positioned on edge */}
            <button
              onClick={handleToggle}
              className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-50 flex items-center justify-center w-8 h-16 bg-white dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                isExpanded ? '' : '-translate-x-8'
              }`}
              title={isExpanded ? 'Collapse chat' : 'Expand chat'}
              aria-label={isExpanded ? 'Collapse chat' : 'Expand chat'}
            >
              {isExpanded ? (
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              )}
            </button>

            {/* Chat Panel Container */}
            <div className="flex flex-col h-full bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">AI Assistant</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ask anything about your network</p>
                  </div>
                </div>
                <Link
                  href="/chat-v2"
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Open full chat view"
                >
                  <Maximize2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </Link>
              </div>

              {/* Chat Content */}
              <div className="flex-1 overflow-hidden">
                {chatPanel}
              </div>
            </div>
          </aside>

          {/* Collapsed Chat Toggle (when sidebar is hidden) */}
          {!isExpanded && (
            <button
              onClick={handleToggle}
              className="fixed right-4 bottom-4 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              aria-label="Open AI chat"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm font-medium">Ask AI</span>
            </button>
          )}
        </>
      )}
    </div>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;
