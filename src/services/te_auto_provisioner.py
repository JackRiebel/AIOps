"""TE Auto-Provisioner — automatically creates ThousandEyes tests for AI providers.

When a new AI provider is used in a chat query, this service ensures TE
agent-to-server and HTTP server tests exist for that provider. All operations
are fire-and-forget safe — provisioning failures never block chat.
"""

import asyncio
import logging
from typing import Any, Dict, Optional, Set

logger = logging.getLogger(__name__)

# Map trace provider names → AI Assurance provider keys
_TRACE_TO_ASSURANCE: Dict[str, str] = {
    "anthropic": "anthropic",
    "openai": "openai",
    "google": "google",
    "azure": "azure_openai",
    "cisco": "cisco_circuit",
}

# Reverse of the above for display lookups
_ASSURANCE_TO_TRACE: Dict[str, str] = {v: k for k, v in _TRACE_TO_ASSURANCE.items()}


class TEAutoProvisioner:
    """Singleton service that auto-creates TE tests for AI providers."""

    def __init__(self):
        self._provisioned: Set[str] = set()  # assurance keys with known TE tests
        self._in_progress: Set[str] = set()  # currently being provisioned
        self._initialized = False

    async def _lazy_init(self) -> None:
        """One-time scan of existing [AI Assurance] tests to populate _provisioned set."""
        if self._initialized:
            return
        self._initialized = True
        try:
            from src.api.routes.ai_endpoint_monitor import (
                _list_ai_assurance_tests,
                _group_by_provider,
            )
            tests = await _list_ai_assurance_tests()
            grouped = _group_by_provider(tests)
            self._provisioned = set(grouped.keys())
            logger.info(f"[TEAutoProvisioner] Discovered existing tests for: {self._provisioned}")
        except Exception as e:
            logger.debug(f"[TEAutoProvisioner] Init scan failed (TE may not be configured): {e}")

    def _resolve_assurance_key(self, provider: str) -> Optional[str]:
        """Map a trace provider name to an AI Assurance provider key."""
        if not provider:
            return None
        lower = provider.lower().strip()
        return _TRACE_TO_ASSURANCE.get(lower, lower)

    async def ensure_tests_for_provider(self, provider: Optional[str]) -> None:
        """Ensure TE tests exist for the given provider. Fire-and-forget safe."""
        if not provider:
            return

        assurance_key = self._resolve_assurance_key(provider)
        if not assurance_key:
            return

        # Skip if already provisioned or in progress
        if assurance_key in self._provisioned or assurance_key in self._in_progress:
            return

        # Check if TE is configured
        try:
            from src.config.settings import get_settings
            settings = get_settings()
            token = getattr(settings, 'thousandeyes_token', None) or getattr(settings, 'thousandeyes_oauth_token', None)
            if not token:
                return  # No TE token — skip silently
        except Exception:
            return

        # Lazy init: scan existing tests on first real call
        await self._lazy_init()

        # Re-check after init
        if assurance_key in self._provisioned:
            return

        # Check if this is a known provider we can create tests for
        try:
            from src.api.routes.ai_endpoint_monitor import AI_PROVIDERS, PLATFORM_PROVIDERS
            if assurance_key not in AI_PROVIDERS and assurance_key not in PLATFORM_PROVIDERS:
                return  # Unknown provider — skip
        except Exception:
            return

        self._in_progress.add(assurance_key)
        try:
            await self._create_tests(assurance_key)
            self._provisioned.add(assurance_key)
            logger.info(f"[TEAutoProvisioner] Auto-provisioned TE tests for '{assurance_key}'")

            # Invalidate correlator cache so new tests are discoverable immediately
            try:
                from src.services.te_path_correlator import get_te_path_correlator, PLATFORM_DESTINATIONS
                correlator = get_te_path_correlator()
                destination = PLATFORM_DESTINATIONS.get(assurance_key)
                if destination:
                    correlator.invalidate_destination_cache(destination)
            except Exception:
                pass

            # Persist provisioned set to system_config
            await self._persist_status()
        except Exception as e:
            logger.warning(f"[TEAutoProvisioner] Failed to create tests for '{assurance_key}': {e}")
        finally:
            self._in_progress.discard(assurance_key)

    async def _create_tests(self, assurance_key: str) -> None:
        """Create agent-to-server + HTTP server test pair for a provider."""
        from src.api.routes.ai_endpoint_monitor import (
            AI_PROVIDERS,
            PLATFORM_PROVIDERS,
            ALL_PROVIDERS,
            TEST_PREFIX,
            _te_make_request,
            _get_available_agents,
            _resolve_platform_url,
        )

        # Resolve provider config
        cfg = AI_PROVIDERS.get(assurance_key) or PLATFORM_PROVIDERS.get(assurance_key)
        if not cfg:
            raise ValueError(f"Unknown provider: {assurance_key}")

        display = cfg["display_name"]
        target_url = cfg.get("url")

        # Resolve dynamic URL for platform providers
        if not target_url and cfg.get("resolve_from_config"):
            target_url = await _resolve_platform_url(assurance_key)

        if not target_url:
            raise ValueError(f"No URL for provider: {assurance_key}")

        agents = await _get_available_agents()
        server_host = target_url.replace("https://", "").replace("http://", "").split("/")[0]

        # 1. Agent-to-Server test — network path/latency monitoring
        network_test_data = {
            "testName": f"{TEST_PREFIX} {display} - Network Path",
            "server": server_host,
            "port": 443,
            "protocol": "TCP",
            "interval": 120,
            "alertsEnabled": True,
            "pathTraceMode": "classic",
            "networkMeasurements": True,
            "bandwidthMeasurements": False,
            "mtuMeasurements": True,
            "agents": agents,
            "description": f"Auto-provisioned: monitors network path to {display} API.",
        }
        net_result = await _te_make_request("POST", "tests/agent-to-server", data=network_test_data)
        if "error" in net_result:
            raise RuntimeError(f"Network test creation failed: {net_result['error']}")

        # 2. HTTP Server test — endpoint availability, TLS, response time
        health_path = cfg.get("health_path", "")
        health_url = f"{target_url}{health_path}"
        http_test_data = {
            "testName": f"{TEST_PREFIX} {display} - Endpoint Health",
            "url": health_url,
            "interval": 300,
            "alertsEnabled": True,
            "httpVersion": 2,
            "sslVersionId": 0,
            "verifyCertificate": True,
            "followRedirects": True,
            "networkMeasurements": True,
            "pathTraceMode": "classic",
            "httpTimeLimit": 30000,
            "agents": agents,
            "description": f"Auto-provisioned: monitors {display} API availability.",
        }
        http_result = await _te_make_request("POST", "tests/http-server", data=http_test_data)
        if "error" in http_result:
            logger.warning(f"[TEAutoProvisioner] HTTP test creation failed for {assurance_key}: {http_result['error']}")

    async def _persist_status(self) -> None:
        """Persist provisioned providers to system_config."""
        try:
            import json
            from src.services.config_service import get_config_service
            config_svc = get_config_service()
            await config_svc.set_config(
                "te_auto_provisioned_providers",
                json.dumps(sorted(self._provisioned)),
            )
        except Exception as e:
            logger.debug(f"[TEAutoProvisioner] Failed to persist status: {e}")

    def get_monitoring_status(self) -> Dict[str, bool]:
        """Return {provider: bool} dict indicating which providers have TE tests."""
        from src.api.routes.ai_endpoint_monitor import AI_PROVIDERS
        status: Dict[str, bool] = {}
        for assurance_key in AI_PROVIDERS:
            trace_key = _ASSURANCE_TO_TRACE.get(assurance_key, assurance_key)
            status[trace_key] = assurance_key in self._provisioned
        return status


_provisioner: Optional[TEAutoProvisioner] = None


def get_te_auto_provisioner() -> TEAutoProvisioner:
    """Get the singleton TEAutoProvisioner instance."""
    global _provisioner
    if _provisioner is None:
        _provisioner = TEAutoProvisioner()
    return _provisioner
