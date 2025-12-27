"""API routes for user settings including AI model selection, API keys, and preferences."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from typing import Optional, List
from cryptography.fernet import Fernet
from src.api.dependencies import require_viewer
from src.config.database import get_db
from src.config.settings import get_settings
from src.config.model_pricing import get_all_pricing, get_model_pricing, MODEL_PRICING
from src.models.user import User

router = APIRouter()

# Database instance
db = get_db()


class ModelUpdateRequest(BaseModel):
    """Request model for updating preferred model."""
    model_id: str


class AISettingsUpdateRequest(BaseModel):
    """Request model for updating AI settings (temperature, max_tokens)."""
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=256, le=32000)


class APIKeyUpdateRequest(BaseModel):
    """Request model for updating user API keys."""
    provider: str  # anthropic, openai, or google
    api_key: Optional[str] = None  # None or empty string to delete


def _get_encryption_cipher():
    """Get Fernet cipher for encrypting/decrypting API keys."""
    settings = get_settings()
    key = settings.get_encryption_key()
    return Fernet(key)


def _encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage."""
    cipher = _get_encryption_cipher()
    return cipher.encrypt(api_key.encode()).decode()


def _decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage."""
    cipher = _get_encryption_cipher()
    return cipher.decrypt(encrypted_key.encode()).decode()


@router.get("/api/settings/models", dependencies=[Depends(require_viewer)])
async def get_available_models(user: User = Depends(require_viewer)):
    """Get list of available AI models with cost and performance data.

    Models are available if:
    1. Admin has configured the provider's API key (system-wide), OR
    2. User has provided their own API key for that provider
    """
    settings = get_settings()
    all_models = settings.available_models
    available = []

    # Check which providers have keys (admin or user)
    has_anthropic = bool(settings.anthropic_api_key) or bool(user.user_anthropic_api_key)
    has_openai = bool(settings.openai_api_key) or bool(user.user_openai_api_key)
    has_google = bool(settings.google_api_key) or bool(user.user_google_api_key)
    has_cisco = bool(settings.cisco_circuit_client_id and settings.cisco_circuit_client_secret) or bool(user.user_cisco_client_id and user.user_cisco_client_secret)

    if has_anthropic:
        for model in all_models["anthropic"]:
            available.append({
                **model,
                "provider": "anthropic",
                "key_source": "user" if user.user_anthropic_api_key else "admin"
            })

    if has_openai:
        for model in all_models["openai"]:
            available.append({
                **model,
                "provider": "openai",
                "key_source": "user" if user.user_openai_api_key else "admin"
            })

    if has_google:
        for model in all_models["google"]:
            available.append({
                **model,
                "provider": "google",
                "key_source": "user" if user.user_google_api_key else "admin"
            })

    if has_cisco:
        for model in all_models["cisco"]:
            available.append({
                **model,
                "provider": "cisco",
                "key_source": "user" if (user.user_cisco_client_id and user.user_cisco_client_secret) else "admin"
            })

    return {"models": available}


@router.get("/api/settings/model", dependencies=[Depends(require_viewer)])
async def get_user_model(user: User = Depends(require_viewer)):
    """Get current user's preferred AI model."""
    return {
        "model": user.preferred_model or "claude-sonnet-4-5-20250929"
    }


@router.put("/api/settings/model", dependencies=[Depends(require_viewer)])
async def set_user_model(request: ModelUpdateRequest, user: User = Depends(require_viewer)):
    """Update user's preferred AI model."""
    settings = get_settings()
    all_models = settings.available_models

    # Flatten all model IDs
    valid_model_ids = []
    for provider_models in all_models.values():
        for model in provider_models:
            valid_model_ids.append(model["id"])

    if request.model_id not in valid_model_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model ID. Valid models: {valid_model_ids}"
        )

    async with db.session() as session:
        result = await session.execute(
            select(User).where(User.id == user.id)
        )
        db_user = result.scalar_one_or_none()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db_user.preferred_model = request.model_id
        await session.commit()
        await session.refresh(db_user)

        return {
            "success": True,
            "model": db_user.preferred_model
        }


@router.get("/api/settings/ai", dependencies=[Depends(require_viewer)])
async def get_ai_settings(user: User = Depends(require_viewer)):
    """Get user's AI settings (temperature, max_tokens)."""
    return {
        "temperature": user.ai_temperature if user.ai_temperature is not None else 0.7,
        "max_tokens": user.ai_max_tokens if user.ai_max_tokens is not None else 4096,
    }


@router.put("/api/settings/ai", dependencies=[Depends(require_viewer)])
async def update_ai_settings(request: AISettingsUpdateRequest, user: User = Depends(require_viewer)):
    """Update user's AI settings (temperature, max_tokens)."""
    async with db.session() as session:
        result = await session.execute(
            select(User).where(User.id == user.id)
        )
        db_user = result.scalar_one_or_none()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        if request.temperature is not None:
            db_user.ai_temperature = request.temperature
        if request.max_tokens is not None:
            db_user.ai_max_tokens = request.max_tokens

        await session.commit()
        await session.refresh(db_user)

        return {
            "success": True,
            "temperature": db_user.ai_temperature,
            "max_tokens": db_user.ai_max_tokens,
        }


