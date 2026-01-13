"""Document Grader Agent for agentic RAG pipeline.

This agent uses LLM to evaluate the relevance of retrieved documents,
filtering out noise and ensuring only truly relevant content is used
for synthesis.

This is a key component that improves answer quality by preventing
low-quality retrievals from polluting the context.
"""

import json
import logging
from typing import Optional, Any, List, Dict

from ..base_agent import BaseRAGAgent
from ..state import RAGState, GradedDocument

logger = logging.getLogger(__name__)


DOCUMENT_GRADING_SYSTEM_PROMPT = """You are a document relevance grader for a Cisco network management knowledge base.

Your task is to evaluate whether retrieved document chunks are relevant to the user's query.

## Grading Criteria
- RELEVANT: Document directly addresses the query topic
- RELEVANT: Document provides necessary background/context for the query
- RELEVANT: Document contains procedures/steps related to the query
- NOT RELEVANT: Document is about a different product/feature
- NOT RELEVANT: Document is tangentially related but doesn't help answer the query
- NOT RELEVANT: Document is too generic or doesn't add useful information

## Output Format (JSON)
{
    "grades": [
        {
            "chunk_id": <int>,
            "is_relevant": true/false,
            "relevance_score": 0.0-1.0,
            "reasoning": "brief explanation"
        }
    ]
}

## Scoring Guidelines
- 0.9-1.0: Directly answers the query
- 0.7-0.8: Highly relevant, provides key information
- 0.5-0.6: Moderately relevant, useful context
- 0.3-0.4: Marginally relevant, might help
- 0.0-0.2: Not relevant

Be strict but fair. When in doubt, lean towards including the document.
"""


