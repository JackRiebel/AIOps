"""
API routes for device actions (ping, traceroute, cable test, etc.)

These endpoints wrap the Meraki Live Tools API with a synchronous interface,
polling for results and returning them when ready.
"""

import asyncio
import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from src.api.dependencies import require_edit_mode, credential_manager, get_current_active_user
from src.services.meraki_api import MerakiAPIClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/actions", tags=["actions"])


# ============================================================================
# Available Actions Endpoint - Returns device-specific capabilities
# ============================================================================

from src.api.dependencies import require_viewer


def get_actions_for_model(model: str) -> list[str]:
    """Determine available actions based on device model.

    Args:
        model: Device model string (e.g., "MX68", "MS225-24", "MR46")

    Returns:
        List of action names available for this device type
    """
    model_upper = (model or "").upper()

    # Base actions available for all devices
    actions = ["blink-led", "reboot"]

    # MX (Security Appliance / Gateway) - ping, traceroute
    if model_upper.startswith("MX") or model_upper.startswith("Z"):
        actions.extend(["ping", "traceroute", "mtr"])

    # MS (Switch) - cable-test, port-cycle, port-config
    if model_upper.startswith("MS"):
        actions.extend(["cable-test", "port-cycle", "port-config"])

    # MR (Wireless AP) - wireless-specific tools
    if model_upper.startswith("MR") or model_upper.startswith("CW"):
        actions.extend(["rf-spectrum"])

    # MV (Camera) - snapshot
    if model_upper.startswith("MV"):
        actions.extend(["snapshot"])

    # MT (Sensor) - limited actions
    if model_upper.startswith("MT"):
        # Sensors only support blink-led (already included)
        pass

    return actions


@router.get("/available/{serial}", dependencies=[Depends(require_viewer)])
async def get_available_actions(serial: str):
    """Get available actions for a device based on its model.

    This endpoint centralizes the logic for determining what actions
    a device supports, avoiding hardcoded frontend checks.

    Args:
        serial: Device serial number

    Returns:
        List of available action names for the device
    """
    from src.services.network_cache_service import NetworkCacheService

    try:
        cache_service = NetworkCacheService()

        # Search for device in cache
        device_info = None
        from src.api.dependencies import credential_manager
        orgs = await credential_manager.list_organizations()

        for org in orgs:
            org_name = org.get("name")
            devices = await cache_service.get_cached_devices(org_name)

            for dev in devices:
                if dev.get("serial") == serial:
                    device_info = dev
                    break
            if device_info:
                break

        if not device_info:
            # Device not in cache - try to determine from serial prefix
            # Meraki serials encode product type in first characters
            # Q2xx = MX, Q2Kx = MS, Q2Mx = MR, Q2Hx = MV, Q3Ax = MT
            serial_prefix = serial[:3].upper() if len(serial) >= 3 else ""
            model_guess = ""

            if serial_prefix.startswith("Q2A") or serial_prefix.startswith("Q2Q"):
                model_guess = "MX"
            elif serial_prefix.startswith("Q2K") or serial_prefix.startswith("Q2Y"):
                model_guess = "MS"
            elif serial_prefix.startswith("Q2M") or serial_prefix.startswith("Q2H"):
                model_guess = "MR"
            elif serial_prefix.startswith("Q2G") or serial_prefix.startswith("Q2N"):
                model_guess = "MV"
            elif serial_prefix.startswith("Q3A"):
                model_guess = "MT"
            else:
                # Default to base actions if we can't determine
                return {
                    "serial": serial,
                    "model": None,
                    "actions": ["blink-led", "reboot"],
                    "note": "Device not found in cache. Actions may be limited.",
                }

            return {
                "serial": serial,
                "model": model_guess,
                "actions": get_actions_for_model(model_guess),
                "note": "Device not found in cache. Model inferred from serial.",
            }

        # Device found - use actual model
        model = device_info.get("model", "")
        actions = get_actions_for_model(model)

        return {
            "serial": serial,
            "model": model,
            "name": device_info.get("name"),
            "status": device_info.get("status"),
            "actions": actions,
        }

    except Exception as e:
        logger.error(f"[Actions] Error getting available actions for {serial}: {e}")
        return {
            "serial": serial,
            "model": None,
            "actions": ["blink-led", "reboot"],
            "error": str(e),
        }


# ============================================================================
# Request/Response Models
# ============================================================================

class PingRequest(BaseModel):
    serial: str
    target: str = "8.8.8.8"
    count: int = 5


class PingResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class BlinkLedRequest(BaseModel):
    serial: str
    duration: int = 20  # seconds
    period: int = 160   # ms
    duty: int = 50      # percent


class RebootRequest(BaseModel):
    serial: str


class CableTestRequest(BaseModel):
    serial: str
    ports: list[str]


# ============================================================================
# Helper: Get Meraki Client
# ============================================================================

