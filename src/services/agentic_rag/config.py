"""Configuration for agentic RAG pipeline.

Configuration can be loaded from:
1. Database (system_configs table) - dynamic, preferred
2. Environment variables - for deployment
3. Default values - fallback

The configuration controls which agents are enabled and their behavior.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


@dataclass
class AgenticRAGConfig:
    """Configuration for the agentic RAG pipeline.

    All settings can be overridden via database configuration
    or environment variables.
    """

    # =========================================================================
    # Master Switch
    # =========================================================================
    enabled: bool = False
    """Master switch for agentic RAG. When False, uses simple retrieval."""

    # =========================================================================
    # Pipeline Settings
    # =========================================================================
    max_iterations: int = 2
    """Maximum number of reflection/iteration cycles."""

    total_timeout_seconds: float = 15.0
    """Maximum total pipeline execution time."""

    # =========================================================================
    # Query Analysis Agent
    # =========================================================================
    query_analysis_enabled: bool = True
    """Enable query decomposition and analysis."""

    query_analysis_model: str = "gpt-4o-mini"
    """Model to use for query analysis (smaller model for speed)."""

    max_sub_questions: int = 3
    """Maximum number of sub-questions to generate."""

    # =========================================================================
    # Retrieval Router Agent
    # =========================================================================
    retrieval_router_enabled: bool = True
    """Enable intelligent retrieval strategy selection."""

    # Strategy-specific settings
    default_strategy: str = "hybrid"
    """Default retrieval strategy if router is disabled."""

    hyde_enabled: bool = True
    """Enable HyDE (Hypothetical Document Embeddings) strategy."""

    multi_query_enabled: bool = True
    """Enable multi-query expansion strategy."""

    # =========================================================================
    # Document Grader Agent
    # =========================================================================
    document_grading_enabled: bool = True
    """Enable LLM-based document relevance grading."""

    document_grading_model: str = "gpt-4o-mini"
    """Model for document grading (smaller model for cost)."""

    max_documents_to_grade: int = 10
    """Maximum documents to send to grader."""

    relevance_threshold: float = 0.5
    """Minimum graded relevance to keep a document."""

    batch_grading: bool = True
    """Grade all documents in a single LLM call (vs individual)."""

    # =========================================================================
    # Corrective RAG Agent (CRAG)
    # =========================================================================
    corrective_rag_enabled: bool = True
    """Enable corrective RAG with web search fallback."""

    web_search_enabled: bool = False
    """Enable web search when KB coverage is insufficient."""

    min_relevant_docs: int = 2
    """Minimum relevant docs before triggering web search."""

    min_avg_relevance: float = 0.6
    """Minimum average relevance before triggering web search."""

    web_search_provider: str = "tavily"
    """Web search provider: 'tavily', 'serper', 'google'."""

    max_web_results: int = 3
    """Maximum web search results to include."""

    # =========================================================================
    # Synthesis Agent
    # =========================================================================
    synthesis_model: str = "gpt-4o"
    """Model for answer synthesis (higher quality model)."""

    synthesis_max_tokens: int = 2048
    """Maximum tokens in synthesized answer."""

    require_citations: bool = True
    """Require citations in synthesized answers."""

    min_citations: int = 1
    """Minimum citations required in answer."""

    # =========================================================================
    # Reflection Agent
    # =========================================================================
    reflection_enabled: bool = True
    """Enable self-reflection and quality assessment."""

    reflection_model: str = "gpt-4o-mini"
    """Model for reflection (smaller model acceptable)."""

    quality_threshold: float = 0.7
    """Quality score threshold below which iteration is triggered."""

    # =========================================================================
    # Performance & Cost
    # =========================================================================
    parallel_agents: bool = True
    """Run independent agents in parallel where possible."""

    cache_embeddings: bool = True
    """Cache query embeddings for faster retrieval."""

    log_metrics: bool = True
    """Log detailed pipeline metrics."""

    # =========================================================================
    # Debug
    # =========================================================================
    debug_mode: bool = False
    """Enable verbose debug logging."""

    trace_llm_calls: bool = False
    """Log full LLM prompts and responses."""

    @classmethod
    async def from_database(cls, session) -> "AgenticRAGConfig":
        """Load configuration from database system_configs table.

        Args:
            session: Database session

        Returns:
            AgenticRAGConfig with database values
        """
        from src.services.config_service import ConfigService

        config = cls()

        try:
            config_service = ConfigService()

            # Load each setting from database
            config_map = {
                "agentic_rag_enabled": ("enabled", bool),
                "agentic_rag_max_iterations": ("max_iterations", int),
                "agentic_rag_timeout": ("total_timeout_seconds", float),
                "agentic_rag_query_analysis": ("query_analysis_enabled", bool),
                "agentic_rag_document_grading": ("document_grading_enabled", bool),
                "agentic_rag_reflection": ("reflection_enabled", bool),
                "agentic_rag_web_search": ("web_search_enabled", bool),
                "agentic_rag_debug": ("debug_mode", bool),
            }

            for db_key, (attr, type_fn) in config_map.items():
                value = await config_service.get_config(db_key)
                if value is not None:
                    try:
                        if type_fn == bool:
                            parsed = str(value).lower() in ("true", "1", "yes")
                        else:
                            parsed = type_fn(value)
                        setattr(config, attr, parsed)
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid config value for {db_key}: {e}")

        except Exception as e:
            logger.warning(f"Failed to load agentic RAG config from database: {e}")
            # Return default config

        return config

    @classmethod
    def from_env(cls) -> "AgenticRAGConfig":
        """Load configuration from environment variables.

        Returns:
            AgenticRAGConfig with environment values
        """
        import os

        config = cls()

        env_map = {
            "AGENTIC_RAG_ENABLED": ("enabled", lambda x: x.lower() == "true"),
            "AGENTIC_RAG_MAX_ITERATIONS": ("max_iterations", int),
            "AGENTIC_RAG_TIMEOUT": ("total_timeout_seconds", float),
            "AGENTIC_RAG_QUERY_ANALYSIS": ("query_analysis_enabled", lambda x: x.lower() == "true"),
            "AGENTIC_RAG_DOCUMENT_GRADING": ("document_grading_enabled", lambda x: x.lower() == "true"),
            "AGENTIC_RAG_REFLECTION": ("reflection_enabled", lambda x: x.lower() == "true"),
            "AGENTIC_RAG_WEB_SEARCH": ("web_search_enabled", lambda x: x.lower() == "true"),
            "AGENTIC_RAG_DEBUG": ("debug_mode", lambda x: x.lower() == "true"),
        }

        for env_key, (attr, converter) in env_map.items():
            value = os.environ.get(env_key)
            if value is not None:
                try:
                    setattr(config, attr, converter(value))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid env value for {env_key}: {e}")

        return config

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary for logging/debugging."""
        return {
            "enabled": self.enabled,
            "max_iterations": self.max_iterations,
            "total_timeout_seconds": self.total_timeout_seconds,
            "query_analysis_enabled": self.query_analysis_enabled,
            "document_grading_enabled": self.document_grading_enabled,
            "reflection_enabled": self.reflection_enabled,
            "corrective_rag_enabled": self.corrective_rag_enabled,
            "web_search_enabled": self.web_search_enabled,
            "debug_mode": self.debug_mode,
        }


# Singleton config instance
_config: Optional[AgenticRAGConfig] = None


def get_agentic_rag_config() -> AgenticRAGConfig:
    """Get the global agentic RAG configuration.

    Returns:
        AgenticRAGConfig instance (may be default if not initialized)
    """
    global _config
    if _config is None:
        _config = AgenticRAGConfig.from_env()
    return _config


async def init_agentic_rag_config(session) -> AgenticRAGConfig:
    """Initialize agentic RAG configuration from database.

    Args:
        session: Database session

    Returns:
        Initialized AgenticRAGConfig
    """
    global _config
    _config = await AgenticRAGConfig.from_database(session)
    logger.info(f"Agentic RAG config initialized: {_config.to_dict()}")
    return _config


def update_agentic_rag_config(config: AgenticRAGConfig) -> None:
    """Update the global configuration.

    Args:
        config: New configuration to use
    """
    global _config
    _config = config
