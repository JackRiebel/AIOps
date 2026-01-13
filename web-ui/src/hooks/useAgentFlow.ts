/**
 * React hook for managing agent flow diagram state based on SSE streaming events.
 * Transforms streaming chat events into React Flow nodes and edges for visualization.
 *
 * FLOW ARCHITECTURE:
 * - Initial (simple): User → Orchestrator → Response
 * - Expanded (when APIs called): User → Orchestrator → Platforms → Correlating → Response
 *
 * The flow starts simple and expands dynamically when tool calls are made.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  FlowNode,
  FlowEdge,
  FlowPhase,
  SSEEvent,
  AgentType,
  UseAgentFlowReturn,
  EnterpriseAgentType,
  SpecialistAgentId,
  PlatformId,
  PlatformNodeData,
  TimelineEvent,
} from '@/types/agent-flow';
import type { PersistedAgentFlowState, SerializedTimelineEvent } from '@/types/session';
import { isEnterpriseEvent } from '@/lib/agent-event-bus';
import { getPlatformFromTool, PLATFORMS } from '@/types/agent-flow';

// ============================================================================
// Tool Description Helper
// ============================================================================

function getToolReasoning(toolName: string): { reason: string; action: string } {
  const toolDescriptions: Record<string, { reason: string; action: string }> = {
    meraki_list_network_devices: { reason: 'Need to identify all devices in the network', action: 'Retrieving device inventory from Meraki Dashboard' },
    meraki_get_device_status: { reason: 'Need to check device health and connectivity', action: 'Fetching real-time device status' },
    meraki_get_wireless_channel_utilization: { reason: 'Checking for wireless congestion or interference', action: 'Analyzing RF channel utilization data' },
    meraki_get_network_health: { reason: 'Need to assess overall network health', action: 'Retrieving network health metrics' },
    meraki_get_device_clients: { reason: 'Need to see connected clients', action: 'Fetching client connection data' },
    meraki_get_network_alerts: { reason: 'Checking for active alerts or issues', action: 'Retrieving network alerts' },
    meraki_get_device_uplink_loss_latency: { reason: 'Investigating connectivity issues', action: 'Measuring uplink packet loss and latency' },
    meraki_get_organization_uplinks_statuses: { reason: 'Checking WAN connectivity status', action: 'Fetching organization-wide uplink statuses' },
    meraki_list_organizations: { reason: 'Need to identify available organizations', action: 'Retrieving organization list' },
    meraki_list_networks: { reason: 'Need to find target network', action: 'Retrieving network list' },
    splunk_search_run_splunk_query: { reason: 'Searching historical data for patterns or events', action: 'Executing Splunk search query' },
    splunk_run_saved_search: { reason: 'Running pre-configured analysis', action: 'Executing saved Splunk search' },
    thousandeyes_get_tests: { reason: 'Need to check synthetic monitoring tests', action: 'Retrieving ThousandEyes test configurations' },
    thousandeyes_get_test_results: { reason: 'Analyzing network path and performance data', action: 'Fetching ThousandEyes test results' },
    canvas_add_dashboard: { reason: 'Creating visual workspace for results', action: 'Setting up dashboard canvas' },
    canvas_add_card: { reason: 'Displaying data visualization', action: 'Adding data card to canvas' },
    consult_knowledge_agent: { reason: 'Looking up best practices and documentation', action: 'Consulting knowledge base' },
    request_implementation_plan: { reason: 'Creating step-by-step action plan', action: 'Generating implementation guide' },
  };

  const desc = toolDescriptions[toolName];
  if (desc) return desc;

  const name = toolName.toLowerCase();
  if (name.includes('list') || name.includes('get')) {
    return { reason: 'Retrieving required data', action: `Fetching data via ${toolName}` };
  }
  if (name.includes('search') || name.includes('query')) {
    return { reason: 'Searching for relevant information', action: `Executing search: ${toolName}` };
  }
  if (name.includes('create') || name.includes('add')) {
    return { reason: 'Creating new resource', action: `Creating via ${toolName}` };
  }
  if (name.includes('update') || name.includes('set')) {
    return { reason: 'Updating configuration', action: `Updating via ${toolName}` };
  }
  return { reason: 'Processing request', action: `Executing ${toolName}` };
}

// ============================================================================
// Layout Constants - Two modes: Simple and Expanded
// ============================================================================

// Simple mode: User → Orchestrator → Response (compact, 3 nodes)
const SIMPLE_LAYOUT = {
  user: { x: 80, y: 200 },
  orchestrator: { x: 420, y: 200 },
  response: { x: 760, y: 200 },
} as const;

// Expanded mode: User → Orchestrator → Platforms → Correlating → Response (5 columns)
// Large spacing for clear readability
const EXPANDED_LAYOUT = {
  user: { x: 40, y: 200 },
  orchestrator: { x: 340, y: 200 },        // Becomes "Routing" - 300px from user
  platforms: { x: 600, y: 200 },           // Center column for platforms
  correlating: { x: 860, y: 200 },         // Correlating orchestrator
  response: { x: 1120, y: 200 },
  // Platform spacing - vertical distance between platform nodes
  platformSpacing: 140,
  centerY: 200,
} as const;

// Calculate platform position
function calculatePlatformPosition(platformIndex: number, totalPlatforms: number): { x: number; y: number } {
  const x = EXPANDED_LAYOUT.platforms.x;
  if (totalPlatforms === 1) {
    return { x, y: EXPANDED_LAYOUT.centerY };
  }
  const totalHeight = (totalPlatforms - 1) * EXPANDED_LAYOUT.platformSpacing;
  const startY = EXPANDED_LAYOUT.centerY - totalHeight / 2;
  return { x, y: startY + platformIndex * EXPANDED_LAYOUT.platformSpacing };
}

// Recalculate all platform positions
function recalculatePlatformPositions(nodes: FlowNode[], platformIds: string[]): FlowNode[] {
  const totalPlatforms = platformIds.length;
  let platformIndex = 0;
  return nodes.map((node) => {
    if (node.type === 'platform' && platformIds.includes(node.id)) {
      const newPosition = calculatePlatformPosition(platformIndex, totalPlatforms);
      platformIndex++;
      return { ...node, position: newPosition };
    }
    return node;
  });
}

// ============================================================================
// Initial State - Simple Flow
// ============================================================================

const createSimpleNodes = (query?: string): FlowNode[] => [
  {
    id: 'user',
    type: 'user',
    position: SIMPLE_LAYOUT.user,
    data: { label: 'User', status: query ? 'completed' : 'idle', query: query || '' },
  },
  {
    id: 'orchestrator',
    type: 'orchestrator',
    position: SIMPLE_LAYOUT.orchestrator,
    data: { label: 'Orchestrator', status: 'idle' },
  },
  {
    id: 'response',
    type: 'response',
    position: SIMPLE_LAYOUT.response,
    data: { label: 'Response', status: 'idle' },
  },
];

const createSimpleEdges = (): FlowEdge[] => [
  {
    id: 'user-orchestrator',
    source: 'user',
    target: 'orchestrator',
    type: 'animated',
    data: { status: 'idle' },
  },
  {
    id: 'orchestrator-response',
    source: 'orchestrator',
    target: 'response',
    type: 'animated',
    data: { status: 'idle' },
  },
];

// ============================================================================
// useAgentFlow Hook
// ============================================================================

export function useAgentFlow(): UseAgentFlowReturn {
  const [nodes, setNodes] = useState<FlowNode[]>(createSimpleNodes());
  const [edges, setEdges] = useState<FlowEdge[]>(createSimpleEdges());
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<FlowPhase>('idle');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Track state
  const agentNodesRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number | null>(null);
  const toolStartTimeRef = useRef<Map<string, number>>(new Map());
  const agentCounterRef = useRef<number>(0);
  const agentIdMapRef = useRef<Map<string, string>>(new Map());
  const platformNodesRef = useRef<Set<PlatformId>>(new Set());
  const platformToolsRef = useRef<Map<PlatformId, string[]>>(new Map());
  const platformStartTimeRef = useRef<Map<PlatformId, number>>(new Map());
  const toolsUsedRef = useRef<string[]>([]);

  // Track if we've expanded to the full flow (with platforms)
  const isExpandedRef = useRef<boolean>(false);

  // Snapshot refs for node/edge integrity verification
  // These help detect and recover from state loss during rapid SSE events
  const nodesSnapshotRef = useRef<FlowNode[]>([]);
  const edgesSnapshotRef = useRef<FlowEdge[]>([]);

  // Helper to add timeline event
  const addTimelineEvent = useCallback((event: Omit<TimelineEvent, 'id' | 'timestamp'>) => {
    setTimeline(prev => [...prev, {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }]);
  }, []);

  // Start a new flow - always starts simple
  const startFlow = useCallback((query: string) => {
    console.log('[AgentFlow] ========== START FLOW ==========');
    console.log('[AgentFlow] Query:', query.substring(0, 50) + '...');

    setIsActive(true);
    setCurrentPhase('user_query');
    startTimeRef.current = Date.now();
    agentNodesRef.current.clear();
    agentCounterRef.current = 0;
    agentIdMapRef.current.clear();
    platformNodesRef.current.clear();
    platformToolsRef.current.clear();
    platformStartTimeRef.current.clear();
    toolStartTimeRef.current.clear();
    toolsUsedRef.current = [];
    isExpandedRef.current = false; // Reset to simple mode
    setTimeline([]);

    setTimeline([{
      id: `${Date.now()}-start`,
      timestamp: new Date(),
      type: 'query_start',
      title: 'Query Started',
      description: query,
      status: 'info',
    }]);

    // Start with simple flow: User → Orchestrator → Response
    const initialNodes = [
      {
        id: 'user',
        type: 'user',
        position: SIMPLE_LAYOUT.user,
        data: { label: 'User', status: 'completed', query },
      },
      {
        id: 'orchestrator',
        type: 'orchestrator',
        position: SIMPLE_LAYOUT.orchestrator,
        data: { label: 'Orchestrator', status: 'active' },
      },
      {
        id: 'response',
        type: 'response',
        position: SIMPLE_LAYOUT.response,
        data: { label: 'Response', status: 'idle' },
      },
    ];

    const initialEdges: FlowEdge[] = [
      {
        id: 'user-orchestrator',
        source: 'user',
        target: 'orchestrator',
        type: 'animated',
        data: { status: 'active' as const },
      },
      {
        id: 'orchestrator-response',
        source: 'orchestrator',
        target: 'response',
        type: 'animated',
        data: { status: 'idle' as const },
      },
    ];

    console.log('[AgentFlow] Setting initial nodes:', initialNodes.map(n => n.id));
    console.log('[AgentFlow] Setting initial edges:', initialEdges.map(e => e.id));

    setNodes(initialNodes as FlowNode[]);
    setEdges(initialEdges);
  }, []);

  // Helper to convert enterprise agent type
  const toFlowAgentType = (type: EnterpriseAgentType): AgentType => {
    switch (type) {
      case 'knowledge': return 'knowledge';
      case 'implementation': return 'implementation';
      default: return 'tool';
    }
  };

  // Handle enterprise events
  const handleEnterpriseEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'workflow_start':
        setCurrentPhase('user_query');
        setIsActive(true);
        startTimeRef.current = Date.now();
        break;

      case 'agent_spawn': {
        if (event.agent_type === 'orchestrator') {
          setCurrentPhase('orchestrator_routing');
          setNodes(prev => prev.map(node =>
            node.id === 'orchestrator'
              ? { ...node, data: { ...node.data, status: 'active' as const } }
              : node
          ) as FlowNode[]);
          return;
        }

        const agentType = toFlowAgentType(event.agent_type);
        const nodeId = event.agent_id;
        setCurrentPhase('agent_processing');

        if (!agentNodesRef.current.has(nodeId)) {
          agentNodesRef.current.add(nodeId);
          // Agent flow would need similar expansion logic if used
        }
        break;
      }

      case 'agent_thinking': {
        const nodeId = agentNodesRef.current.has(event.agent_id) ? event.agent_id : 'orchestrator';
        setNodes(prev => prev.map(node =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, status: 'active' as const, intent: event.metadata.thought } }
            : node
        ) as FlowNode[]);
        break;
      }

      case 'workflow_complete':
        setCurrentPhase('complete');
        setNodes(prev => prev.map(node => ({
          ...node,
          data: { ...node.data, status: 'completed' as const },
        })) as FlowNode[]);
        setEdges(prev => prev.map(edge => ({
          ...edge,
          data: { ...edge.data, status: 'completed' as const },
        })));
        setIsActive(false);
        break;
    }
  }, []);

  // Handle text_delta - response is being generated
  // HARDENED: Added node count verification to prevent state loss during rapid SSE events
  const handleTextDelta = useCallback(() => {
    console.log('[AgentFlow] TEXT_DELTA event');
    setCurrentPhase('response_generation');

    setNodes(prev => {
      const prevCount = prev.length;
      console.log('[AgentFlow] TEXT_DELTA: prev nodes:', prev.map(n => n.id));

      // Update snapshot before modification
      if (prev.length > nodesSnapshotRef.current.length) {
        nodesSnapshotRef.current = [...prev];
      }

      const updated = prev.map(node => {
        if (node.id === 'response') {
          return { ...node, data: { ...node.data, status: 'active' as const } };
        }
        if (node.id === 'orchestrator') {
          return { ...node, data: { ...node.data, status: 'completed' as const, intent: undefined } };
        }
        if (node.id === 'correlating') {
          return { ...node, data: { ...node.data, status: 'active' as const } };
        }
        // Explicitly spread platform and other nodes to prevent stale references
        return { ...node };
      }) as FlowNode[];

      // Verify no nodes were lost
      if (updated.length !== prevCount) {
        console.error('[AgentFlow] TEXT_DELTA: Node count mismatch!', {
          prev: prevCount,
          updated: updated.length,
          snapshot: nodesSnapshotRef.current.length,
        });
        // Restore from snapshot if we lost nodes
        if (nodesSnapshotRef.current.length > updated.length) {
          console.warn('[AgentFlow] TEXT_DELTA: Restoring from snapshot');
          return nodesSnapshotRef.current.map(node => {
            if (node.id === 'response') {
              return { ...node, data: { ...node.data, status: 'active' as const } };
            }
            if (node.id === 'orchestrator') {
              return { ...node, data: { ...node.data, status: 'completed' as const, intent: undefined } };
            }
            if (node.id === 'correlating') {
              return { ...node, data: { ...node.data, status: 'active' as const } };
            }
            return { ...node };
          }) as FlowNode[];
        }
      }

      console.log('[AgentFlow] TEXT_DELTA: updated nodes:', updated.map(n => n.id));
      nodesSnapshotRef.current = updated;
      return updated;
    });

    setEdges(prev => {
      const prevCount = prev.length;
      console.log('[AgentFlow] TEXT_DELTA: prev edges:', prev.map(e => e.id));

      // Update snapshot before modification
      if (prev.length > edgesSnapshotRef.current.length) {
        edgesSnapshotRef.current = [...prev];
      }

      const updated = prev.map(edge => {
        // Activate edges going to correlating and to response
        if (edge.target === 'correlating' || edge.target === 'response') {
          return { ...edge, data: { ...edge.data, status: 'active' as const } };
        }
        // In simple mode, activate orchestrator→response
        if (edge.id === 'orchestrator-response') {
          return { ...edge, data: { ...edge.data, status: 'active' as const } };
        }
        return { ...edge };
      });

      // Verify no edges were lost
      if (updated.length !== prevCount) {
        console.error('[AgentFlow] TEXT_DELTA: Edge count mismatch!', {
          prev: prevCount,
          updated: updated.length,
        });
        if (edgesSnapshotRef.current.length > updated.length) {
          console.warn('[AgentFlow] TEXT_DELTA: Restoring edges from snapshot');
          return edgesSnapshotRef.current.map(edge => {
            if (edge.target === 'correlating' || edge.target === 'response') {
              return { ...edge, data: { ...edge.data, status: 'active' as const } };
            }
            if (edge.id === 'orchestrator-response') {
              return { ...edge, data: { ...edge.data, status: 'active' as const } };
            }
            return { ...edge };
          });
        }
      }

      console.log('[AgentFlow] TEXT_DELTA: updated edges:', updated.map(e => e.id));
      edgesSnapshotRef.current = updated;
      return updated;
    });
  }, []);

  // Handle SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    if (isEnterpriseEvent(event)) {
      handleEnterpriseEvent(event);
      return;
    }

    switch (event.type) {
      case 'thinking':
        console.log('[AgentFlow] THINKING event');
        setCurrentPhase('orchestrator_routing');
        addTimelineEvent({
          type: 'thinking',
          title: 'Analyzing Request',
          description: 'Understanding user intent and determining required data sources...',
          status: 'info',
        });
        setNodes(prev => {
          console.log('[AgentFlow] THINKING: prev nodes:', prev.map(n => n.id));
          const updated = prev.map(node =>
            node.id === 'orchestrator'
              ? { ...node, data: { ...node.data, status: 'active' as const } }
              : node
          ) as FlowNode[];
          console.log('[AgentFlow] THINKING: updated nodes:', updated.map(n => n.id));
          return updated;
        });
        break;

      case 'tool_use_start': {
        const toolName = event.tool || '';
        toolStartTimeRef.current.set(toolName, Date.now());
        toolsUsedRef.current.push(toolName);

        const reasoning = getToolReasoning(toolName);
        addTimelineEvent({
          type: 'tool_start',
          title: reasoning.action,
          description: reasoning.reason,
          status: 'info',
          toolName,
        });

        const platform = getPlatformFromTool(event.tool || '');
        console.log('[AgentFlow] tool_use_start:', toolName, '-> platform:', platform);

        if (platform) {
          setCurrentPhase('agent_processing');
          const platformNodeId = `platform-${platform}`;
          const isNewPlatform = !platformNodesRef.current.has(platform);
          const needsExpansion = !isExpandedRef.current;

          // Mark as expanded BEFORE state updates to prevent race conditions
          if (needsExpansion) {
            isExpandedRef.current = true;
            console.log('[AgentFlow] Expanding flow for first platform:', platform);
          }

          if (isNewPlatform) {
            platformNodesRef.current.add(platform);
            platformToolsRef.current.set(platform, [event.tool || '']);
            platformStartTimeRef.current.set(platform, Date.now());

            const platformIndex = platformNodesRef.current.size - 1;
            const totalPlatforms = platformNodesRef.current.size;
            const position = calculatePlatformPosition(platformIndex, totalPlatforms);

            // Handle nodes - expand positions if needed AND add new platform
            setNodes(prev => {
              console.log('[AgentFlow] TOOL_USE_START setNodes - prev:', prev.map(n => n.id));
              console.log('[AgentFlow] TOOL_USE_START - needsExpansion:', needsExpansion, 'platform:', platform);

              let updatedNodes: FlowNode[] = [];

              if (needsExpansion) {
                console.log('[AgentFlow] Expanding layout...');
                // Expand existing nodes to new positions
                for (const node of prev) {
                  if (node.id === 'user') {
                    updatedNodes.push({ ...node, position: EXPANDED_LAYOUT.user } as FlowNode);
                  } else if (node.id === 'orchestrator') {
                    updatedNodes.push({
                      ...node,
                      position: EXPANDED_LAYOUT.orchestrator,
                      data: { ...node.data, label: 'Routing', phase: 'routing', status: 'active' as const },
                    } as FlowNode);
                  } else if (node.id === 'response') {
                    updatedNodes.push({ ...node, position: EXPANDED_LAYOUT.response } as FlowNode);
                  } else {
                    updatedNodes.push(node);
                  }
                }
                // Add correlating orchestrator
                updatedNodes.push({
                  id: 'correlating',
                  type: 'orchestrator',
                  position: EXPANDED_LAYOUT.correlating,
                  data: { label: 'Correlating', status: 'idle' as const, phase: 'correlating' },
                } as FlowNode);
                console.log('[AgentFlow] After expansion, nodes:', updatedNodes.map(n => n.id));
              } else {
                // Just update orchestrator status
                updatedNodes = prev.map(node => {
                  if (node.id === 'orchestrator') {
                    return { ...node, data: { ...node.data, status: 'active' as const } };
                  }
                  return node;
                }) as FlowNode[];
              }

              // Add the new platform node
              updatedNodes.push({
                id: platformNodeId,
                type: 'platform',
                position,
                data: {
                  label: PLATFORMS[platform].name,
                  status: 'active',
                  platform,
                  currentTool: event.tool,
                  toolsExecuted: event.tool ? [event.tool] : [],
                },
              });

              // Recalculate all platform positions
              const allPlatformIds = Array.from(platformNodesRef.current).map(p => `platform-${p}`);
              const finalNodes = recalculatePlatformPositions(updatedNodes, allPlatformIds);
              console.log('[AgentFlow] TOOL_USE_START final nodes:', finalNodes.map(n => n.id));
              return finalNodes;
            });

            // Handle edges - expand structure if needed AND add platform edges
            setEdges(prev => {
              let newEdges: FlowEdge[] = [];

              if (needsExpansion) {
                // Keep user→orchestrator, remove orchestrator→response
                for (const edge of prev) {
                  if (edge.id === 'user-orchestrator') {
                    newEdges.push(edge);
                  }
                  // Remove orchestrator-response - we'll route through correlating now
                }
                // Add correlating→response edge
                newEdges.push({
                  id: 'correlating-response',
                  source: 'correlating',
                  target: 'response',
                  type: 'animated',
                  data: { status: 'idle' as const },
                });
              } else {
                newEdges = [...prev];
              }

              // Add orchestrator → platform edge
              if (!newEdges.some(e => e.id === `orchestrator-${platformNodeId}`)) {
                newEdges.push({
                  id: `orchestrator-${platformNodeId}`,
                  source: 'orchestrator',
                  target: platformNodeId,
                  type: 'animated',
                  data: { status: 'active' as const },
                });
              }

              // Add platform → correlating edge
              if (!newEdges.some(e => e.id === `${platformNodeId}-correlating`)) {
                newEdges.push({
                  id: `${platformNodeId}-correlating`,
                  source: platformNodeId,
                  target: 'correlating',
                  type: 'animated',
                  data: { status: 'idle' as const },
                });
              }

              console.log('[AgentFlow] Edges after platform add:', newEdges.map(e => e.id));
              return newEdges;
            });
          } else {
            // Update existing platform
            const tools = platformToolsRef.current.get(platform) || [];
            tools.push(event.tool || '');
            platformToolsRef.current.set(platform, tools);

            setNodes(prev => prev.map(node => {
              if (node.id === platformNodeId) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    status: 'active' as const,
                    currentTool: event.tool,
                    toolsExecuted: [...tools],
                  },
                };
              }
              return node;
            }) as FlowNode[]);
          }
        } else {
          // Unknown tool - show on orchestrator
          console.log('[AgentFlow] Unknown platform for tool:', toolName);
          setCurrentPhase('orchestrator_routing');
          setNodes(prev => prev.map(node =>
            node.id === 'orchestrator'
              ? { ...node, data: { ...node.data, status: 'active' as const, intent: `Using tool: ${event.tool}` } }
              : node
          ) as FlowNode[]);
        }
        break;
      }

      case 'tool_use_complete': {
        const toolName = event.tool || '';
        const toolStartTime = toolStartTimeRef.current.get(toolName);
        const toolDuration = toolStartTime ? Date.now() - toolStartTime : undefined;
        toolStartTimeRef.current.delete(toolName);

        const reasoning = getToolReasoning(toolName);
        addTimelineEvent({
          type: 'tool_complete',
          title: reasoning.action.replace('Retrieving', 'Retrieved').replace('Fetching', 'Fetched').replace('Executing', 'Executed').replace('Analyzing', 'Analyzed'),
          description: event.success
            ? (toolDuration ? `Completed in ${toolDuration < 1000 ? `${toolDuration}ms` : `${(toolDuration/1000).toFixed(1)}s`}` : 'Completed')
            : 'Failed',
          status: event.success ? 'success' : 'error',
          toolName,
          duration: toolDuration,
        });

        const platform = getPlatformFromTool(event.tool || '');
        if (platform) {
          const platformNodeId = `platform-${platform}`;
          const startTime = platformStartTimeRef.current.get(platform);
          const duration = startTime ? Date.now() - startTime : undefined;
          const tools = platformToolsRef.current.get(platform) || [];

          setNodes(prev => prev.map(node => {
            if (node.id === platformNodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  currentTool: undefined,
                  toolsExecuted: tools,
                  duration,
                },
              };
            }
            return node;
          }) as FlowNode[]);
        } else {
          setNodes(prev => prev.map(node =>
            node.id === 'orchestrator'
              ? { ...node, data: { ...node.data, intent: undefined } }
              : node
          ) as FlowNode[]);
        }
        break;
      }

      case 'text_delta':
        handleTextDelta();
        break;

      case 'done': {
        const totalDuration = startTimeRef.current ? Date.now() - startTimeRef.current : undefined;
        const totalToolsUsed = toolsUsedRef.current.length;
        const platformCount = platformNodesRef.current.size;

        // PHASE 2.1: Sync isExpandedRef based on actual platform count
        // This fixes race conditions where isExpandedRef might be out of sync
        const hasPlatformNodes = platformNodesRef.current.size > 0;
        if (hasPlatformNodes && !isExpandedRef.current) {
          console.warn('[AgentFlow] Done: Fixing isExpandedRef inconsistency - platforms exist but ref was false');
          isExpandedRef.current = true;
        }
        const isExpanded = isExpandedRef.current;

        console.log('[AgentFlow] Done event - isExpanded:', isExpanded, 'platforms:', Array.from(platformNodesRef.current));

        addTimelineEvent({
          type: 'query_complete',
          title: 'Response Generated',
          description: totalToolsUsed > 0
            ? `Analysis complete using ${totalToolsUsed} tool${totalToolsUsed !== 1 ? 's' : ''} across ${platformCount} platform${platformCount !== 1 ? 's' : ''}`
            : 'Response generated',
          status: 'success',
          duration: totalDuration,
          details: {
            inputTokens: event.usage?.input_tokens,
            outputTokens: event.usage?.output_tokens,
            toolsUsed: totalToolsUsed,
            platforms: Array.from(platformNodesRef.current),
          },
        });

        setCurrentPhase('complete');

        // PHASE 2.2: Mark all nodes as completed AND verify/restore missing nodes
        setNodes(prev => {
          console.log('[AgentFlow] Done: current nodes:', prev.map(n => n.id));
          let updatedNodes = [...prev];

          // Ensure orchestrator node exists
          if (!updatedNodes.find(n => n.id === 'orchestrator')) {
            console.warn('[AgentFlow] Done: Orchestrator missing, restoring');
            updatedNodes.push({
              id: 'orchestrator',
              type: 'orchestrator',
              position: isExpanded ? EXPANDED_LAYOUT.orchestrator : SIMPLE_LAYOUT.orchestrator,
              data: { label: isExpanded ? 'Routing' : 'Orchestrator', status: 'completed' as const },
            } as FlowNode);
          }

          // Ensure correlating node exists if expanded
          if (isExpanded && !updatedNodes.find(n => n.id === 'correlating')) {
            console.warn('[AgentFlow] Done: Correlating missing, restoring');
            updatedNodes.push({
              id: 'correlating',
              type: 'orchestrator',
              position: EXPANDED_LAYOUT.correlating,
              data: { label: 'Correlating', status: 'completed' as const, phase: 'correlating' },
            } as FlowNode);
          }

          // Ensure user node exists
          if (!updatedNodes.find(n => n.id === 'user')) {
            console.warn('[AgentFlow] Done: User missing, restoring');
            updatedNodes.push({
              id: 'user',
              type: 'user',
              position: isExpanded ? EXPANDED_LAYOUT.user : SIMPLE_LAYOUT.user,
              data: { label: 'User', status: 'completed' as const, query: '' },
            } as FlowNode);
          }

          // Ensure response node exists
          if (!updatedNodes.find(n => n.id === 'response')) {
            console.warn('[AgentFlow] Done: Response missing, restoring');
            updatedNodes.push({
              id: 'response',
              type: 'response',
              position: isExpanded ? EXPANDED_LAYOUT.response : SIMPLE_LAYOUT.response,
              data: { label: 'Response', status: 'completed' as const },
            } as FlowNode);
          }

          // Now mark all nodes as completed
          const finalNodes = updatedNodes.map(node => {
            if (node.type === 'platform') {
              const platformData = node.data as PlatformNodeData;
              const platform = platformData.platform;
              const startTime = platformStartTimeRef.current.get(platform);
              const duration = startTime ? Date.now() - startTime : undefined;
              const tools = platformToolsRef.current.get(platform) || [];
              return {
                ...node,
                data: {
                  ...node.data,
                  status: 'completed' as const,
                  currentTool: undefined,
                  toolsExecuted: tools,
                  duration,
                },
              };
            }
            return {
              ...node,
              data: {
                ...node.data,
                status: 'completed' as const,
                intent: undefined,
              },
            };
          }) as FlowNode[];

          console.log('[AgentFlow] Done: final nodes:', finalNodes.map(n => n.id));
          // Update snapshot for integrity
          nodesSnapshotRef.current = finalNodes;
          return finalNodes;
        });

        // PHASE 2.3: Deterministic edge reconstruction - build complete edge set from scratch
        setEdges(() => {
          const platformIds = Array.from(platformNodesRef.current);
          const requiredEdges: FlowEdge[] = [];

          // Always need user → orchestrator
          requiredEdges.push({
            id: 'user-orchestrator',
            source: 'user',
            target: 'orchestrator',
            type: 'animated',
            data: { status: 'completed' as const },
          });

          if (isExpanded && platformIds.length > 0) {
            // Expanded mode: orchestrator → platforms → correlating → response
            for (const platform of platformIds) {
              const platformNodeId = `platform-${platform}`;

              // orchestrator → platform
              requiredEdges.push({
                id: `orchestrator-${platformNodeId}`,
                source: 'orchestrator',
                target: platformNodeId,
                type: 'animated',
                data: { status: 'completed' as const },
              });

              // platform → correlating
              requiredEdges.push({
                id: `${platformNodeId}-correlating`,
                source: platformNodeId,
                target: 'correlating',
                type: 'animated',
                data: { status: 'completed' as const },
              });
            }

            // correlating → response
            requiredEdges.push({
              id: 'correlating-response',
              source: 'correlating',
              target: 'response',
              type: 'animated',
              data: { status: 'completed' as const },
            });
          } else {
            // Simple mode: orchestrator → response
            requiredEdges.push({
              id: 'orchestrator-response',
              source: 'orchestrator',
              target: 'response',
              type: 'animated',
              data: { status: 'completed' as const },
            });
          }

          console.log('[AgentFlow] Done: deterministically built edges:', requiredEdges.map(e => e.id));
          // Update snapshot for integrity
          edgesSnapshotRef.current = requiredEdges;
          return requiredEdges;
        });

        // Set isActive false AFTER state updates
        setIsActive(false);
        break;
      }

      case 'error':
        setCurrentPhase('complete');
        setNodes(prev => prev.map(node => ({
          ...node,
          data: { ...node.data, status: 'error' as const },
        })) as FlowNode[]);
        setEdges(prev => prev.map(edge => ({
          ...edge,
          data: { ...edge.data, status: 'idle' as const },
        })));
        setIsActive(false);
        break;
    }
  }, [handleEnterpriseEvent, handleTextDelta, addTimelineEvent]);

  // Reset the flow
  const resetFlow = useCallback(() => {
    setNodes(createSimpleNodes());
    setEdges(createSimpleEdges());
    setIsActive(false);
    setCurrentPhase('idle');
    setTimeline([]);
    agentNodesRef.current.clear();
    startTimeRef.current = null;
    agentCounterRef.current = 0;
    agentIdMapRef.current.clear();
    platformNodesRef.current.clear();
    platformToolsRef.current.clear();
    platformStartTimeRef.current.clear();
    toolStartTimeRef.current.clear();
    toolsUsedRef.current = [];
    isExpandedRef.current = false;
  }, []);

  // Get current flow state for persistence
  const getFlowState = useCallback((): PersistedAgentFlowState | undefined => {
    // Don't persist if in idle state with no content
    if (currentPhase === 'idle' && nodes.length <= 3) {
      return undefined;
    }

    // Serialize timeline events (convert Date to ISO string)
    const serializedTimeline: SerializedTimelineEvent[] = timeline.map(event => ({
      ...event,
      timestamp: event.timestamp.toISOString(),
    }));

    const duration = startTimeRef.current ? Date.now() - startTimeRef.current : undefined;

    return {
      nodes,
      edges,
      currentPhase,
      timeline: serializedTimeline,
      isExpanded: isExpandedRef.current,
      platformNodes: Array.from(platformNodesRef.current),
      toolsUsed: [...toolsUsedRef.current],
      duration,
    };
  }, [nodes, edges, currentPhase, timeline]);

  // Restore flow from persisted state
  const restoreFlow = useCallback((savedState: PersistedAgentFlowState) => {
    console.log('[AgentFlow] Restoring flow state:', {
      nodeCount: savedState.nodes.length,
      edgeCount: savedState.edges.length,
      phase: savedState.currentPhase,
      isExpanded: savedState.isExpanded,
      platforms: savedState.platformNodes,
    });

    // Restore nodes and edges
    setNodes(savedState.nodes);
    setEdges(savedState.edges);
    setCurrentPhase(savedState.currentPhase);
    setIsActive(false); // Restored state is never active

    // Restore timeline (convert ISO strings back to Date objects)
    const restoredTimeline: TimelineEvent[] = savedState.timeline.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp),
    }));
    setTimeline(restoredTimeline);

    // Restore refs
    isExpandedRef.current = savedState.isExpanded;
    platformNodesRef.current = new Set(savedState.platformNodes as PlatformId[]);
    toolsUsedRef.current = [...savedState.toolsUsed];

    // Restore platform tools ref from the nodes
    platformToolsRef.current.clear();
    for (const node of savedState.nodes) {
      if (node.type === 'platform') {
        const platformData = node.data as PlatformNodeData;
        platformToolsRef.current.set(platformData.platform, platformData.toolsExecuted || []);
      }
    }

    // Update snapshots
    nodesSnapshotRef.current = savedState.nodes;
    edgesSnapshotRef.current = savedState.edges;

    console.log('[AgentFlow] Flow state restored successfully');
  }, []);

  return {
    nodes,
    edges,
    isActive,
    currentPhase,
    timeline,
    startFlow,
    handleEvent,
    resetFlow,
    getFlowState,
    restoreFlow,
  };
}

export default useAgentFlow;
