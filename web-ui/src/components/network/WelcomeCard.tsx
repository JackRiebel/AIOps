'use client';

import { Lightbulb } from 'lucide-react';

interface WelcomeCardProps {
  onSuggestionClick: (text: string) => void;
  suggestions?: string[];
}

const defaultSuggestions = [
  "Show me the status of all networks",
  "List devices with connectivity issues",
  "What alerts need attention?",
  "Configure a new guest SSID",
];

export function WelcomeCard({
  onSuggestionClick,
  suggestions = defaultSuggestions,
}: WelcomeCardProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-6">
        <Lightbulb className="w-10 h-10 text-cyan-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        AI Network Operations Center
      </h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
        Ask questions, run diagnostics, or manage your network using natural language.
        The Knowledge and Implementation agents work together to help you.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl w-full">
        {suggestions.map((text, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(text)}
            className="text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all text-sm text-slate-600 dark:text-slate-400"
          >
            <span className="text-cyan-500 mr-2">→</span>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
