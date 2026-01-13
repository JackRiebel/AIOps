"""Splunk Search skill module.

This module provides skills for executing and optimizing Splunk searches including:
- Running SPL queries
- Generating SPL from natural language
- Explaining SPL queries
- Optimizing SPL queries
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    SplunkSkillModule,
    SplunkAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    TIME_RANGE_SCHEMA,
    SEARCH_QUERY_SCHEMA,
    MAX_RESULTS_SCHEMA,
)

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

SEARCH_SKILLS: List[SkillDefinition] = [
    {
        "id": "search_run_splunk_query",
        "name": "Run Splunk Query",
        "description": (
            "Execute a Splunk search query and return the results. This is the primary tool "
            "for running Splunk searches using SPL (Search Processing Language). Use this to "
            "retrieve log data, perform aggregations, analyze events, and extract insights "
            "from your Splunk environment. Note: Searches are limited to 1 minute execution "
            "time and 1000 results maximum."
        ),
        "tags": ["splunk", "search", "query", "spl", "logs", "events"],
        "examples": [
            "Search for error events in the last 24 hours",
            "Run a Splunk query for failed logins",
            "Execute SPL search for network traffic",
            "Query Splunk for security events",
            "Search index=main for errors",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "search_query": {
                    "type": "string",
                    "description": "SPL search query to execute (e.g., 'search index=* error | stats count by source')"
                },
                "earliest_time": {
                    "type": "string",
                    "description": "Start time for search (e.g., '-24h', '-7d', '2024-01-01T00:00:00')",
                    "default": "-24h"
                },
                "latest_time": {
                    "type": "string",
                    "description": "End time for search (e.g., 'now', '-1h', '2024-01-02T00:00:00')",
                    "default": "now"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (max 1000)",
                    "default": 100
                },
            },
            "required": ["search_query"],
        },
    },
    {
        "id": "search_generate_spl",
        "name": "Generate SPL",
        "description": (
            "Generate SPL (Search Processing Language) from natural language queries using "
            "Splunk AI Assistant. Converts plain English descriptions into valid SPL queries "
            "that can be executed against your Splunk environment."
        ),
        "tags": ["splunk", "search", "spl", "generate", "ai", "natural-language"],
        "examples": [
            "Generate SPL to find failed login attempts",
            "Create a query for top 10 error sources",
            "Write SPL to count events by sourcetype",
            "Generate search for network anomalies",
            "Create SPL for authentication failures",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "natural_language_query": {
                    "type": "string",
                    "description": "Natural language description of what you want to search for"
                },
                "index": {
                    "type": "string",
                    "description": "Target index to search (optional)",
                },
                "time_range": TIME_RANGE_SCHEMA,
            },
            "required": ["natural_language_query"],
        },
    },
    {
        "id": "search_explain_spl",
        "name": "Explain SPL",
        "description": (
            "Explain SPL queries in natural language using Splunk AI Assistant. Converts "
            "complex SPL commands into human-readable explanations, helping users understand "
            "what a query does step by step."
        ),
        "tags": ["splunk", "search", "spl", "explain", "ai", "documentation"],
        "examples": [
            "Explain this SPL query",
            "What does this Splunk search do?",
            "Break down this SPL command",
            "Help me understand this search",
            "Describe what this query returns",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "spl_query": {
                    "type": "string",
                    "description": "SPL query to explain"
                },
            },
            "required": ["spl_query"],
        },
    },
    {
        "id": "search_optimize_spl",
        "name": "Optimize SPL",
        "description": (
            "Optimize SPL (Search Processing Language) queries using Splunk AI Assistant. "
            "Improves query performance, efficiency, and follows best practices. Returns "
            "an optimized version of the query with explanations of improvements."
        ),
        "tags": ["splunk", "search", "spl", "optimize", "performance", "ai"],
        "examples": [
            "Optimize this SPL query",
            "Make this search faster",
            "Improve this query's performance",
            "Suggest optimizations for this SPL",
            "Help me make this search more efficient",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "spl_query": {
                    "type": "string",
                    "description": "SPL query to optimize"
                },
            },
            "required": ["spl_query"],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class SearchModule(SplunkSkillModule):
    """Search skills module."""

    MODULE_NAME = "search"
    MODULE_PREFIX = "search_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all search skills."""
        return [create_skill(skill_def) for skill_def in SEARCH_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a search skill."""
        log_skill_start(skill_id, params)

        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "search_run_splunk_query":
            return await cls._run_splunk_query(client, params)

        if skill_id == "search_generate_spl":
            return await cls._generate_spl(client, params)

        if skill_id == "search_explain_spl":
            return await cls._explain_spl(client, params)

        if skill_id == "search_optimize_spl":
            return await cls._optimize_spl(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _run_splunk_query(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Execute a Splunk search query."""
        search_query = params.get("search_query", "")
        earliest_time = params.get("earliest_time", "-24h")
        latest_time = params.get("latest_time", "now")
        max_results = min(params.get("max_results", 100), 1000)  # Cap at 1000

        # If no query provided, run a smart default that gives an overview of recent activity
        if not search_query:
            # Default query: Get recent events with priority on errors/warnings, grouped by source
            search_query = """search index=* (error OR warning OR failed OR critical OR exception)
| head 500
| stats count as event_count, latest(_time) as latest_event, earliest(_time) as earliest_event by sourcetype, source
| sort - event_count
| head 50"""
            log_skill_start("search_run_splunk_query", {"default_query": True, "reason": "No query provided - running overview"})
            earliest_time = "-24h"  # Default to last 24 hours for overview

        # Ensure query starts with 'search' if it doesn't have a command
        if not search_query.strip().startswith(("search", "|", "[")):
            search_query = f"search {search_query}"

        results = await client.run_search(
            query=search_query,
            earliest_time=earliest_time,
            latest_time=latest_time,
            max_results=max_results
        )

        # Build summary
        summary = {
            "total_results": len(results),
            "query": search_query,
            "time_range": f"{earliest_time} to {latest_time}",
            "max_results": max_results,
        }

        # Extract sources and sourcetypes for entities
        sources = set()
        sourcetypes = set()
        for result in results:
            if result.get("source"):
                sources.add(result["source"])
            if result.get("sourcetype"):
                sourcetypes.add(result["sourcetype"])

        return success_result(
            data={
                "results": results,
                "summary": summary,
            },
            entities={
                "sources": list(sources),
                "sourcetypes": list(sourcetypes),
            },
            follow_up="Would you like me to analyze these results or refine the search?"
        )

    @classmethod
    async def _generate_spl(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Generate SPL from natural language using Splunk AI Assistant."""
        natural_language_query = params.get("natural_language_query", "")
        index = params.get("index", "*")
        time_range = params.get("time_range", "-24h")

        if not natural_language_query:
            return error_result("natural_language_query is required")

        # Call Splunk AI Assistant endpoint
        response = await client.post(
            "/services/splunk_assist/generate_spl",
            {
                "query": natural_language_query,
                "index": index,
            }
        )

        if not response.get("success"):
            # Fallback: Generate basic SPL based on keywords
            generated_spl = cls._fallback_generate_spl(natural_language_query, index)
            return success_result(
                data={
                    "generated_spl": generated_spl,
                    "original_query": natural_language_query,
                    "method": "fallback",
                    "note": "AI Assistant unavailable, using pattern-based generation",
                },
                follow_up="Would you like me to run this query?"
            )

        data = response.get("data", {})
        generated_spl = data.get("spl", "")

        return success_result(
            data={
                "generated_spl": generated_spl,
                "original_query": natural_language_query,
                "method": "ai_assistant",
            },
            follow_up="Would you like me to run this query or explain what it does?"
        )

    @classmethod
    def _fallback_generate_spl(cls, query: str, index: str) -> str:
        """Generate basic SPL when AI Assistant is unavailable."""
        query_lower = query.lower()

        # Pattern matching for common queries
        if "error" in query_lower or "fail" in query_lower:
            return f"search index={index} (error OR fail OR exception) | stats count by source, sourcetype | sort -count"

        if "login" in query_lower or "auth" in query_lower:
            return f"search index={index} (login OR authentication OR auth) | stats count by user, src_ip | sort -count"

        if "top" in query_lower:
            return f"search index={index} | top limit=10 sourcetype"

        if "count" in query_lower:
            return f"search index={index} | stats count by sourcetype"

        if "network" in query_lower or "traffic" in query_lower:
            return f"search index={index} (network OR traffic OR connection) | stats count by src_ip, dest_ip"

        # Default generic search
        keywords = [w for w in query.split() if len(w) > 3]
        if keywords:
            keyword_filter = " OR ".join(keywords[:5])
            return f"search index={index} ({keyword_filter}) | head 100"

        return f"search index={index} | head 100"

    @classmethod
    async def _explain_spl(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Explain SPL query in natural language using Splunk AI Assistant."""
        spl_query = params.get("spl_query", "")

        if not spl_query:
            return error_result("spl_query is required")

        # Call Splunk AI Assistant endpoint
        response = await client.post(
            "/services/splunk_assist/explain_spl",
            {"spl": spl_query}
        )

        if not response.get("success"):
            # Fallback: Basic explanation
            explanation = cls._fallback_explain_spl(spl_query)
            return success_result(
                data={
                    "explanation": explanation,
                    "spl_query": spl_query,
                    "method": "fallback",
                    "note": "AI Assistant unavailable, using basic parsing",
                }
            )

        data = response.get("data", {})
        explanation = data.get("explanation", "")

        return success_result(
            data={
                "explanation": explanation,
                "spl_query": spl_query,
                "method": "ai_assistant",
            }
        )

    @classmethod
    def _fallback_explain_spl(cls, spl_query: str) -> str:
        """Generate basic explanation when AI Assistant is unavailable."""
        parts = []
        commands = spl_query.split("|")

        for i, cmd in enumerate(commands):
            cmd = cmd.strip()
            if cmd.startswith("search"):
                parts.append(f"Step {i+1}: Search for events matching the specified criteria")
            elif cmd.startswith("stats"):
                parts.append(f"Step {i+1}: Calculate statistics (count, sum, avg, etc.)")
            elif cmd.startswith("table"):
                parts.append(f"Step {i+1}: Display results in a table format")
            elif cmd.startswith("sort"):
                parts.append(f"Step {i+1}: Sort results by the specified field")
            elif cmd.startswith("head"):
                parts.append(f"Step {i+1}: Limit to first N results")
            elif cmd.startswith("tail"):
                parts.append(f"Step {i+1}: Show last N results")
            elif cmd.startswith("eval"):
                parts.append(f"Step {i+1}: Calculate or transform field values")
            elif cmd.startswith("where"):
                parts.append(f"Step {i+1}: Filter results based on conditions")
            elif cmd.startswith("rex"):
                parts.append(f"Step {i+1}: Extract fields using regex")
            elif cmd.startswith("timechart"):
                parts.append(f"Step {i+1}: Create a time-based chart")
            elif cmd.startswith("chart"):
                parts.append(f"Step {i+1}: Create a chart visualization")
            elif cmd.startswith("top"):
                parts.append(f"Step {i+1}: Find most common values")
            elif cmd.startswith("dedup"):
                parts.append(f"Step {i+1}: Remove duplicate events")

        if not parts:
            return "This query searches Splunk data based on the specified criteria."

        return "\n".join(parts)

    @classmethod
    async def _optimize_spl(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Optimize SPL query using Splunk AI Assistant."""
        spl_query = params.get("spl_query", "")

        if not spl_query:
            return error_result("spl_query is required")

        # Call Splunk AI Assistant endpoint
        response = await client.post(
            "/services/splunk_assist/optimize_spl",
            {"spl": spl_query}
        )

        if not response.get("success"):
            # Fallback: Basic optimization suggestions
            optimized, suggestions = cls._fallback_optimize_spl(spl_query)
            return success_result(
                data={
                    "original_spl": spl_query,
                    "optimized_spl": optimized,
                    "suggestions": suggestions,
                    "method": "fallback",
                    "note": "AI Assistant unavailable, using rule-based optimization",
                },
                follow_up="Would you like me to run the optimized query?"
            )

        data = response.get("data", {})
        optimized_spl = data.get("optimized_spl", spl_query)
        suggestions = data.get("suggestions", [])

        return success_result(
            data={
                "original_spl": spl_query,
                "optimized_spl": optimized_spl,
                "suggestions": suggestions,
                "method": "ai_assistant",
            },
            follow_up="Would you like me to run the optimized query?"
        )

    @classmethod
    def _fallback_optimize_spl(cls, spl_query: str) -> tuple:
        """Generate basic optimization when AI Assistant is unavailable."""
        suggestions = []
        optimized = spl_query

        # Check for common optimization opportunities
        if "index=*" in spl_query:
            suggestions.append("Consider specifying a specific index instead of index=* to improve performance")

        if "| search" in spl_query:
            suggestions.append("Move search criteria earlier in the pipeline for better performance")
            optimized = optimized.replace("| search", "| where")

        if "| table" in spl_query and "| sort" not in spl_query:
            suggestions.append("Consider adding | sort before | table if order matters")

        if " OR " in spl_query.upper() and spl_query.count(" OR ") > 5:
            suggestions.append("Many OR conditions may be slow; consider using lookup tables or IN()")

        if "| head" not in spl_query and "| tail" not in spl_query:
            suggestions.append("Consider adding | head to limit results during development")

        if not suggestions:
            suggestions.append("Query appears reasonably optimized")

        return optimized, suggestions
