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
from src.services.config_service import get_config_service

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
    1. Admin has configured the provider's API key (system-wide via database or env), OR
    2. User has provided their own API key for that provider
    """
    settings = get_settings()
    all_models = settings.available_models
    available = []

    # Check database for admin-configured keys (setup wizard saves to database)
    config_service = get_config_service()
    db_anthropic_key = await config_service.get_config("anthropic_api_key")
    db_openai_key = await config_service.get_config("openai_api_key")
    db_google_key = await config_service.get_config("google_api_key")
    db_cisco_client_id = await config_service.get_config("cisco_circuit_client_id")
    db_cisco_client_secret = await config_service.get_config("cisco_circuit_client_secret")

    # Check which providers have keys (database, env, or user)
    has_anthropic = bool(db_anthropic_key or settings.anthropic_api_key or user.user_anthropic_api_key)
    has_openai = bool(db_openai_key or settings.openai_api_key or user.user_openai_api_key)
    has_google = bool(db_google_key or settings.google_api_key or user.user_google_api_key)
    has_cisco = bool(
        (db_cisco_client_id and db_cisco_client_secret) or
        (settings.cisco_circuit_client_id and settings.cisco_circuit_client_secret) or
        (user.user_cisco_client_id and user.user_cisco_client_secret)
    )

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
    """Get current user's preferred AI model.

    If user has no preferred model set, returns the first available model
    from a configured provider.
    """
    if user.preferred_model:
        return {"model": user.preferred_model}

    # No preferred model set - find the first available model
    settings = get_settings()
    all_models = settings.available_models
    config_service = get_config_service()

    # Check database for admin-configured keys
    db_anthropic_key = await config_service.get_config("anthropic_api_key")
    db_openai_key = await config_service.get_config("openai_api_key")
    db_google_key = await config_service.get_config("google_api_key")
    db_cisco_client_id = await config_service.get_config("cisco_circuit_client_id")
    db_cisco_client_secret = await config_service.get_config("cisco_circuit_client_secret")

    # Return first available model based on configured provider (Cisco priority)
    if db_cisco_client_id and db_cisco_client_secret or (settings.cisco_circuit_client_id and settings.cisco_circuit_client_secret):
        return {"model": all_models["cisco"][0]["id"]}
    if db_anthropic_key or settings.anthropic_api_key or user.user_anthropic_api_key:
        return {"model": all_models["anthropic"][0]["id"]}
    if db_openai_key or settings.openai_api_key or user.user_openai_api_key:
        return {"model": all_models["openai"][0]["id"]}
    if db_google_key or settings.google_api_key or user.user_google_api_key:
        return {"model": all_models["google"][0]["id"]}

    # Fallback to Claude if nothing is configured (will show error when actually used)
    return {"model": "claude-sonnet-4-5-20250929"}


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

    # Check database for admin-configured keys (setup wizard saves to database)
    config_service = get_config_service()
    db_anthropic_key = await config_service.get_config("anthropic_api_key")
    db_openai_key = await config_service.get_config("openai_api_key")
    db_google_key = await config_service.get_config("google_api_key")
    db_cisco_client_id = await config_service.get_config("cisco_circuit_client_id")
    db_cisco_client_secret = await config_service.get_config("cisco_circuit_client_secret")

    return {
        "anthropic": {
            "user_key_set": bool(user.user_anthropic_api_key),
            "admin_key_available": bool(db_anthropic_key or settings.anthropic_api_key),
        },
        "openai": {
            "user_key_set": bool(user.user_openai_api_key),
            "admin_key_available": bool(db_openai_key or settings.openai_api_key),
        },
        "google": {
            "user_key_set": bool(user.user_google_api_key),
            "admin_key_available": bool(db_google_key or settings.google_api_key),
        },
        "cisco": {
            "user_key_set": bool(user.user_cisco_client_id and user.user_cisco_client_secret),
            "admin_key_available": bool(
                (db_cisco_client_id and db_cisco_client_secret) or
                (settings.cisco_circuit_client_id and settings.cisco_circuit_client_secret)
            ),
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


# ==============================================================================
# Agentic RAG Settings Endpoints
# ==============================================================================


class AgenticRAGSettingsRequest(BaseModel):
    """Request model for updating agentic RAG settings."""
    enabled: Optional[bool] = None
    max_iterations: Optional[int] = Field(None, ge=1, le=5)
    timeout_seconds: Optional[float] = Field(None, ge=5, le=60)
    query_analysis_enabled: Optional[bool] = None
    document_grading_enabled: Optional[bool] = None
    reflection_enabled: Optional[bool] = None
    web_search_enabled: Optional[bool] = None
    debug_mode: Optional[bool] = None


@router.get("/api/settings/agentic-rag", dependencies=[Depends(require_viewer)])
async def get_agentic_rag_settings():
    """Get current agentic RAG configuration settings.

    Returns the current configuration for the agentic RAG pipeline,
    including which agents are enabled and performance settings.
    """
    try:
        from src.services.agentic_rag import get_agentic_rag_config
        from src.services.agentic_rag.orchestrator import get_agentic_rag_orchestrator

        config = get_agentic_rag_config()
        orchestrator = get_agentic_rag_orchestrator()

        return {
            "success": True,
            "settings": {
                "enabled": config.enabled,
                "max_iterations": config.max_iterations,
                "timeout_seconds": config.total_timeout_seconds,
                "query_analysis_enabled": config.query_analysis_enabled,
                "document_grading_enabled": config.document_grading_enabled,
                "reflection_enabled": config.reflection_enabled,
                "web_search_enabled": config.web_search_enabled,
                "debug_mode": config.debug_mode,
            },
            "status": {
                "orchestrator_initialized": orchestrator is not None,
                "available_providers": list(orchestrator.llm_service.adapters.keys()) if orchestrator and orchestrator.llm_service else [],
            }
        }
    except ImportError:
        return {
            "success": True,
            "settings": {
                "enabled": False,
                "max_iterations": 2,
                "timeout_seconds": 15,
                "query_analysis_enabled": True,
                "document_grading_enabled": True,
                "reflection_enabled": True,
                "web_search_enabled": False,
                "debug_mode": False,
            },
            "status": {
                "orchestrator_initialized": False,
                "available_providers": [],
                "message": "Agentic RAG module not available",
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get agentic RAG settings: {str(e)}"
        )


@router.put("/api/settings/agentic-rag", dependencies=[Depends(require_viewer)])
async def update_agentic_rag_settings(request: AgenticRAGSettingsRequest):
    """Update agentic RAG configuration settings.

    Updates are persisted to the database and take effect immediately.
    Note: Some changes may require reinitializing the orchestrator.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        from src.services.config_service import ConfigService

        config_service = ConfigService()
        updated = []

        # Map request fields to config keys
        field_map = {
            "enabled": "agentic_rag_enabled",
            "max_iterations": "agentic_rag_max_iterations",
            "timeout_seconds": "agentic_rag_timeout",
            "query_analysis_enabled": "agentic_rag_query_analysis",
            "document_grading_enabled": "agentic_rag_document_grading",
            "reflection_enabled": "agentic_rag_reflection",
            "web_search_enabled": "agentic_rag_web_search",
            "debug_mode": "agentic_rag_debug",
        }

        for field, config_key in field_map.items():
            value = getattr(request, field, None)
            if value is not None:
                await config_service.set_config(
                    key=config_key,
                    value=str(value).lower() if isinstance(value, bool) else str(value),
                )
                updated.append(field)

        # Reinitialize config from database
        try:
            from src.services.agentic_rag import init_agentic_rag_config

            async with db.session() as session:
                new_config = await init_agentic_rag_config(session)

                # If enabling/disabling, may need to reinitialize orchestrator
                if "enabled" in updated and new_config.enabled:
                    from src.services.agentic_rag import (
                        init_agentic_rag_orchestrator,
                        init_agentic_rag_llm_service,
                        get_agentic_rag_llm_service,
                    )
                    from src.services.knowledge_service import get_knowledge_service

                    llm_service = get_agentic_rag_llm_service()

                    # If LLM service doesn't exist, try to initialize from database/env keys
                    if not llm_service:
                        settings = get_settings()
                        openai_key = getattr(settings, 'openai_api_key', None) or None
                        anthropic_key = getattr(settings, 'anthropic_api_key', None) or None
                        google_key = getattr(settings, 'google_api_key', None) or None

                        # Check database for API keys
                        if not openai_key:
                            openai_key = await config_service.get_config("openai_api_key")
                        if not anthropic_key:
                            anthropic_key = await config_service.get_config("anthropic_api_key")
                        if not google_key:
                            google_key = await config_service.get_config("google_api_key")

                        if openai_key or anthropic_key or google_key:
                            llm_service = init_agentic_rag_llm_service(
                                openai_key=openai_key,
                                anthropic_key=anthropic_key,
                                google_key=google_key,
                                default_provider="openai" if openai_key else ("anthropic" if anthropic_key else "google"),
                            )

                    if llm_service:
                        knowledge_service = get_knowledge_service()
                        await init_agentic_rag_orchestrator(
                            session=session,
                            llm_service=llm_service,
                            knowledge_service=knowledge_service,
                        )
        except ImportError:
            pass
        except Exception as e:
            # Log but don't fail - settings were already saved
            logger.warning(f"Failed to reinitialize agentic RAG: {e}")

        return {
            "success": True,
            "updated_fields": updated,
            "message": f"Updated {len(updated)} settings" if updated else "No settings changed",
        }
    except Exception as e:
        logger.error(f"Failed to save agentic RAG settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")


