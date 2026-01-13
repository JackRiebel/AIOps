"""CLI Workflow Executor - Executes CLI-mode workflows.

This executor:
- Parses CLI syntax commands
- Maps commands to tool registry actions
- Handles control flow (if, loop, wait)
- Variable substitution
- Sequential execution with state tracking
"""

import logging
import re
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field

from src.services.tool_registry import get_tool_registry

logger = logging.getLogger(__name__)


# ============================================================================
# CLI Parser Types
# ============================================================================

@dataclass
class CLICommand:
    """Represents a parsed CLI command."""
    platform: str
    action: str
    params: Dict[str, Any] = field(default_factory=dict)
    line_number: int = 0
    raw: str = ""


@dataclass
class CLIConditional:
    """Represents a conditional block."""
    condition: str
    true_branch: List[Any]  # List of CLICommand or CLIConditional
    false_branch: List[Any] = field(default_factory=list)
    line_number: int = 0


@dataclass
class CLILoop:
    """Represents a loop block."""
    collection_var: str
    item_var: str
    body: List[Any]  # List of CLICommand or CLIConditional
    line_number: int = 0


@dataclass
class CLIWait:
    """Represents a wait command."""
    duration_seconds: int
    line_number: int = 0


@dataclass
class CLIParseResult:
    """Result of parsing CLI code."""
    commands: List[Any]  # Mix of CLICommand, CLIConditional, CLILoop, CLIWait
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# ============================================================================
# CLI Parser
# ============================================================================

