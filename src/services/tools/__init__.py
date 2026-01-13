"""Unified Tool Modules for Multi-Provider AI Architecture.

This package contains tool definitions and handlers for all platforms:
- meraki: 400+ Meraki Dashboard API tools
- catalyst: 200+ Cisco Catalyst Center tools
- thousandeyes: 100+ ThousandEyes tools
- splunk: 50+ Splunk tools
- knowledge: RAG and knowledge base tools

Each module auto-registers its tools with the ToolRegistry on import.

Tool naming convention: {platform}_{action}_{entity}
Examples:
    - meraki_list_networks
    - meraki_get_device
    - catalyst_get_sites
    - thousandeyes_list_tests
    - splunk_run_search
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.services.tool_registry import ToolRegistry

# Import modules to trigger auto-registration
# These are imported lazily by the ToolRegistry to avoid circular imports
