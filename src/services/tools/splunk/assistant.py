"""
Splunk Assistant Tools

Auto-generated from archived A2A skills.
Total tools: 3
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
# Splunk client imported in handler


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_assistant_ask_splunk_question(params: Dict, context: Any) -> Dict:
    """Handler for Ask Splunk Question."""
    try:
        # Build API path
        path = "/assistant/ask/splunk/question"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_assistant_get_command_help(params: Dict, context: Any) -> Dict:
    """Handler for Get Command Help."""
    try:
        # Build API path
        path = "/assistant/get/command/help"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_assistant_get_best_practices(params: Dict, context: Any) -> Dict:
    """Handler for Get Best Practices."""
    try:
        # Build API path
        path = "/assistant/get/best/practices"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_ASSISTANT_TOOLS = [
    create_tool(
        name="splunk_assistant_ask_splunk_question",
        description="""Ask natural language questions about Splunk using Splunk AI Assistant. Get explanations about Splunk commands, concepts, features, and best practices. This tool helps you learn and understand Splunk better.""",
        platform="splunk",
        category="assistant",
        properties={
            "question": {
                        "type": "string",
                        "description": "Your question about Splunk"
            },
            "context": {
                        "type": "string",
                        "description": "Optional context to help the assistant understand your question better"
            }
},
        required=["question"],
        tags=["splunk", "assistant", "ai", "help", "question", "learn"],
        requires_write=False,
        handler=handle_assistant_ask_splunk_question,
    ),
    create_tool(
        name="splunk_assistant_get_command_help",
        description="""Get detailed help for a specific SPL command including syntax, arguments, examples, and best practices.""",
        platform="splunk",
        category="assistant",
        properties={
            "command": {
                        "type": "string",
                        "description": "SPL command to get help for (e.g., 'stats', 'eval', 'rex')"
            }
},
        required=["command"],
        tags=["splunk", "assistant", "help", "command", "spl", "documentation"],
        requires_write=False,
        handler=handle_assistant_get_command_help,
    ),
    create_tool(
        name="splunk_assistant_get_best_practices",
        description="""Get best practices and recommendations for various Splunk topics including search optimization, data onboarding, alert configuration, and more.""",
        platform="splunk",
        category="assistant",
        properties={
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
            }
},
        required=["topic"],
        tags=["splunk", "assistant", "best-practices", "optimization", "recommendations"],
        requires_write=False,
        handler=handle_assistant_get_best_practices,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_assistant_tools():
    """Register all assistant tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_ASSISTANT_TOOLS)
    logger.info(f"Registered {len(SPLUNK_ASSISTANT_TOOLS)} splunk assistant tools")


# Auto-register on import
register_assistant_tools()
