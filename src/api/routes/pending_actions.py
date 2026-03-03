"""API routes for pending AI actions requiring user approval."""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models.pending_action import PendingAction, ActionStatus
from src.api.dependencies import require_viewer, require_admin
from src.api.utils.audit import log_audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pending-actions", tags=["Pending Actions"])
db = get_db()


# =============================================================================
# Request/Response Models
# =============================================================================

class ApproveActionRequest(BaseModel):
    """Request to approve a pending action."""
    modified_input: Optional[dict] = None  # Allow modifying parameters before execution


class RejectActionRequest(BaseModel):
    """Request to reject a pending action."""
    reason: Optional[str] = None


class PendingActionResponse(BaseModel):
    """Response model for a pending action."""
    id: str
    session_id: str
    user_id: str
    tool_name: str
    tool_input: dict
    description: Optional[str]
    organization_id: Optional[str]
    network_id: Optional[str]
    device_serial: Optional[str]
    risk_level: str
    impact_summary: Optional[str]
    reversible: bool
    status: str
    created_at: str
    expires_at: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[str]
    rejection_reason: Optional[str]
    executed_at: Optional[str]
    execution_result: Optional[dict]
    error_message: Optional[str]


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", dependencies=[Depends(require_viewer)])
async def list_pending_actions(
    status: Optional[str] = Query(None, description="Filter by status"),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    limit: int = Query(50, ge=1, le=100),
):
    """List pending actions for the current user.

    Returns actions that are pending approval, recently approved, or rejected.
    """
    try:
        async with db.session() as session:
            query = select(PendingAction).order_by(PendingAction.created_at.desc())

            filters = []

            # Filter by status
            if status:
                try:
                    status_enum = ActionStatus(status)
                    filters.append(PendingAction.status == status_enum)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

            # Filter by session
            if session_id:
                filters.append(PendingAction.session_id == session_id)

            # Exclude expired actions unless specifically requested
            if status != "expired":
                filters.append(
                    or_(
                        PendingAction.expires_at.is_(None),
                        PendingAction.expires_at > datetime.utcnow()
                    )
                )

            if filters:
                query = query.where(and_(*filters))

            query = query.limit(limit)
            result = await session.execute(query)
            actions = result.scalars().all()

            return {
                "actions": [action.to_dict() for action in actions],
                "total": len(actions),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error listing pending actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count", dependencies=[Depends(require_viewer)])
async def get_pending_count(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
):
    """Get count of pending actions awaiting approval."""
    try:
        async with db.session() as session:
            from sqlalchemy import func

            query = select(func.count(PendingAction.id)).where(
                and_(
                    PendingAction.status == ActionStatus.PENDING,
                    or_(
                        PendingAction.expires_at.is_(None),
                        PendingAction.expires_at > datetime.utcnow()
                    )
                )
            )

            if session_id:
                query = query.where(PendingAction.session_id == session_id)

            result = await session.execute(query)
            count = result.scalar() or 0

            return {"count": count}
    except Exception as e:
        logger.exception(f"Error getting pending count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{action_id}", dependencies=[Depends(require_viewer)])
async def get_pending_action(action_id: str):
    """Get details of a specific pending action."""
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action ID format")

    try:
        async with db.session() as session:
            result = await session.execute(
                select(PendingAction).where(PendingAction.id == action_uuid)
            )
            action = result.scalar_one_or_none()

            if not action:
                raise HTTPException(status_code=404, detail="Action not found")

            return action.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting pending action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{action_id}/approve", dependencies=[Depends(require_viewer)])
async def approve_action(
    action_id: str,
    request: ApproveActionRequest,
    req=None,  # Will be populated by FastAPI
):
    """Approve a pending action and execute it.

    The action will be executed immediately after approval.
    """
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action ID format")

    try:
        async with db.session() as session:
            result = await session.execute(
                select(PendingAction).where(PendingAction.id == action_uuid)
            )
            action = result.scalar_one_or_none()

            if not action:
                raise HTTPException(status_code=404, detail="Action not found")

            if action.status != ActionStatus.PENDING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Action cannot be approved (current status: {action.status.value})"
                )

            # Check if expired
            if action.expires_at and action.expires_at < datetime.utcnow():
                action.status = ActionStatus.EXPIRED
                await session.commit()
                raise HTTPException(status_code=400, detail="Action has expired")

            # Update tool input if modified
            tool_input = request.modified_input if request.modified_input else action.tool_input

            # Mark as approved
            action.status = ActionStatus.APPROVED
            action.approved_at = datetime.utcnow()
            action.approved_by = "user"  # TODO: Get from auth context

            await session.commit()

            # Execute the tool
            try:
                from src.services.tool_registry import get_tool_registry

                registry = get_tool_registry()
                tool = registry.get(action.tool_name)

                if not tool or not tool.handler:
                    action.status = ActionStatus.FAILED
                    action.error_message = f"Tool '{action.tool_name}' not found or has no handler"
                    await session.commit()
                    raise HTTPException(status_code=500, detail=action.error_message)

                # Build execution context
                from src.services.unified_chat_service import ToolExecutionContext
                context = ToolExecutionContext(
                    credentials={},  # Will be resolved by handler
                    org_id=action.organization_id or "",
                    network_id=action.network_id,
                    session_id=action.session_id,
                )

                # Execute
                execution_result = await tool.handler(tool_input, context)

                action.executed_at = datetime.utcnow()
                action.execution_result = execution_result
                action.status = ActionStatus.EXECUTED

                if not execution_result.get("success", True):
                    action.error_message = execution_result.get("error", "Unknown error")
                    action.status = ActionStatus.FAILED

                await session.commit()

                return {
                    "success": True,
                    "action": action.to_dict(),
                    "execution_result": execution_result,
                }

            except Exception as e:
                action.status = ActionStatus.FAILED
                action.error_message = str(e)
                await session.commit()
                raise HTTPException(status_code=500, detail=f"Execution failed: {e}")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error approving action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{action_id}/reject", dependencies=[Depends(require_viewer)])
