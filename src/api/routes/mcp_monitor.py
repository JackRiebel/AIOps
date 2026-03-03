"""MCP Server Monitoring — register, discover, and monitor MCP servers."""

from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import HTMLResponse
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import asyncio
import json
import logging
import time
import uuid as uuid_mod
from datetime import datetime

from src.api.dependencies import require_viewer, require_editor, require_admin
from src.services.config_service import get_config_service
from src.api.routes.ai_endpoint_monitor import (
    _te_make_request,
    _get_available_agents,
    _validate_te,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcp-monitor", tags=["MCP Monitor"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CONFIG_KEY_SERVERS = "mcp_servers"
CONFIG_KEY_EVENTS = "mcp_events"
DISCOVERY_CACHE_TTL = 300  # 5 minutes

SENSITIVE_TOOL_KEYWORDS = {"exec", "file", "shell", "network", "database", "delete"}

# ---------------------------------------------------------------------------
# Module-level discovery cache: server_id -> {"data": ..., "expires": ...}
# ---------------------------------------------------------------------------

_discovery_cache: Dict[str, Dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class MCPServerConfig(BaseModel):
    name: str
    endpoint_url: str
    auth_type: Optional[str] = None  # "bearer" | "api_key" | "oauth" | "none"
    auth_token: Optional[str] = None
    description: Optional[str] = None
    verify_ssl: bool = True  # Disable for self-signed certs (e.g. Splunk localhost)


class MCPToolValidateRequest(BaseModel):
    tool_name: str
    test_payload: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_servers() -> List[Dict[str, Any]]:
    """Load registered MCP servers from system_config."""
    config_svc = get_config_service()
    raw = await config_svc.get_config(CONFIG_KEY_SERVERS)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


async def _save_servers(servers: List[Dict[str, Any]]) -> None:
    """Persist the MCP server list to system_config."""
    config_svc = get_config_service()
    await config_svc.set_config(CONFIG_KEY_SERVERS, json.dumps(servers))


async def _get_server_by_id(server_id: str) -> Optional[Dict[str, Any]]:
    """Find a registered server by ID."""
    servers = await _get_servers()
    for s in servers:
        if s.get("id") == server_id:
            return s
    return None


async def _get_auth_token(server_id: str) -> Optional[str]:
    """Retrieve the stored auth token for a server."""
    config_svc = get_config_service()
    return await config_svc.get_config(f"mcp_auth_{server_id}")


async def _save_auth_token(server_id: str, token: str) -> None:
    """Store an auth token for a server (encrypted via config_service)."""
    config_svc = get_config_service()
    await config_svc.set_config(f"mcp_auth_{server_id}", token, is_sensitive=True)


async def _delete_auth_token(server_id: str) -> None:
    """Remove the stored auth token for a server."""
    config_svc = get_config_service()
    try:
        await config_svc.set_config(f"mcp_auth_{server_id}", "")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# OAuth support for MCP servers (e.g. Cloudflare, GitHub)
# Uses the MCP SDK's built-in OAuthClientProvider with PKCE.
# ---------------------------------------------------------------------------

# Pending OAuth flows: flow_id -> {event, auth_url, code, state, server_id}
_pending_oauth_flows: Dict[str, Dict[str, Any]] = {}


class _MCPTokenStorage:
    """TokenStorage implementation backed by config_service."""

    def __init__(self, server_id: str):
        self.server_id = server_id
        self._prefix = f"mcp_oauth_{server_id}"

    async def get_tokens(self):
        from mcp.shared.auth import OAuthToken
        config_svc = get_config_service()
        raw = await config_svc.get_config(f"{self._prefix}_tokens")
        if not raw:
            return None
        try:
            return OAuthToken.model_validate_json(raw)
        except Exception:
            return None

    async def set_tokens(self, tokens) -> None:
        config_svc = get_config_service()
        await config_svc.set_config(
            f"{self._prefix}_tokens", tokens.model_dump_json(), is_sensitive=True
        )

    async def get_client_info(self):
        from mcp.shared.auth import OAuthClientInformationFull
        config_svc = get_config_service()
        raw = await config_svc.get_config(f"{self._prefix}_client")
        if not raw:
            return None
        try:
            return OAuthClientInformationFull.model_validate_json(raw)
        except Exception:
            return None

    async def set_client_info(self, client_info) -> None:
        config_svc = get_config_service()
        await config_svc.set_config(
            f"{self._prefix}_client", client_info.model_dump_json(), is_sensitive=True
        )


async def _build_oauth_auth(
    server_id: str, endpoint_url: str, callback_base_url: str,
) -> tuple:
    """Build an OAuthClientProvider for the given server. Returns (auth, flow_id)."""
    from mcp.client.auth import OAuthClientProvider, OAuthClientMetadata

    flow_id = uuid_mod.uuid4().hex[:16]
    flow = {
        "event": asyncio.Event(),
        "auth_url": None,
        "code": None,
        "state": None,
        "server_id": server_id,
    }
    _pending_oauth_flows[flow_id] = flow

    redirect_uri = f"{callback_base_url}/api/mcp-monitor/oauth/callback?flow={flow_id}"

    async def redirect_handler(auth_url: str) -> None:
        flow["auth_url"] = auth_url
        logger.info("OAuth redirect URL for server %s: %s", server_id, auth_url)

    async def callback_handler() -> tuple[str, str | None]:
        # Wait for the user to complete the OAuth flow (up to 5 min)
        try:
            await asyncio.wait_for(flow["event"].wait(), timeout=300)
        except asyncio.TimeoutError:
            raise TimeoutError("OAuth authorization timed out (5 min)")
        return flow["code"], flow["state"]

    storage = _MCPTokenStorage(server_id)
    client_metadata = OAuthClientMetadata(
        redirect_uris=[redirect_uri],
        token_endpoint_auth_method="none",
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        client_name="Lumen Network Intelligence",
        # Leave scope=None so the server decides what to grant.
        # The MCP SDK only validates scopes if both requested and returned are set,
        # so None lets Cloudflare (etc.) grant whatever scopes the user authorizes.
    )

    auth = OAuthClientProvider(
        server_url=endpoint_url,
        client_metadata=client_metadata,
        storage=storage,
        redirect_handler=redirect_handler,
        callback_handler=callback_handler,
        timeout=300.0,
    )

    return auth, flow_id


async def _log_mcp_event(
    server_id: str,
    server_name: str,
    event_type: str,
    severity: str,
    message: str,
) -> None:
    """Append an event to the MCP event log."""
    import json as json_mod
    import uuid

    config_svc = get_config_service()

    events_raw = await config_svc.get_config(CONFIG_KEY_EVENTS)
    events = json_mod.loads(events_raw) if events_raw else []

    events.append(
        {
            "id": uuid.uuid4().hex[:12],
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "server_id": server_id,
            "server_name": server_name,
            "event_type": event_type,
            "severity": severity,
            "message": message,
        }
    )

    # Keep only last 200 events
    events = events[-200:]
    await config_svc.set_config(CONFIG_KEY_EVENTS, json_mod.dumps(events))


def _is_localhost_url(url: str) -> bool:
    return any(h in url for h in ("://localhost", "://127.0.0.1", "://0.0.0.0", "://[::1]"))


async def _get_splunk_session_token() -> Optional[str]:
    """Try to get a Splunk session key using stored credentials.

    Splunk MCP requires an encrypted token OR a valid session key.
    We try to login with stored username/password to get a session key.
    """
    try:
        import httpx

        config_svc = get_config_service()
        username = await config_svc.get_config("splunk_username")
        password = await config_svc.get_config("splunk_password")
        host = await config_svc.get_config("splunk_api_url") or await config_svc.get_config("splunk_host")

        if not username or not password or not host:
            return None

        # Normalize host to have the management port
        if not host.startswith("http"):
            host = f"https://{host}"
        # Splunk management API is typically on :8089
        from urllib.parse import urlparse
        parsed = urlparse(host)
        mgmt_host = f"https://{parsed.hostname}:{parsed.port or 8089}"

        async with httpx.AsyncClient(verify=False, timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(
                f"{mgmt_host}/services/auth/login?output_mode=json",
                data={"username": username, "password": password},
            )
            if resp.status_code == 200:
                data = resp.json()
                session_key = data.get("sessionKey")
                if session_key:
                    logger.info("Got Splunk session key from stored credentials")
                    return session_key
    except Exception as e:
        logger.debug("Failed to get Splunk session key: %s", e)
    return None


def _build_auth_headers(auth_token: Optional[str], auth_type: str = "bearer") -> dict:
    """Build Authorization header using the appropriate format."""
    if not auth_token:
        return {}
    if auth_type == "splunk":
        return {"Authorization": f"Splunk {auth_token}"}
    return {"Authorization": f"Bearer {auth_token}"}


async def _preflight_check(
    url: str, headers: dict, verify_ssl: bool, is_local: bool
) -> tuple[str, dict, bool, Optional[Dict[str, Any]]]:
    """Run pre-flight connectivity check. Returns (actual_url, headers, verify_ssl, error_or_None).

    Uses POST with a JSON-RPC initialize probe (MCP endpoints are POST-only).
    For localhost HTTPS endpoints that fail, tries HTTP fallback.
    For auth failures with Bearer, tries Splunk auth format.
    """
    import httpx

    # Minimal MCP initialize probe — just enough to test connectivity + auth
    _MCP_PROBE = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "lumen-preflight", "version": "0.1"},
        },
        "id": 0,
    }

    async def _try_post(probe_url: str, probe_headers: dict, verify: bool):
        all_headers = {**probe_headers, "Content-Type": "application/json"}
        async with httpx.AsyncClient(
            verify=verify, timeout=httpx.Timeout(10.0), follow_redirects=True
        ) as probe:
            return await probe.post(probe_url, json=_MCP_PROBE, headers=all_headers)

    def _is_auth_error(resp) -> bool:
        """Check if response indicates an authentication failure."""
        if resp.status_code in (401, 403):
            return True
        # Splunk MCP returns 200 with JSON-RPC error for auth failures
        try:
            body = resp.json()
            err_msg = str(body.get("error", {}).get("message", "")).lower()
            if "auth" in err_msg or "token" in err_msg or "unauthorized" in err_msg:
                return True
        except Exception:
            pass
        return False

    def _extract_auth_message(resp) -> str:
        """Extract a useful auth error message from the response."""
        try:
            body = resp.json()
            err_msg = body.get("error", {}).get("message", "")
            if err_msg:
                return err_msg
        except Exception:
            pass
        return f"HTTP {resp.status_code}"

    async def _try_with_auth_fallbacks(probe_url: str, probe_headers: dict, verify: bool):
        """Try original headers, then Splunk auth format if Bearer fails."""
        resp = await _try_post(probe_url, probe_headers, verify)
        logger.info(
            "MCP pre-flight %s → %s (content-type: %s)",
            probe_url, resp.status_code, resp.headers.get("content-type", "unknown"),
        )

        if _is_auth_error(resp) and "Bearer" in probe_headers.get("Authorization", ""):
            # Try Splunk token format: "Authorization: Splunk <token>"
            token = probe_headers["Authorization"].removeprefix("Bearer ").strip()
            splunk_headers = {"Authorization": f"Splunk {token}"}
            try:
                resp2 = await _try_post(probe_url, splunk_headers, verify)
                logger.info("MCP pre-flight Bearer→Splunk auth fallback %s → %s", probe_url, resp2.status_code)
                if not _is_auth_error(resp2):
                    return resp2, splunk_headers, None
            except Exception:
                pass

            # For Splunk endpoints, try stored MCP credentials
            if _is_localhost_url(probe_url) or "8089" in probe_url or "/services/mcp" in probe_url:
                config_svc = get_config_service()

                # Try splunk_mcp_token (encrypted MCP token) — Bearer auth
                mcp_token = await config_svc.get_config("splunk_mcp_token")
                if mcp_token:
                    mcp_token_headers = {"Authorization": f"Bearer {mcp_token}"}
                    try:
                        resp_mcp = await _try_post(probe_url, mcp_token_headers, verify)
                        logger.info("MCP pre-flight splunk_mcp_token fallback %s → %s", probe_url, resp_mcp.status_code)
                        if not _is_auth_error(resp_mcp):
                            return resp_mcp, mcp_token_headers, None
                    except Exception:
                        pass

                # Try session key from stored credentials
                session_key = await _get_splunk_session_token()
                if session_key:
                    splunk_session_headers = {"Authorization": f"Splunk {session_key}"}
                    try:
                        resp3 = await _try_post(probe_url, splunk_session_headers, verify)
                        logger.info("MCP pre-flight Splunk session key fallback %s → %s", probe_url, resp3.status_code)
                        if not _is_auth_error(resp3):
                            return resp3, splunk_session_headers, None
                    except Exception:
                        pass

            auth_detail = _extract_auth_message(resp)
            return resp, probe_headers, {
                "error": f"Authentication failed for {probe_url}: {auth_detail}. "
                         "The token may be invalid or expired. Try rotating tokens in the Splunk MCP settings.",
                "status": "disconnected",
            }

        if _is_auth_error(resp):
            auth_detail = _extract_auth_message(resp)
            return resp, probe_headers, {
                "error": f"Authentication failed for {probe_url}: {auth_detail}",
                "status": "disconnected",
            }

        return resp, probe_headers, None

    # --- Attempt 1: original URL ---
    try:
        _resp, final_headers, auth_err = await _try_with_auth_fallbacks(url, headers, verify_ssl)
        if auth_err:
            return url, headers, verify_ssl, auth_err
        return url, final_headers, verify_ssl, None

    except (httpx.ConnectError, Exception) as first_err:
        # For localhost HTTPS, try HTTP fallback
        if is_local and url.startswith("https://"):
            http_url = url.replace("https://", "http://", 1)
            try:
                _resp, final_headers, auth_err = await _try_with_auth_fallbacks(http_url, headers, False)
                if auth_err:
                    return http_url, headers, False, auth_err
                return http_url, final_headers, False, None
            except Exception:
                pass
            return url, headers, verify_ssl, {
                "error": f"Cannot connect to {url} (tried HTTPS and HTTP): {_unwrap_exception(first_err)}",
                "status": "disconnected",
            }
        if isinstance(first_err, httpx.ConnectError):
            return url, headers, verify_ssl, {
                "error": f"Cannot connect to {url}: {first_err}. Is the server running?",
                "status": "disconnected",
            }
        return url, headers, verify_ssl, {
            "error": f"Connection pre-check failed for {url}: {_unwrap_exception(first_err)}",
            "status": "disconnected",
        }


