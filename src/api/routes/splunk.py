# src/api/routes/splunk.py
"""Splunk MCP Server integration for log search and analysis."""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import Dict, Any, Optional, List
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import logging
import json
import os
import httpx
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/splunk", tags=["splunk"])

# Import credential manager and RBAC dependency
from src.api.dependencies import credential_manager, require_viewer
from src.services.splunk_insight_service import SplunkInsightService
from src.services.config_service import ConfigService


async def validate_splunk_config():
    """Validate Splunk is configured via system_config or environment."""
    logger.info("[Splunk Config v3] Starting validation...")

    # Create fresh instance to avoid caching issues
    config_service = ConfigService()

    # Get Splunk config from system_config
    api_url = await config_service.get_config("splunk_api_url")
    bearer_token = await config_service.get_config("splunk_bearer_token")

    logger.info(f"[Splunk Config v3] api_url={bool(api_url)}, bearer_token={bool(bearer_token)}")

    # Use default localhost URL if not configured but credentials exist
    if not api_url and bearer_token:
        api_url = "https://localhost:8089"
        logger.info("[Splunk Config] Using default localhost URL")

    # Check if we have valid credentials (bearer token required)
    if api_url and bearer_token:
        logger.info(f"[Splunk Config] Valid config found: {api_url}")
        return {
            "base_url": api_url,
            "api_key": bearer_token,
            "verify_ssl": False,  # Default to False for localhost
        }

    logger.warning("[Splunk Config] Not configured - missing api_url or bearer_token")
    raise HTTPException(
        status_code=503,
        detail="Splunk is not configured. Add credentials in Admin > System Config."
    )


async def validate_splunk_org(organization: str = None):
    """Validate Splunk config (organization parameter ignored, kept for compatibility)."""
    config = await validate_splunk_config()
    # Return (credentials, cluster) tuple for backward compatibility
    # cluster is None since we're using system_config
    return config, None


def get_mcp_client_params(base_url: str, token: str, verify_ssl: bool = True) -> StdioServerParameters:
    """Get MCP client parameters for Splunk MCP server.

    Args:
        base_url: Base URL of Splunk instance (e.g., https://localhost:8089)
        token: Splunk auth token for authentication
        verify_ssl: Whether to verify SSL certificates

    Returns:
        StdioServerParameters for connecting to Splunk MCP server
    """
    import os
    import shutil

    mcp_endpoint = f"{base_url.rstrip('/')}/services/mcp"

    # Find npx executable - try common locations
    npx_path = shutil.which("npx")
    if not npx_path:
        # Try homebrew location on macOS
        homebrew_npx = "/opt/homebrew/bin/npx"
        if os.path.exists(homebrew_npx):
            npx_path = homebrew_npx
        else:
            # Try standard locations
            for path in ["/usr/local/bin/npx", "/usr/bin/npx"]:
                if os.path.exists(path):
                    npx_path = path
                    break

    if not npx_path:
        raise FileNotFoundError("npx not found. Please ensure Node.js and npm are installed.")

    logger.info(f"Using npx at: {npx_path}")

    # Set up environment variables for SSL handling and PATH
    env = os.environ.copy()
    if not verify_ssl and base_url.startswith('https'):
        # Disable SSL verification for self-signed certificates
        env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
        logger.info(f"SSL verification disabled for {mcp_endpoint}")

    # Configure MCP client to connect to Splunk MCP server via npx mcp-remote
    return StdioServerParameters(
        command=npx_path,
        args=[
            "-y",
            "mcp-remote",
            mcp_endpoint,
            "--header",
            f"Authorization: Splunk {token}"
        ],
        env=env
    )