class CLIParser:
    """Parses CLI workflow syntax into executable commands."""

    PLATFORMS = ['meraki', 'splunk', 'thousandeyes', 'catalyst', 'notify', 'ai']
    KEYWORDS = ['if', 'then', 'else', 'end', 'loop', 'as', 'wait', 'set', 'workflow', 'approval']

    def parse(self, code: str) -> CLIParseResult:
        """Parse CLI code into commands."""
        lines = code.split('\n')
        result = CLIParseResult(commands=[])

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            line_num = i + 1

            # Skip empty lines and comments
            if not line or line.startswith('#'):
                i += 1
                continue

            # Parse different statement types
            try:
                if line.startswith('if '):
                    conditional, i = self._parse_conditional(lines, i)
                    result.commands.append(conditional)
                elif line.startswith('loop '):
                    loop, i = self._parse_loop(lines, i)
                    result.commands.append(loop)
                elif line.startswith('wait '):
                    wait = self._parse_wait(line, line_num)
                    result.commands.append(wait)
                    i += 1
                elif any(line.startswith(f'{p} ') for p in self.PLATFORMS):
                    cmd = self._parse_command(line, line_num)
                    result.commands.append(cmd)
                    i += 1
                elif line.startswith('set '):
                    cmd = self._parse_set(line, line_num)
                    result.commands.append(cmd)
                    i += 1
                elif line.startswith('approval '):
                    cmd = self._parse_approval(line, line_num)
                    result.commands.append(cmd)
                    i += 1
                elif line.startswith('workflow '):
                    cmd = self._parse_workflow_command(line, line_num)
                    result.commands.append(cmd)
                    i += 1
                else:
                    result.warnings.append(f"Line {line_num}: Unknown statement: {line[:50]}")
                    i += 1

            except Exception as e:
                result.errors.append(f"Line {line_num}: Parse error: {str(e)}")
                i += 1

        return result

    def _parse_command(self, line: str, line_num: int) -> CLICommand:
        """Parse a platform command."""
        parts = line.split()
        platform = parts[0]
        action = parts[1] if len(parts) > 1 else 'help'

        # Parse parameters (--key value or --key="value")
        params = {}
        i = 2
        while i < len(parts):
            part = parts[i]
            if part.startswith('--'):
                key = part[2:]
                if '=' in key:
                    key, value = key.split('=', 1)
                    params[key] = self._parse_value(value)
                elif i + 1 < len(parts) and not parts[i + 1].startswith('--'):
                    params[key] = self._parse_value(parts[i + 1])
                    i += 1
                else:
                    params[key] = True
            i += 1

        return CLICommand(
            platform=platform,
            action=action,
            params=params,
            line_number=line_num,
            raw=line
        )

    def _parse_value(self, value: str) -> Any:
        """Parse a parameter value."""
        # Remove quotes
        if value.startswith('"') and value.endswith('"'):
            return value[1:-1]
        if value.startswith("'") and value.endswith("'"):
            return value[1:-1]

        # Try to parse as number
        try:
            if '.' in value:
                return float(value)
            return int(value)
        except ValueError:
            pass

        # Boolean
        if value.lower() == 'true':
            return True
        if value.lower() == 'false':
            return False

        return value

    def _parse_conditional(self, lines: List[str], start: int) -> Tuple[CLIConditional, int]:
        """Parse an if/then/else/end block."""
        line = lines[start].strip()
        line_num = start + 1

        # Extract condition
        match = re.match(r'if\s+(.+?)\s+then', line)
        if not match:
            raise ValueError(f"Invalid if statement: {line}")

        condition = match.group(1)
        conditional = CLIConditional(
            condition=condition,
            true_branch=[],
            false_branch=[],
            line_number=line_num
        )

        i = start + 1
        in_else = False

        while i < len(lines):
            line = lines[i].strip()

            if not line or line.startswith('#'):
                i += 1
                continue

            if line == 'else':
                in_else = True
                i += 1
                continue

            if line == 'end':
                return conditional, i + 1

            # Parse nested content
            if line.startswith('if '):
                nested, i = self._parse_conditional(lines, i)
                if in_else:
                    conditional.false_branch.append(nested)
                else:
                    conditional.true_branch.append(nested)
            elif line.startswith('loop '):
                nested, i = self._parse_loop(lines, i)
                if in_else:
                    conditional.false_branch.append(nested)
                else:
                    conditional.true_branch.append(nested)
            elif line.startswith('wait '):
                cmd = self._parse_wait(line, i + 1)
                if in_else:
                    conditional.false_branch.append(cmd)
                else:
                    conditional.true_branch.append(cmd)
                i += 1
            elif any(line.startswith(f'{p} ') for p in self.PLATFORMS):
                cmd = self._parse_command(line, i + 1)
                if in_else:
                    conditional.false_branch.append(cmd)
                else:
                    conditional.true_branch.append(cmd)
                i += 1
            else:
                i += 1

        raise ValueError("Unclosed if block")

    def _parse_loop(self, lines: List[str], start: int) -> Tuple[CLILoop, int]:
        """Parse a loop block."""
        line = lines[start].strip()
        line_num = start + 1

        # Extract collection and item variable
        match = re.match(r'loop\s+(\w+)\s+as\s+(\w+)', line)
        if not match:
            raise ValueError(f"Invalid loop statement: {line}")

        collection_var = match.group(1)
        item_var = match.group(2)

        loop = CLILoop(
            collection_var=collection_var,
            item_var=item_var,
            body=[],
            line_number=line_num
        )

        i = start + 1
        while i < len(lines):
            line = lines[i].strip()

            if not line or line.startswith('#'):
                i += 1
                continue

            if line == 'end':
                return loop, i + 1

            # Parse nested content
            if line.startswith('if '):
                nested, i = self._parse_conditional(lines, i)
                loop.body.append(nested)
            elif line.startswith('loop '):
                nested, i = self._parse_loop(lines, i)
                loop.body.append(nested)
            elif line.startswith('wait '):
                cmd = self._parse_wait(line, i + 1)
                loop.body.append(cmd)
                i += 1
            elif any(line.startswith(f'{p} ') for p in self.PLATFORMS):
                cmd = self._parse_command(line, i + 1)
                loop.body.append(cmd)
                i += 1
            else:
                i += 1

        raise ValueError("Unclosed loop block")

    def _parse_wait(self, line: str, line_num: int) -> CLIWait:
        """Parse a wait command."""
        match = re.match(r'wait\s+(\d+)([smhd])?', line)
        if not match:
            raise ValueError(f"Invalid wait statement: {line}")

        duration = int(match.group(1))
        unit = match.group(2) or 's'

        multipliers = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}
        seconds = duration * multipliers.get(unit, 1)

        return CLIWait(duration_seconds=seconds, line_number=line_num)

    def _parse_set(self, line: str, line_num: int) -> CLICommand:
        """Parse a set variable command."""
        match = re.match(r'set\s+(\w+)\s*=\s*(.+)', line)
        if not match:
            raise ValueError(f"Invalid set statement: {line}")

        return CLICommand(
            platform='internal',
            action='set',
            params={'name': match.group(1), 'value': self._parse_value(match.group(2))},
            line_number=line_num,
            raw=line
        )

    def _parse_approval(self, line: str, line_num: int) -> CLICommand:
        """Parse an approval command."""
        return CLICommand(
            platform='internal',
            action='approval',
            params={},
            line_number=line_num,
            raw=line
        )

    def _parse_workflow_command(self, line: str, line_num: int) -> CLICommand:
        """Parse a workflow invocation command."""
        match = re.match(r'workflow\s+run\s+"?([^"]+)"?', line)
        if match:
            return CLICommand(
                platform='internal',
                action='run_workflow',
                params={'name': match.group(1)},
                line_number=line_num,
                raw=line
            )
        return CLICommand(
            platform='internal',
            action='workflow',
            params={},
            line_number=line_num,
            raw=line
        )


