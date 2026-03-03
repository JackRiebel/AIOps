"""Meraki Magic MCP Server — integrated with Cisco AIOps Hub middleware.

Adapts the Meraki Magic MCP (https://github.com/CiscoDevNet/meraki-magic-mcp-community)
dynamic SDK discovery approach with AIOps Hub's credential management, security middleware,
and audit logging.

Provides:
  - 12 pre-registered convenience tools (getOrganizations, getNetwork, etc.)
  - call_meraki_api() generic caller for all 800+ Meraki SDK endpoints
  - Discovery tools: list_all_methods, search_methods, get_method_info
  - Caching: in-memory + file-based for large responses
  - Read-only mode enforcement via AIOps Hub's database-driven security_config
  - Audit logging of all operations
"""

import json
import hashlib
import inspect
import asyncio
import functools
import logging
import os
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import meraki
from mcp.server.fastmcp import FastMCP
from pydantic import Field

from src.config.settings import get_settings
from src.middleware.security import SecurityMiddleware
from src.middleware.logging import AuditLogger

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Settings & constants
# ---------------------------------------------------------------------------

settings = get_settings()

CACHE_TTL_SECONDS = int(os.getenv("MERAKI_MAGIC_CACHE_TTL", "300"))
ENABLE_CACHING = os.getenv("MERAKI_MAGIC_CACHING", "true").lower() == "true"
MAX_RESPONSE_TOKENS = int(os.getenv("MERAKI_MAGIC_MAX_TOKENS", "5000"))
MAX_PER_PAGE = int(os.getenv("MERAKI_MAGIC_MAX_PER_PAGE", "100"))
ENABLE_FILE_CACHING = os.getenv("MERAKI_MAGIC_FILE_CACHING", "true").lower() == "true"
RESPONSE_CACHE_DIR = os.getenv(
    "MERAKI_MAGIC_CACHE_DIR",
    str(Path(__file__).resolve().parent.parent.parent / ".meraki_cache"),
)

SDK_SECTIONS = [
    "organizations", "networks", "devices", "wireless", "switch",
    "appliance", "camera", "cellularGateway", "sensor", "sm",
    "insight", "licensing", "administered",
]

READ_ONLY_PREFIXES = ["get", "list"]
WRITE_PREFIXES = [
    "create", "update", "delete", "remove", "claim", "reboot",
    "assign", "move", "renew", "clone", "combine", "split",
    "bind", "unbind",
]


def _is_read(method_name: str) -> bool:
    return any(method_name.startswith(p) for p in READ_ONLY_PREFIXES)


def _is_write(method_name: str) -> bool:
    return any(method_name.startswith(p) for p in WRITE_PREFIXES)


# ---------------------------------------------------------------------------
# Simple in-memory cache (thread-safe)
# ---------------------------------------------------------------------------

class _SimpleCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {}
        self._ts: Dict[str, datetime] = {}

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._data:
                if datetime.now() - self._ts[key] < timedelta(seconds=CACHE_TTL_SECONDS):
                    return self._data[key]
                del self._data[key]
                del self._ts[key]
        return None

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = value
            self._ts[key] = datetime.now()

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self._ts.clear()

    def invalidate(self, prefix: str) -> None:
        with self._lock:
            for k in [k for k in self._data if k.startswith(prefix)]:
                del self._data[k]
                del self._ts[k]

    def stats(self) -> Dict:
        return {
            "total_items": len(self._data),
            "cache_enabled": ENABLE_CACHING,
            "ttl_seconds": CACHE_TTL_SECONDS,
        }


_cache = _SimpleCache()

# ---------------------------------------------------------------------------
# File cache helpers
# ---------------------------------------------------------------------------

if ENABLE_FILE_CACHING:
    Path(RESPONSE_CACHE_DIR).mkdir(exist_ok=True)


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def _save_to_file(data: Any, section: str, method: str, params: Dict) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    h = hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()[:8]
    fp = os.path.join(RESPONSE_CACHE_DIR, f"{section}_{method}_{h}_{ts}.json")
    with open(fp, "w") as f:
        json.dump({"cached_at": ts, "section": section, "method": method, "parameters": params, "data": data}, f, indent=2)
    return fp


