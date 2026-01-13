'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Lightbulb, Clock, Zap, HelpCircle, AlertTriangle, Layers } from 'lucide-react';
import { InvestigationPrompt } from '@/components/chat/InvestigationPrompt';
import { apiClient } from '@/lib/api-client';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { CanvasWorkspace, AgentFlowOverlay, TemplateSelector, CanvasFloatingControls, type CardQueryContext } from '@/components/canvas';
import { suggestTemplateForQuery, templateToCanvasCards } from '@/config/canvas-templates';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { useCanvasPresence } from '@/hooks/useCanvasPresence';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentFlow } from '@/components/agent-flow';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useAISession } from '@/contexts/AISessionContext';
import type { Message, CanvasCard, CanvasCardLayout, CanvasSuggestion, CanvasCardType } from '@/types/session';
import { CardAgent } from '@/services/card-agent';
import { findNextAvailablePosition, prepareCardsForAddition } from '@/utils/canvas-layout';
import type { Organization } from '@/types';
import type { MerakiNetwork } from '@/types/api';

/**
 * Network Page - AI Chat Interface with Canvas Workspace
 *
 * Following "Show, Don't Tell" philosophy:
 * - Chat sidebar on left (resizable, default 320px)
 * - Canvas workspace on right (toggleable)
 * - Session selector in chat header
 * - Org filter in three-dot menu
 * - Clean, minimal interface
 */

// Quick action suggestions for the canvas area
const QUICK_ACTIONS = [
  { icon: Zap, label: 'Network Status', query: 'What is the current network status across all organizations?' },
  { icon: HelpCircle, label: 'Troubleshoot', query: 'Help me troubleshoot network connectivity issues' },
  { icon: Clock, label: 'Recent Changes', query: 'Show me recent configuration changes in the network' },
  { icon: Lightbulb, label: 'Recommendations', query: 'What are your recommendations for optimizing our network?' },
];

// ============================================================================
// Main Page Component
// ============================================================================

// URL params result type
interface UrlParams {
  message: string | null;
  messageData: Record<string, unknown> | null;
  needsNewSession: boolean;
  hadParams: boolean;
}

// Helper to read URL params (runs during initial render - NO side effects!)
function getInitialUrlParams(): UrlParams {
  if (typeof window === 'undefined') {
    return { message: null, messageData: null, needsNewSession: false, hadParams: false };
  }

  const urlParams = new URLSearchParams(window.location.search);
  const encodedMsg = urlParams.get('msg');
  const encodedIncident = urlParams.get('incident');
  const needsNewSession = urlParams.get('new_session') === 'true';

  let message: string | null = null;
  let messageData: Record<string, unknown> | null = null;

  // Handle legacy msg parameter
  if (encodedMsg) {
    try {
      message = decodeURIComponent(atob(encodedMsg));
    } catch {
      // Failed to decode message - ignore
    }
  }

  // Handle incident parameter (structured payload)
  if (encodedIncident) {
    try {
      const payload = JSON.parse(decodeURIComponent(atob(encodedIncident)));
      message = payload.message;
      messageData = payload.context;
    } catch {
      // Failed to decode incident - ignore
    }
  }

  // DON'T clear URL here - that's a side effect, must be done in useEffect
  return { message, messageData, needsNewSession, hadParams: !!(encodedMsg || encodedIncident || needsNewSession) };
}

