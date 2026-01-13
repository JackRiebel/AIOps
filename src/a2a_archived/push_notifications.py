"""A2A Push Notifications Module.

Provides webhook-based push notifications for A2A task events:
- Task status changes
- Artifact availability
- Agent responses
- Error notifications

Features:
- Reliable delivery with retries
- HMAC signature verification
- Dead letter queue for failed deliveries
- Rate limiting per destination
- Configurable event filtering
"""

import logging
import asyncio
import hashlib
import hmac
import json
import uuid
from typing import Dict, Any, List, Optional, Set, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import aiohttp

logger = logging.getLogger(__name__)


class NotificationEventType(str, Enum):
    """Types of notification events."""
    TASK_CREATED = "task.created"
    TASK_STATUS_CHANGE = "task.status_change"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    TASK_CANCELED = "task.canceled"
    ARTIFACT_READY = "artifact.ready"
    MESSAGE_RECEIVED = "message.received"
    AGENT_RESPONSE = "agent.response"
    ERROR = "error"


class DeliveryStatus(str, Enum):
    """Status of a notification delivery."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


@dataclass
class PushNotificationConfig:
    """Configuration for push notification delivery."""
    id: str
    task_id: Optional[str]  # None means subscribe to all tasks
    url: str  # Webhook URL
    events: List[str]  # Event types to subscribe to
    headers: Dict[str, str] = field(default_factory=dict)  # Custom headers
    secret: Optional[str] = None  # HMAC signing secret
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if the config has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def matches_event(self, event_type: str) -> bool:
        """Check if this config should receive the event."""
        if not self.enabled or self.is_expired():
            return False
        # "*" matches all events
        if "*" in self.events:
            return True
        return event_type in self.events

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "url": self.url,
            "events": self.events,
            "headers": {k: "***" for k in self.headers},  # Mask headers
            "has_secret": self.secret is not None,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PushNotificationConfig":
        """Create from dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            task_id=data.get("task_id"),
            url=data["url"],
            events=data.get("events", ["*"]),
            headers=data.get("headers", {}),
            secret=data.get("secret"),
            enabled=data.get("enabled", True),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.utcnow(),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            metadata=data.get("metadata", {}),
        )


@dataclass
class NotificationPayload:
    """Payload for a push notification."""
    id: str
    event_type: str
    task_id: Optional[str]
    timestamp: datetime
    data: Dict[str, Any]
    source: str = "lumen-a2a"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "task_id": self.task_id,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "source": self.source,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


@dataclass
class DeliveryAttempt:
    """Record of a delivery attempt."""
    attempt_number: int
    timestamp: datetime
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "attempt_number": self.attempt_number,
            "timestamp": self.timestamp.isoformat(),
            "status_code": self.status_code,
            "response_body": self.response_body[:200] if self.response_body else None,
            "error": self.error,
            "duration_ms": self.duration_ms,
        }


@dataclass
class NotificationDelivery:
    """A notification delivery record."""
    id: str
    config_id: str
    payload: NotificationPayload
    status: DeliveryStatus = DeliveryStatus.PENDING
    attempts: List[DeliveryAttempt] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None

    @property
    def attempt_count(self) -> int:
        return len(self.attempts)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "config_id": self.config_id,
            "payload": self.payload.to_dict(),
            "status": self.status.value,
            "attempt_count": self.attempt_count,
            "attempts": [a.to_dict() for a in self.attempts[-5:]],  # Last 5 attempts
            "created_at": self.created_at.isoformat(),
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
        }


@dataclass
class DeliveryConfig:
    """Configuration for the delivery service."""
    max_retries: int = 5
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 300.0  # 5 minutes
    timeout_seconds: float = 30.0
    rate_limit_per_host: int = 10  # requests per second
    dead_letter_after_hours: int = 24
    batch_size: int = 100
    worker_count: int = 4


