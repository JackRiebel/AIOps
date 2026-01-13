"""Python Workflow Executor - Executes Python-mode workflows.

This executor:
- Validates Python code for security
- Provides sandboxed execution environment
- Injects Lumen SDK modules
- Captures output and results
- Enforces timeouts
"""

import logging
import ast
import asyncio
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass, field
from io import StringIO
import sys

logger = logging.getLogger(__name__)


# ============================================================================
# Security Configuration
# ============================================================================

# Forbidden imports that could be security risks
FORBIDDEN_IMPORTS: Set[str] = {
    'os', 'subprocess', 'sys', 'shutil', 'pathlib',
    'socket', 'urllib', 'requests', 'http',
    'pickle', 'shelve', 'marshal',
    'ctypes', 'multiprocessing', 'threading',
    '__builtin__', 'builtins',
    'importlib', 'imp',
    'code', 'codeop', 'compile',
    'exec', 'eval',
}

# Forbidden builtins
FORBIDDEN_BUILTINS: Set[str] = {
    'eval', 'exec', 'compile', '__import__',
    'open', 'input', 'breakpoint',
    'globals', 'locals', 'vars', 'dir',
    'getattr', 'setattr', 'delattr', 'hasattr',
    'type', 'object', 'super',
    'memoryview', 'bytearray',
}

# Allowed imports
ALLOWED_IMPORTS: Set[str] = {
    'typing', 'dataclasses', 'datetime', 'json', 're',
    'math', 'statistics', 'random', 'itertools', 'functools',
    'collections', 'enum',
}


# ============================================================================
# Code Validator
# ============================================================================

@dataclass
class ValidationResult:
    """Result of Python code validation."""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class PythonCodeValidator:
    """Validates Python code for security issues."""

    def validate(self, code: str) -> ValidationResult:
        """Validate Python code.

        Args:
            code: Python source code to validate

        Returns:
            ValidationResult with any errors or warnings
        """
        result = ValidationResult(is_valid=True)

        # Try to parse the code
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            result.is_valid = False
            result.errors.append(f"Syntax error at line {e.lineno}: {e.msg}")
            return result

        # Walk the AST to check for forbidden constructs
        for node in ast.walk(tree):
            self._check_node(node, result)

        # Check for required workflow function
        has_workflow_func = False
        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef) and node.name == 'workflow':
                has_workflow_func = True
                break

        if not has_workflow_func:
            result.warnings.append("Missing 'async def workflow(context)' function")

        return result

    def _check_node(self, node: ast.AST, result: ValidationResult) -> None:
        """Check an AST node for security issues."""

        # Check imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                module_name = alias.name.split('.')[0]
                if module_name in FORBIDDEN_IMPORTS:
                    result.is_valid = False
                    result.errors.append(
                        f"Import '{alias.name}' is forbidden for security reasons"
                    )
                elif module_name not in ALLOWED_IMPORTS and not module_name.startswith('nexus'):
                    result.warnings.append(
                        f"Import '{alias.name}' may not be available in sandbox"
                    )

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module_name = node.module.split('.')[0]
                if module_name in FORBIDDEN_IMPORTS:
                    result.is_valid = False
                    result.errors.append(
                        f"Import from '{node.module}' is forbidden for security reasons"
                    )

        # Check for forbidden function calls
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                if node.func.id in FORBIDDEN_BUILTINS:
                    result.is_valid = False
                    result.errors.append(
                        f"Built-in '{node.func.id}' is forbidden for security reasons"
                    )

            # Check for attribute access that might be dangerous
            elif isinstance(node.func, ast.Attribute):
                if node.func.attr in {'__class__', '__bases__', '__mro__', '__subclasses__'}:
                    result.is_valid = False
                    result.errors.append(
                        f"Access to '{node.func.attr}' is forbidden for security reasons"
                    )


# ============================================================================
# SDK Stubs
# ============================================================================

class SDKModule:
    """Base class for SDK module stubs."""

    def __init__(self, executor: 'PythonWorkflowExecutor'):
        self._executor = executor

    def _log(self, message: str):
        self._executor._add_log('info', message)


