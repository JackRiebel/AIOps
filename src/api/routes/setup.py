"""Setup wizard API routes for first-run configuration."""

import logging
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from src.services.setup_service import get_setup_service, ensure_encryption_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/setup", tags=["setup"])


# Request/Response Models
class SetupStatusResponse(BaseModel):
    """Response model for setup status."""
    setup_required: bool
    setup_complete: bool
    current_step: Optional[str]
    steps: dict


class GenerateKeyRequest(BaseModel):
    """Request to generate or set encryption key."""
    key: Optional[str] = Field(None, description="Custom encryption key (will generate if not provided)")
    save_to_file: bool = Field(True, description="Save key to data/.encryption_key file")


class CreateAdminRequest(BaseModel):
    """Request to create admin user."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)


class SaveAIKeyRequest(BaseModel):
    """Request to save AI provider API key."""
    provider: str = Field(..., description="Provider: anthropic, openai, google, cisco")
    api_key: str = Field(..., min_length=10, description="API key or Client ID for Cisco")
    client_secret: Optional[str] = Field(None, description="Client Secret (Cisco only)")
    app_key: Optional[str] = Field(None, description="App Key (Cisco only)")


class TestAIKeyRequest(BaseModel):
    """Request to test AI provider API key."""
    provider: str
    api_key: str
    client_secret: Optional[str] = None
    app_key: Optional[str] = None


@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status():
    """Get current setup status.

    This endpoint is publicly accessible (no auth required) to allow
    the setup wizard to check if setup is needed.

    Returns:
        Setup status including which steps are complete
    """
    setup_service = get_setup_service()
    status = await setup_service.get_setup_status()
    return status


@router.post("/encryption-key")
async def setup_encryption_key(request: GenerateKeyRequest):
    """Generate or set the encryption key.

    If no key is provided, a new one will be generated.
    The key can be saved to a file for persistence across restarts.

    This endpoint is only accessible during setup (no admin user exists).
    """
    setup_service = get_setup_service()

    # Verify we're in setup mode (no admin exists)
    status = await setup_service.get_setup_status()
    if status["steps"]["admin"]["completed"]:
        # Admin exists, require authentication for this
        raise HTTPException(
            status_code=403,
            detail="Setup already complete. Use admin settings to change encryption key."
        )

    # Generate key if not provided
    key = request.key
    if not key:
        key = setup_service.generate_encryption_key()

    # Save the key
    result = setup_service.save_encryption_key(key, save_to_file=request.save_to_file)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "success": True,
        "key": key,  # Return key so user can back it up
        "locations": result["locations"],
        "message": "Encryption key configured. IMPORTANT: Back up this key securely!",
        "warning": "If you lose this key, all encrypted data will be unrecoverable.",
    }


@router.post("/admin")
async def create_admin_user(request: CreateAdminRequest):
    """Create the first admin user.

    This endpoint is only accessible during setup (no admin user exists yet).
    """
    setup_service = get_setup_service()

    # Verify we're in setup mode
    status = await setup_service.get_setup_status()
    if status["steps"]["admin"]["completed"]:
        raise HTTPException(
            status_code=403,
            detail="Admin user already exists. Use admin panel to create additional users."
        )

    # Ensure encryption is set up first
    if not status["steps"]["encryption"]["completed"]:
        # Auto-generate encryption key if not set
        ensure_encryption_key()

    result = await setup_service.create_admin_user(
        username=request.username,
        email=request.email,
        password=request.password
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "success": True,
        "user": result["user"],
        "message": "Admin user created successfully",
    }


@router.post("/ai-key")
async def save_ai_provider_key(request: SaveAIKeyRequest):
    """Save an AI provider API key.

    This endpoint is only accessible during setup (no admin exists)
    or requires admin authentication after setup.
    """
    setup_service = get_setup_service()

    # Verify setup mode or admin auth
    status = await setup_service.get_setup_status()

    # If setup is complete, this should require auth (handled elsewhere)
    # During setup, allow without auth
    if status["setup_complete"]:
        raise HTTPException(
            status_code=403,
            detail="Setup complete. Use admin settings to manage API keys."
        )

    # Ensure encryption is set up
    if not status["steps"]["encryption"]["completed"]:
        ensure_encryption_key()

    # Validate provider
    valid_providers = ["anthropic", "openai", "google", "cisco"]
    if request.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}"
        )

    # Cisco requires additional fields
    if request.provider == "cisco":
        if not request.client_secret or not request.app_key:
            raise HTTPException(
                status_code=400,
                detail="Cisco Circuit requires client_id (api_key), client_secret, and app_key"
            )

    try:
        result = await setup_service.save_ai_provider_key(
            provider=request.provider,
            api_key=request.api_key,
            client_secret=request.client_secret,
            app_key=request.app_key
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save AI provider key: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save API key: {str(e)}"
        )


@router.post("/test-ai-key")
async def test_ai_provider_key(request: TestAIKeyRequest):
    """Test an AI provider API key before saving.

    Makes a simple API call to verify the key works.
    """
    provider = request.provider.lower()

    try:
        if provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=request.api_key)
            # Simple test - list models or make minimal request
            response = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return {"success": True, "message": "Anthropic API key is valid"}

        elif provider == "openai":
            import openai
            client = openai.OpenAI(api_key=request.api_key)
            # Test by listing models
            models = client.models.list()
            return {"success": True, "message": "OpenAI API key is valid"}

        elif provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=request.api_key)
            # Test by listing models
            models = list(genai.list_models())
            return {"success": True, "message": "Google API key is valid"}

        elif provider == "cisco":
            if not request.client_secret or not request.app_key:
                raise HTTPException(
                    status_code=400,
                    detail="Client secret and app key are required for Cisco Circuit"
                )

            # Test Cisco Circuit OAuth
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://id.cisco.com/oauth2/default/v1/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": request.api_key,
                        "client_secret": request.client_secret,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                if response.status_code == 200:
                    return {"success": True, "message": "Cisco Circuit credentials are valid"}
                else:
                    return {"success": False, "message": f"Cisco auth failed: {response.text}"}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"API key test failed for {provider}: {e}")
        return {
            "success": False,
            "message": f"API key test failed: {str(e)}"
        }


@router.post("/complete")
async def complete_setup():
    """Verify setup is complete and finalize.

    Returns success if all required steps are done.
    """
    setup_service = get_setup_service()
    result = await setup_service.complete_setup()

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/database-options")
async def get_database_options():
    """Get available database configuration options.

    Returns information about supported database types.
    """
    return {
        "options": [
            {
                "type": "sqlite",
                "name": "SQLite (Simple)",
                "description": "File-based database, good for single-user or small deployments",
                "default_url": "sqlite+aiosqlite:///./data/lumen.db",
                "requires_server": False,
                "pros": ["No setup required", "Portable", "Good for development"],
                "cons": ["Single writer at a time", "Not suitable for high traffic"],
            },
            {
                "type": "postgresql",
                "name": "PostgreSQL (Recommended)",
                "description": "Full-featured database server, best for production",
                "default_url": "postgresql+asyncpg://user:password@localhost:5432/lumen",
                "requires_server": True,
                "pros": ["Concurrent access", "Scalable", "Full SQL features"],
                "cons": ["Requires database server", "More setup"],
            },
        ],
        "current": {
            "type": "postgresql" if "postgresql" in (await get_setup_service().get_setup_status())["steps"]["database"].get("type", "") else "sqlite",
        }
    }


class TestDatabaseRequest(BaseModel):
    """Request to test database connection."""
    database_url: str = Field(..., description="Database URL to test")


class ConfigureDatabaseRequest(BaseModel):
    """Request to configure database URL."""
    database_url: str = Field(..., description="Database URL to use")


@router.post("/test-database")
async def test_database_connection(request: TestDatabaseRequest):
    """Test a database connection URL.

    Attempts to connect to the specified database and returns success/failure.
    """
    import asyncio
    from sqlalchemy import create_engine, text

    database_url = request.database_url

    try:
        # Convert async URL to sync for testing
        sync_url = database_url.replace("+asyncpg", "").replace("+aiosqlite", "")
        if "postgresql" in sync_url and "+psycopg" not in sync_url:
            sync_url = sync_url.replace("postgresql://", "postgresql+psycopg2://")

        # Test connection in thread pool to not block
        def test_connection():
            engine = create_engine(sync_url, connect_args={"connect_timeout": 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
            return True

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, test_connection)

        return {"success": True, "message": "Database connection successful"}

    except Exception as e:
        logger.warning(f"Database connection test failed: {e}")
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }


@router.post("/database")
async def configure_database(request: ConfigureDatabaseRequest):
    """Configure the database URL.

    Updates the .env file with the new database URL.
    This endpoint is only accessible during setup.
    """
    import os
    from pathlib import Path

    setup_service = get_setup_service()

    # Verify we're in setup mode
    status = await setup_service.get_setup_status()
    if status["setup_complete"]:
        raise HTTPException(
            status_code=403,
            detail="Setup complete. Use admin settings to change database."
        )

    database_url = request.database_url

    # Validate URL format
    if not database_url.startswith(("postgresql://", "sqlite://", "postgresql+asyncpg://", "sqlite+aiosqlite://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid database URL format. Must start with postgresql:// or sqlite://"
        )

    # Update .env file
    env_path = Path(__file__).parent.parent.parent.parent / ".env"

    if not env_path.exists():
        raise HTTPException(
            status_code=500,
            detail=".env file not found"
        )

    try:
        with open(env_path, 'r') as f:
            lines = f.readlines()

        # Find and update DATABASE_URL
        updated = False
        for i, line in enumerate(lines):
            if line.startswith('DATABASE_URL='):
                lines[i] = f"DATABASE_URL={database_url}\n"
                updated = True
                break

        if not updated:
            # Add DATABASE_URL if not found
            lines.append(f"\nDATABASE_URL={database_url}\n")

        with open(env_path, 'w') as f:
            f.writelines(lines)

        # Update environment variable for current process
        os.environ["DATABASE_URL"] = database_url

        logger.info(f"Database URL configured: {database_url.split('@')[0]}@...")

        return {
            "success": True,
            "message": "Database URL configured",
            "type": "postgresql" if "postgresql" in database_url else "sqlite",
            "restart_required": True
        }

    except Exception as e:
        logger.error(f"Failed to configure database: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update configuration: {str(e)}"
        )


class SaveOAuthRequest(BaseModel):
    """Request to save OAuth settings."""
    google_client_id: str = Field(..., min_length=10, description="Google OAuth Client ID")
    google_client_secret: str = Field(..., min_length=10, description="Google OAuth Client Secret")


@router.post("/oauth")
async def save_oauth_settings(request: SaveOAuthRequest):
    """Save OAuth settings (Google OAuth).

    Updates the .env file with OAuth credentials.
    This endpoint is only accessible during setup.
    """
    import os
    from pathlib import Path

    setup_service = get_setup_service()

    # Verify we're in setup mode or allow anyway (OAuth is optional)
    status = await setup_service.get_setup_status()
    if status["setup_complete"]:
        raise HTTPException(
            status_code=403,
            detail="Setup complete. Use admin settings to change OAuth configuration."
        )

    # Update .env file
    env_path = Path(__file__).parent.parent.parent.parent / ".env"

    if not env_path.exists():
        raise HTTPException(
            status_code=500,
            detail=".env file not found"
        )

    try:
        with open(env_path, 'r') as f:
            lines = f.readlines()

        # Find and update OAuth settings
        client_id_found = False
        client_secret_found = False

        for i, line in enumerate(lines):
            if line.startswith('GOOGLE_OAUTH_CLIENT_ID='):
                lines[i] = f"GOOGLE_OAUTH_CLIENT_ID={request.google_client_id}\n"
                client_id_found = True
            elif line.startswith('GOOGLE_OAUTH_CLIENT_SECRET='):
                lines[i] = f"GOOGLE_OAUTH_CLIENT_SECRET={request.google_client_secret}\n"
                client_secret_found = True

        # Add settings if not found
        if not client_id_found:
            lines.append(f"\nGOOGLE_OAUTH_CLIENT_ID={request.google_client_id}\n")
        if not client_secret_found:
            lines.append(f"GOOGLE_OAUTH_CLIENT_SECRET={request.google_client_secret}\n")

        with open(env_path, 'w') as f:
            f.writelines(lines)

        # Update environment variables for current process
        os.environ["GOOGLE_OAUTH_CLIENT_ID"] = request.google_client_id
        os.environ["GOOGLE_OAUTH_CLIENT_SECRET"] = request.google_client_secret

        logger.info("Google OAuth configured successfully")

        return {
            "success": True,
            "message": "Google OAuth configured successfully",
        }

    except Exception as e:
        logger.error(f"Failed to configure OAuth: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update OAuth configuration: {str(e)}"
        )


class SaveIntegrationsRequest(BaseModel):
    """Request to save multiple integrations at once."""
    integrations: dict = Field(..., description="Dictionary of integration key-value pairs")


@router.post("/integrations")
async def save_integrations(request: SaveIntegrationsRequest):
    """Save multiple integration configurations at once.

    This endpoint saves integration API keys and credentials to the database.
    This endpoint is only accessible during setup.
    """
    from src.services.config_service import ConfigService

    logger.info(f"Saving integrations: {list(request.integrations.keys())}")

    setup_service = get_setup_service()

    # Check setup status - but allow integrations even after "core" setup is complete
    # since integrations are optional and can be configured during the setup wizard
    # even after admin/AI provider steps are done
    status = await setup_service.get_setup_status()

    # Only block if there's already an admin AND we're not in the setup flow
    # For now, allow integrations to be saved during setup wizard
    # The frontend setup wizard will handle the flow
    admin_exists = status["steps"]["admin"]["completed"]
    if not admin_exists:
        raise HTTPException(
            status_code=403,
            detail="Admin user must be created before configuring integrations."
        )

    # Always ensure encryption is set up before saving sensitive data
    encryption_key = ensure_encryption_key()
    logger.info(f"Encryption key available: {bool(encryption_key)}")

    config_service = ConfigService()
    saved = []
    errors = []

    # Map of integration keys to their config names
    valid_keys = {
        "meraki_api_key": "meraki_api_key",
        "thousandeyes_oauth_token": "thousandeyes_oauth_token",
        "splunk_host": "splunk_host",
        "splunk_api_url": "splunk_api_url",
        "splunk_hec_token": "splunk_hec_token",
        "splunk_bearer_token": "splunk_bearer_token",
        "catalyst_center_host": "catalyst_center_host",
        "catalyst_center_username": "catalyst_center_username",
        "catalyst_center_password": "catalyst_center_password",
        "google_oauth_client_id": "google_oauth_client_id",
        "google_oauth_client_secret": "google_oauth_client_secret",
    }

    for key, value in request.integrations.items():
        if key not in valid_keys:
            logger.warning(f"Unknown integration key: {key}")
            errors.append(f"Unknown integration key: {key}")
            continue

        if not value:
            continue  # Skip empty values

        try:
            logger.info(f"Saving config: {key}")
            await config_service.set_config(valid_keys[key], value)
            saved.append(key)
            logger.info(f"Successfully saved: {key}")
        except Exception as e:
            logger.exception(f"Failed to save {key}: {e}")
            errors.append(f"Failed to save {key}: {str(e)}")

    if errors and not saved:
        error_msg = f"Failed to save integrations: {'; '.join(errors)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )

    # Reset credential pool if any platform credentials were saved
    # This ensures the singleton picks up newly saved credentials
    credential_keys = {"meraki_api_key", "thousandeyes_oauth_token", "splunk_api_url",
                       "splunk_bearer_token", "catalyst_center_host"}
    if any(key in credential_keys for key in saved):
        from src.services.credential_pool import reset_credential_pool
        reset_credential_pool()
        logger.info("Reset credential pool to pick up new credentials from setup")

    logger.info(f"Saved {len(saved)} integrations successfully")
    return {
        "success": True,
        "saved": saved,
        "errors": errors if errors else None,
        "message": f"Saved {len(saved)} integration(s) successfully",
    }
