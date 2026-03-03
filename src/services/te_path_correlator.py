"""ThousandEyes Path Correlation Service.

Maps destinations (AI providers, platform APIs) to ThousandEyes tests,
fetches path-vis data, and normalizes hop lists for trace enrichment.
Uses a 5-minute cache to avoid repeated API calls.
"""

import asyncio
import logging
import time
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Known platform API destinations
PLATFORM_DESTINATIONS: Dict[str, Optional[str]] = {
    "anthropic": "api.anthropic.com",
    "openai": "api.openai.com",
    "google": "generativelanguage.googleapis.com",
    "meraki": "api.meraki.com",
    "thousandeyes": "api.thousandeyes.com",
    "splunk": None,      # customer-configured
    "catalyst": None,    # customer-configured
}

CACHE_TTL_SECONDS = 300  # 5 minutes


class TEPathCorrelator:
    """Correlates destinations with ThousandEyes path-vis data."""

    def __init__(self):
        self._test_cache: Dict[str, Optional[int]] = {}     # destination → test_id
        self._test_type_cache: Dict[int, str] = {}           # test_id → test_type
        self._path_cache: Dict[int, Tuple[float, list]] = {}  # test_id → (timestamp, hops)
        self._enrichment_cache: Dict[int, Tuple[float, Dict]] = {}  # test_id → (timestamp, full enrichment)
        self._te_client = None
        self._dynamic_resolved = False

    def _get_te_client(self):
        """Get a ThousandEyes client from configured credentials."""
        if self._te_client is not None:
            return self._te_client

        try:
            from src.config.settings import get_settings
            settings = get_settings()
            token = getattr(settings, 'thousandeyes_token', None) or getattr(settings, 'thousandeyes_oauth_token', None)
            if not token:
                return None
            from src.services.thousandeyes_service import ThousandEyesClient
            self._te_client = ThousandEyesClient(oauth_token=token)
            return self._te_client
        except Exception:
            return None

    async def _resolve_dynamic_destinations(self) -> None:
        """Resolve customer-configured platform URLs from system config (one-time)."""
        if self._dynamic_resolved:
            return
        self._dynamic_resolved = True
        try:
            from src.services.config_service import get_config_service
            from urllib.parse import urlparse
            config_svc = get_config_service()

            catalyst_host = await config_svc.get_config("catalyst_center_host")
            if catalyst_host:
                parsed = urlparse(catalyst_host if "://" in catalyst_host else f"https://{catalyst_host}")
                PLATFORM_DESTINATIONS["catalyst"] = parsed.hostname or catalyst_host

            splunk_host = await config_svc.get_config("splunk_api_url") or await config_svc.get_config("splunk_host")
            if splunk_host:
                parsed = urlparse(splunk_host if "://" in splunk_host else f"https://{splunk_host}")
                PLATFORM_DESTINATIONS["splunk"] = parsed.hostname or splunk_host
        except Exception:
            pass

    async def get_path_for_destination(
        self, destination: str, platform: Optional[str] = None,
    ) -> Optional[List[Dict]]:
        """Get hop-by-hop path data for a destination.

        Args:
            destination: Hostname or IP address
            platform: Platform identifier (e.g., 'meraki', 'anthropic')

        Returns:
            Normalized hop list or None
        """
        client = self._get_te_client()
        if not client:
            return None

        # Resolve destination from platform if needed
        if not destination and platform:
            destination = PLATFORM_DESTINATIONS.get(platform.lower())
        if not destination:
            return None

        try:
            test_id = await self._find_test_for_destination(destination)
            if not test_id:
                return None

            return await self._fetch_path_vis(test_id)
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] Failed for {destination}: {e}")
            return None

    async def get_full_enrichment(
        self, destination: str, platform: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get combined TE data (path hops, network metrics, BGP, HTTP timing) for a destination."""
        client = self._get_te_client()
        if not client:
            return None

        # Lazily resolve dynamic platform destinations on first call
        await self._resolve_dynamic_destinations()

        if not destination and platform:
            destination = PLATFORM_DESTINATIONS.get(platform.lower())
        if not destination:
            return None

        try:
            test_id = await self._find_test_for_destination(destination)
            if not test_id:
                return None

            # Check enrichment cache
            if test_id in self._enrichment_cache:
                ts, data = self._enrichment_cache[test_id]
                if time.time() - ts < CACHE_TTL_SECONDS:
                    return data

            test_type = self._test_type_cache.get(test_id, "agent-to-server")

            # Fetch all data concurrently
            async def _noop():
                return None

            path_hops, network_metrics, bgp_routes, http_timing = await asyncio.gather(
                self._fetch_path_vis(test_id),
                self._fetch_network_results(test_id),
                self._fetch_bgp_results(test_id),
                self._fetch_http_server_results(test_id) if test_type == "http-server" else _noop(),
                return_exceptions=True,
            )

            # Normalize exceptions to None
            if isinstance(path_hops, Exception):
                path_hops = None
            if isinstance(network_metrics, Exception):
                network_metrics = None
            if isinstance(bgp_routes, Exception):
                bgp_routes = None
            if isinstance(http_timing, Exception):
                http_timing = None

            enrichment: Dict[str, Any] = {
                "path_hops": path_hops or [],
                "network_metrics": network_metrics,
                "bgp_routes": bgp_routes or [],
                "http_timing": http_timing,
                "test_id": test_id,
                "test_type": test_type,
                "agent_name": None,
            }

            self._enrichment_cache[test_id] = (time.time(), enrichment)
            return enrichment
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] Full enrichment failed for {destination}: {e}")
            return None

    async def _fetch_network_results(self, test_id: int) -> Optional[Dict[str, Any]]:
        """Fetch network test results (loss/latency/jitter)."""
        client = self._get_te_client()
        if not client:
            return None

        try:
            async with client._make_client() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/test-results/{test_id}/network",
                    headers=client.headers,
                    params={"window": "2h"},
                )
                if response.status_code != 200:
                    return None
                data = response.json()

            results = data.get("results", [])
            if not results:
                return None

            # Use latest result
            latest = results[0]
            return {
                "loss": latest.get("loss", 0),
                "latency": latest.get("avgLatency", 0),
                "jitter": latest.get("jitter", 0),
                "bandwidth": latest.get("bandwidth"),
            }
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] Network results failed for test {test_id}: {e}")
            return None

    async def _fetch_bgp_results(self, test_id: int) -> Optional[List[Dict[str, Any]]]:
        """Fetch BGP route data for a test."""
        client = self._get_te_client()
        if not client:
            return None

        try:
            async with client._make_client() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/test-results/{test_id}/bgp",
                    headers=client.headers,
                    params={"window": "2h"},
                )
                if response.status_code != 200:
                    return None
                data = response.json()

            results = data.get("results", [])
            if not results:
                return None

            routes = []
            for r in results:
                bgp_data = r.get("bgpData", [])
                for entry in bgp_data:
                    route = {
                        "prefix": entry.get("prefix", ""),
                        "asPath": entry.get("asPath", []),
                        "reachability": entry.get("reachability", 0),
                        "updates": entry.get("updates", 0),
                        "monitor": r.get("monitor", {}).get("monitorName", ""),
                    }
                    routes.append(route)
            return routes
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] BGP results failed for test {test_id}: {e}")
            return None

    async def _fetch_http_server_results(self, test_id: int) -> Optional[Dict[str, Any]]:
        """Fetch HTTP server test results (timing breakdown)."""
        client = self._get_te_client()
        if not client:
            return None

        try:
            async with client._make_client() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/test-results/{test_id}/http-server",
                    headers=client.headers,
                    params={"window": "2h"},
                )
                if response.status_code != 200:
                    return None
                data = response.json()

            results = data.get("results", [])
            if not results:
                return None

            latest = results[0]
            return {
                "dnsTime": latest.get("dnsTime", 0),
                "connectTime": latest.get("connectTime", 0),
                "sslTime": latest.get("sslNegotiationTime", 0),
                "waitTime": latest.get("waitTime", 0),
                "receiveTime": latest.get("receiveTime", 0),
                "responseTime": latest.get("responseTime", 0),
                "wireSize": latest.get("wireSize", 0),
                "throughput": latest.get("throughput"),
            }
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] HTTP server results failed for test {test_id}: {e}")
            return None

    async def _find_test_for_destination(self, destination: str) -> Optional[int]:
        """Find a TE test targeting this destination."""
        # Check cache
        if destination in self._test_cache:
            return self._test_cache[destination]

        client = self._get_te_client()
        if not client:
            return None

        try:
            result = await client.get_tests()
            if not result.get("success"):
                return None

            tests = result.get("tests", [])
            dest_lower = destination.lower()

            for test in tests:
                test_type = test.get("type", "")
                # Only agent-to-server and http-server tests have path-vis
                if test_type not in ("agent-to-server", "http-server"):
                    continue

                server = (test.get("server") or "").lower()
                url = (test.get("url") or "").lower()
                test_name = (test.get("testName") or "").lower()

                if dest_lower in server or dest_lower in url or dest_lower in test_name:
                    test_id = test.get("testId")
                    if test_id:
                        self._test_cache[destination] = int(test_id)
                        self._test_type_cache[int(test_id)] = test_type
                        return int(test_id)

            # No matching test found
            self._test_cache[destination] = None
            return None
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] Test lookup failed: {e}")
            return None

    async def _fetch_path_vis(self, test_id: int) -> Optional[List[Dict]]:
        """Fetch path-vis data for a test, with caching."""
        # Check cache
        if test_id in self._path_cache:
            ts, hops = self._path_cache[test_id]
            if time.time() - ts < CACHE_TTL_SECONDS:
                return hops

        client = self._get_te_client()
        if not client:
            return None

        try:
            from src.config.settings import get_settings
            settings = get_settings()
            import httpx

            # Step 1: Get path-vis summary
            async with client._make_client() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/test-results/{test_id}/path-vis",
                    headers=client.headers,
                    params={"window": "2h"},
                )
                if response.status_code != 200:
                    return None
                summary = response.json()

            results = summary.get("results", [])
            if not results:
                return None

            # Pick first agent's latest round
            first = results[0]
            agent_id = first.get("agent", {}).get("agentId")
            round_id = first.get("roundId")
            if not agent_id or not round_id:
                return None

            # Step 2: Get detailed path-vis
            async with client._make_client() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/test-results/{test_id}/path-vis/agent/{agent_id}/round/{round_id}",
                    headers=client.headers,
                )
                if response.status_code != 200:
                    return None
                detail = response.json()

            detail_results = detail.get("results", [])
            if not detail_results:
                return None

            # Normalize hops from the first path trace
            hops = self._normalize_hops(detail_results)
            self._path_cache[test_id] = (time.time(), hops)
            return hops
        except Exception as e:
            logger.debug(f"[TEPathCorrelator] Path-vis fetch failed for test {test_id}: {e}")
            return None

    def _normalize_hops(self, results: List[Dict]) -> List[Dict]:
        """Extract and normalize hop data from TE path-vis results."""
        hops = []
        for result in results:
            path_traces = result.get("pathTraces", [])
            for trace in path_traces:
                for hop_entry in trace.get("hops", []):
                    hop = {
                        "ip": hop_entry.get("ipAddress", ""),
                        "prefix": hop_entry.get("prefix", ""),
                        "delay": hop_entry.get("delay", 0),
                        "loss": hop_entry.get("loss", 0),
                        "network": hop_entry.get("network", ""),
                        "rdns": hop_entry.get("rdns", ""),
                    }
                    if hop["ip"]:
                        hops.append(hop)
            if hops:  # Use first path trace
                break
        return hops


_correlator: Optional[TEPathCorrelator] = None


def get_te_path_correlator() -> TEPathCorrelator:
    """Get the singleton TEPathCorrelator instance."""
    global _correlator
    if _correlator is None:
        _correlator = TEPathCorrelator()
    return _correlator
