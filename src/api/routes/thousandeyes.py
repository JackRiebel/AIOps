"""ThousandEyes API router — 100% self-contained, no external MCP imports."""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import List, Dict, Any, Optional
import httpx
import json
import os
from pydantic import BaseModel

from src.api.dependencies import require_viewer, require_editor, require_operator, require_admin
from src.config.settings import get_settings

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

# === All ThousandEyes API Functions (formerly @mcp.tool) ===

async def get_endpoint_agents(aid: Optional[str] = None, max_results: Optional[int] = None, expand: Optional[List[str]] = None) -> str:
    params = {}
    if aid: params["aid"] = aid
    if max_results: params["maxResults"] = max_results
    if expand: params["expand"] = ",".join(expand)
    data = await make_api_request("GET", "endpoint-agents", params=params)
    return json.dumps(data, indent=2)

async def get_endpoint_agent(agent_id: str, expand: Optional[List[str]] = None) -> str:
    params = {"expand": ",".join(expand)} if expand else {}
    data = await make_api_request("GET", f"endpoint-agents/{agent_id}", params=params)
    return json.dumps(data, indent=2)

async def update_endpoint_agent(agent_id: str, update_data: Dict[str, Any]) -> str:
    data = await make_api_request("PATCH", f"endpoint-agents/{agent_id}", data=update_data)
    return json.dumps(data, indent=2)

async def delete_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("DELETE", f"endpoint-agents/{agent_id}")
    return json.dumps(data, indent=2)

async def enable_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("POST", f"endpoint-agents/{agent_id}/enable")
    return json.dumps(data, indent=2)

async def disable_endpoint_agent(agent_id: str) -> str:
    data = await make_api_request("POST", f"endpoint-agents/{agent_id}/disable")
    return json.dumps(data, indent=2)

async def get_endpoint_agents_connection_string(aid: Optional[str] = None) -> str:
    params = {"aid": aid} if aid else {}
    data = await make_api_request("GET", "endpoint-agents/connection-string", params=params)
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
    data = await make_api_request("POST", "tests", data=test_data)
    if "error" in data:
        raise HTTPException(status_code=500, detail=data["error"])
    return data

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
    if active_only and "alerts" in data:
        data["alerts"] = [alert for alert in data["alerts"] if alert.get("active") == 1]

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

    return {
        "thousandeyes": {
            "db_token_set": bool(db_token),
            "db_token_preview": db_token[:10] + "..." if db_token else None,
            "env_token_set": bool(env_token),
            "env_token_preview": env_token[:10] + "..." if env_token else None,
            "resolved_token_set": bool(resolved_token),
            "api_base_url": API_BASE_URL,
        }
    }