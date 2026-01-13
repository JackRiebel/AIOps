"""Canvas persistence API routes.

Provides endpoints for:
- Saving canvas states
- Loading saved canvases
- Listing user's saved canvases
- Sharing canvases via link

Part of Lumen AI Canvas Phase 1 implementation.
"""

import logging
import secrets
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from src.api.dependencies import get_db_session, get_current_user_from_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/canvases", tags=["canvases"])


# =============================================================================
# Request/Response Models
# =============================================================================

class CanvasCardLayout(BaseModel):
    """Layout positioning for a canvas card."""
    x: int = Field(0, description="Grid X position")
    y: int = Field(0, description="Grid Y position")
    w: int = Field(4, description="Width in grid units")
    h: int = Field(3, description="Height in grid units")
    minW: Optional[int] = Field(None, description="Minimum width")
    minH: Optional[int] = Field(None, description="Minimum height")
    maxW: Optional[int] = Field(None, description="Maximum width")
    maxH: Optional[int] = Field(None, description="Maximum height")


class CanvasCard(BaseModel):
    """Individual card in a canvas."""
    id: str = Field(..., description="Unique card identifier")
    type: str = Field(..., description="Card type (e.g., 'device-detail', 'bandwidth-utilization')")
    title: Optional[str] = Field(None, description="Card title")
    layout: CanvasCardLayout = Field(default_factory=CanvasCardLayout, description="Card layout position")
    data: Optional[dict] = Field(None, description="Card data")
    config: Optional[dict] = Field(None, description="Card configuration")
    metadata: Optional[dict] = Field(None, description="Card metadata")


class CanvasState(BaseModel):
    """Canvas state including cards with embedded layouts and configuration."""
    cards: List[CanvasCard] = Field(default_factory=list, description="List of canvas cards with layouts")
    positions: Optional[dict] = Field(None, description="DEPRECATED: Legacy positions dict - migrate to card.layout")
    config: dict = Field(default_factory=dict, description="Canvas configuration")


class SaveCanvasRequest(BaseModel):
    """Request to save a canvas."""
    name: str = Field(..., min_length=1, max_length=255, description="Canvas name")
    description: Optional[str] = Field(None, max_length=1000, description="Optional description")
    canvas_state: CanvasState = Field(..., description="Full canvas state")
    is_template: bool = Field(False, description="Whether this can be used as a template")
    tags: Optional[List[str]] = Field(None, description="Tags for organization")