# ============================================================================
# CLI Executor
# ============================================================================

class CLIWorkflowExecutor:
    """Executes parsed CLI workflow commands."""

    def __init__(self):
        self._parser = CLIParser()
        self._credential_pool = None

    async def get_credential_pool(self):
        """Get credential pool for tool execution."""
        if self._credential_pool is None:
            try:
                from src.services.credential_pool import get_initialized_pool
                self._credential_pool = await get_initialized_pool()
            except Exception as e:
                logger.warning(f"Failed to initialize credential pool: {e}")
        return self._credential_pool

    async def execute(
        self,
        cli_code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute CLI workflow code.

        Args:
            cli_code: The CLI code to execute
            context: Initial execution context (variables, trigger data)

        Returns:
            Execution result with status, outputs, and any errors
        """
        start_time = datetime.utcnow()

        # Parse the CLI code
        parse_result = self._parser.parse(cli_code)

        if parse_result.errors:
            return {
                "success": False,
                "error": f"Parse errors: {'; '.join(parse_result.errors)}",
                "parse_errors": parse_result.errors,
                "duration_ms": 0
            }

        # Initialize execution state
        state = ExecutionState(
            variables=context.get('variables', {}) if context else {},
            trigger_data=context.get('trigger_data', {}) if context else {},
            results=[],
        )

        # Execute commands
        try:
            await self._execute_commands(parse_result.commands, state)

            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            return {
                "success": not state.has_errors,
                "results": state.results,
                "variables": state.variables,
                "warnings": parse_result.warnings,
                "errors": state.errors,
                "duration_ms": duration_ms
            }

        except Exception as e:
            logger.error(f"CLI execution failed: {e}", exc_info=True)
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            return {
                "success": False,
                "error": str(e),
                "results": state.results,
                "duration_ms": duration_ms
            }

    async def _execute_commands(
        self,
        commands: List[Any],
        state: 'ExecutionState'
    ) -> None:
        """Execute a list of commands sequentially."""
        for cmd in commands:
            if isinstance(cmd, CLICommand):
                await self._execute_command(cmd, state)
            elif isinstance(cmd, CLIConditional):
                await self._execute_conditional(cmd, state)
            elif isinstance(cmd, CLILoop):
                await self._execute_loop(cmd, state)
            elif isinstance(cmd, CLIWait):
                await self._execute_wait(cmd, state)

            # Stop on error (configurable?)
            if state.has_errors:
                break

    async def _execute_command(
        self,
        cmd: CLICommand,
        state: 'ExecutionState'
    ) -> None:
        """Execute a single command."""
        logger.info(f"Executing: {cmd.platform} {cmd.action}")

        # Handle internal commands
        if cmd.platform == 'internal':
            await self._execute_internal_command(cmd, state)
            return

        # Substitute variables in params
        params = self._substitute_variables(cmd.params, state)

        # Map to tool registry
        tool_name = f"{cmd.platform}.{cmd.action.replace('-', '_')}"
        registry = get_tool_registry()
        tool = registry.get(tool_name)

        if not tool:
            # Try alternative formats
            alt_name = f"{cmd.platform}_{cmd.action.replace('-', '_')}"
            tool = registry.get(alt_name)

        if not tool:
            state.add_error(f"Line {cmd.line_number}: Tool not found: {tool_name}")
            return

        try:
            # Build context
            credential_pool = await self.get_credential_pool()
            exec_context = await self._build_context(tool, params, credential_pool)

            # Execute
            result = await tool.handler(params, exec_context)

            # Store result
            state.results.append({
                "command": cmd.raw,
                "tool": tool_name,
                "success": result.get("success", True),
                "data": result.get("data"),
                "error": result.get("error"),
            })

            # Store result in variables for next commands
            state.variables['_last_result'] = result.get("data")
            state.variables['_last_success'] = result.get("success", True)

            if not result.get("success", True):
                state.add_error(f"Line {cmd.line_number}: {result.get('error', 'Command failed')}")

        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            state.add_error(f"Line {cmd.line_number}: {str(e)}")
            state.results.append({
                "command": cmd.raw,
                "tool": tool_name,
                "success": False,
                "error": str(e)
            })

    async def _execute_internal_command(
        self,
        cmd: CLICommand,
        state: 'ExecutionState'
    ) -> None:
        """Execute an internal command (set, approval, etc)."""
        if cmd.action == 'set':
            name = cmd.params.get('name')
            value = self._substitute_variables({'v': cmd.params.get('value')}, state)['v']
            state.variables[name] = value
            state.results.append({
                "command": cmd.raw,
                "type": "set_variable",
                "name": name,
                "value": value,
                "success": True
            })

        elif cmd.action == 'approval':
            # In real implementation, this would pause for approval
            state.results.append({
                "command": cmd.raw,
                "type": "approval",
                "success": True,
                "message": "Approval gate (auto-approved in execution)"
            })

        elif cmd.action == 'run_workflow':
            workflow_name = cmd.params.get('name')
            state.results.append({
                "command": cmd.raw,
                "type": "run_workflow",
                "workflow": workflow_name,
                "success": True,
                "message": f"Sub-workflow '{workflow_name}' would be executed"
            })

    async def _execute_conditional(
        self,
        conditional: CLIConditional,
        state: 'ExecutionState'
    ) -> None:
        """Execute a conditional block."""
        # Evaluate condition
        condition_result = self._evaluate_condition(conditional.condition, state)

        state.results.append({
            "type": "conditional",
            "condition": conditional.condition,
            "result": condition_result
        })

        if condition_result:
            await self._execute_commands(conditional.true_branch, state)
        else:
            await self._execute_commands(conditional.false_branch, state)

    async def _execute_loop(
        self,
        loop: CLILoop,
        state: 'ExecutionState'
    ) -> None:
        """Execute a loop block."""
        collection = state.variables.get(loop.collection_var, [])

        if not isinstance(collection, (list, tuple)):
            state.add_error(f"Line {loop.line_number}: {loop.collection_var} is not a list")
            return

        state.results.append({
            "type": "loop_start",
            "collection": loop.collection_var,
            "item_count": len(collection)
        })

        for i, item in enumerate(collection):
            state.variables[loop.item_var] = item
            state.variables['_loop_index'] = i

            await self._execute_commands(loop.body, state)

            if state.has_errors:
                break

        state.results.append({
            "type": "loop_end",
            "iterations_completed": min(i + 1, len(collection)) if collection else 0
        })

    async def _execute_wait(
        self,
        wait: CLIWait,
        state: 'ExecutionState'
    ) -> None:
        """Execute a wait command."""
        state.results.append({
            "type": "wait",
            "duration_seconds": wait.duration_seconds,
            "status": "started"
        })

        await asyncio.sleep(wait.duration_seconds)

        state.results.append({
            "type": "wait",
            "duration_seconds": wait.duration_seconds,
            "status": "completed"
        })

    def _substitute_variables(
        self,
        params: Dict[str, Any],
        state: 'ExecutionState'
    ) -> Dict[str, Any]:
        """Substitute ${var} references in parameters."""
        result = {}

        for key, value in params.items():
            if isinstance(value, str):
                # Replace ${var} patterns
                def replace_var(match):
                    var_name = match.group(1)
                    # Check variables, then trigger_data
                    if var_name in state.variables:
                        return str(state.variables[var_name])
                    elif var_name in state.trigger_data:
                        return str(state.trigger_data[var_name])
                    return match.group(0)  # Keep original if not found

                result[key] = re.sub(r'\$\{(\w+(?:\.\w+)*)\}', replace_var, value)
            else:
                result[key] = value

        return result

    def _evaluate_condition(
        self,
        condition: str,
        state: 'ExecutionState'
    ) -> bool:
        """Evaluate a condition expression."""
        # Simple condition evaluation
        # Supports: var == value, var != value, var < value, var > value

        # Substitute variables first
        substituted = re.sub(
            r'\$\{(\w+(?:\.\w+)*)\}',
            lambda m: str(state.variables.get(m.group(1), state.trigger_data.get(m.group(1), ''))),
            condition
        )

        # Try simple comparisons
        operators = [
            ('==', lambda a, b: a == b),
            ('!=', lambda a, b: a != b),
            ('>=', lambda a, b: float(a) >= float(b)),
            ('<=', lambda a, b: float(a) <= float(b)),
            ('>', lambda a, b: float(a) > float(b)),
            ('<', lambda a, b: float(a) < float(b)),
        ]

        for op, func in operators:
            if op in substituted:
                parts = substituted.split(op)
                if len(parts) == 2:
                    left = parts[0].strip().strip('"\'')
                    right = parts[1].strip().strip('"\'')
                    try:
                        return func(left, right)
                    except (ValueError, TypeError):
                        return func(str(left), str(right))

        # Default to truthy check
        return bool(substituted.strip())

    async def _build_context(
        self,
        tool,
        params: Dict[str, Any],
        credential_pool
    ):
        """Build execution context for a tool."""
        platform = tool.platform

        if credential_pool:
            try:
                org_id = params.get("organization_id") or params.get("org_id")
                network_id = params.get("network_id")
                base_url = params.get("base_url")

                cred = credential_pool.get_for_platform(
                    platform=platform,
                    org_id=org_id,
                    network_id=network_id,
                    base_url=base_url,
                )

                if cred:
                    return await self._create_platform_context(platform, cred, params)

            except Exception as e:
                logger.warning(f"Failed to get credentials for {platform}: {e}")

        return {"platform": platform, "params": params}

    async def _create_platform_context(
        self,
        platform: str,
        credential,
        params: Dict[str, Any]
    ):
        """Create platform-specific execution context."""
        if platform == "meraki":
            from src.services.tools.meraki import MerakiExecutionContext
            return MerakiExecutionContext(
                api_key=credential.api_key,
                org_id=params.get("organization_id"),
                network_id=params.get("network_id"),
            )

        elif platform == "splunk":
            from src.services.tools.splunk import SplunkExecutionContext
            return SplunkExecutionContext(
                base_url=credential.base_url,
                username=credential.username,
                password=credential.password,
                token=credential.token,
            )

        elif platform == "thousandeyes":
            from src.services.tools.thousandeyes import ThousandEyesExecutionContext
            return ThousandEyesExecutionContext(
                oauth_token=credential.oauth_token,
            )

        else:
            return {"platform": platform, "credential": credential, "params": params}


# ============================================================================
# Execution State
# ============================================================================

@dataclass
class ExecutionState:
    """Tracks state during CLI execution."""
    variables: Dict[str, Any] = field(default_factory=dict)
    trigger_data: Dict[str, Any] = field(default_factory=dict)
    results: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def add_error(self, error: str) -> None:
        self.errors.append(error)


# ============================================================================
# Global Instance
# ============================================================================

_cli_executor: Optional[CLIWorkflowExecutor] = None


def get_cli_workflow_executor() -> CLIWorkflowExecutor:
    """Get the global CLI workflow executor instance."""
    global _cli_executor
    if _cli_executor is None:
        _cli_executor = CLIWorkflowExecutor()
    return _cli_executor
