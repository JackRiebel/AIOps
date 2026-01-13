"""A2A Enhanced Collaboration Framework.

This module implements 2025 best practices for multi-agent collaboration:
1. Artifact passing and shared context between agents
2. Structured multi-step workflows with synthesis
3. Explicit collaboration prompts
4. Advanced orchestration techniques
5. Feedback and adaptation mechanisms
6. Monitoring and debugging for collaboration

Based on patterns from CrewAI, LangGraph, AutoGen, and Anthropic multi-agent systems.
"""

import logging
import asyncio
import json
from typing import Dict, List, Optional, Any, Tuple, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from collections import defaultdict

from .types import (
    AgentCard,
    A2AMessage,
    A2ATask,
    TextPart,
    DataPart,
    TaskState,
    TaskStatus,
)
from .memory import QueryIntent, ConversationContext

logger = logging.getLogger(__name__)


# =============================================================================
# 1. ARTIFACT SYSTEM - Shared data between agents
# =============================================================================

class ArtifactType(str, Enum):
    """Types of artifacts that can be shared between agents."""
    ENVIRONMENT_DATA = "environment_data"      # Device/network/VLAN status
    CONFIG_SUMMARY = "config_summary"          # Current configuration summary
    KNOWLEDGE_GUIDANCE = "knowledge_guidance"  # Best practices/recommendations
    IMPLEMENTATION_PLAN = "implementation_plan" # Proposed changes
    ANALYSIS_RESULT = "analysis_result"        # Analysis/audit results
    SYNTHESIS = "synthesis"                    # Combined response from multiple agents


@dataclass
class CollaborationArtifact:
    """An artifact shared between agents during collaboration.

    Artifacts enable bidirectional information sharing:
    - Implementation -> Knowledge: Real-time data for grounded recommendations
    - Knowledge -> Implementation: Expert guidance for execution
    """
    id: str
    artifact_type: ArtifactType
    source_agent: str
    target_agent: Optional[str] = None  # None = broadcast to all
    data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    # For tracking artifact usage
    referenced_by: List[str] = field(default_factory=list)

    def to_context_string(self) -> str:
        """Convert artifact to a context string for prompts."""
        lines = [f"### Artifact: {self.artifact_type.value} (from {self.source_agent})"]

        if self.artifact_type == ArtifactType.ENVIRONMENT_DATA:
            lines.append("**Current Environment State:**")
            if "devices" in self.data:
                lines.append(f"- Devices: {len(self.data['devices'])} found")
                for d in self.data.get("devices", [])[:5]:
                    lines.append(f"  - {d.get('name', 'Unknown')}: {d.get('model', '')} ({d.get('status', '')})")
            if "networks" in self.data:
                lines.append(f"- Networks: {len(self.data['networks'])}")
            if "vlans" in self.data:
                lines.append(f"- VLANs: {len(self.data['vlans'])} configured")
            if "ssids" in self.data:
                enabled_ssids = [s for s in self.data.get("ssids", []) if s.get("enabled")]
                lines.append(f"- SSIDs: {len(enabled_ssids)} enabled")

        elif self.artifact_type == ArtifactType.KNOWLEDGE_GUIDANCE:
            lines.append("**Expert Guidance:**")
            if "recommendations" in self.data:
                for i, rec in enumerate(self.data["recommendations"][:5], 1):
                    lines.append(f"{i}. {rec}")
            if "best_practices" in self.data:
                lines.append("\n**Best Practices:**")
                for bp in self.data.get("best_practices", [])[:3]:
                    lines.append(f"- {bp}")

        elif self.artifact_type == ArtifactType.IMPLEMENTATION_PLAN:
            lines.append("**Implementation Plan:**")
            for i, step in enumerate(self.data.get("steps", []), 1):
                lines.append(f"{i}. {step.get('action', 'Unknown action')}")
                if step.get("details"):
                    lines.append(f"   Details: {step['details']}")

        elif self.artifact_type == ArtifactType.SYNTHESIS:
            lines.append("**Synthesized Response:**")
            if "summary" in self.data:
                lines.append(self.data["summary"])
            if "agent_contributions" in self.data:
                lines.append("\nContributions by agent:")
                for agent, contrib in self.data["agent_contributions"].items():
                    lines.append(f"- {agent}: {contrib[:100]}...")

        else:
            # Generic data dump
            lines.append(json.dumps(self.data, indent=2, default=str)[:500])

        return "\n".join(lines)