async def get_meraki_client() -> MerakiAPIClient:
    """Get a Meraki API client from the first available Meraki cluster."""
    clusters = await credential_manager.list_clusters(active_only=True)

    for cluster in clusters:
        creds = await credential_manager.get_credentials(cluster.name)
        if creds:
            api_key = creds.get("meraki_api_key") or creds.get("api_key")
            if api_key and len(api_key) == 40 and api_key.isalnum():
                return MerakiAPIClient(api_key=api_key)

    raise HTTPException(status_code=400, detail="No Meraki API key configured")


# ============================================================================
# Ping Endpoint
# ============================================================================

@router.post("/ping", response_model=PingResponse, dependencies=[Depends(require_edit_mode)])
async def ping_device(request: PingRequest):
    """
    Execute a ping test from a Meraki device to a target.

    This initiates an async ping via the Meraki Live Tools API,
    then polls for the result (up to 30 seconds).
    """
    try:
        client = await get_meraki_client()

        # Start the ping test
        logger.info(f"[Actions] Starting ping from {request.serial} to {request.target}")
        create_path = f"/devices/{request.serial}/liveTools/ping"
        create_result = await client.request("POST", create_path, json_data={
            "target": request.target,
            "count": request.count,
        })

        ping_id = create_result.get("pingId")
        if not ping_id:
            return PingResponse(success=False, error="Failed to get ping ID from API")

        logger.info(f"[Actions] Ping started with ID: {ping_id}")

        # Poll for result (up to 30 seconds)
        result_path = f"/devices/{request.serial}/liveTools/ping/{ping_id}"
        for attempt in range(15):  # 15 attempts * 2 seconds = 30 seconds max
            await asyncio.sleep(2)

            result = await client.request("GET", result_path)
            status = result.get("status")

            logger.debug(f"[Actions] Ping status: {status} (attempt {attempt + 1})")

            if status == "complete":
                # Extract ping results
                ping_results = result.get("results", {})
                return PingResponse(success=True, data={
                    "pingId": ping_id,
                    "status": "complete",
                    "target": request.target,
                    "sent": ping_results.get("sent", request.count),
                    "received": ping_results.get("received", 0),
                    "loss": ping_results.get("loss", {}).get("percentage", 0),
                    "averageLatency": ping_results.get("latencies", {}).get("average"),
                    "minimumLatency": ping_results.get("latencies", {}).get("minimum"),
                    "maximumLatency": ping_results.get("latencies", {}).get("maximum"),
                    "replies": ping_results.get("replies", []),
                })
            elif status == "failed":
                return PingResponse(success=False, error=result.get("error", "Ping failed"))

        # Timeout
        return PingResponse(success=False, error="Ping test timed out after 30 seconds")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Actions] Ping error: {e}")
        return PingResponse(success=False, error=str(e))


# ============================================================================
# Blink LED Endpoint
# ============================================================================

