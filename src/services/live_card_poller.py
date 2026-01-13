"""Live Card Poller - Fallback polling for live data updates.

Polls Meraki, ThousandEyes, and Splunk APIs for data updates when webhooks
are not configured or as a fallback mechanism. Broadcasts updates via WebSocket hub.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Set, Optional, Any, List
from dataclasses import dataclass, field

from src.config.settings import get_settings
from src.services.websocket_hub import get_websocket_hub, LiveEvent

logger = logging.getLogger(__name__)


@dataclass
class PollSubscription:
    """Tracks what topics need polling."""
    topic: str
    source: str  # "meraki", "thousandeyes", "splunk"
    data_type: str  # "devices", "alerts", "health", etc.
    org_id: Optional[str] = None
    last_poll: Optional[datetime] = None
    subscriber_count: int = 0


class LiveCardPoller:
    """Polls external APIs for live card updates.

    This service runs in the background and polls data sources for cards
    that are marked as live. It's used as a fallback when webhooks are not
    configured or available.

    Priority: Meraki > ThousandEyes > Splunk (as requested)
    """

    def __init__(self):
        self._running = False
        self._poll_task: Optional[asyncio.Task] = None
        self._subscriptions: Dict[str, PollSubscription] = {}
        self._poll_interval: int = 8  # seconds (near real-time for live cards)
        self._lock = asyncio.Lock()

        # Cache to avoid redundant API calls
        self._cache: Dict[str, Any] = {}
        self._cache_ttl: Dict[str, datetime] = {}

    async def start(self):
        """Start the polling service."""
        if self._running:
            return

        settings = get_settings()
        self._poll_interval = settings.live_card_poll_interval

        self._running = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info(f"Live Card Poller started with {self._poll_interval}s interval")

    async def stop(self):
        """Stop the polling service."""
        self._running = False
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
            self._poll_task = None
        logger.info("Live Card Poller stopped")

    async def add_subscription(self, topic: str):
        """Add a topic to be polled.

        Topics are parsed to determine the data source and type:
        - meraki:devices:248496 -> poll Meraki device statuses for org 248496
        - meraki:alerts:248496 -> poll Meraki alerts for org 248496
        - thousandeyes:alerts -> poll ThousandEyes alerts
        - splunk:events -> poll Splunk for recent events
        - health:248496 -> poll health metrics from all sources
        """
        parts = topic.split(":")
        if len(parts) < 2:
            logger.warning(f"Invalid topic format: {topic}")
            return

        source = parts[0]
        data_type = parts[1]
        org_id = parts[2] if len(parts) > 2 else None

        async with self._lock:
            if topic in self._subscriptions:
                self._subscriptions[topic].subscriber_count += 1
            else:
                self._subscriptions[topic] = PollSubscription(
                    topic=topic,
                    source=source,
                    data_type=data_type,
                    org_id=org_id,
                    subscriber_count=1
                )
                logger.debug(f"Added poll subscription: {topic}")

    async def remove_subscription(self, topic: str):
        """Remove a topic subscription."""
        async with self._lock:
            if topic in self._subscriptions:
                self._subscriptions[topic].subscriber_count -= 1
                if self._subscriptions[topic].subscriber_count <= 0:
                    del self._subscriptions[topic]
                    logger.debug(f"Removed poll subscription: {topic}")

    async def _poll_loop(self):
        """Main polling loop."""
        while self._running:
            try:
                await self._poll_all_subscriptions()
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in poll loop: {e}")
                await asyncio.sleep(5)  # Brief pause on error

    async def _poll_all_subscriptions(self):
        """Poll all active subscriptions."""
        async with self._lock:
            subscriptions = list(self._subscriptions.values())

        if not subscriptions:
            return

        # Group by source and poll in priority order
        meraki_subs = [s for s in subscriptions if s.source == "meraki"]
        te_subs = [s for s in subscriptions if s.source == "thousandeyes"]
        splunk_subs = [s for s in subscriptions if s.source == "splunk"]
        health_subs = [s for s in subscriptions if s.source == "health"]

        # Poll in priority order: Meraki first
        if meraki_subs:
            await self._poll_meraki(meraki_subs)

        if te_subs:
            await self._poll_thousandeyes(te_subs)

        if splunk_subs:
            await self._poll_splunk(splunk_subs)

        if health_subs:
            await self._poll_health(health_subs)

    async def _poll_meraki(self, subscriptions: List[PollSubscription]):
        """Poll Meraki API for live data including VLANs, firewall rules, etc."""
        from src.services.meraki_api import get_meraki_client

        # Group by org_id/network_id to minimize API calls
        orgs_to_poll: Dict[str, Set[str]] = {}  # org_id -> set of data_types
        networks_to_poll: Dict[str, Dict[str, Set[str]]] = {}  # network_id -> {data_types, org_id}

        for sub in subscriptions:
            # Network-scoped data (VLANs, SSIDs, firewall rules, switch ports, RF, health, topology)
            if sub.data_type in ("vlans", "ssids", "firewall_rules", "switch_ports", "clients", "rf", "health", "topology"):
                network_id = sub.org_id  # For network-scoped, org_id contains network_id
                if network_id and network_id not in networks_to_poll:
                    networks_to_poll[network_id] = {"data_types": set(), "org_id": None}
                if network_id:
                    networks_to_poll[network_id]["data_types"].add(sub.data_type)
            else:
                # Org-scoped data (devices, alerts)
                org_id = sub.org_id or "default"
                if org_id not in orgs_to_poll:
                    orgs_to_poll[org_id] = set()
                orgs_to_poll[org_id].add(sub.data_type)

        for org_id, data_types in orgs_to_poll.items():
            try:
                client = await get_meraki_client(org_id if org_id != "default" else None)
                if not client:
                    continue

                # Poll device statuses
                if "devices" in data_types:
                    cache_key = f"meraki:devices:{org_id}"
                    if not self._is_cached(cache_key):
                        try:
                            response = await client.request("GET", f"/organizations/{org_id}/devices/statuses")
                            statuses = response.json()

                            # Calculate health metrics
                            total = len(statuses)
                            online = sum(1 for s in statuses if s.get("status") == "online")
                            alerting = sum(1 for s in statuses if s.get("status") == "alerting")
                            offline = sum(1 for s in statuses if s.get("status") == "offline")

                            data = {
                                "devices": statuses[:50],  # Limit to 50 devices
                                "summary": {
                                    "total": total,
                                    "online": online,
                                    "alerting": alerting,
                                    "offline": offline,
                                    "health_percent": round(online / total * 100) if total > 0 else 0
                                }
                            }

                            self._set_cache(cache_key, data, ttl_seconds=30)

                            # Broadcast update
                            await self._broadcast_update(
                                topic=f"meraki:devices:{org_id}",
                                source="meraki",
                                event_type="device_status",
                                data=data,
                                org_id=org_id
                            )
                        except Exception as e:
                            logger.warning(f"Failed to poll Meraki devices for {org_id}: {e}")

                # Poll alerts
                if "alerts" in data_types:
                    cache_key = f"meraki:alerts:{org_id}"
                    if not self._is_cached(cache_key):
                        try:
                            # Get recent alerts (last hour)
                            t0 = (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z"
                            response = await client.request(
                                "GET",
                                f"/organizations/{org_id}/alerts",
                                params={"startingAfter": t0}
                            )
                            alerts_data = response.json()
                            alerts = alerts_data if isinstance(alerts_data, list) else alerts_data.get("alerts", [])

                            data = {
                                "alerts": alerts[:20],  # Limit to 20 most recent
                                "count": len(alerts)
                            }

                            self._set_cache(cache_key, data, ttl_seconds=30)

                            await self._broadcast_update(
                                topic=f"meraki:alerts:{org_id}",
                                source="meraki",
                                event_type="alert",
                                data=data,
                                org_id=org_id
                            )
                        except Exception as e:
                            logger.warning(f"Failed to poll Meraki alerts for {org_id}: {e}")

            except Exception as e:
                logger.error(f"Error polling Meraki for org {org_id}: {e}")

        # Poll network-scoped data (VLANs, firewall rules, SSIDs, etc.)
        await self._poll_meraki_networks(networks_to_poll)

    async def _poll_meraki_networks(self, networks_to_poll: Dict[str, Dict[str, Set[str]]]):
        """Poll Meraki network-scoped data: VLANs, firewall rules, SSIDs, etc."""
        from src.services.meraki_api import get_meraki_client

        for network_id, info in networks_to_poll.items():
            data_types = info.get("data_types", set())

            try:
                client = await get_meraki_client()
                if not client:
                    continue

                # Poll RF Analysis (AP utilization, channels, interference)
                if "rf" in data_types:
                    cache_key = f"meraki:rf:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            # Get wireless device statuses for the network
                            response = await client.request(
                                "GET",
                                f"/networks/{network_id}/wireless/devices/connectionStats",
                                params={"timespan": 300}  # Last 5 minutes
                            )
                            connection_stats = response.json()

                            # Get channel utilization
                            util_response = await client.request(
                                "GET",
                                f"/networks/{network_id}/wireless/channelUtilizationHistory",
                                params={"timespan": 300}
                            )
                            utilization = util_response.json()

                            # Transform to RF analysis format
                            access_points = []
                            for ap in connection_stats[:20] if isinstance(connection_stats, list) else []:
                                access_points.append({
                                    "serial": ap.get("serial", ""),
                                    "name": ap.get("name", ap.get("serial", "")),
                                    "band": "5GHz",  # Default, would need device info for actual band
                                    "channel": ap.get("channel", 0),
                                    "channelWidth": ap.get("channelWidth", 20),
                                    "power": ap.get("power", 0),
                                    "utilization": ap.get("utilization", 0),
                                    "interference": ap.get("interference", 0),
                                    "noiseFloor": ap.get("noiseFloor", -90),
                                    "clients": ap.get("assoc", 0),
                                })

                            data = {
                                "accessPoints": access_points,
                                "networkId": network_id,
                                "utilization": utilization if isinstance(utilization, list) else [],
                            }
                            self._set_cache(cache_key, data, ttl_seconds=10)

                            await self._broadcast_update(
                                topic=f"meraki:rf:{network_id}",
                                source="meraki",
                                event_type="rf_analysis",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki RF for {network_id}: {e}")

                # Poll Network Health
                if "health" in data_types:
                    cache_key = f"meraki:health:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            # Get network health alerts
                            response = await client.request(
                                "GET",
                                f"/networks/{network_id}/health/alerts"
                            )
                            health_alerts = response.json()

                            # Calculate health score based on alerts
                            alert_count = len(health_alerts) if isinstance(health_alerts, list) else 0
                            score = max(0, 100 - (alert_count * 10))  # Deduct 10 per alert

                            data = {
                                "current": {
                                    "score": score,
                                    "timestamp": datetime.utcnow().isoformat(),
                                },
                                "alerts": health_alerts[:10] if isinstance(health_alerts, list) else [],
                                "networkId": network_id,
                            }
                            self._set_cache(cache_key, data, ttl_seconds=15)

                            await self._broadcast_update(
                                topic=f"meraki:health:{network_id}",
                                source="meraki",
                                event_type="health",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki health for {network_id}: {e}")

                # Poll Topology (device connectivity)
                if "topology" in data_types:
                    cache_key = f"meraki:topology:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            # Get network topology (LLDP/CDP neighbors)
                            response = await client.request(
                                "GET",
                                f"/networks/{network_id}/topology/linkLayer"
                            )
                            topology_data = response.json()

                            # Get device statuses for this network
                            status_response = await client.request(
                                "GET",
                                f"/networks/{network_id}/devices/statuses"
                            )
                            device_statuses = status_response.json()

                            # Build node list with connection status
                            nodes = []
                            for device in device_statuses if isinstance(device_statuses, list) else []:
                                nodes.append({
                                    "serial": device.get("serial", ""),
                                    "name": device.get("name", device.get("serial", "")),
                                    "model": device.get("model", ""),
                                    "status": device.get("status", "unknown"),
                                    "isDisconnected": device.get("status") != "online",
                                    "lastSeen": device.get("lastReportedAt", ""),
                                    "lanIp": device.get("lanIp", ""),
                                })

                            data = {
                                "nodes": nodes,
                                "links": topology_data.get("links", []) if isinstance(topology_data, dict) else [],
                                "networkId": network_id,
                            }
                            self._set_cache(cache_key, data, ttl_seconds=30)

                            await self._broadcast_update(
                                topic=f"meraki:topology:{network_id}",
                                source="meraki",
                                event_type="topology",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki topology for {network_id}: {e}")

                # Poll VLANs
                if "vlans" in data_types:
                    cache_key = f"meraki:vlans:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            response = await client.request("GET", f"/networks/{network_id}/appliance/vlans")
                            vlans = response.json()

                            data = {"vlans": vlans if isinstance(vlans, list) else []}
                            self._set_cache(cache_key, data, ttl_seconds=8)

                            await self._broadcast_update(
                                topic=f"meraki:vlans:{network_id}",
                                source="meraki",
                                event_type="vlans",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki VLANs for {network_id}: {e}")

                # Poll Firewall Rules
                if "firewall_rules" in data_types:
                    cache_key = f"meraki:firewall_rules:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            response = await client.request(
                                "GET",
                                f"/networks/{network_id}/appliance/firewall/l3FirewallRules"
                            )
                            rules_data = response.json()
                            rules = rules_data.get("rules", []) if isinstance(rules_data, dict) else rules_data

                            data = {"rules": rules if isinstance(rules, list) else []}
                            self._set_cache(cache_key, data, ttl_seconds=8)

                            await self._broadcast_update(
                                topic=f"meraki:firewall_rules:{network_id}",
                                source="meraki",
                                event_type="firewall_rules",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki firewall rules for {network_id}: {e}")

                # Poll SSIDs
                if "ssids" in data_types:
                    cache_key = f"meraki:ssids:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            response = await client.request("GET", f"/networks/{network_id}/wireless/ssids")
                            ssids = response.json()

                            data = {"ssids": ssids if isinstance(ssids, list) else []}
                            self._set_cache(cache_key, data, ttl_seconds=8)

                            await self._broadcast_update(
                                topic=f"meraki:ssids:{network_id}",
                                source="meraki",
                                event_type="ssids",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki SSIDs for {network_id}: {e}")

                # Poll Clients
                if "clients" in data_types:
                    cache_key = f"meraki:clients:{network_id}"
                    if not self._is_cached(cache_key):
                        try:
                            response = await client.request(
                                "GET",
                                f"/networks/{network_id}/clients",
                                params={"timespan": 3600}  # Last hour
                            )
                            clients = response.json()

                            data = {"clients": clients[:50] if isinstance(clients, list) else []}
                            self._set_cache(cache_key, data, ttl_seconds=8)

                            await self._broadcast_update(
                                topic=f"meraki:clients:{network_id}",
                                source="meraki",
                                event_type="clients",
                                data=data
                            )
                        except Exception as e:
                            logger.debug(f"Failed to poll Meraki clients for {network_id}: {e}")

            except Exception as e:
                logger.error(f"Error polling Meraki for network {network_id}: {e}")

    async def _poll_thousandeyes(self, subscriptions: List[PollSubscription]):
        """Poll ThousandEyes API for live data."""
        from src.services.thousandeyes_service import get_thousandeyes_service

        try:
            te_service = get_thousandeyes_service()
            if not te_service:
                return

            cache_key = "thousandeyes:alerts"
            if not self._is_cached(cache_key):
                try:
                    # Get active alerts
                    alerts = await te_service.get_active_alerts()

                    data = {
                        "alerts": alerts[:20] if alerts else [],
                        "count": len(alerts) if alerts else 0
                    }

                    self._set_cache(cache_key, data, ttl_seconds=30)

                    await self._broadcast_update(
                        topic="thousandeyes:alerts",
                        source="thousandeyes",
                        event_type="alert",
                        data=data
                    )
                except Exception as e:
                    logger.warning(f"Failed to poll ThousandEyes alerts: {e}")

        except Exception as e:
            logger.error(f"Error polling ThousandEyes: {e}")

    async def _poll_splunk(self, subscriptions: List[PollSubscription]):
        """Poll Splunk for recent events/alerts."""
        from src.services.splunk_insight_service import get_splunk_insight_service

        try:
            splunk_service = get_splunk_insight_service()
            if not splunk_service:
                return

            cache_key = "splunk:events"
            if not self._is_cached(cache_key):
                try:
                    # Get recent notable events
                    events = await splunk_service.get_recent_notables(limit=20)

                    data = {
                        "events": events if events else [],
                        "count": len(events) if events else 0
                    }

                    self._set_cache(cache_key, data, ttl_seconds=30)

                    await self._broadcast_update(
                        topic="splunk:events",
                        source="splunk",
                        event_type="event",
                        data=data
                    )
                except Exception as e:
                    logger.warning(f"Failed to poll Splunk events: {e}")

        except Exception as e:
            logger.error(f"Error polling Splunk: {e}")

    async def _poll_health(self, subscriptions: List[PollSubscription]):
        """Poll aggregate health metrics from all sources."""
        # Group by org_id
        orgs_to_poll = set(s.org_id for s in subscriptions if s.org_id)

        for org_id in orgs_to_poll:
            cache_key = f"health:{org_id}"
            if self._is_cached(cache_key):
                continue

            try:
                health_data = {
                    "org_id": org_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "meraki": {},
                    "thousandeyes": {},
                    "splunk": {}
                }

                # Get cached Meraki data if available
                meraki_cache = self._cache.get(f"meraki:devices:{org_id}")
                if meraki_cache:
                    health_data["meraki"] = meraki_cache.get("summary", {})

                # Get cached ThousandEyes data
                te_cache = self._cache.get("thousandeyes:alerts")
                if te_cache:
                    health_data["thousandeyes"] = {
                        "active_alerts": te_cache.get("count", 0)
                    }

                # Get cached Splunk data
                splunk_cache = self._cache.get("splunk:events")
                if splunk_cache:
                    health_data["splunk"] = {
                        "recent_events": splunk_cache.get("count", 0)
                    }

                self._set_cache(cache_key, health_data, ttl_seconds=30)

                await self._broadcast_update(
                    topic=f"health:{org_id}",
                    source="aggregate",
                    event_type="health",
                    data=health_data,
                    org_id=org_id
                )

            except Exception as e:
                logger.error(f"Error polling health for {org_id}: {e}")

    async def _broadcast_update(
        self,
        topic: str,
        source: str,
        event_type: str,
        data: Dict[str, Any],
        org_id: Optional[str] = None
    ):
        """Broadcast a poll result via WebSocket hub."""
        hub = get_websocket_hub()

        event = LiveEvent(
            source=source,
            event_type=event_type,
            topic=topic,
            data=data,
            timestamp=datetime.utcnow(),
            org_id=org_id
        )

        await hub.broadcast_event(event)

    def _is_cached(self, key: str) -> bool:
        """Check if a cache entry exists and is not expired."""
        if key not in self._cache:
            return False
        if key not in self._cache_ttl:
            return False
        return datetime.utcnow() < self._cache_ttl[key]

    def _set_cache(self, key: str, data: Any, ttl_seconds: int = 30):
        """Set a cache entry with TTL."""
        self._cache[key] = data
        self._cache_ttl[key] = datetime.utcnow() + timedelta(seconds=ttl_seconds)


# Global poller instance
_poller: Optional[LiveCardPoller] = None


def get_live_card_poller() -> LiveCardPoller:
    """Get or create the global live card poller instance."""
    global _poller
    if _poller is None:
        _poller = LiveCardPoller()
    return _poller


async def start_live_card_poller():
    """Start the global live card poller."""
    poller = get_live_card_poller()
    await poller.start()


async def stop_live_card_poller():
    """Stop the global live card poller."""
    global _poller
    if _poller:
        await _poller.stop()
        _poller = None