class DocumentGraderAgent(BaseRAGAgent):
    """Grades document relevance using LLM evaluation.

    This agent filters retrieved documents by having an LLM evaluate
    their relevance to the query. This reduces noise and improves
    synthesis quality.
    """

    def __init__(
        self,
        llm_service: Optional[Any] = None,
        enabled: bool = True,
        max_documents: int = 10,
        relevance_threshold: float = 0.5,
        batch_grading: bool = True,
    ):
        super().__init__(
            name="document_grader",
            llm_service=llm_service,
            enabled=enabled,
            timeout_ms=5000,
        )
        self.max_documents = max_documents
        self.relevance_threshold = relevance_threshold
        self.batch_grading = batch_grading

    async def process(self, state: RAGState) -> RAGState:
        """Grade retrieved documents for relevance.

        Args:
            state: Current RAG state with retrieved_chunks

        Returns:
            Updated state with graded_documents
        """
        if not state.retrieved_chunks:
            logger.warning("No retrieved chunks to grade")
            return state

        # Take top N documents for grading
        chunks_to_grade = state.retrieved_chunks[:self.max_documents]

        try:
            if self.batch_grading:
                grades = await self._batch_grade(state.original_query, chunks_to_grade)
            else:
                grades = await self._individual_grade(state.original_query, chunks_to_grade)

            # Convert to GradedDocument objects
            state.graded_documents = self._create_graded_documents(chunks_to_grade, grades)

            # Calculate statistics
            relevant_docs = [d for d in state.graded_documents if d.is_relevant]
            state.num_relevant_docs = len(relevant_docs)

            if state.graded_documents:
                state.avg_graded_relevance = sum(
                    d.graded_relevance for d in state.graded_documents
                ) / len(state.graded_documents)

            logger.info(
                f"Document grading complete: {state.num_relevant_docs}/{len(state.graded_documents)} relevant, "
                f"avg_relevance={state.avg_graded_relevance:.2f}"
            )

        except Exception as e:
            logger.error(f"Document grading failed: {e}")
            # Fallback: use vector similarity scores as relevance
            state.graded_documents = self._fallback_grading(chunks_to_grade)
            state.num_relevant_docs = len([d for d in state.graded_documents if d.is_relevant])

        return state

    async def _batch_grade(
        self,
        query: str,
        chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Grade all documents in a single LLM call.

        Args:
            query: User query
            chunks: List of chunk dictionaries

        Returns:
            List of grade dictionaries
        """
        # Build document list for prompt
        doc_list = []
        for i, chunk in enumerate(chunks):
            doc_list.append(
                f"[Document {chunk.get('id', i)}]\n"
                f"Source: {chunk.get('document_filename', 'Unknown')}\n"
                f"Type: {chunk.get('document_type', 'Unknown')}\n"
                f"Content: {chunk.get('content', '')[:500]}..."
                if len(chunk.get('content', '')) > 500 else
                f"[Document {chunk.get('id', i)}]\n"
                f"Source: {chunk.get('document_filename', 'Unknown')}\n"
                f"Type: {chunk.get('document_type', 'Unknown')}\n"
                f"Content: {chunk.get('content', '')}"
            )

        documents_text = "\n\n".join(doc_list)

        prompt = f"""Evaluate the relevance of each document to the query.

Query: {query}

Documents:
{documents_text}

Provide your relevance grades as JSON."""

        response = await self.call_llm(
            prompt=prompt,
            system_prompt=DOCUMENT_GRADING_SYSTEM_PROMPT,
            json_output=True,
            max_tokens=1024,
            temperature=0.0,
        )

        # Parse response
        grades = self._parse_grades_response(response)

        # Track LLM call
        state_ref = RAGState(original_query=query)  # Temporary for tracking
        state_ref.total_llm_calls = 1

        return grades

    async def _individual_grade(
        self,
        query: str,
        chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Grade each document individually (more accurate but slower).

        Args:
            query: User query
            chunks: List of chunk dictionaries

        Returns:
            List of grade dictionaries
        """
        import asyncio

        async def grade_one(chunk: Dict[str, Any]) -> Dict[str, Any]:
            prompt = f"""Evaluate if this document is relevant to the query.

Query: {query}

Document:
Source: {chunk.get('document_filename', 'Unknown')}
Type: {chunk.get('document_type', 'Unknown')}
Content: {chunk.get('content', '')}

Is this document relevant? Provide your assessment as JSON with:
- is_relevant: true/false
- relevance_score: 0.0-1.0
- reasoning: brief explanation"""

            response = await self.call_llm(
                prompt=prompt,
                system_prompt="You are a document relevance evaluator. Respond only with JSON.",
                json_output=True,
                max_tokens=256,
                temperature=0.0,
            )

            try:
                grade = json.loads(response.strip())
                grade["chunk_id"] = chunk.get("id", 0)
                return grade
            except json.JSONDecodeError:
                # Fallback to using vector similarity
                return {
                    "chunk_id": chunk.get("id", 0),
                    "is_relevant": chunk.get("relevance", 0.5) >= self.relevance_threshold,
                    "relevance_score": chunk.get("relevance", 0.5),
                    "reasoning": "LLM parsing failed, using vector similarity",
                }

        # Grade all in parallel
        grades = await asyncio.gather(*[grade_one(chunk) for chunk in chunks])
        return list(grades)

    def _parse_grades_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse LLM grading response.

        Args:
            response: LLM response text

        Returns:
            List of grade dictionaries
        """
        try:
            # Handle markdown code blocks
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]

            data = json.loads(response.strip())

            if isinstance(data, dict) and "grades" in data:
                return data["grades"]
            elif isinstance(data, list):
                return data
            else:
                logger.warning(f"Unexpected grades response format: {type(data)}")
                return []

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse grades JSON: {e}")
            return []

    def _create_graded_documents(
        self,
        chunks: List[Dict[str, Any]],
        grades: List[Dict[str, Any]]
    ) -> List[GradedDocument]:
        """Create GradedDocument objects from chunks and grades.

        Args:
            chunks: Original chunk dictionaries
            grades: LLM-generated grades

        Returns:
            List of GradedDocument objects
        """
        # Index grades by chunk_id for fast lookup
        grades_by_id = {g.get("chunk_id"): g for g in grades}

        graded_docs = []

        for chunk in chunks:
            chunk_id = chunk.get("id", 0)
            grade = grades_by_id.get(chunk_id, {})

            # Determine relevance
            is_relevant = grade.get("is_relevant", True)  # Default to True if no grade
            graded_relevance = grade.get("relevance_score", chunk.get("relevance", 0.5))

            # Apply threshold
            if graded_relevance < self.relevance_threshold:
                is_relevant = False

            graded_doc = GradedDocument(
                chunk_id=chunk_id,
                content=chunk.get("content", ""),
                document_filename=chunk.get("document_filename", "Unknown"),
                document_title=chunk.get("document_title"),
                document_type=chunk.get("document_type", "unknown"),
                document_product=chunk.get("document_product"),
                original_relevance=chunk.get("relevance", 0.0),
                is_relevant=is_relevant,
                graded_relevance=graded_relevance,
                reasoning=grade.get("reasoning"),
                metadata=chunk.get("chunk_metadata", {}),
            )

            graded_docs.append(graded_doc)

        return graded_docs

    def _fallback_grading(self, chunks: List[Dict[str, Any]]) -> List[GradedDocument]:
        """Fallback grading using vector similarity scores.

        Args:
            chunks: Original chunk dictionaries

        Returns:
            List of GradedDocument objects with similarity-based relevance
        """
        logger.info("Using fallback grading with vector similarity scores")

        graded_docs = []

        for chunk in chunks:
            relevance = chunk.get("relevance", 0.5)

            graded_doc = GradedDocument(
                chunk_id=chunk.get("id", 0),
                content=chunk.get("content", ""),
                document_filename=chunk.get("document_filename", "Unknown"),
                document_title=chunk.get("document_title"),
                document_type=chunk.get("document_type", "unknown"),
                document_product=chunk.get("document_product"),
                original_relevance=relevance,
                is_relevant=relevance >= self.relevance_threshold,
                graded_relevance=relevance,
                reasoning="Using vector similarity (LLM grading unavailable)",
                metadata=chunk.get("chunk_metadata", {}),
            )

            graded_docs.append(graded_doc)

        return graded_docs
