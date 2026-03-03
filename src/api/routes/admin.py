"""Admin API routes for system configuration management.

These endpoints are only accessible to users with ADMIN role.
"""

import logging
import httpx
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from src.api.dependencies import require_admin
from src.models.user import User
from src.models.system_config import CONFIG_DEFINITIONS
from src.services.config_service import (
    get_config_service,
    get_effective_config,
)
from src.config.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    """Request model for updating a configuration value."""
    value: str = Field(..., description="Configuration value")


class ConfigBulkUpdateRequest(BaseModel):
    """Request model for bulk updating configuration values."""
    configs: Dict[str, str] = Field(..., description="Key-value pairs to update")


# ===================================================================
# SYSTEM CONFIGURATION ENDPOINTS
# ===================================================================

@router.get("/api/admin/config", dependencies=[Depends(require_admin)])
async def get_all_config(
    category: Optional[str] = None,
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Get all system configuration with status.

    Returns configuration definitions with their current state:
    - Whether they're configured in database
    - Whether they're configured via environment variable
    - Which source is being used (database, env, or default)

    Sensitive values are masked.
    """
    config_service = get_config_service()
    status = await config_service.get_config_status()

    # Filter by category if specified
    if category:
        status = {k: v for k, v in status.items() if v.get("category") == category}

    # Group by category for easier UI rendering
    categories = {}
    for key, config in status.items():
        cat = config.get("category", "other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "key": key,
            **config
        })

    return {
        "configs": status,
        "categories": categories,
        "available_categories": ["integrations", "ai", "auth", "security", "server"]
    }


@router.get("/api/admin/config/{key}", dependencies=[Depends(require_admin)])
async def get_config_by_key(
    key: str,
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Get a single configuration value by key.

    Returns the configuration definition and current status.
    Sensitive values are masked unless explicitly requested (future feature).
    """
    if key not in CONFIG_DEFINITIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown configuration key: {key}"
        )

    config_service = get_config_service()
    status = await config_service.get_config_status()

    if key not in status:
        raise HTTPException(status_code=404, detail="Configuration not found")

    return status[key]


