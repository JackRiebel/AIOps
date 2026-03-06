"""API routes for structured data RAG — dataset management, NL→SQL queries, glossary, schema metadata, and Ollama status."""

import json
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db_session, get_current_user_from_session
from src.models.user import User
from src.models.structured_dataset import (
    StructuredDataset, StructuredQueryLog, SchemaMetadata, BusinessGlossary,
)
from src.services.structured_data_service import StructuredDataService
from src.services.sql_rag_service import SQLRAGService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/structured-data", tags=["Structured Data"])

_data_service = StructuredDataService()
_sql_service = SQLRAGService()


# =============================================================================
# Pydantic schemas
# =============================================================================

class QueryRequest(BaseModel):
    question: str
    provider: Optional[str] = None
    auto_execute: bool = False
    include_metadata: bool = False


class ExecuteRequest(BaseModel):
    sql: str
    max_rows: int = 500


class InterpretRequest(BaseModel):
    question: str
    sql: str
    results: dict
    provider: Optional[str] = None
    include_metadata: bool = False


class FeedbackRequest(BaseModel):
    feedback: str  # "good" or "bad"


class SchemaMetadataUpdate(BaseModel):
    description: Optional[str] = None
    sample_values: Optional[str] = None
    business_term: Optional[str] = None
    is_filterable: Optional[bool] = None
    is_metric: Optional[bool] = None


class GlossaryCreate(BaseModel):
    term: str
    synonyms: Optional[str] = None
    definition: str
    sql_expression: str
    applies_to: Optional[str] = None


class GlossaryUpdate(BaseModel):
    term: Optional[str] = None
    synonyms: Optional[str] = None
    definition: Optional[str] = None
    sql_expression: Optional[str] = None
    applies_to: Optional[str] = None


# =============================================================================
# Dataset CRUD
# =============================================================================

@router.post("/datasets/analyze-columns")
async def analyze_columns(
    file: UploadFile = File(...),
    provider: Optional[str] = Form(None),
    user: User = Depends(get_current_user_from_session),
):
    """Parse a file and use the LLM to suggest explicit, self-describing column names.

    Returns suggested renames that the user can review/edit before uploading.
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    lower = file.filename.lower()
    if not lower.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Unsupported file type. Use .xlsx, .xls, or .csv")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 100 MB)")

    try:
        return await _data_service.analyze_columns(content, file.filename, provider)
    except Exception as e:
        logger.exception(f"Column analysis failed: {e}")
        raise HTTPException(500, f"Column analysis failed: {str(e)}")


@router.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    column_renames: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Upload an Excel or CSV file to create a new dataset.

    Args:
        file: Excel or CSV file
        name: Optional dataset name
        column_renames: Optional JSON string mapping original column names to new names
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    lower = file.filename.lower()
    if not lower.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Unsupported file type. Use .xlsx, .xls, or .csv")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 100 MB)")

    # Parse column renames JSON if provided
    renames_dict = None
    if column_renames:
        try:
            renames_dict = json.loads(column_renames)
            if not isinstance(renames_dict, dict):
                raise ValueError("column_renames must be a JSON object")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(400, f"Invalid column_renames JSON: {str(e)}")

    try:
        dataset = await _data_service.ingest_file(
            session, content, file.filename, name, column_renames=renames_dict
        )
        await session.commit()
        return _dataset_to_dict(dataset)
    except Exception as e:
        logger.exception(f"Failed to upload dataset: {e}")
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.get("/datasets")
async def list_datasets(
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """List all datasets."""
    result = await session.execute(
        select(StructuredDataset).order_by(desc(StructuredDataset.created_at))
    )
    return [_dataset_to_dict(d) for d in result.scalars().all()]


@router.get("/datasets/{dataset_id}")
async def get_dataset(
    dataset_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Get dataset detail with schema info."""
    return _dataset_to_dict(await _get_dataset(session, dataset_id))


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Delete a dataset and drop its external table."""
    dataset = await _get_dataset(session, dataset_id)
    await _data_service.delete_dataset(session, dataset)
    await session.commit()
    return {"status": "deleted", "id": dataset_id}


@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: int,
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Get first N rows from the data table."""
    dataset = await _get_dataset(session, dataset_id)
    if dataset.status != "ready":
        raise HTTPException(400, f"Dataset is not ready (status: {dataset.status})")
    try:
        return await _data_service.get_preview(dataset.table_name, limit)
    except Exception as e:
        raise HTTPException(500, f"Preview failed: {str(e)}")


# =============================================================================
# NL Query Pipeline (with self-correction loop)
# =============================================================================

