"""Reflection Agent for agentic RAG pipeline.

This agent self-evaluates the synthesized answer to determine
if another iteration is needed to improve quality.

The reflection process checks:
- Completeness: Does the answer address all aspects of the query?
- Accuracy: Are claims properly supported by citations?
- Clarity: Is the answer clear and well-structured?
- Specificity: Does it provide concrete, actionable information?
"""

import json
import logging
from typing import Optional, Any

from ..base_agent import BaseRAGAgent
from ..state import RAGState, AnswerQuality

logger = logging.getLogger(__name__)


REFLECTION_SYSTEM_PROMPT = """You are a quality evaluator for Cisco network documentation answers.

Your task is to critically evaluate an answer generated from a knowledge base and determine if it needs improvement.

## Evaluation Criteria

1. **Completeness** (0-1): Does the answer address all aspects of the question?
   - All sub-questions answered
   - No major gaps in coverage

2. **Accuracy** (0-1): Are claims properly supported?
   - Citations provided for key claims
   - No unsupported statements
   - Technical accuracy

3. **Specificity** (0-1): Is the answer concrete and actionable?
   - Specific commands, configurations, or steps
   - Not vague or generic
   - Practical implementation details

4. **Clarity** (0-1): Is the answer clear and well-structured?
   - Logical organization
   - Easy to follow
   - Professional tone

## Output Format (JSON)
{
    "quality": "excellent|good|needs_iteration|insufficient_kb",
    "overall_score": 0.0-1.0,
    "scores": {
        "completeness": 0.0-1.0,
        "accuracy": 0.0-1.0,
        "specificity": 0.0-1.0,
        "clarity": 0.0-1.0
    },
    "issues": ["list of specific issues found"],
    "missing_aspects": ["aspects of query not addressed"],
    "recommendation": "brief recommendation for improvement if needed"
}

## Quality Thresholds
- excellent: overall_score >= 0.85
- good: overall_score >= 0.70
- needs_iteration: overall_score >= 0.50
- insufficient_kb: overall_score < 0.50
"""