def _validate_filepath(filepath: str) -> str:
    root = Path(RESPONSE_CACHE_DIR).resolve()
    resolved = Path(filepath).resolve()
    if not str(resolved).startswith(str(root) + os.sep) and resolved != root:
        raise ValueError(f"filepath must be inside cache directory ({root})")
    return str(resolved)


def _load_from_file(filepath: str) -> Optional[Any]:
    try:
        safe = _validate_filepath(filepath)
        with open(safe) as f:
            return json.load(f).get("data")
    except Exception:
        return None


def _truncated_response(data: Any, filepath: str, section: str, method: str, params: Dict) -> Dict:
    count = len(data) if isinstance(data, list) else 1
    preview = data[:3] if isinstance(data, list) and len(data) > 3 else data
    return {
        "_response_truncated": True,
        "_reason": f"Response too large (~{_estimate_tokens(json.dumps(data))} tokens)",
        "_full_response_cached": filepath,
        "_total_items": count,
        "_preview": preview,
        "_hints": {
            "paginated_access": f"get_cached_response(filepath='{filepath}', offset=0, limit=10)",
            "cli_full": f"cat {filepath} | jq '.data'",
        },
        "section": section,
        "method": method,
        "parameters": params,
    }


def _enforce_pagination(params: Dict) -> tuple[Dict, bool]:
    limited = False
    for p in ("perPage", "per_page", "pageSize", "limit"):
        if p in params and isinstance(params[p], int) and params[p] > MAX_PER_PAGE:
            params[p] = MAX_PER_PAGE
            limited = True
    return params, limited


def _cache_key(section: str, method: str, kwargs: Dict) -> str:
    h = hashlib.md5(f"{section}_{method}_{json.dumps(kwargs, sort_keys=True)}".encode()).hexdigest()
    return f"{section}::{h}"


# ---------------------------------------------------------------------------
# Async helper
# ---------------------------------------------------------------------------

