"""A2A (Agent-to-Agent) Protocol Implementation.

This module implements the Google A2A Protocol v0.3 for inter-agent communication.
See: https://a2a-protocol.org/latest/specification/

Enhanced with:
- Conversation memory for multi-turn context
- Query intent classification for nuanced routing
- Response quality feedback tracking
- Parallel agent consultation for complex queries
- Structured workflows with artifact passing (2025 best practices)
- Explicit collaboration prompts
- Monitoring and debugging for collaboration quality
- Response quality scoring and validation (Phase 4)
- Context embeddings for semantic enhancement (Phase 4)
- Multi-agent response synthesis (Phase 4)
- Task persistence and lifecycle management (Phase 1)
- Agent card signing and verification (Phase 1)
- External federation and gateway routing (Phase 2)
- Push notifications for async task monitoring (Phase 3)
- Distributed tracing and metrics collection (Phase 5)
- Circuit breaker and rate limiting (Phase 5)
"""

from .types import (
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    AgentInterface,
    A2AMessage,
    A2ATask,
    TaskStatus,
    TaskState,
    MessagePart,
    TextPart,
    FilePart,
)
from .registry import AgentRegistry, get_agent_registry
from .orchestrator import AgentOrchestrator, RoutingDecision
from .memory import (
    QueryIntent,
    EntityMention,
    ConversationContext,
    RoutingFeedback,
    ConversationMemory,
    IntentClassifier,
    RoutingFeedbackTracker,
    get_conversation_memory,
    get_intent_classifier,
    get_feedback_tracker,
)
from .collaboration import (
    # Artifact System
    ArtifactType,
    CollaborationArtifact,
    ArtifactStore,
    # Workflow System
    WorkflowStep,
    WorkflowDefinition,
    WorkflowState,
    INTENT_WORKFLOWS,
    # Prompts
    CollaborationPromptBuilder,
    # Advanced Orchestration
    CollaborationOrchestrator,
    DelegationRequest,
    # Feedback
    CollaborationFeedback,
    CollaborationFeedbackTracker,
    # Monitoring
    CollaborationLogger,
    # Global accessors
    get_artifact_store,
    get_collaboration_orchestrator,
    get_collaboration_feedback_tracker,
    get_collaboration_logger,
)

# Phase 1: Protocol Compliance
from .task_manager import (
    TaskManager,
    TaskTransitionError,
    get_task_manager,
    init_task_manager,
    shutdown_task_manager,
)
from .security import (
    A2ASecurityManager,
    SignedAgentCard,
    get_security_manager,
    init_security_manager,
)

# Phase 4: Response Quality Enhancement
from .response_quality import (
    ResponseQualityScorer,
    QualityGate,
    QualityScore,
    ValidationResult,
    QualityLevel,
    QualityDimension,
    get_quality_scorer,
    get_quality_gate,
)
from .context_embeddings import (
    ContextEmbeddingStore,
    ContextWindowOptimizer,
    ContextChunk,
    RetrievedContext,
    EntityMention as ContextEntityMention,
    get_context_store,
    get_context_optimizer,
)
from .synthesis import (
    ResponseSynthesizer,
    AgentResponse as SynthesisAgentResponse,
    SynthesizedResponse,
    DetectedConflict,
    ConflictType,
    ResolutionStrategy,
    FollowUpGenerator,
    get_synthesizer,
    get_follow_up_generator,
)
from .quality_enhancement import (
    QualityEnhancementPipeline,
    EnhancedResponse,
    get_enhancement_pipeline,
    enhance_response,
    score_response,
    check_quality,
)

# Phase 2: External Federation
from .external_client import (
    A2AExternalClient,
    ExternalAgentInfo,
    ExternalTaskResult,
    ConnectionState,
    get_external_client,
    discover_agent,
    send_to_external_agent,
)
from .federation import (
    AgentFederationRegistry,
    FederatedAgent,
    FederationConfig,
    TrustLevel,
    get_federation_registry,
    init_federation_registry,
    shutdown_federation_registry,
)

# Phase 3: Push Notifications
from .push_notifications import (
    NotificationEventType,
    DeliveryStatus,
    PushNotificationConfig,
    NotificationPayload,
    DeliveryAttempt,
    NotificationDelivery,
    DeliveryConfig,
    SignatureGenerator,
    PushNotificationService,
    get_push_notification_service,
    init_push_notifications,
    shutdown_push_notifications,
    subscribe,
    unsubscribe,
    notify,
)

