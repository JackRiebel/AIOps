"""
Canvas artifacts API routes.

This module provides REST endpoints for creating, reading, updating,
and deleting canvas artifacts that are generated from tool results.
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.dependencies import require_viewer
from src.models.user import User
from src.models.canvas import ArtifactType
from src.services.canvas_service import get_canvas_service, ArtifactSpec

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/artifacts", tags=["Canvas Artifacts"])


class CreateArtifactRequest(BaseModel):
    """Request model for creating an artifact."""
    session_id: int
    type: str  # ArtifactType value
    title: str
    content: Dict[str, Any]
    description: Optional[str] = None
    render_config: Optional[Dict[str, Any]] = None
    conversation_id: Optional[int] = None
    source_tool: Optional[str] = None


class UpdateArtifactRequest(BaseModel):
    """Request model for updating an artifact."""
    title: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    render_config: Optional[Dict[str, Any]] = None
    create_version: bool = True


class ArtifactResponse(BaseModel):
    """Response model for an artifact."""
    id: int
    session_id: int
    type: str
    title: str
    content: Dict[str, Any]
    description: Optional[str] = None
    render_config: Optional[Dict[str, Any]] = None
    version: int
    parent_id: Optional[int] = None
    source_tool: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("", response_model=ArtifactResponse)
async def create_artifact(
    body: CreateArtifactRequest,
    user: User = Depends(require_viewer),
):
    """Create a new canvas artifact."""
    canvas_service = get_canvas_service()

    # Validate artifact type
    try:
        artifact_type = ArtifactType(body.type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid artifact type: {body.type}. Valid types: {[t.value for t in ArtifactType]}"
        )

    spec = ArtifactSpec(
        type=artifact_type,
        title=body.title,
        content=body.content,
        description=body.description,
        render_config=body.render_config,
    )

    artifact = await canvas_service.create_artifact(
        session_id=body.session_id,
        spec=spec,
        conversation_id=body.conversation_id,
        source_tool=body.source_tool,
    )

    return artifact.to_dict()


@router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: int,
    user: User = Depends(require_viewer),
):
    """Get an artifact by ID."""
    canvas_service = get_canvas_service()
    artifact = await canvas_service.get_artifact(artifact_id)

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return artifact.to_dict()


@router.put("/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    artifact_id: int,
    body: UpdateArtifactRequest,
    user: User = Depends(require_viewer),
):
    """Update an artifact."""
    canvas_service = get_canvas_service()

    updates = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.content is not None:
        updates["content"] = body.content
    if body.description is not None:
        updates["description"] = body.description
    if body.render_config is not None:
        updates["render_config"] = body.render_config

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    artifact = await canvas_service.update_artifact(
        artifact_id=artifact_id,
        updates=updates,
        create_version=body.create_version,
    )

    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return artifact.to_dict()


@router.delete("/{artifact_id}")
async def delete_artifact(
    artifact_id: int,
    user: User = Depends(require_viewer),
):
    """Delete an artifact."""
    canvas_service = get_canvas_service()
    deleted = await canvas_service.delete_artifact(artifact_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return {"success": True, "message": "Artifact deleted"}


@router.get("/session/{session_id}", response_model=List[Dict[str, Any]])
async def get_session_artifacts(
    session_id: int,
    include_versions: bool = False,
    user: User = Depends(require_viewer),
):
    """Get all artifacts for a session."""
    canvas_service = get_canvas_service()
    artifacts = await canvas_service.get_session_artifacts(
        session_id=session_id,
        include_all_versions=include_versions,
    )

    return [artifact.to_dict() for artifact in artifacts]


@router.get("/types/list")
async def get_artifact_types(
    user: User = Depends(require_viewer),
):
    """Get available artifact types."""
    return {
        "types": [
            {
                "value": t.value,
                "name": t.name,
                "description": _get_type_description(t),
            }
            for t in ArtifactType
        ]
    }


def _get_type_description(artifact_type: ArtifactType) -> str:
    """Get description for an artifact type."""
    descriptions = {
        ArtifactType.CODE: "Code snippet with syntax highlighting",
        ArtifactType.DATA_TABLE: "Tabular data display",
        ArtifactType.CHART: "Line, bar, or pie chart",
        ArtifactType.NETWORK_DIAGRAM: "Network topology visualization",
        ArtifactType.MARKDOWN: "Markdown formatted text",
        ArtifactType.JSON: "JSON data viewer",
        ArtifactType.TOPOLOGY: "Network topology graph",
        ArtifactType.DEVICE_CARD: "Single device information card",
        ArtifactType.DEVICE_CARDS: "Grid of device cards",
        ArtifactType.ALERT_PANEL: "Alert/notification display",
        ArtifactType.STATUS_CARD: "Status information card",
        ArtifactType.STAT_CARD: "Statistical metric card",
    }
    return descriptions.get(artifact_type, "")