class ArtifactStore:
    """Stores and manages collaboration artifacts for a session."""

    def __init__(self):
        self._artifacts: Dict[str, List[CollaborationArtifact]] = defaultdict(list)

    def add_artifact(
        self,
        session_id: str,
        artifact: CollaborationArtifact
    ) -> None:
        """Add an artifact to the store."""
        self._artifacts[session_id].append(artifact)
        logger.info(
            f"[Collaboration] Added artifact: {artifact.artifact_type.value} "
            f"from {artifact.source_agent} (session: {session_id})"
        )

    def get_artifacts_for_agent(
        self,
        session_id: str,
        agent_id: str,
        artifact_types: Optional[List[ArtifactType]] = None
    ) -> List[CollaborationArtifact]:
        """Get artifacts relevant to a specific agent."""
        artifacts = []
        for artifact in self._artifacts.get(session_id, []):
            # Include if targeted to this agent or broadcast
            if artifact.target_agent is None or artifact.target_agent == agent_id:
                if artifact_types is None or artifact.artifact_type in artifact_types:
                    artifacts.append(artifact)
        return artifacts

    def get_latest_artifact_of_type(
        self,
        session_id: str,
        artifact_type: ArtifactType
    ) -> Optional[CollaborationArtifact]:
        """Get the most recent artifact of a specific type."""
        for artifact in reversed(self._artifacts.get(session_id, [])):
            if artifact.artifact_type == artifact_type:
                return artifact
        return None

    def mark_referenced(
        self,
        session_id: str,
        artifact_id: str,
        by_agent: str
    ) -> None:
        """Mark an artifact as referenced by an agent."""
        for artifact in self._artifacts.get(session_id, []):
            if artifact.id == artifact_id:
                artifact.referenced_by.append(by_agent)
                break

    def clear_session(self, session_id: str) -> None:
        """Clear all artifacts for a session."""
        if session_id in self._artifacts:
            del self._artifacts[session_id]


# =============================================================================
# 2. STRUCTURED WORKFLOWS - Intent-specific multi-step sequences
# =============================================================================

class WorkflowStep(str, Enum):
    """Steps in a collaboration workflow."""
    GATHER_DATA = "gather_data"           # Implementation gathers environment data
    ENRICH_CONTEXT = "enrich_context"     # Add context to the request
    CONSULT_KNOWLEDGE = "consult_knowledge"  # Get expert guidance
    CONSULT_IMPLEMENTATION = "consult_implementation"  # Get real-time data
    SYNTHESIZE = "synthesize"             # Combine responses
    CRITIQUE = "critique"                 # Review output
    REFINE = "refine"                     # Improve based on critique
    FINALIZE = "finalize"                 # Prepare final response


@dataclass
class WorkflowDefinition:
    """Defines a multi-step workflow for specific intents."""
    intent: QueryIntent
    steps: List[WorkflowStep]
    description: str
    max_iterations: int = 2  # For critique/refine loops


