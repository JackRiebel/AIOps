"""A2A Agent Orchestrator - intelligent routing between agents.

The orchestrator replaces hardcoded routing logic with dynamic
capability-based routing using the A2A protocol.

Enhanced with:
- Conversation memory for multi-turn context
- Intent classification for nuanced routing
- Feedback tracking for routing improvement
- Parallel agent consultation for complex queries
- Structured workflows with artifact passing (2025 best practices)
- Explicit collaboration prompts
- Monitoring and debugging for collaboration
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Callable, Awaitable, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from .types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    A2AMessage,
    A2ATask,
    TaskState,
    TaskStatus,
    TextPart,
    DataPart,
)
from .registry import AgentRegistry, get_agent_registry
from .memory import (
    ConversationMemory,
    IntentClassifier,
    RoutingFeedbackTracker,
    QueryIntent,
    get_conversation_memory,
    get_intent_classifier,
    get_feedback_tracker,
)
from .collaboration import (
    ArtifactType,
    CollaborationArtifact,
    ArtifactStore,
    WorkflowStep,
    WorkflowDefinition,
    WorkflowState,
    INTENT_WORKFLOWS,
    CollaborationPromptBuilder,
    CollaborationOrchestrator,
    CollaborationFeedback,
    CollaborationFeedbackTracker,
    CollaborationLogger,
    get_artifact_store,
    get_collaboration_orchestrator,
    get_collaboration_feedback_tracker,
    get_collaboration_logger,
)

logger = logging.getLogger(__name__)


@dataclass
class RoutingDecision:
    """Result of the routing decision process."""
    primary_agent: Optional[AgentCard] = None
    secondary_agents: List[AgentCard] = field(default_factory=list)
    reasoning: str = ""
    should_consult_knowledge: bool = False
    should_query_api: bool = False
    # Enhanced routing info
    classified_intent: Optional[QueryIntent] = None
    requires_parallel_consultation: bool = False
    conversation_context: Optional[Dict[str, Any]] = None


class AgentOrchestrator:
    """Orchestrates communication between multiple agents.

    The orchestrator's job is to:
    1. Analyze incoming user queries
    2. Use the registry to find capable agents
    3. Route messages to the appropriate agent(s)
    4. Combine responses when multiple agents are involved
    5. Provide routing transparency (explain why agents were chosen)

    Enhanced capabilities:
    - Conversation memory across multi-turn conversations
    - Intent classification for nuanced routing
    - Feedback tracking for routing improvement
    - Parallel agent consultation for complex queries
    """

    # Intents that benefit from parallel consultation
    PARALLEL_CONSULTATION_INTENTS = {
        QueryIntent.BEST_PRACTICES,    # Get best practices + current state
        QueryIntent.TROUBLESHOOTING,   # Get guidance + actual data
        QueryIntent.COMPARISON,        # Compare knowledge + actual config
        QueryIntent.AUDIT,             # Best practices + current compliance
    }

    def __init__(self, registry: Optional[AgentRegistry] = None):
        self.registry = registry or get_agent_registry()
        self.memory = get_conversation_memory()
        self.intent_classifier = get_intent_classifier()
        self.feedback_tracker = get_feedback_tracker()

        # Enhanced collaboration components (2025 best practices)
        self.artifact_store = get_artifact_store()
        self.collab_orchestrator = get_collaboration_orchestrator()
        self.collab_feedback = get_collaboration_feedback_tracker()
        self.collab_logger = get_collaboration_logger()

    def analyze_and_route(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> RoutingDecision:
        """Analyze a query and decide which agent(s) should handle it.

        This method uses the registry's skill matching to dynamically
        determine the best routing, rather than hardcoded rules.

        Enhanced with:
        - Intent classification for nuanced routing
        - Conversation memory for context-aware routing
        - Feedback-based priority adjustments
        - Parallel consultation detection

        Args:
            query: The user's query
            context: Optional context (environment state, conversation history, etc.)
            session_id: Optional session ID for conversation memory

        Returns:
            RoutingDecision with primary and secondary agents
        """
        decision = RoutingDecision()

        # Step 1: Classify the query intent
        conversation_context = None
        if session_id:
            conversation_context = self.memory.get_or_create_session(session_id)

        classified_intent = self.intent_classifier.classify(query, conversation_context)
        decision.classified_intent = classified_intent

        # Record intent in conversation memory
        if session_id:
            self.memory.record_intent(session_id, classified_intent)

            # Extract and record topics
            topics = self.intent_classifier.extract_topics(query)
            for topic in topics:
                self.memory.record_topic(session_id, topic)

            # Get conversation context summary
            decision.conversation_context = self.memory.get_context_summary(session_id)

        logger.info(f"[A2A Orchestrator] Intent classified as: {classified_intent.value}")

        # Step 2: Find agents that can handle this query
        ranked_agents = self.registry.find_agents_for_query(query, context)

        # Step 3: Apply feedback-based priority adjustments
        if ranked_agents:
            adjusted_rankings = []
            for card, score in ranked_agents:
                adjustment = self.feedback_tracker.get_priority_adjustment(
                    card.id, classified_intent
                )
                adjusted_score = score * adjustment
                adjusted_rankings.append((card, adjusted_score))
                if adjustment != 1.0:
                    logger.debug(
                        f"[A2A Orchestrator] Adjusted {card.name} score: {score:.2f} -> {adjusted_score:.2f} "
                        f"(adjustment: {adjustment:.2f})"
                    )

            # Re-sort by adjusted scores
            ranked_agents = sorted(adjusted_rankings, key=lambda x: x[1], reverse=True)

        if not ranked_agents:
            decision.reasoning = "No agents matched the query. Will use default implementation agent."
            return decision

        # Step 4: Select primary agent (highest scoring)
        primary_card, primary_score = ranked_agents[0]
        decision.primary_agent = primary_card
        decision.reasoning = f"Primary: {primary_card.name} (score: {primary_score:.2f}, intent: {classified_intent.value})"

        # Step 5: Determine if parallel consultation is beneficial
        requires_parallel = classified_intent in self.PARALLEL_CONSULTATION_INTENTS
        decision.requires_parallel_consultation = requires_parallel

        if requires_parallel:
            decision.reasoning += f"\n  [Parallel consultation enabled for {classified_intent.value} intent]"

        # Step 6: Select secondary agents
        for card, score in ranked_agents[1:]:
            # Include agents with significant scores
            threshold = primary_score * 0.7 if not requires_parallel else primary_score * 0.5
            if score >= threshold:
                decision.secondary_agents.append(card)
                decision.reasoning += f"\n  Also consulting: {card.name} (score: {score:.2f})"

        # For parallel consultation intents, ensure we have both knowledge and implementation
        if requires_parallel:
            knowledge_in_secondary = any(a.role == "knowledge" for a in decision.secondary_agents)
            impl_in_secondary = any(a.role == "implementation" for a in decision.secondary_agents)

            # If primary is knowledge and no implementation agent, add one
            if primary_card.role == "knowledge" and not impl_in_secondary:
                impl_agents = self.registry.get_agents_by_role("implementation")
                if impl_agents:
                    decision.secondary_agents.append(impl_agents[0])
                    decision.reasoning += f"\n  Added {impl_agents[0].name} for parallel consultation"

            # If primary is implementation and no knowledge agent, add one
            elif primary_card.role == "implementation" and not knowledge_in_secondary:
                knowledge_agents = self.registry.get_agents_by_role("knowledge")
                if knowledge_agents:
                    decision.secondary_agents.insert(0, knowledge_agents[0])  # Knowledge first
                    decision.reasoning += f"\n  Added {knowledge_agents[0].name} for parallel consultation"

        # Step 7: Set consultation flags
        all_agents = [primary_card] + decision.secondary_agents
        knowledge_agents = [a for a in all_agents if a.role == "knowledge"]
        implementation_agents = [a for a in all_agents if a.role == "implementation"]

        decision.should_consult_knowledge = bool(knowledge_agents)
        decision.should_query_api = bool(implementation_agents)

        # Step 8: Record routing for feedback tracking
        self.feedback_tracker.record_routing(
            query=query,
            intent=classified_intent,
            primary_agent_id=primary_card.id,
            secondary_agent_ids=[a.id for a in decision.secondary_agents]
        )

        logger.info(f"[A2A Orchestrator] Routing decision: {decision.reasoning}")
        logger.info(
            f"[A2A Orchestrator] Consult knowledge: {decision.should_consult_knowledge}, "
            f"Query API: {decision.should_query_api}, Parallel: {decision.requires_parallel_consultation}"
        )

        return decision

    def build_agent_aware_prompt(
        self,
        query: str,
        decision: RoutingDecision,
        session_id: Optional[str] = None
    ) -> str:
        """Build a prompt that informs the implementation agent about routing.

        Instead of hardcoding instructions, we dynamically generate them
        based on the routing decision and available agents.

        CRITICAL: For knowledge-based queries, we need a multi-step workflow:
        1. FIRST gather network context (devices, VLANs, SSIDs, etc.)
        2. THEN consult Knowledge Agent with that context
        3. FINALLY synthesize recommendations with actual environment data
        """
        from .memory import QueryIntent

        # CRITICAL: For STATUS_CHECK queries (simple data requests), skip workflow injection
        # Let the model call tools directly without guidance that encourages explanation
        if decision.classified_intent == QueryIntent.STATUS_CHECK:
            return ""  # No guidance needed - just let tools be called

        lines = []

        # Include conversation context if available
        if decision.conversation_context and decision.conversation_context.get("has_context"):
            ctx = decision.conversation_context
            lines.append("**CONVERSATION CONTEXT**")

            if ctx.get("current_network"):
                net = ctx["current_network"]
                lines.append(f"Currently discussing network: {net['name']}" +
                           (f" (ID: {net['id']})" if net.get('id') else ""))

            if ctx.get("current_device"):
                dev = ctx["current_device"]
                lines.append(f"Currently discussing device: {dev['name']}" +
                           (f" (ID: {dev['id']})" if dev.get('id') else ""))

            if ctx.get("recent_entities"):
                entity_list = ", ".join([
                    f"{e['type']}:{e['name']}" for e in ctx["recent_entities"][:3]
                ])
                lines.append(f"Recently mentioned: {entity_list}")

            if ctx.get("topics_discussed"):
                lines.append(f"Topics discussed: {', '.join(ctx['topics_discussed'])}")

            if ctx.get("last_intent"):
                lines.append(f"Previous intent: {ctx['last_intent']}")

            lines.append("")

        # Show classified intent and routing info
        if decision.classified_intent:
            lines.append(f"**QUERY INTENT: {decision.classified_intent.value.upper()}**")
            lines.append("")

        # If parallel consultation is needed, explain the strategy
        if decision.requires_parallel_consultation:
            lines.append("**PARALLEL AGENT CONSULTATION STRATEGY**")
            lines.append("This query benefits from consulting multiple agents simultaneously:")
            for agent in [decision.primary_agent] + decision.secondary_agents:
                if agent:
                    lines.append(f"  - {agent.name} ({agent.role})")
            lines.append("")

        # If knowledge agent should be consulted, set up multi-agent workflow
        if decision.should_consult_knowledge and decision.primary_agent:
            if decision.primary_agent.role == "knowledge":
                # Extract network name from query or conversation context
                network_mention = self._extract_network_mention(query)

                # Try to get from conversation context if not in query
                if not network_mention and decision.conversation_context:
                    ctx_network = decision.conversation_context.get("current_network")
                    if ctx_network:
                        network_mention = ctx_network["name"]

                lines.append("**MULTI-AGENT COLLABORATION WORKFLOW**")
                lines.append(f"This query requires consulting the {decision.primary_agent.name}.")
                lines.append("")
                lines.append("**MANDATORY WORKFLOW - FOLLOW THESE STEPS IN ORDER:**")
                lines.append("")
                lines.append("**STEP 1: GATHER ENVIRONMENT CONTEXT FIRST**")

                if network_mention:
                    lines.append(f"   The user mentioned network: '{network_mention}'")
                    lines.append(f"   → Use `get_devices_in_network_by_name` with network_name='{network_mention}'")
                    lines.append(f"   → Use `get_network_by_name` to get network details and VLANs")
                    lines.append(f"   → Use `list_ssids` to see current wireless configuration")
                else:
                    lines.append("   → Use `list_networks` to identify relevant networks")
                    lines.append("   → Then gather devices, VLANs, and SSIDs for the target network")

                lines.append("")
                lines.append("**STEP 2: CONSULT KNOWLEDGE AGENT WITH CONTEXT**")
                lines.append("   → Call `consult_knowledge_agent` with:")
                lines.append("     - The user's question")
                lines.append("     - Include the environment context you gathered (devices, VLANs, current config)")
                lines.append("     - This allows the Knowledge Agent to give SPECIFIC recommendations")
                lines.append("")
                lines.append("**STEP 3: SYNTHESIZE RESPONSE**")
                lines.append("   → Combine the Knowledge Agent's best practices with actual environment data")
                lines.append("   → Provide specific, actionable recommendations for THIS network")
                lines.append("   → Reference actual device names, VLAN IDs, SSID names from the environment")
                lines.append("")
                lines.append("**EXAMPLE for 'How should I segment Riebel Home for better security?':**")
                lines.append("   1. First call get_devices_in_network_by_name('Riebel Home') to see devices")
                lines.append("   2. Call get_network_by_name('Riebel Home') for VLANs and config")
                lines.append("   3. Call consult_knowledge_agent with:")
                lines.append("      question='How should I segment a home network for security?'")
                lines.append("      context='Network has: MX68 router, 3 APs, smart home devices, VLANs: ...'")
                lines.append("   4. Present Knowledge Agent recommendations tailored to their actual setup")

        # If there are secondary agents, mention them
        if decision.secondary_agents:
            lines.append("")
            lines.append("**Additional Resources Available**:")
            for agent in decision.secondary_agents:
                lines.append(f"  - {agent.name}: {agent.description}")

        if lines:
            return "\n".join(lines)
        return ""

    def _extract_network_mention(self, query: str) -> Optional[str]:
        """Try to extract a network name from the query.

        Looks for patterns like:
        - "Riebel Home"
        - "my home network"
        - network names in quotes
        """
        import re

        # Look for quoted strings
        quoted = re.findall(r'["\']([^"\']+)["\']', query)
        if quoted:
            return quoted[0]

        # Look for common patterns: "segment X for", "configure X", "X network"
        patterns = [
            r'segment\s+(\w+(?:\s+\w+)?)\s+(?:for|network)',
            r'(?:my|the)\s+(\w+(?:\s+\w+)?)\s+network',
            r'network\s+(?:called|named)\s+(\w+(?:\s+\w+)?)',
        ]

        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1)

        # Check for known network name patterns (capitalized words that might be names)
        # Like "Riebel Home", "Office Network"
        name_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
        matches = re.findall(name_pattern, query)
        # Filter out common words
        common_words = {'How', 'What', 'Why', 'When', 'Where', 'Should', 'Best', 'The', 'For'}
        for match in matches:
            if match not in common_words and len(match) > 3:
                return match

        return None

    def get_routing_context_for_llm(self) -> str:
        """Generate routing context for the LLM's system prompt.

        This replaces hardcoded routing instructions with dynamically
        generated context based on registered agents.
        """
        lines = [
            "**INTELLIGENT AGENT ROUTING**",
            "",
            "You have access to multiple specialized agents. Route queries intelligently:",
            ""
        ]

        # Get all agents and organize by role
        all_agents = self.registry.get_all_agents()
        agents_by_role: Dict[str, List[AgentCard]] = {}

        for agent in all_agents:
            role = agent.role or "general"
            if role not in agents_by_role:
                agents_by_role[role] = []
            agents_by_role[role].append(agent)

        # Generate routing guidance for each role
        for role, agents in agents_by_role.items():
            for agent in agents:
                lines.append(f"## {agent.name}")
                lines.append(f"   Role: {role}")
                lines.append(f"   {agent.description}")
                lines.append("")
                lines.append("   Use for queries about:")
                for skill in agent.skills:
                    lines.append(f"   - {skill.name}")
                    for tag in skill.tags[:3]:  # Limit tags shown
                        lines.append(f"     (matches: {tag})")
                    if skill.examples:
                        lines.append(f"     Examples: \"{skill.examples[0]}\"")
                lines.append("")

        # Add general routing guidance
        lines.extend([
            "**ROUTING RULES**:",
            "1. For best practices, design, or 'how should I' questions → consult Knowledge Agent FIRST",
            "2. For status checks, device lists, or 'show me' queries → use API tools directly",
            "3. For troubleshooting → consult Knowledge Agent, THEN use API tools to verify",
            "4. When uncertain, consult the Knowledge Agent for guidance",
            "",
            "The system will help you route by providing skill matches for each query.",
        ])

        return "\n".join(lines)

    async def route_message(
        self,
        message: A2AMessage,
        agent_handlers: Dict[str, Callable[[A2AMessage], Awaitable[A2AMessage]]],
        session_id: Optional[str] = None
    ) -> A2ATask:
        """Route a message to the appropriate agent(s) and collect responses.

        This implements the full A2A message routing flow:
        1. Analyze the message to determine routing
        2. Send to primary agent (or parallel agents)
        3. Optionally send to secondary agents
        4. Combine and return results

        Enhanced with parallel agent consultation for complex queries.

        Args:
            message: The incoming message
            agent_handlers: Dict mapping agent_id to handler functions
            session_id: Optional session ID for conversation memory

        Returns:
            A2ATask containing the conversation and results
        """
        # Extract query text from message
        query = ""
        for part in message.parts:
            if isinstance(part, TextPart):
                query = part.text
                break

        # Analyze and route with session context
        decision = self.analyze_and_route(query, message.context, session_id)

        # Create task
        task = A2ATask()
        task.history.append(message)
        task.status = TaskStatus(state=TaskState.WORKING)

        # Determine which agents to consult
        all_agents = []
        if decision.primary_agent and decision.primary_agent.id in agent_handlers:
            all_agents.append(decision.primary_agent)
        for agent in decision.secondary_agents:
            if agent.id in agent_handlers:
                all_agents.append(agent)

        if not all_agents:
            task.status = TaskStatus(state=TaskState.COMPLETED, message="No agents available")
            return task

        # Choose sequential or parallel execution
        if decision.requires_parallel_consultation and len(all_agents) > 1:
            # Parallel consultation - query all agents simultaneously
            logger.info(
                f"[A2A Orchestrator] Parallel consultation with {len(all_agents)} agents: "
                f"{[a.name for a in all_agents]}"
            )
            responses = await self._consult_agents_parallel(message, all_agents, agent_handlers)

            for agent, response in responses:
                if response:
                    task.history.append(response)
                    task.handledBy.append(agent.id)
        else:
            # Sequential consultation - primary first, then secondaries
            if decision.primary_agent and decision.primary_agent.id in agent_handlers:
                try:
                    handler = agent_handlers[decision.primary_agent.id]
                    response = await handler(message)
                    if response:
                        task.history.append(response)
                        task.handledBy.append(decision.primary_agent.id)
                except Exception as e:
                    logger.error(f"[A2A Orchestrator] Error from primary agent: {e}")

            # Send to secondary agents if needed
            for agent in decision.secondary_agents:
                if agent.id in agent_handlers:
                    try:
                        handler = agent_handlers[agent.id]
                        response = await handler(message)
                        if response:
                            task.history.append(response)
                            task.handledBy.append(agent.id)
                    except Exception as e:
                        logger.error(f"[A2A Orchestrator] Error from secondary agent {agent.id}: {e}")

        task.status = TaskStatus(state=TaskState.COMPLETED)
        task.metadata["routing_decision"] = decision.reasoning
        task.metadata["classified_intent"] = decision.classified_intent.value if decision.classified_intent else None
        task.metadata["parallel_consultation"] = decision.requires_parallel_consultation

        return task

    async def _consult_agents_parallel(
        self,
        message: A2AMessage,
        agents: List[AgentCard],
        agent_handlers: Dict[str, Callable[[A2AMessage], Awaitable[A2AMessage]]]
    ) -> List[Tuple[AgentCard, Optional[A2AMessage]]]:
        """Consult multiple agents in parallel using asyncio.gather.

        Args:
            message: The message to send to all agents
            agents: List of agents to consult
            agent_handlers: Dict mapping agent_id to handler functions

        Returns:
            List of (AgentCard, response) tuples
        """
        async def call_agent(agent: AgentCard) -> Tuple[AgentCard, Optional[A2AMessage]]:
            """Wrapper to call a single agent and handle errors."""
            try:
                handler = agent_handlers[agent.id]
                response = await handler(message)
                logger.info(f"[A2A Orchestrator] Received response from {agent.name}")
                return (agent, response)
            except Exception as e:
                logger.error(f"[A2A Orchestrator] Error from {agent.name}: {e}")
                return (agent, None)

        # Create tasks for all agents
        tasks = [call_agent(agent) for agent in agents]

        # Execute all in parallel
        results = await asyncio.gather(*tasks, return_exceptions=False)

        return results

    def record_routing_feedback(
        self,
        success: bool,
        quality_score: Optional[float] = None,
        user_feedback: Optional[str] = None
    ) -> None:
        """Record feedback on the most recent routing decision.

        This allows the system to learn from routing outcomes and
        improve future routing decisions.

        Args:
            success: Whether the routing was successful
            quality_score: Optional quality score (0.0 - 1.0)
            user_feedback: Optional text feedback
        """
        # Get the most recent routing from history
        if self.feedback_tracker._history:
            latest = self.feedback_tracker._history[-1]
            self.feedback_tracker.record_feedback(
                feedback=latest,
                success=success,
                quality_score=quality_score,
                user_feedback=user_feedback
            )

    def get_routing_statistics(self) -> Dict[str, Any]:
        """Get statistics on routing decisions and their outcomes."""
        return self.feedback_tracker.get_statistics()

    # ==========================================================================
    # ENHANCED COLLABORATION METHODS (2025 Best Practices)
    # ==========================================================================

    async def execute_with_workflow(
        self,
        query: str,
        session_id: str,
        implementation_handler: Callable[[str], Awaitable[Dict[str, Any]]],
        knowledge_handler: Callable[[str, str], Awaitable[Dict[str, Any]]],
        event_callback: Optional[Callable[[str, Dict[str, Any]], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        """Execute a query using the structured workflow system.

        This method implements 2025 best practices for multi-agent collaboration:
        1. Intent classification to determine workflow
        2. Artifact passing between agents
        3. Explicit collaboration prompts
        4. Monitoring and debugging

        Args:
            query: The user's query
            session_id: Session ID for artifact storage
            implementation_handler: Async handler to call Implementation Agent
            knowledge_handler: Async handler to call Knowledge Agent
            event_callback: Optional callback for streaming events

        Returns:
            Dict with results, artifacts, and collaboration metadata
        """
        start_time = datetime.utcnow()

        # Step 1: Classify intent
        conversation_context = self.memory.get_or_create_session(session_id)
        intent = self.intent_classifier.classify(query, conversation_context)

        # Log workflow start
        self.collab_logger.log_event(session_id, "workflow_start", {
            "query": query[:100],
            "intent": intent.value
        })

        # Emit event if callback provided
        if event_callback:
            await event_callback("workflow_start", {
                "intent": intent.value,
                "query": query[:100]
            })

        # Step 2: Get workflow for intent
        workflow = self.collab_orchestrator.get_workflow_for_intent(intent)

        if not workflow:
            # No workflow defined - use simple routing
            logger.info(f"[Collaboration] No workflow for intent {intent.value}, using simple routing")
            return await self._execute_simple_routing(
                query, session_id, implementation_handler, knowledge_handler
            )

        # Step 3: Start workflow
        state = self.collab_orchestrator.start_workflow(session_id, intent)
        results = {
            "intent": intent.value,
            "workflow": workflow.description,
            "steps_completed": [],
            "artifacts": [],
            "agent_outputs": {},
            "synthesis": None
        }

        if event_callback:
            await event_callback("workflow_initialized", {
                "steps": [s.value for s in workflow.steps]
            })

        # Step 4: Execute each workflow step
        while not state.is_complete:
            step = state.current_step
            logger.info(f"[Collaboration] Executing step: {step.value}")

            if event_callback:
                await event_callback("step_start", {"step": step.value})

            artifact = await self.collab_orchestrator.execute_workflow_step(
                session_id=session_id,
                state=state,
                implementation_handler=implementation_handler,
                knowledge_handler=knowledge_handler,
                query=query
            )

            if artifact:
                results["artifacts"].append({
                    "type": artifact.artifact_type.value,
                    "source": artifact.source_agent,
                    "data_preview": str(artifact.data)[:200]
                })

                # Log artifact flow
                self.collab_logger.log_artifact_flow(
                    session_id=session_id,
                    artifact_id=artifact.id,
                    from_agent=artifact.source_agent,
                    to_agent="next_step",
                    artifact_type=artifact.artifact_type.value
                )

            results["steps_completed"].append(step.value)

            if event_callback:
                await event_callback("step_complete", {
                    "step": step.value,
                    "artifact_type": artifact.artifact_type.value if artifact else None
                })

        # Step 5: Check for conflicts
        conflicts = self.collab_orchestrator.check_for_conflicts(session_id)
        if conflicts:
            results["conflicts_detected"] = len(conflicts)
            self.collab_logger.log_event(session_id, "conflicts_detected", {
                "count": len(conflicts),
                "details": conflicts[:3]
            })

        # Step 6: Synthesize final response
        synthesis_artifact = self.artifact_store.get_latest_artifact_of_type(
            session_id, ArtifactType.SYNTHESIS
        )
        if synthesis_artifact:
            results["synthesis"] = synthesis_artifact.data

        # Step 7: Record collaboration feedback
        duration = (datetime.utcnow() - start_time).total_seconds()
        feedback = CollaborationFeedback(
            session_id=session_id,
            workflow_intent=intent,
            total_duration_seconds=duration,
            steps_executed=len(results["steps_completed"]),
            artifacts_produced=len(results["artifacts"]),
            conflicts_detected=len(conflicts) if conflicts else 0
        )
        self.collab_feedback.record_collaboration(feedback)

        # Log workflow completion
        self.collab_logger.log_event(session_id, "workflow_complete", {
            "steps": len(results["steps_completed"]),
            "artifacts": len(results["artifacts"]),
            "duration_seconds": duration
        })

        if event_callback:
            await event_callback("workflow_complete", {
                "duration_seconds": duration,
                "steps_completed": results["steps_completed"]
            })

        return results

    async def _execute_simple_routing(
        self,
        query: str,
        session_id: str,
        implementation_handler: Callable[[str], Awaitable[Dict[str, Any]]],
        knowledge_handler: Callable[[str, str], Awaitable[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Execute simple routing when no workflow is defined."""
        decision = self.analyze_and_route(query, session_id=session_id)

        results = {
            "intent": decision.classified_intent.value if decision.classified_intent else "unknown",
            "routing_decision": decision.reasoning,
            "agent_outputs": {}
        }

        # Determine which agents to call
        if decision.should_consult_knowledge:
            knowledge_result = await knowledge_handler(query, "")
            results["agent_outputs"]["knowledge"] = knowledge_result

        if decision.should_query_api:
            impl_result = await implementation_handler(query)
            results["agent_outputs"]["implementation"] = impl_result

        return results

    def get_collaboration_prompt_for_agent(
        self,
        session_id: str,
        agent_role: str,
        workflow_step: Optional[WorkflowStep] = None
    ) -> str:
        """Get collaboration-aware prompt for an agent.

        Uses the CollaborationPromptBuilder to generate prompts with:
        - Role-specific instructions
        - Artifact context from other agents
        - Anti-duplication reminders

        Args:
            session_id: Session ID for artifact lookup
            agent_role: "knowledge" or "implementation"
            workflow_step: Current workflow step (for special instructions)

        Returns:
            Collaboration prompt string
        """
        return self.collab_orchestrator.get_collaboration_context_for_prompt(
            session_id=session_id,
            agent_role=agent_role,
            workflow_step=workflow_step
        )

    def add_artifact(
        self,
        session_id: str,
        artifact_type: ArtifactType,
        source_agent: str,
        data: Dict[str, Any],
        target_agent: Optional[str] = None
    ) -> CollaborationArtifact:
        """Add an artifact to the collaboration store.

        This allows external code (like the streaming endpoint) to pass
        data between agents during a conversation.

        Args:
            session_id: Session ID
            artifact_type: Type of artifact
            source_agent: Agent that created this artifact
            data: Artifact data
            target_agent: Optional specific target (None = broadcast)

        Returns:
            The created artifact
        """
        import uuid
        artifact = CollaborationArtifact(
            id=f"{artifact_type.value}_{uuid.uuid4().hex[:8]}",
            artifact_type=artifact_type,
            source_agent=source_agent,
            target_agent=target_agent,
            data=data
        )
        self.artifact_store.add_artifact(session_id, artifact)

        self.collab_logger.log_artifact_flow(
            session_id=session_id,
            artifact_id=artifact.id,
            from_agent=source_agent,
            to_agent=target_agent or "all",
            artifact_type=artifact_type.value
        )

        return artifact

    def get_collaboration_statistics(self) -> Dict[str, Any]:
        """Get comprehensive collaboration statistics."""
        routing_stats = self.feedback_tracker.get_statistics()
        collab_stats = self.collab_feedback.get_collaboration_statistics()

        return {
            "routing": routing_stats,
            "collaboration": collab_stats
        }

    def clear_session_artifacts(self, session_id: str) -> None:
        """Clear all artifacts for a session."""
        self.artifact_store.clear_session(session_id)
        logger.info(f"[Collaboration] Cleared artifacts for session {session_id}")


