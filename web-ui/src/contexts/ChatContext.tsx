'use client';

/**
 * Chat Context for managing conversation state.
 *
 * This context provides unified chat state management, streaming handling,
 * and integration with artifacts and session tracking.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAISession } from './AISessionContext';
import { useArtifacts, type Artifact } from './ArtifactContext';

/**
 * Token usage information.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Tool call information.
 */
export interface ToolCall {
  id: string;
  name: string;
  inputs?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Chat message structure.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  artifactIds?: number[];
  usage?: TokenUsage;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  isStreaming?: boolean;
  model?: string;
}

/**
 * Chat state structure.
 */
interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  streamSequence: number;
  currentModel: string;
  organization: string;
  editMode: boolean;
}

/**
 * Chat actions.
 */
type ChatAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMessage> }
  | { type: 'APPEND_TEXT'; id: string; text: string }
  | { type: 'ADD_TOOL_CALL'; messageId: string; toolCall: ToolCall }
  | { type: 'UPDATE_TOOL_CALL'; messageId: string; toolId: string; updates: Partial<ToolCall> }
  | { type: 'ADD_ARTIFACT_ID'; messageId: string; artifactId: number }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_ORGANIZATION'; organization: string }
  | { type: 'SET_EDIT_MODE'; editMode: boolean }
  | { type: 'CLEAR' };

/**
 * Chat reducer.
 */
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, ...action.updates } : m
        ),
      };

    case 'APPEND_TEXT':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, content: m.content + action.text } : m
        ),
      };

    case 'ADD_TOOL_CALL':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, toolCalls: [...(m.toolCalls || []), action.toolCall] }
            : m
        ),
      };

    case 'UPDATE_TOOL_CALL':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? {
                ...m,
                toolCalls: m.toolCalls?.map((tc) =>
                  tc.id === action.toolId ? { ...tc, ...action.updates } : tc
                ),
              }
            : m
        ),
      };

    case 'ADD_ARTIFACT_ID':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId
            ? { ...m, artifactIds: [...(m.artifactIds || []), action.artifactId] }
            : m
        ),
      };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_MODEL':
      return { ...state, currentModel: action.model };

    case 'SET_ORGANIZATION':
      return { ...state, organization: action.organization };

    case 'SET_EDIT_MODE':
      return { ...state, editMode: action.editMode };

    case 'CLEAR':
      return {
        ...state,
        messages: [],
        isStreaming: false,
        error: null,
        streamSequence: 0,
      };

    default:
      return state;
  }
}

/**
 * Chat context type.
 */
interface ChatContextType {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  clearChat: () => void;
  setModel: (model: string) => void;
  setOrganization: (org: string) => void;
  setEditMode: (editMode: boolean) => void;
  cancelStream: () => void;
}

/**
 * Chat context.
 */
const ChatContext = createContext<ChatContextType | undefined>(undefined);

/**
 * Default state.
 */
const defaultState: ChatState = {
  messages: [],
  isStreaming: false,
  error: null,
  streamSequence: 0,
  currentModel: 'claude-sonnet-4-5-20250929',
  organization: 'All',
  editMode: false,
};

/**
 * Chat provider props.
 */
interface ChatProviderProps {
  children: ReactNode;
  sessionId?: number;
  initialModel?: string;
  initialOrganization?: string;
}

/**
 * Chat provider component.
 */
