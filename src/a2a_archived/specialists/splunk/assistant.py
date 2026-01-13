"""Splunk AI Assistant skill module.

This module provides skills for natural language interaction with Splunk including:
- Asking questions about Splunk
- Getting help with commands and concepts
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
)

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

ASSISTANT_SKILLS: List[SkillDefinition] = [
    {
        "id": "assistant_ask_splunk_question",
        "name": "Ask Splunk Question",
        "description": (
            "Ask natural language questions about Splunk using Splunk AI Assistant. "
            "Get explanations about Splunk commands, concepts, features, and best practices. "
            "This tool helps you learn and understand Splunk better."
        ),
        "tags": ["splunk", "assistant", "ai", "help", "question", "learn"],
        "examples": [
            "What does the stats command do?",
            "How do I search for failed logins?",
            "Explain transaction command",
            "What is a sourcetype?",
            "How do lookup tables work?",
            "Best practices for SPL performance",
            "What is the difference between search and tstats?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "Your question about Splunk"
                },
                "context": {
                    "type": "string",
                    "description": "Optional context to help the assistant understand your question better"
                },
            },
            "required": ["question"],
        },
    },
    {
        "id": "assistant_get_command_help",
        "name": "Get Command Help",
        "description": (
            "Get detailed help for a specific SPL command including syntax, arguments, "
            "examples, and best practices."
        ),
        "tags": ["splunk", "assistant", "help", "command", "spl", "documentation"],
        "examples": [
            "Help with stats command",
            "How to use eval",
            "What are the arguments for rex",
            "Show me timechart examples",
            "Explain join command syntax",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "SPL command to get help for (e.g., 'stats', 'eval', 'rex')"
                },
            },
            "required": ["command"],
        },
    },
    {
        "id": "assistant_get_best_practices",
        "name": "Get Best Practices",
        "description": (
            "Get best practices and recommendations for various Splunk topics including "
            "search optimization, data onboarding, alert configuration, and more."
        ),
        "tags": ["splunk", "assistant", "best-practices", "optimization", "recommendations"],
        "examples": [
            "Best practices for search optimization",
            "How to improve search performance",
            "Data onboarding best practices",
            "Alert configuration tips",
            "Dashboard design recommendations",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "Topic to get best practices for",
                    "enum": [
                        "search_optimization",
                        "data_onboarding",
                        "alerts",
                        "dashboards",
                        "security",
                        "administration",
                        "data_models",
                        "lookups",
                        "general"
                    ]
                },
            },
            "required": ["topic"],
        },
    },
]

# Built-in command documentation
SPL_COMMANDS = {
    "search": {
        "description": "Search for events. The most fundamental SPL command.",
        "syntax": "search <search-expression>",
        "examples": [
            'search index=main error',
            'search host="webserver*" status=500',
            'search sourcetype=access_combined action=purchase',
        ],
        "tips": [
            "Always specify an index when possible",
            "Put the most restrictive terms first",
            "Use time range to limit results",
        ],
    },
    "stats": {
        "description": "Calculate aggregate statistics over results.",
        "syntax": "stats <stats-function>... [by <field-list>]",
        "examples": [
            'stats count by host',
            'stats avg(response_time) by endpoint',
            'stats sum(bytes) as total_bytes by user',
            'stats count, avg(duration), max(duration) by status',
        ],
        "functions": ["count", "sum", "avg", "min", "max", "stdev", "var", "dc (distinct count)", "values", "list"],
        "tips": [
            "Use 'as' to rename output fields",
            "Multiple stats functions can be combined",
            "More efficient than transaction for counting",
        ],
    },
    "eval": {
        "description": "Calculate an expression and assign it to a field.",
        "syntax": "eval <field>=<expression>",
        "examples": [
            'eval duration_mins=duration/60',
            'eval status_text=if(status<400, "OK", "Error")',
            'eval full_name=first_name." ".last_name',
        ],
        "tips": [
            "Strings use double quotes",
            "Use if() for conditional values",
            "Can create multiple fields in one eval",
        ],
    },
    "table": {
        "description": "Display specified fields in tabular format.",
        "syntax": "table <field-list>",
        "examples": [
            'table _time, host, source, message',
            'table user, action, src_ip, dest_ip',
        ],
        "tips": [
            "Only specified fields are shown",
            "Good for creating clean output",
            "Use with sort for ordered results",
        ],
    },
    "timechart": {
        "description": "Create time-series charts with statistical aggregations.",
        "syntax": "timechart [span=<time-span>] <stats-function> [by <field>]",
        "examples": [
            'timechart count by status',
            'timechart span=1h avg(response_time)',
            'timechart span=5m count by host limit=10',
        ],
        "tips": [
            "Use span to control time bucket size",
            "Use limit to restrict number of series",
            "Great for visualizing trends over time",
        ],
    },
    "rex": {
        "description": "Extract fields using regular expressions.",
        "syntax": 'rex field=<field> "<regex-pattern>"',
        "examples": [
            'rex field=_raw "user=(?<username>\\w+)"',
            'rex field=message "error code: (?<error_code>\\d+)"',
        ],
        "tips": [
            "Use named capture groups (?<name>...)",
            "Test regex patterns before using",
            "Can extract multiple fields at once",
        ],
    },
    "where": {
        "description": "Filter results based on an expression.",
        "syntax": "where <eval-expression>",
        "examples": [
            'where status >= 400',
            'where like(user, "admin%")',
            'where isnotnull(error_message)',
        ],
        "tips": [
            "More flexible than search for filtering",
            "Uses eval expression syntax",
            "Good for numeric comparisons",
        ],
    },
    "sort": {
        "description": "Sort results by specified fields.",
        "syntax": "sort [+|-]<field>...",
        "examples": [
            'sort -count',
            'sort +_time',
            'sort -priority, +timestamp',
        ],
        "tips": [
            "- for descending, + for ascending",
            "Default is ascending",
            "Can sort by multiple fields",
        ],
    },
    "dedup": {
        "description": "Remove duplicate events based on specified fields.",
        "syntax": "dedup [<N>] <field-list>",
        "examples": [
            'dedup user',
            'dedup 5 host',
            'dedup src_ip, dest_ip',
        ],
        "tips": [
            "Optional N keeps first N occurrences",
            "Good for finding unique values",
            "Consider using stats dc() for counts",
        ],
    },
    "transaction": {
        "description": "Group events into transactions based on fields or time.",
        "syntax": "transaction <field-list> [startswith=<search>] [endswith=<search>] [maxspan=<time>]",
        "examples": [
            'transaction session_id',
            'transaction user maxspan=30m',
            'transaction session_id startswith="login" endswith="logout"',
        ],
        "tips": [
            "Computationally expensive - use sparingly",
            "Consider stats for simpler aggregations",
            "Use maxspan to limit transaction duration",
        ],
    },
    "lookup": {
        "description": "Enrich events with data from a lookup table.",
        "syntax": "lookup <lookup-name> <lookup-field> [as <event-field>] OUTPUT <output-fields>",
        "examples": [
            'lookup users user_id OUTPUT full_name, department',
            'lookup geo_ip ip as src_ip OUTPUT country, city',
        ],
        "tips": [
            "Lookup files must be configured first",
            "Use OUTPUT to specify returned fields",
            "Automatic lookups run without explicit command",
        ],
    },
    "tstats": {
        "description": "Fast statistical queries on indexed or accelerated data.",
        "syntax": "tstats <stats-function> from <data-source> where <search-conditions> by <fields>",
        "examples": [
            '| tstats count where index=main by host',
            '| tstats sum(bytes) from datamodel=Network_Traffic by src_ip',
        ],
        "tips": [
            "Much faster than regular search+stats",
            "Works with tsidx files and data models",
            "Limited to indexed fields",
        ],
    },
}

# Best practices by topic
BEST_PRACTICES = {
    "search_optimization": {
        "title": "Search Optimization Best Practices",
        "practices": [
            "Always specify an index - avoid index=*",
            "Put the most restrictive terms first in the search",
            "Use time ranges to limit data scanned",
            "Use indexed fields (like source, sourcetype, host) in the base search",
            "Move non-streaming commands as late as possible in the pipeline",
            "Use stats instead of transaction when possible",
            "Consider using tstats for very fast searches on indexed fields",
            "Avoid wildcards at the beginning of terms",
            "Use fields command to limit extracted fields early",
            "Test searches with smaller time ranges first",
        ],
    },
    "data_onboarding": {
        "title": "Data Onboarding Best Practices",
        "practices": [
            "Define a consistent naming convention for sourcetypes",
            "Use apps to organize inputs, props, and transforms",
            "Configure appropriate line breaking and timestamp extraction",
            "Set correct character encoding for international data",
            "Define field extractions at index time when beneficial",
            "Plan data volume and retention requirements",
            "Use HTTP Event Collector (HEC) for application logs",
            "Test configurations on dev/test before production",
            "Document data sources and their configurations",
            "Monitor for ingestion issues with internal logs",
        ],
    },
    "alerts": {
        "title": "Alert Configuration Best Practices",
        "practices": [
            "Set appropriate trigger conditions to avoid alert fatigue",
            "Use throttling to prevent duplicate alerts",
            "Configure meaningful alert titles and descriptions",
            "Set appropriate severity levels",
            "Test alerts before enabling in production",
            "Use scheduled searches for non-real-time alerts",
            "Consider alert actions (email, webhook, ticket creation)",
            "Document alert response procedures",
            "Review and tune alerts regularly",
            "Use summary indexing for long-running alert searches",
        ],
    },
    "dashboards": {
        "title": "Dashboard Design Best Practices",
        "practices": [
            "Keep dashboards focused on specific use cases",
            "Use efficient searches - avoid expensive operations",
            "Set appropriate refresh intervals",
            "Use base searches to share data between panels",
            "Add meaningful titles and descriptions",
            "Use drilldowns for detailed investigation",
            "Organize panels logically with clear visual hierarchy",
            "Consider performance impact of many panels",
            "Use tokens for dynamic filtering",
            "Test dashboard load time and optimize if slow",
        ],
    },
    "security": {
        "title": "Security Best Practices",
        "practices": [
            "Follow principle of least privilege for roles",
            "Use role-based access control (RBAC)",
            "Enable audit logging for sensitive operations",
            "Secure Splunk-to-Splunk communications with TLS",
            "Rotate credentials and tokens regularly",
            "Monitor for unauthorized access attempts",
            "Keep Splunk updated with security patches",
            "Secure the deployment server and apps",
            "Use SSO/SAML for authentication when possible",
            "Review user permissions periodically",
        ],
    },
    "administration": {
        "title": "Administration Best Practices",
        "practices": [
            "Plan capacity for expected data volume growth",
            "Set up monitoring for Splunk health",
            "Configure appropriate data retention policies",
            "Use deployment server for configuration management",
            "Implement regular backup procedures",
            "Document the deployment architecture",
            "Plan for disaster recovery",
            "Monitor license usage",
            "Keep track of app and add-on versions",
            "Establish change management procedures",
        ],
    },
    "data_models": {
        "title": "Data Model Best Practices",
        "practices": [
            "Use CIM (Common Information Model) for normalization",
            "Enable acceleration only when needed",
            "Set appropriate acceleration time ranges",
            "Monitor accelerated data model build status",
            "Use tstats for querying accelerated data",
            "Keep data model definitions simple",
            "Document custom data models",
            "Test data models before deploying to production",
            "Review and optimize data model constraints",
            "Consider storage impact of acceleration",
        ],
    },
    "lookups": {
        "title": "Lookup Best Practices",
        "practices": [
            "Use KV Store for frequently updated lookups",
            "Keep lookup files reasonably sized",
            "Define appropriate lookup definitions",
            "Use automatic lookups for common enrichments",
            "Consider time-based lookups for historical data",
            "Document lookup purpose and maintenance",
            "Test lookup performance with realistic data",
            "Use case_sensitive_match appropriately",
            "Set default values for missing matches",
            "Plan for lookup data updates and refreshes",
        ],
    },
    "general": {
        "title": "General Splunk Best Practices",
        "practices": [
            "Follow naming conventions for knowledge objects",
            "Use apps to organize configurations",
            "Document custom configurations and searches",
            "Test changes in non-production first",
            "Keep up with Splunk documentation and training",
            "Participate in the Splunk community",
            "Use version control for configuration files",
            "Plan for scalability from the start",
            "Monitor and optimize regularly",
            "Stay current with Splunk releases",
        ],
    },
}


# ============================================================================
# MODULE CLASS
# ============================================================================

class AssistantModule(SplunkSkillModule):
    """AI Assistant skills module."""

    MODULE_NAME = "assistant"
    MODULE_PREFIX = "assistant_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all assistant skills."""
        return [create_skill(skill_def) for skill_def in ASSISTANT_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute an assistant skill."""
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

        if skill_id == "assistant_ask_splunk_question":
            return await cls._ask_splunk_question(client, params)

        if skill_id == "assistant_get_command_help":
            return await cls._get_command_help(client, params)

        if skill_id == "assistant_get_best_practices":
            return await cls._get_best_practices(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _ask_splunk_question(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Ask a natural language question about Splunk."""
        question = params.get("question", "")
        context_hint = params.get("context", "")

        if not question:
            return error_result("question is required")

        # Try Splunk AI Assistant endpoint
        response = await client.post(
            "/services/splunk_assist/ask",
            {
                "question": question,
                "context": context_hint,
            }
        )

        if response.get("success"):
            data = response.get("data", {})
            answer = data.get("answer", "")
            return success_result(
                data={
                    "question": question,
                    "answer": answer,
                    "method": "ai_assistant",
                },
                follow_up="Do you have any follow-up questions?"
            )

        # Fallback: Try to answer common questions
        answer = cls._fallback_answer(question)

        return success_result(
            data={
                "question": question,
                "answer": answer,
                "method": "fallback",
                "note": "AI Assistant unavailable, using built-in knowledge base",
            },
            follow_up="Would you like more details or have another question?"
        )

    @classmethod
    def _fallback_answer(cls, question: str) -> str:
        """Provide answers for common questions using built-in knowledge."""
        q_lower = question.lower()

        # Check for command-related questions
        for cmd, info in SPL_COMMANDS.items():
            if cmd in q_lower:
                return cls._format_command_help(cmd, info)

        # General concept questions
        if "sourcetype" in q_lower:
            return (
                "A sourcetype in Splunk is a category assigned to data that identifies its format and structure. "
                "It determines how Splunk parses and extracts fields from events. Common sourcetypes include "
                "access_combined (web logs), syslog, and json. You can see sourcetypes with: | metadata type=sourcetypes"
            )

        if "index" in q_lower and ("what is" in q_lower or "explain" in q_lower):
            return (
                "An index in Splunk is a repository where data is stored. It's like a database table. "
                "Data is organized into indexes based on source, retention requirements, or access controls. "
                "Common indexes include 'main' (default), 'summary', and '_internal' (Splunk's own logs)."
            )

        if "spl" in q_lower and ("what is" in q_lower or "explain" in q_lower):
            return (
                "SPL (Search Processing Language) is Splunk's query language. It consists of search commands "
                "that are piped together (|) to filter, transform, and analyze data. A basic search starts with "
                "'search' followed by keywords and field=value pairs, then pipes to commands like stats, table, etc."
            )

        if "acceleration" in q_lower or "accelerated" in q_lower:
            return (
                "Acceleration in Splunk creates pre-built summaries of data to speed up searches. "
                "Data model acceleration builds tsidx files that can be queried with tstats. "
                "Report acceleration stores results of saved searches for faster retrieval."
            )

        return (
            "I don't have a specific answer for this question in my built-in knowledge base. "
            "Try asking about specific SPL commands (stats, eval, rex, etc.), Splunk concepts "
            "(sourcetype, index, SPL), or best practices for a topic."
        )

    @classmethod
    async def _get_command_help(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get help for a specific SPL command."""
        command = params.get("command", "").lower().strip()

        if not command:
            return error_result("command is required")

        # Check built-in documentation
        if command in SPL_COMMANDS:
            info = SPL_COMMANDS[command]
            formatted = cls._format_command_help(command, info)

            return success_result(
                data={
                    "command": command,
                    "description": info.get("description"),
                    "syntax": info.get("syntax"),
                    "examples": info.get("examples", []),
                    "tips": info.get("tips", []),
                    "formatted_help": formatted,
                },
                follow_up=f"Would you like to see an example using the {command} command?"
            )

        # Try Splunk's command documentation endpoint
        response = await client.get(
            f"/services/search/commands/{command}",
        )

        if response.get("success"):
            data = response.get("data", {})
            entries = data.get("entry", [])
            if entries:
                content = entries[0].get("content", {})
                return success_result(
                    data={
                        "command": command,
                        "description": content.get("description"),
                        "syntax": content.get("syntax"),
                        "usage": content.get("usage"),
                    }
                )

        return error_result(
            f"Command '{command}' not found. Available commands in built-in docs: {', '.join(SPL_COMMANDS.keys())}"
        )

    @classmethod
    def _format_command_help(cls, command: str, info: Dict[str, Any]) -> str:
        """Format command help as readable text."""
        lines = [
            f"**{command}** - {info.get('description', '')}",
            "",
            f"**Syntax:** `{info.get('syntax', '')}`",
            "",
            "**Examples:**",
        ]

        for example in info.get("examples", []):
            lines.append(f"  `{example}`")

        if info.get("tips"):
            lines.append("")
            lines.append("**Tips:**")
            for tip in info.get("tips", []):
                lines.append(f"  - {tip}")

        if info.get("functions"):
            lines.append("")
            lines.append(f"**Functions:** {', '.join(info.get('functions', []))}")

        return "\n".join(lines)

    @classmethod
    async def _get_best_practices(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get best practices for a topic."""
        topic = params.get("topic", "general")

        if topic not in BEST_PRACTICES:
            return error_result(
                f"Unknown topic: {topic}. Available topics: {', '.join(BEST_PRACTICES.keys())}"
            )

        practices_info = BEST_PRACTICES[topic]

        formatted = [
            f"## {practices_info['title']}",
            "",
        ]

        for i, practice in enumerate(practices_info["practices"], 1):
            formatted.append(f"{i}. {practice}")

        return success_result(
            data={
                "topic": topic,
                "title": practices_info["title"],
                "practices": practices_info["practices"],
                "formatted": "\n".join(formatted),
            },
            follow_up="Would you like best practices for another topic?"
        )
