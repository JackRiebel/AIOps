"""ThousandEyes API router — 100% self-contained, no external MCP imports."""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import List, Dict, Any, Optional
import httpx
import json
import os
from pydantic import BaseModel

from src.api.dependencies import require_viewer, require_editor, require_operator, require_admin
from src.config.settings import get_settings
from src.services.network_service import get_aggregated_cache_data
from src.services.infrastructure_snapshot import load_snapshot, refresh_snapshot, get_snapshot_age_seconds

router = APIRouter(prefix="/api/thousandeyes", tags=["thousandeyes"])

# === Configuration ===
API_BASE_URL = os.getenv("THOUSANDEYES_API_BASE_URL", "https://api.thousandeyes.com/v7")


async def _get_te_token_async() -> Optional[str]:
    """Get ThousandEyes OAuth token from database first, then environment.

    Uses async config service for proper database access and decryption.
    """
    from src.services.config_service import ConfigService

    config_service = ConfigService()

    # Try database first (async - properly handles encryption)
    db_token = await config_service.get_config("thousandeyes_oauth_token")
    if db_token:
        return db_token

    # Fall back to environment variable
    env_token = os.environ.get("THOUSANDEYES_OAUTH_TOKEN")
    if env_token:
        return env_token

    # Finally try settings
    settings = get_settings()
    return getattr(settings, "thousandeyes_oauth_token", None)


async def _get_te_headers_async() -> Dict[str, str]:
    """Get headers with current auth token (async version)."""
    token = await _get_te_token_async()
    return {
        "Authorization": f"Bearer {token}" if token else "",
        "Content-Type": "application/json",
        "Accept": "application/hal+json"
    }