@router.post("/search", dependencies=[Depends(require_viewer)])
async def search_splunk_logs(
    organization: str = Query(...),
    request: Dict[str, Any] = Body(...)
):
    """Search Splunk logs with SPL query using MCP server."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    # Auto-disable SSL verification for localhost URLs (common for local Splunk instances)
    is_localhost = 'localhost' in base_url or '127.0.0.1' in base_url
    verify_ssl = False if is_localhost else (cluster.verify_ssl if cluster else True)
    logger.info(f"Splunk connection: {base_url}, verify_ssl={verify_ssl}")

    search_query = request.get("search", "search index=* | head 100")
    earliest_time = request.get("earliest_time", "-1h")
    latest_time = request.get("latest_time", "now")
    max_results = request.get("max_results", 1000)

    try:
        # Connect to Splunk MCP server using async context manager
        server_params = get_mcp_client_params(base_url, token, verify_ssl)
        logger.info(f"Connecting to Splunk MCP server at {base_url}/services/mcp")

        async with stdio_client(server_params) as (read, write):
            logger.info("STDIO client connected")
            async with ClientSession(read, write) as session:
                logger.info("ClientSession created")

                try:
                    init_result = await session.initialize()
                    logger.info(f"Session initialized: {init_result}")
                except Exception as init_error:
                    logger.error(f"Initialization error: {type(init_error).__name__}: {str(init_error)}")
                    raise

                # List available tools to find search capability
                logger.info("Listing available tools")
                try:
                    tools_response = await session.list_tools()
                    logger.info(f"Available Splunk MCP tools: {[tool.name for tool in tools_response.tools]}")
                except Exception as list_error:
                    logger.error(f"Error listing tools: {type(list_error).__name__}: {str(list_error)}")
                    raise

                # Look for search tool - the Splunk MCP server uses 'run_splunk_query'
                search_tool = None
                for tool in tools_response.tools:
                    if "query" in tool.name.lower() or "search" in tool.name.lower():
                        search_tool = tool.name
                        break

                if not search_tool:
                    logger.warning("No search tool found, trying common tool names")
                    # Try common tool names - 'run_splunk_query' is the correct name for Splunk MCP
                    for common_name in ["run_splunk_query", "search", "run_search", "execute_search", "spl_search"]:
                        try:
                            result = await session.call_tool(
                                common_name,
                                arguments={
                                    "query": search_query,
                                    "earliest_time": earliest_time,
                                    "latest_time": latest_time,
                                    "max_results": max_results
                                }
                            )
                            return {"results": result.content}
                        except Exception as e:
                            logger.debug(f"Tool {common_name} not available: {e}")
                            continue

                    raise HTTPException(
                        status_code=501,
                        detail="Search tool not found in Splunk MCP server"
                    )

                # Call the search tool
                logger.info(f"Calling tool: {search_tool}")
                result = await session.call_tool(
                    search_tool,
                    arguments={
                        "query": search_query,
                        "earliest_time": earliest_time,
                        "latest_time": latest_time,
                        "max_results": max_results
                    }
                )
                logger.info(f"Tool call successful, got {len(result.content)} content items")

                return {"results": result.content}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Splunk MCP search error: {type(e).__name__}: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        raise HTTPException(status_code=500, detail=f"Search failed: {type(e).__name__}: {str(e)}")


@router.post("/search/ai", dependencies=[Depends(require_viewer)])
async def search_splunk_with_ai(
    organization: str = Query(...),
    request: Dict[str, Any] = Body(...)
):
    """Search Splunk using AI to generate SPL query from natural language."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    is_localhost = 'localhost' in base_url or '127.0.0.1' in base_url
    verify_ssl = False if is_localhost else (cluster.verify_ssl if cluster else True)

    prompt = request.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        server_params = get_mcp_client_params(base_url, token, verify_ssl)

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # List available tools
                tools_response = await session.list_tools()

                # Look for AI/NLP search tool
                ai_search_tool = None
                for tool in tools_response.tools:
                    if any(keyword in tool.name.lower() for keyword in ["ai", "nlp", "natural", "generate"]):
                        ai_search_tool = tool.name
                        break

                if not ai_search_tool:
                    # Fallback: Use regular search with prompt as-is
                    logger.info("No AI search tool found, using regular search")
                    result = await session.call_tool(
                        "search",
                        arguments={
                            "query": f"search {prompt}",
                            "earliest_time": "-1h",
                            "latest_time": "now",
                            "max_results": 100
                        }
                    )
                    return {
                        "message": "AI-powered search not available, using literal search",
                        "prompt": prompt,
                        "results": result.content
                    }

                # Call AI search tool
                result = await session.call_tool(
                    ai_search_tool,
                    arguments={"prompt": prompt}
                )

                return {
                    "message": "AI-powered search executed",
                    "prompt": prompt,
                    "results": result.content
                }

    except Exception as e:
        logger.error(f"Splunk AI search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI search failed: {str(e)}")