# Intent-specific workflow definitions
INTENT_WORKFLOWS: Dict[QueryIntent, WorkflowDefinition] = {
    QueryIntent.BEST_PRACTICES: WorkflowDefinition(
        intent=QueryIntent.BEST_PRACTICES,
        steps=[
            WorkflowStep.GATHER_DATA,         # Get current env state
            WorkflowStep.CONSULT_KNOWLEDGE,   # Get best practices with context
            WorkflowStep.SYNTHESIZE,          # Combine recommendations with env
        ],
        description="Data-first approach: gather environment, then get contextualized best practices"
    ),
    QueryIntent.TROUBLESHOOTING: WorkflowDefinition(
        intent=QueryIntent.TROUBLESHOOTING,
        steps=[
            WorkflowStep.GATHER_DATA,         # Get current state
            WorkflowStep.CONSULT_KNOWLEDGE,   # Get troubleshooting steps
            WorkflowStep.CONSULT_IMPLEMENTATION,  # Verify with actual data
            WorkflowStep.SYNTHESIZE,          # Combine diagnosis
        ],
        description="Parallel gathering of guidance and data for troubleshooting"
    ),
    QueryIntent.AUDIT: WorkflowDefinition(
        intent=QueryIntent.AUDIT,
        steps=[
            WorkflowStep.GATHER_DATA,         # Get current config
            WorkflowStep.CONSULT_KNOWLEDGE,   # Get compliance requirements
            WorkflowStep.CRITIQUE,            # Knowledge reviews config
            WorkflowStep.SYNTHESIZE,          # Final audit report
        ],
        description="Compare current config against best practices"
    ),
    QueryIntent.COMPARISON: WorkflowDefinition(
        intent=QueryIntent.COMPARISON,
        steps=[
            WorkflowStep.GATHER_DATA,         # Get actual configs
            WorkflowStep.CONSULT_KNOWLEDGE,   # Get comparison criteria
            WorkflowStep.SYNTHESIZE,          # Compare with guidance
        ],
        description="Compare with expert guidance"
    ),
}


@dataclass
class WorkflowState:
    """Tracks the state of an executing workflow."""
    workflow: WorkflowDefinition
    current_step_index: int = 0
    completed_steps: List[WorkflowStep] = field(default_factory=list)
    artifacts_produced: List[str] = field(default_factory=list)  # Artifact IDs
    iteration_count: int = 0
    started_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def current_step(self) -> Optional[WorkflowStep]:
        """Get the current step."""
        if self.current_step_index < len(self.workflow.steps):
            return self.workflow.steps[self.current_step_index]
        return None

    @property
    def is_complete(self) -> bool:
        """Check if workflow is complete."""
        return self.current_step_index >= len(self.workflow.steps)

    def advance(self) -> None:
        """Move to the next step."""
        if self.current_step:
            self.completed_steps.append(self.current_step)
        self.current_step_index += 1


# =============================================================================
# 3. COLLABORATION PROMPTS - Explicit collaboration instructions
# =============================================================================

class CollaborationPromptBuilder:
    """Builds prompts with explicit collaboration instructions."""

    # Role-specific collaboration instructions
    KNOWLEDGE_AGENT_INSTRUCTIONS = """
**COLLABORATION MODE: Knowledge Agent**

You are collaborating with the Implementation Agent. Your role:
- Focus on Cisco best practices, documentation, and expert guidance
- Reference the provided environment data when giving recommendations
- Be specific to the actual devices/config in the user's environment
- Do NOT repeat information already provided by the Implementation Agent
- Request additional data if needed for better recommendations

When environment data is provided:
- Tailor your recommendations to the specific devices mentioned
- Reference VLAN IDs, SSID names, and device models from the data
- Highlight any discrepancies between current config and best practices
"""

    IMPLEMENTATION_AGENT_INSTRUCTIONS = """
**COLLABORATION MODE: Implementation Agent**

You are collaborating with the Knowledge Agent. Your role:
- Provide real-time facts and data from APIs
- Execute configuration changes when requested
- Verify Knowledge Agent recommendations are feasible in the current environment
- Do NOT repeat guidance already provided by the Knowledge Agent
- Defer to Knowledge Agent for best practices and recommendations

When Knowledge guidance is provided:
- Verify recommendations against actual environment state
- Flag any conflicts or implementation challenges
- Provide specific commands/API calls for implementation
"""

    SYNTHESIS_INSTRUCTIONS = """
**SYNTHESIS MODE**

You are combining outputs from multiple agents into a coherent response:
- Integrate factual data from the Implementation Agent
- Incorporate expert guidance from the Knowledge Agent
- Resolve any conflicts by preferring more recent/specific information
- Present a unified recommendation tailored to the user's environment
- Be concise and actionable
"""

    CRITIQUE_INSTRUCTIONS = """
**CRITIQUE MODE**

Review the provided output for:
- Accuracy: Does it match the actual environment?
- Completeness: Are all relevant aspects covered?
- Feasibility: Can the recommendations be implemented?
- Security: Are there any security concerns?

Provide specific, actionable feedback for improvement.
"""

    @classmethod
    def build_collaboration_prompt(
        cls,
        agent_role: str,
        artifacts: List[CollaborationArtifact],
        other_agent_output: Optional[str] = None,
        workflow_step: Optional[WorkflowStep] = None
    ) -> str:
        """Build a prompt with collaboration context.

        Args:
            agent_role: "knowledge" or "implementation"
            artifacts: Artifacts available to this agent
            other_agent_output: Output from the other agent to reference
            workflow_step: Current step in the workflow

        Returns:
            Formatted collaboration prompt
        """
        lines = []

        # Add role-specific instructions
        if workflow_step == WorkflowStep.SYNTHESIZE:
            lines.append(cls.SYNTHESIS_INSTRUCTIONS)
        elif workflow_step == WorkflowStep.CRITIQUE:
            lines.append(cls.CRITIQUE_INSTRUCTIONS)
        elif agent_role == "knowledge":
            lines.append(cls.KNOWLEDGE_AGENT_INSTRUCTIONS)
        elif agent_role == "implementation":
            lines.append(cls.IMPLEMENTATION_AGENT_INSTRUCTIONS)

        # Add artifact context
        if artifacts:
            lines.append("\n**SHARED CONTEXT FROM OTHER AGENT(S):**\n")
            for artifact in artifacts:
                lines.append(artifact.to_context_string())
                lines.append("")

        # Add other agent's output if provided
        if other_agent_output:
            lines.append("\n**OUTPUT FROM OTHER AGENT:**")
            lines.append(other_agent_output)
            lines.append("")

        # Add anti-duplication reminder
        lines.append("\n**IMPORTANT:** Do not repeat information already provided above. Add NEW value.")

        return "\n".join(lines)