# Pre-defined Agent Cards for the system

def create_knowledge_agent_card() -> AgentCard:
    """Create the Agent Card for the Knowledge Agent."""
    return AgentCard(
        id="knowledge-agent",
        name="Cisco Knowledge Agent",
        description="Expert on Cisco networking documentation, best practices, and design guides. "
                    "Uses RAG with a vector-indexed knowledge base of Meraki, Catalyst, and other "
                    "Cisco product documentation. Powered by Cisco Circuit AI.",
        provider=AgentProvider(
            organization="Cisco",
            url="https://developer.cisco.com"
        ),
        role="knowledge",
        priority=10,  # High priority for knowledge queries
        skills=[
            AgentSkill(
                id="best-practices",
                name="Network Best Practices",
                description="Provide expert recommendations for network design, security, "
                           "and configuration following Cisco Validated Designs (CVDs).",
                tags=["best-practices", "design", "security", "architecture"],
                examples=[
                    "How should I segment my network for better security?",
                    "What's the best VLAN structure for IoT devices?",
                    "What are the recommended security settings for guest WiFi?",
                ]
            ),
            AgentSkill(
                id="troubleshooting-guidance",
                name="Troubleshooting Guidance",
                description="Provide troubleshooting steps and diagnostic procedures "
                           "for network issues based on Cisco documentation.",
                tags=["troubleshooting", "debugging", "diagnostics"],
                examples=[
                    "Why is my VPN tunnel not establishing?",
                    "How do I troubleshoot slow WiFi performance?",
                    "What causes VLAN mismatch errors?",
                ]
            ),
            AgentSkill(
                id="configuration-guide",
                name="Configuration Guidance",
                description="Explain how to configure Cisco network features with "
                           "syntax, examples, and step-by-step instructions.",
                tags=["configuration", "setup", "how-to"],
                examples=[
                    "How do I set up a guest SSID?",
                    "How do I configure port security on a switch?",
                    "How do I enable QoS for voice traffic?",
                ]
            ),
            AgentSkill(
                id="api-documentation",
                name="API Documentation",
                description="Provide API endpoint details, parameters, and usage examples "
                           "for Meraki Dashboard API and other Cisco APIs.",
                tags=["api-query", "documentation"],
                examples=[
                    "What API endpoint updates SSID settings?",
                    "How do I get client details via API?",
                ]
            ),
        ],
        capabilities=AgentCapabilities(streaming=False, pushNotifications=False),
    )


