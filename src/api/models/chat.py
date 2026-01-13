"""Pydantic models for chat/conversation management."""

from typing import Optional
from pydantic import BaseModel


class ConversationCreate(BaseModel):
    """Request model for creating a conversation."""
    title: Optional[str] = "New Chat"
    organization: Optional[str] = None


class MessageCreate(BaseModel):
    """Request model for creating a message."""
    role: str
    content: str
    metadata: Optional[dict] = None


class ConversationResponse(BaseModel):
    """Response model for conversation."""
    id: int
    title: str
    organization: Optional[str]
    created_at: str
    updated_at: str
    last_activity: str
    message_count: int


class MessageResponse(BaseModel):
    """Response model for message."""
    id: int
    conversation_id: int
    role: str
    content: str
    metadata: Optional[dict]
    created_at: str