class SignatureGenerator:
    """Generates HMAC signatures for webhook payloads."""

    SIGNATURE_HEADER = "X-A2A-Signature"
    TIMESTAMP_HEADER = "X-A2A-Timestamp"
    ALGORITHM = "sha256"

    @classmethod
    def sign(cls, payload: str, secret: str, timestamp: Optional[str] = None) -> Dict[str, str]:
        """Generate signature headers for a payload.

        Args:
            payload: JSON payload string
            secret: HMAC secret
            timestamp: Optional timestamp (defaults to current time)

        Returns:
            Dict with signature headers
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat()

        # Create signature base: timestamp.payload
        signature_base = f"{timestamp}.{payload}"

        # Generate HMAC signature
        signature = hmac.new(
            secret.encode("utf-8"),
            signature_base.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return {
            cls.SIGNATURE_HEADER: f"{cls.ALGORITHM}={signature}",
            cls.TIMESTAMP_HEADER: timestamp,
        }

    @classmethod
    def verify(
        cls,
        payload: str,
        secret: str,
        signature: str,
        timestamp: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify a webhook signature.

        Args:
            payload: JSON payload string
            secret: HMAC secret
            signature: Received signature header value
            timestamp: Received timestamp header value
            tolerance_seconds: Max age of timestamp to accept

        Returns:
            True if signature is valid
        """
        # Check timestamp freshness
        try:
            ts = datetime.fromisoformat(timestamp)
            age = (datetime.utcnow() - ts).total_seconds()
            if abs(age) > tolerance_seconds:
                return False
        except ValueError:
            return False

        # Parse signature
        if not signature.startswith(f"{cls.ALGORITHM}="):
            return False
        received_sig = signature[len(f"{cls.ALGORITHM}="):]

        # Generate expected signature
        expected_headers = cls.sign(payload, secret, timestamp)
        expected_sig = expected_headers[cls.SIGNATURE_HEADER][len(f"{cls.ALGORITHM}="):]

        # Constant-time comparison
        return hmac.compare_digest(received_sig, expected_sig)


class RateLimitedSender:
    """Rate-limited HTTP sender for webhooks."""

    def __init__(self, rate_limit_per_host: int = 10):
        self._rate_limit = rate_limit_per_host
        self._host_tokens: Dict[str, float] = defaultdict(lambda: float(rate_limit_per_host))
        self._host_last_refill: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    def _get_host(self, url: str) -> str:
        """Extract host from URL."""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc

    async def _acquire_token(self, host: str) -> bool:
        """Acquire a rate limit token for a host."""
        import time

        async with self._lock:
            now = time.time()
            last_refill = self._host_last_refill.get(host, now)
            elapsed = now - last_refill

            # Refill tokens
            self._host_tokens[host] = min(
                self._rate_limit,
                self._host_tokens[host] + elapsed * self._rate_limit,
            )
            self._host_last_refill[host] = now

            if self._host_tokens[host] >= 1.0:
                self._host_tokens[host] -= 1.0
                return True
            return False

    async def send(
        self,
        url: str,
        payload: str,
        headers: Dict[str, str],
        timeout: float = 30.0,
    ) -> tuple:
        """Send a webhook request.

        Args:
            url: Webhook URL
            payload: JSON payload string
            headers: HTTP headers
            timeout: Request timeout in seconds

        Returns:
            Tuple of (status_code, response_body, error)
        """
        import time

        host = self._get_host(url)

        # Wait for rate limit token
        for _ in range(100):  # Max 10 seconds wait
            if await self._acquire_token(host):
                break
            await asyncio.sleep(0.1)
        else:
            return (None, None, "Rate limit exceeded")

        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        **headers,
                    },
                    timeout=aiohttp.ClientTimeout(total=timeout),
                ) as response:
                    body = await response.text()
                    duration_ms = (time.time() - start_time) * 1000
                    return (response.status, body, None)

        except asyncio.TimeoutError:
            return (None, None, "Request timed out")
        except aiohttp.ClientError as e:
            return (None, None, str(e))
        except Exception as e:
            return (None, None, f"Unexpected error: {e}")