export function ChatProvider({
  children,
  sessionId,
  initialModel = 'claude-sonnet-4-5-20250929',
  initialOrganization = 'All',
}: ChatProviderProps) {
  const [state, dispatch] = useReducer(chatReducer, {
    ...defaultState,
    currentModel: initialModel,
    organization: initialOrganization,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Get AI session context - use a wrapper to avoid try/catch type narrowing issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiSessionResult = (() => {
    try {
      return useAISession();
    } catch {
      return null;
    }
  })();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiSession = aiSessionResult as { logAIQuery?: (...args: any[]) => void } | null;

  // Get artifacts context - use a wrapper to avoid try/catch type narrowing issues
  const artifactsResult = (() => {
    try {
      return useArtifacts();
    } catch {
      return null;
    }
  })();
  const artifactsContext = artifactsResult as { addArtifact?: (artifact: Artifact) => void } | null;

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: 'SET_STREAMING', isStreaming: false });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMsgId = `user-${Date.now()}`;
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: userMsgId,
          role: 'user',
          content,
          timestamp: new Date(),
          status: 'complete',
        },
      });

      // Add assistant message placeholder
      const assistantMsgId = `assistant-${Date.now()}`;
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          status: 'streaming',
          isStreaming: true,
          toolCalls: [],
          artifactIds: [],
        },
      });

      dispatch({ type: 'SET_STREAMING', isStreaming: true });
      dispatch({ type: 'SET_ERROR', error: null });

      const startTime = Date.now();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            message: content,
            history: state.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            organization: state.organization,
            session_id: sessionId,
            edit_mode: state.editMode,
            model: state.currentModel,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));

                switch (event.type) {
                  case 'text_delta':
                    dispatch({
                      type: 'APPEND_TEXT',
                      id: assistantMsgId,
                      text: event.text || '',
                    });
                    break;

                  case 'tool_start':
                    dispatch({
                      type: 'ADD_TOOL_CALL',
                      messageId: assistantMsgId,
                      toolCall: {
                        id: event.tool_id,
                        name: event.tool,
                        inputs: event.inputs,
                        status: 'running',
                      },
                    });
                    break;

                  case 'tool_result':
                    dispatch({
                      type: 'UPDATE_TOOL_CALL',
                      messageId: assistantMsgId,
                      toolId: event.tool_id,
                      updates: {
                        status: event.success ? 'success' : 'error',
                        result: event.result,
                        error: event.error,
                        executionTimeMs: event.execution_time_ms,
                      },
                    });
                    break;

                  case 'artifact_create':
                    // Add artifact through context if available
                    if (artifactsContext?.addArtifact) {
                      artifactsContext.addArtifact({
                        id: event.artifact_id,
                        type: event.artifact_type,
                        title: event.title,
                        content: event.content,
                        version: 1,
                        createdAt: new Date().toISOString(),
                      });
                    }
                    dispatch({
                      type: 'ADD_ARTIFACT_ID',
                      messageId: assistantMsgId,
                      artifactId: event.artifact_id,
                    });
                    break;

                  case 'done':
                    totalInputTokens = event.usage?.input_tokens || 0;
                    totalOutputTokens = event.usage?.output_tokens || 0;

                    dispatch({
                      type: 'UPDATE_MESSAGE',
                      id: assistantMsgId,
                      updates: {
                        status: 'complete',
                        isStreaming: false,
                        usage: {
                          inputTokens: totalInputTokens,
                          outputTokens: totalOutputTokens,
                          totalTokens: totalInputTokens + totalOutputTokens,
                        },
                        model: event.model,
                      },
                    });
                    break;

                  case 'error':
                    dispatch({
                      type: 'UPDATE_MESSAGE',
                      id: assistantMsgId,
                      updates: { status: 'error', isStreaming: false },
                    });
                    dispatch({ type: 'SET_ERROR', error: event.error });
                    break;

                  case 'cancel':
                    dispatch({
                      type: 'UPDATE_MESSAGE',
                      id: assistantMsgId,
                      updates: { status: 'complete', isStreaming: false },
                    });
                    break;
                }
              } catch {
                // Ignore JSON parse errors for partial data
              }
            }
          }
        }

        // Log to AI session if available
        if (aiSession?.logAIQuery) {
          const finalMessage = state.messages.find((m) => m.id === assistantMsgId);
          if (finalMessage) {
            aiSession.logAIQuery(
              content,
              finalMessage.content,
              state.currentModel,
              totalInputTokens,
              totalOutputTokens,
              { durationMs: Date.now() - startTime }
            );
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          dispatch({
            type: 'UPDATE_MESSAGE',
            id: assistantMsgId,
            updates: { status: 'complete', isStreaming: false },
          });
        } else {
          dispatch({ type: 'SET_ERROR', error: String(error) });
          dispatch({
            type: 'UPDATE_MESSAGE',
            id: assistantMsgId,
            updates: { status: 'error', isStreaming: false },
          });
        }
      } finally {
        dispatch({ type: 'SET_STREAMING', isStreaming: false });
        abortControllerRef.current = null;
      }
    },
    [state.messages, state.organization, state.editMode, state.currentModel, sessionId, aiSession, artifactsContext]
  );

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = state.messages.find((m) => m.id === messageId);
      if (message?.role === 'user') {
        await sendMessage(message.content);
      }
    },
    [state.messages, sendMessage]
  );

  const setModel = useCallback((model: string) => {
    dispatch({ type: 'SET_MODEL', model });
  }, []);

  const setOrganization = useCallback((organization: string) => {
    dispatch({ type: 'SET_ORGANIZATION', organization });
  }, []);

  const setEditMode = useCallback((editMode: boolean) => {
    dispatch({ type: 'SET_EDIT_MODE', editMode });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        sendMessage,
        retryMessage,
        clearChat,
        setModel,
        setOrganization,
        setEditMode,
        cancelStream,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Hook to access the chat context.
 */
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}

export default ChatContext;
