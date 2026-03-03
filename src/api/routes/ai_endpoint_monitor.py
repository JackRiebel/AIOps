"""AI Assurance endpoint monitoring — create/manage TE tests targeting AI inference providers."""

from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
import json
import logging

from src.api.dependencies import require_viewer, require_editor, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/thousandeyes/ai-assurance", tags=["AI Assurance"])

# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

AI_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "anthropic": {
        "url": "https://api.anthropic.com",
        "health_path": "/v1/messages",
        "display_name": "Anthropic Claude",
    },
    "openai": {
        "url": "https://api.openai.com",
        "health_path": "/v1/chat/completions",
        "display_name": "OpenAI GPT",
    },
    "google": {
        "url": "https://generativelanguage.googleapis.com",
        "health_path": "/v1/models",
        "display_name": "Google Gemini",
    },
    "azure_openai": {
        "url": "https://management.azure.com",
        "health_path": "/openai/deployments",
        "display_name": "Azure OpenAI",
    },
    "cisco_circuit": {
        "url": "https://chat.cisco.com",
        "health_path": "/api/v1/chat",
        "display_name": "Cisco Circuit",
    },
}

PLATFORM_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "meraki": {
        "url": "https://api.meraki.com",
        "health_path": "/api/v1/organizations",
        "display_name": "Cisco Meraki",
        "resolve_from_config": False,
    },
    "catalyst": {
        "url": None,
        "health_path": "/dna/system/api/v1/auth/token",
        "display_name": "Catalyst Center",
        "resolve_from_config": True,
        "config_key": "catalyst_center_host",
    },
    "splunk": {
        "url": None,
        "health_path": "/services/server/info",
        "display_name": "Splunk",
        "resolve_from_config": True,
        "config_key": "splunk_api_url",
    },
    "thousandeyes": {
        "url": "https://api.thousandeyes.com",
        "health_path": "/v7/status",
        "display_name": "ThousandEyes",
        "resolve_from_config": False,
    },
}

# Combined lookup for display names
ALL_PROVIDERS: Dict[str, Dict[str, Any]] = {**AI_PROVIDERS, **PLATFORM_PROVIDERS}

TEST_PREFIX = "[AI Assurance]"


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class AssertionRule(BaseModel):
    type: str  # "status_code" | "response_contains" | "response_time_lt" | "json_path"
    target: str
    operator: str  # "equals" | "contains" | "less_than" | "matches_regex"
    expected: str
    description: Optional[str] = None

class PromptTemplate(BaseModel):
    name: str
    provider: str  # "anthropic" | "openai" | etc.
    prompt_text: str
    model_id: Optional[str] = None
    assertions: List[AssertionRule] = []

class CreateAITestRequest(BaseModel):
    provider: str
    custom_url: Optional[str] = None
    test_mode: str = "full_assurance"  # "network_only" | "full_assurance" | "ai_quality" — default to full suite
    prompt_template: Optional[str] = None
    model_id: Optional[str] = None
    assertions: Optional[List[AssertionRule]] = None
    test_regions: Optional[List[str]] = None
    interval: int = 300  # HTTP test interval; network test uses min(interval, 120)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_ai_quality_payload(provider: str, prompt: str, model_id: Optional[str] = None) -> Dict[str, Any]:
    """Build provider-specific AI API request payload."""
    if provider == "anthropic":
        return {
            "model": model_id or "claude-sonnet-4-20250514",
            "max_tokens": 256,
            "messages": [{"role": "user", "content": prompt}]
        }
    elif provider == "openai":
        return {
            "model": model_id or "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 256,
        }
    elif provider == "google":
        return {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 256},
        }
    elif provider == "cisco_circuit":
        return {
            "messages": [{"role": "user", "content": prompt}],
            "model": model_id or "default",
            "max_tokens": 256,
        }
    else:
        # Generic OpenAI-compatible format
        return {
            "model": model_id or "default",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 256,
        }


