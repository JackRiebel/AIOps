"""Synthesis Agent for agentic RAG pipeline.

This agent generates the final answer using retrieved and graded documents,
ensuring proper citations and comprehensive coverage of the query.
"""

import json
import logging
from typing import Optional, Any, List

from ..base_agent import BaseRAGAgent
from ..state import RAGState, Citation, GradedDocument

logger = logging.getLogger(__name__)


SYNTHESIS_SYSTEM_PROMPT = """You are a Cisco network expert assistant generating well-cited answers from knowledge base content.

## Your Task
Generate a clear, accurate answer based on the provided documents. Every factual claim must be backed by a citation.

## Formatting Rules
- Use **bullet points** for lists of features, specs, or options - never tables
- Use **bold** for key terms, model names, and important values
- Keep paragraphs short (2-3 sentences max)
- Use headers (##) to organize longer answers
- Be concise - no filler phrases like "Based on the documentation..."

## Citation Format
Use inline citations like [1] immediately after the relevant fact. Example:
- The **MX67** supports **700 Mbps** NGFW throughput [1]

## Answer Structure
1. **Direct answer first** - state the key facts immediately
2. **Supporting details** - bullet points with specs/features
3. **Context** - brief notes on use cases or caveats (if relevant)

## Example Good Response:
The **MX67** provides the following throughput:

- **NGFW throughput**: 700 Mbps [1]
- **Advanced Security**: 400 Mbps (with IDS/AMP enabled) [1]
- **VPN throughput**: 400 Mbps [1]

Designed for small branches with up to 50 users [1].

## Guidelines
- Be precise and technical - this is for network professionals
- Never use markdown tables - always use bullet points
- Put the most important information first
- If documents conflict, note the discrepancy briefly
- If info is incomplete, acknowledge what's missing

## Output Format
Answer directly with inline [1], [2] citations. End with:

**Source:** [1] Document name - Page X
"""