class MerakiSDK(SDKModule):
    """Meraki SDK stub for Python workflows."""

    async def get_organizations(self):
        return await self._executor._call_tool('meraki.get_organizations', {})

    async def get_networks(self, org_id: str):
        return await self._executor._call_tool('meraki.get_networks', {'org_id': org_id})

    async def get_devices(self, network_id: str):
        return await self._executor._call_tool('meraki.get_devices', {'network_id': network_id})

    async def get_device(self, serial: str):
        return await self._executor._call_tool('meraki.get_device', {'serial': serial})

    async def update_device(self, serial: str, **kwargs):
        return await self._executor._call_tool('meraki.update_device', {'serial': serial, **kwargs})

    async def get_clients(self, network_id: str, timespan: int = 86400):
        return await self._executor._call_tool('meraki.get_clients', {'network_id': network_id, 'timespan': timespan})

    async def get_network_health(self, network_id: str):
        return await self._executor._call_tool('meraki.get_network_health', {'network_id': network_id})

    async def reboot_device(self, serial: str):
        return await self._executor._call_tool('meraki.reboot_device', {'serial': serial})

    async def quarantine_client(self, network_id: str, mac: str):
        return await self._executor._call_tool('meraki.quarantine_client', {'network_id': network_id, 'mac': mac})


class SplunkSDK(SDKModule):
    """Splunk SDK stub for Python workflows."""

    async def search(self, query: str, earliest: str = "-24h", latest: str = "now"):
        return await self._executor._call_tool('splunk.search', {
            'query': query, 'earliest': earliest, 'latest': latest
        })

    async def get_alerts(self, search_name: Optional[str] = None):
        return await self._executor._call_tool('splunk.get_alerts', {'search_name': search_name})

    async def create_event(self, index: str, event: dict, sourcetype: str = "json"):
        return await self._executor._call_tool('splunk.create_event', {
            'index': index, 'event': event, 'sourcetype': sourcetype
        })


class ThousandEyesSDK(SDKModule):
    """ThousandEyes SDK stub for Python workflows."""

    async def get_tests(self):
        return await self._executor._call_tool('thousandeyes.get_tests', {})

    async def get_test_results(self, test_id: str, window: str = "1h"):
        return await self._executor._call_tool('thousandeyes.get_test_results', {
            'test_id': test_id, 'window': window
        })

    async def run_instant_test(self, test_id: str):
        return await self._executor._call_tool('thousandeyes.run_instant_test', {'test_id': test_id})

    async def get_agents(self):
        return await self._executor._call_tool('thousandeyes.get_agents', {})


class NotifySDK(SDKModule):
    """Notification SDK stub for Python workflows."""

    async def slack(self, channel: str, message: str, **kwargs):
        return await self._executor._call_tool('notify.slack', {
            'channel': channel, 'message': message, **kwargs
        })

    async def email(self, to: str, subject: str, body: str, html: bool = False):
        return await self._executor._call_tool('notify.email', {
            'to': to, 'subject': subject, 'body': body, 'html': html
        })

    async def teams(self, channel: str, message: str, **kwargs):
        return await self._executor._call_tool('notify.teams', {
            'channel': channel, 'message': message, **kwargs
        })

    async def pagerduty(self, service: str, severity: str, message: str):
        return await self._executor._call_tool('notify.pagerduty', {
            'service': service, 'severity': severity, 'message': message
        })

    async def webhook(self, url: str, data: dict, method: str = "POST"):
        return await self._executor._call_tool('notify.webhook', {
            'url': url, 'data': data, 'method': method
        })


class AISDK(SDKModule):
    """AI SDK stub for Python workflows."""

    async def analyze(self, prompt: str, context: Any = None):
        return await self._executor._call_tool('ai.analyze', {
            'prompt': prompt, 'context': context
        })

    async def decide(self, question: str, options: List[str], context: Any = None):
        return await self._executor._call_tool('ai.decide', {
            'question': question, 'options': options, 'context': context
        })

    async def summarize(self, data: Any, format: str = "text"):
        return await self._executor._call_tool('ai.summarize', {
            'data': data, 'format': format
        })


