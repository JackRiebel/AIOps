# src/api/routes/splunk.py
"""Splunk MCP Server integration for log search and analysis."""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import Dict, Any, Optional, List, Tuple
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

# Limit concurrent MCP subprocess connections to prevent resource exhaustion.
# Each MCP call spawns an `npx mcp-remote` subprocess (Node.js + WebSocket).
_mcp_semaphore = asyncio.Semaphore(3)
MCP_TIMEOUT_SECONDS = 60


# ============================================================================
# MCP Helper Functions
# ============================================================================

async def _get_mcp_creds() -> dict:
    """Get validated Splunk credentials for MCP connection."""
    config = await validate_splunk_config()
    base_url = config.get("base_url", "https://localhost:8089")
    token = config["api_key"]
    is_localhost = 'localhost' in base_url or '127.0.0.1' in base_url

    # Check for MCP-specific config from system_config
    config_service = ConfigService()
    mcp_endpoint = await config_service.get_config("splunk_mcp_endpoint")
    mcp_token = await config_service.get_config("splunk_mcp_token")
    verify_ssl_config = await config_service.get_config("splunk_verify_ssl")

    if verify_ssl_config is not None:
        verify_ssl = str(verify_ssl_config).lower() in ('true', '1', 'yes')
    else:
        verify_ssl = not is_localhost

    # MCP token is required for MCP connections (different from regular Splunk token)
    if not mcp_token:
        raise HTTPException(
            status_code=503,
            detail="Splunk MCP token not configured. Create an encrypted token in Splunk > MCP Server, then add it in Admin > System Config."
        )

    return {
        "base_url": base_url,
        "token": token,
        "mcp_token": mcp_token,  # MCP-specific encrypted token
        "verify_ssl": verify_ssl,
        "mcp_endpoint": mcp_endpoint,  # None if not configured
    }


async def _call_splunk_tool(tool_name: str, arguments: dict = {}, creds: dict = None) -> Any:
    """Call a single MCP tool on the Splunk MCP server.

    Args:
        tool_name: Name of the MCP tool to call
        arguments: Arguments to pass to the tool
        creds: Optional pre-fetched credentials dict with base_url, token, verify_ssl

    Returns:
        Parsed content from the tool call result

    Raises:
        HTTPException 503 if MCP server is unreachable or npx not found
        HTTPException 501 if the tool is not found
        HTTPException 500 on other errors
    """
    if creds is None:
        creds = await _get_mcp_creds()

    try:
        server_params = get_mcp_client_params(
            creds["base_url"], creds["token"], creds["verify_ssl"],
            mcp_endpoint=creds.get("mcp_endpoint"),
            mcp_token=creds.get("mcp_token"),
        )
    except (FileNotFoundError, OSError) as e:
        raise HTTPException(status_code=503, detail=f"MCP runtime not available: {str(e)}")

    try:
        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()

                        # Verify tool exists and get its schema
                        tools_response = await session.list_tools()
                        tool = next((t for t in tools_response.tools if t.name == tool_name), None)
                        if not tool:
                            tool_names = [t.name for t in tools_response.tools]
                            raise HTTPException(
                                status_code=501,
                                detail=f"Tool '{tool_name}' not found. Available: {tool_names}"
                            )

                        # Map arguments to match tool's expected parameter names
                        mapped_args = _map_tool_arguments(tool, arguments)
                        tool_schema = getattr(tool, 'inputSchema', {})
                        expected_props = list(tool_schema.get('properties', {}).keys()) if isinstance(tool_schema, dict) else []
                        logger.info(f"MCP tool {tool_name}: input={list(arguments.keys())} -> mapped={list(mapped_args.keys())} (tool expects: {expected_props})")

                        result = await session.call_tool(tool_name, arguments=mapped_args)

                        # Debug logging for SAIA tools to diagnose response format
                        is_error = getattr(result, 'isError', False)
                        raw_content = getattr(result, 'content', None)
                        structured = getattr(result, 'structuredContent', None)
                        logger.info(
                            f"MCP tool {tool_name} raw response: isError={is_error}, "
                            f"structuredContent keys={list(structured.keys()) if isinstance(structured, dict) else type(structured).__name__}, "
                            f"content type={type(raw_content).__name__}, "
                            f"content length={len(raw_content) if isinstance(raw_content, (list, str)) else 'N/A'}"
                        )
                        if raw_content and isinstance(raw_content, list):
                            for idx, item in enumerate(raw_content[:3]):
                                text_val = getattr(item, 'text', None) or (item.get('text') if isinstance(item, dict) else None)
                                if text_val:
                                    logger.info(f"  content[{idx}].text = {text_val[:200]}")

                        return _extract_mcp_result(result)
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        logger.error(f"MCP call timed out for {tool_name} after {MCP_TIMEOUT_SECONDS}s")
        raise HTTPException(
            status_code=504,
            detail=f"Splunk MCP call timed out after {MCP_TIMEOUT_SECONDS}s"
        )
    except (ConnectionError, OSError, Exception) as e:
        error_type = type(e).__name__
        logger.error(f"MCP connection failed for {tool_name}: {error_type}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Splunk MCP server unreachable: {error_type}: {str(e)}"
        )


