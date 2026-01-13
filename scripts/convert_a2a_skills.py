#!/usr/bin/env python3
"""
Automated A2A Skills to Unified Tools Converter

This script reads archived A2A skill definitions and generates unified tool
definitions compatible with the ToolRegistry.

Usage:
    python scripts/convert_a2a_skills.py [--dry-run] [--platform meraki|catalyst|...]

Features:
- Parses AgentSkill definitions from archived modules
- Extracts handler implementations
- Generates Tool definitions with proper schemas
- Preserves tags and examples for tool filtering
- Creates module files organized by platform/category
"""

import ast
import os
import sys
import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import argparse

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class SkillDefinition:
    """Represents an extracted skill definition."""
    id: str
    name: str
    description: str
    tags: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    input_schema: Optional[Dict[str, Any]] = None
    platform: str = ""
    module: str = ""
    handler_name: str = ""
    api_endpoint: str = ""
    http_method: str = "GET"


@dataclass
class ToolDefinition:
    """Represents a unified tool definition."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    tags: List[str] = field(default_factory=list)
    examples: List[str] = field(default_factory=list)
    platform: str = ""
    category: str = ""
    read_only: bool = True
    handler_code: str = ""


class SkillParser:
    """Parses A2A skill modules to extract skill definitions."""

    def __init__(self, archived_path: Path):
        self.archived_path = archived_path

    def parse_module(self, module_path: Path) -> List[SkillDefinition]:
        """Parse a single skill module file."""
        skills = []

        try:
            with open(module_path, 'r') as f:
                content = f.read()

            # Parse AST
            tree = ast.parse(content)

            # Method 1: Find create_skill() calls
            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    if self._is_create_skill_call(node):
                        skill = self._extract_skill_from_call(node, content)
                        if skill:
                            skills.append(skill)

            # Method 2: Find skill dictionary lists (e.g., VLAN_SKILLS = [...])
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign):
                    # Check for list assignments with _SKILLS suffix
                    for target in node.targets:
                        if isinstance(target, ast.Name) and '_SKILLS' in target.id:
                            if isinstance(node.value, ast.List):
                                for elem in node.value.elts:
                                    if isinstance(elem, ast.Dict):
                                        skill = self._extract_skill_from_dict(elem, content)
                                        if skill:
                                            skills.append(skill)
                # Also check annotated assignments (e.g., SKILLS: List[...] = [...])
                elif isinstance(node, ast.AnnAssign):
                    if isinstance(node.target, ast.Name):
                        if '_SKILLS' in node.target.id or node.target.id == 'SKILLS':
                            if isinstance(node.value, ast.List):
                                for elem in node.value.elts:
                                    if isinstance(elem, ast.Dict):
                                        skill = self._extract_skill_from_dict(elem, content)
                                        if skill:
                                            skills.append(skill)

            # Extract module info
            platform = self._detect_platform(module_path)
            module_name = module_path.stem

            for skill in skills:
                skill.platform = platform
                skill.module = module_name
                skill.handler_name = self._infer_handler_name(skill.id)

            logger.info(f"Parsed {len(skills)} skills from {module_path.name}")

        except Exception as e:
            logger.error(f"Error parsing {module_path}: {e}")
            import traceback
            traceback.print_exc()

        return skills

    def _extract_skill_from_dict(self, node: ast.Dict, source: str) -> Optional[SkillDefinition]:
        """Extract skill definition from a dictionary AST node."""
        kwargs = {}

        for key, value in zip(node.keys, node.values):
            key_str = self._eval_ast_node(key, source)
            val = self._eval_ast_node(value, source)
            if key_str and val is not None:
                kwargs[key_str] = val

        if 'id' not in kwargs:
            return None

        return SkillDefinition(
            id=kwargs.get('id', ''),
            name=kwargs.get('name', ''),
            description=kwargs.get('description', ''),
            tags=kwargs.get('tags', []),
            examples=kwargs.get('examples', []),
            input_schema=kwargs.get('input_schema'),
        )

    def _is_create_skill_call(self, node: ast.Call) -> bool:
        """Check if this is a create_skill() call."""
        if isinstance(node.func, ast.Name):
            return node.func.id == 'create_skill'
        if isinstance(node.func, ast.Attribute):
            return node.func.attr == 'create_skill'
        return False

    def _extract_skill_from_call(self, node: ast.Call, source: str) -> Optional[SkillDefinition]:
        """Extract skill definition from create_skill() AST node."""
        kwargs = {}

        for keyword in node.keywords:
            key = keyword.arg
            value = self._eval_ast_node(keyword.value, source)
            if value is not None:
                kwargs[key] = value

        if 'id' not in kwargs:
            return None

        return SkillDefinition(
            id=kwargs.get('id', ''),
            name=kwargs.get('name', ''),
            description=kwargs.get('description', ''),
            tags=kwargs.get('tags', []),
            examples=kwargs.get('examples', []),
            input_schema=kwargs.get('input_schema'),
        )

    def _eval_ast_node(self, node: ast.AST, source: str) -> Any:
        """Safely evaluate an AST node to get its value."""
        try:
            if isinstance(node, ast.Constant):
                return node.value
            elif isinstance(node, ast.Str):  # Python 3.7 compatibility
                return node.s
            elif isinstance(node, ast.Num):
                return node.n
            elif isinstance(node, ast.List):
                return [self._eval_ast_node(el, source) for el in node.elts]
            elif isinstance(node, ast.Dict):
                keys = [self._eval_ast_node(k, source) for k in node.keys]
                values = [self._eval_ast_node(v, source) for v in node.values]
                return dict(zip(keys, values))
            elif isinstance(node, ast.Call):
                # Handle build_input_schema() calls
                if self._is_build_input_schema_call(node):
                    return self._extract_input_schema(node, source)
                # Handle ORG_ID_SCHEMA constant
                func_name = self._get_call_name(node)
                if func_name == 'ORG_ID_SCHEMA':
                    return {
                        "type": "object",
                        "properties": {
                            "organization_id": {
                                "type": "string",
                                "description": "Organization ID"
                            }
                        },
                        "required": ["organization_id"]
                    }
            elif isinstance(node, ast.Name):
                # Handle named constants
                if node.id == 'ORG_ID_SCHEMA':
                    return {
                        "type": "object",
                        "properties": {
                            "organization_id": {
                                "type": "string",
                                "description": "Organization ID"
                            }
                        },
                        "required": ["organization_id"]
                    }
                elif node.id == 'NETWORK_ID_SCHEMA':
                    return {
                        "type": "object",
                        "properties": {
                            "network_id": {
                                "type": "string",
                                "description": "Network ID"
                            }
                        },
                        "required": ["network_id"]
                    }
                elif node.id == 'SERIAL_SCHEMA':
                    return {
                        "type": "object",
                        "properties": {
                            "serial": {
                                "type": "string",
                                "description": "Device serial number"
                            }
                        },
                        "required": ["serial"]
                    }
        except Exception:
            pass
        return None

    def _is_build_input_schema_call(self, node: ast.Call) -> bool:
        """Check if this is a build_input_schema() call."""
        if isinstance(node.func, ast.Name):
            return node.func.id == 'build_input_schema'
        return False

    def _extract_input_schema(self, node: ast.Call, source: str) -> Dict[str, Any]:
        """Extract input schema from build_input_schema() call."""
        properties = {}
        required = []

        for arg in node.args:
            props = self._eval_ast_node(arg, source)
            if isinstance(props, dict):
                properties = props

        for keyword in node.keywords:
            if keyword.arg == 'required':
                required = self._eval_ast_node(keyword.value, source) or []

        return {
            "type": "object",
            "properties": properties,
            "required": required
        }

    def _get_call_name(self, node: ast.Call) -> str:
        """Get the name of a function call."""
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        return ""

    def _detect_platform(self, module_path: Path) -> str:
        """Detect platform from module path."""
        parts = module_path.parts
        for platform in ['meraki', 'catalyst', 'thousandeyes', 'splunk']:
            if platform in parts:
                return platform
        return 'unknown'

    def _infer_handler_name(self, skill_id: str) -> str:
        """Infer handler method name from skill ID."""
        # organizations_list -> _list_organizations
        parts = skill_id.split('_')
        if len(parts) >= 2:
            return f"_{parts[1]}_{parts[0]}"
        return f"_handle_{skill_id}"


class ToolGenerator:
    """Generates unified tool definitions from skills."""

    def __init__(self, output_path: Path):
        self.output_path = output_path

    def convert_skill_to_tool(self, skill: SkillDefinition) -> ToolDefinition:
        """Convert a skill definition to a tool definition."""
        # Determine if read-only based on tags
        write_tags = {'write', 'create', 'update', 'delete', 'dangerous'}
        read_only = not bool(set(skill.tags) & write_tags)

        # Build tool name with platform prefix
        tool_name = f"{skill.platform}_{skill.id}" if not skill.id.startswith(skill.platform) else skill.id

        # Build input schema
        input_schema = skill.input_schema or {
            "type": "object",
            "properties": {},
            "required": []
        }

        # Generate handler code
        handler_code = self._generate_handler_code(skill)

        return ToolDefinition(
            name=tool_name,
            description=skill.description,
            input_schema=input_schema,
            tags=skill.tags,
            examples=skill.examples,
            platform=skill.platform,
            category=skill.module,
            read_only=read_only,
            handler_code=handler_code,
        )

    def _generate_handler_code(self, skill: SkillDefinition) -> str:
        """Generate handler code for a tool."""
        # Infer API endpoint from skill ID
        endpoint = self._infer_endpoint(skill)
        http_method = self._infer_http_method(skill)

        return f'''async def handle_{skill.id}(params: Dict, context: Any) -> Dict:
    """Handler for {skill.name}."""
    try:
        # Build API path
        path = "{endpoint}"
        {self._generate_path_substitution(skill)}

        # Make API request
        result = await context.client.request("{http_method}", path, {"params" if http_method == "GET" else "json_data"}=params)
        return {{"success": True, "data": result}}
    except Exception as e:
        return {{"success": False, "error": str(e)}}
'''

    def _infer_endpoint(self, skill: SkillDefinition) -> str:
        """Infer API endpoint from skill ID."""
        # Common patterns
        patterns = {
            'organizations_list': '/organizations',
            'organizations_get': '/organizations/{organization_id}',
            'networks_list': '/organizations/{organization_id}/networks',
            'networks_get': '/networks/{network_id}',
            'devices_list': '/organizations/{organization_id}/devices',
            'devices_get': '/devices/{serial}',
        }

        # Check for exact match
        if skill.id in patterns:
            return patterns[skill.id]

        # Infer from skill ID pattern
        parts = skill.id.split('_')
        if len(parts) >= 2:
            resource = parts[0]
            action = parts[1]

            if resource == 'organizations':
                if action == 'list':
                    return '/organizations'
                else:
                    return f'/organizations/{{organization_id}}/{action}'
            elif resource == 'networks':
                return f'/networks/{{network_id}}/{action}'
            elif resource == 'devices':
                return f'/devices/{{serial}}/{action}'

        return f'/{skill.id.replace("_", "/")}'

    def _infer_http_method(self, skill: SkillDefinition) -> str:
        """Infer HTTP method from skill tags."""
        if 'create' in skill.tags:
            return 'POST'
        elif 'update' in skill.tags:
            return 'PUT'
        elif 'delete' in skill.tags:
            return 'DELETE'
        return 'GET'

    def _generate_path_substitution(self, skill: SkillDefinition) -> str:
        """Generate path parameter substitution code."""
        subs = []
        schema = skill.input_schema or {}
        properties = schema.get('properties', {})

        for param in ['organization_id', 'network_id', 'serial', 'device_serial']:
            if param in properties or param in schema.get('required', []):
                subs.append(f'path = path.replace("{{{param}}}", params.get("{param}", ""))')

        return '\n        '.join(subs) if subs else 'pass'

    def generate_module_file(self, platform: str, category: str, tools: List[ToolDefinition]) -> str:
        """Generate a complete module file with all tools."""
        imports = self._generate_imports(platform)
        handlers = self._generate_handlers(tools)
        tool_list = self._generate_tool_list(tools)

        return f'''"""
{platform.title()} {category.title()} Tools