class SynthesisAgent(BaseRAGAgent):
    """Generates well-cited answers from retrieved documents.

    This agent uses LLM to synthesize a comprehensive answer that:
    - Directly addresses the query
    - Uses proper citations
    - Addresses all sub-questions if present
    - Maintains technical accuracy
    """

    def __init__(
        self,
        llm_service: Optional[Any] = None,
        enabled: bool = True,
        max_tokens: int = 2048,
        require_citations: bool = True,
        min_citations: int = 1,
    ):
        super().__init__(
            name="synthesis",
            llm_service=llm_service,
            enabled=enabled,
            timeout_ms=10000,
        )
        self.max_tokens = max_tokens
        self.require_citations = require_citations
        self.min_citations = min_citations

    async def process(self, state: RAGState) -> RAGState:
        """Synthesize answer from graded documents.

        Args:
            state: Current RAG state with graded documents

        Returns:
            Updated state with synthesized answer
        """
        relevant_docs = state.get_relevant_documents()

        if not relevant_docs:
            logger.warning("No relevant documents for synthesis")
            state.answer = self._generate_no_results_response(state)
            state.confidence = 0.1
            return state

        try:
            # Build context from documents
            context = self._build_context(relevant_docs, state.web_results)

            # Build prompt with sub-questions if present
            prompt = self._build_synthesis_prompt(state, context)

            # Generate answer
            response = await self.call_llm(
                prompt=prompt,
                system_prompt=SYNTHESIS_SYSTEM_PROMPT,
                max_tokens=self.max_tokens,
                temperature=0.1,  # Low temperature for accuracy
            )

            state.total_llm_calls += 1

            # Parse response and extract citations
            state.answer = response
            state.citations = self._extract_citations(response, relevant_docs)
            state.sources_used = len(state.citations)

            # Calculate confidence based on citation coverage
            state.confidence = self._calculate_confidence(state)

            logger.info(
                f"Synthesis complete: {len(state.citations)} citations, "
                f"confidence={state.confidence:.2f}"
            )

        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            state.answer = self._generate_error_response(state, str(e))
            state.confidence = 0.2

        return state

    def _build_context(
        self,
        documents: List[GradedDocument],
        web_results: List[Any] = None
    ) -> str:
        """Build context string from documents.

        Args:
            documents: Graded relevant documents
            web_results: Optional web search results

        Returns:
            Formatted context string
        """
        context_parts = []

        # Add knowledge base documents
        for i, doc in enumerate(documents, 1):
            # Extract page number from metadata if available
            page_info = ""
            if doc.metadata and doc.metadata.get("page"):
                page_info = f", Page {doc.metadata['page']}"

            context_parts.append(
                f"[{i}] **{doc.document_filename}**{page_info}\n"
                f"{doc.content}"
            )

        # Add web results if present
        if web_results:
            offset = len(documents)
            for i, result in enumerate(web_results, offset + 1):
                context_parts.append(
                    f"[{i}] **{result.title}** (Web)\n"
                    f"URL: {result.url}\n"
                    f"{result.content or result.snippet}"
                )

        return "\n\n---\n\n".join(context_parts)

    def _build_synthesis_prompt(self, state: RAGState, context: str) -> str:
        """Build the synthesis prompt.

        Args:
            state: Current state
            context: Formatted context string

        Returns:
            Synthesis prompt
        """
        prompt_parts = [f"Query: {state.original_query}"]

        # Add sub-questions if present
        if state.sub_questions:
            sub_q_text = "\n".join(
                f"  - {sq.question}" for sq in state.sub_questions
            )
            prompt_parts.append(f"\nSub-questions to address:\n{sub_q_text}")

        # Add iteration context if this is a refinement pass
        if state.iteration_count > 0 and state.reflection_notes:
            notes = "\n".join(f"  - {note}" for note in state.reflection_notes)
            prompt_parts.append(
                f"\nPrevious answer needed improvement. Please address:\n{notes}"
            )

        prompt_parts.append(f"\n\nContext Documents:\n{context}")

        prompt_parts.append(
            "\n\nGenerate a comprehensive answer with proper citations. "
            "Use [1], [2], etc. to cite your sources."
        )

        return "\n".join(prompt_parts)

    def _extract_citations(
        self,
        response: str,
        documents: List[GradedDocument]
    ) -> List[Citation]:
        """Extract citations from response.

        Args:
            response: LLM response text
            documents: Source documents

        Returns:
            List of Citation objects
        """
        import re

        citations = []
        seen_indices = set()

        # Find all citation patterns [1], [2], etc.
        pattern = r'\[(\d+)\]'
        matches = re.findall(pattern, response)

        for match in matches:
            idx = int(match)
            if idx in seen_indices:
                continue
            seen_indices.add(idx)

            # Map to document (1-indexed in response, 0-indexed in list)
            if 1 <= idx <= len(documents):
                doc = documents[idx - 1]
                citations.append(
                    Citation(
                        index=idx,
                        document=doc.document_filename,
                        chunk_id=doc.chunk_id,
                        relevance=doc.graded_relevance,
                        excerpt=doc.content[:200] if doc.content else None,
                    )
                )

        return citations

    def _calculate_confidence(self, state: RAGState) -> float:
        """Calculate confidence score for the answer.

        Args:
            state: Current state

        Returns:
            Confidence score 0-1
        """
        confidence = 0.5  # Base confidence

        # Boost for more citations
        if state.citations:
            citation_boost = min(len(state.citations) * 0.1, 0.3)
            confidence += citation_boost

        # Boost for high relevance documents
        relevant_docs = state.get_relevant_documents()
        if relevant_docs:
            avg_relevance = sum(d.graded_relevance for d in relevant_docs) / len(relevant_docs)
            confidence += avg_relevance * 0.2

        # Penalty for insufficient KB coverage
        if not state.kb_coverage_sufficient:
            confidence -= 0.15

        # Boost if sub-questions were addressed
        if state.sub_questions:
            # Simple heuristic: assume addressed if citations exist
            if len(state.citations) >= len(state.sub_questions):
                confidence += 0.1

        return min(max(confidence, 0.1), 1.0)

    def _generate_no_results_response(self, state: RAGState) -> str:
        """Generate response when no relevant documents found.

        Args:
            state: Current state

        Returns:
            Response text
        """
        return (
            f"I couldn't find relevant information in the knowledge base to answer "
            f"your question about: {state.original_query}\n\n"
            "This might be because:\n"
            "- The topic isn't covered in the current knowledge base\n"
            "- The query uses different terminology than the documentation\n"
            "- The information is in a document that hasn't been ingested yet\n\n"
            "You might want to:\n"
            "- Rephrase your question using different terms\n"
            "- Check the official Cisco documentation directly\n"
            "- Add relevant documentation to the knowledge base"
        )

    def _generate_error_response(self, state: RAGState, error: str) -> str:
        """Generate response when synthesis fails.

        Args:
            state: Current state
            error: Error message

        Returns:
            Response text
        """
        return (
            f"I encountered an issue while generating the answer: {error}\n\n"
            f"Your question: {state.original_query}\n\n"
            f"I found {len(state.graded_documents)} relevant documents but couldn't "
            "synthesize them into a coherent answer. Please try again."
        )
