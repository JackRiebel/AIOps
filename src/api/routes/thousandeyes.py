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
                    ip = d.get("lanIp") or d.get("wan1Ip") or d.get("publicIp") or ""
                    if ip:
                        dev_parts.append(f"{name} ({ip})")
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


@router.post("/tests/ai")
async def te_create_test_from_ai(
    organization: str = Query(...),
    request: Dict[str, Any] = Body(...),
    _: Any = Depends(require_editor)
):
    """Create a ThousandEyes test using AI to interpret natural language.

    Takes a natural language prompt describing what to test and uses AI
    to generate the appropriate test configuration.
    """
    await validate_te_org(organization)

    prompt = request.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Use multi-provider AI (async, works with database config)
    from src.services.multi_provider_ai import generate_text
    from src.services.config_service import get_configured_ai_provider

    # Check if AI is configured
    ai_config = await get_configured_ai_provider()
    if not ai_config:
        raise HTTPException(status_code=503, detail="AI service not configured. Please configure an AI provider in Admin > System Config.")

    # Build infrastructure context from cached network/device data
    infra_context = await _build_infrastructure_context()

    # Rebuild with smaller limits if prompt would be too long
    if infra_context and len(infra_context) > 3000:
        infra_context = await _build_infrastructure_context(max_networks=10, max_devices_per_net=2)

    # Fetch available ThousandEyes agents
    agents_context, available_agents = await _get_te_agents_context()

    infra_block = ""
    if infra_context:
        infra_block += f"\n\n{infra_context}\n"
    if agents_context:
        infra_block += f"\n{agents_context}\n"

    # Build the AI prompt to generate test configuration
    ai_prompt = f"""You are a ThousandEyes test configuration expert. Based on the user's request, generate a valid ThousandEyes API v7 test configuration JSON.
{infra_block}
USER REQUEST: {prompt}

Generate a JSON object for ONE of these test types based on the request:
1. **HTTP Server Test** (for website/API monitoring):
   {{"testName": "...", "type": "http-server", "url": "https://...", "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

2. **Page Load Test** (for full page performance):
   {{"testName": "...", "type": "page-load", "url": "https://...", "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

3. **Network Test** (for connectivity/latency between sites):
   {{"testName": "...", "type": "agent-to-server", "server": "IP or hostname", "port": 443, "protocol": "TCP", "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

4. **DNS Test** (for DNS resolution):
   {{"testName": "...", "type": "dns-server", "domain": "example.com", "dnsServers": [{{"serverName": "8.8.8.8"}}], "interval": 300, "alertsEnabled": true, "agents": [{{"agentId": "..."}}]}}

Rules:
- REQUIRED: Include "agents" array with at least one agent from the AVAILABLE THOUSANDEYES AGENTS list above. Each agent entry must be {{"agentId": "<id>"}}.
- For connectivity between two sites, place the agent at the SOURCE site and set "server" to the TARGET site's IP.
- If user references a network or device from the infrastructure context, use the corresponding IP address as the server/target.
- Pick enterprise agents over cloud agents when they are at or near the relevant site.
- Use interval of 300 (5 minutes) unless user specifies otherwise.
- Always enable alerts.
- Generate a descriptive testName.
- Only return the JSON object, no explanation.

JSON:"""

    # Final prompt length guard
    if len(ai_prompt) > 8000:
        infra_context = await _build_infrastructure_context(max_networks=10, max_devices_per_net=2)
        infra_block = f"\n\n{infra_context}\n" if infra_context else ""
        if agents_context:
            infra_block += f"\n{agents_context}\n"
        ai_prompt = ai_prompt[:ai_prompt.index("USER REQUEST")] + f"USER REQUEST: {prompt}" + ai_prompt[ai_prompt.rindex("\n\nJSON:"):]

    try:
        # Generate test configuration using AI
        result = await generate_text(ai_prompt, max_tokens=800)

        if not result:
            raise HTTPException(status_code=503, detail="AI provider returned no response")

        ai_response = result.get("text", "")
        te_logger.info(f"AI test creation response: {ai_response[:500]}")

        # Parse the JSON from AI response
        import json

        # Extract JSON from response (handle markdown code blocks, nested objects)
        # Try to find outermost { ... } pair with brace matching
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

        # Ensure agents are present — ThousandEyes API requires at least one agent
        if "agents" not in test_config or not test_config["agents"]:
            if available_agents:
                # Prefer enterprise agents, fall back to first available
                enterprise = [a for a in available_agents if a["agentType"] == "enterprise"]
                chosen = enterprise[:3] if enterprise else available_agents[:3]
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
    if active_only:
        if "_embedded" in data and "alerts" in data["_embedded"]:
            data["_embedded"]["alerts"] = [a for a in data["_embedded"]["alerts"] if a.get("active") == 1]
        elif "alerts" in data:
            data["alerts"] = [a for a in data["alerts"] if a.get("active") == 1]

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

@router.get("/outages")
async def te_get_outages(
    organization: str = Query(...),
    aid: Optional[str] = Query(None),
    window: Optional[str] = Query(None),
    outage_type: Optional[str] = Query(None, alias="type"),
    _: Any = Depends(require_viewer)
):
    """Search ThousandEyes outages (application/network)."""
    await validate_te_org(organization)
    params = {}
    if aid: params["aid"] = aid
    if window: params["window"] = window
    if outage_type: params["type"] = outage_type
    data = await make_api_request("GET", "outages", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === INSTANT TESTS ENDPOINT ===

@router.post("/instant-tests")
async def te_run_instant_test(
    organization: str = Query(...),
    test_config: Dict[str, Any] = Body(...),
    _: Any = Depends(require_operator)
):
    """Run an instant test."""
    await validate_te_org(organization)
    data = await make_api_request("POST", "instant-tests", data=test_config)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === ANOMALIES ENDPOINT ===

@router.get("/tests/{test_id}/anomalies")
async def te_get_test_anomalies(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    metric: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get anomalies for a specific test."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    if metric: params["metric"] = metric
    data = await make_api_request("GET", f"tests/{test_id}/anomalies", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

# === METRICS ENDPOINT ===

@router.get("/tests/{test_id}/metrics")
async def te_get_test_metrics(
    test_id: str,
    organization: str = Query(...),
    window: Optional[str] = Query(None),
    metric: Optional[str] = Query(None),
    _: Any = Depends(require_viewer)
):
    """Get aggregated metrics for a specific test."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    if metric: params["metric"] = metric
    data = await make_api_request("GET", f"test-results/{test_id}/metrics", params=params)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

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
    _: Any = Depends(require_viewer)
):
    """List endpoint scheduled tests."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("GET", "endpoint/tests")
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
    """Get endpoint test detail."""
    await validate_te_org(organization)
    try:
        data = await make_api_request("GET", f"endpoint/tests/{test_id}")
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
    _: Any = Depends(require_viewer)
):
    """Get Internet Insights outage feed."""
    await validate_te_org(organization)
    params = {}
    if window: params["window"] = window
    try:
        data = await make_api_request("GET", "internet-insights/outages", params=params)
        if "error" in data:
            raise HTTPException(status_code=500, detail=data["error"])
        return data
    except HTTPException:
        raise
    except Exception:
        return {"outages": [], "_embedded": {"outages": []}}

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