@router.get("/api/settings/api-keys", dependencies=[Depends(require_viewer)])
async def get_api_key_status(user: User = Depends(require_viewer)):
    """Get status of user's API keys (whether they're set, not the actual keys)."""
    settings = get_settings()

    return {
        "anthropic": {
            "user_key_set": bool(user.user_anthropic_api_key),
            "admin_key_available": bool(settings.anthropic_api_key),
        },
        "openai": {
            "user_key_set": bool(user.user_openai_api_key),
            "admin_key_available": bool(settings.openai_api_key),
        },
        "google": {
            "user_key_set": bool(user.user_google_api_key),
            "admin_key_available": bool(settings.google_api_key),
        },
        "cisco": {
            "user_key_set": bool(user.user_cisco_client_id and user.user_cisco_client_secret),
            "admin_key_available": bool(settings.cisco_circuit_client_id and settings.cisco_circuit_client_secret),
        },
    }


class CiscoAPIKeyUpdateRequest(BaseModel):
    """Request model for updating Cisco API keys (requires both client_id and client_secret)."""
    client_id: Optional[str] = None
    client_secret: Optional[str] = None


@router.put("/api/settings/api-keys", dependencies=[Depends(require_viewer)])
async def update_api_key(request: APIKeyUpdateRequest, user: User = Depends(require_viewer)):
    """Update or delete a user's API key for a specific provider."""
    valid_providers = ["anthropic", "openai", "google", "cisco"]
    if request.provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {valid_providers}"
        )

    async with db.session() as session:
        result = await session.execute(
            select(User).where(User.id == user.id)
        )
        db_user = result.scalar_one_or_none()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Determine which field to update
        field_name = f"user_{request.provider}_api_key"

        # Encrypt and store the key, or clear it if empty
        if request.api_key and request.api_key.strip():
            encrypted_key = _encrypt_api_key(request.api_key.strip())
            setattr(db_user, field_name, encrypted_key)
        else:
            setattr(db_user, field_name, None)

        await session.flush()
        await session.refresh(db_user)

        return {
            "success": True,
            "provider": request.provider,
            "key_set": bool(getattr(db_user, field_name)),
        }


@router.put("/api/settings/api-keys/cisco", dependencies=[Depends(require_viewer)])
async def update_cisco_api_keys(request: CiscoAPIKeyUpdateRequest, user: User = Depends(require_viewer)):
    """Update Cisco Circuit AI credentials (requires both client_id and client_secret)."""
    async with db.session() as session:
        result = await session.execute(
            select(User).where(User.id == user.id)
        )
        db_user = result.scalar_one_or_none()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Both must be provided together or both cleared
        if request.client_id and request.client_secret:
            db_user.user_cisco_client_id = _encrypt_api_key(request.client_id.strip())
            db_user.user_cisco_client_secret = _encrypt_api_key(request.client_secret.strip())
        elif not request.client_id and not request.client_secret:
            db_user.user_cisco_client_id = None
            db_user.user_cisco_client_secret = None
        else:
            raise HTTPException(
                status_code=400,
                detail="Both client_id and client_secret must be provided together"
            )

        await session.flush()
        await session.refresh(db_user)

        return {
            "success": True,
            "provider": "cisco",
            "key_set": bool(db_user.user_cisco_client_id and db_user.user_cisco_client_secret),
        }


@router.delete("/api/settings/api-keys/{provider}", dependencies=[Depends(require_viewer)])
async def delete_api_key(provider: str, user: User = Depends(require_viewer)):
    """Delete a user's API key for a specific provider."""
    valid_providers = ["anthropic", "openai", "google", "cisco"]
    if provider not in valid_providers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {valid_providers}"
        )

    async with db.session() as session:
        result = await session.execute(
            select(User).where(User.id == user.id)
        )
        db_user = result.scalar_one_or_none()

        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Handle Cisco specially (has two fields)
        if provider == "cisco":
            db_user.user_cisco_client_id = None
            db_user.user_cisco_client_secret = None
        else:
            field_name = f"user_{provider}_api_key"
            setattr(db_user, field_name, None)

        await session.flush()

        return {
            "success": True,
            "provider": provider,
            "message": f"{provider} API key deleted"
        }


def get_user_api_key(user: User, provider: str) -> Optional[str]:
    """Get decrypted API key for a user and provider.

    Returns the user's key if set, otherwise None.
    This should be used by the AI service to get the appropriate key.
    """
    field_name = f"user_{provider}_api_key"
    encrypted_key = getattr(user, field_name, None)

    if encrypted_key:
        try:
            return _decrypt_api_key(encrypted_key)
        except Exception:
            return None
    return None


# ==============================================================================
# Model Pricing Endpoints (for frontend cost calculation)
# ==============================================================================


@router.get("/api/config/model-pricing")
async def get_model_pricing_config():
    """Get all model pricing for frontend cost calculation.

    This endpoint provides the single source of truth for model pricing,
    eliminating the need for frontend to maintain its own pricing dictionary.

    Returns:
        Dictionary with model IDs as keys and {input, output} pricing per 1M tokens
    """
    return {
        "pricing": get_all_pricing(),
        "default_model": "claude-3-5-haiku-20241022",
    }


@router.get("/api/config/model-pricing/{model_id}")
async def get_single_model_pricing(model_id: str):
    """Get pricing for a specific model.

    Args:
        model_id: The model ID to get pricing for

    Returns:
        Pricing for the requested model (or default if not found)
    """
    pricing = get_model_pricing(model_id)
    is_default = model_id not in MODEL_PRICING

    return {
        "model": model_id,
        "pricing": pricing,
        "is_default": is_default,
    }
