"""Splunk Log Analysis Specialist Agent.

This agent provides skills for interacting with Splunk for log analysis,
security events, and AI-powered insights generation.

The agent aggregates skills from modular skill modules matching the official
Splunk MCP server tools:
- Search (~4 skills): run_splunk_query, generate_spl, explain_spl, optimize_spl
- System (~4 skills): get_splunk_info, get_indexes, get_index_info, get_metadata
- Users (~2 skills): get_user_info, get_user_list
- KV Store (~4 skills): get_collections, get_collection_data, create/delete
- Knowledge (~8 skills): saved_searches, alerts, lookups, data_models, macros, apps
- Assistant (~3 skills): ask_splunk_question, get_command_help, get_best_practices

Reference: https://help.splunk.com/en/splunk-cloud-platform/mcp-server-for-splunk-platform/mcp-server-tools
"""

import logging
from typing import List, Dict, Any

from ..types import AgentSkill
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
    TimeRangeAwareMixin,
    SmartResponseMixin,
)
from src.config.settings import get_settings

# Import all skill modules
from .splunk import (
    SplunkAPIClient,
    SearchModule,
    SystemModule,
    UsersModule,
    KVStoreModule,
    KnowledgeModule,
    AssistantModule,
)

logger = logging.getLogger(__name__)

# List of all skill modules for aggregation
SKILL_MODULES = [
    SearchModule,
    SystemModule,
    UsersModule,
    KVStoreModule,
    KnowledgeModule,
    AssistantModule,
]


class SplunkAgent(BaseSpecialistAgent, TimeRangeAwareMixin, SmartResponseMixin):
    """Specialist agent for Splunk log analysis operations.

    This agent provides full MCP tool coverage matching the official Splunk MCP server:
    - Search: Execute SPL queries, generate SPL from natural language, explain and optimize queries
    - System: Get instance info, list indexes, retrieve metadata
    - Users: Get current user info, list all users
    - KV Store: Manage KV Store collections and data
    - Knowledge: Access saved searches, alerts, lookups, data models, macros, apps
    - Assistant: Ask questions, get command help, best practices

    Smart Features:
    - Automatic time range expansion when no data found
    - Intelligent defaults for vague queries like "recent"
    - Contextual suggestions when no results
    - Built-in fallbacks when AI Assistant is unavailable
    """

    AGENT_ID = "splunk-agent"
    AGENT_NAME = "Splunk Log Analysis Specialist"
    AGENT_ROLE = "splunk-specialist"
    AGENT_DESCRIPTION = (
        "Full-featured Splunk specialist with 25+ skills matching the official Splunk MCP server tools. "
        "Supports SPL query execution and AI-powered generation/optimization, system information, "
        "user management, KV Store operations, knowledge objects (saved searches, alerts, lookups, "
        "data models, macros), and natural language assistance. Smart features include automatic "
        "time range expansion and contextual suggestions."
    )

    def get_skills(self) -> List[AgentSkill]:
        """Get all Splunk skills from modular skill modules.

        Aggregates skills from all skill modules for full MCP tool coverage.
        """
        all_skills = []

        # Aggregate skills from all modules
        for module in SKILL_MODULES:
            try:
                module_skills = module.get_skills()
                all_skills.extend(module_skills)
                logger.debug(f"[SplunkAgent] Loaded {len(module_skills)} skills from {module.MODULE_NAME}")
            except Exception as e:
                logger.warning(f"[SplunkAgent] Failed to load skills from {module.MODULE_NAME}: {e}")

        logger.info(f"[SplunkAgent] Total skills available: {len(all_skills)}")
        return all_skills

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a Splunk skill.

        Routes skills to the appropriate module for execution.

        Args:
            skill_id: The skill to execute
            params: Skill parameters
            context: Execution context with credentials

        Returns:
            SkillResult with data or error
        """
        logger.info(f"[SplunkAgent] Executing skill: {skill_id}")
        logger.info(f"[SplunkAgent] Params: {params}")
        logger.info(f"[SplunkAgent] Context: org={context.org_name}, api_key={'present' if context.api_key else 'MISSING'}, base_url={context.base_url}")

        # Check for API key
        if not context.api_key:
            logger.error(f"[SplunkAgent] No API key available!")
            return SkillResult(
                success=False,
                error="No API key available for Splunk"
            )

        # Get settings for SSL verification
        settings = get_settings()
        logger.info(f"[SplunkAgent] SSL verify={settings.verify_ssl}, timeout=60s")

        try:
            async with SplunkAPIClient(
                base_url=context.base_url or "https://localhost:8089",
                api_key=context.api_key,
                verify_ssl=settings.verify_ssl,
                timeout=60.0,
            ) as client:
                logger.info(f"[SplunkAgent] API client created, routing skill...")
                # Route to the appropriate module
                for module in SKILL_MODULES:
                    if module.handles(skill_id):
                        logger.info(f"[SplunkAgent] Routing {skill_id} to {module.MODULE_NAME}")
                        result = await module.execute(skill_id, client, params, context)
                        logger.info(f"[SplunkAgent] Module returned: type={type(result).__name__}, success={getattr(result, 'success', 'N/A')}")

                        # Convert module result to SkillResult if needed
                        if isinstance(result, SkillResult):
                            logger.info(f"[SplunkAgent] Returning as-is (already SkillResult)")
                            return result
                        if hasattr(result, 'success'):
                            logger.info(f"[SplunkAgent] Returning result with success attribute")
                            return result

                        # Wrap raw result in SkillResult
                        logger.info(f"[SplunkAgent] Wrapping raw result in SkillResult")
                        return SkillResult(
                            success=True,
                            data=result.data if hasattr(result, 'data') else result,
                            entities_extracted=getattr(result, 'entities', {}),
                        )

                # No module handles this skill
                logger.warning(f"[SplunkAgent] No module handles skill: {skill_id}")
                return SkillResult(
                    success=False,
                    error=f"Unknown skill: {skill_id}"
                )

        except Exception as e:
            import traceback
            logger.error(f"[SplunkAgent] Skill execution error: {e}")
            logger.error(f"[SplunkAgent] Traceback:\n{traceback.format_exc()}")
            return SkillResult(
                success=False,
                error=str(e)
            )