async def reject_action(action_id: str, request: RejectActionRequest):
    """Reject a pending action."""
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action ID format")

    try:
        async with db.session() as session:
            result = await session.execute(
                select(PendingAction).where(PendingAction.id == action_uuid)
            )
            action = result.scalar_one_or_none()

            if not action:
                raise HTTPException(status_code=404, detail="Action not found")

            if action.status != ActionStatus.PENDING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Action cannot be rejected (current status: {action.status.value})"
                )

            action.status = ActionStatus.REJECTED
            action.rejection_reason = request.reason
            await session.commit()

            return {
                "success": True,
                "action": action.to_dict(),
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error rejecting action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{action_id}", dependencies=[Depends(require_admin)])
async def delete_action(action_id: str):
    """Delete a pending action (admin only)."""
    try:
        action_uuid = UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action ID format")

    try:
        async with db.session() as session:
            result = await session.execute(
                select(PendingAction).where(PendingAction.id == action_uuid)
            )
            action = result.scalar_one_or_none()

            if not action:
                raise HTTPException(status_code=404, detail="Action not found")

            await session.delete(action)
            await session.commit()

            return {"success": True, "message": "Action deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Helper Functions
# =============================================================================

async def create_pending_action(
    session_id: str,
    user_id: str,
    tool_name: str,
    tool_input: dict,
    description: str = None,
    organization_id: str = None,
    network_id: str = None,
    device_serial: str = None,
    risk_level: str = "medium",
    impact_summary: str = None,
    reversible: bool = True,
    expires_in_minutes: int = 30,
) -> PendingAction:
    """Create a new pending action requiring approval.

    Returns the created PendingAction object.
    """
    async with db.session() as session:
        action = PendingAction(
            session_id=session_id,
            user_id=user_id,
            tool_name=tool_name,
            tool_input=tool_input,
            description=description,
            organization_id=organization_id,
            network_id=network_id,
            device_serial=device_serial,
            risk_level=risk_level,
            impact_summary=impact_summary,
            reversible=reversible,
            expires_at=datetime.utcnow() + timedelta(minutes=expires_in_minutes),
        )
        session.add(action)
        await session.commit()
        await session.refresh(action)

        logger.info(
            f"[PendingAction] Created pending action {action.id} for tool '{tool_name}' "
            f"(session={session_id}, risk={risk_level})"
        )

        return action
