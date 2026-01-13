"""Tests for A2A Push Notifications."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
import json

from src.a2a.push_notifications import (
    NotificationEventType,
    DeliveryStatus,
    PushNotificationConfig,
    NotificationPayload,
    DeliveryAttempt,
    NotificationDelivery,
    DeliveryConfig,
    SignatureGenerator,
    PushNotificationService,
    NotificationQueue,
    RateLimitedSender,
)


class TestNotificationEventType:
    """Tests for notification event types."""

    def test_all_event_types_exist(self):
        """Verify all expected event types are defined."""
        expected = [
            "task.created", "task.status_change", "task.completed",
            "task.failed", "task.canceled", "artifact.ready",
            "message.received", "agent.response", "error",
        ]
        actual = [e.value for e in NotificationEventType]
        for event in expected:
            assert event in actual


class TestDeliveryStatus:
    """Tests for delivery status enum."""

    def test_all_statuses_exist(self):
        """Verify all delivery statuses are defined."""
        expected = ["pending", "in_progress", "delivered", "failed", "dead_letter"]
        actual = [s.value for s in DeliveryStatus]
        for status in expected:
            assert status in actual


class TestPushNotificationConfig:
    """Tests for PushNotificationConfig dataclass."""

    def test_create_config(self, sample_webhook_config):
        """Test creating a notification config."""
        config = PushNotificationConfig(
            id="config-123",
            task_id="task-456",
            url=sample_webhook_config["url"],
            events=sample_webhook_config["events"],
            headers=sample_webhook_config["headers"],
            secret=sample_webhook_config["secret"],
        )
        assert config.id == "config-123"
        assert config.task_id == "task-456"
        assert len(config.events) == 2
        assert config.enabled is True

    def test_config_expiration(self):
        """Test config expiration checking."""
        # Not expired
        config = PushNotificationConfig(
            id="c1",
            task_id=None,
            url="https://test.com",
            events=["*"],
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        assert config.is_expired() is False

        # Expired
        config.expires_at = datetime.utcnow() - timedelta(hours=1)
        assert config.is_expired() is True

        # No expiration
        config.expires_at = None
        assert config.is_expired() is False

    def test_config_matches_event(self):
        """Test event matching logic."""
        config = PushNotificationConfig(
            id="c1",
            task_id=None,
            url="https://test.com",
            events=["task.completed", "task.failed"],
        )

        assert config.matches_event("task.completed") is True
        assert config.matches_event("task.failed") is True
        assert config.matches_event("task.created") is False

    def test_config_wildcard_events(self):
        """Test wildcard event matching."""
        config = PushNotificationConfig(
            id="c1",
            task_id=None,
            url="https://test.com",
            events=["*"],
        )

        assert config.matches_event("task.completed") is True
        assert config.matches_event("artifact.ready") is True
        assert config.matches_event("any.event") is True

    def test_config_disabled(self):
        """Test disabled config doesn't match."""
        config = PushNotificationConfig(
            id="c1",
            task_id=None,
            url="https://test.com",
            events=["*"],
            enabled=False,
        )
        assert config.matches_event("task.completed") is False

    def test_config_to_dict(self):
        """Test config serialization."""
        config = PushNotificationConfig(
            id="c1",
            task_id="t1",
            url="https://test.com/webhook",
            events=["task.completed"],
            headers={"Authorization": "Bearer token"},
            secret="my-secret",
        )
        data = config.to_dict()
        assert data["id"] == "c1"
        assert data["url"] == "https://test.com/webhook"
        assert data["hasSecret"] is True
        # Headers should be masked
        assert data["headers"]["Authorization"] == "***"

    def test_config_from_dict(self):
        """Test config deserialization."""
        data = {
            "id": "c2",
            "url": "https://example.com/hook",
            "events": ["task.failed"],
        }
        config = PushNotificationConfig.from_dict(data)
        assert config.id == "c2"
        assert config.url == "https://example.com/hook"


class TestNotificationPayload:
    """Tests for NotificationPayload dataclass."""

    def test_create_payload(self, sample_notification_payload):
        """Test creating a notification payload."""
        payload = NotificationPayload(
            id=sample_notification_payload["id"],
            event_type=sample_notification_payload["event_type"],
            task_id=sample_notification_payload["task_id"],
            timestamp=datetime.utcnow(),
            data=sample_notification_payload["data"],
        )
        assert payload.id == "notif-123"
        assert payload.event_type == "task.completed"

    def test_payload_to_json(self):
        """Test payload JSON serialization."""
        payload = NotificationPayload(
            id="p1",
            event_type="task.completed",
            task_id="t1",
            timestamp=datetime.utcnow(),
            data={"result": "success"},
        )
        json_str = payload.to_json()
        parsed = json.loads(json_str)
        assert parsed["id"] == "p1"
        assert parsed["event_type"] == "task.completed"
        assert parsed["data"]["result"] == "success"


