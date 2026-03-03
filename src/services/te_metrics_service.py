"""ThousandEyes test metrics service — collects, stores, and analyzes 7-day test history."""

import logging
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

from sqlalchemy import text

from src.config.database import get_async_session

logger = logging.getLogger(__name__)

# Map test types to their result endpoints
_NETWORK_TYPES = {"agent-to-server", "agent-to-agent", "network"}
_HTTP_TYPES = {"http-server", "page-load", "web-transactions"}


class TEMetricsService:
    """Collects ThousandEyes test results and stores metrics locally for trend analysis."""

    # ------------------------------------------------------------------
    # Collection
    # ------------------------------------------------------------------

    async def collect_all_tests(self) -> Dict[str, Any]:
        """Fetch latest results for every TE test and bulk-insert new rows.

        Returns dict with inserted/skipped/errors counts.
        """
        from src.api.routes.thousandeyes import make_api_request

        stats = {"inserted": 0, "skipped": 0, "errors": 0, "tests_processed": 0}

        try:
            tests_resp = await make_api_request("GET", "tests")
            if "error" in tests_resp:
                logger.warning(f"TE metrics: failed to list tests: {tests_resp['error']}")
                stats["errors"] += 1
                return stats

            tests = tests_resp.get("tests", tests_resp.get("test", []))
            if not tests:
                return stats

            rows: List[Dict[str, Any]] = []

            for test in tests:
                test_id = test.get("testId") or test.get("id")
                test_name = test.get("testName") or test.get("name", "")
                test_type = test.get("type", "unknown")

                if not test_id:
                    continue

                stats["tests_processed"] += 1

                # Choose the right result endpoint based on test type
                result_rows = await self._fetch_test_results(
                    test_id, test_name, test_type
                )
                rows.extend(result_rows)

            # Bulk insert with ON CONFLICT DO NOTHING
            if rows:
                result = await self._bulk_insert(rows)
                stats["inserted"] = result["inserted"]
                stats["skipped"] = result["skipped"]

        except Exception as e:
            logger.error(f"TE metrics collection error: {e}", exc_info=True)
            stats["errors"] += 1

        return stats

    async def _fetch_test_results(
        self, test_id: int, test_name: str, test_type: str
    ) -> List[Dict[str, Any]]:
        """Fetch results for a single test and return metric row dicts."""
        from src.api.routes.thousandeyes import make_api_request

        rows: List[Dict[str, Any]] = []

        # Determine endpoint
        if test_type in _HTTP_TYPES:
            endpoint = f"test-results/{test_id}/http-server"
        else:
            endpoint = f"test-results/{test_id}/network"

        resp = await make_api_request("GET", endpoint, params={"window": "5m"})
        if "error" in resp:
            return rows

        results = resp.get("results", resp.get("net", resp.get("web", [])))
        if not results:
            return rows

        for r in results:
            agent = r.get("agent", {})
            row = {
                "test_id": test_id,
                "test_name": test_name,
                "test_type": test_type,
                "round_id": r.get("roundId", 0),
                "agent_id": agent.get("agentId") or r.get("agentId"),
                "agent_name": agent.get("agentName") or r.get("agentName"),
                "avg_latency_ms": r.get("avgLatency"),
                "loss_pct": r.get("loss"),
                "jitter_ms": r.get("jitter"),
                "response_time_ms": r.get("responseTime"),
                "connect_time_ms": r.get("connectTime"),
                "dns_time_ms": r.get("dnsTime"),
                "wait_time_ms": r.get("waitTime"),
                "error_type": r.get("errorType"),
            }
            rows.append(row)

        # Fetch path visualization for network tests (best-effort)
        if test_type in _NETWORK_TYPES:
            try:
                path_resp = await make_api_request(
                    "GET", f"test-results/{test_id}/path-vis", params={"window": "5m"}
                )
                if "error" not in path_resp:
                    path_results = path_resp.get("results", [])
                    # Build a lookup of (roundId, agentId) -> hops
                    for pr in path_results:
                        round_id = pr.get("roundId")
                        p_agent = pr.get("agent", {})
                        agent_id = p_agent.get("agentId") or pr.get("agentId")
                        hops = []
                        for path_entry in pr.get("pathTraces", []):
                            for hop in path_entry.get("hops", []):
                                hops.append({
                                    "hop": hop.get("hop"),
                                    "ip": hop.get("ipAddress"),
                                    "prefix": hop.get("prefix"),
                                    "rtt": hop.get("responseTime"),
                                    "loss": hop.get("loss"),
                                })
                        # Attach hops to matching row
                        if hops:
                            for row in rows:
                                if row["round_id"] == round_id and row["agent_id"] == agent_id:
                                    row["path_hops"] = hops
                                    break
            except Exception as e:
                logger.debug(f"Path vis fetch failed for test {test_id}: {e}")

        return rows

    async def _bulk_insert(self, rows: List[Dict[str, Any]]) -> Dict[str, int]:
        """Insert rows with ON CONFLICT DO NOTHING. Returns inserted/skipped counts."""
        inserted = 0
        async with get_async_session() as session:
            for row in rows:
                try:
                    result = await session.execute(
                        text("""
                            INSERT INTO te_test_metrics
                                (test_id, test_name, test_type, round_id, agent_id, agent_name,
                                 avg_latency_ms, loss_pct, jitter_ms, response_time_ms,
                                 connect_time_ms, dns_time_ms, wait_time_ms, error_type, path_hops)
                            VALUES
                                (:test_id, :test_name, :test_type, :round_id, :agent_id, :agent_name,
                                 :avg_latency_ms, :loss_pct, :jitter_ms, :response_time_ms,
                                 :connect_time_ms, :dns_time_ms, :wait_time_ms, :error_type,
                                 :path_hops::jsonb)
                            ON CONFLICT (test_id, round_id, agent_id) DO NOTHING
                        """),
                        {
                            **row,
                            "path_hops": _to_json(row.get("path_hops")),
                        },
                    )
                    if result.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    logger.debug(f"Insert failed for test_id={row.get('test_id')}: {e}")

        return {"inserted": inserted, "skipped": len(rows) - inserted}

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    async def cleanup_old_metrics(self, days: int = 7) -> int:
        """Delete metrics older than `days`. Returns count of deleted rows."""
        async with get_async_session() as session:
            result = await session.execute(
                text("DELETE FROM te_test_metrics WHERE timestamp < NOW() - :interval * INTERVAL '1 day'"),
                {"interval": days},
            )
            return result.rowcount

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    async def get_status(self) -> Dict[str, Any]:
        """Return collection status: total rows, last collection, oldest record."""
        async with get_async_session() as session:
            row = await session.execute(
                text("""
                    SELECT
                        COUNT(*) AS total_rows,
                        MAX(timestamp) AS last_collection,
                        MIN(timestamp) AS oldest_record,
                        COUNT(DISTINCT test_id) AS unique_tests
                    FROM te_test_metrics
                """)
            )
            r = row.mappings().first()
            return {
                "total_rows": r["total_rows"],
                "last_collection": r["last_collection"].isoformat() if r["last_collection"] else None,
                "oldest_record": r["oldest_record"].isoformat() if r["oldest_record"] else None,
                "unique_tests": r["unique_tests"],
            }

    async def get_test_history(
        self, test_id: int, hours: int = 24
    ) -> List[Dict[str, Any]]:
        """Return raw metrics for a test within time window."""
        async with get_async_session() as session:
            rows = await session.execute(
                text("""
                    SELECT test_id, test_name, test_type, round_id, agent_id, agent_name,
                           timestamp, avg_latency_ms, loss_pct, jitter_ms,
                           response_time_ms, connect_time_ms, dns_time_ms, wait_time_ms,
                           error_type, path_hops
                    FROM te_test_metrics
                    WHERE test_id = :test_id
                      AND timestamp > NOW() - :hours * INTERVAL '1 hour'
                    ORDER BY timestamp DESC
                """),
                {"test_id": test_id, "hours": hours},
            )
            return [dict(r) for r in rows.mappings().all()]

    async def get_aggregates(
        self, test_id: int, hours: int = 24, bucket: str = "1h"
    ) -> List[Dict[str, Any]]:
        """Return date_trunc-bucketed aggregates for a test."""
        bucket_map = {"15m": "15 minutes", "1h": "1 hour", "6h": "6 hours"}
        interval = bucket_map.get(bucket, "1 hour")

        async with get_async_session() as session:
            rows = await session.execute(
                text(f"""
                    SELECT
                        date_trunc('hour', timestamp) -
                            (EXTRACT(minute FROM timestamp)::int % (EXTRACT(epoch FROM INTERVAL '{interval}')::int / 60))
                            * INTERVAL '1 minute' AS bucket,
                        AVG(avg_latency_ms) AS avg_latency,
                        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_latency_ms) AS p95_latency,
                        MAX(avg_latency_ms) AS max_latency,
                        AVG(loss_pct) AS avg_loss,
                        AVG(jitter_ms) AS avg_jitter,
                        COUNT(*) AS sample_count
                    FROM te_test_metrics
                    WHERE test_id = :test_id
                      AND timestamp > NOW() - :hours * INTERVAL '1 hour'
                      AND avg_latency_ms IS NOT NULL
                    GROUP BY bucket
                    ORDER BY bucket DESC
                """),
                {"test_id": test_id, "hours": hours},
            )
            return [dict(r) for r in rows.mappings().all()]

    async def get_bottleneck_analysis(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Identify tests with consistently high latency or loss."""
        async with get_async_session() as session:
            rows = await session.execute(
                text("""
                    SELECT test_id, test_name,
                        AVG(avg_latency_ms) AS mean_latency,
                        STDDEV(avg_latency_ms) AS latency_stddev,
                        AVG(loss_pct) AS mean_loss,
                        COUNT(*) AS sample_count,
                        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_latency_ms) AS p95_latency
                    FROM te_test_metrics
                    WHERE timestamp > NOW() - :hours * INTERVAL '1 hour'
                      AND avg_latency_ms IS NOT NULL
                    GROUP BY test_id, test_name
                    HAVING AVG(loss_pct) > 1
                       OR PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_latency_ms) > 200
                    ORDER BY AVG(loss_pct) DESC,
                             PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_latency_ms) DESC
                """),
                {"hours": hours},
            )
            return [dict(r) for r in rows.mappings().all()]

    async def get_trend_summary(self) -> List[Dict[str, Any]]:
        """Per-test 1h avg vs 24h avg comparison — flag degradation."""
        async with get_async_session() as session:
            rows = await session.execute(
                text("""
                    WITH recent AS (
                        SELECT test_id, test_name,
                            AVG(avg_latency_ms) AS avg_1h
                        FROM te_test_metrics
                        WHERE timestamp > NOW() - INTERVAL '1 hour'
                          AND avg_latency_ms IS NOT NULL
                        GROUP BY test_id, test_name
                    ),
                    baseline AS (
                        SELECT test_id,
                            AVG(avg_latency_ms) AS avg_24h
                        FROM te_test_metrics
                        WHERE timestamp > NOW() - INTERVAL '24 hours'
                          AND avg_latency_ms IS NOT NULL
                        GROUP BY test_id
                    )
                    SELECT
                        r.test_id, r.test_name,
                        r.avg_1h, b.avg_24h,
                        CASE WHEN b.avg_24h > 0
                            THEN ROUND(((r.avg_1h - b.avg_24h) / b.avg_24h * 100)::numeric, 1)
                            ELSE 0
                        END AS delta_pct,
                        CASE
                            WHEN b.avg_24h > 0 AND r.avg_1h > b.avg_24h * 1.2 THEN 'degrading'
                            WHEN b.avg_24h > 0 AND r.avg_1h < b.avg_24h * 0.8 THEN 'improving'
                            ELSE 'stable'
                        END AS status
                    FROM recent r
                    JOIN baseline b ON r.test_id = b.test_id
                    ORDER BY delta_pct DESC
                """)
            )
            return [dict(r) for r in rows.mappings().all()]


def _to_json(val: Any) -> Optional[str]:
    """Convert a value to a JSON string for JSONB insertion, or None."""
    if val is None:
        return None
    import json
    return json.dumps(val)


@lru_cache
def get_te_metrics_service() -> TEMetricsService:
    return TEMetricsService()
