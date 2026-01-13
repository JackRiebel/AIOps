'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Server,
  Bell,
  BarChart3,
  Search,
  Settings,
  HelpCircle,
  Trash2,
  RefreshCw,
  FileText,
  AlertTriangle,
  Activity,
  Globe,
} from 'lucide-react';

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'query' | 'action' | 'view' | 'utility';
  shortcut?: string;
  execute?: () => void;
}

interface SlashCommandMenuProps {
  isOpen: boolean;
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

// Default commands
export const defaultCommands: SlashCommand[] = [
  // Query commands
  {
    id: 'networks',
    name: 'networks',
    description: 'Show all networks and their status',
    icon: <Network className="w-4 h-4" />,
    category: 'query',
    shortcut: 'N',
  },
  {
    id: 'devices',
    name: 'devices',
    description: 'List all devices in the network',
    icon: <Server className="w-4 h-4" />,
    category: 'query',
    shortcut: 'D',
  },
  {
    id: 'alerts',
    name: 'alerts',
    description: 'Show active alerts and warnings',
    icon: <Bell className="w-4 h-4" />,
    category: 'query',
    shortcut: 'A',
  },
  {
    id: 'topology',
    name: 'topology',
    description: 'Display network topology diagram',
    icon: <Globe className="w-4 h-4" />,
    category: 'query',
  },
  {
    id: 'performance',
    name: 'performance',
    description: 'Show performance metrics and graphs',
    icon: <Activity className="w-4 h-4" />,
    category: 'query',
  },
  {
    id: 'issues',
    name: 'issues',
    description: 'Find devices with connectivity issues',
    icon: <AlertTriangle className="w-4 h-4" />,
    category: 'query',
  },

  // View commands
  {
    id: 'stats',
    name: 'stats',
    description: 'Display system statistics',
    icon: <BarChart3 className="w-4 h-4" />,
    category: 'view',
  },
  {
    id: 'logs',
    name: 'logs',
    description: 'View recent event logs',
    icon: <FileText className="w-4 h-4" />,
    category: 'view',
  },

  // Action commands
  {
    id: 'search',
    name: 'search',
    description: 'Search devices, networks, or configs',
    icon: <Search className="w-4 h-4" />,
    category: 'action',
    shortcut: '/',
  },
  {
    id: 'refresh',
    name: 'refresh',
    description: 'Refresh all data',
    icon: <RefreshCw className="w-4 h-4" />,
    category: 'action',
    shortcut: 'R',
  },

  // Utility commands
  {
    id: 'clear',
    name: 'clear',
    description: 'Clear chat history',
    icon: <Trash2 className="w-4 h-4" />,
    category: 'utility',
    shortcut: 'C',
  },
  {
    id: 'settings',
    name: 'settings',
    description: 'Open AI settings',
    icon: <Settings className="w-4 h-4" />,
    category: 'utility',
  },
  {
    id: 'help',
    name: 'help',
    description: 'Show available commands',
    icon: <HelpCircle className="w-4 h-4" />,
    category: 'utility',
    shortcut: '?',
  },
];

const categoryLabels: Record<string, string> = {
  query: 'Queries',
  action: 'Actions',
  view: 'Views',
  utility: 'Utility',
};

export function SlashCommandMenu({
  isOpen,
  query,
  onSelect,
  onClose,
  position,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    const searchTerm = query.startsWith('/') ? query.slice(1).toLowerCase() : query.toLowerCase();
    if (!searchTerm) return defaultCommands;

    return defaultCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(searchTerm) ||
        cmd.description.toLowerCase().includes(searchTerm)
    );
  }, [query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, SlashCommand[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = menuRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen || filteredCommands.length === 0) return null;

  let globalIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full mb-2 left-0 w-80 max-h-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
        style={position}
      >
        <div className="p-2 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          Slash Commands
        </div>
        <div className="max-h-64 overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                {categoryLabels[category] || category}
              </div>
              {commands.map((cmd) => {
                const currentIndex = globalIndex++;
                const isSelected = currentIndex === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    data-index={currentIndex}
                    onClick={() => onSelect(cmd)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-cyan-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span
                      className={`${
                        isSelected
                          ? 'text-cyan-600 dark:text-cyan-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cmd.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            isSelected
                              ? 'text-cyan-700 dark:text-cyan-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          /{cmd.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {cmd.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
