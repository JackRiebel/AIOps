"""Cisco Knowledge Agent - RAG + Cisco Circuit integration.

This agent provides expert networking knowledge using:
1. RAG (Retrieval Augmented Generation) from indexed Cisco documentation
2. Cisco Circuit AI for response generation

Skills:
- best-practices: Network design, security, and architecture recommendations
- troubleshooting-guidance: Step-by-step troubleshooting for network issues
- configuration-guide: How to configure Cisco networking features
- api-documentation: Cisco API usage and integration guidance
"""

from typing import List, Dict, Any, Optional
import logging

from ..types import AgentSkill
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
)

logger = logging.getLogger(__name__)


class KnowledgeAgent(BaseSpecialistAgent):
    """Specialist for Cisco networking knowledge using RAG + Cisco Circuit.

    This agent integrates with the KnowledgeService to provide authoritative
    Cisco networking expertise. It uses vector-indexed documentation and
    Cisco Circuit AI for response generation.
    """

    AGENT_ID = "knowledge-agent"
    AGENT_NAME = "Cisco Knowledge Agent"
    AGENT_ROLE = "knowledge"
    AGENT_DESCRIPTION = (
        "Expert on Cisco networking technologies using RAG knowledge base "
        "and Cisco Circuit AI. Provides best practices, troubleshooting guidance, "
        "configuration recommendations, and API documentation."
    )
    AGENT_PRIORITY = 10  # High priority for knowledge queries

    def get_skills(self) -> List[AgentSkill]:
        """Define knowledge agent skills."""
        return [
            AgentSkill(
                id="best-practices",
                name="Network Best Practices",
                description="Expert recommendations for network design, security, and architecture",
                tags=["best-practices", "design", "security", "architecture", "recommend", "guidelines"],
                examples=[
                    "How should I segment my network?",
                    "Best practices for guest WiFi",
                    "Security recommendations for MX firewall",
                    "What's the recommended VLAN design?",
                ],
            ),
            AgentSkill(
                id="troubleshooting-guidance",
                name="Troubleshooting Guidance",
                description="Step-by-step troubleshooting for network issues",
                tags=["troubleshooting", "debug", "issues", "problems", "fix", "diagnose"],
                examples=[
                    "How do I troubleshoot slow WiFi?",
                    "Debug VPN connectivity issues",
                    "Fix DHCP problems",
                    "Why is my MX offline?",
                ],
            ),
            AgentSkill(
                id="configuration-guide",
                name="Configuration Guide",
                description="How to configure Cisco networking features",
                tags=["configuration", "setup", "configure", "enable", "settings", "how-to"],
                examples=[
                    "How do I configure VLANs on Meraki?",
                    "Set up SD-WAN policies",
                    "Configure RADIUS authentication",
                    "Enable content filtering",
                ],
            ),
            AgentSkill(
                id="api-documentation",
                name="API Documentation",
                description="Cisco API usage and integration guidance",
                tags=["api", "integration", "automation", "documentation", "developer"],
                examples=[
                    "How do I use the Meraki API?",
                    "Catalyst Center API examples",
                    "Automate network provisioning",
                    "API rate limits",
                ],
            ),
        ]

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a knowledge skill using RAG + Cisco Circuit.

        Args:
            skill_id: The skill to execute (best-practices, troubleshooting-guidance, etc.)
            params: Parameters including 'query' and optionally 'agent_context'
            context: Execution context with org info, cached data, etc.

        Returns:
            SkillResult with response, sources, and confidence
        """
        query = params.get("query", "")

        if not query:
            return SkillResult(
                success=False,
                error="No query provided",
                data={"response": "Please provide a question to look up."},
            )

        # Import here to avoid circular imports
        from src.services.knowledge_service import get_knowledge_service
        from src.models.knowledge import KnowledgeQueryRequest, AgentContext
        from src.config.database import get_session

        try:
            knowledge_service = get_knowledge_service()

            # Build agent context if available from previous turns
            agent_context = None
            if context.entities_from_previous_turns or context.previous_artifacts:
                agent_context = AgentContext(
                    user_query=query,
                    environment={
                        "org_name": context.org_name,
                        "org_type": context.org_type,
                        "networks": context.cached_networks[:5] if context.cached_networks else [],
                        "devices": context.cached_devices[:10] if context.cached_devices else [],
                    },
                    prior_tool_results=list(context.entities_from_previous_turns.values()) if context.entities_from_previous_turns else [],
                )

            # Determine filters based on skill
            filters = self._get_filters_for_skill(skill_id)

            # Query knowledge base
            async with get_session() as session:
                request = KnowledgeQueryRequest(
                    query=query,
                    agent_context=agent_context,
                    filters=filters,
                    top_k=5,  # Limit to top 5 most relevant chunks
                )

                response = await knowledge_service.query_knowledge(
                    session=session,
                    request=request,
                )

            # Build response text with sources
            response_text = response.response

            if response.sources:
                response_text += "\n\n**Sources:**\n"
                for src in response.sources[:3]:
                    doc_info = f"{src.document}"
                    if hasattr(src, 'doc_type') and src.doc_type:
                        doc_info += f" ({src.doc_type})"
                    response_text += f"- {doc_info}\n"

            # Extract entities for follow-up
            entities = {
                "topics": [s.document for s in response.sources] if response.sources else [],
                "confidence": response.confidence,
                "skill_used": skill_id,
            }

            logger.info(
                f"[KnowledgeAgent] Query completed: skill={skill_id}, "
                f"sources={len(response.sources)}, confidence={response.confidence:.2f}"
            )

            return SkillResult(
                success=True,
                data={
                    "response": response.response,
                    "sources": [
                        {"document": s.document, "chunk_id": s.chunk_id, "relevance": s.relevance_score}
                        for s in response.sources
                    ] if response.sources else [],
                    "confidence": response.confidence,
                },
                entities_extracted=entities,
                # Token usage would come from Cisco Circuit if tracked
                input_tokens=0,
                output_tokens=0,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[KnowledgeAgent] Error executing {skill_id}: {e}", exc_info=True)

            # Check if this is a Circuit AI error - try RAG-only fallback
            is_circuit_error = (
                "Circuit" in error_msg or
                "circuit" in error_msg or
                "401" in error_msg or
                "anthropic" in error_msg.lower() or
                "ai_service" in error_msg.lower()
            )

            if is_circuit_error:
                # Attempt RAG-only fallback
                try:
                    logger.info(f"[KnowledgeAgent] Circuit AI unavailable, attempting RAG-only fallback")
                    fallback_result = await self._rag_only_fallback(query, skill_id, context)
                    if fallback_result:
                        return fallback_result
                except Exception as fallback_error:
                    logger.warning(f"[KnowledgeAgent] RAG fallback also failed: {fallback_error}")

            # Provide user-friendly error messages
            if is_circuit_error:
                friendly_error = (
                    "Cisco Circuit AI is not configured or unavailable. "
                    "The knowledge base search also returned no results. "
                    "Please configure AI credentials in Settings > AI Settings, or ensure "
                    "the knowledge base has been populated."
                )
            elif "knowledge" in error_msg.lower() or "embedding" in error_msg.lower():
                friendly_error = (
                    "The knowledge base may not be initialized. "
                    "Please ensure documents have been ingested via the Knowledge Base page."
                )
            else:
                friendly_error = f"I couldn't retrieve knowledge information: {error_msg}"

            return SkillResult(
                success=False,
                error=error_msg,
                data={
                    "response": friendly_error,
                },
            )

    def _get_filters_for_skill(self, skill_id: str) -> Optional[Dict[str, Any]]:
        """Get document filters based on skill type.

        Different skills may prioritize different document types:
        - best-practices: CVD (Cisco Validated Designs), best practices docs
        - troubleshooting-guidance: Troubleshooting guides, FAQs
        - configuration-guide: Configuration guides, CLI references
        - api-documentation: API documentation

        Args:
            skill_id: The skill being executed

        Returns:
            Optional filters dict for the knowledge query
        """
        skill_filters = {
            "best-practices": {
                "doc_types": ["cvd", "best_practices", "design_guide"],
            },
            "troubleshooting-guidance": {
                "doc_types": ["troubleshooting", "faq", "tech_note"],
            },
            "configuration-guide": {
                "doc_types": ["configuration", "cli_reference", "admin_guide"],
            },
            "api-documentation": {
                "doc_types": ["api", "developer", "integration"],
            },
        }

        return skill_filters.get(skill_id)

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate human-readable summary for knowledge agent results.

        Args:
            skill_id: The skill that was executed
            result: The skill execution result

        Returns:
            Human-readable summary string
        """
        if not result.success:
            return result.data.get("response", "Knowledge query failed.")

        data = result.data
        response = data.get("response", "")
        sources = data.get("sources", [])
        confidence = data.get("confidence", 0)

        # For knowledge responses, return the full response
        # The response is already formatted by Cisco Circuit
        if response:
            summary = response
            if sources and confidence >= 0.5:
                summary += f"\n\n_(Confidence: {confidence:.0%}, {len(sources)} sources)_"
            return summary

        return "No knowledge information found for this query."

    async def _rag_only_fallback(
        self,
        query: str,
        skill_id: str,
        context: AgentExecutionContext
    ) -> Optional[SkillResult]:
        """Fallback to RAG-only search when Circuit AI is unavailable.

        This method performs a vector similarity search on the knowledge base
        and returns relevant document chunks without AI-generated synthesis.

        Args:
            query: The user's query
            skill_id: The skill being executed
            context: Execution context

        Returns:
            SkillResult with RAG results, or None if no results found
        """
        from src.services.knowledge_service import get_knowledge_service
        from src.config.database import get_session

        try:
            knowledge_service = get_knowledge_service()
            filters = self._get_filters_for_skill(skill_id)

            async with get_session() as session:
                # Use RAG-only search (skip AI generation)
                chunks = await knowledge_service.search_chunks(
                    session=session,
                    query=query,
                    filters=filters,
                    top_k=5,
                )

            if not chunks:
                return None

            # Format chunks into a readable response
            response_parts = [
                "**Note:** AI synthesis is unavailable. Here are the most relevant knowledge base excerpts:\n"
            ]

            for i, chunk in enumerate(chunks, 1):
                doc_title = getattr(chunk, 'document_title', 'Document')
                content = getattr(chunk, 'content', str(chunk))
                relevance = getattr(chunk, 'relevance_score', 0)

                # Truncate content if too long
                if len(content) > 500:
                    content = content[:500] + "..."

                response_parts.append(f"**{i}. {doc_title}** (relevance: {relevance:.0%})")
                response_parts.append(f"> {content}\n")

            response_text = "\n".join(response_parts)

            logger.info(f"[KnowledgeAgent] RAG fallback returned {len(chunks)} chunks")

            return SkillResult(
                success=True,
                data={
                    "response": response_text,
                    "sources": [
                        {
                            "document": getattr(c, 'document_title', 'Unknown'),
                            "chunk_id": getattr(c, 'id', None),
                            "relevance": getattr(c, 'relevance_score', 0),
                        }
                        for c in chunks
                    ],
                    "confidence": 0.5,  # Lower confidence for RAG-only
                    "fallback_mode": True,
                },
                entities_extracted={
                    "topics": [getattr(c, 'document_title', '') for c in chunks],
                    "confidence": 0.5,
                    "skill_used": skill_id,
                    "fallback_mode": True,
                },
            )

        except Exception as e:
            logger.warning(f"[KnowledgeAgent] RAG-only fallback failed: {e}")
            return None
