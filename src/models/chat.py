"""Chat conversation models for storing chat history."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base


class ChatConversation(Base):
    """Model for chat conversations."""

    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)  # Auto-generated from first message
    organization = Column(String(255), nullable=True)  # None for multi-org chats
    user_id = Column(String(255), default="web-user", nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    last_activity = Column(DateTime, default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ChatConversation(id={self.id}, title='{self.title}', organization='{self.organization}')>"

    def to_dict(self) -> dict:
        """Convert conversation to dictionary.

        Returns:
            Dictionary representation of conversation
        """
        return {
            "id": self.id,
            "title": self.title,
            "organization": self.organization,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "is_active": self.is_active,
            "message_count": len(self.messages) if self.messages else 0,
        }


class ChatMessage(Base):
    """Model for individual chat messages."""

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id"), nullable=False)
    role = Column(String(50), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    message_metadata = Column(JSON, nullable=True)  # Store tools_used, action_taken, etc.
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationship to conversation
    conversation = relationship("ChatConversation", back_populates="messages")

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>"

    def to_dict(self) -> dict:
        """Convert message to dictionary.

        Returns:
            Dictionary representation of message
        """
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "metadata": self.message_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