Auto-generated from archived A2A skills.
Total tools: {len(tools)}
"""

{imports}

logger = logging.getLogger(__name__)

# =============================================================================
# HANDLERS
# =============================================================================

{handlers}

# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

{platform.upper()}_{category.upper()}_TOOLS = [
{tool_list}
]

# =============================================================================
# REGISTRATION
# =============================================================================

def register_{category}_tools():
    """Register all {category} tools with the registry."""
    registry = get_tool_registry()
    registry.register_many({platform.upper()}_{category.upper()}_TOOLS)
    logger.info(f"Registered {{len({platform.upper()}_{category.upper()}_TOOLS)}} {platform} {category} tools")


# Auto-register on import
register_{category}_tools()
'''

    def _generate_imports(self, platform: str) -> str:
        """Generate import statements."""
        api_client = {
            'meraki': 'from src.services.meraki_api import MerakiAPIClient',
            'catalyst': 'from src.services.catalyst_api import CatalystCenterClient',
            'thousandeyes': 'from src.services.thousandeyes_service import ThousandEyesClient',
            'splunk': '# Splunk client imported in handler',
        }.get(platform, '')

        return f'''import logging
from typing import Dict, Any, List

from src.services.tool_registry import get_tool_registry, Tool, create_tool
{api_client}
'''

    def _generate_tool_list(self, tools: List[ToolDefinition]) -> str:
        """Generate tool list for register_many()."""
        defs = []
        for tool in tools:
            # Extract properties and required from input_schema
            schema = tool.input_schema or {}
            properties = schema.get('properties', {})
            required = schema.get('required', [])

            # Flatten nested schemas - convert schema references to simple types
            flat_properties = self._flatten_properties(properties)

            props_str = self._to_python_literal(flat_properties, indent=12) if flat_properties else '{}'
            required_str = self._to_python_literal(required)
            tags_str = self._to_python_literal(tool.tags)
            # Only remove the platform prefix (first occurrence), not all occurrences
            handler_name = f"handle_{tool.name.replace(f'{tool.platform}_', '', 1)}"

            defs.append(f'''    create_tool(
        name="{tool.name}",
        description="""{tool.description}""",
        platform="{tool.platform}",
        category="{tool.category}",
        properties={props_str},
        required={required_str},
        tags={tags_str},
        requires_write={not tool.read_only},
        handler={handler_name},
    ),''')
        return '\n'.join(defs)

    def _flatten_properties(self, properties: Dict) -> Dict:
        """Flatten nested schema properties to simple type definitions."""
        flat = {}
        for key, value in properties.items():
            if value is None:
                # Handle null values - default to string
                flat[key] = {"type": "string", "description": f"{key.replace('_', ' ').title()}"}
            elif isinstance(value, dict):
                # Recursively clean any None values in nested dicts
                cleaned_value = self._clean_none_values(value)
                if 'type' in cleaned_value and cleaned_value.get('type') == 'object' and 'properties' in cleaned_value:
                    # This is a nested schema - extract the inner property if same name
                    inner_props = cleaned_value.get('properties', {})
                    if key in inner_props:
                        flat[key] = self._clean_none_values(inner_props[key])
                    else:
                        # Use first property or default to string
                        if inner_props:
                            first_key = list(inner_props.keys())[0]
                            flat[key] = self._clean_none_values(inner_props[first_key])
                        else:
                            flat[key] = {"type": "string", "description": cleaned_value.get('description', '')}
                else:
                    # Regular property definition
                    flat[key] = cleaned_value
            else:
                flat[key] = {"type": "string", "description": str(value)}
        return flat

    def _clean_none_values(self, obj: Any) -> Any:
        """Recursively replace None values with sensible defaults."""
        if obj is None:
            return {"type": "string", "description": ""}
        elif isinstance(obj, dict):
            return {k: self._clean_none_values(v) for k, v in obj.items() if v is not None}
        elif isinstance(obj, list):
            return [self._clean_none_values(item) for item in obj if item is not None]
        return obj

    def _generate_handlers(self, tools: List[ToolDefinition]) -> str:
        """Generate handler functions."""
        handlers = []
        for tool in tools:
            handlers.append(tool.handler_code)
        return '\n\n'.join(handlers)

    def _generate_registration(self, tools: List[ToolDefinition]) -> str:
        """Generate tool registration code."""
        lines = []
        for i, tool in enumerate(tools):
            handler_name = tool.name.replace(f"{tool.platform}_", "")
            # First line doesn't need indent (already in template), subsequent lines need 4 spaces
            if i == 0:
                lines.append(f'registry.register({tool.name.upper()}_TOOL, handle_{handler_name})')
            else:
                lines.append(f'    registry.register({tool.name.upper()}_TOOL, handle_{handler_name})')
        return '\n'.join(lines)

    def write_module(self, platform: str, category: str, tools: List[ToolDefinition], dry_run: bool = False):
        """Write a tool module file."""
        content = self.generate_module_file(platform, category, tools)

        output_dir = self.output_path / platform
        output_file = output_dir / f"{category}.py"

        if dry_run:
            logger.info(f"Would write {len(tools)} tools to {output_file}")
            return

        output_dir.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w') as f:
            f.write(content)

        logger.info(f"Wrote {len(tools)} tools to {output_file}")


def discover_skill_modules(archived_path: Path) -> List[Path]:
    """Discover all skill module files in archived path."""
    modules = []

    specialists_path = archived_path / 'specialists'
    if not specialists_path.exists():
        logger.error(f"Specialists path not found: {specialists_path}")
        return modules

    for platform_dir in specialists_path.iterdir():
        if platform_dir.is_dir() and not platform_dir.name.startswith('_'):
            for module_file in platform_dir.glob('*.py'):
                if module_file.name not in ['__init__.py', 'base.py']:
                    modules.append(module_file)

    logger.info(f"Discovered {len(modules)} skill modules")
    return modules


def main():
    parser = argparse.ArgumentParser(description='Convert A2A skills to unified tools')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing files')
    parser.add_argument('--platform', type=str, help='Only process specific platform')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    archived_path = PROJECT_ROOT / 'src' / 'a2a_archived'
    output_path = PROJECT_ROOT / 'src' / 'services' / 'tools'

    logger.info(f"Archived path: {archived_path}")
    logger.info(f"Output path: {output_path}")

    # Discover modules
    modules = discover_skill_modules(archived_path)

    if args.platform:
        modules = [m for m in modules if args.platform in str(m)]
        logger.info(f"Filtered to {len(modules)} modules for platform: {args.platform}")

    # Parse skills
    parser_instance = SkillParser(archived_path)
    all_skills: Dict[str, Dict[str, List[SkillDefinition]]] = {}

    for module_path in modules:
        skills = parser_instance.parse_module(module_path)
        if skills:
            platform = skills[0].platform
            category = skills[0].module

            if platform not in all_skills:
                all_skills[platform] = {}
            if category not in all_skills[platform]:
                all_skills[platform][category] = []

            all_skills[platform][category].extend(skills)

    # Generate tools
    generator = ToolGenerator(output_path)
    total_tools = 0

    for platform, categories in all_skills.items():
        for category, skills in categories.items():
            tools = [generator.convert_skill_to_tool(s) for s in skills]
            generator.write_module(platform, category, tools, dry_run=args.dry_run)
            total_tools += len(tools)

    logger.info(f"\n{'='*50}")
    logger.info(f"Total skills converted: {total_tools}")
    logger.info(f"Platforms: {list(all_skills.keys())}")

    # Summary by platform
    for platform, categories in all_skills.items():
        count = sum(len(skills) for skills in categories.values())
        logger.info(f"  {platform}: {count} tools across {len(categories)} categories")


if __name__ == '__main__':
    main()
