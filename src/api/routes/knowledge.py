"""API routes for RAG knowledge base.

Provides endpoints for:
- Querying the knowledge base
- Getting implementation plans
- Managing documents (admin only)
- Bulk discovery and import
- Knowledge base statistics
"""

import asyncio
import json
import logging
from typing import Optional, List, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.api.dependencies import get_db_session, get_current_user_from_session, require_admin
from src.models.user import User
from src.models.knowledge import (
    DocumentCreate,
    DocumentResponse,
    KnowledgeQueryRequest,
    KnowledgeTextResponse,
    KnowledgeResponse
)
from src.services.knowledge_service import get_knowledge_service
from src.services.document_ingestion_service import get_ingestion_service
from src.services.bulk_discovery_service import (
    get_bulk_discovery_service,
    DiscoveredURL,
    ImportResult,
)
from src.services.post_ingestion_hooks import get_post_ingestion_hooks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# =============================================================================
# Query Endpoints
# =============================================================================

@router.post("/query", response_model=KnowledgeTextResponse)
async def query_knowledge_base(
    request: KnowledgeQueryRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Query the knowledge base for information.

    This endpoint performs semantic search over the knowledge base
    and generates a response using the retrieved context.

    Args:
        request: Query request with question and optional filters.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Response with answer, sources, and confidence score.
    """
    service = get_knowledge_service()

    try:
        response = await service.query_knowledge(
            session=db,
            request=request,
            user_id=current_user.id
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Knowledge query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process query")


class ImplementationPlanRequest(BaseModel):
    """Request for implementation plan."""
    query: str
    environment: dict  # Current environment context
    filters: Optional[dict] = None
    top_k: int = 10


@router.post("/implementation-plan", response_model=KnowledgeResponse)
async def get_implementation_plan(
    request: ImplementationPlanRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Get a structured implementation plan from the Knowledge Agent.

    This is the primary integration point for the Implementation Agent.
    It sends the current environment context and receives actionable steps.

    Args:
        request: Implementation plan request with environment context.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Structured implementation plan with steps, warnings, and sources.
    """
    service = get_knowledge_service()

    query_request = KnowledgeQueryRequest(
        query=request.query,
        context=request.environment,
        filters=request.filters,
        top_k=request.top_k
    )

    try:
        response = await service.get_implementation_plan(
            session=db,
            request=query_request,
            environment_context=request.environment
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Implementation plan generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate implementation plan")


class SearchRequest(BaseModel):
    """Request for semantic search."""
    query: str
    top_k: int = 10
    filters: Optional[dict] = None


class SearchResult(BaseModel):
    """Search result item."""
    id: int
    content: str
    document_filename: str
    document_title: Optional[str]
    document_type: str
    document_product: Optional[str]
    relevance: float


@router.post("/search", response_model=List[SearchResult])
async def search_knowledge_base(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Perform semantic search over the knowledge base.

    Returns raw search results without LLM generation.
    Useful for browsing or debugging.

    Args:
        request: Search request.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of matching chunks with relevance scores.
    """
    service = get_knowledge_service()

    try:
        chunks = await service.hybrid_search(
            session=db,
            query=request.query,
            top_k=request.top_k,
            filters=request.filters
        )

        return [
            SearchResult(
                id=c.id,
                content=c.content[:500] + "..." if len(c.content) > 500 else c.content,
                document_filename=c.document_filename,
                document_title=c.document_title,
                document_type=c.document_type,
                document_product=c.document_product,
                relevance=c.relevance
            )
            for c in chunks
        ]
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


class AdaptiveSearchRequest(BaseModel):
    """Request for adaptive search with automatic parameter tuning."""
    query: str
    filters: Optional[dict] = None
    override_params: Optional[dict] = None  # Override adaptive parameters


class QueryClassificationResponse(BaseModel):
    """Query classification details."""
    intent: str
    complexity: str
    complexity_score: float
    detected_products: List[str]
    detected_doc_types: List[str]
    confidence: float


class AdaptiveParametersResponse(BaseModel):
    """Adaptive parameters that were used."""
    top_k: int
    use_hyde: bool
    use_multi_query: bool
    num_query_variations: int
    use_mmr: bool
    mmr_diversity: float
    semantic_weight: float
    feedback_boost_weight: float
    doc_type_filters: List[str]
    product_filters: List[str]
    include_parent_context: bool


class AdaptiveSearchResponse(BaseModel):
    """Response from adaptive search including classification metadata."""
    results: List[SearchResult]
    classification: QueryClassificationResponse
    parameters: AdaptiveParametersResponse
    result_count: int


@router.post("/adaptive-search", response_model=AdaptiveSearchResponse)
async def adaptive_search(
    request: AdaptiveSearchRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Perform adaptive search with automatic parameter tuning.

    This endpoint classifies the query by intent and complexity,
    then automatically adjusts retrieval parameters for optimal results.

    Classification intents:
    - configuration: "How do I set up..."
    - troubleshooting: "Why is... not working"
    - explanation: "What is...?"
    - comparison: "What's the difference..."
    - validation: "Is this correct?"
    - optimization: "How can I improve..."

    Complexity levels:
    - simple: Single concept, uses fewer resources
    - moderate: Multiple concepts, standard retrieval
    - complex: Multi-hop reasoning, uses more resources

    Args:
        request: Adaptive search request with query and optional overrides.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Search results with classification and parameter metadata.
    """
    import time
    start_time = time.time()
    service = get_knowledge_service()

    try:
        chunks, classification, params = await service.adaptive_search(
            session=db,
            query=request.query,
            filters=request.filters,
            override_params=request.override_params,
        )

        # Calculate latency and log the search with classification
        latency_ms = int((time.time() - start_time) * 1000)
        await service.log_adaptive_search(
            session=db,
            query=request.query,
            results=chunks,
            classification=classification,
            params=params,
            user_id=current_user.id,
            latency_ms=latency_ms,
        )

        return AdaptiveSearchResponse(
            results=[
                SearchResult(
                    id=c.id,
                    content=c.content[:500] + "..." if len(c.content) > 500 else c.content,
                    document_filename=c.document_filename,
                    document_title=c.document_title,
                    document_type=c.document_type,
                    document_product=c.document_product,
                    relevance=c.relevance
                )
                for c in chunks
            ],
            classification=QueryClassificationResponse(
                intent=classification.intent.value,
                complexity=classification.complexity.value,
                complexity_score=classification.complexity_score,
                detected_products=classification.detected_products,
                detected_doc_types=classification.detected_doc_types,
                confidence=classification.confidence,
            ),
            parameters=AdaptiveParametersResponse(
                top_k=params.top_k,
                use_hyde=params.use_hyde,
                use_multi_query=params.use_multi_query,
                num_query_variations=params.num_query_variations,
                use_mmr=params.use_mmr,
                mmr_diversity=params.mmr_diversity,
                semantic_weight=params.semantic_weight,
                feedback_boost_weight=params.feedback_boost_weight,
                doc_type_filters=params.doc_type_filters,
                product_filters=params.product_filters,
                include_parent_context=params.include_parent_context,
            ),
            result_count=len(chunks),
        )
    except Exception as e:
        logger.error(f"Adaptive search failed: {e}")
        raise HTTPException(status_code=500, detail="Adaptive search failed")


# =============================================================================
# Document Management Endpoints (Admin Only)
# =============================================================================

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    doc_type: Optional[str] = Query(None, description="Filter by document type"),
    product: Optional[str] = Query(None, description="Filter by product"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """List documents in the knowledge base.

    Args:
        doc_type: Optional filter by document type.
        product: Optional filter by product.
        limit: Maximum results.
        offset: Pagination offset.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of documents.
    """
    from sqlalchemy import select
    from src.models.knowledge import KnowledgeDocument

    query = select(KnowledgeDocument)

    if doc_type:
        query = query.where(KnowledgeDocument.doc_type == doc_type)
    if product:
        query = query.where(KnowledgeDocument.product == product)

    query = query.order_by(KnowledgeDocument.updated_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    documents = result.scalars().all()

    return [DocumentResponse.model_validate(doc) for doc in documents]


@router.post("/documents", response_model=DocumentResponse)
async def create_document(
    content: str = Form(...),
    filename: str = Form(...),
    doc_type: str = Form(...),
    product: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Create a new document in the knowledge base.

    Requires ADMIN role.

    Args:
        content: Document content.
        filename: Document filename.
        doc_type: Document type.
        product: Product name.
        title: Document title.
        description: Brief description.
        version: Document version.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Created document.
    """
    service = get_ingestion_service()

    try:
        document = await service.ingest_text_document(
            session=db,
            content=content,
            filename=filename,
            doc_type=doc_type,
            product=product,
            title=title,
            description=description,
            version=version
        )
        return DocumentResponse.model_validate(document)
    except Exception as e:
        logger.error(f"Document creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create document: {str(e)}")


@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    product: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    version: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Upload a document file to the knowledge base.

    Supports .txt, .md, .json (OpenAPI specs), .pdf, and .docx files.
    Requires ADMIN role.

    Args:
        file: Uploaded file.
        doc_type: Document type.
        product: Product name.
        title: Document title.
        description: Brief description.
        version: Document version.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Created document.
    """
    # Read file content
    content = await file.read()
    filename = file.filename or "uploaded_document"
    suffix = filename.lower().split('.')[-1] if '.' in filename else ''

    service = get_ingestion_service()

    try:
        # Handle PDF files (binary)
        if suffix == 'pdf':
            document = await service.ingest_pdf_document(
                session=db,
                file_content=content,
                filename=filename,
                doc_type=doc_type,
                product=product,
                title=title,
                description=description,
                version=version
            )
        # Handle DOCX files (binary)
        elif suffix == 'docx':
            document = await service.ingest_docx_document(
                session=db,
                file_content=content,
                filename=filename,
                doc_type=doc_type,
                product=product,
                title=title,
                description=description,
                version=version
            )
        # Handle text-based files
        else:
            try:
                content_str = content.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text (or use PDF/DOCX format)")

            if suffix == 'md':
                document = await service.ingest_markdown_document(
                    session=db,
                    content=content_str,
                    filename=filename,
                    doc_type=doc_type,
                    product=product,
                    title=title,
                    description=description,
                    version=version
                )
            else:
                document = await service.ingest_text_document(
                    session=db,
                    content=content_str,
                    filename=filename,
                    doc_type=doc_type,
                    product=product,
                    title=title,
                    description=description,
                    version=version
                )

        return DocumentResponse.model_validate(document)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Document upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


class URLIngestRequest(BaseModel):
    """Request to ingest content from a URL."""
    url: str
    doc_type: str
    product: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


@router.post("/documents/from-url", response_model=DocumentResponse)
async def ingest_from_url(
    request: URLIngestRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Ingest a document from a webpage URL.

    Fetches the webpage, extracts content, and adds it to the knowledge base.
    Supports HTML pages, JSON (including OpenAPI specs), Markdown, and plain text.
    Requires ADMIN role.

    Args:
        request: URL ingestion request.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Created document.
    """
    service = get_ingestion_service()

    try:
        document = await service.ingest_from_url(
            session=db,
            url=request.url,
            doc_type=request.doc_type,
            product=request.product,
            title=request.title,
            description=request.description
        )
        return DocumentResponse.model_validate(document)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"URL ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest from URL: {str(e)}")


@router.get("/documents/{document_id}")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Get a document with its full content for viewing.

    Args:
        document_id: ID of the document.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Document with full content assembled from chunks.
    """
    from sqlalchemy import select
    from src.models.knowledge import KnowledgeDocument, KnowledgeChunk

    # Get document
    doc_result = await db.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get all chunks for this document
    chunks_result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.document_id == document_id)
        .order_by(KnowledgeChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()

    # Assemble full content from chunks
    full_content = "\n\n".join(c.content for c in chunks)

    return {
        "id": document.id,
        "title": document.title or document.filename,
        "doc_type": document.doc_type,
        "source_url": document.source_url,
        "content": full_content,
        "metadata": {
            "product": document.product,
            "version": document.version,
            "description": document.description,
            "filename": document.filename,
        },
        "created_at": document.created_at.isoformat() if document.created_at else None,
    }


@router.get("/documents/{document_id}/chunks")
async def get_document_chunks(
    document_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Get all chunks for a document.

    Args:
        document_id: ID of the document.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of chunks for the document.
    """
    from sqlalchemy import select
    from src.models.knowledge import KnowledgeChunk

    result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.document_id == document_id)
        .order_by(KnowledgeChunk.chunk_index)
    )
    chunks = result.scalars().all()

    if not chunks:
        raise HTTPException(status_code=404, detail="Document not found or has no chunks")

    return [
        {
            "id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "content_tokens": chunk.content_tokens,
        }
        for chunk in chunks
    ]


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Delete a document from the knowledge base.

    Also deletes all associated chunks.
    Requires ADMIN role.

    Args:
        document_id: ID of document to delete.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Success message.
    """
    service = get_ingestion_service()

    deleted = await service.delete_document(db, document_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"message": "Document deleted successfully"}


# =============================================================================
# Statistics Endpoints
# =============================================================================

@router.get("/stats")
async def get_knowledge_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Get knowledge base statistics.

    Args:
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Statistics about documents, chunks, and queries.
    """
    service = get_knowledge_service()

    try:
        stats = await service.get_stats(db)

        # Also calculate embedding coverage
        total_chunks = stats["chunks"]["total"]
        embedded_count_result = await db.execute(
            text("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL")
        )
        embedded_count = embedded_count_result.scalar() or 0
        embedding_coverage = embedded_count / total_chunks if total_chunks > 0 else 0

        # Return in format expected by UI
        return {
            "total_documents": stats["documents"]["total"],
            "total_chunks": total_chunks,
            "total_queries": stats["queries"]["total"],
            "documents_by_type": stats["documents"]["by_type"],
            "documents_by_product": stats["documents"]["by_product"],
            "embedding_coverage": embedding_coverage,
            "avg_latency_ms": stats["queries"]["avg_latency_ms"],
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")


# =============================================================================
# Internal API for Agent Communication
# =============================================================================

class AgentQueryRequest(BaseModel):
    """Internal request from Implementation Agent."""
    query: str
    environment_context: dict
    requesting_agent: str = "implementation_agent"
    session_id: Optional[str] = None


@router.post("/agent/query", response_model=KnowledgeResponse)
async def agent_query(
    request: AgentQueryRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Internal endpoint for agent-to-agent communication.

    This endpoint is used by the Implementation Agent to query
    the Knowledge Agent for implementation guidance.

    Note: This endpoint may have different authentication in production
    (e.g., internal service tokens vs user authentication).

    Args:
        request: Agent query request.
        db: Database session.

    Returns:
        Structured implementation response.
    """
    service = get_knowledge_service()

    query_request = KnowledgeQueryRequest(
        query=request.query,
        context=request.environment_context
    )

    try:
        response = await service.get_implementation_plan(
            session=db,
            request=query_request,
            environment_context=request.environment_context
        )

        logger.info(
            f"Agent query processed",
            extra={
                "requesting_agent": request.requesting_agent,
                "session_id": request.session_id,
                "confidence": response.confidence
            }
        )

        return response
    except Exception as e:
        logger.error(f"Agent query failed: {e}")
        raise HTTPException(status_code=500, detail="Agent query processing failed")


# =============================================================================
# Feedback Endpoints
# =============================================================================

from src.models.knowledge import KnowledgeFeedback, FeedbackCreate, FeedbackResponse


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    feedback: FeedbackCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Submit feedback on a knowledge search result or AI answer.

    Args:
        feedback: Feedback data including type, target, and optional comment.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Created feedback record.
    """
    try:
        feedback_record = KnowledgeFeedback(
            user_id=current_user.id,
            query_text=feedback.query,
            feedback_type=feedback.feedback_type,
            feedback_target=feedback.feedback_target,
            chunk_id=feedback.chunk_id,
            rating=feedback.rating,
            comment=feedback.comment,
            feedback_metadata=feedback.metadata,
        )

        db.add(feedback_record)
        await db.commit()
        await db.refresh(feedback_record)

        logger.info(
            f"Feedback submitted",
            extra={
                "user_id": current_user.id,
                "feedback_type": feedback.feedback_type,
                "feedback_target": feedback.feedback_target,
                "chunk_id": feedback.chunk_id,
            }
        )

        return FeedbackResponse.model_validate(feedback_record)
    except Exception as e:
        logger.error(f"Failed to submit feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.get("/feedback/stats")
async def get_feedback_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user_from_session)
):
    """Get aggregated feedback statistics.

    Returns:
        Feedback statistics including positive/negative counts.
    """
    try:
        from sqlalchemy import func

        # Get feedback counts by type and target
        result = await db.execute(
            text("""
                SELECT
                    feedback_target,
                    feedback_type,
                    COUNT(*) as count
                FROM knowledge_feedback
                GROUP BY feedback_target, feedback_type
            """)
        )
        rows = result.fetchall()

        stats = {
            "ai_answer": {"positive": 0, "negative": 0, "total": 0},
            "search_result": {"positive": 0, "negative": 0, "total": 0},
        }

        for row in rows:
            target = row[0]
            fb_type = row[1]
            count = row[2]
            if target in stats:
                if fb_type in ["positive", "negative"]:
                    stats[target][fb_type] = count
                stats[target]["total"] += count

        return stats
    except Exception as e:
        logger.error(f"Failed to get feedback stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get feedback statistics")


# =============================================================================
# Bulk Discovery and Import Endpoints (Admin Only)
# =============================================================================

class BulkDiscoveryRequest(BaseModel):
    """Request for bulk URL discovery."""
    query: str
    max_results: int = 20
    use_ai_search: bool = True
    use_sitemap_crawl: bool = True
    product_filter: Optional[str] = None


class DiscoveredURLResponse(BaseModel):
    """Response model for a discovered URL."""
    url: str
    title: str
    description: str
    source: str
    doc_type_suggestion: str
    product_suggestion: str
    relevance_score: float
    blocked: bool = False
    blocked_reason: Optional[str] = None


class BulkDiscoveryResponse(BaseModel):
    """Response from bulk discovery endpoint."""
    query: str
    total: int
    urls: List[DiscoveredURLResponse]


@router.post("/bulk/discover", response_model=BulkDiscoveryResponse)
async def discover_documentation(
    request: BulkDiscoveryRequest,
    _admin: User = Depends(require_admin)
):
    """Discover Cisco documentation URLs for a product/topic.

    Searches official Cisco documentation sites and returns a list
    of URLs with AI-suggested metadata. Blocked URLs (blogs, community)
    are marked but still returned for transparency.

    Requires ADMIN role.

    Args:
        request: Discovery request with query and options.
        _admin: Admin user (for authorization).

    Returns:
        List of discovered URLs with metadata suggestions.
    """
    service = get_bulk_discovery_service()

    try:
        urls = await service.discover_urls(
            query=request.query,
            max_results=request.max_results,
            use_ai_search=request.use_ai_search,
            use_sitemap_crawl=request.use_sitemap_crawl,
            product_filter=request.product_filter,
        )

        return BulkDiscoveryResponse(
            query=request.query,
            total=len(urls),
            urls=[
                DiscoveredURLResponse(
                    url=u.url,
                    title=u.title,
                    description=u.description,
                    source=u.source,
                    doc_type_suggestion=u.doc_type_suggestion,
                    product_suggestion=u.product_suggestion,
                    relevance_score=u.relevance_score,
                    blocked=u.blocked,
                    blocked_reason=u.blocked_reason,
                )
                for u in urls
            ]
        )
    except Exception as e:
        logger.error(f"Bulk discovery failed: {e}")
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")


class UrlToImport(BaseModel):
    """A URL to import with optional metadata overrides."""
    url: str
    title: Optional[str] = None
    doc_type: Optional[str] = None
    product: Optional[str] = None


class BulkImportRequest(BaseModel):
    """Request for bulk import."""
    urls: List[UrlToImport]


async def bulk_import_generator(
    urls: List[UrlToImport],
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for bulk import progress.

    Args:
        urls: URLs to import.
        db: Database session.

    Yields:
        SSE-formatted event strings.
    """
    from datetime import datetime, timedelta

    service = get_ingestion_service()
    total = len(urls)
    success_count = 0
    duplicate_count = 0
    skipped_count = 0
    error_count = 0

    # Send start event
    yield f"data: {json.dumps({'type': 'import_start', 'total': total})}\n\n"

    for idx, url_info in enumerate(urls):
        current = idx + 1

        try:
            # Track time before import to detect duplicates
            import_start = datetime.utcnow()

            # Import the URL
            document = await service.ingest_from_url(
                session=db,
                url=url_info.url,
                doc_type=url_info.doc_type or "guide",
                product=url_info.product,
                title=url_info.title,
            )

            # Check if it was a duplicate by comparing creation time
            # If document was created more than 1 second ago, it's a duplicate
            is_duplicate = document.created_at < import_start - timedelta(seconds=1)

            if is_duplicate:
                duplicate_count += 1
                yield f"data: {json.dumps({'type': 'import_progress', 'current': current, 'total': total, 'url': url_info.url, 'status': 'duplicate', 'title': document.title, 'document_id': document.id})}\n\n"
            elif document.total_chunks == 0:
                # This is an edge case - document exists but has no chunks
                # This shouldn't happen with proper rollback, but handle gracefully
                logger.warning(f"Document {url_info.url} has 0 chunks - marking as error")
                error_count += 1
                yield f"data: {json.dumps({'type': 'import_progress', 'current': current, 'total': total, 'url': url_info.url, 'status': 'error', 'error': 'Document has no valid content chunks. Page may be a navigation/index page with no documentation content.'})}\n\n"
            else:
                success_count += 1
                yield f"data: {json.dumps({'type': 'import_progress', 'current': current, 'total': total, 'url': url_info.url, 'status': 'success', 'title': document.title, 'document_id': document.id, 'chunk_count': document.total_chunks})}\n\n"

        except ValueError as e:
            # ValueError is raised for quality/content issues (no valid chunks, sparse content, etc.)
            skipped_count += 1
            error_msg = str(e)
            # Make the error message more user-friendly
            if "no valid chunks" in error_msg.lower():
                error_msg = "Page content is not suitable for knowledge base (may be navigation/index page)"
            elif "sparse" in error_msg.lower():
                error_msg = "Page has insufficient documentation content"
            logger.warning(f"Content quality issue for {url_info.url}: {e}")
            yield f"data: {json.dumps({'type': 'import_progress', 'current': current, 'total': total, 'url': url_info.url, 'status': 'skipped', 'error': error_msg})}\n\n"

        except Exception as e:
            error_count += 1
            logger.error(f"Failed to import {url_info.url}: {e}")
            yield f"data: {json.dumps({'type': 'import_progress', 'current': current, 'total': total, 'url': url_info.url, 'status': 'error', 'error': str(e)})}\n\n"

        # Small delay to prevent overwhelming the client
        await asyncio.sleep(0.1)

    # Run post-bulk-import hygiene if we had any successful imports
    hygiene_stats = {}
    if success_count > 0:
        try:
            yield f"data: {json.dumps({'type': 'hygiene_start', 'message': 'Running knowledge base hygiene...'})}\n\n"

            hooks = get_post_ingestion_hooks()
            # Note: We don't have access to document_ids here since we didn't track them
            # Run a quick cleanup on the entire KB
            hygiene_stats = await hooks.on_bulk_import_complete(
                session=db,
                document_ids=[],  # Empty list triggers full hygiene
                run_full_hygiene=True,
            )

            yield f"data: {json.dumps({'type': 'hygiene_complete', 'duplicates_removed': hygiene_stats.get('duplicates_removed', 0), 'documents_affected': hygiene_stats.get('documents_affected', 0), 'duration_ms': hygiene_stats.get('duration_ms', 0)})}\n\n"

        except Exception as e:
            logger.error(f"Post-import hygiene failed: {e}")
            yield f"data: {json.dumps({'type': 'hygiene_error', 'error': str(e)})}\n\n"

    # Send complete event
    yield f"data: {json.dumps({'type': 'import_complete', 'success': success_count, 'duplicates': duplicate_count, 'skipped': skipped_count, 'errors': error_count, 'hygiene': hygiene_stats})}\n\n"


@router.post("/bulk/import")
async def bulk_import_documents(
    request: BulkImportRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Import multiple URLs with real-time progress updates.

    Returns a Server-Sent Events (SSE) stream with progress updates
    for each URL being imported.

    Event types:
    - import_start: {total: number}
    - import_progress: {current, total, url, status, title?, error?}
    - import_complete: {success, duplicates, errors}

    Requires ADMIN role.

    Args:
        request: Import request with list of URLs.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        StreamingResponse with SSE events.
    """
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    if len(request.urls) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 URLs per request")

    return StreamingResponse(
        bulk_import_generator(request.urls, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


class BulkImportStatusResponse(BaseModel):
    """Response for bulk import job status."""
    id: str
    query: str
    status: str
    progress: int
    total_urls: int
    results: List[dict]


@router.get("/bulk/jobs/{job_id}")
async def get_bulk_job_status(
    job_id: str,
    _admin: User = Depends(require_admin)
) -> BulkImportStatusResponse:
    """Get status of a bulk import job.

    Requires ADMIN role.

    Args:
        job_id: Job ID.
        _admin: Admin user (for authorization).

    Returns:
        Job status and results.
    """
    service = get_bulk_discovery_service()
    job = service.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return BulkImportStatusResponse(
        id=job.id,
        query=job.query,
        status=job.status,
        progress=job.progress,
        total_urls=len(job.urls),
        results=[
            {
                "url": r.url,
                "status": r.status,
                "document_id": r.document_id,
                "chunk_count": r.chunk_count,
                "title": r.title,
                "error": r.error,
            }
            for r in job.results
        ]
    )


# =============================================================================
# Knowledge Base Hygiene Endpoints (Admin Only)
# =============================================================================

from src.services.knowledge_hygiene_service import (
    get_hygiene_service,
    HygieneReport,
    CleanupAction,
    IssueType,
)
from src.services.document_merge_service import (
    get_merge_service,
    MergeGroup,
    MergeCandidate,
    MergePreview,
    MergeResult,
)


class HygieneAnalyzeRequest(BaseModel):
    """Request for hygiene analysis."""
    check_duplicates: bool = True
    check_quality: bool = True
    check_orphans: bool = True
    duplicate_threshold: float = 0.9
    min_quality_score: float = 0.3


class ChunkInfoResponse(BaseModel):
    """Chunk info in API response."""
    id: int
    document_id: int
    document_filename: str
    content_preview: str
    content_length: int
    quality_score: Optional[float]
    chunk_index: int


class DuplicateGroupResponse(BaseModel):
    """Duplicate group in API response."""
    similarity: float
    keep_chunk: ChunkInfoResponse
    remove_chunks: List[ChunkInfoResponse]


class LowQualityChunkResponse(BaseModel):
    """Low quality chunk in API response."""
    chunk: ChunkInfoResponse
    quality_score: float
    reason: str


class HygieneReportResponse(BaseModel):
    """Full hygiene report response."""
    analyzed_at: str
    total_chunks: int
    total_documents: int
    duplicate_groups: List[DuplicateGroupResponse]
    low_quality_chunks: List[LowQualityChunkResponse]
    orphaned_chunk_ids: List[int]
    duplicate_count: int
    low_quality_count: int
    orphaned_count: int


@router.post("/hygiene/analyze", response_model=HygieneReportResponse)
async def analyze_knowledge_base(
    request: HygieneAnalyzeRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Analyze knowledge base for quality issues.

    Checks for duplicates, low-quality chunks, and orphaned chunks
    without making any changes. Returns a detailed report.

    Requires ADMIN role.

    Args:
        request: Analysis options.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Detailed hygiene report.
    """
    service = get_hygiene_service()
    service.duplicate_threshold = request.duplicate_threshold
    service.min_quality_score = request.min_quality_score

    try:
        report = await service.analyze_knowledge_base(
            session=db,
            check_duplicates=request.check_duplicates,
            check_quality=request.check_quality,
            check_orphans=request.check_orphans,
        )

        return HygieneReportResponse(
            analyzed_at=report.analyzed_at.isoformat(),
            total_chunks=report.total_chunks,
            total_documents=report.total_documents,
            duplicate_groups=[
                DuplicateGroupResponse(
                    similarity=g.similarity,
                    keep_chunk=ChunkInfoResponse(
                        id=g.keep_chunk.id,
                        document_id=g.keep_chunk.document_id,
                        document_filename=g.keep_chunk.document_filename,
                        content_preview=g.keep_chunk.content_preview,
                        content_length=g.keep_chunk.content_length,
                        quality_score=g.keep_chunk.quality_score,
                        chunk_index=g.keep_chunk.chunk_index,
                    ),
                    remove_chunks=[
                        ChunkInfoResponse(
                            id=c.id,
                            document_id=c.document_id,
                            document_filename=c.document_filename,
                            content_preview=c.content_preview,
                            content_length=c.content_length,
                            quality_score=c.quality_score,
                            chunk_index=c.chunk_index,
                        )
                        for c in g.remove_chunks
                    ]
                )
                for g in report.duplicate_groups
            ],
            low_quality_chunks=[
                LowQualityChunkResponse(
                    chunk=ChunkInfoResponse(
                        id=lq.chunk.id,
                        document_id=lq.chunk.document_id,
                        document_filename=lq.chunk.document_filename,
                        content_preview=lq.chunk.content_preview,
                        content_length=lq.chunk.content_length,
                        quality_score=lq.chunk.quality_score,
                        chunk_index=lq.chunk.chunk_index,
                    ),
                    quality_score=lq.quality_score,
                    reason=lq.reason,
                )
                for lq in report.low_quality_chunks
            ],
            orphaned_chunk_ids=report.orphaned_chunk_ids,
            duplicate_count=report.duplicate_count,
            low_quality_count=report.low_quality_count,
            orphaned_count=report.orphaned_count,
        )
    except Exception as e:
        logger.error(f"Hygiene analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


class CleanupActionRequest(BaseModel):
    """A cleanup action to perform."""
    action: str  # "delete_chunk"
    target_id: int
    reason: str
    issue_type: str  # "duplicate", "low_quality", "orphaned"


class ApplyCleanupRequest(BaseModel):
    """Request to apply cleanup actions."""
    actions: List[CleanupActionRequest]


class CleanupResultResponse(BaseModel):
    """Result of cleanup operation."""
    success: bool
    chunks_deleted: int
    documents_affected: int
    errors: List[str]


@router.post("/hygiene/apply", response_model=CleanupResultResponse)
async def apply_hygiene_cleanup(
    request: ApplyCleanupRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Apply selected cleanup actions.

    Deletes the specified chunks from the knowledge base.
    Requires ADMIN role.

    Args:
        request: Cleanup actions to apply.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Cleanup result with stats.
    """
    service = get_hygiene_service()

    try:
        # Convert request actions to service actions
        actions = [
            CleanupAction(
                action=a.action,
                target_id=a.target_id,
                reason=a.reason,
                issue_type=IssueType(a.issue_type),
            )
            for a in request.actions
        ]

        result = await service.apply_cleanup(db, actions)

        return CleanupResultResponse(
            success=result.success,
            chunks_deleted=result.chunks_deleted,
            documents_affected=result.documents_affected,
            errors=result.errors,
        )
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


class QuickCleanupRequest(BaseModel):
    """Request for quick cleanup."""
    remove_duplicates: bool = True
    remove_low_quality: bool = True
    remove_orphans: bool = True


@router.post("/hygiene/quick-cleanup", response_model=CleanupResultResponse)
async def quick_hygiene_cleanup(
    request: QuickCleanupRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Perform quick cleanup with default settings.

    Analyzes the knowledge base and immediately removes all
    duplicates, low-quality chunks, and orphans based on settings.

    Requires ADMIN role.

    Args:
        request: Quick cleanup options.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Cleanup result with stats.
    """
    service = get_hygiene_service()

    try:
        result = await service.quick_cleanup(
            session=db,
            remove_duplicates=request.remove_duplicates,
            remove_low_quality=request.remove_low_quality,
            remove_orphans=request.remove_orphans,
        )

        return CleanupResultResponse(
            success=result.success,
            chunks_deleted=result.chunks_deleted,
            documents_affected=result.documents_affected,
            errors=result.errors,
        )
    except Exception as e:
        logger.error(f"Quick cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Quick cleanup failed: {str(e)}")


@router.post("/hygiene/rescore")
async def rescore_chunks(
    limit: int = Query(1000, description="Maximum chunks to rescore"),
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
):
    """Re-score chunks that don't have quality scores.

    Useful after adding new quality criteria or for chunks
    imported before quality scoring was added.

    Requires ADMIN role.

    Args:
        limit: Maximum chunks to rescore.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Number of chunks rescored.
    """
    service = get_hygiene_service()

    try:
        count = await service.rescore_chunks(db, limit=limit)
        return {"rescored": count}
    except Exception as e:
        logger.error(f"Rescore failed: {e}")
        raise HTTPException(status_code=500, detail=f"Rescore failed: {str(e)}")


# =============================================================================
# Document Merge Endpoints
# =============================================================================

class MergeCandidateResponse(BaseModel):
    """Response for a merge candidate document."""
    document_id: int
    title: str
    filename: str
    chunk_count: int
    product: Optional[str]
    doc_type: Optional[str]
    device_model: Optional[str]


class MergeGroupResponse(BaseModel):
    """Response for a merge group."""
    group_key: str
    product: Optional[str]
    doc_type: Optional[str]
    device_model: Optional[str]
    document_count: int
    total_chunks: int
    documents: List[MergeCandidateResponse]


class MergePreviewResponse(BaseModel):
    """Response for merge preview."""
    merged_title: str
    merged_description: str
    total_chunks_before: int
    estimated_chunks_after: int
    duplicate_chunks: int
    source_urls: List[str]
    documents_to_delete: List[int]
    group: MergeGroupResponse


class MergeExecuteRequest(BaseModel):
    """Request to execute a merge."""
    document_ids: List[int]
    merged_title: Optional[str] = None
    merged_description: Optional[str] = None


class MergeResultResponse(BaseModel):
    """Response for executed merge."""
    new_document_id: int
    merged_title: str
    documents_merged: int
    chunks_before: int
    chunks_after: int
    duplicates_removed: int
    duration_ms: int


@router.get("/merge/candidates", response_model=List[MergeGroupResponse])
async def get_merge_candidates(
    min_documents: int = Query(default=2, ge=2, le=10),
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
) -> List[MergeGroupResponse]:
    """Find documents that are candidates for merging.

    Documents are grouped by:
    - Same product (meraki, catalyst, etc.)
    - Same doc_type (guide, api_spec, etc.)
    - Similar device model extracted from title

    Requires ADMIN role.

    Args:
        min_documents: Minimum documents in a group.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        List of merge candidate groups.
    """
    service = get_merge_service()

    try:
        groups = await service.find_merge_candidates(db, min_documents=min_documents)

        return [
            MergeGroupResponse(
                group_key=g.group_key,
                product=g.product,
                doc_type=g.doc_type,
                device_model=g.device_model,
                document_count=g.document_count,
                total_chunks=g.total_chunks,
                documents=[
                    MergeCandidateResponse(
                        document_id=d.document_id,
                        title=d.title,
                        filename=d.filename,
                        chunk_count=d.chunk_count,
                        product=d.product,
                        doc_type=d.doc_type,
                        device_model=d.device_model,
                    )
                    for d in g.documents
                ]
            )
            for g in groups
        ]

    except Exception as e:
        logger.error(f"Failed to find merge candidates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to find merge candidates: {str(e)}")


@router.post("/merge/preview", response_model=MergePreviewResponse)
async def preview_merge(
    request: MergeExecuteRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
) -> MergePreviewResponse:
    """Preview what a merge operation would do.

    Shows the merged title, estimated chunk count after deduplication,
    and which documents would be deleted.

    Requires ADMIN role.

    Args:
        request: Merge request with document IDs.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Merge preview with details.
    """
    if len(request.document_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 documents required for merge")

    service = get_merge_service()

    try:
        preview = await service.preview_merge(db, request.document_ids)

        return MergePreviewResponse(
            merged_title=preview.merged_title,
            merged_description=preview.merged_description,
            total_chunks_before=preview.total_chunks_before,
            estimated_chunks_after=preview.estimated_chunks_after,
            duplicate_chunks=preview.duplicate_chunks,
            source_urls=preview.source_urls,
            documents_to_delete=preview.documents_to_delete,
            group=MergeGroupResponse(
                group_key=preview.group.group_key,
                product=preview.group.product,
                doc_type=preview.group.doc_type,
                device_model=preview.group.device_model,
                document_count=preview.group.document_count,
                total_chunks=preview.group.total_chunks,
                documents=[
                    MergeCandidateResponse(
                        document_id=d.document_id,
                        title=d.title,
                        filename=d.filename,
                        chunk_count=d.chunk_count,
                        product=d.product,
                        doc_type=d.doc_type,
                        device_model=d.device_model,
                    )
                    for d in preview.group.documents
                ]
            )
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to preview merge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to preview merge: {str(e)}")


@router.post("/merge/execute", response_model=MergeResultResponse)
async def execute_merge(
    request: MergeExecuteRequest,
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
) -> MergeResultResponse:
    """Execute a merge operation.

    Creates a new consolidated document with deduplicated chunks
    and deletes the original documents.

    Requires ADMIN role.

    Args:
        request: Merge request with document IDs and optional title/description.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Merge result with statistics.
    """
    if len(request.document_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 documents required for merge")

    service = get_merge_service()

    try:
        result = await service.execute_merge(
            db,
            request.document_ids,
            merged_title=request.merged_title,
            merged_description=request.merged_description,
        )

        return MergeResultResponse(
            new_document_id=result.new_document_id,
            merged_title=result.merged_title,
            documents_merged=result.documents_merged,
            chunks_before=result.chunks_before,
            chunks_after=result.chunks_after,
            duplicates_removed=result.duplicates_removed,
            duration_ms=result.duration_ms,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to execute merge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute merge: {str(e)}")


@router.post("/merge/auto")
async def auto_merge_all(
    min_documents: int = Query(default=2, ge=2, le=10),
    dry_run: bool = Query(default=True),
    db: AsyncSession = Depends(get_db_session),
    _admin: User = Depends(require_admin)
) -> dict:
    """Automatically merge all candidate document groups.

    Use dry_run=True to preview what would be merged without executing.

    Requires ADMIN role.

    Args:
        min_documents: Minimum documents in a group to merge.
        dry_run: If True, only return previews without executing.
        db: Database session.
        _admin: Admin user (for authorization).

    Returns:
        Summary of merge operations.
    """
    service = get_merge_service()

    try:
        if dry_run:
            groups = await service.find_merge_candidates(db, min_documents=min_documents)
            return {
                "dry_run": True,
                "groups_found": len(groups),
                "groups": [
                    {
                        "group_key": g.group_key,
                        "document_count": g.document_count,
                        "total_chunks": g.total_chunks,
                        "device_model": g.device_model,
                    }
                    for g in groups
                ]
            }
        else:
            results = await service.auto_merge_all(db, min_documents=min_documents, dry_run=False)
            return {
                "dry_run": False,
                "merges_executed": len(results),
                "results": [
                    {
                        "new_document_id": r.new_document_id,
                        "merged_title": r.merged_title,
                        "documents_merged": r.documents_merged,
                        "duplicates_removed": r.duplicates_removed,
                    }
                    for r in results
                ]
            }

    except Exception as e:
        logger.error(f"Auto merge failed: {e}")
        raise HTTPException(status_code=500, detail=f"Auto merge failed: {str(e)}")
