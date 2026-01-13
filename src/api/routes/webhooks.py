"""Webhook receiver endpoints for external services.

Receives webhooks from Meraki, ThousandEyes, and Splunk, normalizes events,
and broadcasts them via WebSocket hub to subscribed live cards.
"""

import logging
import hmac
import hashlib
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks

from src.config.settings import get_settings
from src.services.websocket_hub import get_websocket_hub
from src.services.event_normalizer import (
    normalize_meraki_event,
    normalize_thousandeyes_event,
    normalize_splunk_event
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])

settings = get_settings()


def verify_meraki_signature(body: bytes, signature: Optional[str], secret: str) -> bool:
    """Verify Meraki webhook signature.

    Meraki signs webhooks with HMAC-SHA256 using the shared secret.
    """
    if not signature or not secret:
        return False

    expected = hmac.new(
        secret.encode('utf-8'),
        body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


@router.post("/meraki")
async def meraki_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_cisco_meraki_signature: Optional[str] = Header(None, alias="X-Cisco-Meraki-Signature"),
):
    """Receive Meraki webhook events.

    Meraki Dashboard sends webhooks for:
    - Device status changes (online/offline/alerting)
    - Alert triggers (e.g., gateway down, rogue AP detected)
    - Configuration changes
    - Network events

    The webhook payload structure:
    {
        "version": "0.1",
        "sharedSecret": "...",
        "sentAt": "2024-01-15T10:30:00.000000Z",
        "organizationId": "248496",
        "organizationName": "My Org",
        "organizationUrl": "https://dashboard.meraki.com/...",
        "networkId": "L_12345",
        "networkName": "Main Office",
        "networkUrl": "https://dashboard.meraki.com/...",
        "deviceSerial": "Q2XX-XXXX-XXXX",
        "deviceMac": "00:11:22:33:44:55",
        "deviceName": "Main Switch",
        "deviceUrl": "https://dashboard.meraki.com/...",
        "alertId": "12345",
        "alertType": "Gateway goes down",
        "alertTypeId": "gateway_down",
        "alertLevel": "critical",
        "occurredAt": "2024-01-15T10:30:00.000000Z",
        "alertData": {...}
    }
    """
    body = await request.body()

    # Get webhook secret from settings
    webhook_secret = getattr(settings, 'meraki_webhook_secret', '')

    # Verify signature if secret is configured
    if webhook_secret:
        if not verify_meraki_signature(body, x_cisco_meraki_signature, webhook_secret):
            logger.warning("Meraki webhook signature verification failed")
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Parse the payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Meraki webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Received Meraki webhook: {payload.get('alertType', 'unknown')} for org {payload.get('organizationId')}")

    # Normalize and broadcast in background
    async def process_webhook():
        try:
            event = normalize_meraki_event(payload)
            hub = get_websocket_hub()
            await hub.broadcast_event(event)
            logger.debug(f"Broadcast Meraki event to topic: {event.topic}")
        except Exception as e:
            logger.error(f"Error processing Meraki webhook: {e}")

    background_tasks.add_task(process_webhook)

    return {"status": "received", "timestamp": datetime.utcnow().isoformat()}


@router.post("/meraki/test")
async def meraki_webhook_test(request: Request):
    """Test endpoint for Meraki webhook configuration.

    Meraki sends a test payload when configuring webhooks. This endpoint
    accepts the test without signature verification for initial setup.
    """
    try:
        payload = await request.json()
        logger.info(f"Received Meraki webhook test: {payload}")
        return {"status": "test_received", "message": "Webhook endpoint is working"}
    except Exception:
        return {"status": "test_received", "message": "Webhook endpoint is working"}


