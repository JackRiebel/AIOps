'use client';

import { useRef, useEffect, useCallback, memo, useState } from 'react';
import { ChevronDown, Plus, Copy, Trash2, MoreVertical, Layers, MessageSquare, Check, Pencil, X } from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { ChatInput, type ChatInputRef } from './ChatInput';
import { StreamingIndicator, type StreamingStatus, type AgentActivityInfo } from './StreamingIndicator';
import { SessionMetricsIndicator } from './SessionMetricsIndicator';
import type { ChatSession, CanvasSuggestion, CanvasCard, SessionListItem, SessionMetrics } from '@/types/session';
import type { Organization } from '@/types';
import type { ModelInfo } from '@/types/agent-flow';

/**
 * ChatSidebar - Fixed-width chat sidebar component
 *
 * Displays chat messages in a narrow sidebar format.
 * Follows "Show, Don't Tell" philosophy - minimal labels, quiet metadata.
 * Includes session selector and org filter in header.
 */

// ============================================================================
// Types
// ============================================================================

export interface ChatSidebarProps {
  /** Current session (provides name and messages) */
  session: ChatSession | null;
  /** Handler for sending new messages - optional messageData for card context etc. */
  onSendMessage: (message: string, messageData?: Record<string, unknown>) => void;
  /** Handler for canvas suggestions */
  onCanvasSuggestion?: (suggestion: CanvasSuggestion) => void;
  /** Handler when user clicks to add a card to canvas */
  onAddCard?: (card: CanvasCard) => void;
  /** Whether streaming is in progress */
  isStreaming?: boolean;
  /** Handler to stop/cancel streaming */
  onStop?: () => void;
  /** Current streaming status */
  streamingStatus?: StreamingStatus;
  /** Tool name if currently calling a tool */
  streamingToolName?: string;
  /** Agent activity info */
  agentActivity?: AgentActivityInfo;
  /** Streaming content for real-time display */
  streamingContent?: string;
  /** Model info from streaming */
  modelInfo?: ModelInfo;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Session management props */
  sessions?: SessionListItem[];
  onNewSession?: () => void;
  onLoadSession?: (sessionId: string) => void;
  onDuplicateSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newName: string) => void;
  /** Organization filter props */
  organizations?: Organization[];
  selectedOrgs?: string[];
  onOrgsChange?: (orgs: string[]) => void;
  /** Network filter props */
  networks?: { id: string; name: string }[];
  selectedNetwork?: string;
  onNetworkChange?: (networkId: string) => void;
  networksLoading?: boolean;
  /** Canvas toggle */
  canvasEnabled?: boolean;
  onCanvasToggle?: () => void;
  /** Edit mode toggle - allows write/update/delete operations */
  editMode?: boolean;
  onEditModeToggle?: () => void;
  /** Verbosity level for AI responses */
  verbosity?: 'brief' | 'standard' | 'detailed';
  onVerbosityChange?: (verbosity: 'brief' | 'standard' | 'detailed') => void;
  /** Optional input prefill text (e.g., from card context) */
  inputPrefill?: string;
  /** Called when prefill has been applied */
  onPrefillApplied?: () => void;
  /** Card context for AI (networkId, deviceSerial, orgId from "Ask about this" feature) */
  cardContext?: Record<string, string>;
  /** Called after card context has been used in a message */
  onCardContextUsed?: () => void;
}

// ============================================================================
// Empty State Component (Minimal, no instructional text)
// ============================================================================

const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-full text-center px-4">
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center mb-3">
      <svg className="w-6 h-6 text-cyan-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
    {/* No instructional text - just a subtle visual */}
  </div>
));

EmptyState.displayName = 'EmptyState';

// ============================================================================
// Messages List Component
// ============================================================================