def create_implementation_agent_card() -> AgentCard:
    """Create the Agent Card for the Implementation Agent (Claude/etc)."""
    return AgentCard(
        id="implementation-agent",
        name="Network Implementation Agent",
        description="Executes network operations using APIs (Meraki, Catalyst Center, "
                    "ThousandEyes, Splunk). Can query device status, run configurations, "
                    "and provide real-time network information.",
        provider=AgentProvider(
            organization="Anthropic",
            url="https://anthropic.com"
        ),
        role="implementation",
        priority=5,  # Lower priority than knowledge for design questions
        skills=[
            AgentSkill(
                id="api-execution",
                name="API Execution",
                description="Execute Meraki Dashboard API calls to query and modify "
                           "network configurations.",
                tags=["api-query", "implementation", "execution"],
                examples=[
                    "List all devices in the organization",
                    "Show me the status of access points",
                    "What clients are connected to the network?",
                ]
            ),
            AgentSkill(
                id="network-status",
                name="Network Status Monitoring",
                description="Check real-time status of networks, devices, and clients "
                           "across Meraki, ThousandEyes, and Catalyst Center.",
                tags=["monitoring", "status", "health"],
                examples=[
                    "Are there any offline devices?",
                    "What's the current network health?",
                    "Show me ThousandEyes test results",
                ]
            ),
            AgentSkill(
                id="configuration-changes",
                name="Configuration Changes",
                description="Apply configuration changes to networks and devices "
                           "(when edit mode is enabled).",
                tags=["configuration", "implementation"],
                examples=[
                    "Create a new SSID called 'Guest'",
                    "Enable VLAN 100 on the switch ports",
                ]
            ),
            AgentSkill(
                id="log-analysis",
                name="Log Analysis",
                description="Query Splunk logs for security events, errors, and correlations.",
                tags=["troubleshooting", "logs", "security"],
                examples=[
                    "Show me recent security events",
                    "What errors are in the logs?",
                ]
            ),
        ],
        capabilities=AgentCapabilities(streaming=True, pushNotifications=False),
    )


def initialize_default_agents():
    """Register the default agents with the global registry.

    Note: Knowledge Agent is now registered via specialists/__init__.py
    with a proper handler that integrates with KnowledgeService (Cisco Circuit + RAG).
    """
    registry = get_agent_registry()

    # Note: Knowledge Agent registration moved to specialists/knowledge_agent.py
    # This ensures it has a proper handler and won't be skipped by routing

    # Register Implementation Agent (legacy - provides context for orchestrator)
    implementation_card = create_implementation_agent_card()
    registry.register(implementation_card)

    logger.info("[A2A] Initialized default agents: Implementation Agent (Knowledge Agent via specialists)")

    return registry