@router.post("/thousandeyes")
async def thousandeyes_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    """Receive ThousandEyes webhook events.

    ThousandEyes sends webhooks for alert state changes:
    - Alert triggered
    - Alert cleared

    The webhook payload structure:
    {
        "eventId": "12345",
        "eventType": "ALERT_NOTIFICATION_TRIGGER",
        "dateStart": "2024-01-15T10:30:00Z",
        "dateEnd": null,
        "severity": "MAJOR",
        "summary": "HTTP Server test failed",
        "agents": [...],
        "alert": {
            "alertId": 12345,
            "testId": 67890,
            "testName": "Production API Health",
            "type": "http-server",
            "ruleName": "API Down Alert"
        },
        "links": {
            "appLink": "https://app.thousandeyes.com/..."
        }
    }
    """
    # Get webhook token from settings
    webhook_token = getattr(settings, 'thousandeyes_webhook_secret', '')

    # Verify authorization token if configured
    if webhook_token:
        if not authorization or authorization != f"Bearer {webhook_token}":
            logger.warning("ThousandEyes webhook authorization failed")
            raise HTTPException(status_code=401, detail="Invalid authorization")

    # Parse the payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse ThousandEyes webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Received ThousandEyes webhook: {payload.get('eventType', 'unknown')}")

    # Normalize and broadcast in background
    async def process_webhook():
        try:
            event = normalize_thousandeyes_event(payload)
            hub = get_websocket_hub()
            await hub.broadcast_event(event)
            logger.debug(f"Broadcast ThousandEyes event to topic: {event.topic}")
        except Exception as e:
            logger.error(f"Error processing ThousandEyes webhook: {e}")

    background_tasks.add_task(process_webhook)

    return {"status": "received", "timestamp": datetime.utcnow().isoformat()}


@router.post("/splunk")
async def splunk_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    """Receive Splunk alert action webhooks.

    Splunk sends webhooks when alerts fire via custom alert actions.

    The webhook payload structure (customizable in Splunk):
    {
        "sid": "12345.67890",
        "search_name": "Security - Failed SSH Logins",
        "app": "search",
        "owner": "admin",
        "results_link": "https://splunk.example.com/...",
        "result": {
            "_time": "2024-01-15T10:30:00.000+00:00",
            "host": "web-server-01",
            "source": "/var/log/auth.log",
            "sourcetype": "linux_secure",
            "count": "15",
            "user": "root",
            "src_ip": "192.168.1.100"
        }
    }
    """
    # Get webhook token from settings
    webhook_token = getattr(settings, 'splunk_webhook_token', '')

    # Verify authorization token if configured
    if webhook_token:
        if not authorization or authorization != f"Bearer {webhook_token}":
            logger.warning("Splunk webhook authorization failed")
            raise HTTPException(status_code=401, detail="Invalid authorization")

    # Parse the payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Splunk webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info(f"Received Splunk webhook: {payload.get('search_name', 'unknown')}")

    # Normalize and broadcast in background
    async def process_webhook():
        try:
            event = normalize_splunk_event(payload)
            hub = get_websocket_hub()
            await hub.broadcast_event(event)
            logger.debug(f"Broadcast Splunk event to topic: {event.topic}")
        except Exception as e:
            logger.error(f"Error processing Splunk webhook: {e}")

    background_tasks.add_task(process_webhook)

    return {"status": "received", "timestamp": datetime.utcnow().isoformat()}


@router.get("/status")
async def webhook_status():
    """Get webhook endpoint status and configuration info.

    Returns information about configured webhooks for admin UI.
    """
    return {
        "endpoints": {
            "meraki": {
                "url": "/api/webhooks/meraki",
                "configured": bool(getattr(settings, 'meraki_webhook_secret', '')),
                "description": "Meraki Dashboard alerts and device status"
            },
            "thousandeyes": {
                "url": "/api/webhooks/thousandeyes",
                "configured": bool(getattr(settings, 'thousandeyes_webhook_secret', '')),
                "description": "ThousandEyes alert notifications"
            },
            "splunk": {
                "url": "/api/webhooks/splunk",
                "configured": bool(getattr(settings, 'splunk_webhook_token', '')),
                "description": "Splunk alert actions"
            }
        },
        "status": "active"
    }
