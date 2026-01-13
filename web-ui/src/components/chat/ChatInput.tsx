'use client';

import { useState, useCallback, useRef, useEffect, memo, forwardRef, useImperativeHandle } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChatInputProps {
  onSend: (message: string) => void;
  onEditLast?: () => string | undefined;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  isLoading?: boolean;
  className?: string;
}

export interface ChatInputRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
}

// ============================================================================
// ChatInput Component
// ============================================================================

export const ChatInput = memo(forwardRef<ChatInputRef, ChatInputProps>(({
  onSend,
  onEditLast,
  onStop,
  disabled = false,
  placeholder = "Ask a question about your network...",
  maxLength = 4000,
  isLoading = false,
  className = '',
}, ref) => {
  const [value, setValue] = useState('');
  const [rows, setRows] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => setValue(''),
    setValue: (newValue: string) => setValue(newValue),
  }));

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const lineCount = (value.match(/\n/g) || []).length + 1;
      const newRows = Math.min(Math.max(lineCount, 1), 6);
      setRows(newRows);
    }
  }, [value]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && !disabled && !isLoading) {
      onSend(trimmedValue);
      setValue('');
      setRows(1);
    }
  }, [value, disabled, isLoading, onSend]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without shift - send message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Up arrow at start of empty input - edit last message
    if (e.key === 'ArrowUp' && value === '' && onEditLast) {
      e.preventDefault();
      const lastMessage = onEditLast();
      if (lastMessage) {
        setValue(lastMessage);
      }
      return;
    }

    // Escape - blur input
    if (e.key === 'Escape') {
      textareaRef.current?.blur();
      return;
    }
  }, [value, handleSubmit, onEditLast]);

  // Character count display
  const charCount = value.length;
  const showCharCount = charCount > maxLength * 0.8;
  const isOverLimit = charCount > maxLength;

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/50">
        {/* Textarea container */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={rows}
            className={`w-full px-4 py-2.5 rounded-xl border resize-none transition-all
              bg-slate-50 dark:bg-slate-900/50
              text-slate-900 dark:text-white text-sm
              placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isOverLimit
                ? 'border-red-500 dark:border-red-500'
                : 'border-slate-200 dark:border-slate-700'
              }`}
            aria-label="Message input"
          />

          {/* Character count - positioned inside textarea area */}
          {showCharCount && (
            <span className={`absolute bottom-2 right-3 text-[10px] ${isOverLimit ? 'text-red-500' : 'text-slate-400'}`}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>

        {/* Stop button - shown when streaming and onStop provided */}
        {isLoading && onStop ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 p-2.5 rounded-xl transition-all
              bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400
              hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400
              hover:scale-105"
            aria-label="Stop generation"
            title="Stop generation"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          /* Send button - vertically centered */
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || disabled || isLoading || isOverLimit}
            className={`flex-shrink-0 p-2.5 rounded-xl transition-all
              ${value.trim() && !disabled && !isLoading && !isOverLimit
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md hover:shadow-lg hover:scale-105'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            aria-label="Send message"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}));

ChatInput.displayName = 'ChatInput';

export default ChatInput;