# =============================================================================
# 4. ADVANCED ORCHESTRATION - Hybrid execution and delegation
# =============================================================================

@dataclass
class DelegationRequest:
    """Request to delegate a subtask to another agent."""
    from_agent: str
    to_agent: str
    subtask: str
    context: Dict[str, Any] = field(default_factory=dict)
    priority: str = "normal"  # "high", "normal", "low"


class CollaborationOrchestrator:
    """Enhanced orchestrator with advanced collaboration features."""

    def __init__(self, artifact_store: Optional[ArtifactStore] = None):
        self.artifact_store = artifact_store or ArtifactStore()
        self.active_workflows: Dict[str, WorkflowState] = {}
        self._collaboration_stats: Dict[str, Any] = defaultdict(int)

    def get_workflow_for_intent(self, intent: QueryIntent) -> Optional[WorkflowDefinition]:
        """Get the workflow definition for an intent."""
        return INTENT_WORKFLOWS.get(intent)

    def start_workflow(
        self,
        session_id: str,
        intent: QueryIntent
    ) -> Optional[WorkflowState]:
        """Start a collaboration workflow for the given intent."""
        workflow = self.get_workflow_for_intent(intent)
        if not workflow:
            return None

        state = WorkflowState(workflow=workflow)
        self.active_workflows[session_id] = state

        logger.info(
            f"[Collaboration] Started workflow for {intent.value}: "
            f"{[s.value for s in workflow.steps]}"
        )
        self._collaboration_stats["workflows_started"] += 1

        return state

    async def execute_workflow_step(
        self,
        session_id: str,
        state: WorkflowState,
        implementation_handler: Callable[[str], Awaitable[Dict[str, Any]]],
        knowledge_handler: Callable[[str, str], Awaitable[Dict[str, Any]]],
        query: str
    ) -> Optional[CollaborationArtifact]:
        """Execute a single workflow step.

        Args:
            session_id: The session ID
            state: Current workflow state
            implementation_handler: Handler to call Implementation Agent
            knowledge_handler: Handler to call Knowledge Agent
            query: The user's query

        Returns:
            Artifact produced by this step, if any
        """
        step = state.current_step
        if not step:
            return None

        logger.info(f"[Collaboration] Executing step: {step.value}")
        artifact = None

        if step == WorkflowStep.GATHER_DATA:
            # Implementation gathers environment data
            result = await implementation_handler(
                f"Gather relevant environment data for this query: {query}\n"
                "List networks, devices, VLANs, and SSIDs that might be relevant."
            )

            artifact = CollaborationArtifact(
                id=f"env_{session_id}_{datetime.utcnow().timestamp()}",
                artifact_type=ArtifactType.ENVIRONMENT_DATA,
                source_agent="implementation-agent",
                data=result
            )

        elif step == WorkflowStep.CONSULT_KNOWLEDGE:
            # Get existing environment artifact for context
            env_artifact = self.artifact_store.get_latest_artifact_of_type(
                session_id, ArtifactType.ENVIRONMENT_DATA
            )
            context = env_artifact.to_context_string() if env_artifact else ""

            result = await knowledge_handler(query, context)

            artifact = CollaborationArtifact(
                id=f"knowledge_{session_id}_{datetime.utcnow().timestamp()}",
                artifact_type=ArtifactType.KNOWLEDGE_GUIDANCE,
                source_agent="knowledge-agent",
                data=result
            )

        elif step == WorkflowStep.CONSULT_IMPLEMENTATION:
            # Get knowledge guidance for context
            knowledge_artifact = self.artifact_store.get_latest_artifact_of_type(
                session_id, ArtifactType.KNOWLEDGE_GUIDANCE
            )

            verification_query = query
            if knowledge_artifact:
                verification_query = (
                    f"Verify these recommendations against the actual environment:\n"
                    f"{knowledge_artifact.to_context_string()}\n\n"
                    f"Original query: {query}"
                )

            result = await implementation_handler(verification_query)

            artifact = CollaborationArtifact(
                id=f"impl_{session_id}_{datetime.utcnow().timestamp()}",
                artifact_type=ArtifactType.ANALYSIS_RESULT,
                source_agent="implementation-agent",
                data=result
            )

        elif step == WorkflowStep.SYNTHESIZE:
            # Combine all artifacts into a synthesis
            all_artifacts = self.artifact_store.get_artifacts_for_agent(
                session_id, "synthesizer"
            )

            synthesis_data = {
                "summary": "Synthesized response from multiple agents",
                "agent_contributions": {},
                "artifacts_used": []
            }

            for art in all_artifacts:
                synthesis_data["agent_contributions"][art.source_agent] = (
                    json.dumps(art.data, default=str)[:200]
                )
                synthesis_data["artifacts_used"].append(art.id)

            artifact = CollaborationArtifact(
                id=f"synthesis_{session_id}_{datetime.utcnow().timestamp()}",
                artifact_type=ArtifactType.SYNTHESIS,
                source_agent="orchestrator",
                data=synthesis_data
            )

        elif step == WorkflowStep.CRITIQUE:
            # Knowledge agent reviews Implementation output
            impl_artifact = self.artifact_store.get_latest_artifact_of_type(
                session_id, ArtifactType.ENVIRONMENT_DATA
            )

            if impl_artifact:
                critique_query = (
                    f"Review this configuration/data for compliance with best practices:\n"
                    f"{impl_artifact.to_context_string()}"
                )
                result = await knowledge_handler(critique_query, "")

                artifact = CollaborationArtifact(
                    id=f"critique_{session_id}_{datetime.utcnow().timestamp()}",
                    artifact_type=ArtifactType.ANALYSIS_RESULT,
                    source_agent="knowledge-agent",
                    data=result
                )

        # Store the artifact
        if artifact:
            self.artifact_store.add_artifact(session_id, artifact)
            state.artifacts_produced.append(artifact.id)

        # Advance the workflow
        state.advance()
        self._collaboration_stats["steps_executed"] += 1

        return artifact

    def check_for_conflicts(
        self,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """Check for conflicts between agent outputs.

        Returns list of detected conflicts with details.
        """
        artifacts = self.artifact_store.get_artifacts_for_agent(session_id, None)
        conflicts = []

        # Simple conflict detection: compare key recommendations
        knowledge_artifacts = [a for a in artifacts if a.source_agent == "knowledge-agent"]
        impl_artifacts = [a for a in artifacts if a.source_agent == "implementation-agent"]

        # This is a simplified check - in production you'd use embeddings or LLM
        for k_art in knowledge_artifacts:
            for i_art in impl_artifacts:
                k_data = json.dumps(k_art.data, default=str).lower()
                i_data = json.dumps(i_art.data, default=str).lower()

                # Check for explicit contradictions
                if "not recommended" in k_data and "configured" in i_data:
                    conflicts.append({
                        "type": "recommendation_vs_current",
                        "knowledge_artifact": k_art.id,
                        "implementation_artifact": i_art.id,
                        "description": "Knowledge Agent advises against something that's currently configured"
                    })

        return conflicts

    def get_collaboration_context_for_prompt(
        self,
        session_id: str,
        agent_role: str,
        workflow_step: Optional[WorkflowStep] = None
    ) -> str:
        """Get the full collaboration context for an agent's prompt."""
        artifacts = self.artifact_store.get_artifacts_for_agent(session_id, agent_role)

        return CollaborationPromptBuilder.build_collaboration_prompt(
            agent_role=agent_role,
            artifacts=artifacts,
            workflow_step=workflow_step
        )


# =============================================================================
# 5. FEEDBACK AND ADAPTATION
# =============================================================================

@dataclass
class CollaborationFeedback:
    """Feedback on a collaboration session."""
    session_id: str
    workflow_intent: QueryIntent
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Quality metrics
    knowledge_referenced_data: bool = False  # Did Knowledge use Implementation data?
    implementation_referenced_guidance: bool = False  # Did Impl use Knowledge guidance?
    synthesis_coherent: bool = True
    user_satisfaction: Optional[float] = None  # 0.0 - 1.0

    # Timing metrics
    total_duration_seconds: float = 0.0
    steps_executed: int = 0

    # Artifacts
    artifacts_produced: int = 0
    conflicts_detected: int = 0


class CollaborationFeedbackTracker:
    """Tracks and learns from collaboration outcomes."""

    def __init__(self, max_history: int = 500):
        self._history: List[CollaborationFeedback] = []
        self._max_history = max_history

        # Track workflow effectiveness by intent
        self._workflow_scores: Dict[str, List[float]] = defaultdict(list)

        # Track which sequences work best
        self._sequence_effectiveness: Dict[str, List[float]] = defaultdict(list)

    def record_collaboration(
        self,
        feedback: CollaborationFeedback
    ) -> None:
        """Record feedback on a collaboration session."""
        self._history.append(feedback)

        # Trim history
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # Update scores
        if feedback.user_satisfaction is not None:
            self._workflow_scores[feedback.workflow_intent.value].append(
                feedback.user_satisfaction
            )

        logger.info(
            f"[Collaboration Feedback] Session {feedback.session_id}: "
            f"intent={feedback.workflow_intent.value}, "
            f"satisfaction={feedback.user_satisfaction}, "
            f"artifacts={feedback.artifacts_produced}"
        )

    def get_workflow_effectiveness(self, intent: QueryIntent) -> float:
        """Get average effectiveness score for a workflow type."""
        scores = self._workflow_scores.get(intent.value, [])
        if not scores:
            return 0.5  # Default neutral score
        return sum(scores[-20:]) / len(scores[-20:])  # Recent 20 scores

    def should_use_data_first(self, intent: QueryIntent) -> bool:
        """Determine if data-first approach should be used based on history."""
        # Start with data-first for these intents
        data_first_intents = {
            QueryIntent.BEST_PRACTICES,
            QueryIntent.TROUBLESHOOTING,
            QueryIntent.AUDIT,
        }
        return intent in data_first_intents

    def get_collaboration_statistics(self) -> Dict[str, Any]:
        """Get statistics on collaboration quality."""
        total = len(self._history)

        if total == 0:
            return {"total_sessions": 0}

        knowledge_referenced = sum(1 for f in self._history if f.knowledge_referenced_data)
        impl_referenced = sum(1 for f in self._history if f.implementation_referenced_guidance)
        coherent = sum(1 for f in self._history if f.synthesis_coherent)

        avg_satisfaction = sum(
            f.user_satisfaction for f in self._history
            if f.user_satisfaction is not None
        )
        satisfaction_count = sum(
            1 for f in self._history if f.user_satisfaction is not None
        )

        return {
            "total_sessions": total,
            "knowledge_used_data_rate": knowledge_referenced / total,
            "implementation_used_guidance_rate": impl_referenced / total,
            "coherent_synthesis_rate": coherent / total,
            "average_satisfaction": avg_satisfaction / satisfaction_count if satisfaction_count else None,
            "workflow_effectiveness": {
                intent: self.get_workflow_effectiveness(QueryIntent(intent))
                for intent in self._workflow_scores.keys()
            },
            "average_artifacts_per_session": sum(f.artifacts_produced for f in self._history) / total,
            "average_conflicts_detected": sum(f.conflicts_detected for f in self._history) / total,
        }


# =============================================================================
# 6. MONITORING AND DEBUGGING
# =============================================================================

class CollaborationLogger:
    """Enhanced logging for multi-agent collaboration flows."""

    def __init__(self):
        self._flow_logs: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def log_event(
        self,
        session_id: str,
        event_type: str,
        details: Dict[str, Any]
    ) -> None:
        """Log a collaboration event."""
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            **details
        }
        self._flow_logs[session_id].append(event)

        logger.info(
            f"[Collab Flow] {session_id[:8]}... {event_type}: "
            f"{json.dumps(details, default=str)[:100]}"
        )

    def log_artifact_flow(
        self,
        session_id: str,
        artifact_id: str,
        from_agent: str,
        to_agent: str,
        artifact_type: str
    ) -> None:
        """Log artifact passing between agents."""
        self.log_event(session_id, "artifact_flow", {
            "artifact_id": artifact_id,
            "from": from_agent,
            "to": to_agent,
            "type": artifact_type
        })

    def log_delegation(
        self,
        session_id: str,
        delegation: DelegationRequest
    ) -> None:
        """Log a delegation decision."""
        self.log_event(session_id, "delegation", {
            "from": delegation.from_agent,
            "to": delegation.to_agent,
            "subtask": delegation.subtask[:100],
            "priority": delegation.priority
        })

    def log_synthesis(
        self,
        session_id: str,
        agents_combined: List[str],
        conflicts_resolved: int
    ) -> None:
        """Log a synthesis operation."""
        self.log_event(session_id, "synthesis", {
            "agents_combined": agents_combined,
            "conflicts_resolved": conflicts_resolved
        })

    def get_flow_summary(self, session_id: str) -> Dict[str, Any]:
        """Get a summary of the collaboration flow for debugging."""
        events = self._flow_logs.get(session_id, [])

        return {
            "total_events": len(events),
            "artifact_flows": sum(1 for e in events if e["event_type"] == "artifact_flow"),
            "delegations": sum(1 for e in events if e["event_type"] == "delegation"),
            "syntheses": sum(1 for e in events if e["event_type"] == "synthesis"),
            "timeline": events[-10:],  # Last 10 events
        }


