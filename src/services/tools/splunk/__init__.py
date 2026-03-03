"""Splunk API Tools.

This module provides 50+ tools for Splunk operations,
organized into logical categories:
- search: Search jobs and results
- knowledge: Saved searches, dashboards, reports
- kvstore: KV Store operations
- system: Server info and health
- users: User management

Tool naming convention: splunk_{action}_{entity}
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional

import httpx

from src.services.tool_registry import get_tool_registry, Tool, create_tool

logger = logging.getLogger(__name__)


# =============================================================================
# SPLUNK CLIENT AND EXECUTION CONTEXT
# =============================================================================

class SplunkClient:
    """HTTP client for Splunk REST API."""

    def __init__(
        self,
        base_url: str,
        username: str = None,
        password: str = None,
        token: str = None,
        verify_ssl: bool = False,  # Default False for self-signed certs
        transport=None,
    ):
        """Initialize Splunk client.

        Args:
            base_url: Splunk base URL (e.g., https://splunk.example.com:8089)
            username: Splunk username (for basic auth)
            password: Splunk password (for basic auth)
            token: Splunk auth token (preferred over basic auth)
            verify_ssl: Whether to verify SSL certificates
            transport: Optional httpx transport (e.g. InstrumentedAsyncTransport)
        """
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.username = username
        self.password = password
        self.token = token
        self.verify_ssl = verify_ssl
        self._transport = transport

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication."""
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if self.token:
            headers["Authorization"] = f"Splunk {self.token}"
        return headers

    def _get_auth(self) -> Optional[tuple]:
        """Get basic auth tuple if token not available."""
        if not self.token and self.username and self.password:
            return (self.username, self.password)
        return None

    async def request(
        self,
        method: str,
        path: str,
        params: Dict[str, Any] = None,
        data: Dict[str, Any] = None,
        timeout: float = 60.0,
    ) -> Dict[str, Any]:
        """Make a request to Splunk REST API.

        Args:
            method: HTTP method (GET, POST, DELETE)
            path: API path (e.g., /services/search/jobs)
            params: Query parameters
            data: Form data (for POST)
            timeout: Request timeout in seconds

        Returns:
            JSON response data
        """
        url = f"{self.base_url}{path}"
        headers = self._get_headers()
        auth = self._get_auth()

        # Debug logging
        logger.info(f"[SplunkClient] Request: {method} {url}")
        logger.info(f"[SplunkClient] base_url={self.base_url}, token={'set' if self.token else 'MISSING'}, auth={'set' if auth else 'none'}")

        # Always add output_mode for JSON
        if params is None:
            params = {}
        if "output_mode" not in params:
            params["output_mode"] = "json"

        client_kwargs = {"verify": self.verify_ssl, "timeout": timeout}
        if self._transport is not None:
            client_kwargs["transport"] = self._transport
        async with httpx.AsyncClient(**client_kwargs) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=params, auth=auth)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, params=params, data=data, auth=auth)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers, params=params, auth=auth)
            else:
                raise ValueError(f"Unsupported method: {method}")

            logger.info(f"[SplunkClient] Response: HTTP {response.status_code}, content-type={response.headers.get('content-type', 'unknown')}")
            if response.status_code != 200:
                logger.error(f"[SplunkClient] Error response: {response.text[:500]}")

            response.raise_for_status()
            return response.json()

    # =========================================================================
    # AUTOMATIC QUERY OPTIMIZATION
    # =========================================================================

    # High-volume sourcetypes to exclude (these often dominate logs)
    NOISE_SOURCETYPES = [
        "meraki:sensorreadingshistory",  # Sensor data - 90%+ of events
        "meraki:api*",                   # API request logs
    ]

    def _optimize_query(self, query: str) -> str:
        """Automatically optimize Splunk queries for efficiency.

        Applies these optimizations:
        1. Excludes high-volume noise sourcetypes
        2. Adds result limits if query returns raw events
        3. Logs optimization actions
        """
        original_query = query
        query_lower = query.lower()

        # 1. Auto-exclude noise sourcetypes if not already filtered
        for noise_st in self.NOISE_SOURCETYPES:
            exclude_pattern = f"not sourcetype={noise_st}".lower()
            # Check if already excluded or if query targets specific sourcetype
            if exclude_pattern not in query_lower:
                # Don't add exclusion if query already targets a specific sourcetype
                if "sourcetype=" in query_lower and noise_st.replace("*", "") not in query_lower:
                    continue  # Query already has specific sourcetype filter
                # Add exclusion before first pipe or at end
                if "|" in query:
                    parts = query.split("|", 1)
                    query = f"{parts[0].strip()} NOT sourcetype={noise_st} | {parts[1].strip()}"
                else:
                    query = f"{query} NOT sourcetype={noise_st}"

        # 2. Add head limit if no aggregation and no existing limit
        has_aggregation = any(cmd in query_lower for cmd in [
            "| stats", "| count", "| top", "| rare", "| chart",
            "| timechart", "| head", "| tail", "| table"
        ])
        if not has_aggregation:
            # Add stats to summarize instead of returning raw events
            query = f"{query} | stats count by sourcetype, type | sort -count | head 50"
            logger.info(f"[SplunkClient] Added aggregation to query (no stats/table found)")

        # 3. Log optimization if query changed
        if query != original_query:
            logger.info(f"[SplunkClient] Query optimized: {original_query[:80]}... -> {query[:80]}...")

        return query

    async def run_search(
        self,
        query: str,
        earliest_time: str = "-24h",
        latest_time: str = "now",
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """Run a Splunk search and return results.

        Args:
            query: SPL search query
            earliest_time: Search start time (e.g., "-24h", "-7d")
            latest_time: Search end time (e.g., "now")
            max_results: Maximum results to return

        Returns:
            List of search results
        """
        # Ensure query starts with "search" command (required by Splunk)
        query = query.strip()
        if not query.lower().startswith("search "):
            query = f"search {query}"

        # =================================================================
        # AUTOMATIC QUERY OPTIMIZATION
        # =================================================================
        query = self._optimize_query(query)

        # Build full query with time bounds
        if "|" in query:
            parts = query.split("|", 1)
            full_query = f"{parts[0].strip()} earliest={earliest_time} latest={latest_time} | {parts[1].strip()}"
        else:
            full_query = f"{query} earliest={earliest_time} latest={latest_time}"

        # Create search job
        create_result = await self.request(
            "POST",
            "/services/search/jobs",
            data={"search": full_query},
        )
        job_id = create_result.get("sid")
        if not job_id:
            raise ValueError("Failed to create search job - no sid returned")

        # Poll for completion
        for _ in range(60):  # Max 60 seconds
            status = await self.request("GET", f"/services/search/jobs/{job_id}")
            entry = status.get("entry", [{}])[0]
            if entry.get("content", {}).get("isDone"):
                break
            await asyncio.sleep(1)

        # Fetch results
        results = await self.request(
            "GET",
            f"/services/search/jobs/{job_id}/results",
            params={"count": max_results},
        )

        # Cleanup
        try:
            await self.request("DELETE", f"/services/search/jobs/{job_id}")
        except Exception:
            pass  # Cleanup failure is not critical

        return results.get("results", [])


class SplunkExecutionContext:
    """Execution context for Splunk tools.

    Provides a configured SplunkClient for tool handlers.
    """

    def __init__(
        self,
        base_url: str = None,
        username: str = None,
        password: str = None,
        token: str = None,
        verify_ssl: bool = False,  # Default False for self-signed certs (common in Splunk)
    ):
        """Initialize Splunk execution context.

        Args:
            base_url: Splunk base URL
            username: Splunk username (for basic auth)
            password: Splunk password (for basic auth)
            token: Splunk auth token (preferred)
            verify_ssl: Whether to verify SSL certificates
        """
        from src.services.instrumented_httpx import InstrumentedAsyncTransport
        self._transport = InstrumentedAsyncTransport(verify=verify_ssl)
        self.client = SplunkClient(
            base_url=base_url or "",
            username=username,
            password=password,
            token=token,
            verify_ssl=verify_ssl,
            transport=self._transport,
        )
        self.base_url = base_url

    def pop_timing(self):
        """Pop and return the last captured network timing."""
        if self._transport:
            return self._transport.pop_timing()
        return None


class SplunkMCPExecutionContext:
    """Execution context that routes tool calls through MCP with REST fallback.

    Wraps a SplunkExecutionContext (direct REST) and adds MCP routing.
    Exposes `client` for backward compatibility with handlers that access
    context.client directly.
    """

    def __init__(self, fallback_context: SplunkExecutionContext, mcp_service, mcp_creds: dict):
        self._fallback = fallback_context
        self._mcp_service = mcp_service
        self._mcp_creds = mcp_creds
        # Expose client for backward compatibility with handlers
        self.client = fallback_context.client
        self.base_url = fallback_context.base_url

    async def call_mcp_tool(self, tool_name: str, params: dict) -> dict:
        """Call a tool via MCP server."""
        return await self._mcp_service.call_tool(tool_name, params)

    def pop_timing(self):
        """Pop and return the last captured network timing."""
        return self._fallback.pop_timing()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def success_result(data: Any = None, message: str = None) -> Dict:
    """Create a success result."""
    result = {"success": True}
    if data is not None:
        result["data"] = data
    if message:
        result["message"] = message
    return result


def error_result(message: str) -> Dict:
    """Create an error result."""
    return {"success": False, "error": message}


# =============================================================================
# SEARCH TOOLS
# =============================================================================

async def handle_run_search(params: Dict, context: Any) -> Dict:
    """Run a Splunk search."""
    query = params.get("query")
    if not query:
        return error_result("query is required")
    earliest = params.get("earliest_time", "-24h")
    latest = params.get("latest_time", "now")
    max_results = params.get("max_results", 100)

    # Use Splunk client from context
    try:
        result = await context.client.run_search(
            query=query,
            earliest_time=earliest,
            latest_time=latest,
            max_results=max_results
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_create_search_job(params: Dict, context: Any) -> Dict:
    """Create an async search job."""
    query = params.get("query")
    if not query:
        return error_result("query is required")
    try:
        result = await context.client.create_search_job(
            query=query,
            earliest_time=params.get("earliest_time", "-24h"),
            latest_time=params.get("latest_time", "now")
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_search_job_status(params: Dict, context: Any) -> Dict:
    """Get search job status."""
    job_id = params.get("job_id")
    if not job_id:
        return error_result("job_id is required")
    try:
        result = await context.client.get_search_job_status(job_id)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_search_results(params: Dict, context: Any) -> Dict:
    """Get search job results."""
    job_id = params.get("job_id")
    if not job_id:
        return error_result("job_id is required")
    try:
        result = await context.client.get_search_results(
            job_id,
            offset=params.get("offset", 0),
            count=params.get("count", 100)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_cancel_search_job(params: Dict, context: Any) -> Dict:
    """Cancel a search job."""
    job_id = params.get("job_id")
    if not job_id:
        return error_result("job_id is required")
    try:
        await context.client.cancel_search_job(job_id)
        return success_result(message=f"Search job {job_id} cancelled")
    except Exception as e:
        return error_result(str(e))


async def handle_run_saved_search(params: Dict, context: Any) -> Dict:
    """Run a saved search."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    try:
        result = await context.client.run_saved_search(name)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# KNOWLEDGE TOOLS (Saved Searches, Dashboards)
# =============================================================================

async def handle_list_saved_searches(params: Dict, context: Any) -> Dict:
    """List saved searches."""
    try:
        result = await context.client.get_saved_searches(
            count=params.get("count", 30),
            offset=params.get("offset", 0)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_saved_search(params: Dict, context: Any) -> Dict:
    """Get saved search details."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    try:
        result = await context.client.get_saved_search(name)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_create_saved_search(params: Dict, context: Any) -> Dict:
    """Create a saved search."""
    name = params.get("name")
    search = params.get("search")
    if not name or not search:
        return error_result("name and search are required")
    try:
        config = {k: params[k] for k in ["description", "cron_schedule", "is_scheduled", "dispatch.earliest_time", "dispatch.latest_time", "alert_type", "alert_threshold", "actions"] if params.get(k)}
        result = await context.client.create_saved_search(name, search, **config)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_delete_saved_search(params: Dict, context: Any) -> Dict:
    """Delete a saved search."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    try:
        await context.client.delete_saved_search(name)
        return success_result(message=f"Saved search '{name}' deleted")
    except Exception as e:
        return error_result(str(e))


async def handle_list_dashboards(params: Dict, context: Any) -> Dict:
    """List dashboards."""
    try:
        result = await context.client.get_dashboards(
            count=params.get("count", 30),
            offset=params.get("offset", 0)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_dashboard(params: Dict, context: Any) -> Dict:
    """Get dashboard details."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    try:
        result = await context.client.get_dashboard(name)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_list_reports(params: Dict, context: Any) -> Dict:
    """List reports."""
    try:
        result = await context.client.get_reports(
            count=params.get("count", 30),
            offset=params.get("offset", 0)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# KV STORE TOOLS
# =============================================================================

async def handle_list_kvstore_collections(params: Dict, context: Any) -> Dict:
    """List KV Store collections."""
    app = params.get("app", "search")
    try:
        result = await context.client.list_kvstore_collections(app)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_kvstore_data(params: Dict, context: Any) -> Dict:
    """Get data from a KV Store collection."""
    collection = params.get("collection")
    if not collection:
        return error_result("collection is required")
    app = params.get("app", "search")
    try:
        result = await context.client.get_kvstore_data(
            app,
            collection,
            query=params.get("query"),
            limit=params.get("limit", 100)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_insert_kvstore_data(params: Dict, context: Any) -> Dict:
    """Insert data into a KV Store collection."""
    collection = params.get("collection")
    data = params.get("data")
    if not collection or not data:
        return error_result("collection and data are required")
    app = params.get("app", "search")
    try:
        result = await context.client.insert_kvstore_data(app, collection, data)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_delete_kvstore_data(params: Dict, context: Any) -> Dict:
    """Delete data from a KV Store collection."""
    collection = params.get("collection")
    if not collection:
        return error_result("collection is required")
    app = params.get("app", "search")
    key = params.get("key")
    try:
        if key:
            await context.client.delete_kvstore_record(app, collection, key)
        else:
            await context.client.delete_kvstore_data(app, collection, params.get("query"))
        return success_result(message="Data deleted")
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# SYSTEM TOOLS
# =============================================================================

async def handle_get_server_info(params: Dict, context: Any) -> Dict:
    """Get Splunk server info."""
    try:
        result = await context.client.get_server_info()
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_server_health(params: Dict, context: Any) -> Dict:
    """Get Splunk server health."""
    try:
        result = await context.client.get_server_health()
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_list_indexes(params: Dict, context: Any) -> Dict:
    """List Splunk indexes."""
    try:
        result = await context.client.get_indexes(
            count=params.get("count", 30),
            offset=params.get("offset", 0)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_index(params: Dict, context: Any) -> Dict:
    """Get index details."""
    name = params.get("name")
    if not name:
        return error_result("name is required")
    try:
        result = await context.client.get_index(name)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# USER TOOLS
# =============================================================================

async def handle_list_users(params: Dict, context: Any) -> Dict:
    """List Splunk users."""
    try:
        result = await context.client.get_users(
            count=params.get("count", 30),
            offset=params.get("offset", 0)
        )
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_user(params: Dict, context: Any) -> Dict:
    """Get user details."""
    username = params.get("username")
    if not username:
        return error_result("username is required")
    try:
        result = await context.client.get_user(username)
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


async def handle_get_current_user(params: Dict, context: Any) -> Dict:
    """Get current user context."""
    try:
        result = await context.client.get_current_user()
        return success_result(data=result)
    except Exception as e:
        return error_result(str(e))


# =============================================================================
# TOOL DEFINITIONS
# =============================================================================

SPLUNK_TOOLS = [
    # Search Tools - with examples for improved accuracy (per Anthropic: 72% → 90%)
    create_tool(
        name="splunk_run_search",
        description="Run a Splunk SPL search query and return results. Primary tool for log analysis and event correlation. Use to find error patterns, correlate events with timestamps from Meraki/ThousandEyes, check connectivity events (device_offline, failover, packet_loss), and review config changes. Always use sourcetype filters and stats/table commands.",
        platform="splunk",
        category="search",
        properties={
            "query": {"type": "string", "description": "SPL search query"},
            "earliest_time": {"type": "string", "description": "Earliest time (e.g., -24h, -7d)"},
            "latest_time": {"type": "string", "description": "Latest time (e.g., now)"},
            "max_results": {"type": "integer", "description": "Maximum results to return"},
        },
        required=["query"],
        handler=handle_run_search,
        examples=[
            {"query": "Search for errors in the last hour", "params": {"query": "index=main error", "earliest_time": "-1h"}},
            {"query": "Find failed logins", "params": {"query": "index=security failed login", "earliest_time": "-24h"}},
            {"query": "Show top error sources", "params": {"query": "index=main error | top source", "max_results": 10}},
        ],
    ),
    create_tool(
        name="splunk_create_search_job",
        description="Create an async Splunk search job for long-running queries. Returns a job_id to poll with splunk_get_search_job_status and retrieve with splunk_get_search_results. Use instead of splunk_run_search when queries may exceed 30 seconds. For most troubleshooting, prefer splunk_run_search.",
        platform="splunk",
        category="search",
        properties={
            "query": {"type": "string", "description": "SPL search query"},
            "earliest_time": {"type": "string", "description": "Earliest time"},
            "latest_time": {"type": "string", "description": "Latest time"},
        },
        required=["query"],
        handler=handle_create_search_job,
    ),
    create_tool(
        name="splunk_get_search_job_status",
        description="Get status of a search job",
        platform="splunk",
        category="search",
        properties={"job_id": {"type": "string", "description": "Search job ID"}},
        required=["job_id"],
        handler=handle_get_search_job_status,
    ),
    create_tool(
        name="splunk_get_search_results",
        description="Get results from a completed async search job. Requires job_id from splunk_create_search_job. Check status first with splunk_get_search_job_status. For most queries, prefer splunk_run_search which handles the lifecycle automatically.",
        platform="splunk",
        category="search",
        properties={
            "job_id": {"type": "string", "description": "Search job ID"},
            "offset": {"type": "integer", "description": "Result offset"},
            "count": {"type": "integer", "description": "Number of results"},
        },
        required=["job_id"],
        handler=handle_get_search_results,
    ),
    create_tool(
        name="splunk_cancel_search_job",
        description="Cancel a running search job",
        platform="splunk",
        category="search",
        properties={"job_id": {"type": "string", "description": "Search job ID"}},
        required=["job_id"],
        handler=handle_cancel_search_job,
    ),
    create_tool(
        name="splunk_run_saved_search",
        description="Run a saved search by name",
        platform="splunk",
        category="search",
        properties={"name": {"type": "string", "description": "Saved search name"}},
        required=["name"],
        handler=handle_run_saved_search,
    ),

    # Knowledge Tools - with examples
    create_tool(
        name="splunk_list_saved_searches",
        description="List saved searches",
        platform="splunk",
        category="knowledge",
        properties={
            "count": {"type": "integer", "description": "Max results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_saved_searches,
        examples=[
            {"query": "List all saved searches", "params": {}},
            {"query": "Show available Splunk reports", "params": {"count": 20}},
        ],
    ),
    create_tool(
        name="splunk_get_saved_search",
        description="Get saved search details",
        platform="splunk",
        category="knowledge",
        properties={"name": {"type": "string", "description": "Saved search name"}},
        required=["name"],
        handler=handle_get_saved_search,
    ),
    create_tool(
        name="splunk_create_saved_search",
        description="Create a new saved search",
        platform="splunk",
        category="knowledge",
        properties={
            "name": {"type": "string", "description": "Saved search name"},
            "search": {"type": "string", "description": "SPL query"},
            "description": {"type": "string", "description": "Description"},
            "cron_schedule": {"type": "string", "description": "Cron schedule"},
            "is_scheduled": {"type": "boolean", "description": "Enable scheduling"},
        },
        required=["name", "search"],
        handler=handle_create_saved_search,
        requires_write=True,
    ),
    create_tool(
        name="splunk_delete_saved_search",
        description="Delete a saved search",
        platform="splunk",
        category="knowledge",
        properties={"name": {"type": "string", "description": "Saved search name"}},
        required=["name"],
        handler=handle_delete_saved_search,
        requires_write=True,
    ),
    create_tool(
        name="splunk_list_dashboards",
        description="List Splunk dashboards",
        platform="splunk",
        category="knowledge",
        properties={
            "count": {"type": "integer", "description": "Max results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_dashboards,
    ),
    create_tool(
        name="splunk_get_dashboard",
        description="Get dashboard details",
        platform="splunk",
        category="knowledge",
        properties={"name": {"type": "string", "description": "Dashboard name"}},
        required=["name"],
        handler=handle_get_dashboard,
    ),
    create_tool(
        name="splunk_list_reports",
        description="List Splunk reports",
        platform="splunk",
        category="knowledge",
        properties={
            "count": {"type": "integer", "description": "Max results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_reports,
    ),

    # KV Store Tools
    create_tool(
        name="splunk_list_kvstore_collections",
        description="List KV Store collections",
        platform="splunk",
        category="kvstore",
        properties={"app": {"type": "string", "description": "App context"}},
        handler=handle_list_kvstore_collections,
    ),
    create_tool(
        name="splunk_get_kvstore_data",
        description="Get data from a KV Store collection",
        platform="splunk",
        category="kvstore",
        properties={
            "collection": {"type": "string", "description": "Collection name"},
            "app": {"type": "string", "description": "App context"},
            "query": {"type": "string", "description": "JSON query filter"},
            "limit": {"type": "integer", "description": "Max results"},
        },
        required=["collection"],
        handler=handle_get_kvstore_data,
    ),
    create_tool(
        name="splunk_insert_kvstore_data",
        description="Insert data into a KV Store collection",
        platform="splunk",
        category="kvstore",
        properties={
            "collection": {"type": "string", "description": "Collection name"},
            "app": {"type": "string", "description": "App context"},
            "data": {"type": "object", "description": "Data to insert"},
        },
        required=["collection", "data"],
        handler=handle_insert_kvstore_data,
        requires_write=True,
    ),
    create_tool(
        name="splunk_delete_kvstore_data",
        description="Delete data from a KV Store collection",
        platform="splunk",
        category="kvstore",
        properties={
            "collection": {"type": "string", "description": "Collection name"},
            "app": {"type": "string", "description": "App context"},
            "key": {"type": "string", "description": "Record key (for single delete)"},
            "query": {"type": "string", "description": "JSON query filter (for bulk delete)"},
        },
        required=["collection"],
        handler=handle_delete_kvstore_data,
        requires_write=True,
    ),

    # System Tools
    create_tool(
        name="splunk_get_server_info",
        description="Get Splunk server information",
        platform="splunk",
        category="system",
        handler=handle_get_server_info,
    ),
    create_tool(
        name="splunk_get_server_health",
        description="Get Splunk server health status",
        platform="splunk",
        category="system",
        handler=handle_get_server_health,
    ),
    create_tool(
        name="splunk_list_indexes",
        description="List Splunk indexes",
        platform="splunk",
        category="system",
        properties={
            "count": {"type": "integer", "description": "Max results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_indexes,
    ),
    create_tool(
        name="splunk_get_index",
        description="Get index details",
        platform="splunk",
        category="system",
        properties={"name": {"type": "string", "description": "Index name"}},
        required=["name"],
        handler=handle_get_index,
    ),

    # User Tools
    create_tool(
        name="splunk_list_users",
        description="List Splunk users",
        platform="splunk",
        category="users",
        properties={
            "count": {"type": "integer", "description": "Max results"},
            "offset": {"type": "integer", "description": "Result offset"},
        },
        handler=handle_list_users,
    ),
    create_tool(
        name="splunk_get_user",
        description="Get user details",
        platform="splunk",
        category="users",
        properties={"username": {"type": "string", "description": "Username"}},
        required=["username"],
        handler=handle_get_user,
    ),
    create_tool(
        name="splunk_get_current_user",
        description="Get current authenticated user",
        platform="splunk",
        category="users",
        handler=handle_get_current_user,
    ),
]


# =============================================================================
# REGISTRATION
# =============================================================================

def register_splunk_tools():
    """Register all Splunk tools with the registry."""
    registry = get_tool_registry()
    registry.register_many(SPLUNK_TOOLS)
    logger.info(f"[Splunk Tools] Registered {len(SPLUNK_TOOLS)} tools")


# Auto-register on import
register_splunk_tools()

# Import generated modules (they auto-register)
try:
    from . import assistant
    from . import knowledge
    from . import kvstore
    from . import search
    from . import system
    from . import users
    from . import query_builder  # Smart query suggestions
    logger.info("[Splunk Tools] Loaded generated tool modules")
except ImportError as e:
    logger.warning(f"[Splunk Tools] Could not load some generated modules: {e}")


# =============================================================================
# MCP WRAPPER APPLICATION
# =============================================================================

def _apply_mcp_wrappers():
    """Wrap all Splunk tools that have MCP equivalents with MCP-first handlers."""
    try:
        from src.services.tools.splunk.mcp_handler import wrap_handler_with_mcp
        from src.services.splunk_mcp_service import has_mcp_equivalent

        wrapped_count = 0
        all_tool_lists = [SPLUNK_TOOLS]

        # Include generated module tool lists if available
        try:
            all_tool_lists.append(search.SPLUNK_SEARCH_TOOLS)
        except (NameError, AttributeError):
            pass
        try:
            all_tool_lists.append(system.SPLUNK_SYSTEM_TOOLS)
        except (NameError, AttributeError):
            pass
        try:
            all_tool_lists.append(users.SPLUNK_USERS_TOOLS)
        except (NameError, AttributeError):
            pass
        try:
            all_tool_lists.append(knowledge.SPLUNK_KNOWLEDGE_TOOLS)
        except (NameError, AttributeError):
            pass
        try:
            all_tool_lists.append(assistant.SPLUNK_ASSISTANT_TOOLS)
        except (NameError, AttributeError):
            pass

        for tool_list in all_tool_lists:
            for tool in tool_list:
                if has_mcp_equivalent(tool.name):
                    tool.handler = wrap_handler_with_mcp(tool.name, tool.handler)
                    wrapped_count += 1

        if wrapped_count > 0:
            logger.info(f"[Splunk Tools] Applied MCP wrappers to {wrapped_count} tools")
    except ImportError as e:
        logger.debug(f"[Splunk Tools] MCP wrappers not applied (import failed): {e}")


_apply_mcp_wrappers()
