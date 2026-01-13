'use client';

/**
 * Hook for Splunk page AI interactions via the agent system.
 *
 * This hook provides a simple interface for AI analysis and SPL generation
 * that integrates with the multi-agent system and session tracking.
 *
 * Unlike useStreamingChat, this hook:
 * - Collects the full streaming response before returning
 * - Provides simple async functions for specific use cases
 * - Automatically logs AI queries to session tracking
 */

import { useState, useCallback } from 'react';
import { useAISession } from '@/contexts/AISessionContext';

export interface SplunkChatResult {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  tools_used?: string[];
  error?: string;
}

export interface UseSplunkChatReturn {
  analyzeInsight: (prompt: string, organization?: string) => Promise<SplunkChatResult>;
  generateSPL: (prompt: string, organization?: string) => Promise<SplunkChatResult>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Parse SSE events from a streaming response
 */
function parseSSEEvent(line: string): { type: string; data: any } | null {
  if (!line.startsWith('data: ')) return null;

  const jsonStr = line.slice(6); // Remove 'data: ' prefix
  if (jsonStr === '[DONE]') return { type: 'done', data: null };

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function useSplunkChat(): UseSplunkChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { session, logAIQuery } = useAISession();

  /**
   * Send a message to the agent system and collect the full response.
   */
  const sendMessage = useCallback(async (
    message: string,
    organization?: string
  ): Promise<SplunkChatResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          organization,
          session_id: session?.id?.toString(),
          max_turns: 1, // Single turn for analysis
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: Failed to get AI response`);
      }

      // Collect streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let content = '';
      let usage: { input_tokens: number; output_tokens: number } | undefined;
      let tools_used: string[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const event = parseSSEEvent(trimmedLine);
          if (!event) continue;

          switch (event.type) {
            case 'text_delta':
              if (event.data?.text) {
                content += event.data.text;
              }
              break;
            case 'tool_use_start':
              if (event.data?.tool && !tools_used.includes(event.data.tool)) {
                tools_used.push(event.data.tool);
              }
              break;
            case 'done':
              if (event.data?.usage) {
                usage = event.data.usage;
              }
              if (event.data?.tools_used) {
                tools_used = event.data.tools_used;
              }
              break;
            case 'error':
              throw new Error(event.data?.error || 'Unknown streaming error');
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const event = parseSSEEvent(buffer.trim());
        if (event?.type === 'text_delta' && event.data?.text) {
          content += event.data.text;
        }
      }

      // Log AI query to session tracking
      if (session && usage) {
        logAIQuery(
          message,
          content,
          'agent-orchestrator',
          usage.input_tokens,
          usage.output_tokens
        );
      }

      return { content, usage, tools_used };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI response';
      setError(errorMessage);
      return { content: '', error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [session, logAIQuery]);

  /**
   * Analyze a Splunk insight card using the agent system.
   */
  const analyzeInsight = useCallback(async (
    prompt: string,
    organization?: string
  ): Promise<SplunkChatResult> => {
    return sendMessage(prompt, organization);
  }, [sendMessage]);

  /**
   * Generate an SPL query using the agent system.
   */
  const generateSPL = useCallback(async (
    prompt: string,
    organization?: string
  ): Promise<SplunkChatResult> => {
    return sendMessage(prompt, organization);
  }, [sendMessage]);

  return {
    analyzeInsight,
    generateSPL,
    isLoading,
    error,
  };
}

export default useSplunkChat;
