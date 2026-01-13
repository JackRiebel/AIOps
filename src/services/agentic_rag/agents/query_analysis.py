"""Query Analysis Agent for agentic RAG pipeline.

This agent analyzes incoming queries to:
1. Classify query type (simple, complex, multi-hop, procedural, etc.)
2. Identify Cisco-specific topics/products mentioned
3. Decompose complex queries into sub-questions
4. Assess query complexity for routing decisions
"""

import json
import logging
from typing import Optional, Any, List

from ..base_agent import BaseRAGAgent
from ..state import RAGState, SubQuestion, QueryType

logger = logging.getLogger(__name__)

# Cisco product/topic keywords for classification
CISCO_TOPICS = {
    "meraki": ["meraki", "mr", "ms", "mx", "dashboard", "cloud-managed"],
    "catalyst": ["catalyst", "c9200", "c9300", "c9400", "c9500", "c9600", "9200", "9300", "9400", "9500"],
    "ios-xe": ["ios-xe", "ios xe", "iosxe", "cisco ios"],
    "ise": ["ise", "identity services engine", "radius", "tacacs"],
    "dnac": ["dna center", "dnac", "dna-c", "catalyst center"],
    "aci": ["aci", "apic", "application centric"],
    "nexus": ["nexus", "nxos", "nx-os", "n9k", "n5k"],
    "sd-wan": ["sd-wan", "sdwan", "vmanage", "vedge", "viptela"],
    "thousandeyes": ["thousandeyes", "te", "internet insights"],
    "webex": ["webex", "collaboration"],
}


QUERY_ANALYSIS_SYSTEM_PROMPT = """You are a query analysis agent for a Cisco network management knowledge base.

Your task is to analyze the user's query and provide structured analysis.

## Output Format (JSON)
{
    "query_type": "simple|complex|multi_hop|procedural|comparative|troubleshooting",
    "cisco_topics": ["list", "of", "relevant", "cisco", "products"],
    "intent": "brief description of what the user wants",
    "complexity_score": 0.0-1.0,
    "sub_questions": [
        {"id": 1, "question": "...", "topic": "...", "priority": 1},
        {"id": 2, "question": "...", "topic": "...", "priority": 2}
    ]
}

## Query Type Definitions
- simple: Single factual question with one answer
- complex: Multi-faceted question requiring multiple pieces of information
- multi_hop: Requires reasoning across multiple documents/concepts
- procedural: How-to or step-by-step instructions
- comparative: Compare/contrast between options
- troubleshooting: Debug or diagnose an issue

## Sub-Question Guidelines
- Only decompose if query is complex/multi_hop/comparative
- Maximum 3 sub-questions
- Each should be answerable independently
- Priority 1 = most important, 3 = least important

## Cisco Topic Detection
Identify which Cisco products/technologies are relevant:
meraki, catalyst, ios-xe, ise, dnac, aci, nexus, sd-wan, thousandeyes, webex

If no specific product is mentioned, use "general".
"""