@router.put("/api/admin/config/{key}", dependencies=[Depends(require_admin)])
async def update_config(
    key: str,
    request: ConfigUpdateRequest,
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Update a configuration value.

    The value will be stored in the database and will take precedence
    over any .env file value.
    """
    if key not in CONFIG_DEFINITIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown configuration key: {key}"
        )

    definition = CONFIG_DEFINITIONS[key]
    config_service = get_config_service()

    try:
        await config_service.set_config(
            key=key,
            value=request.value,
            is_sensitive=definition.get("sensitive", False),
            description=definition.get("description"),
            category=definition.get("category")
        )

        # Reset services that depend on API keys when they change
        if key == "openai_api_key":
            from src.services.embedding_service import reset_embedding_service
            reset_embedding_service()
            logger.info("Reset embedding service to pick up new OpenAI API key")

        # Reset credential pool when platform credentials change
        if key in ("meraki_api_key", "thousandeyes_oauth_token", "catalyst_center_host",
                   "catalyst_center_username", "catalyst_center_password",
                   "splunk_host", "splunk_hec_token", "splunk_api_url", "splunk_bearer_token"):
            from src.services.credential_pool import reset_credential_pool
            reset_credential_pool()
            logger.info(f"Reset credential pool to pick up new {key}")

        logger.info(f"Admin {user.username} updated config: {key}")

        return {
            "success": True,
            "key": key,
            "message": f"Configuration '{key}' updated successfully"
        }

    except Exception as e:
        logger.error(f"Failed to update config {key}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update configuration: {str(e)}"
        )


@router.put("/api/admin/config", dependencies=[Depends(require_admin)])
async def bulk_update_config(
    request: ConfigBulkUpdateRequest,
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Bulk update multiple configuration values.

    Useful for updating all settings in a category at once.
    """
    config_service = get_config_service()
    updated = []
    errors = []

    for key, value in request.configs.items():
        if key not in CONFIG_DEFINITIONS:
            errors.append({"key": key, "error": "Unknown configuration key"})
            continue

        definition = CONFIG_DEFINITIONS[key]

        try:
            await config_service.set_config(
                key=key,
                value=value,
                is_sensitive=definition.get("sensitive", False),
                description=definition.get("description"),
                category=definition.get("category")
            )
            updated.append(key)
        except Exception as e:
            errors.append({"key": key, "error": str(e)})

    if updated:
        logger.info(f"Admin {user.username} bulk updated configs: {updated}")

        # Reset services that depend on API keys when they change
        if "openai_api_key" in updated:
            from src.services.embedding_service import reset_embedding_service
            reset_embedding_service()
            logger.info("Reset embedding service to pick up new OpenAI API key")

        # Reset credential pool when platform credentials change
        platform_keys = {"meraki_api_key", "thousandeyes_oauth_token", "catalyst_center_host",
                        "catalyst_center_username", "catalyst_center_password",
                        "splunk_host", "splunk_hec_token", "splunk_api_url", "splunk_bearer_token"}
        if platform_keys & set(updated):
            from src.services.credential_pool import reset_credential_pool
            reset_credential_pool()
            logger.info("Reset credential pool to pick up new platform credentials")

    return {
        "success": len(errors) == 0,
        "updated": updated,
        "errors": errors
    }


@router.delete("/api/admin/config/{key}", dependencies=[Depends(require_admin)])
async def delete_config(
    key: str,
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Delete a configuration value from the database.

    After deletion, the system will fall back to:
    1. Environment variable (if set)
    2. Default value (if defined)
    """
    if key not in CONFIG_DEFINITIONS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown configuration key: {key}"
        )

    config_service = get_config_service()

    try:
        deleted = await config_service.delete_config(key)

        if deleted:
            logger.info(f"Admin {user.username} deleted config: {key}")
            return {
                "success": True,
                "key": key,
                "message": f"Configuration '{key}' deleted. Will now use .env or default value."
            }
        else:
            return {
                "success": True,
                "key": key,
                "message": f"Configuration '{key}' was not in database (may already be using .env)."
            }

    except Exception as e:
        logger.error(f"Failed to delete config {key}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete configuration: {str(e)}"
        )


# ===================================================================
# INTEGRATION TEST ENDPOINTS
# ===================================================================

@router.post("/api/admin/config/test/meraki", dependencies=[Depends(require_admin)])
async def test_meraki_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Meraki API connection with current credentials."""
    config_service = get_config_service()
    api_key = await config_service.get_config("meraki_api_key")

    if not api_key:
        # Fall back to settings
        settings = get_settings()
        api_key = settings.meraki_api_key

    if not api_key:
        return {
            "success": False,
            "message": "Meraki API key not configured"
        }

    try:
        async with httpx.AsyncClient(verify=get_settings().meraki_verify_ssl) as client:
            response = await client.get(
                "https://api.meraki.com/api/v1/organizations",
                headers={"X-Cisco-Meraki-API-Key": api_key},
                timeout=10.0
            )

        if response.status_code == 200:
            orgs = response.json()
            return {
                "success": True,
                "message": f"Connected successfully. Found {len(orgs)} organization(s).",
                "organizations": len(orgs)
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid API key - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"API returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/anthropic", dependencies=[Depends(require_admin)])
async def test_anthropic_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Anthropic API connection with current credentials."""
    config_service = get_config_service()
    api_key = await config_service.get_config("anthropic_api_key")

    if not api_key:
        settings = get_settings()
        api_key = settings.anthropic_api_key

    if not api_key:
        return {
            "success": False,
            "message": "Anthropic API key not configured"
        }

    try:
        # Respect verify_ssl setting from database or env
        from src.services.config_service import get_config_or_env
        db_verify = get_config_or_env("anthropic_verify_ssl", "ANTHROPIC_VERIFY_SSL")
        if db_verify is not None:
            verify_ssl = db_verify.lower() not in ("false", "0", "no", "disabled")
        else:
            verify_ssl = get_settings().anthropic_verify_ssl

        async with httpx.AsyncClient(verify=verify_ssl) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Say hello"}]
                },
                timeout=15.0
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Connected to Anthropic API successfully"
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid API key - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"API returned status {response.status_code}: {response.text[:200]}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/openai", dependencies=[Depends(require_admin)])
async def test_openai_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test OpenAI API connection with current credentials."""
    config_service = get_config_service()
    api_key = await config_service.get_config("openai_api_key")

    if not api_key:
        settings = get_settings()
        api_key = settings.openai_api_key

    if not api_key:
        return {
            "success": False,
            "message": "OpenAI API key not configured"
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=10.0
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Connected to OpenAI API successfully"
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid API key - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"API returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/google", dependencies=[Depends(require_admin)])
async def test_google_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Google AI API connection with current credentials."""
    config_service = get_config_service()
    api_key = await config_service.get_config("google_api_key")

    if not api_key:
        settings = get_settings()
        api_key = settings.google_api_key

    if not api_key:
        return {
            "success": False,
            "message": "Google API key not configured"
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://generativelanguage.googleapis.com/v1/models?key={api_key}",
                timeout=10.0
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Connected to Google AI API successfully"
            }
        elif response.status_code == 401 or response.status_code == 403:
            return {
                "success": False,
                "message": "Invalid API key - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"API returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/cisco", dependencies=[Depends(require_admin)])
async def test_cisco_circuit_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Cisco Circuit AI connection with current credentials."""
    import base64

    config_service = get_config_service()
    client_id = await config_service.get_config("cisco_circuit_client_id")
    client_secret = await config_service.get_config("cisco_circuit_client_secret")

    if not client_id or not client_secret:
        settings = get_settings()
        client_id = client_id or settings.cisco_circuit_client_id
        client_secret = client_secret or settings.cisco_circuit_client_secret

    if not client_id or not client_secret:
        return {
            "success": False,
            "message": "Cisco Circuit credentials not configured"
        }

    try:
        # Get OAuth token
        auth_string = f"{client_id}:{client_secret}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()

        async with httpx.AsyncClient(verify=get_settings().cisco_circuit_verify_ssl) as client:
            response = await client.post(
                "https://id.cisco.com/oauth2/default/v1/token",
                headers={
                    "Authorization": f"Basic {encoded_auth}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data="grant_type=client_credentials",
                timeout=10.0
            )

        if response.status_code == 200:
            token_data = response.json()
            if "access_token" in token_data:
                return {
                    "success": True,
                    "message": "Connected to Cisco Circuit AI successfully"
                }
            else:
                return {
                    "success": False,
                    "message": "Token response missing access_token"
                }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid credentials - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"Token endpoint returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/splunk", dependencies=[Depends(require_admin)])
async def test_splunk_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Splunk HEC connection with current credentials."""
    config_service = get_config_service()
    splunk_host = await config_service.get_config("splunk_host")
    hec_token = await config_service.get_config("splunk_hec_token")

    if not splunk_host or not hec_token:
        settings = get_settings()
        splunk_host = splunk_host or getattr(settings, "splunk_host", None)
        hec_token = hec_token or getattr(settings, "splunk_hec_token", None)

    if not splunk_host or not hec_token:
        return {
            "success": False,
            "message": "Splunk credentials not configured"
        }

    try:
        import json
        # Test HEC by sending a simple test event
        # HEC typically runs on port 8088 (not 8080/8000 which is Web UI)
        hec_url = f"{splunk_host.rstrip('/')}/services/collector/event"
        # Simple event format - let Splunk use token's default sourcetype/index
        test_event = {
            "event": {"message": "Cisco AIOps Hub connection test", "status": "ok"}
        }

        async with httpx.AsyncClient(verify=get_settings().splunk_verify_ssl, timeout=10.0, follow_redirects=True) as client:
            response = await client.post(
                hec_url,
                headers={
                    "Authorization": f"Splunk {hec_token}",
                    "Content-Type": "application/json"
                },
                content=json.dumps(test_event)
            )

        # Parse response body for detailed error info
        try:
            response_data = response.json()
        except Exception:
            response_data = {"text": response.text[:200] if response.text else "No response body"}

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Connected to Splunk HEC successfully (test event sent)"
            }
        elif response.status_code == 401 or response.status_code == 403:
            return {
                "success": False,
                "message": "Invalid HEC token - check your token in Splunk Settings > Data Inputs > HTTP Event Collector"
            }
        elif response.status_code == 404:
            return {
                "success": False,
                "message": "HEC endpoint not found (404). You're likely using the Web UI port. Check Splunk Settings > Data Inputs > HTTP Event Collector for the correct port (usually 8088)"
            }
        elif response.status_code == 400:
            # Bad request - include Splunk's error message
            error_text = response_data.get("text", response_data.get("message", str(response_data)))
            return {
                "success": False,
                "message": f"Bad request (400): {error_text}"
            }
        elif response.status_code == 303 or response.status_code == 302:
            return {
                "success": False,
                "message": "Redirect detected - ensure you're using the HEC port (typically 8088, not 8080)"
            }
        else:
            error_text = response_data.get("text", response_data.get("message", str(response_data)))
            return {
                "success": False,
                "message": f"Splunk returned status {response.status_code}: {error_text}"
            }

    except httpx.ConnectError:
        return {
            "success": False,
            "message": "Connection refused - check if Splunk is running and the port is correct (HEC default: 8088)"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/splunk-api", dependencies=[Depends(require_admin)])
async def test_splunk_api_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Splunk REST API connection for querying logs."""
    config_service = get_config_service()
    api_url = await config_service.get_config("splunk_api_url")
    bearer_token = await config_service.get_config("splunk_bearer_token")
    username = await config_service.get_config("splunk_username")
    password = await config_service.get_config("splunk_password")

    # Fallback to settings
    if not api_url or (not bearer_token and (not username or not password)):
        settings = get_settings()
        api_url = api_url or getattr(settings, "splunk_api_url", None)
        bearer_token = bearer_token or getattr(settings, "splunk_bearer_token", None)
        username = username or getattr(settings, "splunk_username", None)
        password = password or getattr(settings, "splunk_password", None)

    if not api_url:
        return {
            "success": False,
            "message": "Splunk API URL not configured"
        }
    if not bearer_token and (not username or not password):
        return {
            "success": False,
            "message": "Configure either Bearer Token OR Username/Password"
        }

    try:
        # Test by getting server info
        info_url = f"{api_url.rstrip('/')}/services/server/info"
        # Read verify_ssl from database config (not settings.py which reads .env)
        verify_ssl_config = await config_service.get_config("splunk_verify_ssl")
        if verify_ssl_config is not None:
            verify_ssl = str(verify_ssl_config).lower() in ('true', '1', 'yes')
        else:
            is_localhost = 'localhost' in api_url or '127.0.0.1' in api_url
            verify_ssl = not is_localhost
        async with httpx.AsyncClient(verify=verify_ssl, timeout=10.0) as client:
            if bearer_token:
                # Splunk auth tokens use "Splunk {token}" format (not "Bearer")
                response = await client.get(
                    info_url,
                    headers={"Authorization": f"Splunk {bearer_token}"},
                    params={"output_mode": "json"}
                )
            else:
                # Use basic auth
                response = await client.get(
                    info_url,
                    auth=(username, password),
                    params={"output_mode": "json"}
                )

        if response.status_code == 200:
            try:
                data = response.json()
                server_name = data.get("entry", [{}])[0].get("content", {}).get("serverName", "Unknown")
                version = data.get("entry", [{}])[0].get("content", {}).get("version", "Unknown")
                auth_type = "Bearer token" if bearer_token else "username/password"
                return {
                    "success": True,
                    "message": f"Connected to Splunk REST API ({server_name}, v{version}) via {auth_type}"
                }
            except Exception:
                return {
                    "success": True,
                    "message": "Connected to Splunk REST API"
                }
        elif response.status_code == 401:
            auth_type = "Bearer token" if bearer_token else "username/password"
            return {
                "success": False,
                "message": f"Invalid credentials - check your {auth_type}"
            }
        else:
            return {
                "success": False,
                "message": f"Splunk returned status {response.status_code}"
            }

    except httpx.ConnectError:
        return {
            "success": False,
            "message": "Connection refused - check if Splunk is running and port 8089 is accessible"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/thousandeyes", dependencies=[Depends(require_admin)])
async def test_thousandeyes_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test ThousandEyes API connection with current credentials."""
    config_service = get_config_service()
    oauth_token = await config_service.get_config("thousandeyes_oauth_token")

    if not oauth_token:
        settings = get_settings()
        oauth_token = getattr(settings, "thousandeyes_oauth_token", None)

    if not oauth_token:
        return {
            "success": False,
            "message": "ThousandEyes credentials not configured"
        }

    try:
        # Test with account groups endpoint
        async with httpx.AsyncClient(verify=get_settings().thousandeyes_verify_ssl, timeout=10.0) as client:
            response = await client.get(
                "https://api.thousandeyes.com/v7/account-groups",
                headers={"Authorization": f"Bearer {oauth_token}"}
            )

        if response.status_code == 200:
            data = response.json()
            account_count = len(data.get("accountGroups", []))
            return {
                "success": True,
                "message": f"Connected to ThousandEyes ({account_count} account groups)"
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid OAuth token - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"ThousandEyes returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/catalyst", dependencies=[Depends(require_admin)])
async def test_catalyst_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Catalyst Center connection with current credentials."""
    config_service = get_config_service()
    host = await config_service.get_config("catalyst_center_host")
    username = await config_service.get_config("catalyst_center_username")
    password = await config_service.get_config("catalyst_center_password")

    if not host:
        settings = get_settings()
        host = getattr(settings, "catalyst_center_host", None)
        username = username or getattr(settings, "catalyst_center_username", None)
        password = password or getattr(settings, "catalyst_center_password", None)

    if not host or not username or not password:
        return {
            "success": False,
            "message": "Catalyst Center credentials not configured"
        }

    try:
        import base64
        auth_string = f"{username}:{password}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()

        # Get auth token
        async with httpx.AsyncClient(verify=get_settings().catalyst_verify_ssl, timeout=10.0) as client:
            response = await client.post(
                f"{host.rstrip('/')}/dna/system/api/v1/auth/token",
                headers={"Authorization": f"Basic {encoded_auth}"}
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Connected to Catalyst Center successfully"
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "message": "Invalid credentials - authentication failed"
            }
        else:
            return {
                "success": False,
                "message": f"Catalyst Center returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/slack", dependencies=[Depends(require_admin)])
async def test_slack_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Slack webhook by sending a test message."""
    config_service = get_config_service()
    webhook_url = await config_service.get_config("slack_webhook_url")

    if not webhook_url:
        settings = get_settings()
        webhook_url = getattr(settings, "slack_webhook_url", None)

    if not webhook_url:
        return {
            "success": False,
            "message": "Slack webhook URL not configured"
        }

    try:
        async with httpx.AsyncClient(verify=get_settings().verify_ssl, timeout=10.0) as client:
            response = await client.post(
                webhook_url,
                json={
                    "text": ":white_check_mark: *Cisco AIOps Hub Connection Test*\nThis is a test message from your Cisco AIOps Hub configuration."
                }
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Test message sent to Slack successfully"
            }
        elif response.status_code == 404:
            return {
                "success": False,
                "message": "Invalid webhook URL - channel not found"
            }
        else:
            return {
                "success": False,
                "message": f"Slack returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/teams", dependencies=[Depends(require_admin)])
async def test_teams_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test Microsoft Teams webhook by sending a test message."""
    config_service = get_config_service()
    webhook_url = await config_service.get_config("teams_webhook_url")

    if not webhook_url:
        settings = get_settings()
        webhook_url = getattr(settings, "teams_webhook_url", None)

    if not webhook_url:
        return {
            "success": False,
            "message": "Teams webhook URL not configured"
        }

    try:
        async with httpx.AsyncClient(verify=get_settings().verify_ssl, timeout=10.0) as client:
            response = await client.post(
                webhook_url,
                json={
                    "@type": "MessageCard",
                    "@context": "http://schema.org/extensions",
                    "themeColor": "0076D7",
                    "summary": "Cisco AIOps Hub Test",
                    "sections": [{
                        "activityTitle": "Connection Test",
                        "facts": [{
                            "name": "Status",
                            "value": "Test message from Cisco AIOps Hub"
                        }],
                        "markdown": True
                    }]
                }
            )

        if response.status_code == 200:
            return {
                "success": True,
                "message": "Test message sent to Teams successfully"
            }
        elif response.status_code == 404:
            return {
                "success": False,
                "message": "Invalid webhook URL - connector not found"
            }
        else:
            return {
                "success": False,
                "message": f"Teams returned status {response.status_code}"
            }

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/api/admin/config/test/email", dependencies=[Depends(require_admin)])
async def test_email_connection(
    user: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Test SMTP connection by attempting to connect to the server."""
    import smtplib
    import ssl

    config_service = get_config_service()
    smtp_host = await config_service.get_config("smtp_host")
    smtp_port = await config_service.get_config("smtp_port")
    smtp_user = await config_service.get_config("smtp_user")
    smtp_password = await config_service.get_config("smtp_password")

    if not smtp_host:
        settings = get_settings()
        smtp_host = getattr(settings, "smtp_host", None)
        smtp_port = smtp_port or getattr(settings, "smtp_port", "587")
        smtp_user = smtp_user or getattr(settings, "smtp_user", None)
        smtp_password = smtp_password or getattr(settings, "smtp_password", None)

    if not smtp_host:
        return {
            "success": False,
            "message": "SMTP server not configured"
        }

    try:
        port = int(smtp_port) if smtp_port else 587
        context = ssl.create_default_context()

        # Try STARTTLS connection
        with smtplib.SMTP(smtp_host, port, timeout=10) as server:
            server.starttls(context=context)
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)

        return {
            "success": True,
            "message": f"Connected to SMTP server {smtp_host}:{port} successfully"
        }

    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "message": "SMTP authentication failed - check username/password"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }
