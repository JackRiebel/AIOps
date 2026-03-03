'use client';

/**
 * Chat V2 - Enterprise AI Chat Interface
 *
 * Features:
 * - Session-scoped cards with masonry auto-layout
 * - Bidirectional message-card highlighting
 * - Contextual suggestions based on network state
 * - Soft delete with undo
 * - Workspaces (session management)
 * - Click-to-expand cards
 *
 * Refactored to use extracted components and hooks:
 * - Components: CanvasIcon, SessionMetrics, WorkspaceSidebar
 * - Hooks: useOrganizationContext, useIncidentIngestion
 * - Services: messageHandler
 */

import { useCallback, useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { useSession, useStreaming, useOrganizationContext, useIncidentIngestion, usePathAnalysisIngestion, useTestDataPointIngestion } from './hooks';
import { useAISession } from '@/contexts/AISessionContext';
import { ChatPanel } from './components/ChatPanel';
import { MasonryCanvas } from './components/MasonryCanvas';
import { AgentFlowPanel } from './components/AgentFlowPanel';
import { ContextualSuggestions } from './components/ContextualSuggestions';
import { UndoToast, type UndoAction } from './components/UndoToast';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { SessionMetrics } from './components/SessionMetrics';
import { HighlightProvider } from './contexts/HighlightContext';
import { processStreamResult } from './services/messageHandler';

// =============================================================================
// Loading Fallback
// =============================================================================

function ChatV2Loading() {
  return (
    <div className="h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component (uses useSearchParams, must be wrapped in Suspense)
// =============================================================================

function ChatV2PageContent() {
  // Session management
  const {
    session,
    sessions,
    isLoading: sessionLoading,
    newSession,
    loadSession,
    deleteSession,
    addMessage,
    addCard,
    removeCardWithUndo,
    toggleCardPin,
    clearUnpinnedCards,
    updateAgentFlow,
    clearAgentFlow,
  } = useSession();

  // Streaming
  const {
    isStreaming,
    phase,
    content: streamingContent,
    currentTool,
    currentAgent,
    toolExecutions: streamingToolExecutions,
    agentTurns: streamingAgentTurns,
    error: streamingError,
    stream,
    cancel,
  } = useStreaming();

  // AI Session tracking for costs/ROI
  const { logAIQuery, isActive: isAISessionActive } = useAISession();

  // Organization context (orgs, networks, display names)
  const {
    organizations,
    networks,
    defaultMerakiOrg,
    orgDisplayNames,
    pollingContext,
  } = useOrganizationContext();

  // Incident ingestion from URL params
  useIncidentIngestion({
    session,
    sessionLoading,
    isStreaming,
    newSession,
    addMessage,
    addCard,
    stream,
    orgDisplayNames,
    isAISessionActive,
    logAIQuery,
  });

  // Path analysis ingestion from URL params
  usePathAnalysisIngestion({
    session,
    sessionLoading,
    isStreaming,
    newSession,
    addMessage,
    addCard,
    stream,
    orgDisplayNames,
    isAISessionActive,
    logAIQuery,
  });

  // Test data point ingestion from URL params
  useTestDataPointIngestion({
    session,
    sessionLoading,
    isStreaming,
    newSession,
    addMessage,
    addCard,
    stream,
    orgDisplayNames,
    isAISessionActive,
    logAIQuery,
  });

  // Derived agent flow state: use streaming data when streaming, otherwise use persisted session data
  const toolExecutions = useMemo(() => {
    const useStreamingData = isStreaming || streamingToolExecutions.length > 0;
    return useStreamingData ? streamingToolExecutions : (session?.agentFlow?.toolExecutions ?? []);
  }, [isStreaming, streamingToolExecutions, session?.agentFlow?.toolExecutions]);

  const agentTurns = useMemo(() => {
    if (isStreaming || streamingAgentTurns.length > 0) {
      return streamingAgentTurns;
    }
    return session?.agentFlow?.agentTurns ?? [];
  }, [isStreaming, streamingAgentTurns, session?.agentFlow?.agentTurns]);

  // Track previous streaming state to detect when streaming ends
  const wasStreamingRef = useRef(false);

  // Save agent flow to session when streaming completes
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      if (streamingToolExecutions.length > 0 || streamingAgentTurns.length > 0) {
        updateAgentFlow({
          toolExecutions: streamingToolExecutions,
          agentTurns: streamingAgentTurns,
        });
      }
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, streamingToolExecutions, streamingAgentTurns, updateAgentFlow]);

  // Canvas visibility - persisted to localStorage
  const [showCanvas, setShowCanvas] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('chat-v2-show-canvas');
    return saved !== 'false';
  });

  // Undo toast state
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  // Toggle canvas handler
  const handleToggleCanvas = useCallback(() => {
    setShowCanvas(prev => {
      const next = !prev;
      localStorage.setItem('chat-v2-show-canvas', String(next));
      return next;
    });
  }, []);

  // Build message history for API
  const history = useMemo(() => {
    if (!session) return [];
    return session.messages.map((m) => {
      const base = { role: m.role, content: m.content };
      if (m.metadata?.structuredData) {
        return { ...base, tool_data: m.metadata.structuredData };
      }
      return base;
    });
  }, [session]);

  // Get the last assistant message ID for card linking
  const lastAssistantMessageId = useMemo(() => {
    if (!session?.messages) return null;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'assistant') {
        return session.messages[i].id;
      }
    }
    return null;
  }, [session?.messages]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!session) return;

    // Clear agent flow from previous query
    clearAgentFlow();

    // Add user message to UI
    addMessage({ role: 'user', content });

    // Build history including the new user message (avoids stale closure
    // where the memo'd `history` doesn't yet contain the just-added message)
    const freshHistory = [
      ...history,
      { role: 'user', content },
    ];

    const startTime = Date.now();

    // Stream response
    const result = await stream({
      message: content,
      history: freshHistory,
      sessionId: session.id,
      verbosity: 'standard',
      organization: '',
      orgDisplayNames,
      currentCards: (session.cards ?? []).map(card => ({
        id: card.id,
        type: card.type,
        title: card.title,
        networkId: card.scope?.networkId,
        orgId: card.scope?.organizationId,
      })),
    });

    const duration = Date.now() - startTime;

    // Process result and add messages/cards
    processStreamResult({
      result,
      session,
      addMessage,
      addCard,
      originalQuery: content,
      durationMs: duration,
      isAISessionActive,
      logAIQuery,
      lastAssistantMessageId,
    });
  }, [session, addMessage, addCard, stream, history, orgDisplayNames, lastAssistantMessageId, clearAgentFlow, logAIQuery, isAISessionActive]);

  // Handle card removal with undo
  const handleCardRemove = useCallback((cardId: string) => {
    const result = removeCardWithUndo(cardId);
    if (result) {
      setUndoAction({
        id: cardId,
        message: `Card "${result.card.title}" removed`,
        onUndo: result.restore,
        duration: 5000,
      });
    }
  }, [removeCardWithUndo]);

  // Handle clear unpinned cards
  const handleClearUnpinned = useCallback(() => {
    const result = clearUnpinnedCards();
    if (result) {
      setUndoAction({
        id: 'clear-unpinned',
        message: `${result.cards.length} card${result.cards.length > 1 ? 's' : ''} removed`,
        onUndo: result.restore,
        duration: 5000,
      });
    }
  }, [clearUnpinnedCards]);

  // Handle undo complete
  const handleUndoComplete = useCallback(() => {
    setUndoAction(null);
  }, []);

  // Loading state
  if (sessionLoading) {
    return <ChatV2Loading />;
  }

  const hasMessages = (session?.messages?.length ?? 0) > 0;
  const hasCards = (session?.cards?.length ?? 0) > 0;
  const isEmpty = !hasMessages && !hasCards && !isStreaming;

  return (
    <HighlightProvider>
      <div className="h-full bg-white dark:bg-slate-900 flex overflow-hidden">
        {/* Chat Panel - Fixed 30% when canvas shown, full width when hidden */}
        <div
          className={`relative flex-shrink-0 flex flex-col min-h-0 transition-all duration-300 ${
            showCanvas ? 'w-[30%] min-w-[380px] max-w-[500px] border-r border-slate-200 dark:border-slate-700/50' : 'w-full'
          }`}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between flex-shrink-0 bg-white dark:bg-slate-900">
            <WorkspaceSidebar
              workspaces={sessions}
              currentId={session?.id}
              onNewWorkspace={newSession}
              onLoadWorkspace={loadSession}
              onDeleteWorkspace={deleteSession}
              showCanvas={showCanvas}
              onToggleCanvas={handleToggleCanvas}
            />
            <SessionMetrics metrics={session?.metrics} />
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatPanel
              messages={session?.messages ?? []}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamingPhase={phase}
              streamingContent={streamingContent}
              streamingError={streamingError}
              currentTool={currentTool}
              currentAgent={currentAgent}
              onCancel={cancel}
              placeholder="Ask anything..."
            />
          </div>

          {/* Agent Flow Panel - shown in chat panel when canvas is hidden */}
          {!showCanvas && (
            <AgentFlowPanel
              phase={phase}
              currentTool={currentTool}
              currentAgent={currentAgent}
              toolExecutions={toolExecutions}
              agentTurns={agentTurns}
              className="flex-shrink-0"
            />
          )}
        </div>

        {/* Canvas Panel - 70% width when shown */}
        {showCanvas && (
          <div className="flex-1 relative overflow-hidden min-h-0 min-w-0">
            {isEmpty ? (
              /* Empty State with Contextual Suggestions */
              <div className="absolute inset-0 bg-slate-50 dark:bg-slate-900">
                {/* Grid background with pulse */}
                <div
                  className="absolute inset-0 animate-grid-pulse"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(100, 116, 139, 0.15) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(100, 116, 139, 0.15) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                  }}
                />
                {/* Content */}
                <div className="relative h-full flex items-center justify-center p-8">
                  <div className="w-full max-w-xl">
                    <ContextualSuggestions onAction={handleSendMessage} />
                  </div>
                </div>
              </div>
            ) : (
              /* Masonry Canvas with Cards */
              <MasonryCanvas
                cards={session?.cards ?? []}
                onCardRemove={handleCardRemove}
                onCardPin={toggleCardPin}
                onClearUnpinned={handleClearUnpinned}
                className="absolute inset-0"
                pollingContext={pollingContext}
              />
            )}

            {/* Agent Flow Panel - Floating at bottom */}
            <AgentFlowPanel
              phase={phase}
              currentTool={currentTool}
              currentAgent={currentAgent}
              toolExecutions={toolExecutions}
              agentTurns={agentTurns}
              className="absolute bottom-0 left-0 right-0 z-10"
            />
          </div>
        )}

        {/* Undo Toast */}
        <UndoToast action={undoAction} onComplete={handleUndoComplete} />
      </div>
    </HighlightProvider>
  );
}

// =============================================================================
// Page Export with Suspense Boundary
// =============================================================================

export default function ChatV2Page() {
  return (
    <Suspense fallback={<ChatV2Loading />}>
      <ChatV2PageContent />
    </Suspense>
  );
}
