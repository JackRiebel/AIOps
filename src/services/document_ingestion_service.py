"""Document ingestion service for RAG knowledge base.

This service handles:
- Ingesting documents from various sources (files, URLs, OpenAPI specs)
- Smart chunking based on document type
- Metadata extraction (entities, keywords)
- Storing documents and embeddings in the database
- Deduplication via content hashing

Supported formats:
- Text files (.txt)
- Markdown files (.md)
- PDF files (.pdf)
- Word documents (.docx)
- OpenAPI specs (.json, .yaml)
- Web pages (via URL)
"""

import hashlib
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Try to import BeautifulSoup for HTML parsing
try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

from src.models.knowledge import KnowledgeDocument, KnowledgeChunk
from src.services.embedding_service import EmbeddingService, TextChunker, get_embedding_service
from src.services.smart_chunker import SmartChunker, get_smart_chunker
from src.services.metadata_extractor import MetadataExtractor, get_metadata_extractor
from src.services.chunk_quality_validator import validate_chunks, get_chunk_quality_validator
from src.services.post_ingestion_hooks import get_post_ingestion_hooks
from src.services.cisco_datasheet_parser import CiscoDatasheetParser, get_datasheet_parser
from src.services.knowledge_cache import get_knowledge_cache, CacheType

logger = logging.getLogger(__name__)

# Try to import document parsers
try:
    from src.services.document_parsers import PDFParser, DocxParser
    PDF_SUPPORT = True
    DOCX_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    DOCX_SUPPORT = False
    logger.warning("Document parsers not available. Install pypdf and python-docx for PDF/DOCX support.")