def _build_content_regex(assertions: List[AssertionRule]) -> Optional[str]:
    """Convert assertions to a content regex for TE HTTP Server test."""
    for rule in assertions:
        if rule.type == "response_contains" and rule.operator == "contains":
            return rule.expected
    return None


async def _resolve_platform_url(provider_key: str) -> str:
    """Resolve platform URL from system config (credential pool)."""
    from src.services.config_service import get_config_service
    cfg = PLATFORM_PROVIDERS[provider_key]
    config_svc = get_config_service()
    url = await config_svc.get_config(cfg["config_key"])
    if not url and provider_key == "splunk":
        url = await config_svc.get_config("splunk_host")
    if not url:
        raise HTTPException(400, f"{cfg['display_name']} is not configured. Set it up in the Setup Wizard first.")
    # Ensure URL has scheme
    if not url.startswith("http"):
        url = f"https://{url}"
    return url


async def _resolve_provider(req: CreateAITestRequest) -> Dict[str, Any]:
    """Resolve provider config, supporting custom URLs and platform APIs."""
    if req.provider == "custom":
        if not req.custom_url:
            raise HTTPException(status_code=400, detail="custom_url is required for custom provider")
        return {"url": req.custom_url, "health_path": "", "display_name": "Custom"}

    # Check AI providers first
    cfg = AI_PROVIDERS.get(req.provider)
    if cfg:
        return cfg

    # Check platform providers
    pcfg = PLATFORM_PROVIDERS.get(req.provider)
    if pcfg:
        resolved = dict(pcfg)
        if pcfg.get("resolve_from_config"):
            resolved["url"] = await _resolve_platform_url(req.provider)
        return resolved

    raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")