def _map_tool_arguments(tool, arguments: dict) -> dict:
    """Map caller arguments to match a tool's expected parameter names.

    MCP tools have inputSchema that defines expected properties. If the caller
    passes 'prompt' but the tool expects 'query', this maps accordingly.
    """
    schema = getattr(tool, 'inputSchema', None)
    if not schema or not isinstance(schema, dict):
        return arguments

    expected_props = schema.get('properties', {})
    if not expected_props:
        return arguments

    expected_keys = set(expected_props.keys())
    provided_keys = set(arguments.keys())

    # If all provided keys match expected keys, no mapping needed
    if provided_keys.issubset(expected_keys):
        return arguments

    # Build mapping for unmatched keys
    # Common synonyms for SAIA tools
    SYNONYMS = {
        'prompt': ['query', 'input', 'natural_language', 'question', 'message', 'text', 'nl_query'],
        'query': ['prompt', 'input', 'natural_language', 'question', 'message', 'text', 'search'],
        'spl': ['query', 'search', 'spl_query', 'search_query', 'input'],
        'question': ['prompt', 'query', 'input', 'message', 'text'],
    }

    mapped = {}
    unmatched_expected = expected_keys - provided_keys

    for key, value in arguments.items():
        if key in expected_keys:
            mapped[key] = value
        else:
            # Try to find the matching expected parameter
            synonyms = SYNONYMS.get(key, [])
            matched = False
            for syn in synonyms:
                if syn in unmatched_expected:
                    mapped[syn] = value
                    unmatched_expected.discard(syn)
                    matched = True
                    logger.info(f"MCP param mapping: {key} -> {syn}")
                    break
            if not matched:
                # If only one expected param is unmatched, map to it
                if len(unmatched_expected) == 1:
                    target = next(iter(unmatched_expected))
                    mapped[target] = value
                    unmatched_expected.discard(target)
                    logger.info(f"MCP param mapping (fallback): {key} -> {target}")
                else:
                    # Pass as-is and hope for the best
                    mapped[key] = value

    return mapped