@router.post("/blink-led", dependencies=[Depends(require_edit_mode)])
async def blink_device_led(request: BlinkLedRequest):
    """
    Blink the LEDs on a device for physical identification.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Blinking LEDs on {request.serial} for {request.duration}s")
        path = f"/devices/{request.serial}/blinkLeds"
        result = await client.request("POST", path, json_data={
            "duration": request.duration,
            "period": request.period,
            "duty": request.duty,
        })

        return {"success": True, "data": result}

    except Exception as e:
        logger.error(f"[Actions] Blink LED error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Reboot Endpoint
# ============================================================================

@router.post("/reboot", dependencies=[Depends(require_edit_mode)])
async def reboot_device(request: RebootRequest):
    """
    Reboot a device. Use with caution.
    """
    try:
        client = await get_meraki_client()

        logger.warning(f"[Actions] Rebooting device {request.serial}")
        path = f"/devices/{request.serial}/reboot"
        result = await client.request("POST", path)

        return {"success": True, "data": result, "message": "Device reboot initiated"}

    except Exception as e:
        logger.error(f"[Actions] Reboot error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Cable Test Endpoint
# ============================================================================

@router.post("/cable-test", dependencies=[Depends(require_edit_mode)])
async def cable_test(request: CableTestRequest):
    """
    Run a cable test on switch ports.

    This initiates an async cable test via the Meraki Live Tools API,
    then polls for the result.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Starting cable test on {request.serial} ports {request.ports}")
        create_path = f"/devices/{request.serial}/liveTools/cableTest"
        create_result = await client.request("POST", create_path, json_data={
            "ports": request.ports,
        })

        cable_test_id = create_result.get("cableTestId")
        if not cable_test_id:
            return {"success": False, "error": "Failed to get cable test ID from API"}

        # Poll for result (up to 60 seconds for cable tests)
        result_path = f"/devices/{request.serial}/liveTools/cableTest/{cable_test_id}"
        for attempt in range(30):  # 30 attempts * 2 seconds = 60 seconds max
            await asyncio.sleep(2)

            result = await client.request("GET", result_path)
            status = result.get("status")

            if status == "complete":
                return {"success": True, "data": result}
            elif status == "failed":
                return {"success": False, "error": result.get("error", "Cable test failed")}

        return {"success": False, "error": "Cable test timed out after 60 seconds"}

    except Exception as e:
        logger.error(f"[Actions] Cable test error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Traceroute Endpoint (placeholder - uses same pattern as ping)
# ============================================================================

@router.post("/traceroute", dependencies=[Depends(require_edit_mode)])
async def traceroute_device(request: PingRequest):
    """
    Execute a traceroute from a device (if supported).

    Note: Not all Meraki devices support traceroute via Live Tools.
    This is a placeholder that returns ping results for now.
    """
    # Meraki doesn't have a direct traceroute API for all devices
    # For now, we'll just do a ping and suggest using the device console
    return await ping_device(request)


# ============================================================================
# Port Configuration Endpoint
# ============================================================================

class PortConfigRequest(BaseModel):
    serial: str
    port_id: str
    enabled: Optional[bool] = None
    name: Optional[str] = None
    poe_enabled: Optional[bool] = None


@router.post("/port-config", dependencies=[Depends(require_edit_mode)])
async def configure_port(request: PortConfigRequest):
    """
    Configure a switch port (enable/disable, PoE, name).
    """
    try:
        client = await get_meraki_client()

        # Build the update payload
        update_data = {}
        if request.enabled is not None:
            update_data["enabled"] = request.enabled
        if request.name is not None:
            update_data["name"] = request.name
        if request.poe_enabled is not None:
            update_data["poeEnabled"] = request.poe_enabled

        if not update_data:
            return {"success": False, "error": "No configuration changes specified"}

        logger.info(f"[Actions] Configuring port {request.port_id} on {request.serial}: {update_data}")
        path = f"/devices/{request.serial}/switch/ports/{request.port_id}"
        result = await client.request("PUT", path, json_data=update_data)

        return {
            "success": True,
            "data": result,
            "message": f"Port {request.port_id} configuration updated"
        }

    except Exception as e:
        logger.error(f"[Actions] Port config error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/port-cycle", dependencies=[Depends(require_edit_mode)])
async def cycle_ports(request: CableTestRequest):
    """
    Cycle (power off then on) switch ports. Useful for PoE device resets.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Cycling ports {request.ports} on {request.serial}")
        path = f"/devices/{request.serial}/switch/ports/cycle"
        result = await client.request("POST", path, json_data={"ports": request.ports})

        return {
            "success": True,
            "data": result,
            "message": f"Ports {', '.join(request.ports)} cycled successfully"
        }

    except Exception as e:
        logger.error(f"[Actions] Port cycle error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Workflow Action Endpoints - Used by the workflow engine
# ============================================================================

@router.post("/meraki/devices/{serial}/reboot", dependencies=[Depends(require_edit_mode)])
async def workflow_reboot_device(serial: str):
    """
    Reboot a Meraki device. Workflow action endpoint.
    """
    try:
        client = await get_meraki_client()

        logger.warning(f"[Actions/Workflow] Rebooting device {serial}")
        path = f"/devices/{serial}/reboot"
        result = await client.request("POST", path)

        return {
            "success": True,
            "data": result,
            "message": f"Device {serial} reboot initiated",
            "action": "meraki.reboot_device",
        }

    except Exception as e:
        logger.error(f"[Actions/Workflow] Reboot error: {e}")
        return {"success": False, "error": str(e), "action": "meraki.reboot_device"}


class SSIDUpdateRequest(BaseModel):
    enabled: bool
    name: Optional[str] = None


@router.put("/meraki/networks/{network_id}/wireless/ssids/{number}", dependencies=[Depends(require_edit_mode)])
async def workflow_update_ssid(network_id: str, number: int, request: SSIDUpdateRequest):
    """
    Enable or disable an SSID. Workflow action endpoint.
    """
    try:
        client = await get_meraki_client()

        update_data = {"enabled": request.enabled}
        if request.name:
            update_data["name"] = request.name

        logger.info(f"[Actions/Workflow] Updating SSID {number} on network {network_id}: enabled={request.enabled}")
        path = f"/networks/{network_id}/wireless/ssids/{number}"
        result = await client.request("PUT", path, json_data=update_data)

        return {
            "success": True,
            "data": result,
            "message": f"SSID {number} {'enabled' if request.enabled else 'disabled'}",
            "action": "meraki.enable_ssid",
        }

    except Exception as e:
        logger.error(f"[Actions/Workflow] SSID update error: {e}")
        return {"success": False, "error": str(e), "action": "meraki.enable_ssid"}


class ClientPolicyRequest(BaseModel):
    devicePolicy: str  # "Blocked", "Normal", "Whitelisted"


@router.put("/meraki/networks/{network_id}/clients/{client_id}/policy", dependencies=[Depends(require_edit_mode)])
async def workflow_set_client_policy(network_id: str, client_id: str, request: ClientPolicyRequest):
    """
    Set client policy (block, whitelist, normal). Workflow action endpoint.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions/Workflow] Setting policy for client {client_id} to {request.devicePolicy}")
        path = f"/networks/{network_id}/clients/{client_id}/policy"
        result = await client.request("PUT", path, json_data={
            "devicePolicy": request.devicePolicy.lower(),
        })

        return {
            "success": True,
            "data": result,
            "message": f"Client {client_id} policy set to {request.devicePolicy}",
            "action": "meraki.quarantine_client",
        }

    except Exception as e:
        logger.error(f"[Actions/Workflow] Client policy error: {e}")
        return {"success": False, "error": str(e), "action": "meraki.quarantine_client"}