export default function NetworkPage() {
  // Auth context for user info (presence)
  const { user } = useAuth();

  // Read URL params once at module init (before any effects run)
  const [initialParams] = useState(() => getInitialUrlParams());

  // Clear URL params in effect (side effect can't be in render)
  useEffect(() => {
    if (initialParams.hadParams) {
      window.history.replaceState({}, '', '/network');
    }
  }, [initialParams.hadParams]);

  // State machine for Ask AI flow: 'idle' -> 'waiting_for_session' -> 'sending' -> 'done'
  const [askAIState, setAskAIState] = useState<'idle' | 'waiting_for_session' | 'sending' | 'done'>(() => {
    return initialParams.message ? 'waiting_for_session' : 'idle';
  });

  // Store the message and optional context data to send
  const [pendingMessage] = useState<string | null>(initialParams.message);
  const [pendingMessageData] = useState<Record<string, unknown> | null>(initialParams.messageData);

  // Organization state - now supports multiple selection (empty = all)
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Network state - for network-level card polling
  const [networks, setNetworks] = useState<MerakiNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [networksLoading, setNetworksLoading] = useState(false);

  // Default Meraki org for card polling when no specific org is selected
  // This ensures org-level cards (security, alerts, etc.) can still fetch data
  const defaultMerakiOrgName = useMemo(() => {
    const merakiOrg = organizations.find(o => o.url.toLowerCase().includes('meraki'));
    return merakiOrg?.name;
  }, [organizations]);

  // Canvas visibility toggle (persisted to localStorage)
  const [canvasEnabled, setCanvasEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lumen-canvas-enabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });

  const handleCanvasToggle = useCallback(() => {
    setCanvasEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('lumen-canvas-enabled', String(newValue));
      return newValue;
    });
  }, []);

  // Edit mode - allows write/update/delete operations (default off for safety)
  const [editMode, setEditMode] = useState(false);
  const [showEditModeConfirm, setShowEditModeConfirm] = useState(false);

  // Template selector modal
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Track recently applied template card types to prevent duplicates from AI callback
  // (React state batching means currentSession.canvasCards may be stale during callbacks)
  const recentTemplateCardTypesRef = useRef<Set<string>>(new Set());

  // Toast notification for auto-added cards
  const [cardAddedToast, setCardAddedToast] = useState<{ type: string; title: string } | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (cardAddedToast) {
      const timer = setTimeout(() => setCardAddedToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [cardAddedToast]);

  // Verbosity level for AI responses
  const [verbosity, setVerbosity] = useState<'brief' | 'standard' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('lumen-verbosity') as 'brief' | 'standard' | 'detailed') || 'standard';
    }
    return 'standard';
  });

  const handleVerbosityChange = useCallback((level: 'brief' | 'standard' | 'detailed') => {
    setVerbosity(level);
    localStorage.setItem('lumen-verbosity', level);
  }, []);

  // Input prefill from card context (for "Ask about this" feature)
  const [inputPrefill, setInputPrefill] = useState<string | undefined>(undefined);
  // Card context for "Ask about this" - includes networkId, deviceSerial, orgId
  const [cardQueryContext, setCardQueryContext] = useState<CardQueryContext | undefined>(undefined);

  // Handler for "Ask about this" on canvas cards
  const handleAskAboutCard = useCallback((context: CardQueryContext) => {
    // Build a context-aware prefill that includes network/device info for clarity
    let prefill = `Regarding the "${context.cardTitle}"`;
    if (context.config?.networkId) {
      prefill += ` (Network: ${context.config.networkId})`;
    } else if (context.config?.deviceSerial) {
      prefill += ` (Device: ${context.config.deviceSerial})`;
    }
    prefill += ': ';
    setInputPrefill(prefill);
    setCardQueryContext(context);
  }, []);

  const handlePrefillApplied = useCallback(() => {
    setInputPrefill(undefined);
    // Keep cardQueryContext for the message send - clear it after message is sent
  }, []);

  // Edit mode toggle with confirmation when enabling
  const handleEditModeToggle = useCallback(() => {
    if (!editMode) {
      // Enabling - show confirmation dialog
      setShowEditModeConfirm(true);
    } else {
      // Disabling - no confirmation needed
      setEditMode(false);
    }
  }, [editMode]);

  const confirmEditMode = useCallback(() => {
    setEditMode(true);
    setShowEditModeConfirm(false);
  }, []);

  // Session persistence
  const {
    currentSession,
    isLoading: sessionLoading,
    sessions,
    createSession,
    loadSession,
    deleteSession,
    duplicateSession,
    renameSession,
    addMessage,
    setCanvasCards,
    addCanvasCard,
    removeCanvasCard,
    updateCanvasCard,
    setAgentFlowState,
  } = useSessionPersistence();

  // Streaming chat
  const {
    streamMessage,
    cancelStream,
    isStreaming,
    streamingStatus,
    streamingToolName,
    agentActivity,
    streamedContent,
    modelInfo,
  } = useStreamingChat();

  // AI Session tracking (for logging AI queries, costs, and generating summaries)
  const { logAIQuery } = useAISession();

  // Agent flow (for overlay during streaming)
  const {
    nodes: agentFlowNodes,
    edges: agentFlowEdges,
    currentPhase: agentFlowPhase,
    timeline: agentFlowTimeline,
    startFlow,
    handleEvent: handleFlowEvent,
    resetFlow,
    getFlowState,
    restoreFlow,
  } = useAgentFlow();

  // Canvas presence - track who's viewing the canvas in real-time
  // DISABLED: WebSocket connection is not working, causing console spam
  const {
    members: presenceMembers,
    isConnected: presenceConnected,
  } = useCanvasPresence({
    canvasId: currentSession?.id ?? null,
    user: user ? {
      id: String(user.id),
      username: user.username,
      avatar_url: undefined, // Could add user avatars later
    } : null,
    enabled: false, // Disabled until WebSocket server is fixed
  });

  // Resizable chat sidebar
  const {
    width: sidebarWidth,
    handleProps: sidebarHandleProps,
  } = useResizablePanel({
    storageKey: 'lumen-chat-sidebar-width',
    defaultWidth: 320,
    minWidth: 280,
    maxWidth: 600,
    side: 'left',
  });

  // Fetch organizations
  useEffect(() => {
    async function fetchData() {
      try {
        const orgsData = await apiClient.getOrganizations();
        const activeOrgs = orgsData.filter(org => org.is_active);
        setOrganizations(activeOrgs);
        // Default: all orgs (empty array means all)
      } catch {
        // Failed to fetch organizations
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch networks when a single org is selected OR use default Meraki org
  useEffect(() => {
    async function fetchNetworks() {
      let orgName: string | undefined;

      if (selectedOrgs.length === 1) {
        // Use explicitly selected org
        orgName = selectedOrgs[0];
        const org = organizations.find(o => o.name === orgName);
        if (!org || !org.url.toLowerCase().includes('meraki')) {
          // Not a Meraki org, can't fetch networks
          setNetworks([]);
          setSelectedNetwork('');
          return;
        }
      } else {
        // No specific org selected - use first Meraki org for network context
        const merakiOrg = organizations.find(o => o.url.toLowerCase().includes('meraki'));
        if (merakiOrg) {
          orgName = merakiOrg.name;
        }
      }

      if (!orgName) {
        setNetworks([]);
        setSelectedNetwork('');
        return;
      }

      setNetworksLoading(true);
      try {
        const networksData = await apiClient.getMerakiNetworks(orgName);
        setNetworks(networksData);
        // Auto-select first network if available (only when single org explicitly selected)
        if (networksData.length > 0 && !selectedNetwork && selectedOrgs.length === 1) {
          setSelectedNetwork(networksData[0].id);
        }
      } catch {
        setNetworks([]);
      } finally {
        setNetworksLoading(false);
      }
    }

    fetchNetworks();
  }, [selectedOrgs, organizations]);

  // Track previous session ID to detect session changes
  const prevSessionIdRef = useRef<string | null>(null);

  // Restore agent flow state when session changes (not when state saves)
  useEffect(() => {
    if (!currentSession) return;

    // Don't restore if currently streaming (new query in progress)
    if (isStreaming) return;

    // Only restore on session ID change (not when agentFlowState updates from save)
    if (prevSessionIdRef.current === currentSession.id) return;
    prevSessionIdRef.current = currentSession.id;

    // If session has saved agent flow state, restore it
    if (currentSession.agentFlowState) {
      console.log('[NetworkPage] Restoring agent flow state from session:', {
        sessionId: currentSession.id,
        nodeCount: currentSession.agentFlowState.nodes.length,
        phase: currentSession.agentFlowState.currentPhase,
      });
      restoreFlow(currentSession.agentFlowState);
    } else {
      // New session or session without flow state - reset to idle
      console.log('[NetworkPage] No agent flow state in session, resetting flow');
      resetFlow();
    }
    // NOTE: Only depend on session ID, not agentFlowState - we don't want to restore
    // when saving after completion, only when switching sessions
  }, [currentSession?.id, restoreFlow, resetFlow, isStreaming]);

  // Save agent flow state when flow completes
  useEffect(() => {
    // Only save when flow reaches 'complete' phase and is not streaming
    if (agentFlowPhase === 'complete' && !isStreaming) {
      // Small delay to ensure all state updates have settled
      const timer = setTimeout(() => {
        const flowState = getFlowState();
        if (flowState) {
          console.log('[NetworkPage] Saving agent flow state:', {
            nodeCount: flowState.nodes.length,
            phase: flowState.currentPhase,
            platforms: flowState.platformNodes,
          });
          setAgentFlowState(flowState);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [agentFlowPhase, isStreaming, getFlowState, setAgentFlowState]);

  // Build message history for API
  const history = useMemo(() => {
    return (currentSession?.messages ?? []).map(m => ({
      role: m.role,
      content: m.content,
    }));
  }, [currentSession?.messages]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (content: string, messageData?: Record<string, unknown>) => {
    if (!currentSession) return;

    // Generate unique message ID (using crypto for uniqueness)
    const messageId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    // Add user message with optional structured data (for incident context cards, etc.)
    const userMessage: Message = {
      id: messageId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      data: messageData,  // This allows chat to render special UI (e.g., IncidentContextCard)
    };
    addMessage(userMessage);

    // Auto-suggest and apply template based on query keywords
    // Only applies if:
    // 1. Canvas is empty or has few cards (to not disrupt existing work)
    // 2. Networks are loaded (to ensure proper network context resolution)
    const existingCards = currentSession?.canvasCards ?? [];
    if (existingCards.length < 2 && !networksLoading && networks.length > 0) {
      const suggestion = suggestTemplateForQuery(content);
      if (suggestion && suggestion.confidence >= 0.3) {
        console.log(`[NetworkPage] Auto-suggesting template: ${suggestion.template.name} (confidence: ${suggestion.confidence.toFixed(2)})`);

        // Try to extract network from query by matching against known networks
        const lowerContent = content.toLowerCase();
        let resolvedNetworkId = selectedNetwork || undefined;
        let resolvedNetworkName: string | undefined;

        // Search for network name in query (partial match, case-insensitive)
        for (const network of networks) {
          const networkNameLower = network.name.toLowerCase();
          if (lowerContent.includes(networkNameLower) || networkNameLower.includes(lowerContent.split(' ').pop() || '')) {
            resolvedNetworkId = network.id;
            resolvedNetworkName = network.name;
            console.log(`[NetworkPage] Resolved network from query: ${network.name} (${network.id})`);
            break;
          }
        }

        // If no network matched from query, use first network as default for template cards
        if (!resolvedNetworkId && networks.length > 0) {
          resolvedNetworkId = networks[0].id;
          resolvedNetworkName = networks[0].name;
          console.log(`[NetworkPage] Using default network: ${resolvedNetworkName} (${resolvedNetworkId})`);
        }

        // Get org context - prefer default Meraki org for card polling
        const orgId = selectedOrgs.length === 1 ? selectedOrgs[0] : defaultMerakiOrgName;

        // Get context for the template
        const templateContext = {
          orgId,
          networkId: resolvedNetworkId,
          networkName: resolvedNetworkName,
        };

        console.log(`[NetworkPage] Template context:`, templateContext);

        // Convert template to canvas cards with context
        const templateCards = templateToCanvasCards(suggestion.template, templateContext);

        // Validate and resolve any collisions in template cards
        // This ensures template cards never overlap even if the template definition has issues
        const validatedTemplateCards = prepareCardsForAddition(
          templateCards,
          [],  // Empty existing cards since we're replacing all
          { networkId: resolvedNetworkId, orgId }
        );

        // DEBUG: Log template card layouts
        console.log('[NetworkPage] Template cards validated with layouts:', validatedTemplateCards.map(c => ({
          type: c.type,
          layout: c.layout,
        })));

        // Track template card types to prevent duplicates from AI callback
        recentTemplateCardTypesRef.current = new Set(validatedTemplateCards.map(c => c.type));
        console.log('[NetworkPage] Template card types tracked:', Array.from(recentTemplateCardTypesRef.current));

        // Clear the ref after a delay (allows AI callback to check it)
        setTimeout(() => {
          recentTemplateCardTypesRef.current.clear();
        }, 10000);

        // Apply validated template cards to canvas
        setCanvasCards(validatedTemplateCards);

        // Show toast notification for template
        setCardAddedToast({
          type: 'template',
          title: `Applied "${suggestion.template.name}" template`,
        });
      }
    }

    // Start new agent flow - startFlow already resets state internally
    startFlow(content);

    // Track start time for duration
    const startTime = Date.now();

    // Stream the response
    // Organization resolution modes:
    // - Single org selected: pass that org name for backward compatibility
    // - "All Organizations" (empty selectedOrgs): pass empty string for auto-resolve
    //   Backend will dynamically resolve credentials per-tool based on platform
    const orgToQuery = selectedOrgs.length === 1
      ? selectedOrgs[0]  // Single org explicitly selected
      : '';  // Empty = auto-resolve (backend picks appropriate credentials per-tool)

    // Build org display names mapping (name -> display_name) for UI purposes
    const orgDisplayNames: Record<string, string> = {};
    organizations.forEach(o => {
      orgDisplayNames[o.name] = o.display_name || o.name;
    });

    const result = await streamMessage({
      message: content,
      organization: orgToQuery,
      network_id: selectedOrgs.length === 1 && selectedNetwork ? selectedNetwork : undefined,  // Pass selected network for card context
      orgDisplayNames,
      history,
      edit_mode: editMode,  // Pass edit mode to allow write operations
      verbosity,  // Response detail level
      session_id: currentSession?.id,  // Pass session ID for cardable data caching
      cardContext: messageData?.cardContext as Record<string, string> | undefined,  // Card context from "Ask about this" feature
      onThinking: () => handleFlowEvent({ type: 'thinking' }),
      onTextDelta: (text) => handleFlowEvent({ type: 'text_delta', text }),
      onToolStart: (tool) => handleFlowEvent({ type: 'tool_use_start', tool }),
      onToolComplete: (tool, success) => handleFlowEvent({ type: 'tool_use_complete', tool, success }),
      // Legacy agent activity events
      onAgentActivityStart: (agent, query) => handleFlowEvent({ type: 'agent_activity_start', agent, query }),
      onAgentActivityComplete: (agent, res) => handleFlowEvent({
        type: 'agent_activity_complete',
        agent,
        success: res.success,
        confidence: res.confidence,
        sources_count: res.sources_count,
        steps_count: res.steps_count,
        response_summary: res.response_summary,
      }),
      // Multi-agent turn events - map to agent_activity format for flow diagram
      onTurnStart: (turn) => {
        // Map agent IDs to agent types for the flow diagram
        const agentType = turn.agentId.includes('meraki') ? 'implementation' :
          turn.agentId.includes('splunk') ? 'implementation' :
            turn.agentId.includes('thousandeyes') ? 'implementation' :
              turn.agentId.includes('catalyst') ? 'implementation' :
                'knowledge';
        handleFlowEvent({
          type: 'agent_activity_start',
          agent: agentType,
          query: turn.query,
          agentId: turn.agentId,
          agentName: turn.agentName,
        });
      },
      onTurnComplete: (turn) => {
        const agentType = turn.agentId.includes('meraki') ? 'implementation' :
          turn.agentId.includes('splunk') ? 'implementation' :
            turn.agentId.includes('thousandeyes') ? 'implementation' :
              turn.agentId.includes('catalyst') ? 'implementation' :
                'knowledge';
        handleFlowEvent({
          type: 'agent_activity_complete',
          agent: agentType,
          success: turn.status === 'completed',
          agentId: turn.agentId,
          agentName: turn.agentName,
        });
      },
      onComplete: (usage, tools_used) => {
        handleFlowEvent({
          type: 'done',
          usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
          tools_used,
        });
      },
      onError: (error) => handleFlowEvent({ type: 'error', error }),
      // Canvas card suggestion callback - auto-add cards when AI uses canvas tools
      onCardSuggestion: (card) => {
        // Only auto-add cards from AI canvas tools (not knowledge sources which show as suggestions)
        if (card.metadata?.source === 'ai_tool') {
          console.log('[NetworkPage] AI canvas tool card suggestion received:', card.type, card.title);

          // Check if a card of this type already exists (e.g., from a template that was just applied)
          // Check both the ref (for freshly applied templates) and current session (for persisted cards)
          const isFromRecentTemplate = recentTemplateCardTypesRef.current.has(card.type);
          const existingCard = currentSession?.canvasCards?.find(c => c.type === card.type);
          if (isFromRecentTemplate || existingCard) {
            console.log('[NetworkPage] Skipping duplicate card type:', card.type, {
              isFromRecentTemplate,
              existingInSession: !!existingCard,
            });
            return;
          }

          // Use CardAgent to generate a proper CanvasCard
          const result = CardAgent.generateCard({
            id: crypto.randomUUID(),
            label: card.title,
            data: card.data,
            suggestedType: card.type as CanvasCardType,
            config: {
              networkId: card.metadata?.network_id || selectedNetwork,
              orgId: card.metadata?.org_id,
              ...card.metadata,
            },
          }, currentSession?.canvasCards || []);

          if (result.success && result.card) {
            // Mark as auto-added by AI
            result.card.metadata = {
              ...result.card.metadata,
              autoAdded: true,
              sourceQuery: content,
            };
            addCanvasCard(result.card);
            // Show toast notification
            setCardAddedToast({ type: result.card.type, title: result.card.title });
            console.log('[NetworkPage] Auto-added canvas card:', result.card.type, result.card.title);
          }
        }
      },
    });

    const duration = Date.now() - startTime;

    // Add assistant message
    if (result.content) {
      // Use cost_usd from API if available (correct pricing for all models)
      // Fall back to manual calculation for legacy endpoints (Claude pricing)
      const totalCost = result.usage?.cost_usd ?? (
        result.usage
          ? (result.usage.input_tokens / 1_000_000) * 3 + (result.usage.output_tokens / 1_000_000) * 15
          : 0
      );

      // Pass tool_data directly to CardableSuggestions - it handles multi-tool format
      // Each tool result becomes a separate "Add to Canvas" button
      const structuredData = result.tool_data && result.tool_data.length > 0
        ? result.tool_data
        : undefined;

      const assistantMessage: Message = {
        id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        role: 'assistant',
        content: result.content,
        created_at: new Date().toISOString(),
        duration_ms: duration,
        usage: result.usage ? {
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cost_usd: totalCost,
        } : undefined,
        tools_used: result.tools_used,
        data: structuredData,
        // Knowledge base card suggestions from backend
        card_suggestions: result.card_suggestions,
      };
      addMessage(assistantMessage);

      // Log AI query to session tracking for analytics, costs, and AI summary generation
      logAIQuery(
        content,  // User's original query
        result.content,  // AI response
        'claude-sonnet-4',  // Model used
        result.usage?.input_tokens || 0,
        result.usage?.output_tokens || 0,
        {
          chatSessionId: currentSession?.id,
          toolsUsed: result.tools_used,
          durationMs: duration,
        }
      );
    }

    // Handle error
    if (result.error) {
      const errorMessage: Message = {
        id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        role: 'system',
        content: `Error: ${result.error}`,
        created_at: new Date().toISOString(),
      };
      addMessage(errorMessage);
    }
  }, [currentSession, addMessage, selectedOrgs, organizations, history, streamMessage, startFlow, handleFlowEvent, logAIQuery, editMode, verbosity, selectedNetwork, addCanvasCard, networksLoading, networks, defaultMerakiOrgName, setCanvasCards]);

  // Handle Ask AI flow from external pages (incidents, thousandeyes)
  // State machine: waiting_for_session -> sending -> done
  useEffect(() => {
    if (askAIState === 'idle' || askAIState === 'done') return;
    if (!pendingMessage) {
      setAskAIState('idle');
      return;
    }

    if (askAIState === 'waiting_for_session') {
      // Wait for session persistence to be ready
      if (sessionLoading) {
        return;
      }

      // Create a new session for the Ask AI request
      setAskAIState('sending');
      const orgForSession = selectedOrgs.length === 1 ? selectedOrgs[0] : undefined;
      createSession(orgForSession);
      return;
    }

    if (askAIState === 'sending') {
      // Wait for the new session to be created
      if (!currentSession || isStreaming) {
        return;
      }

      // Send the message
      setAskAIState('done');

      // Minimal delay to ensure UI state is settled
      setTimeout(() => {
        handleSendMessage(pendingMessage, pendingMessageData ?? undefined);
      }, 50);
    }
  }, [askAIState, pendingMessage, pendingMessageData, sessionLoading, currentSession, isStreaming, selectedOrgs, createSession, handleSendMessage]);

  // Handle canvas suggestion click
  const handleCanvasSuggestion = useCallback((suggestion: CanvasSuggestion) => {
    if (!currentSession) return;

    const now = new Date().toISOString();
    const existingCards = currentSession.canvasCards;

    // Use grid-aware position calculation to prevent overlaps
    const cardWidth = 6;
    const cardHeight = 3;
    const position = findNextAvailablePosition(existingCards, cardWidth, cardHeight);

    const newCard: CanvasCard = {
      id: crypto.randomUUID(),
      type: suggestion.cardType,
      title: suggestion.label,
      layout: {
        x: position.x,
        y: position.y,
        w: cardWidth,
        h: cardHeight,
      },
      data: suggestion.data,
      config: suggestion.config,
      metadata: {
        createdAt: now,
        updatedAt: now,
        costUsd: 0,
        isLive: false,
      },
    };

    addCanvasCard(newCard);
  }, [currentSession, addCanvasCard]);

  // Handle canvas layout change
  const handleLayoutChange = useCallback((cardId: string, layout: CanvasCardLayout) => {
    updateCanvasCard(cardId, { layout });
  }, [updateCanvasCard]);

  // Handle card lock toggle - preserve existing config when toggling lock
  const handleCardLockToggle = useCallback((cardId: string, isLocked: boolean) => {
    const card = currentSession?.canvasCards.find(c => c.id === cardId);
    const existingConfig = card?.config || {};
    updateCanvasCard(cardId, { config: { ...existingConfig, isLocked } });
  }, [updateCanvasCard, currentSession]);

  // Handle applying a canvas template
  const handleApplyTemplate = useCallback((cards: CanvasCard[]) => {
    // Replace all current cards with template cards
    setCanvasCards(cards);
  }, [setCanvasCards]);

  // Handle new session
  const handleNewSession = useCallback(async () => {
    resetFlow();
    // Use first selected org or undefined for all
    const orgForSession = selectedOrgs.length === 1 ? selectedOrgs[0] : undefined;
    await createSession(orgForSession);
  }, [createSession, selectedOrgs, resetFlow]);

  // Loading state
  if (loading || sessionLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading Lumen AI...</p>
        </div>
      </div>
    );
  }

  const hasMessages = (currentSession?.messages?.length ?? 0) > 0;
  const hasCards = (currentSession?.canvasCards?.length ?? 0) > 0;

  return (
    <div className="h-full flex bg-slate-900">
      {/* Chat Sidebar - Resizable */}
      <div
        className="relative flex-shrink-0 border-r border-slate-700/50"
        style={{ width: canvasEnabled ? sidebarWidth : '100%' }}
      >
        <ChatSidebar
          session={currentSession}
          onSendMessage={handleSendMessage}
          onCanvasSuggestion={handleCanvasSuggestion}
          onAddCard={addCanvasCard}
          isStreaming={isStreaming}
          onStop={cancelStream}
          streamingStatus={streamingStatus}
          streamingToolName={streamingToolName}
          agentActivity={agentActivity}
          streamingContent={isStreaming ? streamedContent : undefined}
          modelInfo={modelInfo}
          disabled={false}
          placeholder="Ask anything about your network..."
          className="w-full h-full"
          // Session management
          sessions={sessions}
          onNewSession={handleNewSession}
          onLoadSession={loadSession}
          onDuplicateSession={duplicateSession}
          onDeleteSession={deleteSession}
          onRenameSession={renameSession}
          // Organization filter
          organizations={organizations}
          selectedOrgs={selectedOrgs}
          onOrgsChange={setSelectedOrgs}
          // Network filter
          networks={networks}
          selectedNetwork={selectedNetwork}
          onNetworkChange={setSelectedNetwork}
          networksLoading={networksLoading}
          // Canvas toggle
          canvasEnabled={canvasEnabled}
          onCanvasToggle={handleCanvasToggle}
          // Edit mode toggle
          editMode={editMode}
          onEditModeToggle={handleEditModeToggle}
          // Verbosity toggle
          verbosity={verbosity}
          onVerbosityChange={handleVerbosityChange}
          // Card query context prefill
          inputPrefill={inputPrefill}
          onPrefillApplied={handlePrefillApplied}
          // Card context for AI (networkId, deviceSerial, etc.)
          cardContext={cardQueryContext?.config}
          onCardContextUsed={() => setCardQueryContext(undefined)}
        />
        {/* Resize Handle - only show when canvas is enabled */}
        {canvasEnabled && <div {...sidebarHandleProps} />}
      </div>

      {/* Canvas Workspace - Only render when enabled */}
      {canvasEnabled && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Show Quick Actions when canvas is empty */}
          {!hasCards && !hasMessages && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-2xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mx-auto mb-6">
                  <Lightbulb className="w-8 h-8 text-cyan-500" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Start a Conversation</h2>
                <p className="text-slate-400 mb-6">
                  Ask questions about your network, troubleshoot issues, or get recommendations.
                </p>

                {/* Template quick start */}
                <button
                  onClick={() => setShowTemplateSelector(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 mb-6 text-sm font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <Layers className="w-4 h-4" />
                  <span>Start from a template</span>
                </button>

                {/* AI-Suggested Actions based on open incidents */}
                <div className="mb-6 w-full max-w-md">
                  <InvestigationPrompt
                    onSelectSuggestion={handleSendMessage}
                    className="w-full"
                  />
                </div>

                <p className="text-slate-500 text-xs mb-4">or ask a question</p>

                <div className="grid grid-cols-2 gap-3" role="group" aria-label="Quick action suggestions">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSendMessage(action.query)}
                      aria-label={`Ask AI: ${action.label}`}
                      className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all text-left group focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-700/50 group-hover:bg-cyan-500/10 flex items-center justify-center transition-colors">
                        <action.icon className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
                      </div>
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Canvas Workspace - show when has content or streaming */}
          {(hasCards || hasMessages || isStreaming) && (
            <div className="flex-1 relative min-h-0 overflow-hidden">
              <CanvasWorkspace
                cards={currentSession?.canvasCards ?? []}
                onLayoutChange={handleLayoutChange}
                onCardRemove={removeCanvasCard}
                onCardLockToggle={handleCardLockToggle}
                onAskAboutCard={handleAskAboutCard}
                disabled={false}
                className="h-full"
                pollingContext={{
                  // Pass org for card polling - use selected org if one is selected,
                  // otherwise fall back to first Meraki org for org-level cards (security, alerts, etc.)
                  orgId: selectedOrgs.length === 1 ? selectedOrgs[0] : defaultMerakiOrgName,
                  // Pass network for card polling when a network is selected
                  networkId: selectedNetwork || undefined,
                }}
              />
              {/* Floating controls overlay */}
              <CanvasFloatingControls
                cards={currentSession?.canvasCards ?? []}
                onLoadCanvas={setCanvasCards}
                onOpenTemplates={() => setShowTemplateSelector(true)}
                onAddCard={addCanvasCard}
                presenceMembers={presenceMembers}
                currentUserId={user ? String(user.id) : undefined}
                presenceConnected={presenceConnected}
                hasContent={hasCards || hasMessages}
                networkId={selectedNetwork || undefined}
                orgId={selectedOrgs.length === 1 ? selectedOrgs[0] : undefined}
              />
            </div>
          )}

          {/* Agent Flow Panel - always present at bottom, collapsible */}
          <AgentFlowOverlay
            nodes={agentFlowNodes}
            edges={agentFlowEdges}
            isActive={isStreaming}
            currentPhase={agentFlowPhase}
            timeline={agentFlowTimeline}
            onDismiss={resetFlow}
          />
        </div>
      )}

      {/* Edit Mode Confirmation Dialog */}
      {showEditModeConfirm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-mode-dialog-title"
          aria-describedby="edit-mode-dialog-desc"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" aria-hidden="true" />
              <h3 id="edit-mode-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">Enable Edit Mode?</h3>
            </div>
            <div id="edit-mode-dialog-desc" className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Edit mode allows the AI to make changes to your network configuration including:
              </p>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 list-disc list-inside">
                <li>Create, update, or delete VLANs</li>
                <li>Modify firewall rules</li>
                <li>Change device settings</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModeConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500/50"
              >
                Cancel
              </button>
              <button
                onClick={confirmEditMode}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                Enable Edit Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onApplyTemplate={handleApplyTemplate}
        mode="replace"
      />

      {/* Toast notification for AI-added cards */}
      {cardAddedToast && (
        <div
          className="fixed bottom-4 right-4 z-50 animate-[slideInUp_0.3s_ease-out]"
          role="status"
          aria-live="polite"
        >
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Layers className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Card Added to Canvas</p>
              <p className="text-emerald-100 text-xs">{cardAddedToast.title}</p>
            </div>
            <button
              onClick={() => setCardAddedToast(null)}
              className="ml-2 text-emerald-200 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