class NotificationQueue:
    """In-memory queue for notification deliveries."""

    def __init__(self, max_size: int = 10000):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self._pending: Dict[str, NotificationDelivery] = {}
        self._dead_letter: List[NotificationDelivery] = []
        self._max_dead_letter = 1000
        self._lock = asyncio.Lock()

    async def enqueue(self, delivery: NotificationDelivery):
        """Add a delivery to the queue."""
        async with self._lock:
            self._pending[delivery.id] = delivery
        await self._queue.put(delivery.id)

    async def dequeue(self, timeout: float = 1.0) -> Optional[NotificationDelivery]:
        """Get next delivery from queue."""
        try:
            delivery_id = await asyncio.wait_for(self._queue.get(), timeout=timeout)
            async with self._lock:
                return self._pending.get(delivery_id)
        except asyncio.TimeoutError:
            return None

    async def complete(self, delivery_id: str, success: bool):
        """Mark a delivery as complete."""
        async with self._lock:
            delivery = self._pending.pop(delivery_id, None)
            if delivery and not success:
                # Move to dead letter if failed permanently
                self._dead_letter.append(delivery)
                if len(self._dead_letter) > self._max_dead_letter:
                    self._dead_letter = self._dead_letter[-self._max_dead_letter:]

    async def requeue(self, delivery: NotificationDelivery, delay_seconds: float):
        """Requeue a delivery for retry after delay."""
        delivery.next_retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
        await asyncio.sleep(delay_seconds)
        await self._queue.put(delivery.id)

    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        return {
            "pending_count": len(self._pending),
            "queue_size": self._queue.qsize(),
            "dead_letter_count": len(self._dead_letter),
        }

    def get_dead_letters(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get dead letter deliveries."""
        return [d.to_dict() for d in self._dead_letter[-limit:]]


class PushNotificationService:
    """Main service for managing push notifications.

    Handles:
    - Subscription management
    - Event dispatching
    - Reliable delivery with retries
    - Dead letter handling
    """

    def __init__(self, config: Optional[DeliveryConfig] = None):
        self.config = config or DeliveryConfig()
        self._configs: Dict[str, PushNotificationConfig] = {}
        self._task_configs: Dict[str, Set[str]] = defaultdict(set)  # task_id -> config_ids
        self._global_configs: Set[str] = set()  # configs that match all tasks
        self._queue = NotificationQueue()
        self._sender = RateLimitedSender(self.config.rate_limit_per_host)
        self._workers: List[asyncio.Task] = []
        self._running = False
        self._lock = asyncio.Lock()

        # Metrics
        self._metrics = {
            "notifications_sent": 0,
            "notifications_delivered": 0,
            "notifications_failed": 0,
            "notifications_retried": 0,
        }

    async def start(self):
        """Start the notification service."""
        if self._running:
            return

        self._running = True
        logger.info(f"[PushNotifications] Starting {self.config.worker_count} workers")

        for i in range(self.config.worker_count):
            worker = asyncio.create_task(self._worker_loop(i))
            self._workers.append(worker)

    async def stop(self):
        """Stop the notification service."""
        self._running = False
        logger.info("[PushNotifications] Stopping workers...")

        for worker in self._workers:
            worker.cancel()

        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("[PushNotifications] Stopped")

    # =========================================================================
    # Subscription Management
    # =========================================================================

    async def create_config(
        self,
        url: str,
        events: List[str],
        task_id: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        secret: Optional[str] = None,
        expires_in_hours: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> PushNotificationConfig:
        """Create a new push notification configuration.

        Args:
            url: Webhook URL
            events: Event types to subscribe to
            task_id: Optional specific task to subscribe to
            headers: Custom headers for requests
            secret: HMAC secret for signing
            expires_in_hours: Optional expiration time
            metadata: Additional metadata

        Returns:
            Created configuration
        """
        config = PushNotificationConfig(
            id=str(uuid.uuid4()),
            task_id=task_id,
            url=url,
            events=events,
            headers=headers or {},
            secret=secret,
            expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours) if expires_in_hours else None,
            metadata=metadata or {},
        )

        async with self._lock:
            self._configs[config.id] = config
            if task_id:
                self._task_configs[task_id].add(config.id)
            else:
                self._global_configs.add(config.id)

        logger.info(f"[PushNotifications] Created config {config.id} for {url}")
        return config

    async def get_config(self, config_id: str) -> Optional[PushNotificationConfig]:
        """Get a configuration by ID."""
        return self._configs.get(config_id)

    async def list_configs(
        self,
        task_id: Optional[str] = None,
        include_expired: bool = False,
    ) -> List[PushNotificationConfig]:
        """List configurations."""
        configs = []

        if task_id:
            config_ids = self._task_configs.get(task_id, set())
        else:
            config_ids = set(self._configs.keys())

        for config_id in config_ids:
            config = self._configs.get(config_id)
            if config and (include_expired or not config.is_expired()):
                configs.append(config)

        return configs

    async def update_config(
        self,
        config_id: str,
        enabled: Optional[bool] = None,
        events: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Optional[PushNotificationConfig]:
        """Update a configuration."""
        config = self._configs.get(config_id)
        if not config:
            return None

        if enabled is not None:
            config.enabled = enabled
        if events is not None:
            config.events = events
        if headers is not None:
            config.headers = headers

        return config

    async def delete_config(self, config_id: str) -> bool:
        """Delete a configuration."""
        async with self._lock:
            config = self._configs.pop(config_id, None)
            if not config:
                return False

            if config.task_id:
                self._task_configs[config.task_id].discard(config_id)
            else:
                self._global_configs.discard(config_id)

        logger.info(f"[PushNotifications] Deleted config {config_id}")
        return True

    # =========================================================================
    # Event Dispatching
    # =========================================================================

    async def notify(
        self,
        event_type: str,
        data: Dict[str, Any],
        task_id: Optional[str] = None,
    ):
        """Send a notification for an event.

        Args:
            event_type: Type of event
            data: Event data
            task_id: Optional task ID associated with event
        """
        payload = NotificationPayload(
            id=str(uuid.uuid4()),
            event_type=event_type,
            task_id=task_id,
            timestamp=datetime.utcnow(),
            data=data,
        )

        # Find matching configs
        matching_configs = []

        # Check task-specific configs
        if task_id:
            for config_id in self._task_configs.get(task_id, set()):
                config = self._configs.get(config_id)
                if config and config.matches_event(event_type):
                    matching_configs.append(config)

        # Check global configs
        for config_id in self._global_configs:
            config = self._configs.get(config_id)
            if config and config.matches_event(event_type):
                matching_configs.append(config)

        # Queue deliveries
        for config in matching_configs:
            delivery = NotificationDelivery(
                id=str(uuid.uuid4()),
                config_id=config.id,
                payload=payload,
            )
            await self._queue.enqueue(delivery)
            self._metrics["notifications_sent"] += 1

        if matching_configs:
            logger.debug(
                f"[PushNotifications] Queued {len(matching_configs)} deliveries "
                f"for event {event_type}"
            )

    async def notify_task_status_change(
        self,
        task_id: str,
        old_status: str,
        new_status: str,
        task_data: Optional[Dict[str, Any]] = None,
    ):
        """Convenience method for task status change notifications."""
        await self.notify(
            event_type=NotificationEventType.TASK_STATUS_CHANGE.value,
            data={
                "old_status": old_status,
                "new_status": new_status,
                "task": task_data or {},
            },
            task_id=task_id,
        )

        # Also send specific completion/failure events
        if new_status == "completed":
            await self.notify(
                event_type=NotificationEventType.TASK_COMPLETED.value,
                data={"task": task_data or {}},
                task_id=task_id,
            )
        elif new_status == "failed":
            await self.notify(
                event_type=NotificationEventType.TASK_FAILED.value,
                data={"task": task_data or {}},
                task_id=task_id,
            )
        elif new_status == "canceled":
            await self.notify(
                event_type=NotificationEventType.TASK_CANCELED.value,
                data={"task": task_data or {}},
                task_id=task_id,
            )

    # =========================================================================
    # Delivery Workers
    # =========================================================================

    async def _worker_loop(self, worker_id: int):
        """Worker loop for processing deliveries."""
        logger.debug(f"[PushNotifications] Worker {worker_id} started")

        while self._running:
            try:
                delivery = await self._queue.dequeue(timeout=1.0)
                if delivery:
                    await self._process_delivery(delivery)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[PushNotifications] Worker {worker_id} error: {e}")
                await asyncio.sleep(1.0)

        logger.debug(f"[PushNotifications] Worker {worker_id} stopped")

    async def _process_delivery(self, delivery: NotificationDelivery):
        """Process a single delivery."""
        config = self._configs.get(delivery.config_id)
        if not config or not config.enabled or config.is_expired():
            await self._queue.complete(delivery.id, success=True)
            return

        delivery.status = DeliveryStatus.IN_PROGRESS

        # Prepare payload and headers
        payload_json = delivery.payload.to_json()
        headers = dict(config.headers)

        # Add signature if secret configured
        if config.secret:
            sig_headers = SignatureGenerator.sign(payload_json, config.secret)
            headers.update(sig_headers)

        # Send request
        import time
        start_time = time.time()
        status_code, response_body, error = await self._sender.send(
            url=config.url,
            payload=payload_json,
            headers=headers,
            timeout=self.config.timeout_seconds,
        )
        duration_ms = (time.time() - start_time) * 1000

        # Record attempt
        attempt = DeliveryAttempt(
            attempt_number=delivery.attempt_count + 1,
            timestamp=datetime.utcnow(),
            status_code=status_code,
            response_body=response_body,
            error=error,
            duration_ms=duration_ms,
        )
        delivery.attempts.append(attempt)

        # Check success (2xx status code)
        success = status_code is not None and 200 <= status_code < 300

        if success:
            delivery.status = DeliveryStatus.DELIVERED
            delivery.delivered_at = datetime.utcnow()
            self._metrics["notifications_delivered"] += 1
            await self._queue.complete(delivery.id, success=True)
            logger.debug(
                f"[PushNotifications] Delivered {delivery.id} to {config.url} "
                f"({status_code}, {duration_ms:.0f}ms)"
            )

        elif delivery.attempt_count < self.config.max_retries:
            # Retry with exponential backoff
            delay = min(
                self.config.base_delay_seconds * (2 ** (delivery.attempt_count - 1)),
                self.config.max_delay_seconds,
            )
            self._metrics["notifications_retried"] += 1
            delivery.status = DeliveryStatus.PENDING
            logger.debug(
                f"[PushNotifications] Retrying {delivery.id} in {delay:.1f}s "
                f"(attempt {delivery.attempt_count}/{self.config.max_retries})"
            )
            asyncio.create_task(self._queue.requeue(delivery, delay))

        else:
            # Max retries exceeded - move to dead letter
            delivery.status = DeliveryStatus.DEAD_LETTER
            self._metrics["notifications_failed"] += 1
            await self._queue.complete(delivery.id, success=False)
            logger.warning(
                f"[PushNotifications] Failed {delivery.id} after "
                f"{delivery.attempt_count} attempts, moved to dead letter"
            )

    # =========================================================================
    # Statistics and Management
    # =========================================================================

    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            "running": self._running,
            "worker_count": len(self._workers),
            "config_count": len(self._configs),
            "global_config_count": len(self._global_configs),
            "task_subscriptions": len(self._task_configs),
            "queue": self._queue.get_stats(),
            "metrics": self._metrics.copy(),
        }

    def get_dead_letters(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get dead letter queue entries."""
        return self._queue.get_dead_letters(limit)

    async def retry_dead_letter(self, delivery_id: str) -> bool:
        """Retry a dead letter delivery."""
        # Find in dead letter queue and requeue
        for i, delivery in enumerate(self._queue._dead_letter):
            if delivery.id == delivery_id:
                delivery.status = DeliveryStatus.PENDING
                delivery.attempts.clear()
                await self._queue.enqueue(delivery)
                self._queue._dead_letter.pop(i)
                return True
        return False

    async def cleanup_expired(self):
        """Remove expired configurations."""
        async with self._lock:
            expired = [
                config_id
                for config_id, config in self._configs.items()
                if config.is_expired()
            ]

            for config_id in expired:
                config = self._configs.pop(config_id)
                if config.task_id:
                    self._task_configs[config.task_id].discard(config_id)
                else:
                    self._global_configs.discard(config_id)

        if expired:
            logger.info(f"[PushNotifications] Cleaned up {len(expired)} expired configs")

        return len(expired)


# Singleton instance
_push_notification_service: Optional[PushNotificationService] = None


def get_push_notification_service() -> PushNotificationService:
    """Get singleton push notification service."""
    global _push_notification_service
    if _push_notification_service is None:
        _push_notification_service = PushNotificationService()
    return _push_notification_service


async def init_push_notifications(config: Optional[DeliveryConfig] = None):
    """Initialize and start the push notification service."""
    global _push_notification_service
    _push_notification_service = PushNotificationService(config)
    await _push_notification_service.start()
    return _push_notification_service


async def shutdown_push_notifications():
    """Shutdown the push notification service."""
    global _push_notification_service
    if _push_notification_service:
        await _push_notification_service.stop()
        _push_notification_service = None


# Convenience functions
async def subscribe(
    url: str,
    events: Optional[List[str]] = None,
    task_id: Optional[str] = None,
    secret: Optional[str] = None,
) -> PushNotificationConfig:
    """Subscribe to push notifications.

    Args:
        url: Webhook URL
        events: Event types to subscribe to (default: all)
        task_id: Optional task ID to subscribe to
        secret: Optional HMAC secret for signing

    Returns:
        Subscription configuration
    """
    service = get_push_notification_service()
    return await service.create_config(
        url=url,
        events=events or ["*"],
        task_id=task_id,
        secret=secret,
    )


async def unsubscribe(config_id: str) -> bool:
    """Unsubscribe from push notifications."""
    service = get_push_notification_service()
    return await service.delete_config(config_id)


async def notify(
    event_type: str,
    data: Dict[str, Any],
    task_id: Optional[str] = None,
):
    """Send a notification."""
    service = get_push_notification_service()
    await service.notify(event_type, data, task_id)
