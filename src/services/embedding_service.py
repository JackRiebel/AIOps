"""Embedding service for RAG knowledge base.

This service handles:
- Generating embeddings using OpenAI's text-embedding-ada-002 model
- Token counting for chunking
- Batch embedding generation for efficiency
"""

import logging
import os
from typing import List, Optional
import tiktoken

from src.services.cost_logger import get_cost_logger

logger = logging.getLogger(__name__)

# Default embedding model and dimensions
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSIONS = 1536
MAX_TOKENS_PER_CHUNK = 8191  # Max for ada-002


class EmbeddingService:
    """Service for generating text embeddings."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the embedding service.

        Args:
            api_key: OpenAI API key. If not provided, uses OPENAI_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self._client = None
        self._tokenizer = None

    @property
    def client(self):
        """Lazy-load OpenAI client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
        return self._client

    @property
    def tokenizer(self):
        """Lazy-load tokenizer for the embedding model."""
        if self._tokenizer is None:
            self._tokenizer = tiktoken.encoding_for_model(EMBEDDING_MODEL)
        return self._tokenizer

    def count_tokens(self, text: str) -> int:
        """Count tokens in a text string.

        Args:
            text: The text to count tokens for.

        Returns:
            Number of tokens.
        """
        return len(self.tokenizer.encode(text))

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate an embedding for a single text.

        Args:
            text: The text to embed.

        Returns:
            List of floats representing the embedding vector.
        """
        if not text.strip():
            raise ValueError("Cannot generate embedding for empty text")

        # Truncate if too long
        tokens = self.tokenizer.encode(text)
        if len(tokens) > MAX_TOKENS_PER_CHUNK:
            logger.warning(f"Text has {len(tokens)} tokens, truncating to {MAX_TOKENS_PER_CHUNK}")
            text = self.tokenizer.decode(tokens[:MAX_TOKENS_PER_CHUNK])

        try:
            response = self.client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text
            )

            # Log cost to database for telemetry
            try:
                if hasattr(response, 'usage') and response.usage:
                    token_count = response.usage.total_tokens
                    cost_logger = get_cost_logger()
                    import asyncio
                    asyncio.create_task(
                        cost_logger.log_embedding(
                            model=EMBEDDING_MODEL,
                            token_count=token_count,
                            text_count=1,
                        )
                    )
            except Exception as cost_error:
                logger.warning(f"Failed to log embedding cost: {cost_error}")

            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int = 100
    ) -> List[List[float]]:
        """Generate embeddings for multiple texts in batches.

        Args:
            texts: List of texts to embed.
            batch_size: Number of texts per API call (max 2048 for OpenAI).

        Returns:
            List of embedding vectors.
        """
        if not texts:
            return []

        all_embeddings = []

        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            # Truncate texts that are too long
            processed_batch = []
            for text in batch:
                if not text.strip():
                    processed_batch.append(" ")  # Empty texts get a space
                    continue

                tokens = self.tokenizer.encode(text)
                if len(tokens) > MAX_TOKENS_PER_CHUNK:
                    text = self.tokenizer.decode(tokens[:MAX_TOKENS_PER_CHUNK])
                processed_batch.append(text)

            try:
                response = self.client.embeddings.create(
                    model=EMBEDDING_MODEL,
                    input=processed_batch
                )

                # Log cost to database for telemetry
                try:
                    if hasattr(response, 'usage') and response.usage:
                        token_count = response.usage.total_tokens
                        cost_logger = get_cost_logger()
                        import asyncio
                        asyncio.create_task(
                            cost_logger.log_embedding(
                                model=EMBEDDING_MODEL,
                                token_count=token_count,
                                text_count=len(batch),
                            )
                        )
                except Exception as cost_error:
                    logger.warning(f"Failed to log batch embedding cost: {cost_error}")

                # Extract embeddings in order
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)

                logger.info(f"Generated embeddings for batch {i // batch_size + 1}, {len(batch)} texts")

            except Exception as e:
                logger.error(f"Failed to generate batch embeddings: {e}")
                raise

        return all_embeddings


class TextChunker:
    """Utility for chunking text documents for embedding."""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        embedding_service: Optional[EmbeddingService] = None
    ):
        """Initialize the text chunker.

        Args:
            chunk_size: Target token count per chunk.
            chunk_overlap: Token overlap between chunks.
            embedding_service: Service for token counting.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._embedding_service = embedding_service

    @property
    def embedding_service(self) -> EmbeddingService:
        """Lazy-load embedding service for token counting."""
        if self._embedding_service is None:
            self._embedding_service = EmbeddingService()
        return self._embedding_service

    def chunk_text(
        self,
        text: str,
        metadata: Optional[dict] = None
    ) -> List[dict]:
        """Split text into overlapping chunks.

        Args:
            text: The text to chunk.
            metadata: Optional metadata to include with each chunk.

        Returns:
            List of chunk dictionaries with content, tokens, and metadata.
        """
        if not text.strip():
            return []

        # Split into paragraphs first for semantic boundaries
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = []
        current_tokens = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_tokens = self.embedding_service.count_tokens(para)

            # If single paragraph exceeds chunk size, split it further
            if para_tokens > self.chunk_size:
                # Save current chunk if exists
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append({
                        'content': chunk_text,
                        'tokens': self.embedding_service.count_tokens(chunk_text),
                        'metadata': metadata or {}
                    })
                    current_chunk = []
                    current_tokens = 0

                # Split large paragraph by sentences
                sentences = self._split_into_sentences(para)
                for sentence in sentences:
                    sent_tokens = self.embedding_service.count_tokens(sentence)

                    if current_tokens + sent_tokens > self.chunk_size:
                        if current_chunk:
                            chunk_text = ' '.join(current_chunk)
                            chunks.append({
                                'content': chunk_text,
                                'tokens': self.embedding_service.count_tokens(chunk_text),
                                'metadata': metadata or {}
                            })

                            # Keep overlap
                            overlap_text = ' '.join(current_chunk[-2:]) if len(current_chunk) > 1 else ''
                            current_chunk = [overlap_text] if overlap_text else []
                            current_tokens = self.embedding_service.count_tokens(overlap_text) if overlap_text else 0

                    current_chunk.append(sentence)
                    current_tokens += sent_tokens

            # Normal case: paragraph fits in chunk
            elif current_tokens + para_tokens > self.chunk_size:
                # Save current chunk
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append({
                        'content': chunk_text,
                        'tokens': self.embedding_service.count_tokens(chunk_text),
                        'metadata': metadata or {}
                    })

                    # Keep last paragraph for overlap
                    overlap = current_chunk[-1] if current_chunk else ''
                    current_chunk = [overlap, para] if overlap else [para]
                    current_tokens = self.embedding_service.count_tokens('\n\n'.join(current_chunk))
                else:
                    current_chunk = [para]
                    current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens

        # Don't forget the last chunk
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            chunks.append({
                'content': chunk_text,
                'tokens': self.embedding_service.count_tokens(chunk_text),
                'metadata': metadata or {}
            })

        # Add chunk indices
        for i, chunk in enumerate(chunks):
            chunk['chunk_index'] = i

        return chunks

    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences.

        Args:
            text: Text to split.

        Returns:
            List of sentences.
        """
        import re

        # Simple sentence splitting - handles common cases
        # Could be improved with a proper NLP library
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def chunk_markdown(
        self,
        markdown: str,
        metadata: Optional[dict] = None
    ) -> List[dict]:
        """Chunk markdown document preserving headers.

        Args:
            markdown: Markdown text to chunk.
            metadata: Optional metadata to include.

        Returns:
            List of chunks with section context.
        """
        import re

        chunks = []
        current_headers = {}  # Track header hierarchy
        current_content = []
        current_tokens = 0

        lines = markdown.split('\n')

        for line in lines:
            # Check if line is a header
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)

            if header_match:
                # Save current chunk if exists
                if current_content:
                    content_text = '\n'.join(current_content)
                    chunk_metadata = {
                        **(metadata or {}),
                        'headers': dict(current_headers)
                    }
                    chunks.append({
                        'content': content_text,
                        'tokens': self.embedding_service.count_tokens(content_text),
                        'metadata': chunk_metadata
                    })
                    current_content = []
                    current_tokens = 0

                # Update header hierarchy
                level = len(header_match.group(1))
                header_text = header_match.group(2)
                current_headers[f'h{level}'] = header_text

                # Clear lower-level headers
                for i in range(level + 1, 7):
                    current_headers.pop(f'h{i}', None)

                current_content.append(line)
                current_tokens = self.embedding_service.count_tokens(line)

            else:
                line_tokens = self.embedding_service.count_tokens(line)

                if current_tokens + line_tokens > self.chunk_size and current_content:
                    content_text = '\n'.join(current_content)
                    chunk_metadata = {
                        **(metadata or {}),
                        'headers': dict(current_headers)
                    }
                    chunks.append({
                        'content': content_text,
                        'tokens': self.embedding_service.count_tokens(content_text),
                        'metadata': chunk_metadata
                    })

                    # Start new chunk with header context
                    header_context = '\n'.join([
                        f'{"#" * int(k[1])} {v}'
                        for k, v in sorted(current_headers.items())
                    ])
                    current_content = [header_context] if header_context else []
                    current_tokens = self.embedding_service.count_tokens(header_context) if header_context else 0

                current_content.append(line)
                current_tokens += line_tokens

        # Final chunk
        if current_content:
            content_text = '\n'.join(current_content)
            chunk_metadata = {
                **(metadata or {}),
                'headers': dict(current_headers)
            }
            chunks.append({
                'content': content_text,
                'tokens': self.embedding_service.count_tokens(content_text),
                'metadata': chunk_metadata
            })

        # Add chunk indices
        for i, chunk in enumerate(chunks):
            chunk['chunk_index'] = i

        return chunks


# Singleton instance for convenience
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the singleton embedding service.

    Checks both database config and environment variable for API key.
    """
    global _embedding_service
    if _embedding_service is None:
        # Try to get API key from database config first
        api_key = None
        try:
            from src.services.config_service import get_effective_config
            api_key = get_effective_config("openai_api_key")
        except Exception:
            pass

        # Fall back to environment variable
        if not api_key:
            api_key = os.getenv("OPENAI_API_KEY")

        _embedding_service = EmbeddingService(api_key=api_key)
    return _embedding_service


def reset_embedding_service() -> None:
    """Reset the singleton to pick up new API key from config."""
    global _embedding_service
    _embedding_service = None
