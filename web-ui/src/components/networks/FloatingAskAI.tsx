'use client';

import { memo, useState } from 'react';
import { Sparkles, X, ChevronRight, MessageSquare } from 'lucide-react';

export interface FloatingAskAIProps {
  onNavigateToChat: (context?: string) => void;
}

const quickQuestions = [
  'Show me all offline devices',
  'What networks have the most issues?',
  'Summarize device health',
];

export const FloatingAskAI = memo(({ onNavigateToChat }: FloatingAskAIProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="relative">
        {/* Expanded Panel */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-white text-sm">Ask AI Assistant</h4>
                <p className="text-[11px] text-cyan-100 mt-0.5">Ask questions about your network</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-1.5">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => {
                    onNavigateToChat(question);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/40 text-sm text-slate-700 dark:text-slate-300 transition-all flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {question}
                </button>
              ))}

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
                <button
                  onClick={() => {
                    onNavigateToChat();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
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
              ? 'bg-slate-600 hover:bg-slate-700 rotate-90'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 hover:shadow-xl hover:scale-105'
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