# Phase 5: Observability & Reliability
from .observability import (
    MetricType,
    SpanContext,
    MetricValue,
    MetricsCollector,
    Tracer,
    A2AObservability,
    get_observability,
    trace,
    trace_async,
)
from .resilience import (
    CircuitState,
    CircuitBreakerConfig,
    CircuitBreakerMetrics,
    CircuitBreakerError,
    CircuitBreaker,
    CircuitBreakerRegistry,
    RateLimitConfig,
    RateLimiter,
    RateLimiterRegistry,
    RetryConfig,
    retry_async,
    get_circuit_breaker_registry,
    get_rate_limiter_registry,
    get_circuit_breaker,
    get_rate_limiter,
    with_circuit_breaker,
    with_rate_limit,
)

__all__ = [
    # Types
    "AgentCard",
    "AgentSkill",
    "AgentCapabilities",
    "AgentProvider",
    "AgentInterface",
    "A2AMessage",
    "A2ATask",
    "TaskStatus",
    "TaskState",
    "MessagePart",
    "TextPart",
    "FilePart",
    # Registry
    "AgentRegistry",
    "get_agent_registry",
    # Orchestrator
    "AgentOrchestrator",
    "RoutingDecision",
    # Memory & Intent Classification
    "QueryIntent",
    "EntityMention",
    "ConversationContext",
    "RoutingFeedback",
    "ConversationMemory",
    "IntentClassifier",
    "RoutingFeedbackTracker",
    "get_conversation_memory",
    "get_intent_classifier",
    "get_feedback_tracker",
    # Collaboration (2025 Best Practices)
    "ArtifactType",
    "CollaborationArtifact",
    "ArtifactStore",
    "WorkflowStep",
    "WorkflowDefinition",
    "WorkflowState",
    "INTENT_WORKFLOWS",
    "CollaborationPromptBuilder",
    "CollaborationOrchestrator",
    "DelegationRequest",
    "CollaborationFeedback",
    "CollaborationFeedbackTracker",
    "CollaborationLogger",
    "get_artifact_store",
    "get_collaboration_orchestrator",
    "get_collaboration_feedback_tracker",
    "get_collaboration_logger",
    # Phase 1: Protocol Compliance
    "TaskManager",
    "TaskTransitionError",
    "get_task_manager",
    "init_task_manager",
    "shutdown_task_manager",
    "A2ASecurityManager",
    "SignedAgentCard",
    "get_security_manager",
    "init_security_manager",
    # Phase 4: Response Quality Enhancement
    "ResponseQualityScorer",
    "QualityGate",
    "QualityScore",
    "ValidationResult",
    "QualityLevel",
    "QualityDimension",
    "get_quality_scorer",
    "get_quality_gate",
    "ContextEmbeddingStore",
    "ContextWindowOptimizer",
    "ContextChunk",
    "RetrievedContext",
    "ContextEntityMention",
    "get_context_store",
    "get_context_optimizer",
    "ResponseSynthesizer",
    "SynthesisAgentResponse",
    "SynthesizedResponse",
    "DetectedConflict",
    "ConflictType",
    "ResolutionStrategy",
    "FollowUpGenerator",
    "get_synthesizer",
    "get_follow_up_generator",
    "QualityEnhancementPipeline",
    "EnhancedResponse",
    "get_enhancement_pipeline",
    "enhance_response",
    "score_response",
    "check_quality",
    # Phase 2: External Federation
    "A2AExternalClient",
    "ExternalAgentInfo",
    "ExternalTaskResult",
    "ConnectionState",
    "get_external_client",
    "discover_agent",
    "send_to_external_agent",
    "AgentFederationRegistry",
    "FederatedAgent",
    "FederationConfig",
    "TrustLevel",
    "get_federation_registry",
    "init_federation_registry",
    "shutdown_federation_registry",
    # Phase 3: Push Notifications
    "NotificationEventType",
    "DeliveryStatus",
    "PushNotificationConfig",
    "NotificationPayload",
    "DeliveryAttempt",
    "NotificationDelivery",
    "DeliveryConfig",
    "SignatureGenerator",
    "PushNotificationService",
    "get_push_notification_service",
    "init_push_notifications",
    "shutdown_push_notifications",
    "subscribe",
    "unsubscribe",
    "notify",
    # Phase 5: Observability & Reliability
    "MetricType",
    "SpanContext",
    "MetricValue",
    "MetricsCollector",
    "Tracer",
    "A2AObservability",
    "get_observability",
    "trace",
    "trace_async",
    "CircuitState",
    "CircuitBreakerConfig",
    "CircuitBreakerMetrics",
    "CircuitBreakerError",
    "CircuitBreaker",
    "CircuitBreakerRegistry",
    "RateLimitConfig",
    "RateLimiter",
    "RateLimiterRegistry",
    "RetryConfig",
    "retry_async",
    "get_circuit_breaker_registry",
    "get_rate_limiter_registry",
    "get_circuit_breaker",
    "get_rate_limiter",
    "with_circuit_breaker",
    "with_rate_limit",
]