def _to_async(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await asyncio.to_thread(func, *args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# MerakiMagicServer — main class
# ---------------------------------------------------------------------------

class MerakiMagicServer:
    """Cisco AIOps Hub integrated Meraki Magic MCP server.

    Wraps the Meraki Python SDK with FastMCP, adds AIOps Hub middleware.
    """

    def __init__(self, organization_name: str = "default") -> None:
        self.organization_name = organization_name
        self.security_middleware = SecurityMiddleware()
        self.audit_logger = AuditLogger(organization_name)

        # Resolve API key — prefer env, fall back to settings
        self.api_key = os.getenv("MERAKI_API_KEY") or settings.meraki_api_key
        self.org_id = os.getenv("MERAKI_ORG_ID", "") or settings.meraki_org_id

        if not self.api_key:
            raise RuntimeError(
                "MERAKI_API_KEY is not set. Configure it in .env or via the AIOps Hub setup wizard."
            )

        # Meraki SDK client
        self.dashboard = meraki.DashboardAPI(
            api_key=self.api_key,
            suppress_logging=True,
            maximum_retries=3,
            wait_on_rate_limit=True,
        )

        # Build method index once
        self._method_index = self._build_method_index()
        total_methods = sum(len(v) for v in self._method_index.values())
        logger.info(f"Meraki Magic: indexed {total_methods} SDK methods across {len(self._method_index)} sections")

        # FastMCP instance
        self.mcp = FastMCP(
            "Cisco AIOps Hub Meraki Magic MCP",
            host=settings.mcp_server_host,
            port=settings.mcp_server_port,
        )

        # Register all tools
        self._register_tools()

    # ------------------------------------------------------------------
    # Method index
    # ------------------------------------------------------------------

    def _build_method_index(self) -> Dict[str, List[str]]:
        index: Dict[str, List[str]] = {}
        for section in SDK_SECTIONS:
            obj = getattr(self.dashboard, section, None)
            if obj is None:
                continue
            methods = sorted(
                m for m in dir(obj)
                if not m.startswith("_") and callable(getattr(obj, m))
            )
            if methods:
                index[section] = methods
        return index

    # ------------------------------------------------------------------
    # Core API caller (sync — run via asyncio.to_thread)
    # ------------------------------------------------------------------

    def _call_sync(self, section: str, method: str, params: Dict) -> str:
        original_params = params.copy()
        pagination_limited = False

        try:
            section_obj = getattr(self.dashboard, section, None)
            if section_obj is None:
                return json.dumps({"error": f"Invalid section '{section}'", "available_sections": SDK_SECTIONS}, indent=2)

            method_func = getattr(section_obj, method, None)
            if method_func is None or not callable(method_func):
                return json.dumps({"error": f"Method '{method}' not found in section '{section}'"}, indent=2)

            is_read = _is_read(method)
            is_write = _is_write(method)

            # Auto-fill org ID
            sig = inspect.signature(method_func)
            if "organizationId" in sig.parameters and "organizationId" not in params and self.org_id:
                params["organizationId"] = self.org_id

            # Pagination limits
            params, pagination_limited = _enforce_pagination(params)

            # Cache check
            if ENABLE_CACHING and is_read:
                key = _cache_key(section, method, params)
                cached = _cache.get(key)
                if cached is not None:
                    if isinstance(cached, dict):
                        cached["_from_cache"] = True
                    return json.dumps(cached, indent=2)

            # Execute
            result = method_func(**params)

            # Invalidate section cache after writes
            if ENABLE_CACHING and is_write:
                _cache.invalidate(section)

            # Large response handling
            result_json = json.dumps(result)
            tokens = _estimate_tokens(result_json)

            if ENABLE_FILE_CACHING and tokens > MAX_RESPONSE_TOKENS:
                fp = _save_to_file(result, section, method, original_params)
                resp = _truncated_response(result, fp, section, method, original_params)
                if pagination_limited:
                    resp["_pagination_limited"] = True
                if ENABLE_CACHING and is_read:
                    _cache.set(_cache_key(section, method, params), resp)
                return json.dumps(resp, indent=2)

            response_data = result
            if pagination_limited and isinstance(response_data, dict):
                response_data["_pagination_limited"] = True

            if ENABLE_CACHING and is_read:
                _cache.set(_cache_key(section, method, params), response_data)

            return json.dumps(response_data, indent=2)

        except meraki.exceptions.APIError as e:
            return json.dumps({"error": "Meraki API Error", "message": str(e), "status": getattr(e, "status", "unknown")}, indent=2)
        except TypeError as e:
            return json.dumps({"error": "Invalid parameters", "message": str(e), "hint": f"Use get_method_info(section='{section}', method='{method}')"}, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e), "type": type(e).__name__}, indent=2)

    async def _call_async(self, section: str, method: str, params: Dict) -> str:
        """Async wrapper with AIOps Hub security & audit middleware."""
        is_write = _is_write(method)

        # Security check via AIOps Hub's database-driven edit mode
        if is_write:
            try:
                http_method = "POST"  # writes map to POST/PUT/DELETE
                await self.security_middleware.enforce_security(
                    method=http_method,
                    operation_id=method,
                    path=f"/meraki/{section}/{method}",
                )
            except PermissionError as e:
                await self.audit_logger.log_operation(
                    method=http_method,
                    path=f"/meraki/{section}/{method}",
                    operation_id=method,
                    error_message=str(e),
                )
                return json.dumps({
                    "error": str(e),
                    "type": "PermissionError",
                    "edit_mode_required": True,
                }, indent=2)

        # Execute
        result = await asyncio.to_thread(self._call_sync, section, method, params)

        # Audit log
        await self.audit_logger.log_operation(
            method="READ" if _is_read(method) else "WRITE",
            path=f"/meraki/{section}/{method}",
            operation_id=method,
            response_status=200,
        )

        return result

    # ------------------------------------------------------------------
    # Tool registration
    # ------------------------------------------------------------------

    def _register_tools(self) -> None:
        server = self

        # === Generic API caller (all 800+ endpoints) ===

        @self.mcp.tool()
        async def call_meraki_api(
            section: str,
            method: str,
            parameters: Dict[str, Any] = Field(
                default_factory=dict,
                json_schema_extra={"type": "object", "additionalProperties": True},
            ),
        ) -> str:
            """
            Call any Meraki API method — provides access to all 800+ endpoints.

            Args:
                section: SDK section (organizations, networks, wireless, switch, appliance, camera, devices, sensor, sm, etc.)
                method: Method name (e.g., getOrganizationAdmins, updateNetworkWirelessSsid)
                parameters: Dict of parameters (e.g., {"networkId": "L_123", "name": "MySSID"})

            Examples:
                call_meraki_api(section="organizations", method="getOrganizationAdmins", parameters={"organizationId": "123456"})
                call_meraki_api(section="wireless", method="updateNetworkWirelessSsid", parameters={"networkId": "L_123", "number": "0", "name": "NewSSID"})
            """
            return await server._call_async(section, method, parameters)

        # === Think tool (zero-cost reasoning for MCP clients) ===

        @self.mcp.tool()
        async def think(thought: str = Field(description="Your reasoning, analysis, or plan for next steps")) -> str:
            """Use this tool to reason step-by-step between API calls during investigations.
            Analyze results, form hypotheses, plan next queries, and cross-reference data.
            This tool is free (no API cost). Use it after receiving results from data-gathering tools."""
            return json.dumps({"success": True, "thought": thought})

        # === Pre-registered convenience tools ===

        @self.mcp.tool()
        async def getOrganizations() -> str:
            """Get all Meraki organizations accessible with the current API key.
            Returns org ID, name, and management URL. Call this FIRST to discover
            available organizations — most other API calls require an organizationId."""
            return await server._call_async("organizations", "getOrganizations", {})

        @self.mcp.tool()
        async def getOrganizationAdmins(organizationId: str = None) -> str:
            """Get administrators for a Meraki organization. Returns admin name, email,
            role, and access permissions. Use to audit admin access or find specific admin details."""
            params = {"organizationId": organizationId} if organizationId else {}
            return await server._call_async("organizations", "getOrganizationAdmins", params)

        @self.mcp.tool()
        async def getOrganizationNetworks(organizationId: str = None) -> str:
            """Get all networks in a Meraki organization. Returns network ID, name, type,
            tags, and timezone. Use to find a specific network by name — network IDs are
            required for most device and configuration queries."""
            params = {"organizationId": organizationId} if organizationId else {}
            return await server._call_async("organizations", "getOrganizationNetworks", params)

        @self.mcp.tool()
        async def getOrganizationDevices(organizationId: str = None) -> str:
            """Get all devices across a Meraki organization. Returns serial, model, name,
            network ID, and status for every device. Use for org-wide device inventory
            or to find a specific device across all networks."""
            params = {"organizationId": organizationId} if organizationId else {}
            return await server._call_async("organizations", "getOrganizationDevices", params)

        @self.mcp.tool()
        async def getNetwork(networkId: str) -> str:
            """Get details for a specific Meraki network. Returns name, type, timezone,
            tags, and enrollment string. Use to verify network details before making changes."""
            return await server._call_async("networks", "getNetwork", {"networkId": networkId})

        @self.mcp.tool()
        async def getNetworkClients(networkId: str, timespan: int = 86400) -> str:
            """Get clients connected to a Meraki network within a timespan. Returns client
            MAC, IP, description, usage, VLAN, and connection type. Default timespan is 24h.
            Use to investigate client connectivity or find specific devices on the network."""
            return await server._call_async("networks", "getNetworkClients", {"networkId": networkId, "timespan": timespan})

        @self.mcp.tool()
        async def getNetworkEvents(networkId: str, productType: str = None, perPage: int = 100) -> str:
            """Get event log for a Meraki network. Returns timestamped events including
            device status changes, client connections, and configuration changes. Filter by
            productType (wireless, appliance, switch, camera). Critical for troubleshooting
            — shows what happened and when."""
            params: Dict[str, Any] = {"networkId": networkId, "perPage": perPage}
            if productType:
                params["productType"] = productType
            return await server._call_async("networks", "getNetworkEvents", params)

        @self.mcp.tool()
        async def getNetworkDevices(networkId: str) -> str:
            """Get all devices in a specific Meraki network. Returns serial, model, name,
            MAC, LAN IP, and firmware for each device. Use to find device serials needed
            for device-specific queries like getDevice or getDeviceSwitchPorts."""
            return await server._call_async("networks", "getNetworkDevices", {"networkId": networkId})

        @self.mcp.tool()
        async def getDevice(serial: str) -> str:
            """Get detailed info for a Meraki device by serial number. Returns status,
            model, name, LAN IP, public IP, firmware, tags, and location. Check status
            field to determine if device is online/offline."""
            return await server._call_async("devices", "getDevice", {"serial": serial})

        @self.mcp.tool()
        async def getNetworkWirelessSsids(networkId: str) -> str:
            """Get all SSIDs configured on a wireless network. Returns SSID name, number,
            enabled status, auth mode, encryption, and VLAN tag. Check when investigating
            WiFi access issues — disabled SSIDs or wrong auth mode are common causes."""
            return await server._call_async("wireless", "getNetworkWirelessSsids", {"networkId": networkId})

        @self.mcp.tool()
        async def getDeviceSwitchPorts(serial: str) -> str:
            """Get all switch ports for a Meraki switch by serial. Returns port ID, name,
            enabled status, type (access/trunk), VLAN, voice VLAN, and PoE status.
            Use to investigate port configuration or find specific VLAN assignments."""
            return await server._call_async("switch", "getDeviceSwitchPorts", {"serial": serial})

        @self.mcp.tool()
        async def updateDeviceSwitchPort(
            serial: str,
            portId: str,
            name: str = None,
            enabled: bool = None,
            poeEnabled: bool = None,
            type: str = None,
            vlan: int = None,
            voiceVlan: int = None,
        ) -> str:
            """Update switch port configuration. Set VLAN, enable/disable port, change
            type (access/trunk), toggle PoE, or rename. For the full parameter set
            use call_meraki_api."""
            params: Dict[str, Any] = {"serial": serial, "portId": portId}
            for k, v in {"name": name, "enabled": enabled, "poeEnabled": poeEnabled, "type": type, "vlan": vlan, "voiceVlan": voiceVlan}.items():
                if v is not None:
                    params[k] = v
            return await server._call_async("switch", "updateDeviceSwitchPort", params)

        # === Discovery tools ===

        @self.mcp.tool()
        async def list_all_methods(section: str = None) -> str:
            """List all available Meraki API methods.

            Args:
                section: Optional section filter (organizations, networks, wireless, switch, appliance, etc.)
            """
            if section:
                if section not in server._method_index:
                    return json.dumps({"error": f"Section '{section}' not found", "available_sections": list(server._method_index.keys())}, indent=2)
                show = {section: server._method_index[section]}
            else:
                show = server._method_index
            return json.dumps({"sections": show, "total_methods": sum(len(v) for v in show.values()), "usage": "call_meraki_api(section='...', method='...', parameters={...})"}, indent=2)

        @self.mcp.tool()
        async def search_methods(keyword: str) -> str:
            """Search for Meraki API methods by keyword.

            Args:
                keyword: Search term (e.g., 'admin', 'firewall', 'ssid', 'event')
            """
            kw = keyword.lower()
            results = {s: [m for m in ms if kw in m.lower()] for s, ms in server._method_index.items()}
            results = {k: v for k, v in results.items() if v}
            return json.dumps({"keyword": keyword, "results": results, "total_matches": sum(len(v) for v in results.values())}, indent=2)

        @self.mcp.tool()
        async def get_method_info(section: str, method: str) -> str:
            """Get detailed parameter information for a Meraki API method.

            Args:
                section: SDK section (e.g., 'organizations', 'networks')
                method: Method name (e.g., 'getOrganizationAdmins')
            """
            obj = getattr(server.dashboard, section, None)
            if obj is None:
                return json.dumps({"error": f"Section '{section}' not found"}, indent=2)
            func = getattr(obj, method, None)
            if func is None:
                return json.dumps({"error": f"Method '{method}' not found in '{section}'"}, indent=2)
            sig = inspect.signature(func)
            params = {}
            for pn, p in sig.parameters.items():
                if pn == "self":
                    continue
                params[pn] = {"required": p.default == inspect.Parameter.empty, "default": None if p.default == inspect.Parameter.empty else str(p.default)}
            return json.dumps({"section": section, "method": method, "parameters": params, "docstring": inspect.getdoc(func)}, indent=2)

        # === Cache management tools ===

        @self.mcp.tool()
        async def cache_stats() -> str:
            """Get cache statistics and configuration"""
            stats = _cache.stats()
            edit_mode = await server.security_middleware.is_edit_mode_enabled()
            stats["read_only_mode"] = not edit_mode
            return json.dumps(stats, indent=2)

        @self.mcp.tool()
        async def cache_clear() -> str:
            """Clear all cached data"""
            _cache.clear()
            return json.dumps({"status": "success", "message": "Cache cleared"}, indent=2)

        @self.mcp.tool()
        async def get_mcp_config() -> str:
            """Get MCP server configuration"""
            edit_mode = await server.security_middleware.is_edit_mode_enabled()
            return json.dumps({
                "mode": "Cisco AIOps Hub Meraki Magic (hybrid)",
                "description": "12 pre-registered tools + call_meraki_api for full API access",
                "total_available_methods": sum(len(v) for v in server._method_index.values()),
                "read_only_mode": not edit_mode,
                "caching_enabled": ENABLE_CACHING,
                "cache_ttl_seconds": CACHE_TTL_SECONDS,
                "file_caching_enabled": ENABLE_FILE_CACHING,
                "max_response_tokens": MAX_RESPONSE_TOKENS,
                "organization_id_configured": bool(server.org_id),
                "api_key_configured": bool(server.api_key),
                "lumen_integration": True,
            }, indent=2)

        @self.mcp.tool()
        async def get_cached_response(filepath: str, offset: int = 0, limit: int = 10) -> str:
            """Retrieve a paginated slice of a cached large response.

            Args:
                filepath: Path to the cached response file
                offset: Starting index for pagination (default: 0)
                limit: Maximum items to return (default: 10, max: 100)
            """
            try:
                if limit > 100:
                    limit = 100
                _validate_filepath(filepath)
                data = _load_from_file(filepath)
                if data is None:
                    return json.dumps({"error": "Could not load cached response", "filepath": filepath}, indent=2)
                if isinstance(data, list):
                    total = len(data)
                    page = data[offset:offset + limit]
                    return json.dumps({
                        "_paginated": True, "_total_items": total, "_offset": offset,
                        "_limit": limit, "_returned_items": len(page),
                        "_has_more": (offset + limit) < total,
                        "data": page,
                    }, indent=2)
                return json.dumps(data, indent=2)
            except ValueError as e:
                return json.dumps({"error": str(e)}, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        logger.info("Meraki Magic MCP: registered all tools (think + 12 convenience + call_meraki_api + discovery + cache)")

    # ------------------------------------------------------------------
    # Cross-platform tool registration (ThousandEyes + Splunk)
    # ------------------------------------------------------------------

    async def _load_cross_platform_credentials(self) -> Dict[str, Any]:
        """Load TE/Splunk credentials from database. Returns dict of available platforms."""
        creds: Dict[str, Any] = {}
        try:
            from src.config.database import get_async_session
            async with get_async_session() as session:
                from sqlalchemy import text
                # Load ThousandEyes OAuth token
                result = await session.execute(
                    text("SELECT value FROM system_config WHERE key = 'thousandeyes_oauth_token' LIMIT 1")
                )
                row = result.fetchone()
                if row and row[0]:
                    creds["thousandeyes"] = {"oauth_token": row[0]}
                # Load Splunk credentials
                result = await session.execute(
                    text("SELECT value FROM system_config WHERE key = 'splunk_base_url' LIMIT 1")
                )
                splunk_url_row = result.fetchone()
                result = await session.execute(
                    text("SELECT value FROM system_config WHERE key = 'splunk_token' LIMIT 1")
                )
                splunk_token_row = result.fetchone()
                if splunk_url_row and splunk_url_row[0] and splunk_token_row and splunk_token_row[0]:
                    creds["splunk"] = {"base_url": splunk_url_row[0], "token": splunk_token_row[0]}
        except Exception as e:
            logger.warning(f"[MCP] Could not load cross-platform credentials: {e}")
        return creds

    def _register_thousandeyes_tools(self, te_creds: Dict[str, str]) -> None:
        """Register ThousandEyes tools using the service layer."""
        server = self

        @self.mcp.tool()
        async def thousandeyes_list_alerts(active_only: bool = True) -> str:
            """List active ThousandEyes alerts indicating performance degradation or outages.
            Check this FIRST in any troubleshooting workflow — shows external monitoring perspective."""
            try:
                from src.services.thousandeyes_service import ThousandEyesClient
                client = ThousandEyesClient(oauth_token=te_creds["oauth_token"])
                result = await client.get_alerts(active_only=active_only)
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"ThousandEyes query failed: {str(e)}"})

        @self.mcp.tool()
        async def thousandeyes_list_tests() -> str:
            """List all ThousandEyes monitoring tests. Returns test ID, name, type, and target.
            Use to discover available tests before querying results."""
            try:
                from src.services.thousandeyes_service import ThousandEyesClient
                client = ThousandEyesClient(oauth_token=te_creds["oauth_token"])
                result = await client.get_tests()
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"ThousandEyes query failed: {str(e)}"})

        @self.mcp.tool()
        async def thousandeyes_get_test_results(test_id: str) -> str:
            """Get results for a ThousandEyes test. Returns latency, loss, jitter, and availability.
            Use after finding test ID from thousandeyes_list_tests."""
            try:
                from src.services.thousandeyes_service import ThousandEyesClient
                client = ThousandEyesClient(oauth_token=te_creds["oauth_token"])
                result = await client.get_test_results(test_id)
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"ThousandEyes query failed: {str(e)}"})

        @self.mcp.tool()
        async def thousandeyes_get_path_visualization(test_id: str) -> str:
            """Get hop-by-hop path visualization for a ThousandEyes test.
            Shows internet/WAN path — complementary to Catalyst path trace which shows internal path."""
            try:
                from src.services.thousandeyes_service import ThousandEyesClient
                client = ThousandEyesClient(oauth_token=te_creds["oauth_token"])
                result = await client.get_path_visualization(test_id)
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"ThousandEyes query failed: {str(e)}"})

        @self.mcp.tool()
        async def thousandeyes_get_http_results(test_id: str) -> str:
            """Get HTTP availability and response time for a ThousandEyes HTTP test.
            Shows if web services are reachable from external vantage points."""
            try:
                from src.services.thousandeyes_service import ThousandEyesClient
                client = ThousandEyesClient(oauth_token=te_creds["oauth_token"])
                result = await client.get_http_results(test_id)
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"ThousandEyes query failed: {str(e)}"})

    def _register_splunk_tools(self, splunk_creds: Dict[str, str]) -> None:
        """Register Splunk tools using the service layer."""
        server = self

        @self.mcp.tool()
        async def splunk_run_search(query: str, earliest_time: str = "-1h", latest_time: str = "now") -> str:
            """Run a Splunk SPL search query. Returns matching events with timestamps and fields.
            Use for log correlation during troubleshooting — find events matching alert timestamps."""
            try:
                from src.services.splunk_service import SplunkClient
                client = SplunkClient(base_url=splunk_creds["base_url"], token=splunk_creds["token"])
                result = await client.run_search(query, earliest_time=earliest_time, latest_time=latest_time)
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"Splunk query failed: {str(e)}"})

        @self.mcp.tool()
        async def splunk_list_saved_searches() -> str:
            """List saved searches in Splunk. Returns search name, query, and schedule.
            Use to discover available reports and dashboards."""
            try:
                from src.services.splunk_service import SplunkClient
                client = SplunkClient(base_url=splunk_creds["base_url"], token=splunk_creds["token"])
                result = await client.get_saved_searches()
                return json.dumps(result, default=str)
            except Exception as e:
                return json.dumps({"success": False, "error": f"Splunk query failed: {str(e)}"})

    async def register_cross_platform_tools(self) -> None:
        """Load credentials and conditionally register TE/Splunk tools."""
        cross_platform_creds = await self._load_cross_platform_credentials()

        if "thousandeyes" in cross_platform_creds:
            self._register_thousandeyes_tools(cross_platform_creds["thousandeyes"])
            logger.info("[MCP] ThousandEyes tools registered (5 tools)")
        else:
            logger.info("[MCP] ThousandEyes tools skipped — no credentials configured")

        if "splunk" in cross_platform_creds:
            self._register_splunk_tools(cross_platform_creds["splunk"])
            logger.info("[MCP] Splunk tools registered (2 tools)")
        else:
            logger.info("[MCP] Splunk tools skipped — no credentials configured")

    # ------------------------------------------------------------------
    # Run
    # ------------------------------------------------------------------

    async def run(self) -> None:
        """Run the MCP server via stdio transport."""
        edit_mode = await self.security_middleware.is_edit_mode_enabled()
        logger.info(f"Edit mode (from database): {'ENABLED' if edit_mode else 'DISABLED (read-only)'}")

        # Register cross-platform tools (TE/Splunk) if credentials are available
        await self.register_cross_platform_tools()

        logger.info("Starting Cisco AIOps Hub Meraki Magic MCP server via stdio...")

        # FastMCP.run() is blocking — run it in the current event loop
        self.mcp.run(transport="stdio")
