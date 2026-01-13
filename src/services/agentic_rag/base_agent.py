"""Base agent class for agentic RAG pipeline.

All agents in the pipeline inherit from BaseRAGAgent, which provides:
- Common interface (process method)
- Automatic timing and metrics collection
- Error handling and logging
- Enable/disable functionality
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import Optional, Any, Dict

from .state import RAGState

logger = logging.getLogger(__name__)


class BaseRAGAgent(ABC):
    """Abstract base class for all RAG agents.

    Each agent processes the shared RAGState and returns an updated state.
    Agents can be enabled/disabled via configuration.
    """

    def __init__(
        self,
        name: str,
        llm_service: Optional[Any] = None,
        enabled: bool = True,
        timeout_ms: float = 5000,
    ):
        """Initialize the agent.

        Args:
            name: Human-readable name for logging/metrics
            llm_service: Service for LLM calls (if agent needs LLM)
            enabled: Whether this agent is active
            timeout_ms: Maximum execution time in milliseconds
        """
        self.name = name
        self.llm = llm_service
        self.enabled = enabled
        self.timeout_ms = timeout_ms

    @abstractmethod
    async def process(self, state: RAGState) -> RAGState:
        """Process the state and return updated state.

        This is the main logic of the agent, implemented by subclasses.

        Args:
            state: Current RAG pipeline state

        Returns:
            Updated RAG pipeline state
        """
        pass

    async def execute(self, state: RAGState) -> RAGState:
        """Execute the agent with timing, logging, and error handling.

        This is the public method called by the orchestrator.
        It wraps the process() method with common functionality.

        Args:
            state: Current RAG pipeline state

        Returns:
            Updated RAG pipeline state
        """
        # Skip if disabled
        if not self.enabled:
            logger.debug(f"Agent {self.name} is disabled, skipping")
            return state

        # Skip if pipeline already errored
        if state.error:
            logger.debug(f"Agent {self.name} skipped due to prior error: {state.error}")
            return state

        start_time = time.time()
        logger.info(f"Agent {self.name} starting...")

        try:
            # Execute the agent's logic
            updated_state = await self.process(state)

            # Record timing
            duration_ms = (time.time() - start_time) * 1000
            updated_state.add_timing(self.name, duration_ms)

            logger.info(f"Agent {self.name} completed in {duration_ms:.1f}ms")
            return updated_state

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Agent {self.name} failed after {duration_ms:.1f}ms: {e}")

            # Record the error but don't re-raise
            # This allows graceful degradation
            state.error = f"{self.name}: {str(e)}"
            state.add_timing(self.name, duration_ms)
            return state

    async def call_llm(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_output: bool = False,
        max_tokens: int = 1024,
        temperature: float = 0.0,
    ) -> str:
        """Call the LLM service with the given prompt.

        Args:
            prompt: User prompt to send
            system_prompt: Optional system prompt
            json_output: Whether to request JSON output
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature

        Returns:
            LLM response text

        Raises:
            ValueError: If LLM service not configured
        """
        if not self.llm:
            raise ValueError(f"Agent {self.name} requires LLM service but none configured")

        # This will be implemented based on the actual LLM service interface
        # For now, we define the expected interface
        response = await self.llm.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            json_output=json_output,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        return response

    def _log_state_summary(self, state: RAGState, prefix: str = "") -> None:
        """Log a summary of the current state for debugging."""
        logger.debug(
            f"{prefix}State summary: "
            f"query_type={state.query_type.value}, "
            f"strategy={state.strategy.value}, "
            f"chunks={state.total_chunks_retrieved}, "
            f"relevant={state.num_relevant_docs}, "
            f"iteration={state.iteration_count}"
        )


class NoOpAgent(BaseRAGAgent):
    """A no-op agent for testing or placeholder purposes."""

    def __init__(self):
        super().__init__(name="no_op", enabled=True)

    async def process(self, state: RAGState) -> RAGState:
        """Pass through state unchanged."""
        return state


class ConditionalAgent(BaseRAGAgent):
    """An agent that only runs when a condition is met."""

    def __init__(
        self,
        wrapped_agent: BaseRAGAgent,
        condition_fn,
        name: Optional[str] = None,
    ):
        """Initialize conditional agent.

        Args:
            wrapped_agent: The agent to conditionally run
            condition_fn: Function(state) -> bool, returns True if agent should run
            name: Optional override name
        """
        super().__init__(
            name=name or f"conditional_{wrapped_agent.name}",
            llm_service=wrapped_agent.llm,
            enabled=wrapped_agent.enabled,
        )
        self.wrapped_agent = wrapped_agent
        self.condition_fn = condition_fn

    async def process(self, state: RAGState) -> RAGState:
        """Run wrapped agent if condition is met."""
        if self.condition_fn(state):
            return await self.wrapped_agent.process(state)
        else:
            logger.debug(f"Condition not met for {self.wrapped_agent.name}, skipping")
            return state


class ParallelAgentGroup:
    """Execute multiple agents in parallel and merge results.

    Note: This is a utility class, not a BaseRAGAgent subclass,
    because parallel execution has different semantics.
    """

    def __init__(self, agents: list[BaseRAGAgent], name: str = "parallel_group"):
        self.agents = agents
        self.name = name

    async def execute(self, state: RAGState) -> RAGState:
        """Execute all agents in parallel.

        Each agent receives a copy of the state.
        Results are merged back into a single state.

        Args:
            state: Current RAG pipeline state

        Returns:
            Merged state from all agents
        """
        import asyncio

        if not self.agents:
            return state

        # Execute all agents concurrently
        tasks = [agent.execute(state) for agent in self.agents]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Merge results back into state
        # This is a simple merge - subclasses can override for custom merge logic
        merged_state = state
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Parallel agent failed: {result}")
                continue
            if isinstance(result, RAGState):
                merged_state = self._merge_states(merged_state, result)

        return merged_state

    def _merge_states(self, base: RAGState, update: RAGState) -> RAGState:
        """Merge two states. Update takes precedence for modified fields."""
        # Merge timings
        base.agent_timings.update(update.agent_timings)

        # Merge LLM call counts
        base.total_llm_calls += update.total_llm_calls
        base.total_tokens += update.total_tokens

        # Take any error from update
        if update.error and not base.error:
            base.error = update.error

        return base
