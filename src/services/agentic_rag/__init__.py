"""Agentic RAG - Intelligent multi-agent RAG pipeline for enhanced knowledge retrieval.

This module implements an agentic approach to RAG that uses specialized agents to:
- Analyze and decompose complex queries
- Route to optimal retrieval strategies
- Grade document relevance with LLM evaluation
- Apply corrective measures when KB coverage is insufficient
- Synthesize well-cited answers
- Self-reflect and iterate for quality improvement

The agentic RAG pipeline enhances the existing knowledge retrieval without affecting
the tool-calling capabilities for network diagnostics.
"""

from .state import RAGState, SubQuestion, GradedDocument, RetrievalStrategy, AnswerQuality
from .base_agent import BaseRAGAgent
from .config import AgenticRAGConfig, get_agentic_rag_config, init_agentic_rag_config
from .orchestrator import AgenticRAGOrchestrator, get_agentic_rag_orchestrator, init_agentic_rag_orchestrator
from .metrics import RAGMetricsLogger, get_rag_metrics_logger
from .llm_adapter import AgenticRAGLLMService, get_agentic_rag_llm_service, init_agentic_rag_llm_service
from .event_emitter import RAGPipelineEventEmitter, get_event_emitter

__all__ = [
    # State
    "RAGState",
    "SubQuestion",
    "GradedDocument",
    "RetrievalStrategy",
    "AnswerQuality",
    # Base
    "BaseRAGAgent",
    # Config
    "AgenticRAGConfig",
    "get_agentic_rag_config",
    "init_agentic_rag_config",
    # Orchestrator
    "AgenticRAGOrchestrator",
    "get_agentic_rag_orchestrator",
    "init_agentic_rag_orchestrator",
    # Metrics
    "RAGMetricsLogger",
    "get_rag_metrics_logger",
    # LLM
    "AgenticRAGLLMService",
    "get_agentic_rag_llm_service",
    "init_agentic_rag_llm_service",
    # Events
    "RAGPipelineEventEmitter",
    "get_event_emitter",
]