@router.post("/datasets/{dataset_id}/query")
async def query_dataset(
    dataset_id: int,
    req: QueryRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Generate SQL from natural language with self-correction, optionally auto-execute."""
    dataset = await _get_dataset(session, dataset_id)
    if dataset.status != "ready":
        raise HTTPException(400, f"Dataset is not ready (status: {dataset.status})")

    # Generate SQL (includes self-correction loop + EXPLAIN validation)
    gen = await _sql_service.generate_sql(
        session, dataset, req.question, req.provider,
        include_metadata=req.include_metadata,
    )

    response = {
        "sql": gen["sql"],
        "valid": gen["valid"],
        "error": gen.get("error"),
        "provider": gen.get("provider"),
        "model": gen.get("model"),
        "attempts": gen.get("attempts", 1),
        "results": None,
    }

    if req.include_metadata and "metadata" in gen:
        response["generation_metadata"] = gen["metadata"]

    if not gen["valid"]:
        await _sql_service.log_query(
            session, dataset.id, req.question, gen["sql"],
            error_message=gen.get("error"),
            llm_provider=gen.get("provider"),
            llm_model=gen.get("model"),
        )
        await session.commit()
        return response

    # Auto-execute if requested
    if req.auto_execute:
        try:
            results = await _sql_service.execute_query(gen["sql"])
            response["results"] = results
            await _sql_service.log_query(
                session, dataset.id, req.question, gen["sql"],
                was_executed=True,
                execution_time_ms=results.get("execution_time_ms"),
                row_count=results.get("row_count"),
                llm_provider=gen.get("provider"),
                llm_model=gen.get("model"),
            )
        except Exception as e:
            response["results"] = {"error": str(e)}
            await _sql_service.log_query(
                session, dataset.id, req.question, gen["sql"],
                was_executed=True,
                error_message=str(e),
                llm_provider=gen.get("provider"),
                llm_model=gen.get("model"),
            )
    else:
        await _sql_service.log_query(
            session, dataset.id, req.question, gen["sql"],
            llm_provider=gen.get("provider"),
            llm_model=gen.get("model"),
        )

    await session.commit()
    return response


@router.post("/datasets/{dataset_id}/execute")
async def execute_sql(
    dataset_id: int,
    req: ExecuteRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Execute a validated SQL query against the dataset."""
    dataset = await _get_dataset(session, dataset_id)
    if dataset.status != "ready":
        raise HTTPException(400, f"Dataset is not ready (status: {dataset.status})")

    validation = _sql_service.validate_sql(req.sql, dataset.table_name)
    if not validation["valid"]:
        raise HTTPException(400, validation["error"])

    try:
        return await _sql_service.execute_query(req.sql, max_rows=req.max_rows)
    except Exception as e:
        raise HTTPException(500, f"Query execution failed: {str(e)}")


@router.post("/datasets/{dataset_id}/interpret")
async def interpret_results(
    dataset_id: int,
    req: InterpretRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Interpret query results using LLM (rich markdown + chart suggestion)."""
    result = await _sql_service.interpret_results(
        req.question, req.sql, req.results, req.provider,
        include_metadata=req.include_metadata,
    )
    response = {
        "interpretation": result["interpretation"],
        "suggested_chart": result.get("suggested_chart", "none"),
        "follow_up_questions": result.get("follow_up_questions", []),
    }
    if req.include_metadata and "metadata" in result:
        response["interpretation_metadata"] = result["metadata"]
    return response


# =============================================================================
# Query History & Feedback
# =============================================================================

@router.get("/datasets/{dataset_id}/queries")
async def get_query_history(
    dataset_id: int,
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Get query history for a dataset."""
    result = await session.execute(
        select(StructuredQueryLog)
        .where(StructuredQueryLog.dataset_id == dataset_id)
        .order_by(desc(StructuredQueryLog.created_at))
        .limit(limit)
    )
    return [
        {
            "id": log.id,
            "natural_language": log.natural_language,
            "generated_sql": log.generated_sql,
            "was_executed": log.was_executed,
            "execution_time_ms": log.execution_time_ms,
            "row_count": log.row_count,
            "error_message": log.error_message,
            "feedback": log.feedback,
            "llm_provider": log.llm_provider,
            "llm_model": log.llm_model,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in result.scalars().all()
    ]


@router.post("/queries/{query_id}/feedback")
async def submit_query_feedback(
    query_id: int,
    req: FeedbackRequest,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Submit thumbs up/down on a query. Good feedback promotes it to a few-shot example."""
    if req.feedback not in ("good", "bad"):
        raise HTTPException(400, "Feedback must be 'good' or 'bad'")
    await _sql_service.submit_feedback(session, query_id, req.feedback)
    await session.commit()
    return {"status": "ok", "query_id": query_id, "feedback": req.feedback}


# =============================================================================
# Schema Metadata (human-editable descriptions)
# =============================================================================

@router.get("/datasets/{dataset_id}/schema-metadata")
async def get_schema_metadata(
    dataset_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Get all schema metadata entries for a dataset."""
    result = await session.execute(
        select(SchemaMetadata)
        .where(SchemaMetadata.dataset_id == dataset_id)
        .order_by(SchemaMetadata.column_name.nulls_first())
    )
    return [
        {
            "id": m.id,
            "table_name": m.table_name,
            "column_name": m.column_name,
            "data_type": m.data_type,
            "description": m.description,
            "sample_values": m.sample_values,
            "business_term": m.business_term,
            "is_filterable": m.is_filterable,
            "is_metric": m.is_metric,
        }
        for m in result.scalars().all()
    ]


@router.put("/schema-metadata/{metadata_id}")
async def update_schema_metadata(
    metadata_id: int,
    req: SchemaMetadataUpdate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Update a schema metadata entry (description, business terms, etc.)."""
    result = await session.execute(
        select(SchemaMetadata).where(SchemaMetadata.id == metadata_id)
    )
    meta = result.scalar_one_or_none()
    if not meta:
        raise HTTPException(404, "Schema metadata entry not found")

    if req.description is not None:
        meta.description = req.description
    if req.sample_values is not None:
        meta.sample_values = req.sample_values
    if req.business_term is not None:
        meta.business_term = req.business_term
    if req.is_filterable is not None:
        meta.is_filterable = req.is_filterable
    if req.is_metric is not None:
        meta.is_metric = req.is_metric

    await session.commit()
    return {"status": "updated", "id": metadata_id}


# =============================================================================
# Business Glossary CRUD
# =============================================================================

@router.get("/datasets/{dataset_id}/glossary")
async def list_glossary(
    dataset_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """List all business glossary terms for a dataset."""
    result = await session.execute(
        select(BusinessGlossary)
        .where(BusinessGlossary.dataset_id == dataset_id)
        .order_by(BusinessGlossary.term)
    )
    return [
        {
            "id": g.id,
            "term": g.term,
            "synonyms": g.synonyms,
            "definition": g.definition,
            "sql_expression": g.sql_expression,
            "applies_to": g.applies_to,
        }
        for g in result.scalars().all()
    ]


@router.post("/datasets/{dataset_id}/glossary")
async def create_glossary_term(
    dataset_id: int,
    req: GlossaryCreate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Add a business glossary term."""
    await _get_dataset(session, dataset_id)  # Verify dataset exists
    term = BusinessGlossary(
        dataset_id=dataset_id,
        term=req.term,
        synonyms=req.synonyms,
        definition=req.definition,
        sql_expression=req.sql_expression,
        applies_to=req.applies_to,
    )
    session.add(term)
    await session.commit()
    return {"status": "created", "id": term.id, "term": term.term}


@router.put("/glossary/{glossary_id}")
async def update_glossary_term(
    glossary_id: int,
    req: GlossaryUpdate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Update a business glossary term."""
    result = await session.execute(
        select(BusinessGlossary).where(BusinessGlossary.id == glossary_id)
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(404, "Glossary term not found")

    if req.term is not None:
        term.term = req.term
    if req.synonyms is not None:
        term.synonyms = req.synonyms
    if req.definition is not None:
        term.definition = req.definition
    if req.sql_expression is not None:
        term.sql_expression = req.sql_expression
    if req.applies_to is not None:
        term.applies_to = req.applies_to

    await session.commit()
    return {"status": "updated", "id": glossary_id}


@router.delete("/glossary/{glossary_id}")
async def delete_glossary_term(
    glossary_id: int,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user_from_session),
):
    """Delete a business glossary term."""
    result = await session.execute(
        select(BusinessGlossary).where(BusinessGlossary.id == glossary_id)
    )
    term = result.scalar_one_or_none()
    if not term:
        raise HTTPException(404, "Glossary term not found")
    await session.delete(term)
    await session.commit()
    return {"status": "deleted", "id": glossary_id}


# =============================================================================
# Ollama / LLM Status
# =============================================================================

@router.get("/ollama/status")
async def ollama_status(
    user: User = Depends(get_current_user_from_session),
):
    """Check Ollama health and available models."""
    from src.config.settings import get_settings
    settings = get_settings()
    if not settings.ollama_enabled:
        return {"enabled": False, "status": "disabled"}
    from src.services.ollama_service import get_ollama_service
    service = get_ollama_service(settings.ollama_base_url)
    health = await service.health_check()
    return {"enabled": True, **health}


@router.get("/llm-providers")
async def get_llm_providers(
    user: User = Depends(get_current_user_from_session),
):
    """Get available LLM providers for structured data queries."""
    from src.services.agentic_rag.llm_adapter import get_agentic_rag_llm_service
    llm_service = get_agentic_rag_llm_service()
    if not llm_service:
        return {"providers": []}
    return {
        "providers": [
            {
                "id": name,
                "name": name.title(),
                "model": getattr(adapter, "model", "unknown"),
                "available": getattr(adapter, "_available", True),
            }
            for name, adapter in llm_service.adapters.items()
        ]
    }


# =============================================================================
# Helpers
# =============================================================================

async def _get_dataset(session: AsyncSession, dataset_id: int) -> StructuredDataset:
    result = await session.execute(
        select(StructuredDataset).where(StructuredDataset.id == dataset_id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, f"Dataset {dataset_id} not found")
    return dataset


def _dataset_to_dict(d: StructuredDataset) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "table_name": d.table_name,
        "source_filename": d.source_filename,
        "row_count": d.row_count,
        "column_count": d.column_count,
        "schema_info": d.schema_info,
        "status": d.status,
        "error_message": d.error_message,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }
