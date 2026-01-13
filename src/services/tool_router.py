"""Smart tool routing for agentic RAG.

Routes queries to the most appropriate tool/method:
- RAG: Documentation search for conceptual questions
- API: Live network data for current state queries
- Calculation: Subnet, VLAN, and other network calculations
- Hybrid: Combine RAG context with live data

This enables the agent to intelligently select the right
approach based on query intent and requirements.

Usage:
    router = ToolRouter()
    decision = await router.route(query, context)
    result = await executor.execute(query, decision)
"""

import logging
import re
from typing import Optional, Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ToolType(Enum):
    """Types of tools available for query handling."""
    RAG = "rag"                    # Search documentation knowledge base
    API = "api"                    # Call live network API for current data
    CALCULATION = "calculation"    # Perform subnet/VLAN calculations
    HYBRID = "hybrid"              # Combine RAG with API data
    DIRECT = "direct"              # Direct response without external data


@dataclass
class RoutingDecision:
    """Decision about which tool to use."""
    tool: ToolType
    confidence: float
    reasoning: str
    suggested_params: Dict[str, Any] = field(default_factory=dict)
    fallback_tool: Optional[ToolType] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool": self.tool.value,
            "confidence": round(self.confidence, 3),
            "reasoning": self.reasoning,
            "suggested_params": self.suggested_params,
            "fallback_tool": self.fallback_tool.value if self.fallback_tool else None,
        }


@dataclass
class ToolResult:
    """Result from tool execution."""
    tool_used: ToolType
    success: bool
    data: Any
    error: Optional[str] = None
    execution_time_ms: float = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ToolRouter:
    """Route queries to the most appropriate tool.

    Analyzes query intent, keywords, and context to determine
    whether to use RAG, API calls, calculations, or combinations.

    Features:
    - Pattern-based intent detection
    - Confidence scoring
    - Fallback recommendations
    - Context-aware routing
    """

    # Patterns that indicate need for LIVE data (API)
    LIVE_DATA_PATTERNS = [
        r'\b(current|now|currently|right now|at the moment)\b',
        r'\b(status|state|health|uptime)\b',
        r'\b(show|display|list|get) (my|our|the|all)\b',
        r'\b(what is|what are) (my|our|the)\b.*\b(status|address|config)\b',
        r'\b(connected|disconnected|online|offline|up|down)\b',
        r'\b(traffic|throughput|bandwidth|utilization)\b',
        r'\b(clients?|devices?|users?) (on|connected|active)\b',
        r'\b(recent|latest|last) (events?|alerts?|changes?)\b',
    ]

    # Patterns that indicate CONCEPTUAL questions (RAG)
    CONCEPTUAL_PATTERNS = [
        r'\b(what is|what are|what does|how does|explain)\b',
        r'\b(difference between|compare|versus|vs\.?)\b',
        r'\b(why|when|should i)\b',
        r'\b(best practice|recommendation|guideline)\b',
        r'\b(configure|setup|troubleshoot|debug)\b.*\b(how|steps|guide)\b',
        r'\b(documentation|docs|manual|guide)\b',
        r'\b(meaning|definition|purpose)\b',
    ]

    # Patterns that indicate CALCULATION needs
    CALCULATION_PATTERNS = [
        r'\b(calculate|compute|convert|subnet)\b',
        r'\b(cidr|netmask|prefix|slash)\b',
        r'\b(/\d{1,2})\b',  # CIDR notation
        r'\b(ip range|address range|available ips|usable hosts)\b',
        r'\b(vlan id|vlan number|vlan range)\b',
        r'\b(speed|bandwidth|latency)\s*(calculation|convert)',
        r'\b(how many (ips?|hosts?|addresses))\b',
    ]

    # Patterns that should go DIRECT (no external data needed)
    DIRECT_PATTERNS = [
        r'^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)\b',
        r'^(help|help me|can you help)\b',
        r'\b(who are you|what are you|your name)\b',
    ]

    # API operation keywords for param suggestion
    API_OPERATIONS = {
        "network_status": ["status", "health", "state", "up", "down"],
        "device_list": ["list", "show", "get", "devices", "switches", "aps"],
        "client_list": ["clients", "users", "connected", "associated"],
        "traffic": ["traffic", "throughput", "bandwidth", "utilization"],
        "events": ["events", "alerts", "logs", "recent"],
        "config": ["configuration", "settings", "config"],
    }

    def __init__(
        self,
        default_confidence: float = 0.7,
        hybrid_threshold: float = 0.5,
    ):
        """Initialize the tool router.

        Args:
            default_confidence: Default confidence when patterns match.
            hybrid_threshold: Threshold for triggering hybrid routing.
        """
        self.default_confidence = default_confidence
        self.hybrid_threshold = hybrid_threshold

    def _matches_patterns(self, query: str, patterns: List[str]) -> bool:
        """Check if query matches any of the patterns."""
        query_lower = query.lower()
        return any(re.search(p, query_lower) for p in patterns)

    def _count_pattern_matches(self, query: str, patterns: List[str]) -> int:
        """Count how many patterns match the query."""
        query_lower = query.lower()
        return sum(1 for p in patterns if re.search(p, query_lower))

    def _detect_api_operation(self, query: str) -> Optional[str]:
        """Detect the likely API operation from query."""
        query_lower = query.lower()

        for operation, keywords in self.API_OPERATIONS.items():
            if any(kw in query_lower for kw in keywords):
                return operation

        return None

    def _detect_product(self, query: str) -> Optional[str]:
        """Detect product context from query."""
        patterns = {
            "meraki": r'\b(meraki|mx|ms|mr|mv|mt|sm|dashboard)\b',
            "catalyst": r'\b(catalyst|ios-xe?|switch)\b',
            "ise": r'\b(ise|identity|radius|tacacs)\b',
            "dnac": r'\b(dna.?center|dnac|catalyst center)\b',
        }

        query_lower = query.lower()
        for product, pattern in patterns.items():
            if re.search(pattern, query_lower):
                return product

        return None

    def _is_conceptual(self, query: str) -> bool:
        """Check if query is asking for conceptual/documentation info."""
        return self._matches_patterns(query, self.CONCEPTUAL_PATTERNS)

    def _needs_live_data(self, query: str) -> bool:
        """Check if query requires current/live data."""
        return self._matches_patterns(query, self.LIVE_DATA_PATTERNS)

    def _is_calculation(self, query: str) -> bool:
        """Check if query requires calculation."""
        return self._matches_patterns(query, self.CALCULATION_PATTERNS)

    def _is_direct(self, query: str) -> bool:
        """Check if query can be answered directly."""
        return self._matches_patterns(query, self.DIRECT_PATTERNS)

    async def route(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> RoutingDecision:
        """Determine the best tool for handling this query.

        Args:
            query: The user's query.
            context: Optional context (conversation history, user prefs, etc.)

        Returns:
            RoutingDecision with tool selection and confidence.
        """
        context = context or {}

        # Quick checks for special cases
        if self._is_direct(query):
            return RoutingDecision(
                tool=ToolType.DIRECT,
                confidence=0.95,
                reasoning="Query is a greeting or simple response that doesn't need external data",
            )

        if self._is_calculation(query):
            return RoutingDecision(
                tool=ToolType.CALCULATION,
                confidence=0.9,
                reasoning="Query involves network calculations (subnet, CIDR, etc.)",
                suggested_params={"calculation_type": self._detect_calculation_type(query)},
            )

        # Count matches for main routing decision
        live_matches = self._count_pattern_matches(query, self.LIVE_DATA_PATTERNS)
        conceptual_matches = self._count_pattern_matches(query, self.CONCEPTUAL_PATTERNS)

        needs_live = live_matches > 0
        is_conceptual = conceptual_matches > 0

        # Determine primary tool
        if needs_live and is_conceptual:
            # Hybrid: need both documentation context and live data
            return RoutingDecision(
                tool=ToolType.HYBRID,
                confidence=0.8,
                reasoning="Query requires both documentation context and live network data",
                suggested_params={
                    "api_operation": self._detect_api_operation(query),
                    "product": self._detect_product(query),
                },
                fallback_tool=ToolType.RAG,
            )
        elif needs_live and not is_conceptual:
            # Pure API call
            operation = self._detect_api_operation(query)
            return RoutingDecision(
                tool=ToolType.API,
                confidence=0.85,
                reasoning=f"Query asks for current state/data ({operation or 'general'})",
                suggested_params={
                    "api_operation": operation,
                    "product": self._detect_product(query),
                },
                fallback_tool=ToolType.RAG,
            )
        elif is_conceptual:
            # RAG search
            return RoutingDecision(
                tool=ToolType.RAG,
                confidence=0.85,
                reasoning="Query is about concepts, configuration, or troubleshooting",
                suggested_params={
                    "product": self._detect_product(query),
                    "doc_type": self._detect_doc_type(query),
                },
            )
        else:
            # Default to RAG with lower confidence
            return RoutingDecision(
                tool=ToolType.RAG,
                confidence=0.6,
                reasoning="No clear pattern matched, defaulting to documentation search",
                fallback_tool=ToolType.API,
            )

    def _detect_calculation_type(self, query: str) -> str:
        """Detect the type of calculation needed."""
        query_lower = query.lower()

        if any(kw in query_lower for kw in ['subnet', 'cidr', 'netmask', 'prefix']):
            return "subnet"
        elif any(kw in query_lower for kw in ['vlan', 'vlan id']):
            return "vlan"
        elif any(kw in query_lower for kw in ['bandwidth', 'speed', 'throughput']):
            return "bandwidth"
        else:
            return "general"

    def _detect_doc_type(self, query: str) -> Optional[str]:
        """Detect the likely documentation type needed."""
        query_lower = query.lower()

        if any(kw in query_lower for kw in ['configure', 'setup', 'enable', 'create']):
            return "configuration"
        elif any(kw in query_lower for kw in ['troubleshoot', 'debug', 'fix', 'error']):
            return "troubleshooting"
        elif any(kw in query_lower for kw in ['api', 'endpoint', 'rest', 'request']):
            return "api_reference"
        elif any(kw in query_lower for kw in ['command', 'cli', 'show']):
            return "cli_reference"
        else:
            return None


class ToolExecutor:
    """Execute tools based on routing decisions.

    Provides a unified interface for executing different tools
    and handling fallbacks.
    """

    def __init__(
        self,
        rag_handler: Optional[Callable[[str, Dict], Awaitable[Any]]] = None,
        api_handler: Optional[Callable[[str, Dict], Awaitable[Any]]] = None,
        calculation_handler: Optional[Callable[[str, Dict], Awaitable[Any]]] = None,
    ):
        """Initialize the tool executor.

        Args:
            rag_handler: Async function to handle RAG queries.
            api_handler: Async function to handle API queries.
            calculation_handler: Async function for calculations.
        """
        self.handlers: Dict[ToolType, Optional[Callable]] = {
            ToolType.RAG: rag_handler,
            ToolType.API: api_handler,
            ToolType.CALCULATION: calculation_handler,
            ToolType.HYBRID: None,  # Handled specially
            ToolType.DIRECT: None,  # Handled specially
        }

    async def execute(
        self,
        query: str,
        decision: RoutingDecision,
        context: Optional[Dict] = None,
    ) -> ToolResult:
        """Execute the appropriate tool based on routing decision.

        Args:
            query: The user's query.
            decision: Routing decision from ToolRouter.
            context: Optional execution context.

        Returns:
            ToolResult with execution outcome.
        """
        import time
        start_time = time.time()
        context = context or {}

        try:
            if decision.tool == ToolType.DIRECT:
                # No external call needed
                return ToolResult(
                    tool_used=ToolType.DIRECT,
                    success=True,
                    data=None,
                    execution_time_ms=(time.time() - start_time) * 1000,
                )

            if decision.tool == ToolType.HYBRID:
                # Execute both RAG and API
                result = await self._execute_hybrid(query, decision.suggested_params, context)
                return ToolResult(
                    tool_used=ToolType.HYBRID,
                    success=True,
                    data=result,
                    execution_time_ms=(time.time() - start_time) * 1000,
                )

            # Get handler for this tool
            handler = self.handlers.get(decision.tool)

            if handler is None:
                # No handler registered, try fallback
                if decision.fallback_tool and self.handlers.get(decision.fallback_tool):
                    handler = self.handlers[decision.fallback_tool]
                    decision.tool = decision.fallback_tool
                else:
                    return ToolResult(
                        tool_used=decision.tool,
                        success=False,
                        data=None,
                        error=f"No handler registered for {decision.tool.value}",
                        execution_time_ms=(time.time() - start_time) * 1000,
                    )

            # Execute handler
            result = await handler(query, decision.suggested_params)

            return ToolResult(
                tool_used=decision.tool,
                success=True,
                data=result,
                execution_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            logger.error(f"Tool execution failed: {e}")

            # Try fallback
            if decision.fallback_tool and self.handlers.get(decision.fallback_tool):
                try:
                    fallback_handler = self.handlers[decision.fallback_tool]
                    result = await fallback_handler(query, decision.suggested_params)
                    return ToolResult(
                        tool_used=decision.fallback_tool,
                        success=True,
                        data=result,
                        metadata={"fallback_used": True, "original_error": str(e)},
                        execution_time_ms=(time.time() - start_time) * 1000,
                    )
                except Exception as e2:
                    logger.error(f"Fallback execution also failed: {e2}")

            return ToolResult(
                tool_used=decision.tool,
                success=False,
                data=None,
                error=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )

    async def _execute_hybrid(
        self,
        query: str,
        params: Dict,
        context: Dict,
    ) -> Dict[str, Any]:
        """Execute hybrid RAG + API query.

        Returns combined results from both sources.
        """
        results = {"rag": None, "api": None}

        # Execute RAG if handler available
        if self.handlers.get(ToolType.RAG):
            try:
                results["rag"] = await self.handlers[ToolType.RAG](query, params)
            except Exception as e:
                logger.warning(f"RAG component of hybrid query failed: {e}")

        # Execute API if handler available
        if self.handlers.get(ToolType.API):
            try:
                results["api"] = await self.handlers[ToolType.API](query, params)
            except Exception as e:
                logger.warning(f"API component of hybrid query failed: {e}")

        return results


# Subnet calculator utility (for CALCULATION tool type)
class SubnetCalculator:
    """Simple subnet calculator for network calculations."""

    @staticmethod
    def cidr_to_netmask(cidr: int) -> str:
        """Convert CIDR prefix to dotted netmask."""
        if cidr < 0 or cidr > 32:
            raise ValueError(f"Invalid CIDR: {cidr}")

        mask = (0xFFFFFFFF << (32 - cidr)) & 0xFFFFFFFF
        return ".".join([str((mask >> (8 * i)) & 0xFF) for i in range(3, -1, -1)])

    @staticmethod
    def netmask_to_cidr(netmask: str) -> int:
        """Convert dotted netmask to CIDR prefix."""
        octets = [int(o) for o in netmask.split('.')]
        binary = ''.join([bin(o)[2:].zfill(8) for o in octets])
        return binary.count('1')

    @staticmethod
    def calculate_hosts(cidr: int) -> int:
        """Calculate usable hosts for a given CIDR."""
        if cidr >= 31:
            return 2 ** (32 - cidr)  # Point-to-point or /32
        return (2 ** (32 - cidr)) - 2  # Subtract network and broadcast

    @staticmethod
    def calculate_subnet(ip: str, cidr: int) -> Dict[str, Any]:
        """Calculate subnet details from IP and CIDR."""
        octets = [int(o) for o in ip.split('.')]
        ip_int = sum(o << (8 * (3 - i)) for i, o in enumerate(octets))

        mask = (0xFFFFFFFF << (32 - cidr)) & 0xFFFFFFFF
        network = ip_int & mask
        broadcast = network | (~mask & 0xFFFFFFFF)

        def int_to_ip(n: int) -> str:
            return ".".join([str((n >> (8 * i)) & 0xFF) for i in range(3, -1, -1)])

        return {
            "network": int_to_ip(network),
            "broadcast": int_to_ip(broadcast),
            "netmask": SubnetCalculator.cidr_to_netmask(cidr),
            "first_host": int_to_ip(network + 1) if cidr < 31 else int_to_ip(network),
            "last_host": int_to_ip(broadcast - 1) if cidr < 31 else int_to_ip(broadcast),
            "usable_hosts": SubnetCalculator.calculate_hosts(cidr),
            "cidr": cidr,
        }


# Singleton instances
_tool_router: Optional[ToolRouter] = None
_tool_executor: Optional[ToolExecutor] = None


def get_tool_router() -> ToolRouter:
    """Get or create the global tool router instance."""
    global _tool_router
    if _tool_router is None:
        _tool_router = ToolRouter()
    return _tool_router


def get_tool_executor() -> ToolExecutor:
    """Get or create the global tool executor instance."""
    global _tool_executor
    if _tool_executor is None:
        _tool_executor = ToolExecutor()
    return _tool_executor