class ReflectionAgent(BaseRAGAgent):
    """Self-evaluates answer quality and decides if iteration is needed.

    This agent uses LLM to critically assess the synthesized answer
    and determine if the pipeline should iterate for improvement.
    """

    def __init__(
        self,
        llm_service: Optional[Any] = None,
        enabled: bool = True,
        quality_threshold: float = 0.7,
    ):
        super().__init__(
            name="reflection",
            llm_service=llm_service,
            enabled=enabled,
            timeout_ms=5000,
        )
        self.quality_threshold = quality_threshold

    async def process(self, state: RAGState) -> RAGState:
        """Evaluate answer quality and decide on iteration.

        Args:
            state: Current RAG state with synthesized answer

        Returns:
            Updated state with quality assessment
        """
        if not state.answer:
            logger.warning("No answer to evaluate")
            state.quality = AnswerQuality.INSUFFICIENT_KB
            state.should_iterate = False
            return state

        try:
            evaluation = await self._evaluate_answer(state)
            state = self._apply_evaluation(state, evaluation)

            logger.info(
                f"Reflection complete: quality={state.quality.value}, "
                f"score={state.quality_score:.2f}, "
                f"should_iterate={state.should_iterate}"
            )

        except Exception as e:
            logger.error(f"Reflection failed: {e}")
            # Default to good quality if reflection fails
            state.quality = AnswerQuality.GOOD
            state.quality_score = 0.7
            state.should_iterate = False

        return state

    async def _evaluate_answer(self, state: RAGState) -> dict:
        """Use LLM to evaluate answer quality.

        Args:
            state: Current state

        Returns:
            Evaluation dictionary
        """
        # Build evaluation prompt
        prompt_parts = [
            f"**Original Query:** {state.original_query}",
        ]

        if state.sub_questions:
            sub_q = "\n".join(f"  - {sq.question}" for sq in state.sub_questions)
            prompt_parts.append(f"\n**Sub-questions to address:**\n{sub_q}")

        prompt_parts.append(f"\n**Generated Answer:**\n{state.answer}")

        prompt_parts.append(
            f"\n**Number of citations:** {len(state.citations)}"
        )

        prompt_parts.append(
            f"\n**KB coverage sufficient:** {state.kb_coverage_sufficient}"
        )

        prompt_parts.append(
            "\nEvaluate this answer critically and provide your assessment as JSON."
        )

        prompt = "\n".join(prompt_parts)

        response = await self.call_llm(
            prompt=prompt,
            system_prompt=REFLECTION_SYSTEM_PROMPT,
            json_output=True,
            max_tokens=512,
            temperature=0.0,
        )

        state.total_llm_calls += 1

        return self._parse_evaluation(response)

    def _parse_evaluation(self, response: str) -> dict:
        """Parse LLM evaluation response.

        Args:
            response: LLM response text

        Returns:
            Parsed evaluation dictionary
        """
        try:
            # Handle markdown code blocks
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]

            return json.loads(response.strip())

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse evaluation JSON: {e}")
            # Return default evaluation
            return {
                "quality": "good",
                "overall_score": 0.7,
                "scores": {
                    "completeness": 0.7,
                    "accuracy": 0.7,
                    "specificity": 0.7,
                    "clarity": 0.7,
                },
                "issues": [],
                "missing_aspects": [],
                "recommendation": "Evaluation parsing failed, using default",
            }

    def _apply_evaluation(self, state: RAGState, evaluation: dict) -> RAGState:
        """Apply evaluation results to state.

        Args:
            state: Current state
            evaluation: Parsed evaluation

        Returns:
            Updated state
        """
        # Map quality string to enum
        quality_map = {
            "excellent": AnswerQuality.EXCELLENT,
            "good": AnswerQuality.GOOD,
            "needs_iteration": AnswerQuality.NEEDS_ITERATION,
            "insufficient_kb": AnswerQuality.INSUFFICIENT_KB,
        }

        quality_str = evaluation.get("quality", "good").lower()
        state.quality = quality_map.get(quality_str, AnswerQuality.GOOD)

        # Set score
        state.quality_score = float(evaluation.get("overall_score", 0.7))

        # Collect issues and missing aspects
        state.reflection_notes = evaluation.get("issues", [])
        state.missing_aspects = evaluation.get("missing_aspects", [])

        # Determine if iteration is needed
        if state.quality == AnswerQuality.NEEDS_ITERATION:
            if state.iteration_count < state.max_iterations:
                state.should_iterate = True
                # Set focus for next iteration
                if state.missing_aspects:
                    state.iteration_focus = state.missing_aspects[0]
                elif state.reflection_notes:
                    state.iteration_focus = state.reflection_notes[0]
            else:
                logger.info("Max iterations reached, not iterating")
                state.should_iterate = False

        elif state.quality in (AnswerQuality.EXCELLENT, AnswerQuality.GOOD):
            state.should_iterate = False
            state.mark_complete()

        elif state.quality == AnswerQuality.INSUFFICIENT_KB:
            # Don't iterate if KB doesn't have the content
            state.should_iterate = False
            logger.warning("KB insufficient for query, cannot improve through iteration")

        return state

    def get_improvement_suggestions(self, state: RAGState) -> list:
        """Get specific suggestions for improving the answer.

        Args:
            state: Current state

        Returns:
            List of improvement suggestions
        """
        suggestions = []

        if state.missing_aspects:
            for aspect in state.missing_aspects:
                suggestions.append(f"Address missing aspect: {aspect}")

        if state.reflection_notes:
            for note in state.reflection_notes:
                suggestions.append(f"Fix issue: {note}")

        if len(state.citations) < 2:
            suggestions.append("Add more citations to support claims")

        if state.quality_score < 0.6:
            suggestions.append("Consider retrieving additional documents")

        return suggestions
