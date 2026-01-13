"""Pydantic models for network management."""

from typing import Optional, List, Any
from pydantic import BaseModel


class NetworkListRequest(BaseModel):
    """Request model for network resource listing."""
    organization: str
    resource: str = "networks"  # 'networks' or 'devices'
    force_refresh: bool = False  # Force refresh from API instead of using cache


class ChatRequest(BaseModel):
    """Request model for AI chat."""
    organization: Optional[str] = None  # If None, query all organizations
    message: str
    history: Optional[List[dict]] = []
    conversation_id: Optional[int] = None  # If None, create new conversation


class ChatResponse(BaseModel):
    """Response model for AI chat."""
    response: str
    action_taken: Optional[str] = None
    conversation_id: Optional[int] = None
    data: Optional[Any] = None  # Tool result data to display (can be dict, list, or any JSON type)