class LoggerSDK:
    """Logger SDK for Python workflows."""

    def __init__(self, executor: 'PythonWorkflowExecutor'):
        self._executor = executor

    def info(self, message: str, **kwargs):
        self._executor._add_log('info', message)

    def warning(self, message: str, **kwargs):
        self._executor._add_log('warning', message)

    def error(self, message: str, **kwargs):
        self._executor._add_log('error', message)

    def debug(self, message: str, **kwargs):
        self._executor._add_log('debug', message)


class ContextSDK:
    """Context SDK for accessing workflow execution context."""

    def __init__(self, executor: 'PythonWorkflowExecutor'):
        self._executor = executor
        self._variables: Dict[str, Any] = {}

    @property
    def trigger_data(self) -> Dict[str, Any]:
        return self._executor._trigger_data

    @property
    def workflow_id(self) -> str:
        return self._executor._workflow_id

    def get(self, key: str, default: Any = None) -> Any:
        return self._variables.get(key, self._executor._trigger_data.get(key, default))

    def set(self, key: str, value: Any) -> None:
        self._variables[key] = value


# ============================================================================
# Python Executor
# ============================================================================

@dataclass
class ExecutionResult:
    """Result of Python workflow execution."""
    success: bool
    return_value: Any = None
    error: Optional[str] = None
    logs: List[Dict[str, Any]] = field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: float = 0


