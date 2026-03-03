"""EMA-based baselines for AI trace network timing.

Maintains per-destination exponential moving averages (EMA) for TCP, TLS,
TTFB, and total duration. Used to detect anomalies when current values
significantly exceed baseline.

No new database tables — baselines are computed in-memory from recent spans
and updated incrementally as new spans arrive.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# EMA smoothing factor (lower = smoother, higher = more responsive)
EMA_ALPHA = 0.1
# Minimum samples before baseline is considered valid
MIN_SAMPLES = 5
# Anomaly threshold: current > baseline * ANOMALY_FACTOR is flagged
ANOMALY_FACTOR = 2.0


@dataclass
class MetricBaseline:
    """EMA baseline for a single metric."""
    value: float = 0.0
    samples: int = 0

    def update(self, measurement: float) -> None:
        if self.samples == 0:
            self.value = measurement
        else:
            self.value = EMA_ALPHA * measurement + (1 - EMA_ALPHA) * self.value
        self.samples += 1

    @property
    def is_valid(self) -> bool:
        return self.samples >= MIN_SAMPLES

    def is_anomalous(self, measurement: float) -> bool:
        if not self.is_valid or self.value <= 0:
            return False
        return measurement > self.value * ANOMALY_FACTOR


@dataclass
class DestinationBaseline:
    """Combined baselines for a destination."""
    tcp: MetricBaseline = field(default_factory=MetricBaseline)
    tls: MetricBaseline = field(default_factory=MetricBaseline)
    ttfb: MetricBaseline = field(default_factory=MetricBaseline)
    duration: MetricBaseline = field(default_factory=MetricBaseline)


class TraceBaselineService:
    """In-memory EMA baselines per destination (platform:server_ip)."""

    def __init__(self):
        self._baselines: Dict[str, DestinationBaseline] = {}
        self._seeded = False

    def _key(self, server_ip: str, platform: str) -> str:
        return f"{(platform or 'unknown').lower()}:{server_ip}"

    def update(
        self,
        server_ip: str,
        platform: str,
        tcp_ms: Optional[float] = None,
        tls_ms: Optional[float] = None,
        ttfb_ms: Optional[float] = None,
        duration_ms: Optional[float] = None,
    ) -> None:
        """Update baselines with a new measurement."""
        key = self._key(server_ip, platform)
        if key not in self._baselines:
            self._baselines[key] = DestinationBaseline()

        bl = self._baselines[key]
        if tcp_ms is not None and tcp_ms > 0:
            bl.tcp.update(tcp_ms)
        if tls_ms is not None and tls_ms > 0:
            bl.tls.update(tls_ms)
        if ttfb_ms is not None and ttfb_ms > 0:
            bl.ttfb.update(ttfb_ms)
        if duration_ms is not None and duration_ms > 0:
            bl.duration.update(duration_ms)

    def get_baseline(self, server_ip: str, platform: str) -> Dict:
        """Get current baseline values for a destination."""
        key = self._key(server_ip, platform)
        bl = self._baselines.get(key)
        if not bl:
            return {
                "tcpMs": None, "tlsMs": None, "ttfbMs": None,
                "durationMs": None, "isValid": False,
            }
        return {
            "tcpMs": round(bl.tcp.value, 1) if bl.tcp.is_valid else None,
            "tlsMs": round(bl.tls.value, 1) if bl.tls.is_valid else None,
            "ttfbMs": round(bl.ttfb.value, 1) if bl.ttfb.is_valid else None,
            "durationMs": round(bl.duration.value, 1) if bl.duration.is_valid else None,
            "isValid": bl.tcp.is_valid or bl.tls.is_valid or bl.ttfb.is_valid or bl.duration.is_valid,
        }

    def check_anomalies(
        self,
        server_ip: str,
        platform: str,
        tcp_ms: Optional[float] = None,
        tls_ms: Optional[float] = None,
        ttfb_ms: Optional[float] = None,
        duration_ms: Optional[float] = None,
    ) -> Dict[str, bool]:
        """Check if current values are anomalous vs baseline."""
        key = self._key(server_ip, platform)
        bl = self._baselines.get(key)
        if not bl:
            return {"tcpSlow": False, "tlsSlow": False, "ttfbSlow": False, "durationSlow": False}
        return {
            "tcpSlow": bl.tcp.is_anomalous(tcp_ms) if tcp_ms else False,
            "tlsSlow": bl.tls.is_anomalous(tls_ms) if tls_ms else False,
            "ttfbSlow": bl.ttfb.is_anomalous(ttfb_ms) if ttfb_ms else False,
            "durationSlow": bl.duration.is_anomalous(duration_ms) if duration_ms else False,
        }

    async def seed_from_db(self) -> None:
        """Seed baselines from the last 500 spans with network timing."""
        if self._seeded:
            return
        self._seeded = True

        try:
            from sqlalchemy import select, and_, desc
            from src.config.database import get_db
            from src.models.ai_trace import AIQueryTrace

            db = get_db()
            async with db.session() as session:
                result = await session.execute(
                    select(AIQueryTrace)
                    .where(
                        and_(
                            AIQueryTrace.server_ip.isnot(None),
                            AIQueryTrace.tcp_connect_ms.isnot(None),
                        )
                    )
                    .order_by(desc(AIQueryTrace.start_time))
                    .limit(500)
                )
                spans = result.scalars().all()

                count = 0
                for span in spans:
                    platform = span.tool_platform or span.provider or "unknown"
                    self.update(
                        server_ip=span.server_ip,
                        platform=platform,
                        tcp_ms=span.tcp_connect_ms,
                        tls_ms=span.tls_ms,
                        ttfb_ms=span.ttfb_ms,
                        duration_ms=span.duration_ms,
                    )
                    count += 1

                logger.info(f"[Baselines] Seeded from {count} spans, {len(self._baselines)} destinations")
        except Exception as e:
            logger.debug(f"[Baselines] Seed failed (OK if no traces yet): {e}")


_baseline_service: Optional[TraceBaselineService] = None


def get_baseline_service() -> TraceBaselineService:
    """Get the singleton TraceBaselineService instance."""
    global _baseline_service
    if _baseline_service is None:
        _baseline_service = TraceBaselineService()
    return _baseline_service