# =============================================================================
# GLOBAL INSTANCES
# =============================================================================

_artifact_store: Optional[ArtifactStore] = None
_collaboration_orchestrator: Optional[CollaborationOrchestrator] = None
_feedback_tracker: Optional[CollaborationFeedbackTracker] = None
_collab_logger: Optional[CollaborationLogger] = None


def get_artifact_store() -> ArtifactStore:
    """Get the global artifact store."""
    global _artifact_store
    if _artifact_store is None:
        _artifact_store = ArtifactStore()
    return _artifact_store


def get_collaboration_orchestrator() -> CollaborationOrchestrator:
    """Get the global collaboration orchestrator."""
    global _collaboration_orchestrator
    if _collaboration_orchestrator is None:
        _collaboration_orchestrator = CollaborationOrchestrator(get_artifact_store())
    return _collaboration_orchestrator


def get_collaboration_feedback_tracker() -> CollaborationFeedbackTracker:
    """Get the global collaboration feedback tracker."""
    global _feedback_tracker
    if _feedback_tracker is None:
        _feedback_tracker = CollaborationFeedbackTracker()
    return _feedback_tracker


def get_collaboration_logger() -> CollaborationLogger:
    """Get the global collaboration logger."""
    global _collab_logger
    if _collab_logger is None:
        _collab_logger = CollaborationLogger()
    return _collab_logger