# === Generic API Request Helper ===
async def make_api_request(
    method: str,
    endpoint: str,
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    aid: Optional[str] = None
) -> Dict[str, Any]:
    url = f"{API_BASE_URL}/{endpoint.lstrip('/')}"
    if aid:
        params = params or {}
        params["aid"] = aid

    # Get headers dynamically to pick up database-stored token (async)
    headers = await _get_te_headers_async()

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.request(
                method=method.upper(),
                url=url,
                headers=headers,
                params=params,
                json=data
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            try:
                error_detail = e.response.json()
            except (json.JSONDecodeError, ValueError):
                error_detail = {"error": e.response.text}
            return {"error": error_detail}
        except Exception as e:
            return {"error": str(e)}

# === Validation Helper ===

async def validate_te_config():
    """Validate ThousandEyes is configured via system_config or environment."""
    token = await _get_te_token_async()
    if token:
        return {"api_key": token, "base_url": API_BASE_URL}

    raise HTTPException(
        status_code=503,
        detail="ThousandEyes is not configured. Add THOUSANDEYES_OAUTH_TOKEN to environment or system config."
    )

# Legacy wrapper for backward compatibility
async def validate_te_org(organization: str = None):
    """Validate ThousandEyes config (organization parameter ignored, kept for compatibility)."""
    return await validate_te_config()


# ============================================================================
# MCP Helper Functions
# ============================================================================

import logging
import asyncio
te_logger = logging.getLogger(__name__)

# Limit concurrent MCP subprocess connections to prevent resource exhaustion
_te_mcp_semaphore = asyncio.Semaphore(2)
TE_MCP_TIMEOUT_SECONDS = 60

async def _get_te_mcp_creds() -> Optional[dict]:
    """Get ThousandEyes MCP credentials from config. Returns None if MCP not configured."""
    from src.services.config_service import ConfigService

    config_service = ConfigService()
    mcp_endpoint = await config_service.get_config("thousandeyes_mcp_endpoint")
    if not mcp_endpoint:
        return None

    mcp_token = await config_service.get_config("thousandeyes_mcp_token")
    if not mcp_token:
        # Fall back to OAuth token
        mcp_token = await _get_te_token_async()

    if not mcp_token:
        return None

    verify_ssl_config = await config_service.get_config("thousandeyes_verify_ssl")
    verify_ssl = True
    if verify_ssl_config is not None:
        verify_ssl = str(verify_ssl_config).lower() in ('true', '1', 'yes')

    return {
        "mcp_endpoint": mcp_endpoint,
        "token": mcp_token,
        "verify_ssl": verify_ssl,
    }


def _get_te_mcp_client_params(mcp_endpoint: str, token: str, verify_ssl: bool = True):
    """Get MCP client parameters for ThousandEyes MCP server."""
    import shutil
    from mcp import StdioServerParameters

    npx_path = shutil.which("npx")
    if not npx_path:
        for path in ["/opt/homebrew/bin/npx", "/usr/local/bin/npx", "/usr/bin/npx"]:
            if os.path.exists(path):
                npx_path = path
                break

    if not npx_path:
        raise FileNotFoundError("npx not found. Please ensure Node.js and npm are installed.")

    env = os.environ.copy()
    if not verify_ssl:
        env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

    return StdioServerParameters(
        command=npx_path,
        args=[
            "-y",
            "mcp-remote",
            mcp_endpoint,
            "--header",
            f"Authorization: Bearer {token}"
        ],
        env=env,
    )


def _parse_te_mcp_content(content) -> Any:
    """Parse MCP tool result content into Python objects."""
    if not content:
        return None

    if isinstance(content, dict):
        return content

    if isinstance(content, list):
        texts = []
        for item in content:
            text_value = None
            if hasattr(item, 'text'):
                text_value = item.text
            elif isinstance(item, dict) and 'text' in item:
                text_value = item['text']

            if text_value is not None:
                try:
                    parsed = json.loads(text_value)
                    texts.append(parsed)
                except (json.JSONDecodeError, TypeError):
                    texts.append(text_value)
            elif isinstance(item, dict):
                texts.append(item)
            else:
                texts.append(item)

        if len(texts) == 1:
            return texts[0]
        return texts

    if isinstance(content, str):
        try:
            return json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return content

    return content


def _extract_te_mcp_result(result) -> Any:
    """Extract data from MCP CallToolResult, preferring structuredContent over text content."""
    structured = getattr(result, 'structuredContent', None)
    if structured is not None:
        if isinstance(structured, dict) and "results" in structured:
            return structured["results"]
        return structured
    return _parse_te_mcp_content(result.content)


async def _call_te_mcp_tool(tool_name: str, arguments: dict = {}, creds: dict = None):
    """Call a single MCP tool on the ThousandEyes MCP server."""
    from mcp import ClientSession
    from mcp.client.stdio import stdio_client

    if creds is None:
        creds = await _get_te_mcp_creds()
        if not creds:
            raise HTTPException(status_code=503, detail="ThousandEyes MCP is not configured")

    try:
        server_params = _get_te_mcp_client_params(creds["mcp_endpoint"], creds["token"], creds["verify_ssl"])
    except (FileNotFoundError, OSError) as e:
        raise HTTPException(status_code=502, detail=f"MCP runtime not available: {str(e)}")

    try:
        async with _te_mcp_semaphore:
            async with asyncio.timeout(TE_MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()

                        tools_response = await session.list_tools()
                        tool_names = [t.name for t in tools_response.tools]
                        if tool_name not in tool_names:
                            raise HTTPException(
                                status_code=501,
                                detail=f"Tool '{tool_name}' not found. Available: {tool_names}"
                            )

                        result = await session.call_tool(tool_name, arguments=arguments)
                        return _extract_te_mcp_result(result)
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        te_logger.error(f"TE MCP call timed out for {tool_name} after {TE_MCP_TIMEOUT_SECONDS}s")
        raise HTTPException(status_code=504, detail=f"ThousandEyes MCP call timed out after {TE_MCP_TIMEOUT_SECONDS}s")
    except (ConnectionError, OSError, Exception) as e:
        error_type = type(e).__name__
        te_logger.error(f"TE MCP connection failed for {tool_name}: {error_type}: {e}")
        raise HTTPException(status_code=502, detail=f"ThousandEyes MCP server unreachable: {error_type}: {str(e)}")


async def _call_te_mcp_tools(tool_calls: list, creds: dict = None) -> list:
    """Call multiple MCP tools in a single session."""
    from mcp import ClientSession
    from mcp.client.stdio import stdio_client

    if creds is None:
        creds = await _get_te_mcp_creds()
        if not creds:
            raise HTTPException(status_code=503, detail="ThousandEyes MCP is not configured")

    try:
        server_params = _get_te_mcp_client_params(creds["mcp_endpoint"], creds["token"], creds["verify_ssl"])
    except (FileNotFoundError, OSError) as e:
        raise HTTPException(status_code=502, detail=f"MCP runtime not available: {str(e)}")

    try:
        async with _te_mcp_semaphore:
            async with asyncio.timeout(TE_MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()

                        tools_response = await session.list_tools()
                        available = {t.name for t in tools_response.tools}

                        results = []
                        for tool_name, arguments in tool_calls:
                            if tool_name not in available:
                                te_logger.warning(f"Tool '{tool_name}' not available, skipping")
                                results.append(None)
                                continue
                            try:
                                result = await session.call_tool(tool_name, arguments=arguments)
                                results.append(_extract_te_mcp_result(result))
                            except Exception as e:
                                te_logger.error(f"Error calling {tool_name}: {e}")
                                results.append(None)

                        return results
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        te_logger.error(f"TE MCP batch call timed out after {TE_MCP_TIMEOUT_SECONDS}s")
        raise HTTPException(status_code=504, detail=f"ThousandEyes MCP batch call timed out after {TE_MCP_TIMEOUT_SECONDS}s")
    except (ConnectionError, OSError, Exception) as e:
        error_type = type(e).__name__
        te_logger.error(f"TE MCP connection failed: {error_type}: {e}")
        raise HTTPException(status_code=502, detail=f"ThousandEyes MCP server unreachable: {error_type}: {str(e)}")


# === All ThousandEyes API Functions (formerly @mcp.tool) ===

async def get_endpoint_agents(aid: Optional[str] = None, max_results: Optional[int] = None, expand: Optional[List[str]] = None) -> str:
    params = {}
    if aid: params["aid"] = aid
    if max_results: params["maxResults"] = max_results
    if expand: params["expand"] = ",".join(expand)
    data = await make_api_request("GET", "endpoint/agents", params=params)
    return json.dumps(data, indent=2)

async def get_endpoint_agent(agent_id: str, expand: Optional[List[str]] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("GET", f"endpoint/agents/{agent_id}", params=params)
    return json.dumps(data, indent=2)

async def update_endpoint_agent(agent_id: str, update_data: Dict[str, Any]) -> str:
    data = await make_api_request("PATCH", f"endpoint/agents/{agent_id}", data=update_data)
    return json.dumps(data, indent=2)

async def delete_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("DELETE", f"endpoint/agents/{agent_id}")
    return json.dumps(data, indent=2)

async def enable_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("POST", f"endpoint/agents/{agent_id}/enable")
    return json.dumps(data, indent=2)

async def disable_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("POST", f"endpoint/agents/{agent_id}/disable")
    return json.dumps(data, indent=2)

async def get_endpoint_agents_connection_string(aid: Optional[str] = None) -> str:
    params = {"aid": aid} if aid else {}
    data = await make_api_request("GET", "endpoint/agents/connection-string", params=params)
    return json.dumps(data, indent=2)

async def get_agents(agent_types: Optional[List[str]] = None, labels: Optional[List[str]] = None, expand: Optional[List[str]] = None) -> str:
    params = {}
    if agent_types: params["agentTypes"] = ",".join(agent_types)
    if labels: params["labels"] = ",".join(labels)
    if expand: params["expand"] = ",".join(expand)
    data = await make_api_request("GET", "agents", params=params)
    return json.dumps(data, indent=2)

async def get_agent(agent_id: str, expand: Optional[List[str]] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("GET", f"agents/{agent_id}", params=params)
    return json.dumps(data, indent=2)

async def delete_agent(agent_id: str) -> str:
    data = await make_api_request("DELETE", f"agents/{agent_id}")
    return json.dumps(data, indent=2)

async def update_agent(agent_id: str, update_data: Dict[str, Any]) -> str:
    data = await make_api_request("PUT", f"agents/{agent_id}", data=update_data)
    return json.dumps(data, indent=2)

async def assign_agent_to_cluster(cluster_id: str, agents: List[str], expand: Optional[List[str]] = None) -> str:
    payload = {"agents": agents}
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("POST", f"agents/clusters/{cluster_id}/assign", params=params, data=payload)
    return json.dumps(data, indent=2)

async def unassign_agent_from_cluster(cluster_id: str, members: List[str], expand: Optional[List[str]] = None) -> str:
    payload = {"members": members}
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("POST", f"agents/clusters/{cluster_id}/unassign", params=params, data=payload)
    return json.dumps(data, indent=2)

async def get_agents_notification_rules() -> str:
    data = await make_api_request("GET", "agents/notification-rules")
    return json.dumps(data, indent=2)

async def get_agents_notification_rule(rule_id: str) -> str:
    data = await make_api_request("GET", f"agents/notification-rules/{rule_id}")
    return json.dumps(data, indent=2)

async def get_agents_proxies() -> str:
    data = await make_api_request("GET", "agents/proxies")
    return json.dumps(data, indent=2)

async def assign_tests(agent_id: str, test_ids: List[str]) -> str:
    payload = {"testIds": test_ids}
    data = await make_api_request("POST", f"agents/{agent_id}/tests/assign", data=payload)
    return json.dumps(data, indent=2)

async def overwrite_tests(agent_id: str, test_ids: List[str]) -> str:
    payload = {"testIds": test_ids}
    data = await make_api_request("PUT", f"agents/{agent_id}/tests", data=payload)
    return json.dumps(data, indent=2)

async def unassign_tests(agent_id: str, test_ids: List[str]) -> str:
    payload = {"testIds": test_ids}
    data = await make_api_request("POST", f"agents/{agent_id}/tests/unassign", data=payload)
    return json.dumps(data, indent=2)

async def get_account_groups() -> str:
    data = await make_api_request("GET", "account-groups")
    return json.dumps(data, indent=2)

async def create_account_group(account_group_data: Dict[str, Any], expand: Optional[List] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("POST", "account-groups", params=params, data=account_group_data)
    return json.dumps(data, indent=2)

async def get_account_group(account_group_id: str, expand: Optional[List[str]] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("GET", f"account-groups/{account_group_id}", params=params)
    return json.dumps(data, indent=2)

async def update_account_group(account_group_id: str, update_data: Dict[str, Any], expand: Optional[List[str]] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("PUT", f"account-groups/{account_group_id}", params=params, data=update_data)
    return json.dumps(data, indent=2)

async def delete_account_group(account_group_id: str) -> str:
    data = await make_api_request("DELETE", f"account-groups/{account_group_id}")
    return json.dumps(data, indent=2)

async def get_users() -> str:
    data = await make_api_request("GET", "users")
    return json.dumps(data, indent=2)

async def create_user(user_data: Dict[str, Any]) -> str:
    data = await make_api_request("POST", "users", data=user_data)
    return json.dumps(data, indent=2)

async def get_user(user_id: str) -> str:
    data = await make_api_request("GET", f"users/{user_id}")
    return json.dumps(data, indent=2)

async def update_user(user_id: str, update_data: Dict[str, Any]) -> str:
    data = await make_api_request("PUT", f"users/{user_id}", data=update_data)
    return json.dumps(data, indent=2)

async def delete_user(user_id: str) -> str:
    data = await make_api_request("DELETE", f"users/{user_id}")
    return json.dumps(data, indent=2)

async def get_roles() -> str:
    data = await make_api_request("GET", "roles")
    return json.dumps(data, indent=2)

async def create_role(role_data: Dict[str, Any]) -> str:
    data = await make_api_request("POST", "roles", data=role_data)
    return json.dumps(data, indent=2)

async def get_role(role_id: str) -> str:
    data = await make_api_request("GET", f"roles/{role_id}")
    return json.dumps(data, indent=2)

async def update_role(role_id: str, update_data: Dict[str, Any]) -> str:
    data = await make_api_request("PUT", f"roles/{role_id}", data=update_data)
    return json.dumps(data, indent=2)

async def delete_role(role_id: str) -> str:
    data = await make_api_request("DELETE", f"roles/{role_id}")
    return json.dumps(data, indent=2)

async def get_permissions() -> str:
    data = await make_api_request("GET", "permissions")
    return json.dumps(data, indent=2)

async def get_audit_user_events(window: Optional[int] = None, from_date: Optional[str] = None, to_date: Optional[str] = None) -> str:
    params = {}
    if window: params["window"] = window
    if from_date: params["from"] = from_date
    if to_date: params["to"] = to_date
    data = await make_api_request("GET", "audit-user-events", params=params)
    return json.dumps(data, indent=2)

# === ALL FASTAPI ROUTES ===

@router.get("/endpoint-agents")
async def te_get_endpoint_agents(organization: str = Query(...), aid: Optional[str] = Query(None), max_results: Optional[int] = Query(None), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_endpoint_agents(aid=aid, max_results=max_results, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/endpoint-agents/{agent_id}")
async def te_get_endpoint_agent(agent_id: str, organization: str = Query(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_endpoint_agent(agent_id, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.patch("/endpoint-agents/{agent_id}")
async def te_update_endpoint_agent(agent_id: str, organization: str = Query(...), update_data: Dict[str, Any] = Body(...), _: Any = Depends(require_editor)):
    await validate_te_org(organization)
    result = await update_endpoint_agent(agent_id, update_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/endpoint-agents/{agent_id}")
async def te_delete_endpoint_agent(agent_id: str, organization: str = Query(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await delete_endpoint_agent(agent_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Endpoint agent deleted"}

@router.post("/endpoint-agents/{agent_id}/enable")
async def te_enable_endpoint_agent(agent_id: str, organization: str = Query(...), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await enable_endpoint_agent(agent_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/endpoint-agents/{agent_id}/disable")
async def te_disable_endpoint_agent(agent_id: str, organization: str = Query(...), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await disable_endpoint_agent(agent_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/endpoint-agents/connection-string")
async def te_get_connection_string(organization: str = Query(...), aid: Optional[str] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_endpoint_agents_connection_string(aid=aid)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/agents")
async def te_get_agents(organization: str = Query(...), agent_types: Optional[List[str]] = Query(None), labels: Optional[List[str]] = Query(None), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_agents(agent_types=agent_types, labels=labels, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/agents/{agent_id}")
async def te_get_agent(agent_id: str, organization: str = Query(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_agent(agent_id, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/agents/{agent_id}")
async def te_delete_agent(agent_id: str, organization: str = Query(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await delete_agent(agent_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Agent deleted"}

@router.put("/agents/{agent_id}")
async def te_update_agent(agent_id: str, organization: str = Query(...), update_data: Dict[str, Any] = Body(...), _: Any = Depends(require_editor)):
    await validate_te_org(organization)
    result = await update_agent(agent_id, update_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/agents/clusters/{cluster_id}/assign")
async def te_assign_to_cluster(cluster_id: str, organization: str = Query(...), agents: List[str] = Body(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await assign_agent_to_cluster(cluster_id, agents, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/agents/clusters/{cluster_id}/unassign")
async def te_unassign_from_cluster(cluster_id: str, organization: str = Query(...), members: List[str] = Body(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await unassign_agent_from_cluster(cluster_id, members, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/agents/notification-rules")
async def te_get_notification_rules(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_agents_notification_rules()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/agents/notification-rules/{rule_id}")
async def te_get_notification_rule(rule_id: str, organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_agents_notification_rule(rule_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/agents/proxies")
async def te_get_proxies(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_agents_proxies()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/agents/{agent_id}/tests/assign")
async def te_assign_tests(agent_id: str, organization: str = Query(...), test_ids: List[str] = Body(...), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await assign_tests(agent_id, test_ids)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.put("/agents/{agent_id}/tests")
async def te_overwrite_tests(agent_id: str, organization: str = Query(...), test_ids: List[str] = Body(...), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await overwrite_tests(agent_id, test_ids)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/agents/{agent_id}/tests/unassign")
async def te_unassign_tests(agent_id: str, organization: str = Query(...), test_ids: List[str] = Body(...), _: Any = Depends(require_operator)):
    await validate_te_org(organization)
    result = await unassign_tests(agent_id, test_ids)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/account-groups")
async def te_get_account_groups(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_account_groups()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/account-groups")
async def te_create_account_group(organization: str = Query(...), account_group_data: Dict[str, Any] = Body(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_editor)):
    await validate_te_org(organization)
    result = await create_account_group(account_group_data, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/account-groups/{aid}")
async def te_get_account_group(aid: str, organization: str = Query(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_account_group(aid, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.put("/account-groups/{aid}")
async def te_update_account_group(aid: str, organization: str = Query(...), update_data: Dict[str, Any] = Body(...), expand: Optional[List[str]] = Query(None), _: Any = Depends(require_editor)):
    await validate_te_org(organization)
    result = await update_account_group(aid, update_data, expand=expand)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/account-groups/{aid}")
async def te_delete_account_group(aid: str, organization: str = Query(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await delete_account_group(aid)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Account group deleted"}

@router.get("/users")
async def te_get_users(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_users()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/users")
async def te_create_user(organization: str = Query(...), user_data: Dict[str, Any] = Body(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await create_user(user_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/users/{user_id}")
async def te_get_user(user_id: str, organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_user(user_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.put("/users/{user_id}")
async def te_update_user(user_id: str, organization: str = Query(...), update_data: Dict[str, Any] = Body(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await update_user(user_id, update_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/users/{user_id}")
async def te_delete_user(user_id: str, organization: str = Query(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await delete_user(user_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "User deleted"}

@router.get("/roles")
async def te_get_roles(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_roles()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/roles")
async def te_create_role(organization: str = Query(...), role_data: Dict[str, Any] = Body(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await create_role(role_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/roles/{role_id}")
async def te_get_role(role_id: str, organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_role(role_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.put("/roles/{role_id}")
async def te_update_role(role_id: str, organization: str = Query(...), update_data: Dict[str, Any] = Body(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await update_role(role_id, update_data)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/roles/{role_id}")
async def te_delete_role(role_id: str, organization: str = Query(...), _: Any = Depends(require_admin)):
    await validate_te_org(organization)
    result = await delete_role(role_id)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Role deleted"}

@router.get("/permissions")
async def te_get_permissions(organization: str = Query(...), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_permissions()
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/audit-user-events")
async def te_get_audit_user_events(organization: str = Query(...), window: Optional[int] = Query(None), from_date: Optional[str] = Query(None), to_date: Optional[str] = Query(None), _: Any = Depends(require_viewer)):
    await validate_te_org(organization)
    result = await get_audit_user_events(window=window, from_date=from_date, to_date=to_date)
    data = json.loads(result)
    if "error" in data: raise HTTPException(status_code=500, detail=data["error"])
    return data

# === TESTS ENDPOINTS ===

@router.get("/tests")
async def te_get_tests(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get all tests for an organization."""
    await validate_te_org(organization)
    params = {}
    if aid:
        params["aid"] = aid
    if test_type:
        params["testType"] = test_type

    data = await make_api_request("GET", "tests", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/tests/{test_id}")
async def te_get_test(
    test_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_viewer)
):
    """Get details of a specific test."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"tests/{test_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.post("/tests")
async def te_create_test(
    organization: str = Query(...),
    test_data: Dict[str, Any] = Body(...),
    _: Any = Depends(require_editor)
):
    """Create a new ThousandEyes test."""
    await validate_te_org(organization)
    test_type = test_data.pop("type", "http-server")
    # TE v7 API requires type-specific endpoints
    type_map = {
        "http-server": "http-server",
        "page-load": "page-load",
        "agent-to-server": "agent-to-server",
        "dns-server": "dns-server",
        "dns-trace": "dns-trace",
        "dns-dnssec": "dns-dnssec",
        "ftp-server": "ftp-server",
        "sip-server": "sip-server",
        "voice": "voice",
        "web-transactions": "web-transactions",
    }
    endpoint_type = type_map.get(test_type, test_type)
    data = await make_api_request("POST", f"tests/{endpoint_type}", data=test_data)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


async def _build_infrastructure_context(max_networks: int = 30, max_devices_per_net: int = 5) -> str:
    """Build infrastructure context string from cached network/device data for AI prompt enrichment."""
    try:
        cache_data = await get_aggregated_cache_data()
        networks = cache_data.get("networks", [])
        if not networks:
            return ""

        lines = ["INFRASTRUCTURE CONTEXT (your managed networks and devices):"]
        for net in networks[:max_networks]:
            net_name = net.get("name", "Unknown")
            org_type = net.get("organizationType", "unknown")
            devices = net.get("devices", [])[:max_devices_per_net]
            if devices:
                dev_parts = []
                for d in devices:
                    name = d.get("name") or d.get("model", "device")
                    wan_ip = d.get("wan1Ip") or d.get("publicIp") or ""
                    lan_ip = d.get("lanIp") or ""
                    if wan_ip and lan_ip:
                        dev_parts.append(f"{name} (WAN={wan_ip}, LAN={lan_ip})")
                    elif wan_ip:
                        dev_parts.append(f"{name} (WAN={wan_ip})")
                    elif lan_ip:
                        dev_parts.append(f"{name} (LAN={lan_ip})")
                    else:
                        dev_parts.append(name)
                lines.append(f"  Network '{net_name}' ({org_type}): {', '.join(dev_parts)}")
            else:
                lines.append(f"  Network '{net_name}' ({org_type}): no devices cached")

        return "\n".join(lines)
    except Exception:
        return ""


async def _get_te_agents_context() -> tuple[str, list[dict]]:
    """Fetch ThousandEyes agents and build context string for AI prompt.

    Returns:
        Tuple of (context_string, raw_agents_list)
    """
    try:
        data = await make_api_request("GET", "agents")
        agents_raw = data.get("agents", [])
        if not agents_raw:
            return "", []

        agents = []
        lines = ["AVAILABLE THOUSANDEYES AGENTS:"]
        for a in agents_raw:
            agent_id = a.get("agentId")
            name = a.get("agentName", "Unknown")
            agent_type = a.get("agentType", "unknown")  # cloud or enterprise or enterprise-cluster
            location = a.get("location", "")
            country = a.get("countryId", "")
            ip_addresses = a.get("ipAddresses", [])
            public_ips = a.get("publicIpAddresses", [])
            enabled = a.get("enabled", True)

            if not enabled:
                continue

            agents.append({
                "agentId": agent_id,
                "agentName": name,
                "agentType": agent_type,
                "location": location,
            })

            ip_str = ", ".join(public_ips or ip_addresses or [])
            loc_str = f" in {location}" if location else ""
            lines.append(f"  agentId={agent_id}: {name} ({agent_type}{loc_str}) [{ip_str}]")

        return "\n".join(lines), agents
    except Exception as e:
        te_logger.warning(f"Failed to fetch TE agents for AI context: {e}")
        return "", []


async def _build_vpn_topology_context() -> str:
    """Build VPN topology context showing hub/spoke relationships, subnets, and WAN IPs.

    This gives the AI critical data for creating connectivity tests between VPN sites.
    """
    try:
        cache_data = await get_aggregated_cache_data()
        networks = cache_data.get("networks", [])
        devices = cache_data.get("devices", [])
        if not networks:
            return ""

        # Build device WAN IP map: networkId -> list of WAN/public IPs
        net_wan_ips: Dict[str, list] = {}
        for d in devices:
            net_id = d.get("networkId")
            if not net_id:
                continue
            wan_ip = d.get("wan1Ip") or d.get("publicIp")
            if wan_ip:
                net_wan_ips.setdefault(net_id, []).append({
                    "name": d.get("name") or d.get("model", "device"),
                    "wanIp": wan_ip,
                    "lanIp": d.get("lanIp", ""),
                    "model": d.get("model", ""),
                })

        # Try to fetch VPN topology from the first Meraki org
        vpn_lines = ["VPN TOPOLOGY (site-to-site VPN relationships and routable IPs):"]
        vpn_found = False

        # Scan cache for networks that have appliance product type (VPN-capable)
        for net in networks:
            net_name = net.get("name", "Unknown")
            net_id = net.get("id", "")
            product_types = net.get("productTypes", [])

            # Only MX/appliance networks participate in VPN
            if "appliance" not in product_types:
                continue

            wan_devices = net_wan_ips.get(net_id, [])
            if wan_devices:
                vpn_found = True
                wan_parts = [f"{wd['name']} WAN={wd['wanIp']} LAN={wd['lanIp']}" for wd in wan_devices[:3]]
                vpn_lines.append(f"  Site '{net_name}' (id={net_id}): {', '.join(wan_parts)}")

        if not vpn_found:
            return ""

        vpn_lines.append("")
        vpn_lines.append("NOTE: For VPN connectivity tests between sites, use the WAN IP of the remote site as the 'server' target.")
        vpn_lines.append("Place the TE agent at (or near) the SOURCE site, and set 'server' to the DESTINATION site's WAN IP.")

        return "\n".join(vpn_lines)
    except Exception:
        return ""


async def _build_splunk_context() -> str:
    """Build Splunk insights context for AI prompt enrichment.

    Pulls stored insights from the database (previously generated by SplunkInsightService)
    so the AI can factor in actual operational data when creating tests.
    """
    try:
        from src.models.splunk_insight import SplunkLogInsight
        from src.services.database import DatabaseService
        from sqlalchemy import select

        db = DatabaseService()
        async with db.session() as session:
            query = (
                select(SplunkLogInsight)
                .order_by(SplunkLogInsight.created_at.desc())
                .limit(10)
            )
            result = await session.execute(query)
            insights = result.scalars().all()

        if not insights:
            return ""

        lines = ["SPLUNK OPERATIONAL INSIGHTS (recent events from your infrastructure):"]
        for ins in insights[:8]:
            ins_dict = ins.to_dict() if hasattr(ins, 'to_dict') else {}
            severity = ins_dict.get("severity", "info")
            title = ins_dict.get("title", "")
            desc = ins_dict.get("description", "")
            if title:
                lines.append(f"  [{severity.upper()}] {title}: {desc[:120]}")

        if len(lines) > 1:
            lines.append("")
            lines.append("Use these insights to inform test configuration — e.g., if Splunk shows VPN tunnel issues, create tests targeting those endpoints.")
            return "\n".join(lines)
        return ""
    except Exception:
        return ""


@router.post("/tests/ai")
async def te_create_test_from_ai(
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    _: Any = Depends(require_editor)
):
    """Create a ThousandEyes test using AI to interpret natural language.

    Takes a natural language prompt describing what to test and uses AI
    to generate the appropriate test configuration.
    """
    await validate_te_org(organization)

    prompt = body.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Use multi-provider AI (async, works with database config)
    from src.services.multi_provider_ai import generate_text
    from src.services.config_service import get_configured_ai_provider

    # Check if AI is configured
    ai_config = await get_configured_ai_provider()
    if not ai_config:
        raise HTTPException(status_code=503, detail="AI service not configured. Please configure an AI provider in Admin > System Config.")

    # =========================================================================
    # PRECISE RESOURCE MATCHING PIPELINE
    # Reads from local infrastructure_snapshot.json (no live API calls).
    # Snapshot is refreshed every 15 min by background scheduler.
    # 1. Load snapshot from disk
    # 2. Fuzzy-match prompt mentions to actual resource names
    # 3. Resolve exact WAN IPs and agent IDs deterministically
    # 4. Give AI only the matched resources as structured facts
    # =========================================================================

    prompt_lower = prompt.lower()
    te_logger.info(f"AI test creation — Parsing prompt: {prompt[:200]}")

    # --- Load from snapshot file (zero API calls) ---
    snapshot = load_snapshot()
    if not snapshot or (not snapshot.get("networks") and not snapshot.get("agents")):
        te_logger.info("No snapshot available — building one now")
        snapshot = await refresh_snapshot()

    networks_list = []
    for net in snapshot.get("networks", []):
        wan_ip = net.get("primaryWanIp", "")
        lan_ip = ""
        devs = net.get("devices", [])
        # If primaryWanIp missing, check individual devices
        if not wan_ip and devs:
            for d in devs:
                if d.get("wan1Ip"):
                    wan_ip = d["wan1Ip"]
                    break
                elif d.get("publicIp"):
                    wan_ip = d["publicIp"]
                    break
        # Get lanIp from first device
        for d in devs:
            if d.get("lanIp"):
                lan_ip = d["lanIp"]
                break
        networks_list.append({
            "name": net.get("name", ""),
            "id": net.get("id", ""),
            "wanIp": wan_ip,
            "lanIp": lan_ip,
            "productTypes": net.get("productTypes", []),
        })

    agents_list = snapshot.get("agents", [])

    age = get_snapshot_age_seconds()
    age_str = f"{int(age)}s ago" if age else "unknown"
    te_logger.info(f"AI test creation — Loaded snapshot ({age_str}): {len(networks_list)} networks, {len(agents_list)} agents")

    # --- Fuzzy name matching ---
    def _split_camel_and_words(name: str) -> list[str]:
        """Split a name into words, handling CamelCase, hyphens, underscores, and spaces.
        'MojoDojoCasaHouse' -> ['mojo', 'dojo', 'casa', 'house']
        'Riebel Home' -> ['riebel', 'home']
        'my-network_name' -> ['my', 'network', 'name']
        """
        import re
        # Insert space before uppercase letters that follow lowercase (camelCase split)
        spaced = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
        # Split on spaces, hyphens, underscores
        parts = re.split(r'[\s\-_]+', spaced)
        return [p.lower() for p in parts if len(p) > 0]

    def _name_match_score(resource_name: str, prompt_text: str) -> float:
        """Score how well a resource name matches the prompt. Higher = better match."""
        if not resource_name:
            return 0.0
        rname = resource_name.lower().strip()
        ptext = prompt_text.lower()
        # Exact substring match (best)
        if rname in ptext:
            return 1.0
        # Split resource name into words (handles CamelCase, hyphens, underscores)
        all_words = _split_camel_and_words(resource_name)
        words = [w for w in all_words if len(w) > 2 and w not in {'the', 'and', 'network', 'site'}]
        if not words:
            return 0.0
        matched = sum(1 for w in words if w in ptext)
        return matched / len(words) if words else 0.0

    # Match networks mentioned in prompt
    network_matches = []
    for net in networks_list:
        score = _name_match_score(net["name"], prompt_lower)
        if score >= 0.5:  # At least half the name words match
            network_matches.append({**net, "_score": score})
    network_matches.sort(key=lambda x: x["_score"], reverse=True)

    # Match agents mentioned in prompt
    agent_matches = []
    for ag in agents_list:
        score = _name_match_score(ag["agentName"], prompt_lower)
        if score >= 0.5:
            agent_matches.append({**ag, "_score": score})
    agent_matches.sort(key=lambda x: x["_score"], reverse=True)

    te_logger.info(
        f"AI test creation — Matched networks: {[n['name'] for n in network_matches[:5]]}, "
        f"Matched agents: {[a['agentName'] for a in agent_matches[:5]]}"
    )

    # --- If no agent matched by name, try to correlate agents to matched networks ---
    # Enterprise agents are often named after or located at the site
    if not agent_matches and network_matches:
        # Try matching agent names to matched network names
        for ag in agents_list:
            for net in network_matches:
                agent_name_lower = ag["agentName"].lower()
                # Check if network name words appear in agent name or vice versa
                net_words = [w for w in _split_camel_and_words(net["name"]) if len(w) > 2]
                if any(w in agent_name_lower for w in net_words):
                    agent_matches.append({**ag, "_score": 0.6, "_matched_via": net["name"]})
                    break
        agent_matches.sort(key=lambda x: x["_score"], reverse=True)

    # --- Build the resolved resources block ---
    resolved_lines = []

    # Networks with WAN IPs
    if network_matches:
        resolved_lines.append("MATCHED NETWORKS (from your infrastructure):")
        for net in network_matches[:5]:
            wan_part = f"WAN_IP={net['wanIp']}" if net['wanIp'] else "WAN_IP=unknown"
            lan_part = f", LAN_IP={net['lanIp']}" if net['lanIp'] else ""
            resolved_lines.append(f"  - \"{net['name']}\" | {wan_part}{lan_part}")

    # Agents with IDs
    if agent_matches:
        resolved_lines.append("\nMATCHED AGENTS (ThousandEyes agents at/near these sites):")
        for ag in agent_matches[:5]:
            ips = ", ".join(ag.get("publicIpAddresses") or ag.get("ipAddresses") or [])
            loc = ag.get("location", "")
            via = f" (matched via network: {ag['_matched_via']})" if ag.get("_matched_via") else ""
            resolved_lines.append(
                f"  - agentId={ag['agentId']}: \"{ag['agentName']}\" ({ag['agentType']}, {loc}) [{ips}]{via}"
            )
    else:
        # Fallback: list enterprise agents first, then cloud
        resolved_lines.append("\nAVAILABLE AGENTS (no exact match found — pick the best one):")
        enterprise = [a for a in agents_list if a["agentType"] in ("enterprise", "enterprise-cluster")]
        cloud = [a for a in agents_list if a["agentType"] == "cloud"]
        for ag in (enterprise[:5] + cloud[:3]):
            loc = ag.get("location", "")
            resolved_lines.append(f"  - agentId={ag['agentId']}: \"{ag['agentName']}\" ({ag['agentType']}, {loc})")

    resolved_context = "\n".join(resolved_lines)
    te_logger.info(f"AI test creation — Resolved context ({len(resolved_context)} chars):\n{resolved_context}")

    # --- Determine best source agent and destination IP deterministically ---
    # For VPN/connectivity tests: source = agent at one site, destination = WAN IP of other site
    best_agent = None
    best_target_ip = None

    if agent_matches and network_matches:
        # Use the top-matched enterprise agent as source
        enterprise_matches = [a for a in agent_matches if a["agentType"] in ("enterprise", "enterprise-cluster")]
        best_agent = enterprise_matches[0] if enterprise_matches else agent_matches[0]

        # Target IP = WAN IP of a matched network that is NOT the agent's site
        agent_name_lower = best_agent["agentName"].lower()
        agent_words = [w for w in _split_camel_and_words(best_agent["agentName"]) if len(w) > 2]
        for net in network_matches:
            net_name_lower = net["name"].lower()
            # Skip the network that the agent lives on
            net_words = [w for w in _split_camel_and_words(net["name"]) if len(w) > 2]
            is_same_site = any(w in agent_name_lower for w in net_words) or any(w in net_name_lower for w in agent_words)
            if not is_same_site and net["wanIp"]:
                best_target_ip = net["wanIp"]
                break
        # If all matched networks seem to be the agent's site, use the first one with a WAN IP
        if not best_target_ip:
            for net in network_matches:
                if net["wanIp"]:
                    best_target_ip = net["wanIp"]
                    break

    # Build deterministic hints for the AI
    deterministic_hints = ""
    if best_agent and best_target_ip:
        deterministic_hints = f"""
RESOLVED VALUES (use these exact values):
- Source Agent: agentId={best_agent['agentId']} ("{best_agent['agentName']}")
- Destination WAN IP: {best_target_ip}
- For agent-to-server tests, ALWAYS include: "pathTraceMode": "classic", "numPathTraces": 3
"""
    elif best_agent:
        deterministic_hints = f"""
RESOLVED VALUES (use these exact values):
- Source Agent: agentId={best_agent['agentId']} ("{best_agent['agentName']}")
"""

    ai_prompt = f"""You are a ThousandEyes test configuration expert. Generate a valid ThousandEyes API v7 test configuration JSON.

{resolved_context}
{deterministic_hints}
USER REQUEST: {prompt}

Generate ONE JSON object. Test type templates:

1. HTTP Server (website/API monitoring):
{{"testName": "...", "type": "http-server", "url": "https://...", "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

2. Agent-to-Server (VPN/connectivity/path visualization):
{{"testName": "...", "type": "agent-to-server", "server": "<WAN_IP>", "port": 443, "protocol": "TCP", "pathTraceMode": "classic", "numPathTraces": 3, "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

3. DNS Test:
{{"testName": "...", "type": "dns-server", "domain": "...", "dnsServers": [{{"serverName": "8.8.8.8"}}], "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

Rules:
- Use ONLY the agentId values from RESOLVED VALUES or MATCHED AGENTS above.
- For VPN/connectivity between sites: use "agent-to-server" with the agent at the SOURCE site and "server" set to the DESTINATION site's WAN_IP.
- NEVER use private IPs (192.168.x, 10.x, 172.16.x) as server — always use the WAN_IP.
- For agent-to-server, ALWAYS include "pathTraceMode": "classic" and "numPathTraces": 3.
- Prefer enterprise/enterprise-cluster agents over cloud agents.
- Return ONLY the JSON object, no explanation.

JSON:"""

    te_logger.info(f"AI test creation — Final prompt length: {len(ai_prompt)} chars")

    try:
        # Generate test configuration using AI
        result = await generate_text(ai_prompt, max_tokens=1200)

        if not result:
            raise HTTPException(status_code=503, detail="AI provider returned no response")

        ai_response = result.get("text", "")
        te_logger.info(f"AI test creation response: {ai_response[:500]}")

        # Parse the JSON from AI response
        start = ai_response.find('{')
        if start == -1:
            raise HTTPException(status_code=500, detail="AI did not generate valid test configuration")
        depth = 0
        end = start
        for i in range(start, len(ai_response)):
            if ai_response[i] == '{':
                depth += 1
            elif ai_response[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        json_str = ai_response[start:end]
        test_config = json.loads(json_str)

        # Validate required fields
        if "testName" not in test_config or "type" not in test_config:
            raise HTTPException(status_code=500, detail="AI generated incomplete test configuration")

        # =====================================================================
        # POST-PROCESSING: Override AI output with deterministic values
        # This ensures the correct agent and IP are used regardless of AI choice
        # =====================================================================
        test_type_raw = test_config.get("type", "http-server")

        # Override agent with our deterministically resolved best agent
        if best_agent:
            test_config["agents"] = [{"agentId": str(best_agent["agentId"])}]
            te_logger.info(f"Enforced agent: {best_agent['agentName']} (id={best_agent['agentId']})")

        # Override server IP for agent-to-server tests
        if best_target_ip and test_type_raw == "agent-to-server":
            test_config["server"] = best_target_ip
            te_logger.info(f"Enforced target WAN IP: {best_target_ip}")

        # Ensure pathTraceMode for agent-to-server tests
        if test_type_raw == "agent-to-server":
            test_config.setdefault("pathTraceMode", "classic")
            test_config.setdefault("numPathTraces", 3)

        # Fallback: if no agent was resolved and AI didn't provide one either
        if "agents" not in test_config or not test_config["agents"]:
            enterprise = [a for a in agents_list if a["agentType"] in ("enterprise", "enterprise-cluster")]
            chosen = enterprise[:3] if enterprise else agents_list[:3]
            if chosen:
                test_config["agents"] = [{"agentId": str(a["agentId"])} for a in chosen]
                te_logger.info(f"Auto-assigned agents: {[a['agentName'] for a in chosen]}")
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No ThousandEyes agents available. Please ensure you have at least one active agent."
                )

        # TE v7 API requires type-specific endpoints
        test_type = test_config.pop("type", "http-server")
        type_map = {
            "http-server": "http-server",
            "page-load": "page-load",
            "agent-to-server": "agent-to-server",
            "dns-server": "dns-server",
            "dns-trace": "dns-trace",
            "dns-dnssec": "dns-dnssec",
            "ftp-server": "ftp-server",
            "sip-server": "sip-server",
            "voice": "voice",
            "web-transactions": "web-transactions",
        }
        endpoint_type = type_map.get(test_type, test_type)

        te_logger.info(f"Creating {endpoint_type} test: {test_config.get('testName')} with {len(test_config.get('agents', []))} agents")

        # Create the test via ThousandEyes API
        data = await make_api_request("POST", f"tests/{endpoint_type}", data=test_config)
        if "error" in data:
            error_detail = data["error"]
            if isinstance(error_detail, dict):
                # Extract meaningful message from TE API error
                msg = error_detail.get("message") or error_detail.get("detail") or json.dumps(error_detail)
            else:
                msg = str(error_detail)
            raise HTTPException(status_code=500, detail=f"ThousandEyes API error: {msg}")

        return {
            "success": True,
            "message": f"Created {endpoint_type} test: {test_config.get('testName')}",
            "test": data,
            "ai_config": {**test_config, "type": test_type}
        }

    except json.JSONDecodeError as e:
        te_logger.error(f"Failed to parse AI response as JSON: {e}\nRaw: {ai_response[:500]}")
        raise HTTPException(status_code=500, detail="AI generated invalid JSON configuration")
    except HTTPException:
        raise
    except Exception as e:
        te_logger.error(f"AI test creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create test: {str(e)}")

@router.put("/tests/{test_id}")
async def te_update_test(
    test_id: str,
    organization: str = Query(...),
    test_data: Dict[str, Any] = Body(...),
    _: Any = Depends(require_editor)
):
    """Update an existing test."""
    await validate_te_org(organization)
    data = await make_api_request("PUT", f"tests/{test_id}", data=test_data)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.delete("/tests/{test_id}")
async def te_delete_test(
    test_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_admin)
):
    """Delete a test."""
    await validate_te_org(organization)
    data = await make_api_request("DELETE", f"tests/{test_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Test deleted successfully"}

# === INFRASTRUCTURE SNAPSHOT ENDPOINTS ===

@router.get("/snapshot")
async def te_get_snapshot(
    _: Any = Depends(require_viewer)
):
    """Get the current infrastructure snapshot (networks, devices, agents)."""
    snapshot = load_snapshot()
    if not snapshot:
        return {"error": "No snapshot available. Trigger a refresh.", "networks": [], "agents": []}
    age = get_snapshot_age_seconds()
    snapshot["age_seconds"] = round(age) if age else None
    return snapshot


@router.post("/snapshot/refresh")
async def te_refresh_snapshot(
    _: Any = Depends(require_editor)
):
    """Manually refresh the infrastructure snapshot."""
    snapshot = await refresh_snapshot()
    return {
        "success": True,
        "message": f"Snapshot refreshed: {len(snapshot.get('networks', []))} networks, {len(snapshot.get('agents', []))} agents",
        "generated_at": snapshot.get("generated_at"),
    }


# === ALERTS ENDPOINTS ===

@router.get("/alerts")
async def te_get_alerts(
    organization: str = Query(...),
    active_only: Optional[bool] = Query(False),
    aid: Optional[str] = Query(None),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get alerts from ThousandEyes."""
    await validate_te_org(organization)
    params = {}
    if aid:
        params["aid"] = aid
    if window:
        params["window"] = window

    data = await make_api_request("GET", "alerts", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])

    # Filter to active alerts only if requested
    # Handle both HAL+JSON (_embedded.alerts) and direct (alerts) formats
    # TE v7 API may use: active=1 (int), active=true (bool), or state="active"/"ACTIVE"
    def _is_active_alert(a: dict) -> bool:
        active_val = a.get("active")
        if active_val == 1 or active_val is True:
            return True
        state_val = str(a.get("state", "")).lower()
        if state_val == "active":
            return True
        # If no explicit inactive marker, treat as active (alert exists = active)
        if active_val is None and not state_val:
            return True
        return False

    if active_only:
        if "_embedded" in data and "alerts" in data["_embedded"]:
            data["_embedded"]["alerts"] = [a for a in data["_embedded"]["alerts"] if _is_active_alert(a)]
        elif "alerts" in data:
            data["alerts"] = [a for a in data["alerts"] if _is_active_alert(a)]

    return data

@router.get("/alerts/{alert_id}")
async def te_get_alert(
    alert_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_viewer)
):
    """Get details of a specific alert."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"alerts/{alert_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === TEST RESULTS ENDPOINTS ===

@router.get("/tests/{test_id}/results")
async def te_get_test_results(
    test_id: str,
    organization: str = Query(...),
    test_type: Optional[str] = Query(None, description="Test type (e.g., agent-to-server, http-server, etc.)"),
    window: Optional[str] = Query("12h", description="Time window (e.g., 12h, 24h, 1d)"),
    _: Any = Depends(require_viewer)
):
    """Get test results for visualization (trending data).

    This endpoint attempts to fetch results based on the test type.
    Common result types: http-server, network, page-load, dns-server, etc.
    """
    await validate_te_org(organization)

    # If test_type not provided, use a default mapping
    if not test_type:
        test_type = "network"  # Default fallback

    # Map test types to their result endpoints
    # ThousandEyes API uses different endpoints for different test types
    type_endpoint_map = {
        "http-server": f"test-results/{test_id}/http-server",
        "page-load": f"test-results/{test_id}/page-load",
        "network": f"test-results/{test_id}/network",
        "dns-server": f"test-results/{test_id}/dns-server",
        "dns-trace": f"test-results/{test_id}/dns-trace",
        "web-transactions": f"test-results/{test_id}/web-transactions",
        "ftp-server": f"test-results/{test_id}/ftp-server",
        "sip-server": f"test-results/{test_id}/sip-server",
        "voice-call": f"test-results/{test_id}/voice-call",
        "agent-to-server": f"test-results/{test_id}/network",
        "agent-to-agent": f"test-results/{test_id}/network",
    }

    # Get the appropriate endpoint for this test type
    result_endpoint = type_endpoint_map.get(test_type)

    if not result_endpoint:
        # Try generic network endpoint as fallback
        result_endpoint = f"test-results/{test_id}/network"

    # Fetch the test results with the specified window
    results_data = await make_api_request(
        "GET",
        result_endpoint,
        params={"window": window}
    )

    if "error" in results_data:
        # If the first endpoint fails, try alternative endpoints
        for alt_type, alt_endpoint in type_endpoint_map.items():
            if alt_type != test_type:
                results_data = await make_api_request(
                    "GET",
                    alt_endpoint,
                    params={"window": window}
                )
                if "error" not in results_data:
                    break

        # If still error, return it
        if "error" in results_data:
            raise HTTPException(status_code=500, detail=results_data["error"])

    # Return results
    return {
        "results": results_data,
        "window": window,
        "test_type": test_type
    }


# === EVENTS ENDPOINTS ===

@router.get("/events")
async def te_get_events(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    window: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _: Any = Depends(require_viewer)
):
    """Get ThousandEyes events."""
    await validate_te_org(organization)
    params = {}
    if aid: params["aid"] = aid
    if window: params["window"] = window
    if from_date: params["from"] = from_date
    if to_date: params["to"] = to_date
    data = await make_api_request("GET", "events", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/events/{event_id}")
async def te_get_event(
    event_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_viewer)
):
    """Get details of a specific event."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"events/{event_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === OUTAGES ENDPOINTS ===
# NOTE: TE v7 has no generic /outages endpoint.
# Outages are accessed via POST /internet-insights/outages/filter.
# This endpoint is kept for backward compatibility, proxying to the correct API.

@router.get("/outages")
async def te_get_outages(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    window: Optional[str] = Query(None),
    outage_type: Optional[str] = Query(None, alias="type"),
    _: Any = Depends(require_viewer)
):
    """Search ThousandEyes outages via Internet Insights filter API."""
    await validate_te_org(organization)
    filter_body: Dict[str, Any] = {"outageScope": "with-affected-test"}
    if window:
        filter_body["window"] = window
    if outage_type:
        filter_body["outageScope"] = outage_type  # application or network scope
    data = await make_api_request("POST", "internet-insights/outages/filter", data=filter_body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === INSTANT TESTS ENDPOINT ===
# TE v7 uses type-specific instant test endpoints: POST /tests/{type}/instant

@router.post("/instant-tests")
async def te_run_instant_test(
    organization: str = Query(...),
    test_config: Dict[str, Any] = Body(...),
    _: Any = Depends(require_operator)
):
    """Run an instant test using the type-specific TE v7 endpoint."""
    await validate_te_org(organization)
    test_type = test_config.pop("type", "agent-to-server")
    type_map = {
        "http-server": "http-server",
        "page-load": "page-load",
        "agent-to-server": "agent-to-server",
        "agent-to-agent": "agent-to-agent",
        "dns-server": "dns-server",
        "dns-trace": "dns-trace",
        "dns-dnssec": "dns-dnssec",
        "ftp-server": "ftp-server",
        "sip-server": "sip-server",
        "voice": "voice",
        "web-transactions": "web-transactions",
    }
    endpoint_type = type_map.get(test_type, test_type)
    data = await make_api_request("POST", f"tests/{endpoint_type}/instant", data=test_config)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === METRICS ENDPOINT ===
# TE v7 has no generic /anomalies or /metrics endpoint.
# Metrics come from type-specific test-results endpoints (network, http-server, etc.)
# This endpoint fetches from the appropriate result type and extracts metrics.

@router.get("/tests/{test_id}/metrics")
async def te_get_test_metrics(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None, description="Test type for result endpoint routing"),
    _: Any = Depends(require_viewer)
):
    """Get test metrics from type-specific test-results endpoints."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window

    # Try the specified type first, then fall back through common types
    types_to_try = []
    if test_type:
        type_map = {
            "agent-to-server": "network",
            "agent-to-agent": "network",
            "http-server": "http-server",
            "page-load": "page-load",
            "dns-server": "dns-server",
            "dns-trace": "dns-trace",
            "web-transactions": "web-transactions",
            "ftp-server": "ftp-server",
            "sip-server": "sip-server",
            "voice": "voice-call",
        }
        mapped = type_map.get(test_type, test_type)
        types_to_try.append(mapped)

    # Common fallback order
    for fallback in ["network", "http-server", "page-load", "dns-server"]:
        if fallback not in types_to_try:
            types_to_try.append(fallback)

    for result_type in types_to_try:
        data = await make_api_request("GET", f"test-results/{test_id}/{result_type}", params=params)
        if "error" not in data:
            return {"results": data, "window": window, "result_type": result_type}

    raise HTTPException(status_code=404, detail="No test results found for any result type")

# === PATH VISUALIZATION ENDPOINTS ===

@router.get("/tests/{test_id}/path-vis")
async def te_get_path_vis(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get path visualization summary (agents/rounds, no hop details)."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    data = await make_api_request("GET", f"test-results/{test_id}/path-vis", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/tests/{test_id}/path-vis/agent/{agent_id}/round/{round_id}")
async def te_get_path_vis_detail(
    test_id: str,
    agent_id: str,
    round_id: str,
    organization: str = Query(...),
    direction: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get detailed hop-by-hop path visualization for a specific agent and round."""
    await validate_te_org(organization)
    params = {}
    if direction: params["direction"] = direction
    data = await make_api_request(
        "GET",
        f"test-results/{test_id}/path-vis/agent/{agent_id}/round/{round_id}",
        params=params
    )
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/tests/{test_id}/path-vis/detailed")
async def te_get_path_vis_detailed(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query("2h"),
    _: Any = Depends(require_viewer)
):
    """Get full hop-by-hop path visualization data with automatic two-step fetch.

    Step 1: Calls the path-vis summary to discover agents and latest roundIds.
    Step 2: For each unique agent, calls the detail endpoint to get hop-by-hop data.
    Returns the combined results with full hop details.
    """
    await validate_te_org(organization)

    # Step 1: Get summary with agents and rounds
    params = {"window": window} if window else {}
    summary = await make_api_request("GET", f"test-results/{test_id}/path-vis", params=params)
    if "error" in summary:
        raise HTTPException(status_code=500, detail=summary["error"])

    summary_results = summary.get("results", [])
    if not summary_results:
        return {"results": [], "test": summary.get("test", {})}

    # Step 2: Pick the most recent round per agent, then fetch detail
    # Group by agentId → pick the latest roundId
    agent_rounds: Dict[str, tuple] = {}
    for r in summary_results:
        agent = r.get("agent", {})
        aid = agent.get("agentId") or str(agent.get("agentId", ""))
        rid = r.get("roundId")
        if not aid or not rid:
            continue
        # Keep the latest round per agent
        existing_rid = agent_rounds.get(aid, (None, None))[1]
        if existing_rid is None or int(rid) > int(existing_rid):
            agent_rounds[aid] = (r, str(rid))

    if not agent_rounds:
        return {"results": summary_results, "test": summary.get("test", {})}

    # Fetch detail for each agent (limit to first 5 to avoid too many calls)
    import asyncio
    detailed_results = []

    async def fetch_agent_detail(aid: str, rid: str, summary_result: dict):
        try:
            detail = await make_api_request(
                "GET",
                f"test-results/{test_id}/path-vis/agent/{aid}/round/{rid}"
            )
            if "error" not in detail:
                detail_results = detail.get("results", [])
                if detail_results:
                    return detail_results
        except Exception as e:
            te_logger.warning(f"Failed to fetch path-vis detail for agent {aid} round {rid}: {e}")
        # Return the summary result as fallback
        return [summary_result]

    tasks = []
    for aid, (summary_result, rid) in list(agent_rounds.items())[:5]:
        tasks.append(fetch_agent_detail(aid, rid, summary_result))

    all_results = await asyncio.gather(*tasks)
    for result_list in all_results:
        detailed_results.extend(result_list)

    return {"results": detailed_results, "test": summary.get("test", {})}

# === BGP ENDPOINTS ===

@router.get("/tests/{test_id}/bgp")
async def te_get_bgp_results(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get BGP test results."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    data = await make_api_request("GET", f"test-results/{test_id}/bgp", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

@router.get("/tests/{test_id}/bgp/{prefix_id}")
async def te_get_bgp_route(
    test_id: str,
    prefix_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_viewer)
):
    """Get BGP route details for a specific prefix."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"test-results/{test_id}/bgp/{prefix_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === ENDPOINT AGENT METRICS ===

@router.get("/endpoint-agents/metrics")
async def te_get_endpoint_agent_metrics(
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    metric_type: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get endpoint agent metrics."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    if metric_type: params["metricType"] = metric_type
    data = await make_api_request("GET", "endpoint-data/network-topology", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === ENDPOINT SCHEDULED TESTS ===

@router.get("/endpoint-tests")
async def te_get_endpoint_tests(
    organization: str = Query(...),
    test_type: Optional[str] = Query(None, description="Filter by type: agent-to-server or http-server"),
    _: Any = Depends(require_viewer)
):
    """List endpoint scheduled tests (TE v7: endpoint/tests/scheduled-tests)."""
    await validate_te_org(organization)
    try:
        # TE v7 spec: GET /endpoint/tests/scheduled-tests
        # Optionally filter by type: /endpoint/tests/scheduled-tests/{type}
        if test_type and test_type in ("agent-to-server", "http-server"):
            endpoint = f"endpoint/tests/scheduled-tests/{test_type}"
        else:
            endpoint = "endpoint/tests/scheduled-tests"
        data = await make_api_request("GET", endpoint)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {"tests": [], "_embedded": {"tests": []}}

@router.get("/endpoint-tests/{test_id}")
async def te_get_endpoint_test_detail(
    test_id: str,
    organization: str = Query(...),
    _: Any = Depends(require_viewer)
):
    """Get endpoint scheduled test detail (TE v7: endpoint/tests/scheduled-tests/{id})."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("GET", f"endpoint/tests/scheduled-tests/{test_id}")
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {}

@router.get("/endpoint-data/net-metrics/{test_id}")
async def te_get_endpoint_net_metrics(
    test_id: str,
    organization: str = Query(...),
    agent_id: Optional[str] = Query(None, alias="agentId"),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get network metrics per endpoint test."""
    await validate_te_org(organization)
    params = {}
    if agent_id: params["agentId"] = agent_id
    if window: params["window"] = window
    try:
        data = await make_api_request("GET", f"endpoint-data/tests/net-metrics/{test_id}", params=params)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {"results": [], "_embedded": {"results": []}}

@router.get("/endpoint-data/http-server/{test_id}")
async def te_get_endpoint_http_server(
    test_id: str,
    organization: str = Query(...),
    agent_id: Optional[str] = Query(None, alias="agentId"),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get HTTP server results for endpoint tests."""
    await validate_te_org(organization)
    params = {}
    if agent_id: params["agentId"] = agent_id
    if window: params["window"] = window
    try:
        data = await make_api_request("GET", f"endpoint-data/tests/http-server/{test_id}", params=params)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {"results": [], "_embedded": {"results": []}}

@router.get("/internet-insights/outages")
async def te_get_internet_insights_outages(
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    outage_scope: Optional[str] = Query(None, alias="outageScope"),
    provider_name: Optional[str] = Query(None, alias="providerName"),
    application_name: Optional[str] = Query(None, alias="applicationName"),
    interface_network: Optional[str] = Query(None, alias="interfaceNetwork"),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get Internet Insights outage feed via POST /internet-insights/outages/filter."""
    await validate_te_org(organization)
    # Build the filter body per TE v7 Internet Insights API spec
    filter_body: Dict[str, Any] = {}
    if window:
        filter_body["window"] = window
    if outage_scope:
        filter_body["outageScope"] = outage_scope
    else:
        filter_body["outageScope"] = "with-affected-test"
    if provider_name:
        filter_body["providerName"] = [p.strip() for p in provider_name.split(",")]
    if application_name:
        filter_body["applicationName"] = [a.strip() for a in application_name.split(",")]
    if interface_network:
        filter_body["interfaceNetwork"] = [n.strip() for n in interface_network.split(",")]
    try:
        data = await make_api_request("POST", "internet-insights/outages/filter", data=filter_body, aid=aid)
        if "error" in data:
            te_logger.warning(f"Internet Insights outages/filter error: {data['error']}")
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        te_logger.warning(f"Internet Insights outages request failed: {e}")
        return {"outages": [], "error": str(e)}

@router.get("/internet-insights/outages/net/{outage_id}")
async def te_get_network_outage_detail(
    outage_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get detailed info for a specific network outage."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("GET", f"internet-insights/outages/net/{outage_id}", aid=aid)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        te_logger.warning(f"Network outage detail request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/internet-insights/outages/app/{outage_id}")
async def te_get_application_outage_detail(
    outage_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get detailed info for a specific application outage."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("GET", f"internet-insights/outages/app/{outage_id}", aid=aid)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        te_logger.warning(f"Application outage detail request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/internet-insights/catalog/providers")
async def te_filter_catalog_providers(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer),
    body: Dict[str, Any] = {}
):
    """Filter Internet Insights catalog providers."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("POST", "internet-insights/catalog/providers/filter", data=body, aid=aid)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception as e:
        te_logger.warning(f"Catalog providers request failed: {e}")
        return {"providers": [], "error": str(e)}

@router.get("/endpoint-data/automated-sessions/{test_id}/results")
async def te_get_automated_session_results(
    test_id: str,
    organization: str = Query(...),
    agent_id: Optional[str] = Query(None, alias="agentId"),
    window: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get automated session test results for agent score timeline."""
    await validate_te_org(organization)
    params = {}
    if agent_id: params["agentId"] = agent_id
    if window: params["window"] = window
    try:
        data = await make_api_request("GET", f"endpoint-data/automated-session-tests/{test_id}/results", params=params)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {"results": [], "_embedded": {"results": []}}

# ============================================================================
# ALERT RULES ENDPOINTS (TE v7: /alerts/rules)
# ============================================================================

@router.get("/alert-rules")
async def te_get_alert_rules(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """List all alert rules."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "alerts/rules", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.get("/alert-rules/{rule_id}")
async def te_get_alert_rule(
    rule_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get a specific alert rule."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"alerts/rules/{rule_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/alert-rules")
async def te_create_alert_rule(
    organization: str = Query(...),
    rule_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a new alert rule."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "alerts/rules", data=rule_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.put("/alert-rules/{rule_id}")
async def te_update_alert_rule(
    rule_id: str,
    organization: str = Query(...),
    rule_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Update an existing alert rule."""
    await validate_te_org(organization)
    data = await make_api_request("PUT", f"alerts/rules/{rule_id}", data=rule_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.delete("/alert-rules/{rule_id}")
async def te_delete_alert_rule(
    rule_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_admin)
):
    """Delete an alert rule."""
    await validate_te_org(organization)
    data = await make_api_request("DELETE", f"alerts/rules/{rule_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Alert rule deleted"}


# ============================================================================
# ALERT SUPPRESSION WINDOWS (TE v7: /alerts/suppression-windows)
# ============================================================================

@router.get("/alert-suppression-windows")
async def te_get_suppression_windows(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """List alert suppression windows."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "alerts/suppression-windows", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.get("/alert-suppression-windows/{window_id}")
async def te_get_suppression_window(
    window_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get a specific suppression window."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"alerts/suppression-windows/{window_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/alert-suppression-windows")
async def te_create_suppression_window(
    organization: str = Query(...),
    window_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a suppression window."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "alerts/suppression-windows", data=window_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.put("/alert-suppression-windows/{window_id}")
async def te_update_suppression_window(
    window_id: str,
    organization: str = Query(...),
    window_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Update a suppression window."""
    await validate_te_org(organization)
    data = await make_api_request("PUT", f"alerts/suppression-windows/{window_id}", data=window_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.delete("/alert-suppression-windows/{window_id}")
async def te_delete_suppression_window(
    window_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_admin)
):
    """Delete a suppression window."""
    await validate_te_org(organization)
    data = await make_api_request("DELETE", f"alerts/suppression-windows/{window_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Suppression window deleted"}


# ============================================================================
# BGP MONITORS (TE v7: /monitors)
# ============================================================================

@router.get("/bgp-monitors")
async def te_get_bgp_monitors(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """List BGP monitors."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "monitors", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.get("/bgp-monitors/{monitor_id}")
async def te_get_bgp_monitor(
    monitor_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get a specific BGP monitor."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"monitors/{monitor_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# ============================================================================
# TAGS CRUD (TE v7: /tags)
# ============================================================================

@router.get("/tags")
async def te_get_tags(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """List all tags."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "tags", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.get("/tags/{tag_id}")
async def te_get_tag(
    tag_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get a specific tag."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"tags/{tag_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/tags")
async def te_create_tag(
    organization: str = Query(...),
    tag_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a new tag."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "tags", data=tag_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.put("/tags/{tag_id}")
async def te_update_tag(
    tag_id: str,
    organization: str = Query(...),
    tag_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Update a tag."""
    await validate_te_org(organization)
    data = await make_api_request("PUT", f"tags/{tag_id}", data=tag_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.delete("/tags/{tag_id}")
async def te_delete_tag(
    tag_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_admin)
):
    """Delete a tag."""
    await validate_te_org(organization)
    data = await make_api_request("DELETE", f"tags/{tag_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Tag deleted"}


@router.post("/tags/{tag_id}/assign")
async def te_assign_tag(
    tag_id: str,
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Assign a tag to tests/agents. Body: {"assignments": [{"type": "test", "id": "..."}]}"""
    await validate_te_org(organization)
    data = await make_api_request("POST", f"tags/{tag_id}/assign", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/tags/{tag_id}/unassign")
async def te_unassign_tag(
    tag_id: str,
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Unassign a tag from tests/agents."""
    await validate_te_org(organization)
    data = await make_api_request("POST", f"tags/{tag_id}/unassign", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# ============================================================================
# TEST SNAPSHOTS (TE v7: POST /tests/{testId}/snapshot)
# ============================================================================

@router.post("/tests/{test_id}/snapshot")
async def te_create_test_snapshot(
    test_id: str,
    organization: str = Query(...),
    body: Dict[str, Any] = Body(default={}),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a shareable snapshot of test results."""
    await validate_te_org(organization)
    data = await make_api_request("POST", f"tests/{test_id}/snapshot", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# ============================================================================
# CREDENTIALS (TE v7: /credentials)
# ============================================================================

@router.get("/credentials")
async def te_get_credentials(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """List stored credentials (for web transaction tests, etc.)."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "credentials", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.get("/credentials/{credential_id}")
async def te_get_credential(
    credential_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get a specific credential."""
    await validate_te_org(organization)
    data = await make_api_request("GET", f"credentials/{credential_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/credentials")
async def te_create_credential(
    organization: str = Query(...),
    cred_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a credential."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "credentials", data=cred_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.put("/credentials/{credential_id}")
async def te_update_credential(
    credential_id: str,
    organization: str = Query(...),
    cred_data: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Update a credential."""
    await validate_te_org(organization)
    data = await make_api_request("PUT", f"credentials/{credential_id}", data=cred_data, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.delete("/credentials/{credential_id}")
async def te_delete_credential(
    credential_id: str,
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_admin)
):
    """Delete a credential."""
    await validate_te_org(organization)
    data = await make_api_request("DELETE", f"credentials/{credential_id}", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"message": "Credential deleted"}


# ============================================================================
# USAGE / QUOTAS (TE v7: /usage)
# ============================================================================

@router.get("/usage")
async def te_get_usage(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get account usage and quotas."""
    await validate_te_org(organization)
    data = await make_api_request("GET", "usage", aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# ============================================================================
# DASHBOARD SNAPSHOTS (TE v7: /dashboards/{id}/snapshot)
# ============================================================================

@router.post("/dashboards/{dashboard_id}/snapshot")
async def te_create_dashboard_snapshot(
    dashboard_id: str,
    organization: str = Query(...),
    body: Dict[str, Any] = Body(default={}),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_editor)
):
    """Create a snapshot of a dashboard."""
    await validate_te_org(organization)
    data = await make_api_request("POST", f"dashboards/{dashboard_id}/snapshot", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# ============================================================================
# ENDPOINT TEST RESULTS (TE v7: /endpoint-data/tests/...)
# ============================================================================

@router.post("/endpoint-data/tests/net-metrics/filter")
async def te_filter_endpoint_net_metrics(
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Filter endpoint network metrics (POST with filter body)."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "endpoint-data/tests/net-metrics/filter", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/endpoint-data/tests/http-server/filter")
async def te_filter_endpoint_http_server(
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Filter endpoint HTTP server results (POST with filter body)."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "endpoint-data/tests/http-server/filter", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


@router.post("/endpoint-data/tests/path-vis/filter")
async def te_filter_endpoint_path_vis(
    organization: str = Query(...),
    body: Dict[str, Any] = Body(...),
    aid: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Filter endpoint path visualization data (POST with filter body)."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "endpoint-data/tests/path-vis/filter", data=body, aid=aid)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data


# === DEBUG ENDPOINTS ===

@router.get("/debug-config")
async def debug_te_config():
    """Debug endpoint to check ThousandEyes config status."""
    from src.services.config_service import ConfigService
    import os

    config_service = ConfigService()

    # Check database config
    db_token = await config_service.get_config("thousandeyes_oauth_token")

    # Check environment variable
    env_token = os.environ.get("THOUSANDEYES_OAUTH_TOKEN")

    # Check via the async _get_te_token function
    resolved_token = await _get_te_token_async()

    # Check MCP config
    mcp_endpoint = await config_service.get_config("thousandeyes_mcp_endpoint")
    mcp_token = await config_service.get_config("thousandeyes_mcp_token")

    return {
        "thousandeyes": {
            "db_token_set": bool(db_token),
            "db_token_preview": db_token[:10] + "..." if db_token else None,
            "env_token_set": bool(env_token),
            "env_token_preview": env_token[:10] + "..." if env_token else None,
            "resolved_token_set": bool(resolved_token),
            "api_base_url": API_BASE_URL,
            "mcp_endpoint": mcp_endpoint,
            "mcp_token_set": bool(mcp_token),
        }
    }


# ============================================================================
# MCP-POWERED ENDPOINTS
# ============================================================================

@router.get("/mcp/status", dependencies=[Depends(require_viewer)])
async def te_mcp_status(organization: str = Query("default")):
    """Check if ThousandEyes MCP is configured and list available tools."""
    creds = await _get_te_mcp_creds()
    if not creds:
        return {"available": False, "tools": [], "message": "MCP not configured"}

    try:
        from mcp import ClientSession
        from mcp.client.stdio import stdio_client

        server_params = _get_te_mcp_client_params(creds["mcp_endpoint"], creds["token"], creds["verify_ssl"])

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_response = await session.list_tools()
                tool_names = [t.name for t in tools_response.tools]
                return {
                    "available": True,
                    "tools": tool_names,
                    "endpoint": creds["mcp_endpoint"],
                }
    except Exception as e:
        te_logger.error(f"Error checking MCP status: {e}")
        return {"available": False, "tools": [], "error": str(e)}


@router.get("/dashboards", dependencies=[Depends(require_viewer)])
async def te_list_dashboards(organization: str = Query("default")):
    """List ThousandEyes dashboards via MCP or REST fallback."""
    # Try MCP first
    creds = await _get_te_mcp_creds()
    if creds:
        try:
            result = await _call_te_mcp_tool("te_list_dashboards", {}, creds=creds)
            return {"dashboards": result}
        except Exception as e:
            te_logger.warning(f"MCP dashboard fetch failed, trying REST: {e}")

    # REST fallback
    await validate_te_config()
    data = await make_api_request("GET", "dashboards")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    dashboards = data.get("_embedded", {}).get("dashboards", data.get("dashboards", []))
    return {"dashboards": dashboards}


@router.get("/dashboards/{dashboard_id}", dependencies=[Depends(require_viewer)])
async def te_get_dashboard(dashboard_id: str, organization: str = Query("default")):
    """Get dashboard detail + widgets via MCP or REST fallback."""
    creds = await _get_te_mcp_creds()
    if creds:
        try:
            result = await _call_te_mcp_tool("te_get_dashboard", {"dashboard_id": dashboard_id}, creds=creds)
            return {"dashboard": result}
        except Exception as e:
            te_logger.warning(f"MCP dashboard detail failed, trying REST: {e}")

    await validate_te_config()
    data = await make_api_request("GET", f"dashboards/{dashboard_id}")
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return {"dashboard": data}


@router.get("/dashboards/{dashboard_id}/widgets/{widget_id}", dependencies=[Depends(require_viewer)])
async def te_get_dashboard_widget(dashboard_id: str, widget_id: str, organization: str = Query("default")):
    """Get widget data via MCP."""
    creds = await _get_te_mcp_creds()
    if creds:
        try:
            result = await _call_te_mcp_tool("te_get_dashboard_widget", {
                "dashboard_id": dashboard_id,
                "widget_id": widget_id,
            }, creds=creds)
            return {"widget": result}
        except Exception as e:
            te_logger.warning(f"MCP widget fetch failed: {e}")
            raise HTTPException(status_code=500, detail=f"Widget fetch failed: {str(e)}")

    raise HTTPException(status_code=503, detail="MCP not configured. Dashboard widgets require MCP.")


@router.get("/mcp/path-vis/{test_id}", dependencies=[Depends(require_viewer)])
async def te_mcp_path_vis(test_id: str, organization: str = Query("default")):
    """Get path visualization via MCP for richer data."""
    try:
        result = await _call_te_mcp_tool("te_get_path_vis", {"test_id": test_id})
        return {"path_vis": result}
    except HTTPException:
        raise
    except Exception as e:
        te_logger.error(f"MCP path vis error: {e}")
        raise HTTPException(status_code=500, detail=f"MCP path vis failed: {str(e)}")


@router.post("/cross-platform/correlate", dependencies=[Depends(require_viewer)])
async def te_cross_platform_correlate(request: Dict[str, Any] = Body(...)):
    """Cross-reference ThousandEyes agent IPs with Splunk logs and Meraki/Catalyst devices."""
    agent_ips = request.get("agent_ips", [])
    alert_ips = request.get("alert_ips", [])

    all_ips = list(set(agent_ips + alert_ips))
    if not all_ips:
        return {"correlatedDevices": [], "splunkMatches": []}

    result = {"correlatedDevices": [], "splunkMatches": []}

    try:
        # Check Splunk for matching logs
        from src.services.config_service import ConfigService
        config_service = ConfigService()
        splunk_url = await config_service.get_config("splunk_api_url")
        splunk_token = await config_service.get_config("splunk_bearer_token")

        if splunk_url and splunk_token:
            # Query Splunk for events matching these IPs
            ip_filter = " OR ".join(f'host="{ip}"' for ip in all_ips[:20])
            try:
                from src.api.routes.splunk import _call_splunk_tool
                splunk_result = await _call_splunk_tool("splunk_run_query", {
                    "query": f"search ({ip_filter}) | stats count by host | sort -count",
                    "earliest_time": "-24h",
                    "latest_time": "now",
                    "max_results": 50,
                })
                if isinstance(splunk_result, list):
                    result["splunkMatches"] = splunk_result
                elif isinstance(splunk_result, dict):
                    result["splunkMatches"] = [splunk_result]
            except Exception as e:
                te_logger.warning(f"Splunk correlation query failed: {e}")

        # Check network cache for device matches
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            cache_response = await client.get(
                "https://localhost:8002/api/network/cache",
                headers={"Content-Type": "application/json"},
            )
            if cache_response.status_code == 200:
                cache_data = cache_response.json()
                search_ips = set(ip.lower() for ip in all_ips)

                for org in cache_data.get("organizations", []):
                    for net in org.get("networks", []):
                        for dev in net.get("devices", []):
                            dev_ip = (dev.get("lanIp") or dev.get("wan1Ip") or dev.get("managementIpAddress") or "").lower()
                            if dev_ip in search_ips:
                                result["correlatedDevices"].append({
                                    "ip": dev_ip,
                                    "hostname": dev.get("name") or dev.get("hostname"),
                                    "platform": "meraki" if dev.get("serial") else "catalyst",
                                    "device": dev,
                                    "networkName": net.get("name"),
                                })

    except Exception as e:
        te_logger.error(f"Cross-platform correlation error: {e}")

    return result