async def _discover_mcp_server(
    endpoint_url: str, auth_token: Optional[str] = None, verify_ssl: bool = True,
    skip_preflight: bool = False, oauth_auth: Any = None,
) -> Dict[str, Any]:
    """Attempt MCP discovery via streamable HTTP transport.

    If ``oauth_auth`` is provided (an httpx.Auth / OAuthClientProvider), it is
    passed directly to ``streamablehttp_client`` and headers-based auth is skipped.
    """
    try:
        import httpx
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        # For localhost, always disable SSL verification (self-signed certs).
        is_local = _is_localhost_url(endpoint_url)
        if is_local:
            verify_ssl = False

        actual_url = endpoint_url
        connect_headers: dict = {}

        if oauth_auth is None:
            # Standard header-based auth
            connect_headers = _build_auth_headers(auth_token)

            if not skip_preflight:
                actual_url, connect_headers, verify_ssl, preflight_err = await _preflight_check(
                    endpoint_url, connect_headers, verify_ssl, is_local
                )
                if preflight_err:
                    return preflight_err

        # Build a custom httpx client factory that honours verify_ssl.
        effective_verify = verify_ssl

        def _httpx_factory(
            headers: dict[str, str] | None = None,
            timeout: httpx.Timeout | None = None,
            auth: httpx.Auth | None = None,
        ) -> httpx.AsyncClient:
            kwargs: dict[str, Any] = {"follow_redirects": True, "verify": effective_verify}
            if timeout is not None:
                kwargs["timeout"] = timeout
            else:
                kwargs["timeout"] = httpx.Timeout(30.0)
            if headers is not None:
                kwargs["headers"] = headers
            if auth is not None:
                kwargs["auth"] = auth
            return httpx.AsyncClient(**kwargs)

        # Use auth= for OAuth, headers= for token-based
        client_kwargs: dict[str, Any] = {"httpx_client_factory": _httpx_factory}
        if oauth_auth is not None:
            client_kwargs["auth"] = oauth_auth
        else:
            client_kwargs["headers"] = connect_headers

        async with streamablehttp_client(actual_url, **client_kwargs) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                tools_result = await session.list_tools()

                # list_resources / list_prompts are optional — not all servers support them
                resources_list = []
                prompts_list = []
                try:
                    resources_result = await session.list_resources()
                    resources_list = [
                        {
                            "uri": str(r.uri),
                            "name": r.name,
                            "description": r.description,
                            "mime_type": r.mimeType,
                        }
                        for r in resources_result.resources
                    ]
                except Exception:
                    pass
                try:
                    prompts_result = await session.list_prompts()
                    prompts_list = [
                        {"name": p.name, "description": p.description}
                        for p in prompts_result.prompts
                    ]
                except Exception:
                    pass

                return {
                    "tools": [
                        {
                            "name": t.name,
                            "description": t.description or "",
                            "input_schema": t.inputSchema or {},
                        }
                        for t in tools_result.tools
                    ],
                    "resources": resources_list,
                    "prompts": prompts_list,
                    "status": "connected",
                    "actual_url": actual_url,
                }
    except ImportError:
        return {
            "error": "MCP SDK not installed. Install with: pip install mcp",
            "status": "disconnected",
        }
    except BaseException as e:
        detail = _unwrap_exception(e)
        return {"error": detail, "status": "disconnected"}