@router.get("/saved-searches", dependencies=[Depends(require_viewer)])
async def get_saved_searches(organization: str = Query(...)):
    """Get saved searches from Splunk using MCP server."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    verify_ssl = cluster.verify_ssl if cluster else True

    try:
        server_params = get_mcp_client_params(base_url, token, verify_ssl)

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # List available resources - saved searches might be exposed as resources
                resources_response = await session.list_resources()
                logger.info(f"Available resources: {[r.uri for r in resources_response.resources]}")

                # Look for saved searches resource
                saved_searches_uri = None
                for resource in resources_response.resources:
                    if "saved" in resource.uri.lower() or "search" in resource.uri.lower():
                        saved_searches_uri = resource.uri
                        break

                if saved_searches_uri:
                    content = await session.read_resource(saved_searches_uri)
                    return {"saved_searches": content}

                # If no resource, try tool-based approach
                tools_response = await session.list_tools()
                for tool in tools_response.tools:
                    if "saved" in tool.name.lower() and "search" in tool.name.lower():
                        result = await session.call_tool(tool.name, arguments={})
                        return {"saved_searches": result.content}

                return {"saved_searches": [], "message": "No saved searches endpoint found"}

    except Exception as e:
        logger.error(f"Error fetching saved searches: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get saved searches: {str(e)}")


@router.get("/alerts", dependencies=[Depends(require_viewer)])
async def get_splunk_alerts(organization: str = Query(...)):
    """Get alerts from Splunk using MCP server."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    verify_ssl = cluster.verify_ssl if cluster else True

    try:
        server_params = get_mcp_client_params(base_url, token, verify_ssl)

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Try to find alerts tool or resource
                tools_response = await session.list_tools()

                # Look for alerts tool
                alerts_tool = None
                for tool in tools_response.tools:
                    if "alert" in tool.name.lower():
                        alerts_tool = tool.name
                        break

                if alerts_tool:
                    result = await session.call_tool(alerts_tool, arguments={})
                    return {"alerts": result.content}

                # Try resources
                resources_response = await session.list_resources()
                for resource in resources_response.resources:
                    if "alert" in resource.uri.lower():
                        content = await session.read_resource(resource.uri)
                        return {"alerts": content}

                return {"alerts": [], "message": "No alerts endpoint found"}

    except Exception as e:
        logger.error(f"Error fetching alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.get("/debug/event-count", dependencies=[Depends(require_viewer)])
async def debug_event_count(organization: str = Query(...)):
    """Debug endpoint to check event counts across different time ranges."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    verify_ssl = cluster.verify_ssl if cluster else True

    results = {}

    try:
        # Splunk uses "Splunk {token}" format for token auth, not "Bearer"
        headers = {
            "Authorization": f"Splunk {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        async with httpx.AsyncClient(verify=verify_ssl, timeout=60.0) as client:
            # Check event counts for different time ranges
            time_ranges = ["-1h", "-6h", "-24h", "-7d", "-30d"]

            for time_range in time_ranges:
                search_query = f"search earliest={time_range} index=* | stats count"
                create_response = await client.post(
                    f"{base_url}/services/search/jobs",
                    headers=headers,
                    data={"search": search_query, "output_mode": "json"},
                )

                if create_response.status_code in [200, 201]:
                    job_data = create_response.json()
                    job_id = job_data.get("sid")

                    if job_id:
                        # Poll for completion
                        import asyncio
                        for _ in range(15):
                            status_response = await client.get(
                                f"{base_url}/services/search/jobs/{job_id}",
                                headers=headers,
                                params={"output_mode": "json"},
                            )
                            if status_response.status_code == 200:
                                status_data = status_response.json()
                                if status_data.get("entry", [{}])[0].get("content", {}).get("isDone"):
                                    break
                            await asyncio.sleep(0.5)

                        # Get results
                        results_response = await client.get(
                            f"{base_url}/services/search/jobs/{job_id}/results",
                            headers=headers,
                            params={"output_mode": "json"},
                        )

                        if results_response.status_code == 200:
                            data = results_response.json()
                            count = data.get("results", [{}])[0].get("count", "0")
                            results[time_range] = int(count)

                        # Cleanup
                        await client.delete(f"{base_url}/services/search/jobs/{job_id}", headers=headers)

            # Also get index breakdown
            index_query = "search earliest=-30d index=* | stats count by index | sort -count"
            create_response = await client.post(
                f"{base_url}/services/search/jobs",
                headers=headers,
                data={"search": index_query, "output_mode": "json"},
            )

            if create_response.status_code in [200, 201]:
                job_id = create_response.json().get("sid")
                if job_id:
                    import asyncio
                    for _ in range(15):
                        status_response = await client.get(
                            f"{base_url}/services/search/jobs/{job_id}",
                            headers=headers,
                            params={"output_mode": "json"},
                        )
                        if status_response.status_code == 200:
                            if status_response.json().get("entry", [{}])[0].get("content", {}).get("isDone"):
                                break
                        await asyncio.sleep(0.5)

                    results_response = await client.get(
                        f"{base_url}/services/search/jobs/{job_id}/results",
                        headers=headers,
                        params={"output_mode": "json"},
                    )

                    if results_response.status_code == 200:
                        data = results_response.json()
                        results["indexes"] = data.get("results", [])

                    await client.delete(f"{base_url}/services/search/jobs/{job_id}", headers=headers)

        return {
            "organization": organization,
            "event_counts_by_time_range": {k: v for k, v in results.items() if k != "indexes"},
            "events_by_index": results.get("indexes", []),
        }

    except Exception as e:
        logger.error(f"Debug event count error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indexes", dependencies=[Depends(require_viewer)])
async def get_splunk_indexes(organization: str = Query(...)):
    """Get available indexes from Splunk using MCP server."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    verify_ssl = cluster.verify_ssl if cluster else True

    try:
        server_params = get_mcp_client_params(base_url, token, verify_ssl)

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # Try to find indexes tool or resource
                tools_response = await session.list_tools()

                # Look for indexes tool
                indexes_tool = None
                for tool in tools_response.tools:
                    if "index" in tool.name.lower():
                        indexes_tool = tool.name
                        break

                if indexes_tool:
                    result = await session.call_tool(indexes_tool, arguments={})
                    return {"indexes": result.content}

                # Try resources
                resources_response = await session.list_resources()
                for resource in resources_response.resources:
                    if "index" in resource.uri.lower():
                        content = await session.read_resource(resource.uri)
                        return {"indexes": content}

                return {"indexes": [], "message": "No indexes endpoint found"}

    except Exception as e:
        logger.error(f"Error fetching indexes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get indexes: {str(e)}")


@router.get("/tools", dependencies=[Depends(require_viewer)])
async def list_splunk_mcp_tools(organization: str = Query(...)):
    """List available MCP tools from Splunk MCP server (for debugging/discovery)."""
    creds, cluster = await validate_splunk_org(organization)

    base_url = creds.get("base_url", cluster.url if cluster else "https://localhost:8089")
    token = creds["api_key"]
    verify_ssl = cluster.verify_ssl if cluster else True

    try:
        server_params = get_mcp_client_params(base_url, token, verify_ssl)

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                tools_response = await session.list_tools()
                resources_response = await session.list_resources()

                return {
                    "tools": [
                        {
                            "name": tool.name,
                            "description": tool.description,
                            "inputSchema": tool.inputSchema
                        }
                        for tool in tools_response.tools
                    ],
                    "resources": [
                        {
                            "uri": resource.uri,
                            "name": resource.name,
                            "description": resource.description,
                            "mimeType": resource.mimeType
                        }
                        for resource in resources_response.resources
                    ]
                }

    except Exception as e:
        logger.error(f"Error listing MCP tools: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list MCP tools: {str(e)}")


# ============================================================================
# INSIGHT CARD ENDPOINTS
# These endpoints manage AI-generated summary cards for Splunk logs
# ============================================================================

async def get_insight_service(preferred_model: str = None) -> Optional[SplunkInsightService]:
    """Get the Splunk insight service using user's configured AI provider.

    Uses centralized get_configured_ai_provider() for consistent priority:
    1. User's preferred model (if provided and that provider is configured)
    2. Cisco Circuit (if client_id and client_secret are set)
    3. Anthropic (Claude)
    4. OpenAI (GPT)
    5. Google (Gemini)

    Args:
        preferred_model: Optional user-preferred model (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")

    Returns None if no AI provider is configured.
    """
    from src.services.config_service import get_configured_ai_provider

    config = await get_configured_ai_provider(preferred_model=preferred_model)
    if not config:
        logger.warning("[Insight Service] No AI provider configured")
        return None

    provider = config["provider"]
    model = config["model"]
    logger.info(f"[Insight Service] Using {provider} ({model}) for AI insights")

    if provider == "cisco":
        return SplunkInsightService(
            provider="cisco",
            model=model,
            client_id=config["client_id"],
            client_secret=config["client_secret"],
            app_key=config.get("app_key"),
        )
    else:
        # Anthropic, OpenAI, and Google all use api_key
        return SplunkInsightService(
            provider=provider,
            model=model,
            api_key=config["api_key"],
        )


@router.get("/debug-config")
async def debug_splunk_config():
    """Debug endpoint to check Splunk config and AI provider status."""
    from src.services.config_service import get_configured_ai_provider

    config_service = ConfigService()

    api_url = await config_service.get_config("splunk_api_url")
    bearer_token = await config_service.get_config("splunk_bearer_token")

    # Get configured AI provider using centralized function
    ai_config = await get_configured_ai_provider()

    return {
        "splunk": {
            "api_url_set": bool(api_url),
            "api_url_preview": api_url[:20] + "..." if api_url else None,
            "bearer_token_set": bool(bearer_token),
            "bearer_token_preview": bearer_token[:10] + "..." if bearer_token else None,
        },
        "ai_provider": {
            "selected": ai_config["provider"] if ai_config else None,
            "model": ai_config["model"] if ai_config else None,
            "configured": bool(ai_config),
        }
    }


@router.get("/insights", dependencies=[Depends(require_viewer)])
async def get_insights(
    organization: Optional[str] = Query(None, description="Filter by organization"),
    search_query: Optional[str] = Query(None, description="Filter by search query"),
    time_range: Optional[str] = Query(None, description="Filter by time range"),
    limit: int = Query(50, ge=1, le=200, description="Maximum insights to return"),
):
    """Get stored Splunk log insight cards from database.

    Returns AI-generated summary cards that categorize and summarize Splunk logs.
    """
    logger.info("[Insights Endpoint] Starting request...")

    # Check if Splunk is configured before returning insights
    try:
        config = await validate_splunk_config()
        logger.info(f"[Insights Endpoint] Config validated: {config.get('base_url')}")
    except HTTPException as e:
        logger.error(f"[Insights Endpoint] Config validation failed: {e.detail}")
        raise

    try:
        service = await get_insight_service()
        if not service:
            logger.warning("[Insights Endpoint] No AI provider configured")
            raise HTTPException(
                status_code=503,
                detail="AI insights require an AI provider to be configured. Please configure Cisco Circuit, Anthropic, OpenAI, or Google in Admin > System Config."
            )
        logger.info("[Insights Endpoint] Got insight service, fetching insights...")
        insights = await service.get_insights(
            organization=organization,
            search_query=search_query,
            time_range=time_range,
            limit=limit,
        )
        logger.info(f"[Insights Endpoint] Returning {len(insights)} insights")
        return {"insights": insights, "count": len(insights)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get insights: {str(e)}")


@router.post("/insights/generate", dependencies=[Depends(require_viewer)])
async def generate_insights(
    organization: str = Query(..., description="Splunk organization name"),
    request: Dict[str, Any] = Body(default={}),
):
    """Generate new insight cards from Splunk logs.

    Fetches logs from Splunk, uses AI to categorize them into summary cards,
    and stores them in the database. Previous cards for this org/query are replaced.

    If no search_query is provided, uses a default that targets Meraki syslog events.
    """
    # Pass None if not provided - let the service use its Meraki-specific default
    search_query = request.get("search_query") or None
    time_range = request.get("time_range", "-24h")
    max_logs = request.get("max_logs", 100)

    try:
        service = await get_insight_service()
        if not service:
            raise HTTPException(
                status_code=503,
                detail="AI insights require an AI provider to be configured. Please configure Cisco Circuit, Anthropic, OpenAI, or Google in Admin > System Config."
            )

        insight_ids = await service.generate_insights(
            organization=organization,
            search_query=search_query,
            time_range=time_range,
            max_logs=max_logs,
        )

        # Fetch the created insights to return them
        insights = await service.get_insights(
            organization=organization,
            search_query=search_query,
            time_range=time_range,
        )

        return {
            "message": f"Generated {len(insight_ids)} insight cards",
            "insight_ids": insight_ids,
            "insights": insights,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {str(e)}")


@router.delete("/insights", dependencies=[Depends(require_viewer)])
async def delete_insights(
    organization: Optional[str] = Query(None, description="Filter by organization"),
    search_query: Optional[str] = Query(None, description="Filter by search query"),
    time_range: Optional[str] = Query(None, description="Filter by time range"),
):
    """Delete insight cards from database.

    Can filter by organization, search query, and/or time range.
    If no filters provided, deletes ALL insights.
    """
    try:
        service = await get_insight_service()
        if not service:
            raise HTTPException(
                status_code=503,
                detail="AI insights require an AI provider to be configured."
            )
        deleted_count = await service.delete_insights(
            organization=organization,
            search_query=search_query,
            time_range=time_range,
        )
        return {"message": f"Deleted {deleted_count} insights", "deleted_count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete insights: {str(e)}")
