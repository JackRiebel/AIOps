'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
}

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
  commands?: Command[];
}

const defaultCommands: Command[] = [
  { id: 'networks', label: 'Show Networks', icon: '🌐', shortcut: 'N' },
  { id: 'devices', label: 'Show Devices', icon: '📱', shortcut: 'D' },
  { id: 'alerts', label: 'Show Alerts', icon: '🔔', shortcut: 'A' },
  { id: 'flow', label: 'Toggle Agent Flow', icon: '⚡', shortcut: 'F' },
  { id: 'clear', label: 'Clear Chat', icon: '🗑️', shortcut: 'C' },
];

export function CommandBar({
  isOpen,
  onClose,
  onCommand,
  commands = defaultCommands,
}: CommandBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (commandId: string) => {
    onCommand(commandId);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredCommands.length > 0) {
      handleSelect(filteredCommands[0].id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            aria-label="Search commands"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="text-lg" aria-hidden="true">{cmd.icon}</span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 text-left">
                  {cmd.label}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
              No commands found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