@router.get("/api/settings/agentic-rag/status", dependencies=[Depends(require_viewer)])
async def get_agentic_rag_status():
    """Get detailed status of the agentic RAG pipeline.

    Includes information about agent initialization, LLM providers,
    and recent performance metrics.
    """
    try:
        from src.services.agentic_rag import (
            get_agentic_rag_config,
            get_agentic_rag_llm_service,
        )
        from src.services.agentic_rag.orchestrator import get_agentic_rag_orchestrator

        config = get_agentic_rag_config()
        orchestrator = get_agentic_rag_orchestrator()
        llm_service = get_agentic_rag_llm_service()

        agents_status = {}
        if orchestrator:
            agents_status = {
                "query_analyzer": {
                    "enabled": orchestrator.query_analyzer.enabled,
                    "name": orchestrator.query_analyzer.name,
                },
                "retrieval_router": {
                    "enabled": orchestrator.retrieval_router.enabled,
                    "name": orchestrator.retrieval_router.name,
                },
                "document_grader": {
                    "enabled": orchestrator.document_grader.enabled,
                    "name": orchestrator.document_grader.name,
                },
                "corrective_rag": {
                    "enabled": orchestrator.corrective_rag.enabled,
                    "name": orchestrator.corrective_rag.name,
                },
                "synthesizer": {
                    "enabled": orchestrator.synthesizer.enabled,
                    "name": orchestrator.synthesizer.name,
                },
                "reflector": {
                    "enabled": orchestrator.reflector.enabled,
                    "name": orchestrator.reflector.name,
                },
            }

        llm_status = {}
        if llm_service:
            usage = llm_service.get_usage_stats()
            llm_status = {
                "providers": list(llm_service.adapters.keys()),
                "default_provider": llm_service.default_provider,
                "usage": usage,
            }

        return {
            "success": True,
            "pipeline_enabled": config.enabled,
            "orchestrator_ready": orchestrator is not None,
            "agents": agents_status,
            "llm": llm_status,
            "config": config.to_dict(),
        }

    except ImportError:
        return {
            "success": True,
            "pipeline_enabled": False,
            "orchestrator_ready": False,
            "agents": {},
            "llm": {},
            "config": {},
            "message": "Agentic RAG module not available",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get agentic RAG status: {str(e)}"
        )
