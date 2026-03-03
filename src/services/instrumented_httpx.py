"""Instrumented httpx transport for capturing network timing per request.

Wraps an httpx.AsyncHTTPTransport to inject httpcore trace callbacks,
capturing TCP connect, TLS handshake, and TTFB timing, plus the
resolved server IP. Data is stored in a thread-local-like dict keyed
by request, then extracted after each request completes.

Usage:
    transport = InstrumentedAsyncTransport()
    client = httpx.AsyncClient(transport=transport)
    # After requests, call transport.pop_timing() to get the last timing
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class RequestTiming:
    """Network timing captured for a single HTTP request."""
    tcp_connect_ms: Optional[int] = None
    tls_ms: Optional[int] = None
    ttfb_ms: Optional[int] = None
    server_ip: Optional[str] = None
    server_port: Optional[int] = None
    tls_version: Optional[str] = None
    http_version: Optional[str] = None

    # Internal monotonic timestamps
    _phase_starts: Dict[str, float] = field(default_factory=dict, repr=False)


class InstrumentedAsyncTransport(httpx.AsyncHTTPTransport):
    """httpx async transport that captures per-request network timing.

    Injects a httpcore trace callback into each request's extensions to
    capture TCP connect, TLS handshake, and TTFB timing phases. Also
    extracts server IP and TLS version from the response.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._last_timing: Optional[RequestTiming] = None

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        timing = RequestTiming()

        async def trace_callback(name: str, info: Dict[str, Any]) -> None:
            """httpcore trace callback - captures phase start/complete timestamps."""
            try:
                if name.endswith(".started"):
                    timing._phase_starts[name] = time.monotonic()
                elif name.endswith(".complete"):
                    started_key = name.replace(".complete", ".started")
                    start = timing._phase_starts.get(started_key)
                    if start is not None:
                        elapsed_ms = int((time.monotonic() - start) * 1000)
                        # Map event names to timing fields
                        if "connect_tcp" in name:
                            timing.tcp_connect_ms = elapsed_ms
                        elif "start_tls" in name:
                            timing.tls_ms = elapsed_ms
                        elif "receive_response_headers" in name:
                            timing.ttfb_ms = elapsed_ms
            except Exception:
                pass  # Never break the request

        # Inject trace callback into request extensions
        request.extensions["trace"] = trace_callback

        response = await super().handle_async_request(request)

        # Extract server IP and TLS info from the response
        try:
            network_stream = response.extensions.get("network_stream")
            if network_stream is not None:
                server_addr = network_stream.get_extra_info("server_addr")
                if server_addr and isinstance(server_addr, tuple):
                    timing.server_ip = str(server_addr[0])
                    timing.server_port = int(server_addr[1])

                ssl_object = network_stream.get_extra_info("ssl_object")
                if ssl_object is not None:
                    timing.tls_version = getattr(ssl_object, 'version', lambda: None)()

            http_ver = response.extensions.get("http_version")
            if http_ver:
                timing.http_version = http_ver.decode() if isinstance(http_ver, bytes) else str(http_ver)
        except Exception:
            pass  # Best-effort extraction

        self._last_timing = timing
        return response

    def pop_timing(self) -> Optional[RequestTiming]:
        """Pop and return the last captured timing, or None."""
        t = self._last_timing
        self._last_timing = None
        return t


def create_instrumented_client(
    verify: bool = True,
    timeout: Optional[httpx.Timeout] = None,
) -> tuple[httpx.AsyncClient, "InstrumentedAsyncTransport"]:
    """Create an httpx.AsyncClient with an instrumented transport.

    Returns (client, transport) tuple. Use transport.pop_timing() after
    requests to get captured network timing.
    """
    if timeout is None:
        timeout = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0)

    transport = InstrumentedAsyncTransport(verify=verify)
    client = httpx.AsyncClient(transport=transport, timeout=timeout)
    return client, transport