class DocumentIngestionService:
    """Service for ingesting documents into the knowledge base."""

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        use_smart_chunking: bool = True,
        extract_metadata: bool = True,
    ):
        """Initialize the ingestion service.

        Args:
            embedding_service: Service for generating embeddings.
            chunk_size: Target token count per chunk.
            chunk_overlap: Token overlap between chunks.
            use_smart_chunking: Use SmartChunker for document-aware chunking.
            extract_metadata: Extract entities and keywords from chunks.
        """
        self._embedding_service = embedding_service
        self.use_smart_chunking = use_smart_chunking
        self.extract_metadata = extract_metadata

        # Legacy chunker for backwards compatibility
        self.chunker = TextChunker(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            embedding_service=embedding_service
        )

        # New smart chunker
        self.smart_chunker = get_smart_chunker()
        self.metadata_extractor = get_metadata_extractor()

        # Document parsers
        self.pdf_parser = PDFParser() if PDF_SUPPORT else None
        self.docx_parser = DocxParser() if DOCX_SUPPORT else None

        # Specialized parsers
        self.datasheet_parser = get_datasheet_parser()

    @property
    def embedding_service(self) -> EmbeddingService:
        """Lazy-load embedding service."""
        if self._embedding_service is None:
            self._embedding_service = get_embedding_service()
        return self._embedding_service

    def _compute_content_hash(self, content: str) -> str:
        """Compute SHA-256 hash of content for deduplication.

        Args:
            content: The content to hash.

        Returns:
            Hex digest of the hash.
        """
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def _sanitize_for_database(self, text: str) -> str:
        """Ensure text is safe for PostgreSQL TEXT columns.

        Removes null bytes and other problematic characters that can cause
        'invalid byte sequence for encoding UTF8' errors.

        Args:
            text: The text to sanitize.

        Returns:
            Sanitized text safe for database storage.
        """
        if not text:
            return ""

        # Remove null bytes (0x00) - critical for PostgreSQL UTF-8
        text = text.replace('\x00', '')

        # Ensure valid UTF-8 by encoding and decoding with replacement
        try:
            text = text.encode('utf-8', errors='replace').decode('utf-8')
        except Exception:
            # Fallback to ASCII if UTF-8 fails
            text = text.encode('ascii', errors='replace').decode('ascii')

        return text

    async def ingest_text_document(
        self,
        session: AsyncSession,
        content: str,
        filename: str,
        doc_type: str,
        product: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        source_url: Optional[str] = None,
        version: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        filepath: Optional[str] = None
    ) -> KnowledgeDocument:
        """Ingest a text document into the knowledge base.

        Args:
            session: Database session.
            content: The document content.
            filename: Name of the document.
            doc_type: Type (api_spec, guide, datasheet, cli_reference, cvd).
            product: Product name (meraki, catalyst, ios-xe, ise, general).
            title: Document title.
            description: Brief description.
            source_url: Original URL if applicable.
            version: Document version.
            metadata: Additional metadata.
            filepath: Path to source file.

        Returns:
            The created KnowledgeDocument.
        """
        # Sanitize content to remove null bytes and ensure valid UTF-8
        content = self._sanitize_for_database(content)

        content_hash = self._compute_content_hash(content)

        # Check for existing document with same hash
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.content_hash == content_hash)
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Document with hash {content_hash[:8]}... already exists: {existing.filename}")
            return existing

        # Create document record
        document = KnowledgeDocument(
            filename=filename,
            filepath=filepath,
            doc_type=doc_type,
            product=product,
            version=version,
            title=title or filename,
            description=description,
            source_url=source_url,
            content_hash=content_hash,
            metadata=metadata or {},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session.add(document)
        await session.flush()  # Get the ID

        # Chunk the document using smart or legacy chunker
        if self.use_smart_chunking:
            smart_chunks = self.smart_chunker.chunk_document(content, doc_type, filename)
            chunks = [
                {
                    'chunk_index': c.index,
                    'content': c.content,
                    'tokens': c.token_count,
                    'metadata': c.metadata,
                    'hierarchy_level': getattr(c, 'hierarchy_level', 2),
                    'parent_index': getattr(c, 'parent_index', None),
                }
                for c in smart_chunks
            ]
        else:
            chunks = self.chunker.chunk_text(content, metadata={'doc_type': doc_type, 'product': product})

        logger.info(f"Split document into {len(chunks)} chunks")

        # Validate chunks for quality - filter out garbage/low-quality content
        original_count = len(chunks)
        valid_chunks, rejected_chunks = validate_chunks(chunks, doc_type)

        if rejected_chunks:
            logger.info(f"Quality filter: kept {len(valid_chunks)}/{original_count} chunks "
                       f"({len(rejected_chunks)} rejected as low-quality)")
            for rc in rejected_chunks[:5]:  # Log first 5 rejections
                reasons = rc.get('rejection_reasons', ['Unknown'])
                preview = rc['content'][:50].replace('\n', ' ')
                logger.debug(f"  Rejected: '{preview}...' - {reasons}")

        chunks = valid_chunks

        # Quality gate 1: Must have at least some valid chunks
        if not chunks:
            logger.warning(f"All chunks rejected for {filename} - document not stored")
            await session.rollback()
            raise ValueError(f"Document {filename} produced no valid chunks after quality filtering")

        # Quality gate 2: If most chunks were rejected, the document is likely garbage
        rejection_rate = len(rejected_chunks) / original_count if original_count > 0 else 0
        if rejection_rate > 0.8 and len(chunks) < 3:
            logger.warning(f"Document {filename} has {rejection_rate:.0%} rejection rate with only {len(chunks)} valid chunks - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has too much low-quality content ({rejection_rate:.0%} rejected)")

        # Quality gate 3: Average quality score must be reasonable
        avg_quality = sum(c.get('quality_score', 0.5) for c in chunks) / len(chunks)
        if avg_quality < 0.4:
            logger.warning(f"Document {filename} has low average quality score ({avg_quality:.2f}) - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has low average quality score ({avg_quality:.2f})")

        # Quality gate 4: Must have at least 2 good quality chunks (score >= 0.5)
        good_chunks = [c for c in chunks if c.get('quality_score', 0) >= 0.5]
        if len(good_chunks) < 2 and doc_type not in ('api_spec', 'cli_reference'):
            logger.warning(f"Document {filename} has only {len(good_chunks)} good quality chunks - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has insufficient good quality content")

        # Generate embeddings in batch
        chunk_texts = [c['content'] for c in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

        # Create chunk records with optional metadata extraction
        # First pass: create all chunks and build index-to-id mapping
        chunk_index_to_id: Dict[int, int] = {}
        created_chunks: List[KnowledgeChunk] = []

        for chunk_data, embedding in zip(chunks, embeddings):
            chunk_metadata = chunk_data.get('metadata', {})
            chunk_metadata['doc_type'] = doc_type
            chunk_metadata['product'] = product

            # Extract entities and keywords
            if self.extract_metadata:
                extracted = self.metadata_extractor.extract(chunk_data['content'])
                chunk_metadata['entities'] = extracted.entities
                chunk_metadata['keywords'] = extracted.keywords
                chunk_metadata['topics'] = extracted.topics

            chunk = KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk_data['chunk_index'],
                content=chunk_data['content'],
                content_tokens=chunk_data['tokens'],
                quality_score=chunk_data.get('quality_score'),
                chunk_metadata=chunk_metadata,
                embedding=embedding,
                hierarchy_level=chunk_data.get('hierarchy_level', 2),
                created_at=datetime.utcnow()
            )
            session.add(chunk)
            created_chunks.append(chunk)

        # Flush to get IDs assigned
        await session.flush()

        # Build index-to-id mapping
        for chunk in created_chunks:
            chunk_index_to_id[chunk.chunk_index] = chunk.id

        # Second pass: assign parent_chunk_id based on parent_index
        for chunk_data, chunk_obj in zip(chunks, created_chunks):
            parent_index = chunk_data.get('parent_index')
            if parent_index is not None and parent_index in chunk_index_to_id:
                chunk_obj.parent_chunk_id = chunk_index_to_id[parent_index]

        document.total_chunks = len(chunks)
        await session.commit()

        # Run post-ingestion hygiene in background
        hooks = get_post_ingestion_hooks()
        await hooks.on_document_ingested(session, document.id, run_in_background=True)

        logger.info(f"Ingested document: {filename} ({len(chunks)} chunks, {original_count - len(chunks)} filtered)")
        return document

    async def ingest_markdown_document(
        self,
        session: AsyncSession,
        content: str,
        filename: str,
        doc_type: str,
        product: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest a markdown document with header-aware chunking.

        Args:
            session: Database session.
            content: Markdown content.
            filename: Document name.
            doc_type: Document type.
            product: Product name.
            **kwargs: Additional arguments for ingest_text_document.

        Returns:
            The created KnowledgeDocument.
        """
        content_hash = self._compute_content_hash(content)

        # Check for existing
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.content_hash == content_hash)
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Document already exists: {existing.filename}")
            return existing

        # Create document
        document = KnowledgeDocument(
            filename=filename,
            doc_type=doc_type,
            product=product,
            content_hash=content_hash,
            title=kwargs.get('title') or filename,
            description=kwargs.get('description'),
            source_url=kwargs.get('source_url'),
            version=kwargs.get('version'),
            filepath=kwargs.get('filepath'),
            metadata=kwargs.get('metadata') or {},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session.add(document)
        await session.flush()

        # Use smart chunking for markdown (header-aware)
        if self.use_smart_chunking:
            smart_chunks = self.smart_chunker.chunk_document(content, 'markdown', filename)
            chunks = [
                {
                    'chunk_index': c.index,
                    'content': c.content,
                    'tokens': c.token_count,
                    'metadata': c.metadata,
                    'hierarchy_level': getattr(c, 'hierarchy_level', 2),
                    'parent_index': getattr(c, 'parent_index', None),
                }
                for c in smart_chunks
            ]
        else:
            chunks = self.chunker.chunk_markdown(content, metadata={'doc_type': doc_type, 'product': product})

        logger.info(f"Split markdown into {len(chunks)} chunks")

        # Validate chunks for quality
        original_count = len(chunks)
        valid_chunks, rejected_chunks = validate_chunks(chunks, doc_type)

        if rejected_chunks:
            logger.info(f"Quality filter: kept {len(valid_chunks)}/{original_count} chunks "
                       f"({len(rejected_chunks)} rejected as low-quality)")

        chunks = valid_chunks

        # Quality gate 1: Must have at least some valid chunks
        if not chunks:
            logger.warning(f"All chunks rejected for {filename} - document not stored")
            await session.rollback()
            raise ValueError(f"Document {filename} produced no valid chunks after quality filtering")

        # Quality gate 2: If most chunks were rejected, the document is likely garbage
        rejection_rate = len(rejected_chunks) / original_count if original_count > 0 else 0
        if rejection_rate > 0.8 and len(chunks) < 3:
            logger.warning(f"Document {filename} has {rejection_rate:.0%} rejection rate with only {len(chunks)} valid chunks - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has too much low-quality content ({rejection_rate:.0%} rejected)")

        # Quality gate 3: Average quality score must be reasonable
        avg_quality = sum(c.get('quality_score', 0.5) for c in chunks) / len(chunks)
        if avg_quality < 0.4:
            logger.warning(f"Document {filename} has low average quality score ({avg_quality:.2f}) - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has low average quality score ({avg_quality:.2f})")

        # Quality gate 4: Must have at least 2 good quality chunks (score >= 0.5)
        good_chunks = [c for c in chunks if c.get('quality_score', 0) >= 0.5]
        if len(good_chunks) < 2 and doc_type not in ('api_spec', 'cli_reference'):
            logger.warning(f"Document {filename} has only {len(good_chunks)} good quality chunks - rejecting")
            await session.rollback()
            raise ValueError(f"Document {filename} has insufficient good quality content")

        # Generate embeddings
        chunk_texts = [c['content'] for c in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

        # First pass: create chunks and build index-to-id mapping
        chunk_index_to_id: Dict[int, int] = {}
        created_chunks: List[KnowledgeChunk] = []

        for chunk_data, embedding in zip(chunks, embeddings):
            chunk_metadata = chunk_data.get('metadata', {})
            chunk_metadata['doc_type'] = doc_type
            chunk_metadata['product'] = product

            if self.extract_metadata:
                extracted = self.metadata_extractor.extract(chunk_data['content'])
                chunk_metadata['entities'] = extracted.entities
                chunk_metadata['keywords'] = extracted.keywords
                chunk_metadata['topics'] = extracted.topics

            chunk = KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk_data['chunk_index'],
                content=chunk_data['content'],
                content_tokens=chunk_data['tokens'],
                quality_score=chunk_data.get('quality_score'),
                chunk_metadata=chunk_metadata,
                embedding=embedding,
                hierarchy_level=chunk_data.get('hierarchy_level', 2),
                created_at=datetime.utcnow()
            )
            session.add(chunk)
            created_chunks.append(chunk)

        # Flush to get chunk IDs
        await session.flush()

        # Build index-to-id mapping
        for chunk in created_chunks:
            chunk_index_to_id[chunk.chunk_index] = chunk.id

        # Second pass: assign parent_chunk_id based on parent_index
        for chunk_data, chunk_obj in zip(chunks, created_chunks):
            parent_index = chunk_data.get('parent_index')
            if parent_index is not None and parent_index in chunk_index_to_id:
                chunk_obj.parent_chunk_id = chunk_index_to_id[parent_index]

        document.total_chunks = len(chunks)
        await session.commit()

        # Run post-ingestion hygiene in background
        hooks = get_post_ingestion_hooks()
        await hooks.on_document_ingested(session, document.id, run_in_background=True)

        return document

    async def ingest_openapi_spec(
        self,
        session: AsyncSession,
        spec_path: str,
        product: str,
        version: Optional[str] = None
    ) -> KnowledgeDocument:
        """Ingest an OpenAPI specification.

        Extracts endpoints, parameters, and descriptions into searchable chunks.

        Args:
            session: Database session.
            spec_path: Path to OpenAPI JSON/YAML file.
            product: Product name (meraki, catalyst, etc.).
            version: API version.

        Returns:
            The created KnowledgeDocument.
        """
        with open(spec_path, 'r') as f:
            spec = json.load(f)

        spec_content = json.dumps(spec, indent=2)
        content_hash = self._compute_content_hash(spec_content)

        # Check existing
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.content_hash == content_hash)
        )
        existing = result.scalar_one_or_none()

        if existing:
            return existing

        # Extract info
        info = spec.get('info', {})
        title = info.get('title', Path(spec_path).stem)
        description = info.get('description', '')
        spec_version = version or info.get('version', '')

        # Create document
        document = KnowledgeDocument(
            filename=Path(spec_path).name,
            filepath=spec_path,
            doc_type='api_spec',
            product=product,
            version=spec_version,
            title=title,
            description=description[:500] if description else None,
            content_hash=content_hash,
            metadata={'openapi_version': spec.get('openapi', spec.get('swagger', ''))},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session.add(document)
        await session.flush()

        # Extract and chunk endpoints
        chunks = self._extract_openapi_chunks(spec, product)
        logger.info(f"Extracted {len(chunks)} chunks from OpenAPI spec")

        # Validate chunks for quality
        original_count = len(chunks)
        valid_chunks, rejected_chunks = validate_chunks(chunks, 'api_spec')

        if rejected_chunks:
            logger.info(f"Quality filter: kept {len(valid_chunks)}/{original_count} chunks")

        chunks = valid_chunks

        if not chunks:
            logger.warning(f"All chunks rejected for OpenAPI spec - document not stored")
            await session.rollback()
            raise ValueError("OpenAPI spec produced no valid chunks after quality filtering")

        # Generate embeddings
        chunk_texts = [c['content'] for c in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

        # Store chunks
        for chunk_data, embedding in zip(chunks, embeddings):
            chunk = KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk_data['chunk_index'],
                content=chunk_data['content'],
                content_tokens=chunk_data.get('tokens', 0),
                quality_score=chunk_data.get('quality_score'),
                chunk_metadata=chunk_data['metadata'],
                embedding=embedding,
                created_at=datetime.utcnow()
            )
            session.add(chunk)

        document.total_chunks = len(chunks)
        await session.commit()

        # Run post-ingestion hygiene in background
        hooks = get_post_ingestion_hooks()
        await hooks.on_document_ingested(session, document.id, run_in_background=True)

        return document

    def _extract_openapi_chunks(self, spec: dict, product: str) -> List[dict]:
        """Extract searchable chunks from OpenAPI spec.

        Args:
            spec: Parsed OpenAPI specification.
            product: Product name.

        Returns:
            List of chunk dictionaries.
        """
        chunks = []
        chunk_index = 0

        paths = spec.get('paths', {})

        for path, methods in paths.items():
            for method, details in methods.items():
                if method.startswith('x-') or not isinstance(details, dict):
                    continue

                # Build chunk content
                operation_id = details.get('operationId', f'{method.upper()} {path}')
                summary = details.get('summary', '')
                description = details.get('description', '')
                tags = details.get('tags', [])

                # Extract parameters
                params = details.get('parameters', [])
                param_text = ''
                if params:
                    param_text = '\nParameters:\n'
                    for p in params:
                        param_text += f"  - {p.get('name')} ({p.get('in')}): {p.get('description', '')}\n"

                # Extract request body
                body_text = ''
                request_body = details.get('requestBody', {})
                if request_body:
                    body_desc = request_body.get('description', '')
                    body_text = f'\nRequest Body: {body_desc}\n'

                # Extract responses
                response_text = ''
                responses = details.get('responses', {})
                if responses:
                    response_text = '\nResponses:\n'
                    for code, resp in responses.items():
                        resp_desc = resp.get('description', '') if isinstance(resp, dict) else ''
                        response_text += f"  - {code}: {resp_desc}\n"

                content = f"""API Endpoint: {method.upper()} {path}
Operation: {operation_id}
Tags: {', '.join(tags)}
Summary: {summary}
Description: {description}
{param_text}{body_text}{response_text}"""

                chunks.append({
                    'chunk_index': chunk_index,
                    'content': content,
                    'tokens': self.embedding_service.count_tokens(content),
                    'metadata': {
                        'doc_type': 'api_spec',
                        'product': product,
                        'endpoint': path,
                        'method': method.upper(),
                        'operation_id': operation_id,
                        'tags': tags
                    }
                })
                chunk_index += 1

        return chunks

    async def ingest_pdf_document(
        self,
        session: AsyncSession,
        filepath: Optional[str] = None,
        file_content: Optional[bytes] = None,
        filename: str = "document.pdf",
        doc_type: Optional[str] = None,
        product: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest a PDF document.

        Args:
            session: Database session.
            filepath: Path to PDF file.
            file_content: Raw PDF bytes.
            filename: Document name.
            doc_type: Document type. If None, auto-detects from filename.
            product: Product name.
            **kwargs: Additional arguments.

        Returns:
            The created KnowledgeDocument.

        Raises:
            ValueError: If PDF parsing is not available.
        """
        if not self.pdf_parser:
            raise ValueError("PDF parsing not available. Install pypdf with: pip install pypdf")

        # Auto-detect doc_type from filename
        # Always check for datasheet patterns - these need special handling
        filename_lower = filename.lower()
        is_datasheet = 'datasheet' in filename_lower or 'data-sheet' in filename_lower or 'data sheet' in filename_lower

        if is_datasheet:
            # Force datasheet type for proper chunking and validation
            doc_type = 'datasheet'
        elif doc_type is None:
            # Auto-detect other types if not specified
            if 'runbook' in filename_lower:
                doc_type = 'runbook'
            elif 'guide' in filename_lower:
                doc_type = 'guide'
            else:
                doc_type = 'guide'  # Default

        # Parse PDF
        pdf_doc = self.pdf_parser.parse(
            file_path=filepath,
            file_content=file_content
        )

        # Get text content
        content = pdf_doc.full_text

        # Merge PDF metadata with kwargs
        doc_metadata = kwargs.get('metadata', {})
        doc_metadata.update(pdf_doc.metadata)
        doc_metadata['total_pages'] = pdf_doc.total_pages
        kwargs['metadata'] = doc_metadata

        # Use title from PDF if not provided
        if not kwargs.get('title') and pdf_doc.metadata.get('title'):
            kwargs['title'] = pdf_doc.metadata['title']

        return await self.ingest_text_document(
            session=session,
            content=content,
            filename=filename,
            doc_type=doc_type,
            product=product,
            filepath=filepath,
            **kwargs
        )

    async def ingest_docx_document(
        self,
        session: AsyncSession,
        filepath: Optional[str] = None,
        file_content: Optional[bytes] = None,
        filename: str = "document.docx",
        doc_type: str = "guide",
        product: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest a Word document (.docx).

        Args:
            session: Database session.
            filepath: Path to DOCX file.
            file_content: Raw DOCX bytes.
            filename: Document name.
            doc_type: Document type.
            product: Product name.
            **kwargs: Additional arguments.

        Returns:
            The created KnowledgeDocument.

        Raises:
            ValueError: If DOCX parsing is not available.
        """
        if not self.docx_parser:
            raise ValueError("DOCX parsing not available. Install python-docx with: pip install python-docx")

        # Parse DOCX
        docx_doc = self.docx_parser.parse(
            file_path=filepath,
            file_content=file_content
        )

        # Get markdown content (preserves structure)
        content = docx_doc.as_markdown

        # Merge DOCX metadata with kwargs
        doc_metadata = kwargs.get('metadata', {})
        doc_metadata.update(docx_doc.metadata)
        kwargs['metadata'] = doc_metadata

        # Use title from DOCX if not provided
        if not kwargs.get('title') and docx_doc.metadata.get('title'):
            kwargs['title'] = docx_doc.metadata['title']

        # Treat as markdown for smart chunking
        return await self.ingest_markdown_document(
            session=session,
            content=content,
            filename=filename,
            doc_type=doc_type,
            product=product,
            filepath=filepath,
            **kwargs
        )

    async def ingest_datasheet(
        self,
        session: AsyncSession,
        html_content: str,
        source_url: str,
        product: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest a Cisco datasheet using specialized parsing.

        Handles the unique structure of Cisco datasheets:
        - Extracts and converts tables to semantic text
        - Preserves specification/feature context
        - Creates chunks optimized for RAG retrieval

        Args:
            session: Database session.
            html_content: Raw HTML content of the datasheet.
            source_url: Original URL.
            product: Product name (auto-detected if not provided).
            **kwargs: Additional arguments.

        Returns:
            The created KnowledgeDocument.
        """
        logger.info(f"Using specialized datasheet parser for: {source_url}")

        # Parse the datasheet
        parsed = self.datasheet_parser.parse_html(html_content, source_url)

        # Auto-detect product if not provided
        if not product:
            product = parsed.product_family.replace('_', '-')

        # Generate filename
        filename = self._url_to_filename(source_url, ".md")

        # Compute content hash from semantic text
        semantic_text = self.datasheet_parser.convert_to_semantic_text(parsed)
        content_hash = self._compute_content_hash(semantic_text)

        # Check for existing document
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.content_hash == content_hash)
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Datasheet already exists: {existing.filename}")
            return existing

        # Create document record
        document = KnowledgeDocument(
            filename=filename,
            doc_type='datasheet',
            product=product,
            title=parsed.title,
            description=f"Official Cisco datasheet for {parsed.product_name}",
            source_url=source_url,
            content_hash=content_hash,
            metadata={
                'product_name': parsed.product_name,
                'product_family': parsed.product_family,
                'table_count': parsed.metadata.get('table_count', 0),
                'section_count': parsed.metadata.get('section_count', 0),
                'parser': 'cisco_datasheet_parser',
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        session.add(document)
        await session.flush()

        # Get pre-structured chunks from datasheet parser
        chunks = self.datasheet_parser.create_chunks(parsed)

        logger.info(f"Datasheet parser created {len(chunks)} structured chunks")

        # Validate chunks (with datasheet-aware scoring)
        original_count = len(chunks)
        valid_chunks, rejected_chunks = validate_chunks(chunks, 'datasheet')

        if rejected_chunks:
            logger.info(f"Quality filter: kept {len(valid_chunks)}/{original_count} chunks "
                       f"({len(rejected_chunks)} rejected)")

        chunks = valid_chunks

        # Quality gate 1: Must have at least some valid chunks
        if not chunks:
            logger.warning(f"All chunks rejected for datasheet - document not stored")
            await session.rollback()
            raise ValueError(f"Datasheet {source_url} produced no valid chunks after quality filtering")

        # Quality gate 2: If most chunks were rejected, the document is likely garbage
        rejection_rate = len(rejected_chunks) / original_count if original_count > 0 else 0
        if rejection_rate > 0.8 and len(chunks) < 3:
            logger.warning(f"Datasheet has {rejection_rate:.0%} rejection rate with only {len(chunks)} valid chunks - rejecting")
            await session.rollback()
            raise ValueError(f"Datasheet {source_url} has too much low-quality content ({rejection_rate:.0%} rejected)")

        # Quality gate 3: Average quality score must be reasonable
        avg_quality = sum(c.get('quality_score', 0.5) for c in chunks) / len(chunks)
        if avg_quality < 0.4:
            logger.warning(f"Datasheet has low average quality score ({avg_quality:.2f}) - rejecting")
            await session.rollback()
            raise ValueError(f"Datasheet {source_url} has low average quality score ({avg_quality:.2f})")

        # Generate embeddings
        chunk_texts = [c['content'] for c in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

        # First pass: create chunks
        chunk_index_to_id: Dict[int, int] = {}
        created_chunks: List[KnowledgeChunk] = []

        for chunk_data, embedding in zip(chunks, embeddings):
            chunk_metadata = chunk_data.get('metadata', {})
            chunk_metadata['doc_type'] = 'datasheet'
            chunk_metadata['product'] = product

            # Extract entities and keywords
            if self.extract_metadata:
                extracted = self.metadata_extractor.extract(chunk_data['content'])
                chunk_metadata['entities'] = extracted.entities
                chunk_metadata['keywords'] = extracted.keywords
                chunk_metadata['topics'] = extracted.topics

            chunk = KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk_data['chunk_index'],
                content=chunk_data['content'],
                content_tokens=chunk_data.get('tokens', len(chunk_data['content'].split())),
                quality_score=chunk_data.get('quality_score'),
                chunk_metadata=chunk_metadata,
                embedding=embedding,
                hierarchy_level=chunk_data.get('hierarchy_level', 1),
                created_at=datetime.utcnow()
            )
            session.add(chunk)
            created_chunks.append(chunk)

        # Flush to get IDs
        await session.flush()

        # Build index-to-id mapping
        for chunk in created_chunks:
            chunk_index_to_id[chunk.chunk_index] = chunk.id

        # Second pass: assign parent_chunk_id
        for chunk_data, chunk_obj in zip(chunks, created_chunks):
            parent_index = chunk_data.get('parent_index')
            if parent_index is not None and parent_index in chunk_index_to_id:
                chunk_obj.parent_chunk_id = chunk_index_to_id[parent_index]

        document.total_chunks = len(chunks)
        await session.commit()

        # Run post-ingestion hooks
        hooks = get_post_ingestion_hooks()
        await hooks.on_document_ingested(session, document.id, run_in_background=True)

        logger.info(f"Ingested datasheet: {parsed.title} ({len(chunks)} chunks)")
        return document

    async def ingest_file(
        self,
        session: AsyncSession,
        filepath: str,
        doc_type: str,
        product: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest a file based on its extension.

        Supports: .txt, .md, .json, .yaml, .yml, .pdf, .docx

        Args:
            session: Database session.
            filepath: Path to the file.
            doc_type: Document type.
            product: Product name.
            **kwargs: Additional arguments.

        Returns:
            The created KnowledgeDocument.
        """
        path = Path(filepath)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        suffix = path.suffix.lower()

        # Handle PDF files (binary)
        if suffix == '.pdf':
            return await self.ingest_pdf_document(
                session=session,
                filepath=filepath,
                filename=path.name,
                doc_type=doc_type,
                product=product,
                **kwargs
            )

        # Handle DOCX files (binary)
        if suffix == '.docx':
            return await self.ingest_docx_document(
                session=session,
                filepath=filepath,
                filename=path.name,
                doc_type=doc_type,
                product=product,
                **kwargs
            )

        # Handle text-based files
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if suffix in ['.json', '.yaml', '.yml']:
            # Check if OpenAPI spec
            try:
                if suffix == '.json':
                    spec = json.loads(content)
                else:
                    import yaml
                    spec = yaml.safe_load(content)

                if 'openapi' in spec or 'swagger' in spec:
                    return await self.ingest_openapi_spec(session, filepath, product or 'unknown')
            except Exception:
                pass

        if suffix == '.md':
            return await self.ingest_markdown_document(
                session=session,
                content=content,
                filename=path.name,
                doc_type=doc_type,
                product=product,
                filepath=filepath,
                **kwargs
            )

        return await self.ingest_text_document(
            session=session,
            content=content,
            filename=path.name,
            doc_type=doc_type,
            product=product,
            filepath=filepath,
            **kwargs
        )

    async def ingest_directory(
        self,
        session: AsyncSession,
        directory: str,
        doc_type: str,
        product: Optional[str] = None,
        extensions: Optional[List[str]] = None,
        recursive: bool = True
    ) -> List[KnowledgeDocument]:
        """Ingest all matching files from a directory.

        Args:
            session: Database session.
            directory: Directory path.
            doc_type: Document type for all files.
            product: Product name.
            extensions: File extensions to include (e.g., ['.md', '.txt', '.pdf', '.docx']).
            recursive: Whether to scan subdirectories.

        Returns:
            List of created documents.
        """
        extensions = extensions or ['.md', '.txt', '.json', '.pdf', '.docx']
        path = Path(directory)

        if not path.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")

        documents = []
        pattern = '**/*' if recursive else '*'

        for file_path in path.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in extensions:
                try:
                    doc = await self.ingest_file(
                        session=session,
                        filepath=str(file_path),
                        doc_type=doc_type,
                        product=product
                    )
                    documents.append(doc)
                    logger.info(f"Ingested: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to ingest {file_path}: {e}")

        return documents

    async def ingest_from_url(
        self,
        session: AsyncSession,
        url: str,
        doc_type: str,
        product: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        **kwargs
    ) -> KnowledgeDocument:
        """Ingest content from a webpage URL.

        Fetches the webpage, extracts text content, and ingests it
        into the knowledge base.

        Args:
            session: Database session.
            url: URL of the webpage to ingest.
            doc_type: Document type (guide, api_spec, etc.).
            product: Product name.
            title: Override title (otherwise extracted from page).
            description: Document description.
            **kwargs: Additional arguments for ingestion.

        Returns:
            The created KnowledgeDocument.

        Raises:
            ValueError: If URL is invalid or content cannot be fetched.
        """
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError(f"Invalid URL: {url}")

        logger.info(f"Fetching content from URL: {url}")

        # Check if this is a datasheet URL - use specialized parser
        is_datasheet = doc_type == 'datasheet' or self.datasheet_parser.is_datasheet_url(url)

        if is_datasheet:
            logger.info(f"Detected datasheet URL, using specialized parser")
            try:
                async with httpx.AsyncClient(
                    timeout=60.0,
                    follow_redirects=True,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                    }
                ) as client:
                    response = await client.get(url)
                    response.raise_for_status()

                    # Use specialized datasheet parser
                    return await self.ingest_datasheet(
                        session=session,
                        html_content=response.text,
                        source_url=url,
                        product=product,
                        **kwargs
                    )
            except Exception as e:
                logger.warning(f"Datasheet parser failed, falling back to standard parsing: {e}")
                # Fall through to standard parsing

        # First try Jina Reader for JavaScript-rendered content
        # Jina Reader (r.jina.ai) renders pages and returns clean markdown
        jina_url = f"https://r.jina.ai/{url}"

        try:
            async with httpx.AsyncClient(
                timeout=90.0,  # Longer timeout for JS rendering
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; Lumen/1.0; Knowledge Ingestion)",
                    "Accept": "text/markdown, text/plain, */*",
                    "X-Return-Format": "markdown",  # Explicitly request markdown
                    "X-With-Images-Summary": "false",  # Skip image processing
                    "X-With-Links-Summary": "false",  # Skip link processing for speed
                }
            ) as client:
                # Try Jina Reader first for better JS-rendered content
                logger.info(f"Trying Jina Reader: {jina_url}")
                jina_response = await client.get(jina_url)

                if jina_response.status_code == 200:
                    jina_content = jina_response.text

                    # Validate content quality - not just length but actual content
                    content_quality = self._assess_content_quality(jina_content)
                    logger.info(f"Jina Reader returned {len(jina_content)} chars, quality score: {content_quality['score']:.2f}")

                    if content_quality['is_valid']:
                        # Clean the content to remove repetitive navigation
                        content = self._clean_fetched_content(jina_content)

                        # Extract title from markdown (first # heading)
                        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                        extracted_title = title_match.group(1) if title_match else None
                        if not title and extracted_title:
                            title = extracted_title
                        filename = self._url_to_filename(url, ".md")

                        return await self.ingest_markdown_document(
                            session=session,
                            content=content,
                            filename=filename,
                            doc_type=doc_type,
                            product=product,
                            title=title,
                            description=description,
                            source_url=url,
                            metadata={
                                "original_url": url,
                                "domain": parsed.netloc,
                                "fetched_via": "jina_reader",
                                "content_quality": content_quality,
                            },
                            **kwargs
                        )
                    else:
                        logger.warning(f"Jina Reader content failed quality check: {content_quality['reasons']}")
                else:
                    logger.warning(f"Jina Reader returned status {jina_response.status_code}")
        except Exception as e:
            logger.warning(f"Jina Reader failed, falling back to direct fetch: {e}")

        # Fallback to direct fetch
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
        except httpx.HTTPError as e:
            raise ValueError(f"Failed to fetch URL: {e}")

        content_type = response.headers.get("content-type", "").lower()

        # Handle different content types
        if "application/json" in content_type:
            # JSON content - check if OpenAPI spec
            try:
                data = response.json()
                if "openapi" in data or "swagger" in data:
                    # Save to temp file and ingest as OpenAPI
                    import tempfile
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                        json.dump(data, f)
                        temp_path = f.name

                    try:
                        doc = await self.ingest_openapi_spec(
                            session=session,
                            spec_path=temp_path,
                            product=product or "unknown"
                        )
                        doc.source_url = url
                        await session.commit()
                        return doc
                    finally:
                        os.unlink(temp_path)

                # Regular JSON - convert to readable text
                content = json.dumps(data, indent=2)
                filename = self._url_to_filename(url, ".json")

            except json.JSONDecodeError:
                content = response.text
                filename = self._url_to_filename(url, ".txt")

        elif "text/markdown" in content_type:
            # Markdown content
            content = response.text
            filename = self._url_to_filename(url, ".md")

            return await self.ingest_markdown_document(
                session=session,
                content=content,
                filename=filename,
                doc_type=doc_type,
                product=product,
                title=title,
                description=description,
                source_url=url,
                **kwargs
            )

        elif "text/html" in content_type or "application/xhtml" in content_type:
            # HTML content - extract text
            content, extracted_title = self._html_to_markdown(response.text)
            filename = self._url_to_filename(url, ".md")

            # Use extracted title if not provided
            if not title and extracted_title:
                title = extracted_title

            # Check content quality - reject navigation-only pages
            content_quality = self._assess_content_quality(content)
            logger.info(f"Direct fetch content quality: score={content_quality['score']:.2f}, words={content_quality['stats']['word_count']}")

            if not content_quality['is_valid']:
                logger.warning(f"Direct fetch produced low-quality content: {content_quality['reasons']}")
                raise ValueError(
                    f"Page content is too sparse to ingest (likely a navigation/index page). "
                    f"Reasons: {', '.join(content_quality['reasons'])}. "
                    f"Consider importing the actual documentation pages instead."
                )

            return await self.ingest_markdown_document(
                session=session,
                content=content,
                filename=filename,
                doc_type=doc_type,
                product=product,
                title=title,
                description=description,
                source_url=url,
                metadata={
                    "original_url": url,
                    "domain": parsed.netloc,
                    "fetched_via": "direct_html",
                    "content_quality": content_quality,
                },
                **kwargs
            )

        else:
            # Plain text or unknown
            content = response.text
            filename = self._url_to_filename(url, ".txt")

        return await self.ingest_text_document(
            session=session,
            content=content,
            filename=filename,
            doc_type=doc_type,
            product=product,
            title=title,
            description=description,
            source_url=url,
            metadata={"original_url": url, "domain": parsed.netloc},
            **kwargs
        )

    def _url_to_filename(self, url: str, extension: str = ".txt") -> str:
        """Convert a URL to a safe filename.

        Args:
            url: The URL to convert.
            extension: File extension to use.

        Returns:
            Safe filename derived from URL.
        """
        parsed = urlparse(url)
        path = parsed.path.strip("/").replace("/", "_") or "index"

        # Remove existing extension if present
        if "." in path:
            path = path.rsplit(".", 1)[0]

        # Clean up the filename
        safe_name = re.sub(r'[^\w\-_]', '_', path)
        safe_name = re.sub(r'_+', '_', safe_name).strip('_')

        # Limit length
        if len(safe_name) > 100:
            safe_name = safe_name[:100]

        return f"{parsed.netloc}_{safe_name}{extension}"

    def _html_to_markdown(self, html: str) -> tuple[str, Optional[str]]:
        """Convert HTML to markdown-like text.

        Args:
            html: Raw HTML content.

        Returns:
            Tuple of (markdown_content, extracted_title).
        """
        if BS4_AVAILABLE:
            soup = BeautifulSoup(html, "html.parser")

            # Extract title
            title = None
            title_tag = soup.find("title")
            if title_tag:
                title = title_tag.get_text().strip()

            # Remove non-content elements
            for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe", "svg", "form"]):
                tag.decompose()

            # Remove common navigation/UI class patterns
            for tag in soup.find_all(class_=re.compile(r'nav|menu|sidebar|footer|header|cookie|banner|popup|modal|advertisement|ad-|social', re.I)):
                tag.decompose()

            # Remove hidden elements
            for tag in soup.find_all(style=re.compile(r'display:\s*none', re.I)):
                tag.decompose()

            # Try to find main content area
            main_content = (
                soup.find("main") or
                soup.find("article") or
                soup.find(id=re.compile(r'content|main|article|body', re.I)) or
                soup.find(class_=re.compile(r'^content$|^main$|^article$|main-content|page-content|post-content', re.I)) or
                soup.find("body") or
                soup
            )

            # Process content recursively to preserve structure
            lines = []
            seen_texts = set()  # Avoid duplicate text from nested elements

            def process_element(element, depth=0):
                """Recursively process elements to extract formatted text."""
                if element.name is None:
                    return

                tag_name = element.name

                # Handle structural elements that contain other elements
                if tag_name in ["div", "section", "article", "main", "body", "span"]:
                    for child in element.children:
                        if hasattr(child, 'name'):
                            process_element(child, depth)
                        elif child.string and child.string.strip():
                            # Direct text node in a div
                            text = child.string.strip()
                            if text and text not in seen_texts and len(text) > 2:
                                seen_texts.add(text)
                                lines.append(text)
                    return

                # Get direct text content
                text = element.get_text(separator=" ", strip=True)
                if not text or len(text) < 3:
                    return

                # Skip if we've seen this exact text (handles nested duplicates)
                if text in seen_texts:
                    return
                seen_texts.add(text)

                # Format based on tag type
                if tag_name == "h1":
                    lines.append(f"\n# {text}\n")
                elif tag_name == "h2":
                    lines.append(f"\n## {text}\n")
                elif tag_name == "h3":
                    lines.append(f"\n### {text}\n")
                elif tag_name in ["h4", "h5", "h6"]:
                    lines.append(f"\n#### {text}\n")
                elif tag_name == "li":
                    lines.append(f"- {text}")
                elif tag_name == "pre":
                    lines.append(f"\n```\n{text}\n```\n")
                elif tag_name == "code" and element.parent.name != "pre":
                    lines.append(f"`{text}`")
                elif tag_name == "blockquote":
                    lines.append(f"\n> {text}\n")
                elif tag_name == "table":
                    # Extract table content
                    rows = element.find_all("tr")
                    for row in rows:
                        cells = row.find_all(["th", "td"])
                        if cells:
                            row_text = " | ".join(cell.get_text(strip=True) for cell in cells)
                            lines.append(f"| {row_text} |")
                    lines.append("")
                elif tag_name == "p":
                    lines.append(f"\n{text}\n")
                elif tag_name in ["strong", "b"]:
                    lines.append(f"**{text}**")
                elif tag_name in ["em", "i"]:
                    lines.append(f"*{text}*")
                elif tag_name == "a":
                    href = element.get("href", "")
                    if href and not href.startswith("#"):
                        lines.append(f"[{text}]({href})")
                    else:
                        lines.append(text)
                elif tag_name == "img":
                    alt = element.get("alt", "")
                    src = element.get("src", "")
                    if alt or src:
                        lines.append(f"![{alt}]({src})")
                elif tag_name in ["ul", "ol"]:
                    # Process list items
                    for li in element.find_all("li", recursive=False):
                        li_text = li.get_text(separator=" ", strip=True)
                        if li_text and li_text not in seen_texts:
                            seen_texts.add(li_text)
                            lines.append(f"- {li_text}")
                elif tag_name == "dl":
                    # Definition list
                    for dt in element.find_all("dt"):
                        dt_text = dt.get_text(strip=True)
                        if dt_text:
                            lines.append(f"\n**{dt_text}**")
                    for dd in element.find_all("dd"):
                        dd_text = dd.get_text(strip=True)
                        if dd_text:
                            lines.append(f"  {dd_text}")

            # Process all direct children of main content
            for child in main_content.children:
                if hasattr(child, 'name'):
                    process_element(child)

            content = "\n".join(lines)

            # Clean up excessive whitespace
            content = re.sub(r'\n{3,}', '\n\n', content)
            content = re.sub(r' {2,}', ' ', content)

            # If content is too short, fallback to extracting all text
            if len(content.strip()) < 500:
                logger.warning(f"Structured extraction yielded little content ({len(content)} chars), falling back to full text extraction")
                # Get all text from body, preserving some structure
                full_text = main_content.get_text(separator="\n", strip=True)
                # Clean up
                full_text = re.sub(r'\n{3,}', '\n\n', full_text)
                full_text = re.sub(r' {2,}', ' ', full_text)
                if len(full_text) > len(content):
                    content = full_text

            return content.strip(), title

        else:
            # Fallback: basic regex-based extraction
            # Remove scripts and styles
            html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.I)
            html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.I)

            # Extract title
            title = None
            title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()

            # Convert headers
            html = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\n# \1\n', html, flags=re.I | re.DOTALL)
            html = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n## \1\n', html, flags=re.I | re.DOTALL)
            html = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n### \1\n', html, flags=re.I | re.DOTALL)

            # Convert paragraphs and line breaks
            html = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\1\n', html, flags=re.I | re.DOTALL)
            html = re.sub(r'<br\s*/?>', '\n', html, flags=re.I)
            html = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', html, flags=re.I | re.DOTALL)

            # Remove remaining tags
            html = re.sub(r'<[^>]+>', '', html)

            # Decode HTML entities
            import html as html_module
            content = html_module.unescape(html)

            # Clean up whitespace
            content = re.sub(r'\n{3,}', '\n\n', content)
            content = re.sub(r' +', ' ', content)

            return content.strip(), title

    def _assess_content_quality(self, content: str) -> dict:
        """Assess whether fetched content is meaningful or just navigation/boilerplate.

        Args:
            content: The fetched content (markdown or text).

        Returns:
            Dict with 'is_valid', 'score', and 'reasons'.
        """
        reasons = []
        score = 0.0

        # Basic length check
        if len(content) < 500:
            reasons.append("Content too short (<500 chars)")
            return {
                "is_valid": False,
                "score": 0.0,
                "reasons": reasons,
                "stats": {
                    "word_count": len(content.split()),
                    "paragraph_count": 0,
                    "header_count": 0,
                    "sentence_count": 0,
                    "link_count": 0,
                }
            }

        # Count meaningful elements
        lines = content.split('\n')
        total_lines = len(lines)

        # Count headers
        headers = [l for l in lines if l.strip().startswith('#')]
        header_count = len(headers)

        # Count paragraphs (lines with substantial text, not headers or list items)
        paragraphs = [l for l in lines if len(l.strip()) > 50 and not l.strip().startswith(('#', '-', '*', '|'))]
        paragraph_count = len(paragraphs)

        # Count list items
        list_items = [l for l in lines if l.strip().startswith(('-', '*', '•')) and len(l.strip()) > 10]
        list_count = len(list_items)

        # Count links (markdown links)
        links = re.findall(r'\[([^\]]+)\]\(([^\)]+)\)', content)
        link_count = len(links)

        # Calculate word count (excluding markdown syntax)
        clean_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', content)  # Simplify links
        clean_text = re.sub(r'[#*`\[\]|]', '', clean_text)  # Remove markdown
        words = clean_text.split()
        word_count = len(words)

        # Quality checks

        # 1. Must have enough words (at least 100)
        if word_count < 100:
            reasons.append(f"Not enough words ({word_count} < 100)")
        else:
            score += 0.3

        # 2. Should have some paragraphs (not just lists/headers)
        if paragraph_count < 3:
            reasons.append(f"Too few paragraphs ({paragraph_count} < 3)")
        else:
            score += 0.3

        # 3. Ratio of content to headers - pages with mostly headers are navigation
        if header_count > 0 and paragraph_count > 0:
            content_to_header_ratio = paragraph_count / header_count
            if content_to_header_ratio < 0.5:
                reasons.append(f"Mostly headers, little content (ratio: {content_to_header_ratio:.2f})")
            else:
                score += 0.2
        elif header_count > 5 and paragraph_count == 0:
            reasons.append("All headers, no paragraphs - likely navigation page")
        else:
            score += 0.1

        # 4. Check for link-heavy content (likely a list of links page)
        if word_count > 0:
            link_word_ratio = (link_count * 5) / word_count  # Each link is ~5 words
            if link_word_ratio > 0.5:
                reasons.append(f"Too link-heavy (ratio: {link_word_ratio:.2f})")
            else:
                score += 0.2

        # 5. Check for actual sentences (has periods, not just fragments)
        sentences = re.findall(r'[^.!?]*[.!?]', content)
        sentence_count = len([s for s in sentences if len(s.strip()) > 20])
        if sentence_count < 5:
            reasons.append(f"Too few complete sentences ({sentence_count})")
        else:
            score += 0.2

        # Determine validity - need at least 0.5 score and no critical reasons
        is_valid = score >= 0.5 and word_count >= 100

        # If valid but marginal, log a warning
        if is_valid and score < 0.7:
            logger.info(f"Content quality marginal: score={score:.2f}, words={word_count}, paragraphs={paragraph_count}")

        return {
            "is_valid": is_valid,
            "score": score,
            "reasons": reasons,
            "stats": {
                "word_count": word_count,
                "paragraph_count": paragraph_count,
                "header_count": header_count,
                "sentence_count": sentence_count,
                "link_count": link_count,
            }
        }

    def _clean_fetched_content(self, content: str) -> str:
        """Clean fetched content to remove repetitive navigation and boilerplate.

        Jina Reader often includes navigation headers and footers that get
        repeated throughout the document. This method removes those patterns.

        Args:
            content: Raw content from Jina Reader or similar service.

        Returns:
            Cleaned content with navigation removed.
        """
        import re

        lines = content.split('\n')
        cleaned_lines = []

        # Patterns that indicate navigation/boilerplate to remove
        nav_patterns = [
            r'^\s*\*\s*\[Skip to',  # Skip links
            r'^\s*\*\s*\[Cisco\.com',  # Site navigation
            r'^\s*\*\s*\[Products and Services\]',
            r'^\s*\*\s*\[Solutions\]',
            r'^\s*\*\s*\[Support\]',
            r'^\s*\*\s*\[Learn\]',
            r'^\s*\*\s*\[How to Buy\]',
            r'^\s*\*\s*\[Partners',
            r'^\s*\*\s*\[Find a Cisco Partner\]',
            r'^\s*\*\s*\[Become a Cisco Partner\]',
            r'^###\s*Available Languages',
            r'^###\s*Download Options',
            r'^\s*\*\s*\[PDF\]\(',  # Download links (isolated)
            r'^\s*\*\s*\[Ordering\]\(',
            r'^\s*\[\]\(https://www\.cisco\.com',  # Empty links
        ]

        # Compile patterns for efficiency
        compiled_patterns = [re.compile(p, re.IGNORECASE) for p in nav_patterns]

        # Track consecutive navigation lines to remove header blocks
        nav_block_count = 0
        skip_until_content = False

        for i, line in enumerate(lines):
            stripped = line.strip()

            # Check if this is a navigation line
            is_nav_line = any(p.search(line) for p in compiled_patterns)

            # Also check for empty markdown links: [](url)
            if re.match(r'^\s*\[\]\(https?://', stripped):
                is_nav_line = True

            # Check for isolated single-char or empty list items
            if re.match(r'^\s*\*\s*\[\s*\]', stripped):
                is_nav_line = True

            if is_nav_line:
                nav_block_count += 1
                # If we hit 3+ consecutive nav lines, we're in a nav block
                if nav_block_count >= 3:
                    skip_until_content = True
                continue
            else:
                nav_block_count = 0
                skip_until_content = False

            # Skip empty lines after navigation blocks
            if not stripped and skip_until_content:
                continue

            cleaned_lines.append(line)

        # Remove duplicate consecutive empty lines
        final_lines = []
        prev_empty = False
        for line in cleaned_lines:
            is_empty = not line.strip()
            if is_empty and prev_empty:
                continue
            final_lines.append(line)
            prev_empty = is_empty

        # Remove "### Available Languages" and "### Download Options" headers that appear repeatedly
        result = '\n'.join(final_lines)

        # Remove repeated navigation sections (these appear before each content section)
        result = re.sub(
            r'###\s*Available Languages\s*\n+###\s*Download Options\s*\n+',
            '',
            result,
            flags=re.IGNORECASE
        )

        # Remove "Table of Contents" headers that appear repeatedly
        result = re.sub(
            r'^#{2,4}\s*Table of Contents\s*\n+',
            '',
            result,
            flags=re.IGNORECASE | re.MULTILINE
        )

        # Remove "Bias-Free Language" boilerplate headers
        result = re.sub(
            r'^#{2,4}\s*Bias-Free Language\s*\n+',
            '',
            result,
            flags=re.IGNORECASE | re.MULTILINE
        )

        # Remove isolated empty link blocks
        result = re.sub(
            r'(\[\]\(https://www\.cisco\.com[^\)]+\)\s*)+',
            '',
            result
        )

        # Remove excessive whitespace
        result = re.sub(r'\n{4,}', '\n\n\n', result)

        logger.info(f"Content cleaning: {len(content)} -> {len(result)} chars ({len(content) - len(result)} removed)")

        return result.strip()

    async def delete_document(
        self,
        session: AsyncSession,
        document_id: int
    ) -> bool:
        """Delete a document and its chunks.

        Args:
            session: Database session.
            document_id: ID of document to delete.

        Returns:
            True if deleted, False if not found.
        """
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            return False

        await session.delete(document)  # Cascades to chunks
        await session.commit()

        # Invalidate search and response caches since document content changed
        try:
            cache = get_knowledge_cache()
            await cache.invalidate_by_document(str(document_id))
            logger.debug(f"Invalidated caches after document deletion: {document_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache after delete: {e}")

        logger.info(f"Deleted document {document_id}: {document.filename}")
        return True

    async def update_document(
        self,
        session: AsyncSession,
        document_id: int,
        new_content: str
    ) -> Optional[KnowledgeDocument]:
        """Update a document's content and re-embed.

        Args:
            session: Database session.
            document_id: ID of document to update.
            new_content: New document content.

        Returns:
            Updated document or None if not found.
        """
        result = await session.execute(
            select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            return None

        # Delete old chunks
        await session.execute(
            text("DELETE FROM knowledge_chunks WHERE document_id = :doc_id"),
            {"doc_id": document_id}
        )

        # Update hash
        document.content_hash = self._compute_content_hash(new_content)
        document.updated_at = datetime.utcnow()

        # Re-chunk and embed
        if document.filename.endswith('.md'):
            chunks = self.chunker.chunk_markdown(new_content)
        else:
            chunks = self.chunker.chunk_text(new_content)

        # Validate chunks for quality
        valid_chunks, rejected_chunks = validate_chunks(chunks, document.doc_type)
        chunks = valid_chunks

        if not chunks:
            raise ValueError("Updated content produced no valid chunks after quality filtering")

        chunk_texts = [c['content'] for c in chunks]
        embeddings = await self.embedding_service.generate_embeddings_batch(chunk_texts)

        for chunk_data, embedding in zip(chunks, embeddings):
            chunk = KnowledgeChunk(
                document_id=document.id,
                chunk_index=chunk_data['chunk_index'],
                content=chunk_data['content'],
                content_tokens=chunk_data['tokens'],
                quality_score=chunk_data.get('quality_score'),
                chunk_metadata=chunk_data['metadata'],
                embedding=embedding,
                created_at=datetime.utcnow()
            )
            session.add(chunk)

        document.total_chunks = len(chunks)
        await session.commit()

        # Invalidate search and response caches since document content changed
        try:
            cache = get_knowledge_cache()
            await cache.invalidate_by_document(str(document_id))
            logger.debug(f"Invalidated caches after document update: {document_id}")
        except Exception as e:
            logger.warning(f"Failed to invalidate cache after update: {e}")

        return document


# Singleton instance
_ingestion_service: Optional[DocumentIngestionService] = None


def get_ingestion_service() -> DocumentIngestionService:
    """Get or create singleton ingestion service."""
    global _ingestion_service
    if _ingestion_service is None:
        _ingestion_service = DocumentIngestionService()
    return _ingestion_service