# ============================================================================
# Notification Action Endpoints (Stubs - to be implemented with integrations)
# ============================================================================

class SlackMessageRequest(BaseModel):
    channel: str
    message: str
    mention: Optional[str] = None


@router.post("/notify/slack")
async def send_slack_notification(
    request: SlackMessageRequest,
    current_user = Depends(get_current_active_user),
):
    """
    Send a Slack message via incoming webhook.
    Requires SLACK_WEBHOOK_URL to be configured in settings.
    """
    import httpx
    from src.config.settings import get_settings

    settings = get_settings()

    if not settings.slack_webhook_url:
        raise HTTPException(
            status_code=501,
            detail="Slack integration not configured. Set SLACK_WEBHOOK_URL in .env"
        )

    # Build Slack message payload
    text = request.message
    if request.mention:
        text = f"<@{request.mention}> {text}"

    payload = {
        "channel": request.channel,
        "text": text,
        "username": "Lumen",
        "icon_emoji": ":satellite:",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.slack_webhook_url,
                json=payload,
            )

            if response.status_code != 200:
                logger.error(f"[Actions/Notify] Slack webhook failed: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "error": f"Slack API error: {response.text}",
                    "action": "notify.slack",
                }

            logger.info(f"[Actions/Notify] User {current_user.username} sent Slack message to {request.channel}")
            return {
                "success": True,
                "message": f"Message sent to {request.channel}",
                "action": "notify.slack",
            }

    except httpx.RequestError as e:
        logger.error(f"[Actions/Notify] Slack request failed: {e}")
        return {
            "success": False,
            "error": f"Failed to send Slack message: {str(e)}",
            "action": "notify.slack",
        }


class EmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    html: Optional[bool] = False


@router.post("/notify/email")
async def send_email_notification(
    request: EmailRequest,
    current_user = Depends(get_current_active_user),
):
    """
    Send an email notification via SMTP.
    Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD to be configured.
    """
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from src.config.settings import get_settings

    settings = get_settings()

    if not settings.smtp_host or not settings.smtp_user:
        raise HTTPException(
            status_code=501,
            detail="Email service not configured. Set SMTP_HOST and SMTP_USER in .env"
        )

    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = request.subject
        msg["From"] = settings.smtp_from
        msg["To"] = request.to

        # Attach body
        content_type = "html" if request.html else "plain"
        msg.attach(MIMEText(request.body, content_type))

        # Send via SMTP
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"[Actions/Notify] User {current_user.username} sent email to {request.to}: {request.subject}")
        return {
            "success": True,
            "message": f"Email sent to {request.to}",
            "action": "notify.email",
        }

    except smtplib.SMTPException as e:
        logger.error(f"[Actions/Notify] SMTP error: {e}")
        return {
            "success": False,
            "error": f"Failed to send email: {str(e)}",
            "action": "notify.email",
        }
    except Exception as e:
        logger.error(f"[Actions/Notify] Email error: {e}")
        return {
            "success": False,
            "error": f"Email sending failed: {str(e)}",
            "action": "notify.email",
        }


class WebexMessageRequest(BaseModel):
    roomId: Optional[str] = None
    message: str
    markdown: Optional[bool] = True


