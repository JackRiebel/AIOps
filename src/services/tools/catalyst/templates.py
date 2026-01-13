"""
Catalyst Templates Tools

Auto-generated from archived A2A skills.
Total tools: 18
"""

import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
from src.services.catalyst_api import CatalystCenterClient


logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

async def handle_templates_get_projects(params: Dict, context: Any) -> Dict:
    """Handler for Get Template Projects."""
    try:
        # Build API path
        path = "/templates/get/projects"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_create_project(params: Dict, context: Any) -> Dict:
    """Handler for Create Template Project."""
    try:
        # Build API path
        path = "/templates/create/project"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_update_project(params: Dict, context: Any) -> Dict:
    """Handler for Update Template Project."""
    try:
        # Build API path
        path = "/templates/update/project"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_delete_project(params: Dict, context: Any) -> Dict:
    """Handler for Delete Template Project."""
    try:
        # Build API path
        path = "/templates/delete/project"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_project_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Project by ID."""
    try:
        # Build API path
        path = "/templates/get/project/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_templates(params: Dict, context: Any) -> Dict:
    """Handler for Get Templates."""
    try:
        # Build API path
        path = "/templates/get/templates"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_create_template(params: Dict, context: Any) -> Dict:
    """Handler for Create Template."""
    try:
        # Build API path
        path = "/templates/create/template"
        pass

        # Make API request
        result = await context.client.request("POST", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_update_template(params: Dict, context: Any) -> Dict:
    """Handler for Update Template."""
    try:
        # Build API path
        path = "/templates/update/template"
        pass

        # Make API request
        result = await context.client.request("PUT", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_delete_template(params: Dict, context: Any) -> Dict:
    """Handler for Delete Template."""
    try:
        # Build API path
        path = "/templates/delete/template"
        pass

        # Make API request
        result = await context.client.request("DELETE", path, json_data=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_by_id(params: Dict, context: Any) -> Dict:
    """Handler for Get Template by ID."""
    try:
        # Build API path
        path = "/templates/get/by/id"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_version_template(params: Dict, context: Any) -> Dict:
    """Handler for Version Template."""
    try:
        # Build API path
        path = "/templates/version/template"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_versions(params: Dict, context: Any) -> Dict:
    """Handler for Get Template Versions."""
    try:
        # Build API path
        path = "/templates/get/versions"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_deploy_template(params: Dict, context: Any) -> Dict:
    """Handler for Deploy Template."""
    try:
        # Build API path
        path = "/templates/deploy/template"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_deployment_status(params: Dict, context: Any) -> Dict:
    """Handler for Get Deployment Status."""
    try:
        # Build API path
        path = "/templates/get/deployment/status"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_preview_template(params: Dict, context: Any) -> Dict:
    """Handler for Preview Template."""
    try:
        # Build API path
        path = "/templates/preview/template"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_export(params: Dict, context: Any) -> Dict:
    """Handler for Export Templates."""
    try:
        # Build API path
        path = "/templates/export"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_import(params: Dict, context: Any) -> Dict:
    """Handler for Import Templates."""
    try:
        # Build API path
        path = "/templates/import"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_templates_get_available_products(params: Dict, context: Any) -> Dict:
    """Handler for Get Available Products."""
    try:
        # Build API path
        path = "/templates/get/available/products"
        pass

        # Make API request
        result = await context.client.request("GET", path, params=params)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

CATALYST_TEMPLATES_TOOLS = [
    create_tool(
        name="catalyst_templates_get_projects",
        description="""Get list of template projects.""",
        platform="catalyst",
        category="templates",
        properties={
            "name": {
                        "type": "string"
            },
            "sort_order": {
                        "type": "string",
                        "enum": [
                                    "asc",
                                    "desc"
                        ]
            }
},
        required=[],
        tags=["catalyst", "templates", "projects", "list"],
        requires_write=False,
        handler=handle_templates_get_projects,
    ),
    create_tool(
        name="catalyst_templates_create_project",
        description="""Create a new template project.""",
        platform="catalyst",
        category="templates",
        properties={
            "name": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "tags": {
                        "type": "array",
                        "items": {
                                    "type": "string"
                        }
            }
},
        required=["name"],
        tags=["catalyst", "templates", "project", "create"],
        requires_write=True,
        handler=handle_templates_create_project,
    ),
    create_tool(
        name="catalyst_templates_update_project",
        description="""Update a template project.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            },
            "name": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            }
},
        required=["project_id"],
        tags=["catalyst", "templates", "project", "update"],
        requires_write=True,
        handler=handle_templates_update_project,
    ),
    create_tool(
        name="catalyst_templates_delete_project",
        description="""Delete a template project.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            }
},
        required=["project_id"],
        tags=["catalyst", "templates", "project", "delete"],
        requires_write=True,
        handler=handle_templates_delete_project,
    ),
    create_tool(
        name="catalyst_templates_get_project_by_id",
        description="""Get template project details.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            }
},
        required=["project_id"],
        tags=["catalyst", "templates", "project", "details"],
        requires_write=False,
        handler=handle_templates_get_project_by_id,
    ),
    create_tool(
        name="catalyst_templates_get_templates",
        description="""Get list of configuration templates.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string"
            },
            "software_type": {
                        "type": "string"
            },
            "software_version": {
                        "type": "string"
            },
            "product_family": {
                        "type": "string"
            },
            "product_series": {
                        "type": "string"
            },
            "product_type": {
                        "type": "string"
            },
            "filter_conflicting_templates": {
                        "type": "boolean"
            },
            "sort_order": {
                        "type": "string",
                        "enum": [
                                    "asc",
                                    "desc"
                        ]
            }
},
        required=[],
        tags=["catalyst", "templates", "list"],
        requires_write=False,
        handler=handle_templates_get_templates,
    ),
    create_tool(
        name="catalyst_templates_create_template",
        description="""Create a new configuration template.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            },
            "name": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "software_type": {
                        "type": "string"
            },
            "software_variant": {
                        "type": "string"
            },
            "software_version": {
                        "type": "string"
            },
            "template_content": {
                        "type": "string"
            },
            "template_params": {
                        "type": "array",
                        "items": {
                                    "type": "object"
                        }
            }
},
        required=["project_id", "name", "software_type", "template_content"],
        tags=["catalyst", "templates", "create"],
        requires_write=True,
        handler=handle_templates_create_template,
    ),
    create_tool(
        name="catalyst_templates_update_template",
        description="""Update a configuration template.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            },
            "name": {
                        "type": "string"
            },
            "description": {
                        "type": "string"
            },
            "template_content": {
                        "type": "string"
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "update"],
        requires_write=True,
        handler=handle_templates_update_template,
    ),
    create_tool(
        name="catalyst_templates_delete_template",
        description="""Delete a configuration template.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "delete"],
        requires_write=True,
        handler=handle_templates_delete_template,
    ),
    create_tool(
        name="catalyst_templates_get_by_id",
        description="""Get template details by ID.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            },
            "latest_version": {
                        "type": "boolean",
                        "default": True
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "details"],
        requires_write=False,
        handler=handle_templates_get_by_id,
    ),
    create_tool(
        name="catalyst_templates_version_template",
        description="""Create a new version of a template.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            },
            "comments": {
                        "type": "string"
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "version"],
        requires_write=False,
        handler=handle_templates_version_template,
    ),
    create_tool(
        name="catalyst_templates_get_versions",
        description="""Get all versions of a template.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "versions", "history"],
        requires_write=False,
        handler=handle_templates_get_versions,
    ),
    create_tool(
        name="catalyst_templates_deploy_template",
        description="""Deploy a template to devices.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            },
            "target_info": {
                        "type": "array",
                        "items": {
                                    "type": "object",
                                    "properties": {
                                                "id": {
                                                            "type": "string"
                                                },
                                                "type": {
                                                            "type": "string"
                                                },
                                                "params": {
                                                            "type": "object"
                                                }
                                    }
                        },
                        "description": "Deployment targets"
            },
            "force_push_template": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["template_id", "target_info"],
        tags=["catalyst", "templates", "deploy"],
        requires_write=False,
        handler=handle_templates_deploy_template,
    ),
    create_tool(
        name="catalyst_templates_get_deployment_status",
        description="""Get template deployment status.""",
        platform="catalyst",
        category="templates",
        properties={
            "deployment_id": {
                        "type": "string"
            }
},
        required=["deployment_id"],
        tags=["catalyst", "templates", "deployment", "status"],
        requires_write=False,
        handler=handle_templates_get_deployment_status,
    ),
    create_tool(
        name="catalyst_templates_preview_template",
        description="""Preview template with parameters.""",
        platform="catalyst",
        category="templates",
        properties={
            "template_id": {
                        "type": "string",
                        "description": "Template Id"
            },
            "device_id": {
                        "type": "string"
            },
            "params": {
                        "type": "object"
            }
},
        required=["template_id"],
        tags=["catalyst", "templates", "preview"],
        requires_write=False,
        handler=handle_templates_preview_template,
    ),
    create_tool(
        name="catalyst_templates_export",
        description="""Export templates from a project.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            }
},
        required=["project_id"],
        tags=["catalyst", "templates", "export"],
        requires_write=False,
        handler=handle_templates_export,
    ),
    create_tool(
        name="catalyst_templates_import",
        description="""Import templates to a project.""",
        platform="catalyst",
        category="templates",
        properties={
            "project_id": {
                        "type": "string",
                        "description": "Project Id"
            },
            "do_version": {
                        "type": "boolean",
                        "default": False
            }
},
        required=["project_id"],
        tags=["catalyst", "templates", "import"],
        requires_write=False,
        handler=handle_templates_import,
    ),
    create_tool(
        name="catalyst_templates_get_available_products",
        description="""Get products available for templates.""",
        platform="catalyst",
        category="templates",
        properties={
            "product_family": {
                        "type": "string"
            },
            "product_series": {
                        "type": "string"
            },
            "product_type": {
                        "type": "string"
            }
},
        required=[],
        tags=["catalyst", "templates", "products"],
        requires_write=False,
        handler=handle_templates_get_available_products,
    ),
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_templates_tools():
    """Register all templates tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(CATALYST_TEMPLATES_TOOLS)
    logger.info(f"Registered {len(CATALYST_TEMPLATES_TOOLS)} catalyst templates tools")


# Auto-register on import
register_templates_tools()