class QueryAnalysisAgent(BaseRAGAgent):
    """Analyzes queries to determine type, topics, and sub-questions.

    This agent uses LLM to decompose complex queries and identify
    Cisco-specific topics for better retrieval targeting.
    """

    def __init__(
        self,
        llm_service: Optional[Any] = None,
        enabled: bool = True,
        max_sub_questions: int = 3,
    ):
        super().__init__(
            name="query_analysis",
            llm_service=llm_service,
            enabled=enabled,
            timeout_ms=3000,
        )
        self.max_sub_questions = max_sub_questions

    async def process(self, state: RAGState) -> RAGState:
        """Analyze the query and update state with analysis results.

        Args:
            state: Current RAG state

        Returns:
            Updated state with query analysis
        """
        query = state.original_query

        # Quick classification for simple queries (no LLM needed)
        if self._is_simple_query(query):
            state.query_type = QueryType.SIMPLE
            state.cisco_topics = self._detect_topics_fast(query)
            state.complexity_score = 0.2
            state.intent = "simple factual query"
            logger.info(f"Query classified as simple (fast path): {state.cisco_topics}")
            return state

        # For complex queries, use LLM analysis
        try:
            analysis = await self._analyze_with_llm(query)
            state = self._apply_analysis(state, analysis)
            logger.info(
                f"Query analysis complete: type={state.query_type.value}, "
                f"topics={state.cisco_topics}, sub_questions={len(state.sub_questions)}"
            )
        except Exception as e:
            logger.warning(f"LLM analysis failed, using fallback: {e}")
            state = self._fallback_analysis(state)

        return state

    def _is_simple_query(self, query: str) -> bool:
        """Determine if query is simple enough to skip LLM analysis.

        Simple queries:
        - Short (< 15 words)
        - Single question mark or none
        - No comparison words (vs, compare, difference)
        - No multi-step indicators (first, then, after)
        """
        words = query.split()
        if len(words) > 15:
            return False

        query_lower = query.lower()

        # Check for complexity indicators
        complex_indicators = [
            "compare", "vs", "versus", "difference between",
            "how do i", "step by step", "first", "then",
            "multiple", "several", "and also", "as well as",
            "troubleshoot", "debug", "why does", "why is",
        ]

        for indicator in complex_indicators:
            if indicator in query_lower:
                return False

        return True

    def _detect_topics_fast(self, query: str) -> List[str]:
        """Fast topic detection using keyword matching.

        Args:
            query: User query

        Returns:
            List of detected Cisco topics
        """
        query_lower = query.lower()
        detected = []

        for topic, keywords in CISCO_TOPICS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    detected.append(topic)
                    break  # Found this topic, move to next

        return detected if detected else ["general"]

    async def _analyze_with_llm(self, query: str) -> dict:
        """Use LLM to analyze complex query.

        Args:
            query: User query

        Returns:
            Parsed analysis dict
        """
        prompt = f"""Analyze this query for a Cisco network management knowledge base:

Query: {query}

Provide your analysis as JSON."""

        response = await self.call_llm(
            prompt=prompt,
            system_prompt=QUERY_ANALYSIS_SYSTEM_PROMPT,
            json_output=True,
            max_tokens=512,
            temperature=0.0,
        )

        # Track LLM call
        # Note: actual token counting would happen in the LLM service

        # Parse JSON response
        try:
            # Handle potential markdown code blocks
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]

            return json.loads(response.strip())
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM response as JSON: {e}")
            raise

    def _apply_analysis(self, state: RAGState, analysis: dict) -> RAGState:
        """Apply LLM analysis results to state.

        Args:
            state: Current state
            analysis: Parsed LLM analysis

        Returns:
            Updated state
        """
        # Map query type
        query_type_map = {
            "simple": QueryType.SIMPLE,
            "complex": QueryType.COMPLEX,
            "multi_hop": QueryType.MULTI_HOP,
            "procedural": QueryType.PROCEDURAL,
            "comparative": QueryType.COMPARATIVE,
            "troubleshooting": QueryType.TROUBLESHOOTING,
        }

        query_type_str = analysis.get("query_type", "simple")
        state.query_type = query_type_map.get(query_type_str, QueryType.SIMPLE)

        # Set topics
        state.cisco_topics = analysis.get("cisco_topics", ["general"])

        # Set intent
        state.intent = analysis.get("intent", "")

        # Set complexity
        state.complexity_score = float(analysis.get("complexity_score", 0.5))

        # Parse sub-questions
        sub_questions_data = analysis.get("sub_questions", [])
        state.sub_questions = []

        for i, sq in enumerate(sub_questions_data[:self.max_sub_questions]):
            state.sub_questions.append(
                SubQuestion(
                    id=sq.get("id", i + 1),
                    question=sq.get("question", ""),
                    topic=sq.get("topic"),
                    priority=sq.get("priority", i + 1),
                )
            )

        state.total_llm_calls += 1

        return state

    def _fallback_analysis(self, state: RAGState) -> RAGState:
        """Fallback analysis when LLM fails.

        Uses simple heuristics to provide basic classification.

        Args:
            state: Current state

        Returns:
            Updated state with fallback analysis
        """
        query = state.original_query.lower()

        # Detect query type with heuristics
        if "how do i" in query or "how to" in query or "steps" in query:
            state.query_type = QueryType.PROCEDURAL
        elif "compare" in query or "vs" in query or "difference" in query:
            state.query_type = QueryType.COMPARATIVE
        elif "troubleshoot" in query or "debug" in query or "not working" in query:
            state.query_type = QueryType.TROUBLESHOOTING
        elif "?" in query and len(query.split()) > 10:
            state.query_type = QueryType.COMPLEX
        else:
            state.query_type = QueryType.SIMPLE

        # Use fast topic detection
        state.cisco_topics = self._detect_topics_fast(query)

        # Set reasonable defaults
        state.complexity_score = 0.5
        state.intent = "user query"

        return state
