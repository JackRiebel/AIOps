"""AI cost tracking models."""

from sqlalchemy import Column, Integer, BigInteger, Numeric, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from src.config.database import Base


class AICostLog(Base):
    __tablename__ = "ai_cost_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="SET NULL"))
    user_id = Column(String(255), default="web-user")
    input_tokens = Column(BigInteger, nullable=False)
    output_tokens = Column(BigInteger, nullable=False)
    total_tokens = Column(BigInteger, nullable=False)
    cost_usd = Column(Numeric(12, 8), nullable=False)
    model = Column(String(100), default="claude-3-haiku-20240307")
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Optional relationship (not required for queries)
    # conversation = relationship("ChatConversation", back_populates="cost_logs")
