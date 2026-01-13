"""Multi-turn conversation memory for RAG.

Tracks conversation context across turns, enabling:
- Coreference resolution (understanding "it", "that", etc.)
- Context-aware query augmentation
- Entity tracking across conversation
- Conversation summarization for long sessions

Usage:
    memory = ConversationMemory()
    await memory.add_turn(session_id, query, response, source_ids)
    context = await memory.get_context(session_id)
    augmented = await memory.augment_query(query, context)
"""

import logging
import re
import json
import asyncio
from typing import List, Optional, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class ConversationTurn:
    """A single turn in a conversation."""
    query: str
    response: str
    source_chunk_ids: List[int]
    timestamp: datetime = field(default_factory=datetime.utcnow)
    entities: Dict[str, List[str]] = field(default_factory=dict)
    topics: List[str] = field(default_factory=list)
    turn_index: int = 0


@dataclass
class ConversationContext:
    """Context extracted from conversation history."""
    session_id: str
    turn_count: int
    summary: Optional[str]
    recent_turns: List[ConversationTurn]
    entities_mentioned: Dict[str, List[str]]  # category -> entities
    topics_discussed: List[str]
    referenced_chunks: Set[int]

    def to_prompt_context(self) -> str:
        """Format context for LLM prompt injection."""
        parts = []

        if self.summary:
            parts.append(f"Conversation Summary:\n{self.summary}")

        if self.recent_turns:
            recent_text = []
            for turn in self.recent_turns[-3:]:  # Last 3 turns
                recent_text.append(f"User: {turn.query}")
                # Truncate long responses
                response = turn.response[:500] + "..." if len(turn.response) > 500 else turn.response
                recent_text.append(f"Assistant: {response}")
            parts.append("Recent Conversation:\n" + "\n".join(recent_text))

        if self.entities_mentioned:
            entity_strs = []
            for category, entities in self.entities_mentioned.items():
                entity_strs.append(f"- {category}: {', '.join(entities[:5])}")
            if entity_strs:
                parts.append("Entities Discussed:\n" + "\n".join(entity_strs))

        return "\n\n".join(parts)


@dataclass
class QueryAugmentation:
    """Result of query augmentation with context."""
    original_query: str
    augmented_query: str
    resolved_references: Dict[str, str]  # pronoun -> resolved entity
    added_context: List[str]
    confidence: float