def _unwrap_exception(exc: BaseException) -> str:
    """Extract a useful error message, unwrapping ExceptionGroup if needed."""
    # Python 3.11+ ExceptionGroup from asyncio.TaskGroup
    if isinstance(exc, BaseExceptionGroup):
        msgs = []
        for sub in exc.exceptions:
            msgs.append(_unwrap_exception(sub))
        return "; ".join(msgs)
    msg = str(exc)
    # Add the exception type for clarity when the message is vague
    type_name = type(exc).__name__
    if type_name not in msg:
        msg = f"{type_name}: {msg}"
    return msg


def _should_verify_ssl(server: Dict[str, Any]) -> bool:
    """Determine whether to verify SSL for this server.

    Checks stored preference first, then auto-disables for localhost endpoints
    (which almost always use self-signed certificates).
    """
    if "verify_ssl" in server:
        return server["verify_ssl"]
    url = server.get("endpoint_url", "")
    if any(h in url for h in ("://localhost", "://127.0.0.1", "://0.0.0.0", "://[::1]")):
        return False
    return True


async def _discover_server_by_entry(server: Dict[str, Any], auth_token: Optional[str] = None) -> Dict[str, Any]:
    """Run discovery on a server dict, reading verify_ssl from stored config."""
    server_id = server["id"]
    endpoint_url = server["endpoint_url"]
    auth_type = server.get("auth_type", "bearer")

    # For OAuth servers, use OAuthClientProvider which handles token refresh.
    if auth_type == "oauth":
        storage = _MCPTokenStorage(server_id)
        tokens = await storage.get_tokens()
        if not tokens or not tokens.access_token:
            return {
                "error": "OAuth authorization required. Click 'Authorize' to connect.",
                "status": "disconnected",
            }

        try:
            from mcp.client.auth import OAuthClientProvider, OAuthClientMetadata

            async def _noop_redirect(url: str) -> None:
                raise RuntimeError("OAuth re-authorization required")

            async def _noop_callback() -> tuple:
                raise RuntimeError("OAuth re-authorization required")

            oauth_auth = OAuthClientProvider(
                server_url=endpoint_url,
                client_metadata=OAuthClientMetadata(
                    redirect_uris=["https://localhost/oauth/noop"],
                    token_endpoint_auth_method="none",
                    grant_types=["authorization_code", "refresh_token"],
                    response_types=["code"],
                    client_name="Lumen Network Intelligence",
                ),
                storage=storage,
                redirect_handler=_noop_redirect,
                callback_handler=_noop_callback,
            )

            result = await _discover_mcp_server(
                endpoint_url,
                verify_ssl=_should_verify_ssl(server),
                skip_preflight=True,
                oauth_auth=oauth_auth,
            )

            # If re-auth is needed, give a clear message
            if result.get("status") == "disconnected" and "re-authorization" in result.get("error", "").lower():
                result["error"] = "OAuth token expired. Click 'Authorize' to reconnect."

            return result
        except ImportError:
            # Fall back to raw bearer if MCP SDK auth module unavailable
            return await _discover_mcp_server(
                endpoint_url, tokens.access_token,
                verify_ssl=_should_verify_ssl(server), skip_preflight=True,
            )

    if auth_token is None:
        auth_token = await _get_auth_token(server_id)

    result = await _discover_mcp_server(
        endpoint_url, auth_token,
        verify_ssl=_should_verify_ssl(server),
    )

    # If auth failed and this looks like a Splunk endpoint, try Splunk-specific credentials.
    # Splunk MCP requires an encrypted token (different from REST API tokens).
    if (
        result.get("status") == "disconnected"
        and "auth" in result.get("error", "").lower()
        and (_is_localhost_url(endpoint_url) or "8089" in endpoint_url or "/services/mcp" in endpoint_url)
    ):
        config_svc = get_config_service()

        # 1) Try splunk_mcp_token (encrypted MCP token from Splunk UI) — Bearer auth
        mcp_token = await config_svc.get_config("splunk_mcp_token")
        if mcp_token:
            logger.info("Retrying Splunk MCP discovery with splunk_mcp_token (Bearer)")
            splunk_result = await _discover_mcp_server(
                endpoint_url, mcp_token,
                verify_ssl=_should_verify_ssl(server),
            )
            if splunk_result.get("status") == "connected":
                await _save_auth_token(server_id, mcp_token)
                return splunk_result

        # 2) Try splunk_bearer_token (REST API token) — Splunk auth scheme
        bearer_token = await config_svc.get_config("splunk_bearer_token")
        if bearer_token:
            logger.info("Retrying Splunk MCP discovery with splunk_bearer_token (Splunk scheme)")
            # Must pass through preflight which handles Bearer→Splunk fallback
            splunk_result = await _discover_mcp_server(
                endpoint_url, bearer_token,
                verify_ssl=_should_verify_ssl(server),
            )
            if splunk_result.get("status") == "connected":
                await _save_auth_token(server_id, bearer_token)
                return splunk_result

        # 3) Try session key from username/password login
        session_key = await _get_splunk_session_token()
        if session_key:
            logger.info("Retrying Splunk MCP discovery with session key")
            splunk_result = await _discover_mcp_server(
                endpoint_url, session_key,
                verify_ssl=_should_verify_ssl(server),
            )
            if splunk_result.get("status") == "connected":
                await _save_auth_token(server_id, session_key)
                return splunk_result

    return result


def _is_sensitive_tool(tool_name: str) -> bool:
    """Check if a tool name contains sensitive keywords."""
    lower_name = tool_name.lower()
    return any(keyword in lower_name for keyword in SENSITIVE_TOOL_KEYWORDS)