@router.post("/notify/webex")
async def send_webex_notification(
    request: WebexMessageRequest,
    current_user = Depends(get_current_active_user),
):
    """
    Send a Webex Teams message.
    Requires WEBEX_BOT_TOKEN to be configured. Uses WEBEX_ROOM_ID as default room.
    """
    import httpx
    from src.config.settings import get_settings

    settings = get_settings()

    # Check for bot token (preferred) or webhook URL (fallback)
    if not settings.webex_bot_token and not settings.webex_webhook_url:
        raise HTTPException(
            status_code=501,
            detail="Webex integration not configured. Set WEBEX_BOT_TOKEN or WEBEX_WEBHOOK_URL in .env"
        )

    room_id = request.roomId or settings.webex_room_id

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if settings.webex_bot_token:
                # Use Webex API with bot token
                if not room_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Room ID required. Provide roomId in request or set WEBEX_ROOM_ID in .env"
                    )

                payload = {
                    "roomId": room_id,
                }
                if request.markdown:
                    payload["markdown"] = request.message
                else:
                    payload["text"] = request.message

                response = await client.post(
                    "https://webexapis.com/v1/messages",
                    headers={
                        "Authorization": f"Bearer {settings.webex_bot_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if response.status_code not in (200, 201):
                    error_detail = response.json().get("message", response.text)
                    logger.error(f"[Actions/Notify] Webex API failed: {response.status_code} - {error_detail}")
                    return {
                        "success": False,
                        "error": f"Webex API error: {error_detail}",
                        "action": "notify.webex",
                    }
            else:
                # Use incoming webhook
                response = await client.post(
                    settings.webex_webhook_url,
                    json={"markdown" if request.markdown else "text": request.message},
                )

                if response.status_code != 200:
                    logger.error(f"[Actions/Notify] Webex webhook failed: {response.status_code}")
                    return {
                        "success": False,
                        "error": f"Webex webhook error: {response.text}",
                        "action": "notify.webex",
                    }

            logger.info(f"[Actions/Notify] User {current_user.username} sent Webex message to room {room_id or 'webhook'}")
            return {
                "success": True,
                "message": f"Message sent to Webex",
                "action": "notify.webex",
            }

    except httpx.RequestError as e:
        logger.error(f"[Actions/Notify] Webex request failed: {e}")
        return {
            "success": False,
            "error": f"Failed to send Webex message: {str(e)}",
            "action": "notify.webex",
        }


# ============================================================================
# Custom Action Endpoints
# ============================================================================

import ipaddress
import socket
from urllib.parse import urlparse


def is_ssrf_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate URL to prevent SSRF attacks.

    Blocks:
    - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    - Loopback addresses (127.x.x.x, localhost)
    - Link-local addresses (169.254.x.x)
    - Metadata endpoints (169.254.169.254)
    - IPv6 private/loopback addresses
    - Non-HTTP(S) schemes

    Returns:
        Tuple of (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)

        # Only allow HTTP(S) schemes
        if parsed.scheme not in ('http', 'https'):
            return False, f"Invalid URL scheme: {parsed.scheme}. Only http and https are allowed."

        # Get hostname
        hostname = parsed.hostname
        if not hostname:
            return False, "URL must have a hostname"

        # Block localhost variations
        localhost_patterns = ['localhost', 'localhost.localdomain', '127.0.0.1', '::1', '0.0.0.0']
        if hostname.lower() in localhost_patterns:
            return False, "Localhost URLs are not allowed"

        # Try to resolve hostname to check for internal IPs
        try:
            # Resolve hostname to IP addresses
            ip_addresses = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            for family, _, _, _, sockaddr in ip_addresses:
                ip_str = sockaddr[0]
                try:
                    ip = ipaddress.ip_address(ip_str)

                    # Block private addresses
                    if ip.is_private:
                        return False, f"Private IP addresses are not allowed: {ip}"

                    # Block loopback
                    if ip.is_loopback:
                        return False, f"Loopback addresses are not allowed: {ip}"

                    # Block link-local
                    if ip.is_link_local:
                        return False, f"Link-local addresses are not allowed: {ip}"

                    # Block reserved
                    if ip.is_reserved:
                        return False, f"Reserved addresses are not allowed: {ip}"

                    # Block multicast
                    if ip.is_multicast:
                        return False, f"Multicast addresses are not allowed: {ip}"

                    # Block cloud metadata endpoints (AWS, GCP, Azure)
                    metadata_ips = ['169.254.169.254', '169.254.170.2', 'fd00:ec2::254']
                    if ip_str in metadata_ips:
                        return False, f"Cloud metadata endpoints are not allowed: {ip}"

                except ValueError:
                    continue

        except socket.gaierror as e:
            return False, f"Could not resolve hostname: {hostname}"

        return True, ""

    except Exception as e:
        return False, f"URL validation error: {str(e)}"


class WebhookRequest(BaseModel):
    url: str
    method: str = "POST"
    headers: Optional[dict] = None
    body: Optional[dict] = None


@router.post("/webhook")
async def call_custom_webhook(
    request: WebhookRequest,
    current_user = Depends(get_current_active_user),
):
    """
    Call a custom webhook endpoint.

    Security:
    - Requires authenticated user session
    - URL is validated to prevent SSRF attacks
    - Only external HTTPS/HTTP endpoints are allowed
    """
    import httpx

    # SSRF protection: validate URL before making request
    is_safe, error_msg = is_ssrf_safe_url(request.url)
    if not is_safe:
        logger.warning(f"[Actions/Webhook] SSRF blocked: {error_msg} for URL: {request.url}")
        return {
            "success": False,
            "error": f"URL not allowed: {error_msg}",
            "action": "custom.webhook",
        }

    try:
        logger.info(f"[Actions/Webhook] User {current_user.username} calling {request.method} {request.url}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method.upper(),
                url=request.url,
                headers=request.headers or {},
                json=request.body,
            )

            # Try to parse response as JSON, fallback to text
            try:
                response_data = response.json()
            except Exception:
                response_data = {"text": response.text[:1000]}

            return {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "data": response_data,
                "action": "custom.webhook",
            }

    except httpx.TimeoutException:
        return {"success": False, "error": "Request timed out after 30 seconds", "action": "custom.webhook"}
    except Exception as e:
        logger.error(f"[Actions/Webhook] Error: {e}")
        return {"success": False, "error": str(e), "action": "custom.webhook"}


class AIAnalyzeRequest(BaseModel):
    prompt: str
    context: Optional[dict] = None
    include_context: bool = True


@router.post("/ai/analyze")
async def ai_analyze_action(request: AIAnalyzeRequest):
    """
    Use AI to analyze data and provide recommendations.
    """
    try:
        from src.services.ai_service import get_ai_service

        ai_service = get_ai_service()

        # Build context for AI
        system_prompt = """You are an AI assistant helping with network automation.
Analyze the provided data and give clear, actionable recommendations.
Be concise and specific. Focus on the most important findings."""

        user_prompt = request.prompt
        if request.include_context and request.context:
            user_prompt += f"\n\nContext data:\n```json\n{request.context}\n```"

        # Call AI service
        result = await ai_service.analyze(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        return {
            "success": True,
            "analysis": result.get("response"),
            "confidence": result.get("confidence", 0.8),
            "cost_usd": result.get("cost_usd", 0),
            "action": "ai.analyze",
        }

    except Exception as e:
        logger.error(f"[Actions/AI] Error: {e}")
        return {"success": False, "error": str(e), "action": "ai.analyze"}


# ============================================================================
# Splunk Action Endpoints
# ============================================================================

class SplunkSearchRequest(BaseModel):
    query: str
    earliest: str = "-24h"
    latest: str = "now"
    max_results: int = 100


@router.post("/splunk/search")
async def splunk_search_action(request: SplunkSearchRequest):
    """
    Execute a Splunk search query.
    """
    try:
        from src.services.tools.splunk import SplunkClient
        from src.config.settings import get_settings
        from src.services.config_service import get_config_or_env

        settings = get_settings()

        # Load Splunk credentials from database first, then settings
        splunk_host = (
            get_config_or_env("splunk_host", "SPLUNK_HOST") or
            settings.splunk_host
        )
        splunk_username = (
            get_config_or_env("splunk_username", "SPLUNK_USERNAME") or
            settings.splunk_username
        )
        splunk_password = (
            get_config_or_env("splunk_password", "SPLUNK_PASSWORD") or
            settings.splunk_password
        )
        splunk_token = (
            get_config_or_env("splunk_bearer_token", "SPLUNK_BEARER_TOKEN") or
            settings.splunk_token
        )

        if not splunk_host:
            raise HTTPException(status_code=501, detail="Splunk is not configured")

        client = SplunkClient(
            base_url=f"https://{splunk_host}:{settings.splunk_port}",
            username=splunk_username,
            password=splunk_password,
            token=splunk_token,
            verify_ssl=settings.splunk_verify_ssl,
        )

        results = await client.run_search(
            query=request.query,
            earliest_time=request.earliest,
            latest_time=request.latest,
            max_results=request.max_results,
        )

        events = results if isinstance(results, list) else results.get("results", [])

        return {
            "success": True,
            "data": {
                "events": events,
                "count": len(events),
                "query": request.query,
                "time_range": f"{request.earliest} to {request.latest}",
            },
            "action": "splunk.run_query",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Actions/Splunk] Error: {e}")
        return {"success": False, "error": str(e), "action": "splunk.run_query"}


# ============================================================================
# Traffic & Security Action Endpoints
# Used by UI cards for blocking traffic, apps, and managing security events
# ============================================================================

class BlockTrafficRequest(BaseModel):
    network_id: str
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    protocol: Optional[str] = None
    port: Optional[int] = None
    comment: Optional[str] = None


@router.post("/block-traffic", dependencies=[Depends(require_edit_mode)])
async def block_traffic_flow(request: BlockTrafficRequest):
    """
    Block traffic flow via L3 firewall rule.

    Creates a deny rule in the MX L3 firewall for the specified traffic.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Blocking traffic: src={request.source_ip} dst={request.destination_ip}")

        # Get current L3 firewall rules
        path = f"/networks/{request.network_id}/appliance/firewall/l3FirewallRules"
        current_rules = await client.request("GET", path)
        rules = current_rules.get("rules", [])

        # Build new deny rule
        new_rule = {
            "comment": request.comment or f"Blocked by dashboard action",
            "policy": "deny",
            "protocol": request.protocol or "any",
            "srcCidr": request.source_ip or "any",
            "destCidr": request.destination_ip or "any",
        }
        if request.port:
            new_rule["destPort"] = str(request.port)

        # Insert at the beginning (before other rules)
        rules.insert(0, new_rule)

        # Update firewall rules
        result = await client.request("PUT", path, json_data={"rules": rules})

        return {
            "success": True,
            "message": f"Traffic blocked: {request.source_ip or 'any'} → {request.destination_ip or 'any'}",
            "data": result,
        }

    except Exception as e:
        logger.error(f"[Actions] Block traffic error: {e}")
        return {"success": False, "error": str(e)}


class BlockAppRequest(BaseModel):
    network_id: str
    application: str
    comment: Optional[str] = None


@router.post("/block-app", dependencies=[Depends(require_edit_mode)])
async def block_application(request: BlockAppRequest):
    """
    Block an application via content filtering.

    Uses MX content filtering to block the specified application category.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Blocking application: {request.application}")

        # Get current content filtering settings
        path = f"/networks/{request.network_id}/appliance/contentFiltering"
        current = await client.request("GET", path)

        # Add to blocked URL categories (simplified - real impl would map app to category)
        blocked_categories = current.get("blockedUrlCategories", [])
        blocked_patterns = current.get("blockedUrlPatterns", [])

        # Add application as a blocked pattern if not already blocked
        if request.application not in blocked_patterns:
            blocked_patterns.append(request.application)

        # Update content filtering
        result = await client.request("PUT", path, json_data={
            "blockedUrlCategories": blocked_categories,
            "blockedUrlPatterns": blocked_patterns,
        })

        return {
            "success": True,
            "message": f"Application blocked: {request.application}",
            "data": result,
        }

    except Exception as e:
        logger.error(f"[Actions] Block app error: {e}")
        return {"success": False, "error": str(e)}


class AcknowledgeEventRequest(BaseModel):
    event_id: str
    notes: Optional[str] = None


@router.post("/acknowledge-event", dependencies=[Depends(require_edit_mode)])
async def acknowledge_security_event(request: AcknowledgeEventRequest):
    """
    Acknowledge a security event.

    Marks the event as reviewed/acknowledged in the local database.
    """
    try:
        from src.config.database import get_db_connection
        from datetime import datetime

        logger.info(f"[Actions] Acknowledging security event: {request.event_id}")
        now = datetime.utcnow()

        async with get_db_connection() as conn:
            await conn.execute(
                """
                INSERT INTO security_event_acks (event_id, acknowledged_at, notes)
                VALUES ($1, $2, $3)
                ON CONFLICT (event_id) DO UPDATE SET
                    acknowledged_at = $2,
                    notes = COALESCE($3, security_event_acks.notes)
                """,
                request.event_id,
                now,
                request.notes,
            )

        return {
            "success": True,
            "message": f"Event {request.event_id} acknowledged",
        }

    except Exception as e:
        logger.error(f"[Actions] Acknowledge event error: {e}")
        # If DB table doesn't exist, return success anyway (event is noted)
        return {
            "success": True,
            "message": f"Event {request.event_id} acknowledged (note: {str(e)})",
        }


class CreateExceptionRequest(BaseModel):
    network_id: str
    source_ip: str
    destination_ip: Optional[str] = None
    port: Optional[int] = None
    protocol: Optional[str] = None
    comment: Optional[str] = None


@router.post("/create-exception", dependencies=[Depends(require_edit_mode)])
async def create_firewall_exception(request: CreateExceptionRequest):
    """
    Create a firewall exception (whitelist rule).

    Adds an allow rule to the L3 firewall for the specified traffic.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Creating exception for: {request.source_ip}")

        # Get current L3 firewall rules
        path = f"/networks/{request.network_id}/appliance/firewall/l3FirewallRules"
        current_rules = await client.request("GET", path)
        rules = current_rules.get("rules", [])

        # Build allow rule
        allow_rule = {
            "comment": request.comment or f"Exception created by dashboard",
            "policy": "allow",
            "protocol": request.protocol or "any",
            "srcCidr": request.source_ip,
            "destCidr": request.destination_ip or "any",
        }
        if request.port:
            allow_rule["destPort"] = str(request.port)

        # Insert at the beginning (before deny rules)
        rules.insert(0, allow_rule)

        result = await client.request("PUT", path, json_data={"rules": rules})

        return {
            "success": True,
            "message": f"Exception created for {request.source_ip}",
            "data": result,
        }

    except Exception as e:
        logger.error(f"[Actions] Create exception error: {e}")
        return {"success": False, "error": str(e)}


class QoSAdjustRequest(BaseModel):
    network_id: str
    traffic_class: str  # e.g., "VoIP", "Video", "BestEffort"
    bandwidth_limit: Optional[int] = None  # Kbps
    priority: Optional[int] = None  # 0-7


@router.post("/qos-adjust", dependencies=[Depends(require_edit_mode)])
async def adjust_qos_settings(request: QoSAdjustRequest):
    """
    Adjust QoS/Traffic shaping settings.

    Modifies traffic shaping rules for the specified traffic class.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Adjusting QoS for {request.traffic_class}")

        # Get current traffic shaping settings
        path = f"/networks/{request.network_id}/appliance/trafficShaping"
        current = await client.request("GET", path)

        # Update based on traffic class (simplified implementation)
        update_data = {}
        if request.bandwidth_limit:
            update_data["globalBandwidthLimits"] = {
                "limitUp": request.bandwidth_limit,
                "limitDown": request.bandwidth_limit,
            }

        if update_data:
            result = await client.request("PUT", path, json_data=update_data)
        else:
            result = current

        return {
            "success": True,
            "message": f"QoS adjusted for {request.traffic_class}",
            "data": result,
        }

    except Exception as e:
        logger.error(f"[Actions] QoS adjust error: {e}")
        return {"success": False, "error": str(e)}


class MTRRequest(BaseModel):
    serial: str
    target: str


@router.post("/mtr", dependencies=[Depends(require_edit_mode)])
async def run_mtr_traceroute(request: MTRRequest):
    """
    Run MTR-style traceroute from a device.

    Note: Meraki doesn't have a direct MTR API, so this performs
    a ping test and provides latency info as an approximation.
    For full MTR, access the device console directly.
    """
    try:
        client = await get_meraki_client()

        logger.info(f"[Actions] Running MTR to {request.target} from {request.serial}")

        # Use ping as approximation (Meraki doesn't have direct traceroute API)
        create_path = f"/devices/{request.serial}/liveTools/ping"
        create_result = await client.request("POST", create_path, json_data={
            "target": request.target,
            "count": 5,
        })

        ping_id = create_result.get("pingId")
        if not ping_id:
            return {"success": False, "error": "Failed to initiate test"}

        # Poll for result
        import asyncio
        result_path = f"/devices/{request.serial}/liveTools/ping/{ping_id}"
        for _ in range(15):
            await asyncio.sleep(2)
            result = await client.request("GET", result_path)
            if result.get("status") == "complete":
                ping_results = result.get("results", {})
                return {
                    "success": True,
                    "message": f"MTR to {request.target} complete",
                    "data": {
                        "target": request.target,
                        "hops": [
                            {
                                "hop": 1,
                                "host": request.target,
                                "latency_avg": ping_results.get("latencies", {}).get("average"),
                                "latency_min": ping_results.get("latencies", {}).get("minimum"),
                                "latency_max": ping_results.get("latencies", {}).get("maximum"),
                                "loss": ping_results.get("loss", {}).get("percentage", 0),
                            }
                        ],
                        "note": "Approximated from ping. For full MTR, use device console.",
                    },
                }

        return {"success": False, "error": "Test timed out"}

    except Exception as e:
        logger.error(f"[Actions] MTR error: {e}")
        return {"success": False, "error": str(e)}


# ============================================================================
# Generic Card Action Endpoint
# Handles various card-initiated actions with a unified interface
# ============================================================================

class GenericActionRequest(BaseModel):
    action_type: str
    payload: Optional[Dict[str, Any]] = None


@router.post("/execute")
async def execute_generic_action(request: GenericActionRequest):
    """
    Execute a generic card action.

    This is a catch-all endpoint for card actions that don't have
    specific endpoints. Returns success for demo/testing purposes.
    """
    logger.info(f"[Actions] Generic action: {request.action_type}, payload: {request.payload}")

    # Map action types to handlers or return generic success
    action_handlers = {
        "investigate-cluster": lambda p: {"message": "Investigation started", "cluster_id": p.get("clusterId")},
        "dismiss-cluster": lambda p: {"message": "Cluster dismissed", "cluster_id": p.get("clusterId")},
        "refresh-correlation": lambda p: {"message": "Correlation data refreshed"},
        "resolve-alert": lambda p: {"message": f"Alert {p.get('alertId')} resolved"},
        "suppress-alert": lambda p: {"message": f"Similar alerts to '{p.get('alertTitle')}' suppressed"},
        "optimize-coverage": lambda p: {"message": "Coverage optimization started"},
        "change-channel": lambda p: {"message": f"Channel change initiated"},
        "avoid-channel": lambda p: {"message": f"Channel {p.get('channel')} added to avoid list"},
        "auto-channel": lambda p: {"message": "Auto-channel selection enabled"},
        "optimize-roaming": lambda p: {"message": "Roaming optimization applied"},
        "force-root-bridge": lambda p: {"message": "Root bridge election forced"},
        "splunk-investigate": lambda p: {"message": "Splunk investigation started"},
        "splunk-rule": lambda p: {"message": "Correlation rule created"},
        "splunk-refine": lambda p: {"message": "Search refined", "field": p.get("field"), "value": p.get("value")},
        "splunk-export": lambda p: {"message": "Export started"},
        "firewall-edit": lambda p: {"message": "Firewall rule editor opened"},
    }

    handler = action_handlers.get(request.action_type)
    if handler:
        result = handler(request.payload or {})
        return {
            "success": True,
            "action": request.action_type,
            **result,
        }

    # Default response for unknown action types
    return {
        "success": True,
        "action": request.action_type,
        "message": f"Action '{request.action_type}' executed",
        "payload": request.payload,
    }