class ConversationMemory:
    """Manage multi-turn conversation context for RAG.

    Stores conversation turns, extracts entities and topics,
    and provides context-aware query augmentation.

    Features:
    - In-memory storage with optional database persistence
    - Automatic summarization of older turns
    - Entity extraction and tracking
    - Coreference resolution for pronouns
    """

    # Entity extraction patterns (networking/Cisco focused)
    ENTITY_PATTERNS = {
        "device": [
            r'\b(switch|router|firewall|access point|AP|controller|WLC)\b',
            r'\b(MX\d+|MS\d+|MR\d+|Z\d+)\b',  # Meraki models
            r'\b(Catalyst \d+|ISR \d+|ASR \d+|Nexus \d+)\b',  # Cisco models
        ],
        "network": [
            r'\b(VLAN \d+|VLAN-\d+)\b',
            r'\b(SSID ["\']?[\w-]+["\']?)\b',
            r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:/\d{1,2})?)\b',  # IP/CIDR
        ],
        "protocol": [
            r'\b(OSPF|BGP|EIGRP|RIP|STP|RSTP|LACP|LLDP|CDP)\b',
            r'\b(DHCP|DNS|NTP|SNMP|SSH|HTTPS?|RADIUS|TACACS)\b',
        ],
        "feature": [
            r'\b(QoS|ACL|NAT|VPN|SD-WAN|SDWAN)\b',
            r'\b(port security|storm control|DAI|DHCP snooping)\b',
        ],
        "organization": [
            r'\b(organization|org|network|site)\s+["\']?([\w-]+)["\']?\b',
        ],
    }

    # Pronouns that need resolution
    PRONOUNS = {
        'it': 'singular',
        'its': 'singular',
        'this': 'singular',
        'that': 'singular',
        'they': 'plural',
        'them': 'plural',
        'their': 'plural',
        'these': 'plural',
        'those': 'plural',
    }

    def __init__(
        self,
        max_turns: int = 20,
        summary_threshold: int = 8,
        ttl_hours: int = 24,
    ):
        """Initialize conversation memory.

        Args:
            max_turns: Maximum turns to keep per session.
            summary_threshold: Number of turns before summarizing older ones.
            ttl_hours: Hours before session expires from memory.
        """
        self.max_turns = max_turns
        self.summary_threshold = summary_threshold
        self.ttl_hours = ttl_hours

        # In-memory storage
        self._sessions: Dict[str, List[ConversationTurn]] = defaultdict(list)
        self._summaries: Dict[str, str] = {}
        self._entities: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
        self._last_access: Dict[str, datetime] = {}

        # Lock for thread safety
        self._lock = asyncio.Lock()

    def _extract_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract entities from text."""
        entities: Dict[str, List[str]] = defaultdict(list)

        for category, patterns in self.ENTITY_PATTERNS.items():
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        match = match[0]  # Take first group
                    match = match.strip()
                    if match and match not in entities[category]:
                        entities[category].append(match)

        return dict(entities)

    def _extract_topics(self, text: str) -> List[str]:
        """Extract main topics from text."""
        # Topic patterns for networking discussions
        topic_patterns = [
            (r'\b(configur(?:e|ing|ation))\b', 'configuration'),
            (r'\b(troubleshoot(?:ing)?|debug(?:ging)?)\b', 'troubleshooting'),
            (r'\b(monitor(?:ing)?|observ(?:e|ability))\b', 'monitoring'),
            (r'\b(security|authentication|authorization)\b', 'security'),
            (r'\b(performance|optimization|latency)\b', 'performance'),
            (r'\b(connectivity|connection|reachability)\b', 'connectivity'),
            (r'\b(firmware|upgrade|update)\b', 'firmware'),
            (r'\b(backup|restore|recovery)\b', 'backup'),
            (r'\b(deploy(?:ment)?|provision(?:ing)?)\b', 'deployment'),
        ]

        topics = []
        text_lower = text.lower()

        for pattern, topic in topic_patterns:
            if re.search(pattern, text_lower):
                if topic not in topics:
                    topics.append(topic)

        return topics

    async def add_turn(
        self,
        session_id: str,
        query: str,
        response: str,
        source_chunk_ids: Optional[List[int]] = None,
    ) -> None:
        """Add a conversation turn to memory.

        Args:
            session_id: Unique session identifier.
            query: User's query.
            response: Assistant's response.
            source_chunk_ids: IDs of chunks used to generate response.
        """
        async with self._lock:
            # Extract entities and topics
            combined_text = f"{query} {response}"
            entities = self._extract_entities(combined_text)
            topics = self._extract_topics(combined_text)

            # Update session entity tracking
            for category, items in entities.items():
                self._entities[session_id][category].update(items)

            # Create turn
            turn = ConversationTurn(
                query=query,
                response=response,
                source_chunk_ids=source_chunk_ids or [],
                entities=entities,
                topics=topics,
                turn_index=len(self._sessions[session_id]),
            )

            # Add to session
            self._sessions[session_id].append(turn)
            self._last_access[session_id] = datetime.utcnow()

            # Trim if exceeding max
            if len(self._sessions[session_id]) > self.max_turns:
                self._sessions[session_id] = self._sessions[session_id][-self.max_turns:]

            # Check if we need to summarize
            if len(self._sessions[session_id]) > self.summary_threshold:
                await self._maybe_summarize(session_id)

            logger.debug(
                f"Added turn to session {session_id[:8]}... "
                f"(total: {len(self._sessions[session_id])} turns)"
            )

    async def _maybe_summarize(self, session_id: str) -> None:
        """Summarize older turns if needed."""
        turns = self._sessions[session_id]

        # Keep last 3-5 turns as recent, summarize the rest
        if len(turns) <= self.summary_threshold:
            return

        # For now, create a simple summary of older turns
        # In production, this would use an LLM
        older_turns = turns[:-5]

        # Simple extractive summary
        summary_parts = []
        seen_queries = set()

        for turn in older_turns:
            # Deduplicate similar queries
            query_key = turn.query.lower()[:50]
            if query_key in seen_queries:
                continue
            seen_queries.add(query_key)

            # Extract key info
            summary_parts.append(f"- Discussed: {turn.query[:100]}")

        if summary_parts:
            self._summaries[session_id] = "Previous topics:\n" + "\n".join(summary_parts[:10])

    async def get_context(self, session_id: str) -> ConversationContext:
        """Get conversation context for a session.

        Args:
            session_id: Session identifier.

        Returns:
            ConversationContext with summary, recent turns, entities, etc.
        """
        async with self._lock:
            turns = self._sessions.get(session_id, [])
            summary = self._summaries.get(session_id)
            entities = dict(self._entities.get(session_id, {}))

            # Convert sets to lists
            entities_mentioned = {
                k: list(v) for k, v in entities.items()
            }

            # Collect topics from recent turns
            topics = []
            seen_topics = set()
            for turn in reversed(turns[-5:]):
                for topic in turn.topics:
                    if topic not in seen_topics:
                        topics.append(topic)
                        seen_topics.add(topic)

            # Collect referenced chunk IDs
            referenced_chunks = set()
            for turn in turns:
                referenced_chunks.update(turn.source_chunk_ids)

            self._last_access[session_id] = datetime.utcnow()

            return ConversationContext(
                session_id=session_id,
                turn_count=len(turns),
                summary=summary,
                recent_turns=turns[-5:] if turns else [],
                entities_mentioned=entities_mentioned,
                topics_discussed=topics,
                referenced_chunks=referenced_chunks,
            )

    def _find_antecedent(
        self,
        pronoun: str,
        context: ConversationContext,
    ) -> Optional[str]:
        """Find the most likely antecedent for a pronoun.

        Uses recency and category matching to resolve references.
        """
        pronoun_type = self.PRONOUNS.get(pronoun.lower(), 'singular')

        # Get entities from recent turns (most recent first)
        recent_entities = []
        for turn in reversed(context.recent_turns):
            for category, items in turn.entities.items():
                for item in items:
                    if item not in [e[0] for e in recent_entities]:
                        recent_entities.append((item, category))

        if not recent_entities:
            # Fall back to session-level entities
            for category, items in context.entities_mentioned.items():
                for item in items:
                    if item not in [e[0] for e in recent_entities]:
                        recent_entities.append((item, category))

        if not recent_entities:
            return None

        # For singular pronouns, take most recent singular entity
        # For plural pronouns, might need multiple entities
        if pronoun_type == 'singular':
            return recent_entities[0][0]
        else:
            # Return first 2-3 entities for plural
            entities = [e[0] for e in recent_entities[:3]]
            return ", ".join(entities) if entities else None

    async def augment_query(
        self,
        query: str,
        context: ConversationContext,
    ) -> QueryAugmentation:
        """Augment a query with conversation context.

        Resolves pronouns and adds relevant context from conversation.

        Args:
            query: The user's current query.
            context: Conversation context.

        Returns:
            QueryAugmentation with resolved references and added context.
        """
        augmented = query
        resolved = {}
        added_context = []

        # Check for pronouns to resolve
        query_words = query.lower().split()
        for pronoun in self.PRONOUNS:
            if pronoun in query_words:
                antecedent = self._find_antecedent(pronoun, context)
                if antecedent:
                    # Replace pronoun with antecedent (case-insensitive)
                    pattern = rf'\b{pronoun}\b'
                    replacement = antecedent
                    augmented = re.sub(pattern, replacement, augmented, flags=re.IGNORECASE)
                    resolved[pronoun] = antecedent

        # Check for follow-up indicators
        followup_patterns = [
            r'^(and|also|what about|how about|tell me more)',
            r'^(more details|explain further|can you elaborate)',
            r'^(yes|no|ok|okay),?\s*(and|but|so)?',
        ]

        is_followup = any(
            re.match(p, query.lower())
            for p in followup_patterns
        )

        # Add context for follow-up queries
        if is_followup and context.recent_turns:
            last_turn = context.recent_turns[-1]
            # Add the topic from last query as context
            added_context.append(f"Following up on: {last_turn.query[:100]}")

            # If we found entities in last turn, add them
            for category, entities in last_turn.entities.items():
                if entities:
                    added_context.append(f"Regarding {category}: {', '.join(entities[:3])}")

        # Calculate confidence in augmentation
        if resolved or added_context:
            confidence = 0.8 if resolved else 0.6
        else:
            confidence = 1.0  # No augmentation needed

        return QueryAugmentation(
            original_query=query,
            augmented_query=augmented,
            resolved_references=resolved,
            added_context=added_context,
            confidence=confidence,
        )

    async def clear_session(self, session_id: str) -> None:
        """Clear all memory for a session."""
        async with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
            if session_id in self._summaries:
                del self._summaries[session_id]
            if session_id in self._entities:
                del self._entities[session_id]
            if session_id in self._last_access:
                del self._last_access[session_id]

            logger.debug(f"Cleared session {session_id[:8]}...")

    async def cleanup_expired(self) -> int:
        """Remove expired sessions from memory.

        Returns:
            Number of sessions removed.
        """
        async with self._lock:
            now = datetime.utcnow()
            cutoff = now - timedelta(hours=self.ttl_hours)

            expired = [
                sid for sid, last_access in self._last_access.items()
                if last_access < cutoff
            ]

            for sid in expired:
                if sid in self._sessions:
                    del self._sessions[sid]
                if sid in self._summaries:
                    del self._summaries[sid]
                if sid in self._entities:
                    del self._entities[sid]
                del self._last_access[sid]

            if expired:
                logger.info(f"Cleaned up {len(expired)} expired conversation sessions")

            return len(expired)

    def get_stats(self) -> Dict[str, Any]:
        """Get memory statistics."""
        total_turns = sum(len(turns) for turns in self._sessions.values())

        return {
            "active_sessions": len(self._sessions),
            "total_turns": total_turns,
            "sessions_with_summaries": len(self._summaries),
            "max_turns_per_session": self.max_turns,
            "summary_threshold": self.summary_threshold,
        }


# Singleton instance
_conversation_memory: Optional[ConversationMemory] = None


def get_conversation_memory() -> ConversationMemory:
    """Get or create the global conversation memory instance."""
    global _conversation_memory
    if _conversation_memory is None:
        _conversation_memory = ConversationMemory()
    return _conversation_memory
