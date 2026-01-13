'use client';

import { memo, useState } from 'react';
import { Sparkles, X, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FloatingAskAIProps {
  onNavigateToChat: (context?: string) => void;
}

// ============================================================================
// Quick Questions
// ============================================================================

const quickQuestions = [
  'Show me all offline devices',
  'What networks have the most issues?',
  'Summarize device health',
];

// ============================================================================
// FloatingAskAI Component
// ============================================================================

export const FloatingAskAI = memo(({ onNavigateToChat }: FloatingAskAIProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="relative">
        {/* Expanded Panel */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
              <h4 className="font-semibold">Ask AI Assistant</h4>
              <p className="text-xs text-cyan-100 mt-0.5">Ask questions about your network</p>
            </div>

            {/* Quick Questions */}
            <div className="p-4 space-y-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => {
                    onNavigateToChat(question);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-sm text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {question}
                </button>
              ))}

              {/* Divider */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <button
                  onClick={() => {
                    onNavigateToChat();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Open AI Chat
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isOpen
              ? 'bg-slate-600 hover:bg-slate-700'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Sparkles className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
});

FloatingAskAI.displayName = 'FloatingAskAI';

export default FloatingAskAI;
