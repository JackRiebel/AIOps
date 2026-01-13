"""WebSocket Hub for real-time card updates.

Manages WebSocket connections and topic-based subscriptions for live data push
from webhooks and polling sources.
"""

import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass, field
from fastapi import WebSocket, WebSocketDisconnect
import uuid

logger = logging.getLogger(__name__)


@dataclass
class PresenceUser:
    """Represents a user in a presence room."""
    user_id: str
    client_id: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    color: Optional[str] = None
    joined_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class WebSocketClient:
    """Represents a connected WebSocket client."""
    client_id: str
    websocket: WebSocket
    user_id: Optional[str] = None
    username: Optional[str] = None
    subscriptions: Set[str] = field(default_factory=set)
    presence_rooms: Set[str] = field(default_factory=set)  # Canvas IDs for presence
    connected_at: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)


@dataclass
class LiveEvent:
    """Normalized event for broadcasting to subscribers."""
    source: str  # "meraki", "thousandeyes", "splunk", "catalyst"
    event_type: str  # "device_status", "alert", "metric", "health"
    topic: str  # WebSocket topic to broadcast to
    data: Dict[str, Any]
    timestamp: datetime
    org_id: Optional[str] = None
    severity: Optional[str] = None


class WebSocketHub:
    """Central hub for managing WebSocket connections and subscriptions."""

    def __init__(self):
        # client_id -> WebSocketClient
        self._clients: Dict[str, WebSocketClient] = {}
        # topic -> set of client_ids
        self._subscriptions: Dict[str, Set[str]] = {}
        # Presence rooms: room_id -> Dict[user_id, PresenceUser]
        self._presence_rooms: Dict[str, Dict[str, PresenceUser]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
        # Background heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the hub's background tasks."""
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            logger.info("WebSocket Hub started")

    async def stop(self):
        """Stop the hub and disconnect all clients."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None

        # Disconnect all clients
        async with self._lock:
            for client in list(self._clients.values()):
                try:
                    await client.websocket.close()
                except Exception:
                    pass
            self._clients.clear()
            self._subscriptions.clear()
        logger.info("WebSocket Hub stopped")

    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None) -> str:
        """Connect a new WebSocket client.

        Returns:
            client_id: Unique identifier for this connection
        """
        client_id = str(uuid.uuid4())

        await websocket.accept()

        async with self._lock:
            self._clients[client_id] = WebSocketClient(
                client_id=client_id,
                websocket=websocket,
                user_id=user_id
            )

        logger.info(f"WebSocket client connected: {client_id} (user: {user_id})")

        # Send welcome message with client_id
        await self._send_to_client(client_id, {
            "type": "connected",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return client_id

    async def disconnect(self, client_id: str):
        """Disconnect a WebSocket client and clean up subscriptions."""
        # Clean up presence rooms first (before removing client)
        await self._cleanup_presence_for_client(client_id)

        async with self._lock:
            client = self._clients.pop(client_id, None)
            if client:
                # Remove from all topic subscriptions
                for topic in client.subscriptions:
                    if topic in self._subscriptions:
                        self._subscriptions[topic].discard(client_id)
                        if not self._subscriptions[topic]:
                            del self._subscriptions[topic]

                try:
                    await client.websocket.close()
                except Exception:
                    pass

        logger.info(f"WebSocket client disconnected: {client_id}")

    async def subscribe(self, client_id: str, topic: str) -> bool:
        """Subscribe a client to a topic.

        Topics follow the format: source:type:identifier
        Examples:
            - meraki:devices:248496
            - meraki:alerts:248496
            - thousandeyes:alerts
            - splunk:events
            - health:248496
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False

            client.subscriptions.add(topic)

            if topic not in self._subscriptions:
                self._subscriptions[topic] = set()
            self._subscriptions[topic].add(client_id)

        logger.debug(f"Client {client_id} subscribed to {topic}")

        # Notify the live card poller about new subscription
        await self._notify_poller_subscribe(topic)

        # Acknowledge subscription
        await self._send_to_client(client_id, {
            "type": "subscribed",
            "topic": topic,
            "timestamp": datetime.utcnow().isoformat()
        })

        return True

    async def _notify_poller_subscribe(self, topic: str):
        """Notify the live card poller about a new topic subscription."""
        try:
            from src.services.live_card_poller import get_live_card_poller
            poller = get_live_card_poller()
            await poller.add_subscription(topic)
            logger.debug(f"Notified poller of subscription: {topic}")
        except Exception as e:
            logger.debug(f"Could not notify poller (may not be running): {e}")

    async def unsubscribe(self, client_id: str, topic: str) -> bool:
        """Unsubscribe a client from a topic."""
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False

            client.subscriptions.discard(topic)

            if topic in self._subscriptions:
                self._subscriptions[topic].discard(client_id)
                if not self._subscriptions[topic]:
                    del self._subscriptions[topic]

        logger.debug(f"Client {client_id} unsubscribed from {topic}")

        # Notify the live card poller about unsubscription
        await self._notify_poller_unsubscribe(topic)

        # Acknowledge unsubscription
        await self._send_to_client(client_id, {
            "type": "unsubscribed",
            "topic": topic,
            "timestamp": datetime.utcnow().isoformat()
        })

        return True

    async def _notify_poller_unsubscribe(self, topic: str):
        """Notify the live card poller about an unsubscription."""
        try:
            from src.services.live_card_poller import get_live_card_poller
            poller = get_live_card_poller()
            await poller.remove_subscription(topic)
            logger.debug(f"Notified poller of unsubscription: {topic}")
        except Exception as e:
            logger.debug(f"Could not notify poller (may not be running): {e}")

    async def broadcast(self, topic: str, data: Dict[str, Any]):
        """Broadcast data to all subscribers of a topic."""
        async with self._lock:
            subscriber_ids = self._subscriptions.get(topic, set()).copy()

        if not subscriber_ids:
            logger.debug(f"No subscribers for topic: {topic}")
            return

        message = {
            "type": "update",
            "topic": topic,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Send to all subscribers concurrently
        tasks = [
            self._send_to_client(client_id, message)
            for client_id in subscriber_ids
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful sends
        success_count = sum(1 for r in results if r is True)
        logger.debug(f"Broadcast to {topic}: {success_count}/{len(subscriber_ids)} clients")

    async def broadcast_event(self, event: LiveEvent):
        """Broadcast a normalized event to relevant subscribers."""
        await self.broadcast(event.topic, {
            "source": event.source,
            "event_type": event.event_type,
            "data": event.data,
            "org_id": event.org_id,
            "severity": event.severity,
            "timestamp": event.timestamp.isoformat()
        })

        # Also broadcast to wildcard topics if applicable
        # e.g., "meraki:*:248496" would receive all meraki events for org 248496
        parts = event.topic.split(":")
        if len(parts) >= 2:
            wildcard_topic = f"{parts[0]}:*"
            if event.org_id:
                wildcard_topic += f":{event.org_id}"
            await self.broadcast(wildcard_topic, {
                "source": event.source,
                "event_type": event.event_type,
                "data": event.data,
                "org_id": event.org_id,
                "severity": event.severity,
                "timestamp": event.timestamp.isoformat()
            })

    async def send_to_user(self, user_id: str, data: Dict[str, Any]):
        """Send data to all connections belonging to a specific user."""
        async with self._lock:
            user_clients = [
                c.client_id for c in self._clients.values()
                if c.user_id == user_id
            ]

        for client_id in user_clients:
            await self._send_to_client(client_id, data)

    async def _send_to_client(self, client_id: str, data: Dict[str, Any]) -> bool:
        """Send data to a specific client. Returns True if successful."""
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return False
            websocket = client.websocket

        try:
            await websocket.send_json(data)
            return True
        except Exception as e:
            logger.warning(f"Failed to send to client {client_id}: {e}")
            # Schedule disconnection
            asyncio.create_task(self.disconnect(client_id))
            return False

    async def handle_client_message(self, client_id: str, message: Dict[str, Any]):
        """Handle incoming message from a client."""
        msg_type = message.get("type")

        if msg_type == "subscribe":
            topic = message.get("topic")
            if topic:
                await self.subscribe(client_id, topic)

        elif msg_type == "unsubscribe":
            topic = message.get("topic")
            if topic:
                await self.unsubscribe(client_id, topic)

        elif msg_type == "ping":
            async with self._lock:
                client = self._clients.get(client_id)
                if client:
                    client.last_heartbeat = datetime.utcnow()
            await self._send_to_client(client_id, {
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            })

        elif msg_type == "presence_join":
            room_id = message.get("room_id")
            user_info = message.get("user", {})
            if room_id:
                await self.join_presence_room(client_id, room_id, user_info)

        elif msg_type == "presence_leave":
            room_id = message.get("room_id")
            if room_id:
                await self.leave_presence_room(client_id, room_id)

        elif msg_type == "presence_cursor":
            room_id = message.get("room_id")
            cursor = message.get("cursor", {})
            if room_id and cursor:
                await self.broadcast_cursor(client_id, room_id, cursor)

        else:
            logger.warning(f"Unknown message type from {client_id}: {msg_type}")

    # =========================================================================
    # Presence Room Methods (Canvas Collaboration - Phase 2)
    # =========================================================================

    async def join_presence_room(self, client_id: str, room_id: str, user_info: Dict[str, Any]):
        """Join a presence room (e.g., for canvas collaboration).

        Args:
            client_id: WebSocket client ID
            room_id: Presence room ID (e.g., "canvas:123")
            user_info: User information (user_id, username, avatar_url, color)
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return

            user_id = user_info.get("user_id") or client.user_id
            if not user_id:
                return

            # Create presence user
            presence_user = PresenceUser(
                user_id=user_id,
                client_id=client_id,
                username=user_info.get("username") or client.username,
                avatar_url=user_info.get("avatar_url"),
                color=user_info.get("color"),
            )

            # Add to room
            if room_id not in self._presence_rooms:
                self._presence_rooms[room_id] = {}

            self._presence_rooms[room_id][user_id] = presence_user
            client.presence_rooms.add(room_id)

        logger.debug(f"User {user_id} joined presence room {room_id}")

        # Get current room members
        room_members = await self.get_presence_room_members(room_id)

        # Send current members to the joining client
        await self._send_to_client(client_id, {
            "type": "presence_state",
            "room_id": room_id,
            "members": room_members,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Broadcast join to other members
        await self._broadcast_to_presence_room(room_id, {
            "type": "presence_join",
            "room_id": room_id,
            "user": {
                "user_id": presence_user.user_id,
                "username": presence_user.username,
                "avatar_url": presence_user.avatar_url,
                "color": presence_user.color,
            },
            "timestamp": datetime.utcnow().isoformat()
        }, exclude_client=client_id)

    async def leave_presence_room(self, client_id: str, room_id: str):
        """Leave a presence room.

        Args:
            client_id: WebSocket client ID
            room_id: Presence room ID
        """
        user_id = None

        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return

            if room_id in self._presence_rooms:
                # Find and remove the user
                for uid, presence_user in list(self._presence_rooms[room_id].items()):
                    if presence_user.client_id == client_id:
                        user_id = uid
                        del self._presence_rooms[room_id][uid]
                        break

                # Clean up empty rooms
                if not self._presence_rooms[room_id]:
                    del self._presence_rooms[room_id]

            client.presence_rooms.discard(room_id)

        if user_id:
            logger.debug(f"User {user_id} left presence room {room_id}")

            # Broadcast leave to other members
            await self._broadcast_to_presence_room(room_id, {
                "type": "presence_leave",
                "room_id": room_id,
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })

    async def get_presence_room_members(self, room_id: str) -> list:
        """Get all members in a presence room."""
        async with self._lock:
            if room_id not in self._presence_rooms:
                return []

            return [
                {
                    "user_id": user.user_id,
                    "username": user.username,
                    "avatar_url": user.avatar_url,
                    "color": user.color,
                    "joined_at": user.joined_at.isoformat(),
                }
                for user in self._presence_rooms[room_id].values()
            ]

    async def broadcast_cursor(self, client_id: str, room_id: str, cursor: Dict[str, Any]):
        """Broadcast cursor position to other members in the room.

        Args:
            client_id: Source client ID
            room_id: Presence room ID
            cursor: Cursor position data (x, y)
        """
        async with self._lock:
            client = self._clients.get(client_id)
            if not client or not client.user_id:
                return

            user_id = client.user_id

        await self._broadcast_to_presence_room(room_id, {
            "type": "presence_cursor",
            "room_id": room_id,
            "user_id": user_id,
            "cursor": cursor,
            "timestamp": datetime.utcnow().isoformat()
        }, exclude_client=client_id)

    async def _broadcast_to_presence_room(
        self,
        room_id: str,
        data: Dict[str, Any],
        exclude_client: Optional[str] = None
    ):
        """Broadcast a message to all members in a presence room.

        Args:
            room_id: Presence room ID
            data: Message data to broadcast
            exclude_client: Optional client ID to exclude from broadcast
        """
        async with self._lock:
            if room_id not in self._presence_rooms:
                return

            client_ids = [
                user.client_id
                for user in self._presence_rooms[room_id].values()
                if user.client_id != exclude_client
            ]

        # Send to all clients in the room
        for cid in client_ids:
            await self._send_to_client(cid, data)

    async def _cleanup_presence_for_client(self, client_id: str):
        """Clean up all presence rooms for a disconnecting client."""
        async with self._lock:
            client = self._clients.get(client_id)
            if not client:
                return

            rooms_to_notify = list(client.presence_rooms)
            user_id = client.user_id

            for room_id in rooms_to_notify:
                if room_id in self._presence_rooms:
                    # Remove from room
                    for uid in list(self._presence_rooms[room_id].keys()):
                        if self._presence_rooms[room_id][uid].client_id == client_id:
                            del self._presence_rooms[room_id][uid]
                            break

                    # Clean up empty rooms
                    if not self._presence_rooms[room_id]:
                        del self._presence_rooms[room_id]

        # Notify rooms about the leave (outside lock)
        if user_id:
            for room_id in rooms_to_notify:
                await self._broadcast_to_presence_room(room_id, {
                    "type": "presence_leave",
                    "room_id": room_id,
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat()
                })

    async def _heartbeat_loop(self):
        """Background task to check client health and send heartbeats."""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                now = datetime.utcnow()
                stale_clients = []

                async with self._lock:
                    for client_id, client in self._clients.items():
                        time_since_heartbeat = (now - client.last_heartbeat).total_seconds()
                        if time_since_heartbeat > 90:  # 90 second timeout
                            stale_clients.append(client_id)
                        else:
                            # Send heartbeat ping
                            try:
                                await client.websocket.send_json({
                                    "type": "heartbeat",
                                    "timestamp": now.isoformat()
                                })
                            except Exception:
                                stale_clients.append(client_id)

                # Disconnect stale clients
                for client_id in stale_clients:
                    logger.info(f"Disconnecting stale client: {client_id}")
                    await self.disconnect(client_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")

    @property
    def client_count(self) -> int:
        """Return the number of connected clients."""
        return len(self._clients)

    @property
    def subscription_stats(self) -> Dict[str, int]:
        """Return subscription counts per topic."""
        return {topic: len(clients) for topic, clients in self._subscriptions.items()}


# Global hub instance
_hub: Optional[WebSocketHub] = None


def get_websocket_hub() -> WebSocketHub:
    """Get or create the global WebSocket hub instance."""
    global _hub
    if _hub is None:
        _hub = WebSocketHub()
    return _hub


async def start_websocket_hub():
    """Start the global WebSocket hub."""
    hub = get_websocket_hub()
    await hub.start()


async def stop_websocket_hub():
    """Stop the global WebSocket hub."""
    global _hub
    if _hub:
        await _hub.stop()
        _hub = None
