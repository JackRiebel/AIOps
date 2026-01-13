"""API routes for activity feed."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import select, or_, desc

from src.config.database import get_db
from src.models import AuditLog
from src.api.dependencies import require_viewer

router = APIRouter()

# Database instance
db = get_db()


@router.get("/api/activity/feed", dependencies=[Depends(require_viewer)])
async def get_activity_feed(
    limit: int = Query(default=20, ge=1, le=100),
    include_workflows: bool = Query(default=True),
    include_audit: bool = Query(default=True),
):
    """Get recent activity feed for the dashboard.

    Combines workflow executions and audit log entries into a unified feed.

    Args:
        limit: Maximum number of items to return (default: 20)
        include_workflows: Include workflow execution events
        include_audit: Include audit log entries

    Returns:
        List of activity items sorted by timestamp (most recent first)
    """
    try:
        feed_items = []

        async with db.session() as session:
            # Fetch workflow executions if available
            if include_workflows:
                try:
                    from src.models.workflow import WorkflowExecution

                    workflow_result = await session.execute(
                        select(WorkflowExecution)
                        .order_by(desc(WorkflowExecution.started_at))
                        .limit(limit)
                    )
                    workflow_executions = workflow_result.scalars().all()

                    for execution in workflow_executions:
                        # Map status
                        status = "pending"
                        if execution.status == "running":
                            status = "running"
                        elif execution.status in ["completed", "success"]:
                            status = "completed"
                        elif execution.status in ["failed", "error"]:
                            status = "failed"

                        # Calculate duration if completed
                        duration = None
                        if execution.completed_at and execution.started_at:
                            duration = int(
                                (execution.completed_at - execution.started_at).total_seconds() * 1000
                            )

                        feed_items.append({
                            "id": f"wf-{execution.id}",
                            "type": "workflow_execution",
                            "title": execution.workflow_name or f"Workflow #{execution.workflow_id}",
                            "description": execution.trigger_reason or "",
                            "status": status,
                            "timestamp": execution.started_at.isoformat() if execution.started_at else datetime.utcnow().isoformat(),
                            "workflow_id": str(execution.workflow_id) if execution.workflow_id else None,
                            "workflow_name": execution.workflow_name,
                            "triggered_by": execution.triggered_by or "system",
                            "duration": duration,
                        })
                except ImportError:
                    # WorkflowExecution model not available
                    pass
                except Exception:
                    # Table might not exist yet
                    pass

            # Fetch audit log entries
            if include_audit:
                try:
                    # Filter for interesting audit events (exclude routine health checks)
                    audit_result = await session.execute(
                        select(AuditLog)
                        .where(
                            ~AuditLog.path.like("/api/health%"),
                            ~AuditLog.path.like("/api/costs%"),
                            AuditLog.http_method != "GET",  # Focus on mutations
                        )
                        .order_by(desc(AuditLog.timestamp))
                        .limit(limit)
                    )
                    audit_logs = audit_result.scalars().all()

                    for log in audit_logs:
                        # Determine status from response code
                        status = "completed"
                        if log.response_status and log.response_status >= 400:
                            status = "failed"

                        # Create human-readable title
                        method = log.http_method or "API"
                        path = log.path or "/unknown"

                        # Map common paths to friendly names
                        title = f"{method} {path}"
                        if "/api/incidents" in path:
                            title = "Incident Update" if method in ["PUT", "POST"] else "Incident Action"
                        elif "/api/workflows" in path:
                            title = "Workflow Modified" if method in ["PUT", "POST", "DELETE"] else "Workflow Action"
                        elif "/api/chat" in path:
                            title = "AI Chat Message"
                        elif "/api/admin" in path:
                            title = "Admin Configuration"
                        elif "/api/organizations" in path:
                            title = "Organization Update"

                        feed_items.append({
                            "id": f"audit-{log.id}",
                            "type": "audit_log",
                            "title": title,
                            "description": f"{method} {path}",
                            "status": status,
                            "timestamp": log.timestamp.isoformat() if log.timestamp else datetime.utcnow().isoformat(),
                            "triggered_by": log.user_id or "system",
                        })
                except Exception:
                    # Audit log table might not exist
                    pass

        # Sort by timestamp and limit
        feed_items.sort(key=lambda x: x["timestamp"], reverse=True)
        feed_items = feed_items[:limit]

        return {
            "items": feed_items,
            "count": len(feed_items),
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get activity feed: {str(e)}")


@router.get("/api/activity/workflow-executions", dependencies=[Depends(require_viewer)])
async def get_workflow_executions(
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    hours: int = Query(default=24, ge=1, le=168),
):
    """Get recent workflow executions.

    Args:
        limit: Maximum number of executions to return
        status: Filter by status (running, completed, failed)
        hours: Number of hours to look back

    Returns:
        List of workflow executions
    """
    try:
        from src.models.workflow import WorkflowExecution

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        async with db.session() as session:
            query = (
                select(WorkflowExecution)
                .where(WorkflowExecution.started_at >= cutoff_time)
                .order_by(desc(WorkflowExecution.started_at))
            )

            if status:
                query = query.where(WorkflowExecution.status == status)

            query = query.limit(limit)

            result = await session.execute(query)
            executions = result.scalars().all()

            return {
                "executions": [
                    {
                        "id": execution.id,
                        "workflow_id": execution.workflow_id,
                        "workflow_name": execution.workflow_name,
                        "status": execution.status,
                        "trigger_reason": execution.trigger_reason,
                        "triggered_by": execution.triggered_by,
                        "started_at": execution.started_at.isoformat() if execution.started_at else None,
                        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                        "result": execution.result,
                        "error_message": execution.error_message,
                    }
                    for execution in executions
                ],
                "count": len(executions),
                "timestamp": datetime.utcnow().isoformat(),
            }

    except ImportError:
        return {
            "executions": [],
            "count": 0,
            "message": "Workflow execution tracking not available",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow executions: {str(e)}")