def _enrich_server_for_frontend(server: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a stored server dict into the shape the frontend MCPServer type expects."""
    cached = _discovery_cache.get(server["id"])
    has_cache = cached and cached["expires"] > time.time()

    # Determine status — use discovery cache status if available, otherwise stored status
    raw_status = server.get("status", "unknown")
    if has_cache:
        raw_status = cached["data"].get("status", raw_status)

    # Map to the 3 valid frontend statuses
    if raw_status == "connected":
        status = "connected"
    elif raw_status in ("degraded",):
        status = "degraded"
    else:
        # "registered", "disconnected", "unknown", etc. → disconnected
        status = "disconnected"

    # TLS from URL
    tls_enabled = server["endpoint_url"].startswith("https://")

    # Tool/resource counts from cache or 0
    if has_cache:
        tool_count = len(cached["data"].get("tools", []))
        resource_count = len(cached["data"].get("resources", []))
    else:
        tool_count = server.get("tool_count", 0) or 0
        resource_count = server.get("resource_count", 0) or 0

    # last_seen: prefer last_discovered_at, then registered_at, then now
    last_seen = (
        server.get("last_discovered_at")
        or server.get("registered_at")
        or datetime.utcnow().isoformat() + "Z"
    )

    enriched: Dict[str, Any] = {
        "id": server["id"],
        "name": server["name"],
        "endpoint_url": server["endpoint_url"],
        "auth_type": server.get("auth_type", "none"),
        "status": status,
        "last_seen": last_seen,
        "tool_count": tool_count,
        "resource_count": resource_count,
        "tls_enabled": tls_enabled,
        "tls_version": "TLS 1.3" if tls_enabled else None,
        "description": server.get("description", ""),
    }

    # Attach TE test IDs if available (loaded from config synchronously via cache)
    te_config_key = f"mcp_te_tests_{server['id']}"
    te_cached = _te_test_id_cache.get(te_config_key)
    if te_cached:
        enriched["te_network_test_id"] = te_cached.get("network_test_id")
        enriched["te_http_test_id"] = te_cached.get("http_test_id")

    return enriched


# Module-level cache for TE test IDs (populated during list_servers / register)
_te_test_id_cache: Dict[str, Dict[str, Any]] = {}


async def _populate_te_test_id_cache(servers: List[Dict[str, Any]]) -> None:
    """Populate the TE test ID cache for all servers."""
    config_svc = get_config_service()
    for server in servers:
        key = f"mcp_te_tests_{server['id']}"
        raw = await config_svc.get_config(key)
        if raw:
            try:
                _te_test_id_cache[key] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                pass


# ---------------------------------------------------------------------------
# ThousandEyes integration helpers
# ---------------------------------------------------------------------------

MCP_TE_PREFIX = "[MCP Monitor]"


def _extract_test_id(resp: Dict[str, Any]) -> Optional[int]:
    """Extract test ID from a TE API create-test response, handling v7 + legacy formats."""
    # Direct fields
    tid = resp.get("testId") or resp.get("id")
    if tid:
        return int(tid)
    # Nested under "test" key
    test_obj = resp.get("test", {})
    if isinstance(test_obj, dict):
        tid = test_obj.get("testId") or test_obj.get("id")
        if tid:
            return int(tid)
    # HAL _links / _embedded
    embedded = resp.get("_embedded", {})
    if isinstance(embedded, dict):
        for key in ("test", "tests"):
            obj = embedded.get(key)
            if isinstance(obj, dict):
                tid = obj.get("testId") or obj.get("id")
                if tid:
                    return int(tid)
            elif isinstance(obj, list) and obj:
                tid = obj[0].get("testId") or obj[0].get("id")
                if tid:
                    return int(tid)
    # Last resort: look for any integer value at top level that looks like a test ID
    for key in ("testId", "id"):
        val = resp.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                pass
    logger.debug("Could not extract test ID from TE response: %s", list(resp.keys()))
    return None


async def _find_te_test_by_name(test_name: str, test_type: str = "agent-to-server") -> Optional[int]:
    """Search for an existing TE test by name. Returns test ID if found, else None."""
    try:
        resp = await _te_make_request("GET", f"tests/{test_type}")
        tests = resp.get("tests", resp.get("_embedded", {}).get("tests", []))
        if isinstance(resp.get("results"), list):
            tests = resp["results"]
        for t in tests:
            if t.get("testName") == test_name:
                tid = t.get("testId") or t.get("id")
                if tid:
                    return int(tid)
    except Exception as exc:
        logger.debug("Failed to search for TE test '%s': %s", test_name, exc)
    return None


async def _create_mcp_te_tests(
    server_id: str, server_config: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Create TE agent-to-server + HTTP server tests for an MCP server endpoint.

    Returns ``{network_test_id, http_test_id}`` on success, or *None* if TE is
    not configured (MCP monitoring still works without TE).
    """
    try:
        await _validate_te()
    except Exception:
        logger.debug("ThousandEyes not configured — skipping MCP TE test creation")
        return None

    name = server_config.get("name", server_id)
    endpoint_url: str = server_config["endpoint_url"]
    hostname = endpoint_url.replace("https://", "").replace("http://", "").split("/")[0]

    try:
        agents = await _get_available_agents()
    except Exception as exc:
        logger.warning("Failed to fetch TE agents for MCP monitoring: %s", exc)
        return None

    result: Dict[str, Any] = {}
    config_svc = get_config_service()

    # 1. Agent-to-Server test — network path + latency
    net_test_name = f"{MCP_TE_PREFIX} {name} - Network Path"
    try:
        net_data = {
            "testName": net_test_name,
            "server": hostname,
            "port": 443,
            "protocol": "TCP",
            "interval": 120,
            "alertsEnabled": True,
            "pathTraceMode": "classic",
            "networkMeasurements": True,
            "bandwidthMeasurements": False,
            "mtuMeasurements": True,
            "agents": agents,
            "description": f"Monitors network path to MCP server {name}.",
        }
        net_resp = await _te_make_request("POST", "tests/agent-to-server", data=net_data)
        if "error" not in net_resp:
            result["network_test_id"] = _extract_test_id(net_resp)
        else:
            err_title = str(net_resp.get("error", {}).get("title", "") if isinstance(net_resp.get("error"), dict) else net_resp.get("error", ""))
            if "already exists" in err_title.lower():
                logger.info("TE network test '%s' already exists — looking up ID", net_test_name)
                existing_id = await _find_te_test_by_name(net_test_name, "agent-to-server")
                if existing_id:
                    result["network_test_id"] = existing_id
                    logger.info("Found existing TE network test ID: %s", existing_id)
            else:
                logger.warning("TE network test creation returned error: %s", net_resp.get("error"))
    except Exception as exc:
        logger.warning("Failed to create TE network test for MCP server %s: %s", server_id, exc)

    # 2. HTTP Server test — endpoint health
    http_test_name = f"{MCP_TE_PREFIX} {name} - Endpoint Health"
    try:
        http_data = {
            "testName": http_test_name,
            "url": endpoint_url,
            "interval": 300,
            "alertsEnabled": True,
            "httpVersion": 2,
            "sslVersionId": 0,
            "verifyCertificate": True,
            "followRedirects": True,
            "networkMeasurements": True,
            "pathTraceMode": "classic",
            "httpTimeLimit": 30,
            "agents": agents,
            "description": f"Monitors MCP server {name} endpoint availability.",
        }
        http_resp = await _te_make_request("POST", "tests/http-server", data=http_data)
        if "error" not in http_resp:
            result["http_test_id"] = _extract_test_id(http_resp)
        else:
            err_title = str(http_resp.get("error", {}).get("title", "") if isinstance(http_resp.get("error"), dict) else http_resp.get("error", ""))
            if "already exists" in err_title.lower():
                logger.info("TE HTTP test '%s' already exists — looking up ID", http_test_name)
                existing_id = await _find_te_test_by_name(http_test_name, "http-server")
                if existing_id:
                    result["http_test_id"] = existing_id
                    logger.info("Found existing TE HTTP test ID: %s", existing_id)
            else:
                logger.warning("TE HTTP test creation returned error: %s", http_resp.get("error"))
    except Exception as exc:
        logger.warning("Failed to create TE HTTP test for MCP server %s: %s", server_id, exc)

    if result:
        await config_svc.set_config(f"mcp_te_tests_{server_id}", json.dumps(result))

    return result if result else None


async def _delete_mcp_te_tests(server_id: str) -> None:
    """Remove TE tests previously created for an MCP server."""
    config_svc = get_config_service()
    raw = await config_svc.get_config(f"mcp_te_tests_{server_id}")
    if not raw:
        return

    try:
        ids = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return

    net_id = ids.get("network_test_id")
    http_id = ids.get("http_test_id")

    if net_id:
        try:
            await _te_make_request("DELETE", f"tests/agent-to-server/{net_id}")
        except Exception as exc:
            logger.warning("Failed to delete TE network test %s: %s", net_id, exc)

    if http_id:
        try:
            await _te_make_request("DELETE", f"tests/http-server/{http_id}")
        except Exception as exc:
            logger.warning("Failed to delete TE HTTP test %s: %s", http_id, exc)

    # Remove config key
    try:
        await config_svc.set_config(f"mcp_te_tests_{server_id}", "")
    except Exception:
        pass


async def _get_mcp_te_test_ids(server_id: str) -> Optional[Dict[str, Any]]:
    """Load stored TE test IDs for an MCP server, or None."""
    config_svc = get_config_service()
    raw = await config_svc.get_config(f"mcp_te_tests_{server_id}")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/servers")
async def register_server(
    config: MCPServerConfig,
    _: Any = Depends(require_admin),
):
    """Register a new MCP server for monitoring and run initial discovery."""
    servers = await _get_servers()
    now = datetime.utcnow().isoformat() + "Z"

    # Auto-disable SSL verification for localhost endpoints with self-signed certs
    verify_ssl = config.verify_ssl
    if verify_ssl and any(
        h in config.endpoint_url
        for h in ("://localhost", "://127.0.0.1", "://0.0.0.0", "://[::1]")
    ):
        verify_ssl = False
        logger.info("Auto-disabling SSL verification for localhost MCP endpoint %s", config.endpoint_url)

    server_id = uuid_mod.uuid4().hex[:12]
    server_entry = {
        "id": server_id,
        "name": config.name,
        "endpoint_url": config.endpoint_url,
        "auth_type": config.auth_type or "none",
        "description": config.description or "",
        "verify_ssl": verify_ssl,
        "registered_at": now,
        "status": "registered",
    }

    # Store auth token separately if provided
    if config.auth_token:
        await _save_auth_token(server_id, config.auth_token)

    servers.append(server_entry)
    await _save_servers(servers)

    await _log_mcp_event(
        server_id,
        config.name,
        "connection",
        "info",
        f"MCP server '{config.name}' registered with endpoint {config.endpoint_url}",
    )

    # For OAuth servers, skip initial discovery (user must authorize first)
    if config.auth_type == "oauth":
        server_entry["status"] = "awaiting_oauth"
        all_servers = await _get_servers()
        for i, s in enumerate(all_servers):
            if s["id"] == server_id:
                all_servers[i] = server_entry
                break
        await _save_servers(all_servers)
        return {
            "server_id": server_id,
            "status": "awaiting_oauth",
            "message": "Server registered. Use POST /api/mcp-monitor/servers/{server_id}/oauth/start to authorize.",
            "server": _enrich_server_for_frontend(server_entry),
        }

    # Run initial discovery to populate cache and update status
    auth_token = config.auth_token or await _get_auth_token(server_id)
    discovery = await _discover_mcp_server(config.endpoint_url, auth_token, verify_ssl=verify_ssl)

    # Update server status and cache based on discovery
    discovered_status = discovery.get("status", "disconnected")
    server_entry["status"] = discovered_status
    server_entry["last_discovered_at"] = now
    # Update endpoint URL if HTTP fallback was used during discovery
    if discovery.get("actual_url") and discovery["actual_url"] != server_entry["endpoint_url"]:
        logger.info("Registration: updating endpoint from %s to %s (protocol fallback)",
                     server_entry["endpoint_url"], discovery["actual_url"])
        server_entry["endpoint_url"] = discovery["actual_url"]

    if discovered_status == "connected":
        _discovery_cache[server_id] = {
            "data": discovery,
            "expires": time.time() + DISCOVERY_CACHE_TTL,
        }
        tool_count = len(discovery.get("tools", []))
        server_entry["tool_count"] = tool_count
        server_entry["resource_count"] = len(discovery.get("resources", []))

        await _log_mcp_event(
            server_id,
            config.name,
            "discovery",
            "info",
            f"Discovery successful: {tool_count} tools, {len(discovery.get('resources', []))} resources found",
        )
    else:
        error_msg = discovery.get("error", "Unknown error")
        await _log_mcp_event(
            server_id,
            config.name,
            "error",
            "warning",
            f"Initial discovery failed: {error_msg}",
        )

    # Re-save with updated status
    all_servers = await _get_servers()
    for i, s in enumerate(all_servers):
        if s["id"] == server_id:
            all_servers[i] = server_entry
            break
    await _save_servers(all_servers)

    # Create ThousandEyes tests for network path monitoring
    te_result = await _create_mcp_te_tests(server_id, server_entry)
    if te_result:
        _te_test_id_cache[f"mcp_te_tests_{server_id}"] = te_result
        await _log_mcp_event(
            server_id,
            config.name,
            "discovery",
            "info",
            f"ThousandEyes network monitoring enabled: network test {te_result.get('network_test_id')}, HTTP test {te_result.get('http_test_id')}",
        )

    return {"success": True, "server": _enrich_server_for_frontend(server_entry)}


@router.get("/servers")
async def list_servers(_: Any = Depends(require_viewer)):
    """List all registered MCP servers with their current status.

    If a server was recently registered but never discovered (or cache expired),
    run discovery to populate status, tool count, etc.
    """
    servers = await _get_servers()
    updated = False

    for server in servers:
        sid = server["id"]
        cached = _discovery_cache.get(sid)
        has_valid_cache = cached and cached["expires"] > time.time()

        # If no valid cache, run discovery to get real status
        if not has_valid_cache:
            result = await _discover_server_by_entry(server)
            _discovery_cache[sid] = {
                "data": result,
                "expires": time.time() + DISCOVERY_CACHE_TTL,
            }
            new_status = result.get("status", "disconnected")
            if new_status != server.get("status"):
                server["status"] = new_status
                server["last_discovered_at"] = datetime.utcnow().isoformat() + "Z"
                if new_status == "connected":
                    server["tool_count"] = len(result.get("tools", []))
                    server["resource_count"] = len(result.get("resources", []))
                updated = True
            # Update endpoint URL if HTTP fallback was used
            if result.get("actual_url") and result["actual_url"] != server.get("endpoint_url"):
                logger.info("Updating MCP server %s endpoint from %s to %s (protocol fallback)",
                            sid, server["endpoint_url"], result["actual_url"])
                server["endpoint_url"] = result["actual_url"]
                updated = True

    if updated:
        await _save_servers(servers)

    # Populate TE test ID cache for enrichment
    await _populate_te_test_id_cache(servers)

    enriched = [_enrich_server_for_frontend(s) for s in servers]

    return {"servers": enriched, "total": len(enriched)}


@router.get("/servers/{server_id}/discover")
async def discover_server(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Connect to an MCP server and discover its tools, resources, and prompts."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Check cache
    cached = _discovery_cache.get(server_id)
    if cached and cached["expires"] > time.time():
        return {"server_id": server_id, "cached": True, **cached["data"]}

    # Run discovery
    result = await _discover_server_by_entry(server)

    # Cache the result
    _discovery_cache[server_id] = {
        "data": result,
        "expires": time.time() + DISCOVERY_CACHE_TTL,
    }

    # Update server status (and endpoint URL if HTTP fallback was used)
    now = datetime.utcnow().isoformat() + "Z"
    servers = await _get_servers()
    for s in servers:
        if s["id"] == server_id:
            s["status"] = result.get("status", "unknown")
            s["last_discovered_at"] = now
            # If discovery succeeded via HTTP fallback, update the stored URL
            if result.get("actual_url") and result["actual_url"] != s.get("endpoint_url"):
                logger.info("Updating MCP server %s endpoint from %s to %s (protocol fallback)",
                            server_id, s["endpoint_url"], result["actual_url"])
                s["endpoint_url"] = result["actual_url"]
            if result.get("status") == "connected":
                s["tool_count"] = len(result.get("tools", []))
                s["resource_count"] = len(result.get("resources", []))
            break
    await _save_servers(servers)

    severity = "info" if result.get("status") == "connected" else "warning"
    await _log_mcp_event(
        server_id,
        server["name"],
        "discovery",
        severity,
        f"Discovery completed: {result.get('status', 'unknown')}"
        + (f" - {len(result.get('tools', []))} tools found" if result.get("status") == "connected" else ""),
    )

    return {"server_id": server_id, "cached": False, **result}


@router.get("/servers/{server_id}/health")
async def get_server_health(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Get health status for a registered MCP server."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Attempt a lightweight discovery to determine health
    result = await _discover_server_by_entry(server)

    status = result.get("status", "disconnected")
    is_healthy = status == "connected"

    # Update cache if connected
    if is_healthy:
        _discovery_cache[server_id] = {
            "data": result,
            "expires": time.time() + DISCOVERY_CACHE_TTL,
        }

    # Determine TLS status from endpoint URL
    uses_tls = server["endpoint_url"].startswith("https://")

    health = {
        "server_id": server_id,
        "server_name": server["name"],
        "endpoint_url": server["endpoint_url"],
        "status": status,
        "healthy": is_healthy,
        "uses_tls": uses_tls,
        "auth_type": server.get("auth_type", "none"),
        "checked_at": datetime.utcnow().isoformat() + "Z",
    }

    if not is_healthy and result.get("error"):
        health["error"] = result["error"]

    if is_healthy:
        health["tool_count"] = len(result.get("tools", []))
        health["resource_count"] = len(result.get("resources", []))
        health["prompt_count"] = len(result.get("prompts", []))

    return health


@router.get("/servers/{server_id}/tools")
async def get_server_tools(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Get the tool inventory for a registered MCP server."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Try cache first
    cached = _discovery_cache.get(server_id)
    if cached and cached["expires"] > time.time():
        tools = cached["data"].get("tools", [])
        discovered_at = datetime.fromtimestamp(
            cached["expires"] - DISCOVERY_CACHE_TTL
        ).isoformat() + "Z"
    else:
        # Run discovery
        result = await _discover_server_by_entry(server)

        if result.get("status") != "connected":
            raise HTTPException(
                status_code=502,
                detail=result.get("error", "Failed to connect to MCP server"),
            )

        _discovery_cache[server_id] = {
            "data": result,
            "expires": time.time() + DISCOVERY_CACHE_TTL,
        }
        tools = result.get("tools", [])
        discovered_at = datetime.utcnow().isoformat() + "Z"

    # Annotate tools with sensitivity flags and validation status
    annotated_tools = []
    sensitive_count = 0
    for tool in tools:
        is_sensitive = _is_sensitive_tool(tool["name"])
        if is_sensitive:
            sensitive_count += 1
        annotated_tools.append(
            {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "input_schema": tool.get("input_schema", {}),
                "is_sensitive": is_sensitive,
                "validation_status": "valid",  # discovered = reachable = valid
                "last_validated": discovered_at,
            }
        )

    return {
        "server_id": server_id,
        "server_name": server["name"],
        "tools": annotated_tools,
        "total": len(annotated_tools),
        "sensitive_count": sensitive_count,
    }


@router.post("/servers/{server_id}/validate-tool")
async def validate_tool(
    server_id: str,
    request: MCPToolValidateRequest,
    _: Any = Depends(require_editor),
):
    """Validate a specific tool on an MCP server by attempting a test call."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    auth_token = await _get_auth_token(server_id)

    try:
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        async with streamablehttp_client(
            server["endpoint_url"], headers=headers
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                # Verify tool exists
                tools_result = await session.list_tools()
                tool_names = [t.name for t in tools_result.tools]

                if request.tool_name not in tool_names:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Tool '{request.tool_name}' not found on server. Available: {tool_names}",
                    )

                # Attempt a test call if payload provided
                if request.test_payload is not None:
                    call_result = await session.call_tool(
                        request.tool_name, request.test_payload
                    )
                    await _log_mcp_event(
                        server_id,
                        server["name"],
                        "tool_change",
                        "info",
                        f"Tool '{request.tool_name}' validated successfully with test payload",
                    )
                    return {
                        "server_id": server_id,
                        "tool_name": request.tool_name,
                        "valid": True,
                        "executed": True,
                        "result": str(call_result),
                    }
                else:
                    await _log_mcp_event(
                        server_id,
                        server["name"],
                        "tool_change",
                        "info",
                        f"Tool '{request.tool_name}' exists and is reachable",
                    )
                    return {
                        "server_id": server_id,
                        "tool_name": request.tool_name,
                        "valid": True,
                        "executed": False,
                        "message": "Tool exists on server. Provide test_payload to execute.",
                    }

    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="MCP SDK not installed. Install with: pip install mcp",
        )
    except HTTPException:
        raise
    except Exception as e:
        await _log_mcp_event(
            server_id,
            server["name"],
            "error",
            "error",
            f"Tool '{request.tool_name}' validation failed: {str(e)}",
        )
        raise HTTPException(
            status_code=502, detail=f"Tool validation failed: {str(e)}"
        )


@router.get("/servers/{server_id}/events")
async def get_server_events(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Get the event log for a specific MCP server."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    config_svc = get_config_service()
    events_raw = await config_svc.get_config(CONFIG_KEY_EVENTS)
    all_events = json.loads(events_raw) if events_raw else []

    # Filter events for this server
    server_events = [e for e in all_events if e.get("server_id") == server_id]

    return {
        "server_id": server_id,
        "server_name": server["name"],
        "events": server_events,
        "total": len(server_events),
    }


@router.get("/servers/{server_id}/network-health")
async def get_server_network_health(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Fetch ThousandEyes test results for an MCP server's network path monitoring."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    te_ids = await _get_mcp_te_test_ids(server_id)

    # Auto-provision TE tests for servers registered before TE integration was added
    if not te_ids:
        te_ids = await _create_mcp_te_tests(server_id, server)
        if te_ids:
            _te_test_id_cache[f"mcp_te_tests_{server_id}"] = te_ids
            await _log_mcp_event(
                server_id,
                server.get("name", server_id),
                "discovery",
                "info",
                f"ThousandEyes network monitoring auto-provisioned: network test {te_ids.get('network_test_id')}, HTTP test {te_ids.get('http_test_id')}",
            )

    if not te_ids:
        return {"server_id": server_id, "has_te_tests": False}

    network_test_id = te_ids.get("network_test_id")
    http_test_id = te_ids.get("http_test_id")

    response: Dict[str, Any] = {
        "server_id": server_id,
        "has_te_tests": True,
        "network_test_id": network_test_id,
        "http_test_id": http_test_id,
        "metrics": None,
        "path_visualization": None,
        "network_results": None,
        "http_results": None,
    }

    # Fetch results in parallel-ish (sequential with early-return on failure)
    # Network test results
    if network_test_id:
        try:
            net_results = await _te_make_request("GET", f"test-results/{network_test_id}/network")
            response["network_results"] = net_results.get("results", net_results.get("_embedded", {}).get("results", []))
        except Exception as exc:
            logger.warning("Failed to fetch network results for test %s: %s", network_test_id, exc)

        # Two-step path-vis fetch: summary → per-agent detail (with hop data)
        try:
            summary = await _te_make_request("GET", f"test-results/{network_test_id}/path-vis")
            summary_results = summary.get("results", summary.get("_embedded", {}).get("results", []))

            if isinstance(summary_results, list) and summary_results:
                # Group by agentId → pick latest roundId per agent
                agent_rounds: Dict[str, tuple] = {}
                for r in summary_results:
                    agent = r.get("agent", {})
                    aid = str(agent.get("agentId", ""))
                    rid = r.get("roundId")
                    if not aid or not rid:
                        continue
                    existing_rid = agent_rounds.get(aid, (None, None))[1]
                    if existing_rid is None or int(rid) > int(existing_rid):
                        agent_rounds[aid] = (r, str(rid))

                if agent_rounds:
                    import asyncio

                    async def _fetch_agent_detail(aid: str, rid: str, fallback: dict):
                        try:
                            detail = await _te_make_request(
                                "GET",
                                f"test-results/{network_test_id}/path-vis/agent/{aid}/round/{rid}",
                            )
                            detail_results = detail.get("results", detail.get("_embedded", {}).get("results", []))
                            if isinstance(detail_results, list) and detail_results:
                                return detail_results
                        except Exception as e:
                            logger.debug("Path-vis detail fetch failed for agent %s round %s: %s", aid, rid, e)
                        return [fallback]

                    tasks = []
                    for aid, (summary_result, rid) in list(agent_rounds.items())[:5]:
                        tasks.append(_fetch_agent_detail(aid, rid, summary_result))

                    all_results = await asyncio.gather(*tasks)
                    detailed_results = []
                    for result_list in all_results:
                        detailed_results.extend(result_list)

                    response["path_visualization"] = {"results": detailed_results, "test": summary.get("test", {})}
                else:
                    response["path_visualization"] = summary
            else:
                response["path_visualization"] = summary
        except Exception as exc:
            logger.warning("Failed to fetch path-vis for test %s: %s", network_test_id, exc)

    # HTTP test results
    if http_test_id:
        try:
            http_results = await _te_make_request("GET", f"test-results/{http_test_id}")
            response["http_results"] = http_results.get("results", http_results.get("_embedded", {}).get("results", []))
        except Exception as exc:
            logger.warning("Failed to fetch HTTP results for test %s: %s", http_test_id, exc)

    # Compute aggregate metrics from results
    metrics: Dict[str, Any] = {}
    net_data = response.get("network_results") or []
    if isinstance(net_data, list) and net_data:
        latencies = [r.get("avgLatency", 0) for r in net_data if isinstance(r, dict)]
        losses = [r.get("loss", 0) for r in net_data if isinstance(r, dict)]
        jitters = [r.get("jitter", 0) for r in net_data if isinstance(r, dict)]
        metrics["avg_latency_ms"] = round(sum(latencies) / len(latencies), 2) if latencies else 0
        metrics["loss_pct"] = round(sum(losses) / len(losses), 2) if losses else 0
        metrics["jitter_ms"] = round(sum(jitters) / len(jitters), 2) if jitters else 0

    http_data = response.get("http_results") or []
    if isinstance(http_data, list) and http_data:
        resp_times = [r.get("responseTime", 0) for r in http_data if isinstance(r, dict)]
        avail = [1 for r in http_data if isinstance(r, dict) and r.get("httpStatusCode", 0) in range(200, 400)]
        metrics["response_time_ms"] = round(sum(resp_times) / len(resp_times), 2) if resp_times else 0
        metrics["availability_pct"] = round(len(avail) / len(http_data) * 100, 1) if http_data else 0

    # Hop count from path visualization
    path_vis_data = response.get("path_visualization") or {}
    pv_results = path_vis_data.get("results", path_vis_data.get("_embedded", {}).get("results", []))
    if isinstance(pv_results, list) and pv_results:
        max_hops = 0
        for r in pv_results:
            traces = r.get("pathTraces", [])
            for trace in traces:
                hops = trace.get("hops", [])
                max_hops = max(max_hops, len(hops))
            # Fallback to routes format
            if not traces:
                routes = r.get("routes", [])
                for route in routes:
                    hops = route.get("hops", [])
                    max_hops = max(max_hops, len(hops))
        metrics["hop_count"] = max_hops

    if metrics:
        response["metrics"] = metrics

    return response


@router.delete("/servers/{server_id}")
async def unregister_server(
    server_id: str,
    _: Any = Depends(require_admin),
):
    """Unregister an MCP server and clean up its data."""
    servers = await _get_servers()
    server = None
    remaining = []

    for s in servers:
        if s["id"] == server_id:
            server = s
        else:
            remaining.append(s)

    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Delete associated ThousandEyes tests
    await _delete_mcp_te_tests(server_id)

    # Save updated list
    await _save_servers(remaining)

    # Clean up auth token
    await _delete_auth_token(server_id)

    # Clear discovery cache
    _discovery_cache.pop(server_id, None)

    await _log_mcp_event(
        server_id,
        server["name"],
        "connection",
        "info",
        f"MCP server '{server['name']}' unregistered and removed",
    )

    return {"success": True, "message": f"Server '{server['name']}' unregistered"}


class UpdateTokenRequest(BaseModel):
    auth_token: str


@router.put("/servers/{server_id}/token")
async def update_server_token(
    server_id: str,
    body: UpdateTokenRequest,
    _: Any = Depends(require_admin),
):
    """Update the auth token for an existing MCP server and re-discover."""
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    await _save_auth_token(server_id, body.auth_token)

    # Clear cache so next list_servers re-discovers
    _discovery_cache.pop(server_id, None)

    # Run immediate discovery with new token
    result = await _discover_mcp_server(
        server["endpoint_url"], body.auth_token,
        verify_ssl=_should_verify_ssl(server),
    )

    # Update server status
    now = datetime.utcnow().isoformat() + "Z"
    servers = await _get_servers()
    for s in servers:
        if s["id"] == server_id:
            s["status"] = result.get("status", "disconnected")
            s["last_discovered_at"] = now
            if result.get("status") == "connected":
                s["tool_count"] = len(result.get("tools", []))
                s["resource_count"] = len(result.get("resources", []))
            break
    await _save_servers(servers)

    if result.get("status") == "connected":
        _discovery_cache[server_id] = {"data": result, "expires": time.time() + DISCOVERY_CACHE_TTL}
        await _log_mcp_event(server_id, server["name"], "connection", "info",
                             f"Token updated, discovery successful: {len(result.get('tools', []))} tools")
    else:
        await _log_mcp_event(server_id, server["name"], "error", "warning",
                             f"Token updated but discovery failed: {result.get('error', 'Unknown error')}")

    return {
        "success": result.get("status") == "connected",
        "status": result.get("status", "disconnected"),
        "error": result.get("error"),
        "tool_count": len(result.get("tools", [])),
    }


@router.get("/security-posture")
async def get_security_posture(_: Any = Depends(require_viewer)):
    """Aggregate security posture across all registered MCP servers.

    Returns shape matching frontend MCPSecurityPosture type:
    { overall_score, tls_status, auth_method, cert_days_remaining?,
      sensitive_tools_exposed, total_tools, servers_connected, servers_total }
    """
    servers = await _get_servers()

    if not servers:
        return {
            "overall_score": 0,
            "tls_status": "unknown",
            "auth_method": "none",
            "cert_days_remaining": None,
            "sensitive_tools_exposed": 0,
            "total_tools": 0,
            "servers_connected": 0,
            "servers_total": 0,
        }

    total_score = 0
    total_sensitive = 0
    total_tools = 0
    servers_connected = 0
    all_use_tls = True
    any_use_tls = False
    auth_methods = set()

    for server in servers:
        score = 0

        # TLS check (30 points)
        uses_tls = server["endpoint_url"].startswith("https://")
        if uses_tls:
            score += 30
            any_use_tls = True
        else:
            all_use_tls = False

        # Auth method check (30 points)
        auth_type = server.get("auth_type", "none")
        auth_methods.add(auth_type)
        if auth_type in ("bearer", "api_key"):
            score += 30
        elif auth_type != "none":
            score += 15

        # Connection status
        raw_status = server.get("status", "unknown")
        cached = _discovery_cache.get(server["id"])
        if cached and cached["expires"] > time.time():
            raw_status = cached["data"].get("status", raw_status)
        if raw_status == "connected":
            servers_connected += 1

        # Sensitive tool check (40 points) - uses cached discovery data
        if cached and cached["expires"] > time.time():
            tools = cached["data"].get("tools", [])
            sensitive = [t for t in tools if _is_sensitive_tool(t["name"])]
            total_sensitive += len(sensitive)
            total_tools += len(tools)
            if not sensitive:
                score += 40
            elif len(sensitive) <= 2:
                score += 20
        else:
            # No discovery data; neutral score
            score += 20
            total_tools += server.get("tool_count", 0) or 0

        total_score += score

    overall_score = round(total_score / len(servers)) if servers else 0

    # Determine aggregate TLS status
    if all_use_tls:
        tls_status = "secure"
    elif any_use_tls:
        tls_status = "insecure"  # mixed = insecure
    else:
        tls_status = "insecure"

    # Primary auth method
    auth_methods.discard("none")
    if auth_methods:
        auth_method = ", ".join(sorted(auth_methods))
    else:
        auth_method = "none"

    return {
        "overall_score": overall_score,
        "tls_status": tls_status,
        "auth_method": auth_method,
        "cert_days_remaining": None,  # Would need actual cert inspection
        "sensitive_tools_exposed": total_sensitive,
        "total_tools": total_tools,
        "servers_connected": servers_connected,
        "servers_total": len(servers),
    }


# ---------------------------------------------------------------------------
# OAuth endpoints — for MCP servers requiring OAuth (e.g. Cloudflare)
# ---------------------------------------------------------------------------


@router.post("/servers/{server_id}/oauth/start")
async def start_oauth_flow(
    server_id: str,
    request: Request,
    _: Any = Depends(require_admin),
):
    """Start the OAuth authorization flow for an MCP server.

    Returns an authorization URL that the user should open in their browser.
    """
    server = await _get_server_by_id(server_id)
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Clear any stale OAuth client/token data so we get a fresh registration
    config_svc = get_config_service()
    prefix = f"mcp_oauth_{server_id}"
    for suffix in ("_tokens", "_client"):
        try:
            await config_svc.set_config(f"{prefix}{suffix}", "")
        except Exception:
            pass

    # Determine callback base URL from the request
    # Use Origin or Referer header to get the frontend URL
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        # Extract scheme + host from the origin/referer
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        callback_base = f"{parsed.scheme}://{parsed.netloc}"
    else:
        callback_base = "https://localhost:8002"

    endpoint_url = server["endpoint_url"]

    try:
        auth, flow_id = await _build_oauth_auth(server_id, endpoint_url, callback_base)

        # Start the MCP connection in the background. The OAuth provider will
        # discover the auth server, register a dynamic client, build the
        # authorization URL, and call our redirect_handler.
        import httpx
        from mcp.client.streamable_http import streamablehttp_client

        async def _run_oauth_discovery():
            try:
                async with streamablehttp_client(
                    endpoint_url, auth=auth, timeout=30,
                ) as (read_stream, write_stream, _):
                    from mcp import ClientSession
                    async with ClientSession(read_stream, write_stream) as session:
                        await session.initialize()
                        tools_result = await session.list_tools()

                        # list_resources / list_prompts are optional
                        resources_list = []
                        prompts_list = []
                        try:
                            resources_result = await session.list_resources()
                            resources_list = [
                                {"uri": str(r.uri), "name": r.name, "description": r.description, "mime_type": r.mimeType}
                                for r in resources_result.resources
                            ]
                        except Exception:
                            pass
                        try:
                            prompts_result = await session.list_prompts()
                            prompts_list = [
                                {"name": p.name, "description": p.description}
                                for p in prompts_result.prompts
                            ]
                        except Exception:
                            pass

                        result = {
                            "tools": [
                                {"name": t.name, "description": t.description or "", "input_schema": t.inputSchema or {}}
                                for t in tools_result.tools
                            ],
                            "resources": resources_list,
                            "prompts": prompts_list,
                            "status": "connected",
                        }
                        # Update server status and cache
                        _discovery_cache[server_id] = {"data": result, "expires": time.time() + DISCOVERY_CACHE_TTL}
                        now = datetime.utcnow().isoformat() + "Z"
                        servers = await _get_servers()
                        for s in servers:
                            if s["id"] == server_id:
                                s["status"] = "connected"
                                s["last_discovered_at"] = now
                                s["tool_count"] = len(result["tools"])
                                s["resource_count"] = len(result["resources"])
                                break
                        await _save_servers(servers)
                        await _log_mcp_event(server_id, server["name"], "discovery", "info",
                                             f"OAuth discovery successful: {len(result['tools'])} tools")
                        logger.info("OAuth MCP discovery complete for %s: %d tools", server["name"], len(result["tools"]))
            except BaseException as e:
                detail = _unwrap_exception(e)
                logger.error("OAuth MCP discovery failed for %s: %s", server["name"], detail)
                await _log_mcp_event(server_id, server["name"], "error", "warning",
                                     f"OAuth discovery failed: {detail}")
            finally:
                # Clean up the flow after a delay
                await asyncio.sleep(10)
                _pending_oauth_flows.pop(flow_id, None)

        # Launch the discovery task in the background
        asyncio.create_task(_run_oauth_discovery())

        # Wait briefly for the redirect_handler to be called with the auth URL
        flow = _pending_oauth_flows[flow_id]
        for _ in range(50):  # up to 5 seconds
            if flow["auth_url"]:
                break
            await asyncio.sleep(0.1)

        if not flow["auth_url"]:
            return {
                "flow_id": flow_id,
                "status": "pending",
                "message": "OAuth flow started but authorization URL not yet available. "
                           "The server may already have valid cached tokens.",
            }

        return {
            "flow_id": flow_id,
            "authorization_url": flow["auth_url"],
            "status": "awaiting_authorization",
            "message": "Open the authorization URL in your browser to complete the OAuth flow.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start OAuth flow: {_unwrap_exception(e)}")


@router.get("/oauth/callback")
async def oauth_callback(
    request: Request,
    flow: str = "",
    code: str = "",
    state: str = "",
    error: str = "",
):
    """Handle the OAuth callback redirect from the authorization server.

    This endpoint is called by the OAuth provider (e.g. Cloudflare) after the
    user authorizes. It sends the code back to the waiting flow.
    """
    if error:
        return HTMLResponse(
            content=f"<html><body><h2>Authorization Failed</h2><p>{error}</p>"
                    "<p>You can close this window.</p></body></html>",
            status_code=400,
        )

    if not flow or flow not in _pending_oauth_flows:
        return HTMLResponse(
            content="<html><body><h2>Invalid OAuth Flow</h2>"
                    "<p>This authorization link has expired or is invalid.</p></body></html>",
            status_code=400,
        )

    if not code:
        return HTMLResponse(
            content="<html><body><h2>Missing Authorization Code</h2>"
                    "<p>No authorization code was provided.</p></body></html>",
            status_code=400,
        )

    pending = _pending_oauth_flows[flow]
    pending["code"] = code
    pending["state"] = state
    pending["event"].set()

    logger.info("OAuth callback received for flow %s (server %s)", flow, pending.get("server_id"))

    return HTMLResponse(
        content="<html><body><h2>Authorization Successful!</h2>"
                "<p>You can close this window and return to Lumen.</p>"
                "<script>window.close()</script></body></html>",
    )


@router.get("/servers/{server_id}/oauth/status")
async def oauth_flow_status(
    server_id: str,
    _: Any = Depends(require_viewer),
):
    """Check the status of an OAuth flow for a server."""
    # Find an active flow for this server
    for flow_id, flow in _pending_oauth_flows.items():
        if flow.get("server_id") == server_id:
            callback_done = flow.get("event", asyncio.Event()).is_set()

            # Only report "authorized" when discovery has actually completed
            # (tokens exchanged + server connected), not just when callback received
            cached = _discovery_cache.get(server_id)
            is_connected = (
                cached
                and cached["expires"] > time.time()
                and cached["data"].get("status") == "connected"
            )

            if is_connected:
                return {
                    "flow_id": flow_id,
                    "status": "authorized",
                    "callback_received": True,
                }

            return {
                "flow_id": flow_id,
                "has_auth_url": bool(flow.get("auth_url")),
                "authorization_url": flow.get("auth_url"),
                "callback_received": callback_done,
                "status": "pending",
            }

    # No active flow — check if server is already connected via cache or tokens
    cached = _discovery_cache.get(server_id)
    if cached and cached["expires"] > time.time() and cached["data"].get("status") == "connected":
        return {"status": "authorized", "has_tokens": True}

    storage = _MCPTokenStorage(server_id)
    tokens = await storage.get_tokens()
    if tokens and tokens.access_token:
        return {"status": "authorized", "has_tokens": True}

    return {"status": "no_active_flow", "has_tokens": False}
