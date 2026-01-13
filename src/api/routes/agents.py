"""API routes for agent services (A2A agents)."""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, Optional

from src.api.dependencies import require_viewer
from src.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


class CardGenerationRequest(BaseModel):
    """Request model for card generation."""
    data: Any
    context: Optional[str] = ""
    preferredCardType: Optional[str] = None


class CardGenerationResponse(BaseModel):
    """Response model for card generation."""
    success: bool
    card: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("/api/agents/card-generator", response_model=CardGenerationResponse)
async def generate_card(
    request: CardGenerationRequest,
    user: User = Depends(require_viewer)
):
    """
    Generate a UI card configuration from data using the Claude-based Card Generator Agent.

    This endpoint interfaces with the CardGeneratorAgent which uses Claude to analyze
    data and output appropriate card configurations for frontend rendering.
    """
    try:
        # Import the card generator agent
        from src.a2a.card_generator_agent import get_card_generator_agent

        agent = get_card_generator_agent()

        # Generate the card configuration
        result = await agent.generate_card(
            data=request.data,
            context=request.context or "",
            preferred_type=request.preferredCardType,
        )

        if result.get("success"):
            logger.info(f"[CardGenerator] Generated card: {result['card'].get('cardType')} - {result['card'].get('title')}")
            return CardGenerationResponse(
                success=True,
                card=result["card"],
            )
        else:
            logger.warning(f"[CardGenerator] Generation failed: {result.get('error')}")
            return CardGenerationResponse(
                success=False,
                card=result.get("card"),  # Fallback card may still be provided
                error=result.get("error"),
            )

    except ImportError as e:
        logger.error(f"[CardGenerator] Failed to import agent: {e}")
        return CardGenerationResponse(
            success=False,
            error="Card generator agent not available",
        )
    except Exception as e:
        logger.error(f"[CardGenerator] Error generating card: {e}")
        return CardGenerationResponse(
            success=False,
            error=str(e),
        )


@router.get("/api/agents/status")
async def get_agents_status(user: User = Depends(require_viewer)):
    """
    Get status of all registered A2A agents.
    """
    try:
        from src.a2a.registry import get_agent_registry

        registry = get_agent_registry()
        agents = registry.get_all_agents()

        return {
            "success": True,
            "agents": [
                {
                    "id": agent.id,
                    "name": agent.name,
                    "description": agent.description,
                    "skills": [skill.name for skill in agent.skills],
                    "role": agent.role,
                }
                for agent in agents
            ],
            "total": len(agents),
        }
    except Exception as e:
        logger.error(f"[Agents] Error getting agent status: {e}")
        return {
            "success": False,
            "error": str(e),
            "agents": [],
            "total": 0,
        }