class TestSignatureGenerator:
    """Tests for webhook signature generation and verification."""

    def test_sign_payload(self):
        """Test signing a payload."""
        payload = '{"event": "test"}'
        secret = "test-secret"

        headers = SignatureGenerator.sign(payload, secret)

        assert SignatureGenerator.SIGNATURE_HEADER in headers
        assert SignatureGenerator.TIMESTAMP_HEADER in headers
        assert headers[SignatureGenerator.SIGNATURE_HEADER].startswith("sha256=")

    def test_verify_valid_signature(self):
        """Test verifying a valid signature."""
        payload = '{"event": "test"}'
        secret = "test-secret"

        headers = SignatureGenerator.sign(payload, secret)
        signature = headers[SignatureGenerator.SIGNATURE_HEADER]
        timestamp = headers[SignatureGenerator.TIMESTAMP_HEADER]

        is_valid = SignatureGenerator.verify(
            payload=payload,
            secret=secret,
            signature=signature,
            timestamp=timestamp,
        )
        assert is_valid is True

    def test_verify_invalid_signature(self):
        """Test rejecting an invalid signature."""
        payload = '{"event": "test"}'
        secret = "test-secret"
        wrong_secret = "wrong-secret"

        headers = SignatureGenerator.sign(payload, secret)
        signature = headers[SignatureGenerator.SIGNATURE_HEADER]
        timestamp = headers[SignatureGenerator.TIMESTAMP_HEADER]

        # Verify with wrong secret
        is_valid = SignatureGenerator.verify(
            payload=payload,
            secret=wrong_secret,
            signature=signature,
            timestamp=timestamp,
        )
        assert is_valid is False

    def test_verify_expired_timestamp(self):
        """Test rejecting an expired timestamp."""
        payload = '{"event": "test"}'
        secret = "test-secret"

        old_timestamp = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        headers = SignatureGenerator.sign(payload, secret, old_timestamp)

        is_valid = SignatureGenerator.verify(
            payload=payload,
            secret=secret,
            signature=headers[SignatureGenerator.SIGNATURE_HEADER],
            timestamp=old_timestamp,
            tolerance_seconds=60,  # 1 minute tolerance
        )
        assert is_valid is False

    def test_verify_tampered_payload(self):
        """Test rejecting a tampered payload."""
        original_payload = '{"event": "test"}'
        tampered_payload = '{"event": "hacked"}'
        secret = "test-secret"

        headers = SignatureGenerator.sign(original_payload, secret)

        is_valid = SignatureGenerator.verify(
            payload=tampered_payload,
            secret=secret,
            signature=headers[SignatureGenerator.SIGNATURE_HEADER],
            timestamp=headers[SignatureGenerator.TIMESTAMP_HEADER],
        )
        assert is_valid is False


class TestNotificationQueue:
    """Tests for NotificationQueue."""

    @pytest.fixture
    def queue(self):
        """Create a notification queue."""
        return NotificationQueue(max_size=100)

    @pytest.mark.asyncio
    async def test_enqueue_dequeue(self, queue):
        """Test basic enqueue and dequeue."""
        payload = NotificationPayload(
            id="p1",
            event_type="task.completed",
            task_id="t1",
            timestamp=datetime.utcnow(),
            data={},
        )
        delivery = NotificationDelivery(
            id="d1",
            config_id="c1",
            payload=payload,
        )

        await queue.enqueue(delivery)
        retrieved = await queue.dequeue(timeout=1.0)

        assert retrieved is not None
        assert retrieved.id == "d1"

    @pytest.mark.asyncio
    async def test_dequeue_timeout(self, queue):
        """Test dequeue with empty queue times out."""
        result = await queue.dequeue(timeout=0.1)
        assert result is None

    @pytest.mark.asyncio
    async def test_queue_stats(self, queue):
        """Test queue statistics."""
        payload = NotificationPayload(
            id="p1",
            event_type="test",
            task_id=None,
            timestamp=datetime.utcnow(),
            data={},
        )

        for i in range(5):
            delivery = NotificationDelivery(
                id=f"d{i}",
                config_id="c1",
                payload=payload,
            )
            await queue.enqueue(delivery)

        stats = queue.get_stats()
        assert stats["pending_count"] == 5
        assert stats["queue_size"] == 5