class UpdateCanvasRequest(BaseModel):
    """Request to update an existing canvas."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    canvas_state: Optional[CanvasState] = None
    is_template: Optional[bool] = None
    tags: Optional[List[str]] = None


class ShareCanvasRequest(BaseModel):
    """Request to share a canvas."""
    is_public: bool = Field(True, description="Make canvas publicly accessible")
    password: Optional[str] = Field(None, min_length=4, max_length=100, description="Optional password")
    expires_hours: Optional[int] = Field(None, ge=1, le=720, description="Hours until share expires (max 30 days)")


class SavedCanvasResponse(BaseModel):
    """Response for a saved canvas."""
    id: int
    name: str
    description: Optional[str]
    is_template: bool
    is_public: bool
    share_token: Optional[str]
    tags: Optional[List[str]]
    view_count: int
    created_at: datetime
    updated_at: datetime


class SavedCanvasDetailResponse(SavedCanvasResponse):
    """Detailed response including canvas state."""
    canvas_state: dict


class CanvasListResponse(BaseModel):
    """Response for listing canvases."""
    canvases: List[SavedCanvasResponse]
    total: int


# =============================================================================
# Helper Functions
# =============================================================================

def migrate_legacy_positions(canvas_state: CanvasState) -> CanvasState:
    """Migrate legacy positions dict into card.layout fields.

    If canvas_state.positions exists (legacy format), merge those positions
    into each card's layout field and clear the positions dict.

    Args:
        canvas_state: Canvas state that may have legacy positions

    Returns:
        Updated canvas state with positions migrated to card layouts
    """
    if not canvas_state.positions:
        return canvas_state

    # Build a positions lookup
    positions = canvas_state.positions

    # Update each card with position from legacy dict
    migrated_cards = []
    for card in canvas_state.cards:
        card_pos = positions.get(card.id, {})
        if card_pos:
            # Merge legacy position into card layout
            migrated_layout = CanvasCardLayout(
                x=card_pos.get("x", card.layout.x),
                y=card_pos.get("y", card.layout.y),
                w=card_pos.get("w", card.layout.w),
                h=card_pos.get("h", card.layout.h),
                minW=card_pos.get("minW", card.layout.minW),
                minH=card_pos.get("minH", card.layout.minH),
                maxW=card_pos.get("maxW", card.layout.maxW),
                maxH=card_pos.get("maxH", card.layout.maxH),
            )
            migrated_card = card.model_copy(update={"layout": migrated_layout})
            migrated_cards.append(migrated_card)
        else:
            migrated_cards.append(card)

    # Return new state with migrated cards and cleared positions
    return CanvasState(
        cards=migrated_cards,
        positions=None,  # Clear legacy positions
        config=canvas_state.config,
    )


# =============================================================================
# Canvas CRUD Operations
# =============================================================================

@router.post("", response_model=SavedCanvasResponse)
async def save_canvas(
    request: SaveCanvasRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Save a new canvas configuration.

    Creates a new saved canvas with the provided state, name, and metadata.
    Automatically migrates legacy positions dict to card.layout.

    Args:
        request: Canvas data to save
        db: Database session
        current_user: Authenticated user

    Returns:
        Created canvas entry
    """
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        # Migrate legacy positions to card layouts
        migrated_state = migrate_legacy_positions(request.canvas_state)

        result = await db.execute(
            text("""
                INSERT INTO saved_canvases (
                    name, description, user_id, canvas_state, is_template, tags
                ) VALUES (
                    :name, :description, :user_id, :canvas_state, :is_template, :tags
                )
                RETURNING id, name, description, is_template, is_public, share_token,
                          tags, view_count, created_at, updated_at
            """),
            {
                "name": request.name,
                "description": request.description,
                "user_id": user_id,
                "canvas_state": migrated_state.model_dump_json(),
                "is_template": request.is_template,
                "tags": request.tags,
            }
        )

        row = result.fetchone()
        await db.commit()

        logger.info(f"Canvas saved: {request.name} by user {user_id}")

        return SavedCanvasResponse(
            id=row.id,
            name=row.name,
            description=row.description,
            is_template=row.is_template,
            is_public=row.is_public,
            share_token=row.share_token,
            tags=row.tags,
            view_count=row.view_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    except Exception as e:
        logger.error(f"Error saving canvas: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save canvas")


@router.get("", response_model=CanvasListResponse)
async def list_canvases(
    include_templates: bool = Query(False, description="Include public templates"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """List user's saved canvases.

    Returns all canvases owned by the current user, optionally including
    public templates from other users.

    Args:
        include_templates: Whether to include public templates
        limit: Maximum results
        offset: Pagination offset
        db: Database session
        current_user: Authenticated user

    Returns:
        List of saved canvases
    """
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        # Build query based on options
        if include_templates:
            query = """
                SELECT id, name, description, is_template, is_public, share_token,
                       tags, view_count, created_at, updated_at
                FROM saved_canvases
                WHERE user_id = :user_id OR is_template = TRUE
                ORDER BY updated_at DESC
                LIMIT :limit OFFSET :offset
            """
            count_query = """
                SELECT COUNT(*) FROM saved_canvases
                WHERE user_id = :user_id OR is_template = TRUE
            """
        else:
            query = """
                SELECT id, name, description, is_template, is_public, share_token,
                       tags, view_count, created_at, updated_at
                FROM saved_canvases
                WHERE user_id = :user_id
                ORDER BY updated_at DESC
                LIMIT :limit OFFSET :offset
            """
            count_query = """
                SELECT COUNT(*) FROM saved_canvases
                WHERE user_id = :user_id
            """

        result = await db.execute(text(query), {"user_id": user_id, "limit": limit, "offset": offset})
        rows = result.fetchall()

        count_result = await db.execute(text(count_query), {"user_id": user_id})
        total = count_result.scalar()

        canvases = [
            SavedCanvasResponse(
                id=row.id,
                name=row.name,
                description=row.description,
                is_template=row.is_template,
                is_public=row.is_public,
                share_token=row.share_token,
                tags=row.tags,
                view_count=row.view_count,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

        return CanvasListResponse(canvases=canvases, total=total)

    except Exception as e:
        logger.error(f"Error listing canvases: {e}")
        raise HTTPException(status_code=500, detail="Failed to list canvases")


@router.get("/{canvas_id}", response_model=SavedCanvasDetailResponse)
async def get_canvas(
    canvas_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Get a specific canvas by ID.

    Returns the full canvas state for the specified canvas. User must own
    the canvas or it must be a public template.

    Args:
        canvas_id: Canvas ID
        db: Database session
        current_user: Authenticated user

    Returns:
        Canvas with full state
    """
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        result = await db.execute(
            text("""
                SELECT id, name, description, canvas_state, is_template, is_public,
                       share_token, tags, view_count, created_at, updated_at, user_id
                FROM saved_canvases
                WHERE id = :canvas_id
            """),
            {"canvas_id": canvas_id}
        )

        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Canvas not found")

        # Check access
        if row.user_id != user_id and not row.is_template and not row.is_public:
            raise HTTPException(status_code=403, detail="Access denied")

        return SavedCanvasDetailResponse(
            id=row.id,
            name=row.name,
            description=row.description,
            canvas_state=row.canvas_state if isinstance(row.canvas_state, dict) else {},
            is_template=row.is_template,
            is_public=row.is_public,
            share_token=row.share_token,
            tags=row.tags,
            view_count=row.view_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting canvas: {e}")
        raise HTTPException(status_code=500, detail="Failed to get canvas")


@router.put("/{canvas_id}", response_model=SavedCanvasResponse)
async def update_canvas(
    canvas_id: int,
    request: UpdateCanvasRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Update an existing canvas.

    Args:
        canvas_id: Canvas ID
        request: Fields to update
        db: Database session
        current_user: Authenticated user

    Returns:
        Updated canvas
    """
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        # First verify ownership
        check_result = await db.execute(
            text("SELECT user_id FROM saved_canvases WHERE id = :canvas_id"),
            {"canvas_id": canvas_id}
        )
        row = check_result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Canvas not found")
        if row.user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Build update query dynamically
        updates = []
        params = {"canvas_id": canvas_id}

        if request.name is not None:
            updates.append("name = :name")
            params["name"] = request.name
        if request.description is not None:
            updates.append("description = :description")
            params["description"] = request.description
        if request.canvas_state is not None:
            # Migrate legacy positions to card layouts
            migrated_state = migrate_legacy_positions(request.canvas_state)
            updates.append("canvas_state = :canvas_state")
            params["canvas_state"] = migrated_state.model_dump_json()
        if request.is_template is not None:
            updates.append("is_template = :is_template")
            params["is_template"] = request.is_template
        if request.tags is not None:
            updates.append("tags = :tags")
            params["tags"] = request.tags

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        from datetime import datetime
        updates.append("updated_at = :updated_at")
        params["updated_at"] = datetime.utcnow()

        result = await db.execute(
            text(f"""
                UPDATE saved_canvases
                SET {', '.join(updates)}
                WHERE id = :canvas_id
                RETURNING id, name, description, is_template, is_public, share_token,
                          tags, view_count, created_at, updated_at
            """),
            params
        )

        row = result.fetchone()
        await db.commit()

        return SavedCanvasResponse(
            id=row.id,
            name=row.name,
            description=row.description,
            is_template=row.is_template,
            is_public=row.is_public,
            share_token=row.share_token,
            tags=row.tags,
            view_count=row.view_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating canvas: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update canvas")


@router.delete("/{canvas_id}")
async def delete_canvas(
    canvas_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Delete a canvas.

    Args:
        canvas_id: Canvas ID
        db: Database session
        current_user: Authenticated user

    Returns:
        Success status
    """
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        result = await db.execute(
            text("""
                DELETE FROM saved_canvases
                WHERE id = :canvas_id AND user_id = :user_id
                RETURNING id
            """),
            {"canvas_id": canvas_id, "user_id": user_id}
        )

        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Canvas not found or access denied")

        await db.commit()
        return {"success": True, "deleted_id": canvas_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting canvas: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete canvas")


# =============================================================================
# Sharing Operations
# =============================================================================

@router.post("/{canvas_id}/share")
async def share_canvas(
    canvas_id: int,
    request: ShareCanvasRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user = Depends(get_current_user_from_session),
):
    """Generate a share link for a canvas.

    Args:
        canvas_id: Canvas ID
        request: Share options
        db: Database session
        current_user: Authenticated user

    Returns:
        Share token and URL
    """
    try:
        from datetime import datetime, timedelta
        user_id = current_user.get("id") if isinstance(current_user, dict) else current_user.id

        # Generate share token
        share_token = secrets.token_urlsafe(32)
        now = datetime.utcnow()

        # Calculate expiration if specified
        if request.expires_hours:
            expires_at = now + timedelta(hours=request.expires_hours)
            result = await db.execute(
                text("""
                    UPDATE saved_canvases
                    SET is_public = :is_public,
                        share_token = :share_token,
                        share_expires_at = :expires_at,
                        updated_at = :updated_at
                    WHERE id = :canvas_id AND user_id = :user_id
                    RETURNING share_token
                """),
                {
                    "canvas_id": canvas_id,
                    "user_id": user_id,
                    "is_public": request.is_public,
                    "share_token": share_token,
                    "expires_at": expires_at,
                    "updated_at": now,
                }
            )
        else:
            result = await db.execute(
                text("""
                    UPDATE saved_canvases
                    SET is_public = :is_public,
                        share_token = :share_token,
                        share_expires_at = NULL,
                        updated_at = :updated_at
                    WHERE id = :canvas_id AND user_id = :user_id
                    RETURNING share_token
                """),
                {
                    "canvas_id": canvas_id,
                    "user_id": user_id,
                    "is_public": request.is_public,
                    "share_token": share_token,
                    "updated_at": now,
                }
            )

        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Canvas not found or access denied")

        await db.commit()

        return {
            "share_token": share_token,
            "share_url": f"/canvas/shared/{share_token}",
            "is_public": request.is_public,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sharing canvas: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to share canvas")


@router.get("/shared/{share_token}", response_model=SavedCanvasDetailResponse)
async def get_shared_canvas(
    share_token: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a canvas by share token.

    Public endpoint - no authentication required.

    Args:
        share_token: Share token
        db: Database session

    Returns:
        Canvas with full state
    """
    try:
        result = await db.execute(
            text("""
                SELECT id, name, description, canvas_state, is_template, is_public,
                       share_token, tags, view_count, created_at, updated_at,
                       share_expires_at
                FROM saved_canvases
                WHERE share_token = :share_token AND is_public = TRUE
            """),
            {"share_token": share_token}
        )

        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Canvas not found or share link expired")

        # Check expiration
        if row.share_expires_at and row.share_expires_at < datetime.utcnow():
            raise HTTPException(status_code=410, detail="Share link has expired")

        # Increment view count
        await db.execute(
            text("""
                UPDATE saved_canvases
                SET view_count = view_count + 1
                WHERE id = :id
            """),
            {"id": row.id}
        )
        await db.commit()

        return SavedCanvasDetailResponse(
            id=row.id,
            name=row.name,
            description=row.description,
            canvas_state=row.canvas_state if isinstance(row.canvas_state, dict) else {},
            is_template=row.is_template,
            is_public=row.is_public,
            share_token=row.share_token,
            tags=row.tags,
            view_count=row.view_count + 1,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shared canvas: {e}")
        raise HTTPException(status_code=500, detail="Failed to get canvas")