def _extract_mcp_result(result) -> Any:
    """Extract data from MCP CallToolResult, preferring structuredContent over text content."""
    is_error = getattr(result, 'isError', False)
    structured = getattr(result, 'structuredContent', None)
    content = getattr(result, 'content', None)

    # If the MCP server reported an error, extract the error message
    if is_error:
        error_text = _parse_mcp_content(content)
        if isinstance(error_text, str):
            return error_text
        return f"MCP tool error: {error_text}"

    # Splunk MCP returns actual data in structuredContent, with content being just a status message
    if structured is not None:
        # structuredContent is a dict like {"results": [...], "truncated": False, "total_rows": N}
        if isinstance(structured, dict) and "results" in structured:
            # Only use structured results if non-empty; SAIA tools return text content
            # with empty structured results
            if structured["results"]:
                return structured["results"]
            # Fall through to text content
        elif isinstance(structured, dict):
            # Check for other useful keys in structuredContent (some SAIA tools may put
            # their answer in a key like "answer", "response", "text", "spl", "explanation")
            for key in ("answer", "response", "text", "spl", "explanation", "result", "output", "content"):
                if key in structured and structured[key]:
                    return structured[key]
            # If structuredContent has data but no known key, return it
            if structured:
                return structured

    # Fall back to parsing text content (used by SAIA tools which return text answers)
    parsed = _parse_mcp_content(content)

    # Filter out MCP status wrapper messages that aren't actual tool responses
    if isinstance(parsed, str):
        stripped = parsed.strip()
        # "Tool executed successfully (N results)." is a wrapper, not actual content
        if stripped.startswith("Tool executed successfully") or stripped.startswith("Tool executed"):
            logger.warning(f"MCP tool returned only a status message: {stripped}")
            # Return None to signal no real content was returned
            return None

    return parsed


async def _call_splunk_tools(tool_calls: List[Tuple[str, dict]], creds: dict = None) -> list:
    """Call multiple MCP tools in a single MCP session.

    Args:
        tool_calls: List of (tool_name, arguments) tuples
        creds: Optional pre-fetched credentials

    Returns:
        List of parsed results, one per tool call. Failed calls return None.

    Raises:
        HTTPException 503 if MCP server is unreachable or npx not found
    """
    if creds is None:
        creds = await _get_mcp_creds()

    try:
        server_params = get_mcp_client_params(
            creds["base_url"], creds["token"], creds["verify_ssl"],
            mcp_endpoint=creds.get("mcp_endpoint"),
            mcp_token=creds.get("mcp_token"),
        )
    except (FileNotFoundError, OSError) as e:
        raise HTTPException(status_code=503, detail=f"MCP runtime not available: {str(e)}")

    try:
        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()

                        tools_response = await session.list_tools()
                        available = {t.name for t in tools_response.tools}

                        results = []
                        for tool_name, arguments in tool_calls:
                            if tool_name not in available:
                                logger.warning(f"Tool '{tool_name}' not available, skipping")
                                results.append(None)
                                continue
                            try:
                                result = await session.call_tool(tool_name, arguments=arguments)
                                results.append(_extract_mcp_result(result))
                            except Exception as e:
                                logger.error(f"Error calling {tool_name}: {e}")
                                results.append(None)

                        return results
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        logger.error(f"MCP batch call timed out after {MCP_TIMEOUT_SECONDS}s")
        raise HTTPException(
            status_code=504,
            detail=f"Splunk MCP batch call timed out after {MCP_TIMEOUT_SECONDS}s"
        )
    except (ConnectionError, OSError, Exception) as e:
        error_type = type(e).__name__
        logger.error(f"MCP connection failed: {error_type}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Splunk MCP server unreachable: {error_type}: {str(e)}"
        )


def _parse_mcp_content(content: Any) -> Any:
    """Parse MCP tool result content into Python objects.

    Handles multiple MCP content formats:
    - List of TextContent objects with .text attributes containing JSON
    - Nested JSON-in-text (Splunk MCP returns results as JSON array inside text)
    - Dict responses (some tools return dicts, not arrays)
    - Single-element list unwrapping
    """
    if not content:
        return None

    # Handle dict responses directly
    if isinstance(content, dict):
        return content

    # Content is a list of content items
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

        # Unwrap single-element lists
        if len(texts) == 1:
            return texts[0]
        # If all items are lists, flatten one level (nested JSON arrays in text)
        if texts and all(isinstance(t, list) for t in texts):
            flattened = []
            for t in texts:
                flattened.extend(t)
            return flattened
        return texts

    # Handle string content
    if isinstance(content, str):
        try:
            return json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return content

    return content


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