class PythonWorkflowExecutor:
    """Executes Python workflow code in a sandboxed environment."""

    DEFAULT_TIMEOUT = 30  # seconds

    def __init__(self):
        self._validator = PythonCodeValidator()
        self._credential_pool = None
        self._logs: List[Dict[str, Any]] = []
        self._tool_calls: List[Dict[str, Any]] = []
        self._trigger_data: Dict[str, Any] = {}
        self._workflow_id: str = ""

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
        python_code: str,
        context: Optional[Dict[str, Any]] = None,
        timeout: int = DEFAULT_TIMEOUT
    ) -> ExecutionResult:
        """Execute Python workflow code.

        Args:
            python_code: The Python code to execute
            context: Execution context (trigger_data, variables)
            timeout: Maximum execution time in seconds

        Returns:
            ExecutionResult with status, return value, and logs
        """
        start_time = datetime.utcnow()
        self._logs = []
        self._tool_calls = []
        self._trigger_data = context.get('trigger_data', {}) if context else {}
        self._workflow_id = context.get('workflow_id', 'unknown') if context else 'unknown'

        # Validate code first
        validation = self._validator.validate(python_code)
        if not validation.is_valid:
            return ExecutionResult(
                success=False,
                error=f"Validation failed: {'; '.join(validation.errors)}",
                logs=self._logs,
                duration_ms=0
            )

        # Add validation warnings to logs
        for warning in validation.warnings:
            self._add_log('warning', f"Validation: {warning}")

        try:
            # Create sandbox environment
            sandbox_globals = self._create_sandbox()

            # Add context object
            context_sdk = ContextSDK(self)
            if context and 'variables' in context:
                for k, v in context['variables'].items():
                    context_sdk.set(k, v)
            sandbox_globals['context'] = context_sdk

            # Compile the code
            compiled = compile(python_code, '<workflow>', 'exec')

            # Execute with timeout
            exec(compiled, sandbox_globals)

            # Get the workflow function
            workflow_func = sandbox_globals.get('workflow')
            if not workflow_func:
                return ExecutionResult(
                    success=False,
                    error="No 'workflow' function found in code",
                    logs=self._logs,
                    duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
                )

            # Run the workflow function with timeout
            try:
                result = await asyncio.wait_for(
                    workflow_func(context_sdk),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                return ExecutionResult(
                    success=False,
                    error=f"Execution timed out after {timeout} seconds",
                    logs=self._logs,
                    tool_calls=self._tool_calls,
                    duration_ms=(datetime.utcnow() - start_time).total_seconds() * 1000
                )

            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            return ExecutionResult(
                success=True,
                return_value=result,
                logs=self._logs,
                tool_calls=self._tool_calls,
                duration_ms=duration_ms
            )

        except Exception as e:
            logger.error(f"Python execution failed: {e}", exc_info=True)
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            return ExecutionResult(
                success=False,
                error=f"{type(e).__name__}: {str(e)}",
                logs=self._logs,
                tool_calls=self._tool_calls,
                duration_ms=duration_ms
            )

    def _create_sandbox(self) -> Dict[str, Any]:
        """Create a sandboxed execution environment."""
        # Safe builtins
        safe_builtins = {
            'True': True,
            'False': False,
            'None': None,
            'abs': abs,
            'all': all,
            'any': any,
            'bin': bin,
            'bool': bool,
            'chr': chr,
            'dict': dict,
            'divmod': divmod,
            'enumerate': enumerate,
            'filter': filter,
            'float': float,
            'format': format,
            'frozenset': frozenset,
            'hex': hex,
            'int': int,
            'isinstance': isinstance,
            'issubclass': issubclass,
            'iter': iter,
            'len': len,
            'list': list,
            'map': map,
            'max': max,
            'min': min,
            'next': next,
            'oct': oct,
            'ord': ord,
            'pow': pow,
            'print': self._safe_print,
            'range': range,
            'repr': repr,
            'reversed': reversed,
            'round': round,
            'set': set,
            'slice': slice,
            'sorted': sorted,
            'str': str,
            'sum': sum,
            'tuple': tuple,
            'zip': zip,
            # Exception types
            'Exception': Exception,
            'ValueError': ValueError,
            'TypeError': TypeError,
            'KeyError': KeyError,
            'IndexError': IndexError,
            'RuntimeError': RuntimeError,
        }

        # Create SDK instances
        meraki = MerakiSDK(self)
        splunk = SplunkSDK(self)
        thousandeyes = ThousandEyesSDK(self)
        notify = NotifySDK(self)
        ai = AISDK(self)
        logger_sdk = LoggerSDK(self)

        sandbox = {
            '__builtins__': safe_builtins,
            '__name__': '__workflow__',
            # SDK modules
            'meraki': meraki,
            'splunk': splunk,
            'thousandeyes': thousandeyes,
            'notify': notify,
            'ai': ai,
            'logger': logger_sdk,
            # Allowed standard library
            'List': List,
            'Dict': Dict,
            'Any': Any,
            'Optional': Optional,
            'asyncio': asyncio,
            'datetime': datetime,
            'json': __import__('json'),
            're': __import__('re'),
            'math': __import__('math'),
        }

        return sandbox

    def _safe_print(self, *args, **kwargs):
        """Safe print function that logs output."""
        message = ' '.join(str(arg) for arg in args)
        self._add_log('output', message)

    def _add_log(self, level: str, message: str):
        """Add a log entry."""
        self._logs.append({
            'level': level,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        })

    async def _call_tool(self, tool_name: str, params: Dict[str, Any]) -> Any:
        """Call a tool from the SDK."""
        self._tool_calls.append({
            'tool': tool_name,
            'params': params,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Get the tool from registry
        from src.services.tool_registry import get_tool_registry
        registry = get_tool_registry()
        tool = registry.get(tool_name)

        if not tool:
            self._add_log('error', f"Tool not found: {tool_name}")
            return {"success": False, "error": f"Tool not found: {tool_name}"}

        try:
            # Build context
            credential_pool = await self.get_credential_pool()
            exec_context = await self._build_context(tool, params, credential_pool)

            # Execute
            result = await tool.handler(params, exec_context)

            self._add_log('info', f"Tool {tool_name} completed: success={result.get('success', True)}")

            return result.get('data', result)

        except Exception as e:
            self._add_log('error', f"Tool {tool_name} failed: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _build_context(self, tool, params: Dict[str, Any], credential_pool):
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
# Global Instance
# ============================================================================

_python_executor: Optional[PythonWorkflowExecutor] = None


def get_python_workflow_executor() -> PythonWorkflowExecutor:
    """Get the global Python workflow executor instance."""
    global _python_executor
    if _python_executor is None:
        _python_executor = PythonWorkflowExecutor()
    return _python_executor