async def _te_make_request(method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
    """Proxy to the ThousandEyes make_api_request helper."""
    from src.api.routes.thousandeyes import make_api_request
    return await make_api_request(method, endpoint, data=data)


async def _validate_te() -> None:
    """Validate TE is configured. Raises HTTPException if not."""
    from src.api.routes.thousandeyes import validate_te_config
    await validate_te_config()


async def _get_available_agents() -> List[Dict[str, Any]]:
    """Fetch available TE agents and return a list of agent ID objects for test assignment."""
    result = await _te_make_request("GET", "agents")
    if "error" in result:
        raise HTTPException(status_code=502, detail=f"Failed to fetch agents: {result['error']}")

    # Parse agents from HAL response
    raw = result
    if isinstance(raw, dict):
        agents = raw.get("agents", [])
        if not agents:
            # Try HAL embedded format
            agents = raw.get("_embedded", {}).get("agents", [])
        if not agents and isinstance(raw.get("results"), list):
            agents = raw["results"]
    elif isinstance(raw, list):
        agents = raw
    else:
        agents = []

    if not agents:
        raise HTTPException(
            status_code=400,
            detail="No ThousandEyes agents available. Configure at least one Cloud or Enterprise agent first."
        )

    # Filter to enabled agents, prefer enterprise then cloud
    enabled = [a for a in agents if a.get("agentState", "").lower() != "disabled"]
    if not enabled:
        enabled = agents

    # Return first 3 agents as ID refs
    return [{"agentId": a.get("agentId")} for a in enabled[:3]]


# URL patterns to match existing TE tests targeting AI/platform providers
_URL_PATTERNS: Dict[str, List[str]] = {
    "anthropic": ["anthropic.com", "claude.ai"],
    "openai": ["openai.com", "azure.com/openai"],
    "google": ["generativelanguage.googleapis.com", "aiplatform.googleapis.com", "gemini.google"],
    "azure_openai": ["openai.azure.com", "cognitiveservices.azure.com"],
    "cisco_circuit": ["chat.cisco.com", "webex.com/ai"],
    "meraki": ["meraki.com", "api.meraki.com"],
    "thousandeyes": ["thousandeyes.com"],
    # catalyst and splunk are matched dynamically against configured host
}


def _match_test_to_provider(test: Dict[str, Any]) -> Optional[str]:
    """Check if a test targets an AI or platform provider by its URL/server field."""
    url = (test.get("url") or test.get("server") or "").lower()
    name = (test.get("testName") or "").lower()
    combined = f"{url} {name}"

    for provider_key, patterns in _URL_PATTERNS.items():
        for pattern in patterns:
            if pattern in combined:
                return provider_key
    return None


async def _list_ai_assurance_tests() -> List[Dict[str, Any]]:
    """Return TE tests that target AI providers — both explicitly created and auto-discovered."""
    all_tests = await _te_make_request("GET", "tests")
    if "error" in all_tests:
        raise HTTPException(status_code=502, detail=all_tests["error"])

    tests: List[Dict[str, Any]] = []
    seen_ids: set = set()

    for test_group in all_tests.get("tests", [all_tests] if isinstance(all_tests, list) else []):
        items = test_group if isinstance(test_group, list) else [test_group]
        for t in items:
            test_id = t.get("testId") or t.get("id")
            if test_id in seen_ids:
                continue

            name = t.get("testName", "")
            # Match by prefix (explicitly created via this UI)
            if name.startswith(TEST_PREFIX):
                tests.append(t)
                seen_ids.add(test_id)
                continue

            # Match by URL/server targeting an AI provider
            if _match_test_to_provider(t):
                t["_discovered"] = True  # mark as auto-discovered
                tests.append(t)
                seen_ids.add(test_id)

    return tests


def _group_by_provider(tests: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group AI-related tests by provider."""
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for t in tests:
        name = t.get("testName", "")

        # First try: explicit prefix naming
        if name.startswith(TEST_PREFIX):
            after_prefix = name[len(TEST_PREFIX):].strip()
            provider_label = after_prefix.split(" - ")[0].strip() if " - " in after_prefix else after_prefix
            provider_key = "custom"
            for key, cfg in ALL_PROVIDERS.items():
                if cfg["display_name"] == provider_label:
                    provider_key = key
                    break
            grouped.setdefault(provider_key, []).append(t)
            continue

        # Second try: URL/server pattern matching
        matched = _match_test_to_provider(t)
        if matched:
            grouped.setdefault(matched, []).append(t)
            continue

        grouped.setdefault("custom", []).append(t)
    return grouped


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/tests")
async def create_ai_assurance_tests(
    req: CreateAITestRequest = Body(...),
    _: Any = Depends(require_editor),
):
    """Create an AI Assurance test suite for a provider."""
    # Validate TE is configured
    await _validate_te()

    cfg = await _resolve_provider(req)
    display = cfg["display_name"]
    target_url = cfg["url"]
    created: List[Dict[str, Any]] = []

    # Fetch available agents — required by TE v7 API
    agents = await _get_available_agents()

    server_host = target_url.replace("https://", "").replace("http://", "").split("/")[0]

    # 1. Agent-to-Server test — pure network path/latency monitoring
    # Uses shorter interval (120s) for rapid detection of path changes and packet loss
    network_test_data = {
        "testName": f"{TEST_PREFIX} {display} - Network Path",
        "server": server_host,
        "port": 443,
        "protocol": "TCP",
        "interval": min(req.interval, 120),  # 2min for network tests
        "alertsEnabled": True,
        "pathTraceMode": "classic",          # Enable traceroute for full hop-by-hop visibility
        "networkMeasurements": True,          # Enable network measurements (loss, latency, jitter)
        "bandwidthMeasurements": False,       # Not needed for API endpoints
        "mtuMeasurements": True,              # Detect MTU issues that cause fragmentation
        "agents": agents,
        "description": f"Monitors network path to {display} API — latency, loss, jitter, and route changes.",
    }
    net_result = await _te_make_request("POST", "tests/agent-to-server", data=network_test_data)
    if "error" in net_result:
        detail = net_result["error"]
        if isinstance(detail, dict):
            detail = detail.get("message", str(detail))
        raise HTTPException(status_code=502, detail=f"Failed to create network test: {detail}")
    created.append(net_result)

    # 2. HTTP Server test — endpoint availability, TLS, and response time
    # Always created for AI providers (critical for TTFB, TLS handshake, HTTP/2 monitoring)
    health_url = f"{target_url}{cfg['health_path']}"
    http_test_data = {
        "testName": f"{TEST_PREFIX} {display} - Endpoint Health",
        "url": health_url,
        "interval": req.interval or 300,      # 5min default for HTTP tests
        "alertsEnabled": True,
        "httpVersion": 2,                      # HTTP/2 (what AI APIs use)
        "sslVersionId": 0,                     # Auto-negotiate TLS
        "verifyCertificate": True,
        "followRedirects": True,
        "networkMeasurements": True,           # Include network layer metrics
        "pathTraceMode": "classic",            # Traceroute from HTTP test too
        "httpTimeLimit": 30000,                # 30s timeout (AI endpoints can be slow)
        "agents": agents,
        "description": f"Monitors {display} API availability — TLS, TTFB, response time, and HTTP status.",
    }
    http_result = await _te_make_request("POST", "tests/http-server", data=http_test_data)
    if "error" in http_result:
        logger.warning(f"HTTP endpoint test creation failed: {http_result['error']}")
    else:
        created.append(http_result)

    # 3. AI Quality test — prompt-based inference quality check (when ai_quality mode)
    if req.test_mode == "ai_quality" and req.prompt_template:
        payload = _build_ai_quality_payload(req.provider, req.prompt_template, req.model_id)
        content_regex = _build_content_regex(req.assertions or [])

        quality_test_data = {
            "testName": f"{TEST_PREFIX} {display} - AI Quality",
            "url": health_url,
            "interval": req.interval or 300,
            "alertsEnabled": True,
            "httpVersion": 2,
            "sslVersionId": 0,
            "verifyCertificate": True,
            "httpTimeLimit": 60000,  # 60s timeout for AI responses
            "postBody": json.dumps(payload),
            "headers": [
                {"name": "Content-Type", "value": "application/json"},
            ],
            "networkMeasurements": True,
            "agents": agents,
            "description": f"AI quality test for {display} — validates inference responses.",
        }
        if content_regex:
            quality_test_data["contentRegex"] = content_regex

        quality_result = await _te_make_request("POST", "tests/http-server", data=quality_test_data)
        if "error" in quality_result:
            logger.warning(f"AI quality test creation failed: {quality_result['error']}")
        else:
            created.append(quality_result)

        # Store prompt template config in system_config
        try:
            from src.services.config_service import get_config_service
            config_svc = get_config_service()
            import json as json_mod
            template_config = {
                "provider": req.provider,
                "prompt_text": req.prompt_template,
                "model_id": req.model_id,
                "assertions": [a.model_dump() for a in (req.assertions or [])],
            }
            await config_svc.set_config(
                f"ai_quality_template_{req.provider}",
                json_mod.dumps(template_config)
            )
        except Exception as e:
            logger.warning(f"Failed to store quality template config: {e}")

    return {
        "success": True,
        "provider": req.provider,
        "display_name": display,
        "test_mode": req.test_mode,
        "tests_created": len(created),
        "tests": created,
    }


@router.get("/tests")
async def list_ai_assurance_tests(_: Any = Depends(require_viewer)):
    """List all AI Assurance tests grouped by provider."""
    tests = await _list_ai_assurance_tests()
    grouped = _group_by_provider(tests)

    providers: List[Dict[str, Any]] = []
    for provider_key, provider_tests in grouped.items():
        cfg = ALL_PROVIDERS.get(provider_key, {"display_name": "Custom", "url": ""})
        has_network = any("Network Path" in t.get("testName", "") for t in provider_tests)
        has_inference = any("Inference Check" in t.get("testName", "") for t in provider_tests)
        is_platform = provider_key in PLATFORM_PROVIDERS
        has_discovered = any(t.get("_discovered") for t in provider_tests)
        has_managed = any(t.get("testName", "").startswith(TEST_PREFIX) for t in provider_tests)
        providers.append({
            "provider": provider_key,
            "display_name": cfg["display_name"],
            "test_mode": "full_assurance" if has_inference else "network_only",
            "tests": provider_tests,
            "source": "managed" if has_managed else "discovered",
            "status": "active",
            "category": "platform" if is_platform else "ai",
        })

    return {"providers": providers, "total_tests": len(tests)}


@router.get("/tests/{provider}/metrics")
async def get_provider_metrics(provider: str, _: Any = Depends(require_viewer)):
    """Get aggregated AI-specific metrics for a provider's tests."""
    tests = await _list_ai_assurance_tests()
    grouped = _group_by_provider(tests)
    provider_tests = grouped.get(provider, [])

    if not provider_tests:
        raise HTTPException(status_code=404, detail=f"No AI Assurance tests found for {provider}")

    # Fetch latest results for each test
    metrics: Dict[str, Any] = {
        "provider": provider,
        "display_name": ALL_PROVIDERS.get(provider, {}).get("display_name", provider),
        "test_count": len(provider_tests),
        "tests": [],
    }

    for t in provider_tests:
        test_id = t.get("testId") or t.get("id")
        if not test_id:
            continue
        test_type = t.get("type", "unknown")
        endpoint = f"test-results/{test_id}/network" if "agent-to-server" in test_type else f"test-results/{test_id}"
        try:
            results = await _te_make_request("GET", endpoint)
            metrics["tests"].append({
                "test_id": test_id,
                "test_name": t.get("testName", ""),
                "test_type": test_type,
                "results": results,
            })
        except Exception as e:
            logger.warning(f"Failed to fetch results for test {test_id}: {e}")
            metrics["tests"].append({
                "test_id": test_id,
                "test_name": t.get("testName", ""),
                "test_type": test_type,
                "results": None,
                "error": str(e),
            })

    return metrics


@router.get("/platforms")
async def list_platform_status(_: Any = Depends(require_viewer)):
    """List platform API providers with their configuration and TE test status."""
    from src.services.config_service import get_config_service
    config_svc = get_config_service()

    # Get existing tests to check which platforms have TE coverage
    try:
        tests = await _list_ai_assurance_tests()
        grouped = _group_by_provider(tests)
    except Exception:
        grouped = {}

    platforms = []
    for key, pcfg in PLATFORM_PROVIDERS.items():
        resolved_url = None
        is_configured = True

        if pcfg.get("resolve_from_config"):
            try:
                url = await config_svc.get_config(pcfg["config_key"])
                if not url and key == "splunk":
                    url = await config_svc.get_config("splunk_host")
                resolved_url = url
                is_configured = bool(url)
            except Exception:
                is_configured = False
        else:
            resolved_url = pcfg["url"]

        has_test = key in grouped and len(grouped[key]) > 0

        status = "active" if has_test else ("not_configured" if not is_configured else "no_test")

        platforms.append({
            "provider": key,
            "display_name": pcfg["display_name"],
            "url": resolved_url,
            "is_configured": is_configured,
            "has_test": has_test,
            "status": status,
            "tests": grouped.get(key, []),
        })

    return {"platforms": platforms}


@router.delete("/tests/{provider}")
async def delete_provider_tests(provider: str, _: Any = Depends(require_editor)):
    """Remove all AI Assurance tests for a provider."""
    tests = await _list_ai_assurance_tests()
    grouped = _group_by_provider(tests)
    provider_tests = grouped.get(provider, [])

    if not provider_tests:
        raise HTTPException(status_code=404, detail=f"No AI Assurance tests found for {provider}")

    deleted = 0
    errors = []
    for t in provider_tests:
        test_id = t.get("testId") or t.get("id")
        if not test_id:
            continue
        # TE v7 API requires test type in delete path: DELETE /tests/{testType}/{testId}
        test_type = t.get("type", "").strip()
        if not test_type:
            # Infer type from test name
            name = t.get("testName", "")
            if "Network Path" in name or "agent-to-server" in name.lower():
                test_type = "agent-to-server"
            elif "Inference" in name or "http-server" in name.lower() or "AI Quality" in name or "Endpoint Health" in name:
                test_type = "http-server"
        try:
            if test_type:
                result = await _te_make_request("DELETE", f"tests/{test_type}/{test_id}")
            else:
                # Fallback: try common types
                result = await _te_make_request("DELETE", f"tests/agent-to-server/{test_id}")
                if "error" in result:
                    result = await _te_make_request("DELETE", f"tests/http-server/{test_id}")
            if "error" in result:
                errors.append(f"Test {test_id}: {result['error']}")
            else:
                deleted += 1
        except Exception as e:
            errors.append(f"Test {test_id}: {str(e)}")

    return {
        "provider": provider,
        "deleted": deleted,
        "errors": errors if errors else None,
    }


@router.get("/tests/{provider}/ai-quality")
async def get_ai_quality_results(provider: str, _: Any = Depends(require_viewer)):
    """Get AI quality test results for a provider."""
    tests = await _list_ai_assurance_tests()
    grouped = _group_by_provider(tests)
    provider_tests = grouped.get(provider, [])

    # Find AI Quality test
    quality_test = None
    for t in provider_tests:
        name = t.get("testName", "")
        if "AI Quality" in name:
            quality_test = t
            break

    if not quality_test:
        return {"results": [], "summary": None, "regional": []}

    test_id = quality_test.get("testId") or quality_test.get("id")
    if not test_id:
        return {"results": [], "summary": None, "regional": []}

    try:
        results_data = await _te_make_request("GET", f"test-results/{test_id}/http-server")
        raw_results = results_data.get("results", [])
        if not isinstance(raw_results, list):
            raw_results = raw_results.get("results", []) if isinstance(raw_results, dict) else []

        # Transform to AIQualityResult format
        results = []
        regional_map: Dict[str, Dict] = {}
        total_response_time = 0
        total_assertions_passed = 0
        total_assertions = 0

        for r in raw_results:
            response_time = r.get("responseTime", 0)
            agent_name = r.get("agent", {}).get("agentName", "Unknown") if isinstance(r.get("agent"), dict) else "Unknown"
            status_code = r.get("httpStatusCode", r.get("responseCode", 0))

            result_entry = {
                "timestamp": r.get("date", r.get("roundId", "")),
                "response_time_ms": response_time,
                "ttfb_ms": r.get("connectTime", 0),
                "status_code": status_code,
                "agent_location": agent_name,
                "assertions_passed": 1 if status_code == 200 else 0,
                "assertions_failed": 0 if status_code == 200 else 1,
                "assertion_results": [],
            }
            results.append(result_entry)
            total_response_time += response_time

            # Regional aggregation
            if agent_name not in regional_map:
                regional_map[agent_name] = {"total_rt": 0, "total_lat": 0, "passed": 0, "total": 0, "count": 0}
            rm = regional_map[agent_name]
            rm["total_rt"] += response_time
            rm["total_lat"] += r.get("avgLatency", 0)
            rm["passed"] += (1 if status_code == 200 else 0)
            rm["total"] += 1
            rm["count"] += 1

        # Build summary
        count = len(results)
        summary = {
            "avg_response_time_ms": total_response_time / count if count > 0 else 0,
            "token_efficiency": 0.85,  # Placeholder - would need token counting
            "assertion_pass_rate": (sum(1 for r in results if r["status_code"] == 200) / count * 100) if count > 0 else 0,
            "availability_pct": (sum(1 for r in results if r["status_code"] == 200) / count * 100) if count > 0 else 0,
        }

        # Build regional metrics
        regional = []
        for loc, data in regional_map.items():
            c = data["count"]
            pass_rate = (data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
            avg_rt = data["total_rt"] / c if c > 0 else 0
            regional.append({
                "agent_location": loc,
                "avg_response_time_ms": avg_rt,
                "avg_latency_ms": data["total_lat"] / c if c > 0 else 0,
                "assertion_pass_rate": pass_rate,
                "sample_count": c,
                "health": "healthy" if pass_rate >= 95 and avg_rt < 2000 else "degraded" if pass_rate >= 80 else "failing",
            })

        return {"results": results, "summary": summary, "regional": regional}
    except Exception as e:
        logger.error(f"Failed to fetch AI quality results: {e}")
        return {"results": [], "summary": None, "regional": []}


@router.get("/tests/{provider}/assertions")
async def get_assertion_history(provider: str, _: Any = Depends(require_viewer)):
    """Get assertion pass/fail history for a provider's AI quality tests."""
    tests = await _list_ai_assurance_tests()
    grouped = _group_by_provider(tests)
    provider_tests = grouped.get(provider, [])

    quality_test = None
    for t in provider_tests:
        if "AI Quality" in t.get("testName", ""):
            quality_test = t
            break

    if not quality_test:
        return {"assertions": [], "pass_rate": 0, "history": []}

    test_id = quality_test.get("testId") or quality_test.get("id")
    if not test_id:
        return {"assertions": [], "pass_rate": 0, "history": []}

    try:
        # Fetch alert data for assertion history
        alerts_data = await _te_make_request("GET", f"alerts?testId={test_id}")
        alerts = alerts_data.get("alerts", alerts_data.get("alert", []))
        if not isinstance(alerts, list):
            alerts = []

        assertions = []
        for alert in alerts[:20]:
            assertions.append({
                "type": "status_code",
                "target": "response",
                "operator": "equals",
                "expected": "200",
                "actual": str(alert.get("violationCount", 0)),
                "passed": not alert.get("active", False),
                "description": alert.get("ruleExpression", ""),
            })

        # Build simple history from results
        results_data = await _te_make_request("GET", f"test-results/{test_id}/http-server")
        raw_results = results_data.get("results", [])
        if not isinstance(raw_results, list):
            raw_results = raw_results.get("results", []) if isinstance(raw_results, dict) else []

        history = []
        for r in raw_results[-48:]:
            status = r.get("httpStatusCode", r.get("responseCode", 0))
            history.append({
                "timestamp": r.get("date", r.get("roundId", "")),
                "pass_rate": 100.0 if status == 200 else 0.0,
            })

        total = len(history)
        passed = sum(1 for h in history if h["pass_rate"] == 100)
        overall_rate = (passed / total * 100) if total > 0 else 0

        return {"assertions": assertions, "pass_rate": overall_rate, "history": history}
    except Exception as e:
        logger.error(f"Failed to fetch assertion history: {e}")
        return {"assertions": [], "pass_rate": 0, "history": []}


# ---------------------------------------------------------------------------
# Prompt Templates
# ---------------------------------------------------------------------------

BUILTIN_TEMPLATES = [
    {
        "id": "builtin_summarization",
        "name": "Summarization",
        "provider": "any",
        "prompt_text": "Summarize the following text in 3 bullet points: The Internet Protocol (IP) is the network layer communications protocol for routing and addressing packets of data so that they can travel across networks and arrive at the correct destination.",
        "model_id": None,
        "assertions": [
            {"type": "status_code", "target": "response", "operator": "equals", "expected": "200"},
            {"type": "response_time_lt", "target": "response", "operator": "less_than", "expected": "5000"},
        ],
        "is_builtin": True,
    },
    {
        "id": "builtin_code_generation",
        "name": "Code Generation",
        "provider": "any",
        "prompt_text": "Write a Python function that checks if a string is a palindrome. Return only the function code.",
        "model_id": None,
        "assertions": [
            {"type": "status_code", "target": "response", "operator": "equals", "expected": "200"},
            {"type": "response_contains", "target": "body", "operator": "contains", "expected": "def"},
            {"type": "response_time_lt", "target": "response", "operator": "less_than", "expected": "10000"},
        ],
        "is_builtin": True,
    },
    {
        "id": "builtin_reasoning",
        "name": "Reasoning",
        "provider": "any",
        "prompt_text": "If a train travels at 60 mph for 2.5 hours, how far does it travel? Show your work step by step.",
        "model_id": None,
        "assertions": [
            {"type": "status_code", "target": "response", "operator": "equals", "expected": "200"},
            {"type": "response_contains", "target": "body", "operator": "contains", "expected": "150"},
            {"type": "response_time_lt", "target": "response", "operator": "less_than", "expected": "8000"},
        ],
        "is_builtin": True,
    },
    {
        "id": "builtin_classification",
        "name": "Classification",
        "provider": "any",
        "prompt_text": "Classify the following text as positive, negative, or neutral: 'The network performance has been excellent this quarter with zero outages.' Respond with only the classification.",
        "model_id": None,
        "assertions": [
            {"type": "status_code", "target": "response", "operator": "equals", "expected": "200"},
            {"type": "response_contains", "target": "body", "operator": "contains", "expected": "positive"},
            {"type": "response_time_lt", "target": "response", "operator": "less_than", "expected": "5000"},
        ],
        "is_builtin": True,
    },
]


@router.get("/prompt-templates")
async def list_prompt_templates(_: Any = Depends(require_viewer)):
    """List all prompt templates (built-in + custom)."""
    templates = list(BUILTIN_TEMPLATES)

    # Load custom templates from system_config
    try:
        from src.services.config_service import get_config_service
        config_svc = get_config_service()
        custom_raw = await config_svc.get_config("ai_quality_custom_templates")
        if custom_raw:
            import json as json_mod
            custom = json_mod.loads(custom_raw)
            if isinstance(custom, list):
                templates.extend(custom)
    except Exception as e:
        logger.warning(f"Failed to load custom templates: {e}")

    return {"templates": templates}


@router.post("/prompt-templates")
async def create_prompt_template(
    template: PromptTemplate = Body(...),
    _: Any = Depends(require_editor),
):
    """Create a custom prompt template."""
    import json as json_mod
    import uuid

    new_template = {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "name": template.name,
        "provider": template.provider,
        "prompt_text": template.prompt_text,
        "model_id": template.model_id,
        "assertions": [a.model_dump() for a in template.assertions],
        "is_builtin": False,
    }

    # Load existing custom templates and append
    try:
        from src.services.config_service import get_config_service
        config_svc = get_config_service()
        existing_raw = await config_svc.get_config("ai_quality_custom_templates")
        existing = json_mod.loads(existing_raw) if existing_raw else []
        if not isinstance(existing, list):
            existing = []
        existing.append(new_template)
        await config_svc.set_config("ai_quality_custom_templates", json_mod.dumps(existing))
    except Exception as e:
        logger.error(f"Failed to store custom template: {e}")
        raise HTTPException(500, f"Failed to store template: {e}")

    return new_template


@router.get("/regional-comparison/{provider}")
async def get_regional_comparison(provider: str, _: Any = Depends(require_viewer)):
    """Get per-agent-location performance metrics for a provider."""
    # Reuse AI quality results endpoint logic
    result = await get_ai_quality_results(provider, _)
    return {"regional": result.get("regional", [])}