def get_mcp_client_params(base_url: str, token: str, verify_ssl: bool = True, mcp_endpoint: str = None, mcp_token: str = None) -> StdioServerParameters:
    """Get MCP client parameters for Splunk MCP server.

    Args:
        base_url: Base URL of Splunk instance (e.g., https://localhost:8089)
        token: Splunk auth token (fallback if mcp_token not provided)
        verify_ssl: Whether to verify SSL certificates
        mcp_endpoint: Optional custom MCP endpoint URL. Defaults to {base_url}/services/mcp.
        mcp_token: Splunk MCP encrypted token. Uses Bearer auth scheme.

    Returns:
        StdioServerParameters for connecting to Splunk MCP server
    """
    import os
    import shutil

    if not mcp_endpoint:
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

    # Use MCP encrypted token with Bearer auth; fall back to Splunk token
    auth_token = mcp_token or token
    auth_scheme = "Bearer" if mcp_token else "Splunk"

    # Configure MCP client to connect to Splunk MCP server via npx mcp-remote
    return StdioServerParameters(
        command=npx_path,
        args=[
            "-y",
            "mcp-remote",
            mcp_endpoint,
            "--header",
            f"Authorization: {auth_scheme} {auth_token}"
        ],
        env=env
    )


@router.post("/search", dependencies=[Depends(require_viewer)])
async def search_splunk_logs(
    organization: str = Query(...),
    request: Dict[str, Any] = Body(...)
):
    """Search Splunk logs with SPL query using MCP server."""
    search_query = request.get("search", "search index=* | head 100")
    earliest_time = request.get("earliest_time", "-1h")
    latest_time = request.get("latest_time", "now")
    max_results = request.get("max_results", 1000)

    try:
        result = await _call_splunk_tool("splunk_run_query", {
            "query": search_query,
            "earliest_time": earliest_time,
            "latest_time": latest_time,
            "max_results": max_results,
        })
        return {"results": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Splunk MCP search error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {type(e).__name__}: {str(e)}")


@router.post("/search/ai", dependencies=[Depends(require_viewer)])
async def search_splunk_with_ai(
    organization: str = Query(...),
    request: Dict[str, Any] = Body(...)
):
    """Search Splunk using AI to generate SPL query from natural language."""
    prompt = request.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        # Try SAIA generate_spl first, fall back to literal search
        try:
            result = await _call_splunk_tool("saia_generate_spl", {"prompt": prompt})
            return {"message": "AI-powered search executed", "prompt": prompt, "results": result}
        except HTTPException as e:
            if e.status_code == 501:
                # SAIA not available, fall back to regular search
                logger.info("SAIA not available, using literal search")
                result = await _call_splunk_tool("splunk_run_query", {
                    "query": f"search {prompt}",
                    "earliest_time": "-1h",
                    "latest_time": "now",
                    "max_results": 100,
                })
                return {"message": "AI-powered search not available, using literal search", "prompt": prompt, "results": result}
            raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Splunk AI search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI search failed: {str(e)}")


@router.get("/saved-searches", dependencies=[Depends(require_viewer)])
async def get_saved_searches(organization: str = Query(...)):
    """Get saved searches from Splunk using MCP server."""
    try:
        result = await _call_splunk_tool("splunk_get_knowledge_objects", {"object_type": "saved_searches"})
        return {"saved_searches": result}
    except HTTPException as e:
        if e.status_code == 501:
            return {"saved_searches": [], "message": "Knowledge objects tool not available"}
        raise
    except Exception as e:
        logger.error(f"Error fetching saved searches: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get saved searches: {str(e)}")


@router.get("/alerts", dependencies=[Depends(require_viewer)])
async def get_splunk_alerts(organization: str = Query(...)):
    """Get alerts from Splunk using MCP server."""
    try:
        # Query fired alerts via SPL
        result = await _call_splunk_tool("splunk_run_query", {
            "query": "| rest /services/alerts/fired_alerts | head 50",
            "earliest_time": "-24h",
            "latest_time": "now",
            "max_results": 50,
        })
        return {"alerts": result if isinstance(result, list) else []}
    except HTTPException as e:
        if e.status_code in (501, 502, 503):
            return {"alerts": [], "message": str(e.detail)}
        raise
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
    try:
        result = await _call_splunk_tool("splunk_get_indexes")
        return {"indexes": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching indexes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get indexes: {str(e)}")


@router.get("/tools", dependencies=[Depends(require_viewer)])
async def list_splunk_mcp_tools(organization: str = Query(...)):
    """List available MCP tools from Splunk MCP server (for debugging/discovery)."""
    creds = await _get_mcp_creds()

    try:
        server_params = get_mcp_client_params(
            creds["base_url"], creds["token"], creds["verify_ssl"],
            mcp_endpoint=creds.get("mcp_endpoint"), mcp_token=creds.get("mcp_token"),
        )

        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
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

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"MCP tools listing timed out after {MCP_TIMEOUT_SECONDS}s")
    except Exception as e:
        logger.error(f"Error listing MCP tools: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list MCP tools: {str(e)}")


# ============================================================================
# NEW MCP-POWERED ENDPOINTS
# ============================================================================

@router.get("/environment", dependencies=[Depends(require_viewer)])
async def get_splunk_environment(organization: str = Query("default")):
    """Batch fetch Splunk environment info: server info, user info, and indexes."""
    try:
        creds = await _get_mcp_creds()
        results = await _call_splunk_tools([
            ("splunk_get_info", {}),
            ("splunk_get_user_info", {}),
            ("splunk_get_indexes", {}),
        ], creds=creds)

        return {
            "server_info": results[0],
            "user_info": results[1],
            "indexes": results[2],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching environment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch environment: {str(e)}")


@router.get("/server-info", dependencies=[Depends(require_viewer)])
async def get_splunk_server_info(organization: str = Query("default")):
    """Get Splunk server info (version, server name, OS)."""
    try:
        result = await _call_splunk_tool("splunk_get_info")
        return {"server_info": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching server info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch server info: {str(e)}")


@router.get("/user-info", dependencies=[Depends(require_viewer)])
async def get_splunk_user_info(organization: str = Query("default")):
    """Get current Splunk user info (name, roles)."""
    try:
        result = await _call_splunk_tool("splunk_get_user_info")
        return {"user_info": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user info: {str(e)}")


@router.get("/indexes/{name}", dependencies=[Depends(require_viewer)])
async def get_splunk_index_detail(name: str, organization: str = Query("default")):
    """Get detailed info for a specific index."""
    try:
        result = await _call_splunk_tool("splunk_get_index_info", {"index_name": name})
        return {"index": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching index detail for {name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch index detail: {str(e)}")


@router.get("/indexes/{name}/metadata", dependencies=[Depends(require_viewer)])
async def get_splunk_index_metadata(
    name: str,
    metadata_type: str = Query("hosts", description="Type: hosts, sources, or sourcetypes"),
    organization: str = Query("default"),
):
    """Get metadata (hosts/sources/sourcetypes) for a specific index."""
    try:
        result = await _call_splunk_tool("splunk_get_metadata", {
            "index_name": name,
            "metadata_type": metadata_type,
        })
        return {"metadata": result, "index": name, "type": metadata_type}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching metadata for {name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch index metadata: {str(e)}")


@router.get("/knowledge-objects", dependencies=[Depends(require_viewer)])
async def get_splunk_knowledge_objects(
    object_type: str = Query("saved_searches", description="Type: saved_searches, datamodels, macros, lookups, eventtypes, tags"),
    organization: str = Query("default"),
):
    """Get Splunk knowledge objects (saved searches, data models, macros, etc.)."""
    try:
        result = await _call_splunk_tool("splunk_get_knowledge_objects", {"object_type": object_type})
        return {"objects": result, "type": object_type}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching knowledge objects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge objects: {str(e)}")


# ============================================================================
# SAIA (Splunk AI Assistant) Endpoints
# ============================================================================

@router.get("/saia/status", dependencies=[Depends(require_viewer)])
async def check_saia_status(organization: str = Query("default")):
    """Check if Splunk AI Assistant tools are available."""
    try:
        creds = await _get_mcp_creds()
        server_params = get_mcp_client_params(
            creds["base_url"], creds["token"], creds["verify_ssl"],
            mcp_endpoint=creds.get("mcp_endpoint"),
            mcp_token=creds.get("mcp_token"),
        )

        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools_response = await session.list_tools()
                        tool_names = [t.name for t in tools_response.tools]

                        saia_tools = [t for t in tool_names if t.startswith("saia_")]
                        return {
                            "available": len(saia_tools) > 0,
                            "tools": saia_tools,
                            "all_tools": tool_names,
                        }
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"SAIA status check timed out after {MCP_TIMEOUT_SECONDS}s")
    except Exception as e:
        logger.error(f"Error checking SAIA status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check SAIA status: {str(e)}")


@router.get("/saia/debug", dependencies=[Depends(require_viewer)])
async def saia_debug(organization: str = Query("default")):
    """Debug endpoint: test SAIA tools and return raw MCP response details.

    Returns tool schemas, parameter mappings, and raw call results for diagnosis.
    """
    try:
        creds = await _get_mcp_creds()
        server_params = get_mcp_client_params(
            creds["base_url"], creds["token"], creds["verify_ssl"],
            mcp_endpoint=creds.get("mcp_endpoint"),
            mcp_token=creds.get("mcp_token"),
        )

        debug_info = {
            "mcp_endpoint": creds.get("mcp_endpoint") or f"{creds['base_url'].rstrip('/')}/services/mcp",
            "has_mcp_token": bool(creds.get("mcp_token")),
            "has_bearer_token": bool(creds.get("token")),
            "tools": {},
            "test_call": None,
        }

        async with _mcp_semaphore:
            async with asyncio.timeout(MCP_TIMEOUT_SECONDS):
                async with stdio_client(server_params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools_response = await session.list_tools()

                        # Collect SAIA tool schemas
                        for tool in tools_response.tools:
                            if tool.name.startswith("saia_"):
                                schema = getattr(tool, 'inputSchema', {})
                                debug_info["tools"][tool.name] = {
                                    "description": getattr(tool, 'description', ''),
                                    "inputSchema": schema,
                                    "expected_params": list(schema.get('properties', {}).keys()) if isinstance(schema, dict) else [],
                                    "required": schema.get('required', []) if isinstance(schema, dict) else [],
                                }

                        # Test call: try saia_generate_spl with a simple prompt
                        test_tool = next((t for t in tools_response.tools if t.name == "saia_generate_spl"), None)
                        if test_tool:
                            test_args = {"prompt": "show me the top 10 source types by event count"}
                            mapped_args = _map_tool_arguments(test_tool, test_args)

                            debug_info["test_call"] = {
                                "tool": "saia_generate_spl",
                                "input_args": test_args,
                                "mapped_args": mapped_args,
                            }

                            try:
                                result = await session.call_tool("saia_generate_spl", arguments=mapped_args)

                                # Extract raw response details
                                is_error = getattr(result, 'isError', False)
                                raw_content = getattr(result, 'content', None)
                                structured = getattr(result, 'structuredContent', None)

                                content_details = []
                                if raw_content and isinstance(raw_content, list):
                                    for idx, item in enumerate(raw_content[:5]):
                                        text_val = getattr(item, 'text', None) or (item.get('text') if isinstance(item, dict) else None)
                                        item_type = type(item).__name__
                                        content_type = getattr(item, 'type', None) or (item.get('type') if isinstance(item, dict) else None)
                                        content_details.append({
                                            "index": idx,
                                            "item_type": item_type,
                                            "content_type": content_type,
                                            "text": text_val[:500] if text_val else None,
                                            "has_text": text_val is not None,
                                        })

                                debug_info["test_call"]["response"] = {
                                    "isError": is_error,
                                    "structuredContent": structured if structured else None,
                                    "structuredContent_type": type(structured).__name__,
                                    "structuredContent_keys": list(structured.keys()) if isinstance(structured, dict) else None,
                                    "content_length": len(raw_content) if isinstance(raw_content, (list, str)) else None,
                                    "content_type": type(raw_content).__name__,
                                    "content_items": content_details,
                                    "extracted_result": _extract_mcp_result(result),
                                }
                            except Exception as call_err:
                                debug_info["test_call"]["error"] = str(call_err)
                        else:
                            debug_info["test_call"] = {"error": "saia_generate_spl tool not found"}

        return debug_info
    except HTTPException:
        raise
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="SAIA debug timed out")
    except Exception as e:
        logger.error(f"SAIA debug error: {e}")
        raise HTTPException(status_code=500, detail=f"SAIA debug failed: {str(e)}")


@router.post("/saia/generate-spl", dependencies=[Depends(require_viewer)])
async def saia_generate_spl(
    organization: str = Query("default"),
    request: Dict[str, Any] = Body(...),
):
    """Generate SPL query from natural language using Splunk AI Assistant."""
    prompt = request.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        result = await _call_splunk_tool("saia_generate_spl", {"prompt": prompt})
        if result is None:
            logger.warning(f"saia_generate_spl returned None for prompt: {prompt[:100]}")
        return {"spl": result, "prompt": prompt}
    except HTTPException as e:
        if e.status_code == 501:
            raise HTTPException(status_code=501, detail="Splunk AI Assistant is not installed. Install it from Splunkbase to enable SPL generation.")
        raise
    except Exception as e:
        logger.error(f"Error generating SPL: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SPL: {str(e)}")


@router.post("/saia/optimize-spl", dependencies=[Depends(require_viewer)])
async def saia_optimize_spl(
    organization: str = Query("default"),
    request: Dict[str, Any] = Body(...),
):
    """Optimize an SPL query using Splunk AI Assistant."""
    spl = request.get("spl", "")
    if not spl:
        raise HTTPException(status_code=400, detail="SPL query is required")

    try:
        result = await _call_splunk_tool("saia_optimize_spl", {"spl": spl})
        return {"optimized": result, "original": spl}
    except HTTPException as e:
        if e.status_code == 501:
            raise HTTPException(status_code=501, detail="Splunk AI Assistant is not installed.")
        raise
    except Exception as e:
        logger.error(f"Error optimizing SPL: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize SPL: {str(e)}")


@router.post("/saia/explain-spl", dependencies=[Depends(require_viewer)])
async def saia_explain_spl(
    organization: str = Query("default"),
    request: Dict[str, Any] = Body(...),
):
    """Explain an SPL query in plain English using Splunk AI Assistant."""
    spl = request.get("spl", "")
    if not spl:
        raise HTTPException(status_code=400, detail="SPL query is required")

    try:
        result = await _call_splunk_tool("saia_explain_spl", {"spl": spl})
        return {"explanation": result, "spl": spl}
    except HTTPException as e:
        if e.status_code == 501:
            raise HTTPException(status_code=501, detail="Splunk AI Assistant is not installed.")
        raise
    except Exception as e:
        logger.error(f"Error explaining SPL: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to explain SPL: {str(e)}")


@router.post("/saia/ask", dependencies=[Depends(require_viewer)])
async def saia_ask_splunk_question(
    organization: str = Query("default"),
    request: Dict[str, Any] = Body(...),
):
    """Ask a Splunk question using Splunk AI Assistant."""
    question = request.get("question", "")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    try:
        result = await _call_splunk_tool("saia_ask_splunk_question", {"question": question})
        if result is None:
            logger.warning(f"saia_ask_splunk_question returned None for: {question[:100]}")
        return {"answer": result, "question": question}
    except HTTPException as e:
        if e.status_code == 501:
            raise HTTPException(status_code=501, detail="Splunk AI Assistant is not installed.")
        raise
    except Exception as e:
        logger.error(f"Error asking Splunk question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ask Splunk question: {str(e)}")


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


# ============================================================================
# CROSS-PLATFORM CORRELATION
# ============================================================================

@router.post("/cross-platform/correlate", dependencies=[Depends(require_viewer)])
async def correlate_splunk_devices(
    request: Dict[str, Any] = Body(...)
):
    """Cross-reference Splunk search result hosts/IPs with Meraki/Catalyst/TE devices.

    Accepts hosts and IPs extracted from search results and matches them against
    the network device cache to find correlated devices across platforms.
    """
    hosts = request.get("hosts", [])
    ips = request.get("ips", [])

    if not hosts and not ips:
        return {"correlatedDevices": [], "message": "No hosts or IPs provided"}

    try:
        # Fetch network cache internally
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            cache_response = await client.get(
                "https://localhost:8002/api/network/cache",
                headers={"Content-Type": "application/json"},
            )

            if cache_response.status_code != 200:
                return {"correlatedDevices": [], "message": "Network cache not available"}

            cache_data = cache_response.json()

        correlated = []
        search_terms = set(h.lower() for h in hosts) | set(ips)

        # Check Meraki devices
        for org in cache_data.get("organizations", []):
            for net in org.get("networks", []):
                for dev in net.get("devices", []):
                    dev_ip = (dev.get("lanIp") or dev.get("wan1Ip") or "").lower()
                    dev_name = (dev.get("name") or "").lower()
                    if dev_ip in search_terms or dev_name in search_terms:
                        correlated.append({
                            "ip": dev_ip or dev_name,
                            "hostname": dev.get("name"),
                            "merakiDevice": {
                                "serial": dev.get("serial"),
                                "name": dev.get("name"),
                                "model": dev.get("model"),
                                "status": dev.get("status"),
                                "networkName": net.get("name"),
                            },
                            "platforms": ["meraki"],
                        })

        # Check Catalyst devices
        for org in cache_data.get("organizations", []):
            for net in org.get("networks", []):
                for dev in net.get("devices", []):
                    if dev.get("platform") == "catalyst" or dev.get("source") == "catalyst":
                        dev_ip = (dev.get("managementIpAddress") or dev.get("ipAddress") or "").lower()
                        dev_name = (dev.get("hostname") or dev.get("name") or "").lower()
                        if dev_ip in search_terms or dev_name in search_terms:
                            # Check if already correlated, merge if so
                            existing = next((c for c in correlated if c["ip"] == dev_ip or c.get("hostname", "").lower() == dev_name), None)
                            if existing:
                                existing["catalystDevice"] = {
                                    "serial": dev.get("serialNumber"),
                                    "name": dev.get("hostname"),
                                    "model": dev.get("platformId"),
                                    "reachabilityStatus": dev.get("reachabilityStatus"),
                                }
                                if "catalyst" not in existing["platforms"]:
                                    existing["platforms"].append("catalyst")
                            else:
                                correlated.append({
                                    "ip": dev_ip or dev_name,
                                    "hostname": dev.get("hostname"),
                                    "catalystDevice": {
                                        "serial": dev.get("serialNumber"),
                                        "name": dev.get("hostname"),
                                        "model": dev.get("platformId"),
                                        "reachabilityStatus": dev.get("reachabilityStatus"),
                                    },
                                    "platforms": ["catalyst"],
                                })

        return {"correlatedDevices": correlated}

    except Exception as e:
        logger.error(f"Cross-platform correlation error: {e}")
        return {"correlatedDevices": [], "error": str(e)}