interface MessagesListProps {
  messages: Message[];
  streamingContent?: string;
  onCanvasSuggestion?: (suggestion: CanvasSuggestion) => void;
  onAddCard?: (card: CanvasCard) => void;
  existingCards?: CanvasCard[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MessagesList = memo(({
  messages,
  streamingContent,
  onAddCard,
  existingCards,
  messagesEndRef,
}: MessagesListProps) => {
  // Find the preceding user query for each assistant message
  const getSourceQuery = (msgIndex: number): string | undefined => {
    if (messages[msgIndex].role !== 'assistant') return undefined;
    // Look backwards for the last user message
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return undefined;
  };

  return (
    <>
      {messages.map((msg, index) => {
        // Find the index of the last assistant message for isLatestMessage prop
        const lastAssistantIndex = messages.reduce((lastIdx, m, i) =>
          m.role === 'assistant' ? i : lastIdx, -1);

        return (
          <ChatMessage
            key={`${msg.id}-${index}`}
            message={msg}
            showActions={false}
            onAddCard={onAddCard}
            existingCards={existingCards}
            sourceQuery={getSourceQuery(index)}
            isLatestMessage={msg.role === 'assistant' && index === lastAssistantIndex}
          />
        );
      })}

      {/* Streaming message placeholder */}
      {streamingContent && (
        <ChatMessage
          key="streaming"
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            isStreaming: true,
          }}
          showActions={false}
        />
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </>
  );
});

MessagesList.displayName = 'MessagesList';

// ============================================================================
// Session Dropdown Component
// ============================================================================

interface SessionDropdownProps {
  currentSessionName: string;
  currentSessionId?: string;
  sessions: SessionListItem[];
  onNewSession: () => void;
  onLoadSession: (sessionId: string) => void;
  onDuplicateSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newName: string) => void;
}

const SessionDropdown = memo(({
  currentSessionName,
  currentSessionId,
  sessions,
  onNewSession,
  onLoadSession,
  onDuplicateSession,
  onDeleteSession,
  onRenameSession,
}: SessionDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
        setEditingSessionId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const formatTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const startEditing = (sessionId: string, name: string) => {
    setEditingSessionId(sessionId);
    setEditName(name);
    setIsEditing(true);
  };

  const handleRename = () => {
    if (editingSessionId && editName.trim() && onRenameSession) {
      onRenameSession(editingSessionId, editName.trim());
    }
    setIsEditing(false);
    setEditingSessionId(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingSessionId(null);
    setEditName('');
  };

  // Handle editing current session name (inline in header)
  const startEditingCurrent = () => {
    if (currentSessionId) {
      setEditName(currentSessionName);
      setIsEditing(true);
      setEditingSessionId(currentSessionId);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative flex-1 min-w-0">
      {/* Header - Session Name or Edit Input */}
      {isEditing && editingSessionId === currentSessionId ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={editInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') cancelEditing();
            }}
            className="flex-1 text-sm font-medium bg-slate-700 text-slate-200 px-2 py-1 rounded border border-cyan-500 focus:outline-none min-w-0"
            placeholder="Session name..."
          />
          <button
            onClick={handleRename}
            className="p-1 rounded hover:bg-slate-700 text-cyan-500"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={cancelEditing}
            className="p-1 rounded hover:bg-slate-700 text-slate-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 group">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 max-w-full min-w-0"
          >
            <span className="text-sm font-medium text-slate-200 truncate">
              {currentSessionName}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {onRenameSession && (
            <button
              onClick={startEditingCurrent}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Rename session"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
          {/* New Session */}
          <button
            onClick={() => { onNewSession(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-700/50 border-b border-slate-700"
          >
            <Plus className="w-4 h-4 text-cyan-500" />
            <span className="text-sm text-slate-200">New Session</span>
          </button>

          {/* Sessions List */}
          <div className="max-h-[300px] overflow-y-auto">
            {sessions.slice(0, 15).map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer ${
                  s.id === currentSessionId
                    ? 'bg-cyan-900/20'
                    : 'hover:bg-slate-700/50'
                }`}
                onClick={() => {
                  if (editingSessionId !== s.id) {
                    onLoadSession(s.id);
                    setIsOpen(false);
                  }
                }}
              >
                {/* Session Name - Editable */}
                <div className="flex-1 min-w-0">
                  {editingSessionId === s.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') handleRename();
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-1 text-sm bg-slate-700 text-slate-200 px-2 py-0.5 rounded border border-cyan-500 focus:outline-none min-w-0"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRename(); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-cyan-500"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelEditing(); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-slate-200 truncate">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{formatTime(s.updatedAt)}</div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                {editingSessionId !== s.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRenameSession && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(s.id, s.name); }}
                        className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-300"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {onDuplicateSession && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDuplicateSession(s.id); }}
                        className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-300"
                        title="Duplicate"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                    {onDeleteSession && s.id !== currentSessionId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                        className="p-1 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

SessionDropdown.displayName = 'SessionDropdown';

// ============================================================================
// Settings Menu Component (Org filter + Canvas toggle)
// ============================================================================

interface SettingsMenuProps {
  organizations: Organization[];
  selectedOrgs: string[];
  onOrgsChange: (orgs: string[]) => void;
  networks: { id: string; name: string }[];
  selectedNetwork: string;
  onNetworkChange: (networkId: string) => void;
  networksLoading: boolean;
  canvasEnabled: boolean;
  onCanvasToggle: () => void;
  editMode?: boolean;
  onEditModeToggle?: () => void;
  verbosity?: 'brief' | 'standard' | 'detailed';
  onVerbosityChange?: (verbosity: 'brief' | 'standard' | 'detailed') => void;
}

const SettingsMenu = memo(({
  organizations,
  selectedOrgs,
  onOrgsChange,
  networks,
  selectedNetwork,
  onNetworkChange,
  networksLoading,
  canvasEnabled,
  onCanvasToggle,
  editMode,
  onEditModeToggle,
  verbosity,
  onVerbosityChange,
}: SettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = selectedOrgs.length === 0 || selectedOrgs.length === organizations.length;

  const toggleOrg = (orgName: string) => {
    if (allSelected) {
      // Select only this org
      onOrgsChange([orgName]);
    } else if (selectedOrgs.includes(orgName)) {
      // Deselect this org
      const newOrgs = selectedOrgs.filter(o => o !== orgName);
      onOrgsChange(newOrgs.length === 0 ? [] : newOrgs); // Empty = all
    } else {
      // Add this org
      onOrgsChange([...selectedOrgs, orgName]);
    }
  };

  const selectAll = () => {
    onOrgsChange([]);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
          {/* Canvas Toggle */}
          <button
            onClick={() => { onCanvasToggle(); setIsOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700/50 border-b border-slate-700"
          >
            {canvasEnabled ? (
              <Layers className="w-4 h-4 text-cyan-500" />
            ) : (
              <MessageSquare className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-sm text-slate-200">
              {canvasEnabled ? 'Hide Canvas' : 'Show Canvas'}
            </span>
          </button>

          {/* Edit Mode Toggle */}
          {onEditModeToggle && (
            <button
              onClick={() => { onEditModeToggle(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-700/50 border-b border-slate-700"
            >
              {editMode ? (
                <Pencil className="w-4 h-4 text-amber-500" />
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              <span className="text-sm text-slate-200">
                {editMode ? 'Edit Mode (ON)' : 'Read-Only Mode'}
              </span>
              {editMode && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  WRITE
                </span>
              )}
            </button>
          )}

          {/* Verbosity Toggle */}
          {onVerbosityChange && (
            <div className="px-3 py-2.5 border-b border-slate-700">
              <span className="text-xs text-slate-400 mb-2 block">Response Detail</span>
              <div className="flex gap-1">
                {(['brief', 'standard', 'detailed'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => onVerbosityChange(level)}
                    className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                      verbosity === level
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Organization Filter */}
          {organizations.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide border-b border-slate-700">
                Organizations
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {/* All Orgs Option */}
                <button
                  onClick={selectAll}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/50"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    allSelected
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'border-slate-600'
                  }`}>
                    {allSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-slate-200">All Organizations</span>
                </button>

                {/* Individual Orgs */}
                {organizations.map((org) => {
                  const isSelected = !allSelected && selectedOrgs.includes(org.name);
                  return (
                    <button
                      key={org.id}
                      onClick={() => toggleOrg(org.name)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/50"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-slate-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-slate-200 truncate">
                        {org.display_name || org.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Network Filter - only show when single org selected */}
          {selectedOrgs.length === 1 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide border-t border-slate-700 mt-1">
                Network
              </div>
              <div className="max-h-[150px] overflow-y-auto">
                {networksLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-400">Loading networks...</div>
                ) : networks.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No networks available</div>
                ) : (
                  networks.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => onNetworkChange(network.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/50"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedNetwork === network.id
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-slate-600'
                      }`}>
                        {selectedNetwork === network.id && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm text-slate-200 truncate">{network.name}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

SettingsMenu.displayName = 'SettingsMenu';

// ============================================================================
// Main ChatSidebar Component
// ============================================================================

export const ChatSidebar = memo(({
  session,
  onSendMessage,
  onCanvasSuggestion,
  onAddCard,
  isStreaming = false,
  onStop,
  streamingStatus = 'idle',
  streamingToolName,
  agentActivity,
  streamingContent,
  modelInfo,
  disabled = false,
  placeholder = 'Ask anything...',
  className = '',
  // Session management
  sessions = [],
  onNewSession,
  onLoadSession,
  onDuplicateSession,
  onDeleteSession,
  onRenameSession,
  // Organization filter
  organizations = [],
  selectedOrgs = [],
  onOrgsChange,
  // Network filter
  networks = [],
  selectedNetwork = '',
  onNetworkChange,
  networksLoading = false,
  // Canvas toggle
  canvasEnabled = true,
  onCanvasToggle,
  // Edit mode toggle
  editMode = false,
  onEditModeToggle,
  // Verbosity setting
  verbosity = 'standard',
  onVerbosityChange,
  // Input prefill from card context
  inputPrefill,
  onPrefillApplied,
  // Card context for AI queries (networkId, deviceSerial, etc.)
  cardContext,
  onCardContextUsed,
}: ChatSidebarProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputRef>(null);

  const messages = session?.messages ?? [];

  // Auto-scroll to bottom when messages change or streaming content updates
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Handle edit last message
  const handleEditLast = useCallback((): string | undefined => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    return lastUserMessage?.content;
  }, [messages]);

  // Handle sending message with card context
  const handleSend = useCallback((message: string) => {
    // If we have card context (from "Ask about this" on a canvas card),
    // include it in the message data so the AI knows which network/device
    if (cardContext && Object.keys(cardContext).length > 0) {
      onSendMessage(message, { cardContext });
      onCardContextUsed?.();
    } else {
      onSendMessage(message);
    }
  }, [onSendMessage, cardContext, onCardContextUsed]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Apply input prefill when it changes (e.g., from card context)
  useEffect(() => {
    if (inputPrefill) {
      inputRef.current?.setValue(inputPrefill);
      inputRef.current?.focus();
      onPrefillApplied?.();
    }
  }, [inputPrefill, onPrefillApplied]);

  const isEmpty = messages.length === 0 && !streamingContent;

  return (
    <div className={`flex flex-col h-full bg-slate-800 dark:bg-slate-800 border-r border-slate-700/50 dark:border-slate-700/50 ${className}`}>
      {/* Header with Session Selector and Settings */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-700/50">
        {/* Session Selector - takes remaining space */}
        {onNewSession && onLoadSession ? (
          <SessionDropdown
            currentSessionName={session?.name || 'New Session'}
            currentSessionId={session?.id}
            sessions={sessions}
            onNewSession={onNewSession}
            onLoadSession={onLoadSession}
            onDuplicateSession={onDuplicateSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {session?.name || 'New Session'}
          </span>
        )}

        {/* Model Badge - shows during/after streaming */}
        {modelInfo && (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 whitespace-nowrap">
            {modelInfo.modelId.replace('claude-', '').replace('-20250929', '').replace('-20241022', '')}
          </span>
        )}

        {/* Session Metrics - tokens and cost */}
        <SessionMetricsIndicator metrics={session?.metrics} compact={true} />

        {/* Persistent Edit Mode Indicator */}
        {editMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-medium text-amber-400">EDIT</span>
          </div>
        )}

        {/* Settings Menu (Org filter + Canvas toggle + Edit mode + Verbosity) */}
        {onOrgsChange && onCanvasToggle && (
          <SettingsMenu
            organizations={organizations}
            selectedOrgs={selectedOrgs}
            onOrgsChange={onOrgsChange}
            networks={networks}
            selectedNetwork={selectedNetwork}
            onNetworkChange={onNetworkChange || (() => {})}
            networksLoading={networksLoading}
            canvasEnabled={canvasEnabled}
            onCanvasToggle={onCanvasToggle}
            editMode={editMode}
            onEditModeToggle={onEditModeToggle}
            verbosity={verbosity}
            onVerbosityChange={onVerbosityChange}
          />
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <MessagesList
            messages={messages}
            streamingContent={streamingContent}
            onCanvasSuggestion={onCanvasSuggestion}
            onAddCard={onAddCard}
            existingCards={session?.canvasCards}
            messagesEndRef={messagesEndRef}
          />
        )}

        {/* Streaming Indicator */}
        {isStreaming && streamingStatus !== 'idle' && !streamingContent && (
          <StreamingIndicator
            status={streamingStatus}
            toolName={streamingToolName}
            agentActivity={agentActivity}
          />
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/50">
        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          onEditLast={handleEditLast}
          onStop={onStop}
          disabled={disabled}
          isLoading={isStreaming}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
});

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;