class TestPushNotificationService:
    """Tests for PushNotificationService."""

    @pytest.fixture
    def service(self):
        """Create a push notification service."""
        config = DeliveryConfig(
            max_retries=3,
            base_delay_seconds=0.1,
            worker_count=1,
        )
        return PushNotificationService(config)

    @pytest.mark.asyncio
    async def test_create_config(self, service):
        """Test creating a notification config."""
        config = await service.create_config(
            url="https://test.com/webhook",
            events=["task.completed"],
            task_id="task-123",
        )

        assert config.id is not None
        assert config.url == "https://test.com/webhook"
        assert config.task_id == "task-123"

    @pytest.mark.asyncio
    async def test_get_config(self, service):
        """Test retrieving a config."""
        created = await service.create_config(
            url="https://test.com/webhook",
            events=["*"],
        )

        retrieved = await service.get_config(created.id)
        assert retrieved is not None
        assert retrieved.id == created.id

    @pytest.mark.asyncio
    async def test_list_configs(self, service):
        """Test listing configs."""
        await service.create_config(url="https://a.com", events=["*"])
        await service.create_config(url="https://b.com", events=["*"])
        await service.create_config(url="https://c.com", events=["*"], task_id="t1")

        # List all
        configs = await service.list_configs()
        assert len(configs) == 3

        # List by task
        configs = await service.list_configs(task_id="t1")
        assert len(configs) == 1

    @pytest.mark.asyncio
    async def test_update_config(self, service):
        """Test updating a config."""
        config = await service.create_config(
            url="https://test.com",
            events=["task.completed"],
        )

        updated = await service.update_config(
            config_id=config.id,
            enabled=False,
            events=["task.failed"],
        )

        assert updated.enabled is False
        assert updated.events == ["task.failed"]

    @pytest.mark.asyncio
    async def test_delete_config(self, service):
        """Test deleting a config."""
        config = await service.create_config(
            url="https://test.com",
            events=["*"],
        )

        success = await service.delete_config(config.id)
        assert success is True

        retrieved = await service.get_config(config.id)
        assert retrieved is None

    @pytest.mark.asyncio
    async def test_notify_queues_deliveries(self, service):
        """Test that notify queues deliveries for matching configs."""
        await service.create_config(
            url="https://test.com/webhook",
            events=["task.completed"],
        )

        await service.notify(
            event_type="task.completed",
            data={"result": "success"},
            task_id="task-123",
        )

        stats = service.get_stats()
        assert stats["metrics"]["notifications_sent"] == 1

    @pytest.mark.asyncio
    async def test_notify_filters_by_event(self, service):
        """Test that notify only sends to matching event configs."""
        await service.create_config(
            url="https://test.com/webhook",
            events=["task.failed"],  # Only failed events
        )

        await service.notify(
            event_type="task.completed",  # Completed event
            data={},
        )

        stats = service.get_stats()
        assert stats["metrics"]["notifications_sent"] == 0

    @pytest.mark.asyncio
    async def test_service_stats(self, service):
        """Test getting service statistics."""
        stats = service.get_stats()

        assert "running" in stats
        assert "worker_count" in stats
        assert "config_count" in stats
        assert "queue" in stats
        assert "metrics" in stats

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, service):
        """Test cleaning up expired configs."""
        # Create expired config
        config = await service.create_config(
            url="https://test.com",
            events=["*"],
            expires_in_hours=0,  # Immediately expired
        )
        # Manually set to past
        config.expires_at = datetime.utcnow() - timedelta(hours=1)

        cleaned = await service.cleanup_expired()
        assert cleaned >= 1

        # Config should be gone
        retrieved = await service.get_config(config.id)
        assert retrieved is None


class TestDeliveryAttempt:
    """Tests for DeliveryAttempt dataclass."""

    def test_create_attempt(self):
        """Test creating a delivery attempt record."""
        attempt = DeliveryAttempt(
            attempt_number=1,
            timestamp=datetime.utcnow(),
            status_code=200,
            response_body='{"ok": true}',
            duration_ms=150.5,
        )
        assert attempt.attempt_number == 1
        assert attempt.status_code == 200
        assert attempt.error is None

    def test_attempt_with_error(self):
        """Test attempt record with error."""
        attempt = DeliveryAttempt(
            attempt_number=2,
            timestamp=datetime.utcnow(),
            error="Connection refused",
            duration_ms=50.0,
        )
        assert attempt.status_code is None
        assert attempt.error == "Connection refused"

    def test_attempt_to_dict(self):
        """Test attempt serialization."""
        attempt = DeliveryAttempt(
            attempt_number=1,
            timestamp=datetime.utcnow(),
            status_code=500,
            response_body="Internal Server Error",
        )
        data = attempt.to_dict()
        assert data["attempt_number"] == 1
        assert data["status_code"] == 500


class TestNotificationDelivery:
    """Tests for NotificationDelivery dataclass."""

    def test_create_delivery(self):
        """Test creating a delivery record."""
        payload = NotificationPayload(
            id="p1",
            event_type="task.completed",
            task_id="t1",
            timestamp=datetime.utcnow(),
            data={},
        )
        delivery = NotificationDelivery(
            id="d1",
            config_id="c1",
            payload=payload,
        )
        assert delivery.status == DeliveryStatus.PENDING
        assert delivery.attempt_count == 0

    def test_delivery_attempt_count(self):
        """Test delivery attempt counting."""
        payload = NotificationPayload(
            id="p1",
            event_type="test",
            task_id=None,
            timestamp=datetime.utcnow(),
            data={},
        )
        delivery = NotificationDelivery(
            id="d1",
            config_id="c1",
            payload=payload,
        )

        delivery.attempts.append(
            DeliveryAttempt(attempt_number=1, timestamp=datetime.utcnow())
        )
        delivery.attempts.append(
            DeliveryAttempt(attempt_number=2, timestamp=datetime.utcnow())
        )

        assert delivery.attempt_count == 2
