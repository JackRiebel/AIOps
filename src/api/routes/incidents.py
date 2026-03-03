"""API routes for incidents."""

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_db_session, credential_manager, startup_time, require_edit_mode, get_request_id, require_operator, require_viewer
from src.api.models import *
from src.api.utils.audit import log_audit
from src.models import Incident, Event
from typing import List, Optional, Dict, Any

router = APIRouter()

# Database instance
from src.config.database import get_db
db = get_db()

@router.get("/api/incidents", response_model=List[IncidentResponse])
async def get_incidents(
    hours: int = Query(default=24, ge=1, le=168),
    status: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    _: None = Depends(require_viewer),
):
    """Get all incidents within the specified time range.

    Args:
        hours: Number of hours to look back (default: 24, max: 168)
        status: Filter by status (open, investigating, resolved, closed)
        severity: Filter by severity (critical, high, medium, low, info)

    Returns:
        List of incidents
    """
    try:
        from sqlalchemy.orm import selectinload

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        async with db.session() as session:
            query = (
                select(Incident)
                .options(selectinload(Incident.events))
                .where(Incident.start_time >= cutoff_time)
                .order_by(Incident.start_time.desc())
            )

            # Apply filters
            if status:
                query = query.where(Incident.status == status)
            if severity:
                query = query.where(Incident.severity == severity)

            result = await session.execute(query)
            incidents = result.scalars().all()

            # Construct response inside session
            response = []
            for incident in incidents:
                response.append({
                    "id": incident.id,
                    "title": incident.title,
                    "status": incident.status.value if hasattr(incident.status, "value") else incident.status,
                    "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
                    "start_time": incident.start_time.isoformat() if incident.start_time else None,
                    "end_time": incident.end_time.isoformat() if incident.end_time else None,
                    "created_at": incident.created_at.isoformat() if incident.created_at else None,
                    "updated_at": incident.updated_at.isoformat() if incident.updated_at else None,
                    "root_cause_hypothesis": incident.root_cause_hypothesis,
                    "confidence_score": incident.confidence_score,
                    "affected_services": incident.affected_services,
                    "organizations": incident.organizations,
                    "event_count": len(incident.events),
                    # Network-specific fields
                    "network_id": incident.network_id,
                    "network_name": incident.network_name,
                })

            return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



import asyncio

# Track background correlation state
_correlation_state: Dict[str, Any] = {
    "running": False,
    "started_at": None,
    "completed_at": None,
    "result": None,
    "error": None,
}


async def _run_correlation_background():
    """Run correlation in background and store result."""
    from src.services.background_jobs import get_scheduler
    try:
        scheduler = get_scheduler()
        result = await scheduler.fetch_and_correlate_alerts()
        _correlation_state["result"] = result
        _correlation_state["error"] = None
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background correlation failed: {e}", exc_info=True)
        _correlation_state["result"] = None
        _correlation_state["error"] = str(e)
    finally:
        _correlation_state["running"] = False
        _correlation_state["completed_at"] = datetime.utcnow().isoformat() + "Z"


@router.post("/api/incidents-refresh")
async def refresh_incidents(_: None = Depends(require_operator)):
    """Trigger alert fetching and incident correlation in the background.

    Returns immediately with status 'started'. Poll /api/incidents-refresh/status
    to check progress and get results.
    """
    try:
        from src.services.background_jobs import get_scheduler

        scheduler = get_scheduler()

        if not scheduler:
            raise HTTPException(status_code=503, detail="Background job scheduler not available")

        if not scheduler.incident_correlator:
            raise HTTPException(
                status_code=503,
                detail="Incident correlation service not configured - ANTHROPIC_API_KEY may be missing"
            )

        if _correlation_state["running"]:
            return {
                "status": "already_running",
                "message": "Correlation is already in progress",
                "started_at": _correlation_state["started_at"],
            }

        # Start correlation in background
        _correlation_state["running"] = True
        _correlation_state["started_at"] = datetime.utcnow().isoformat() + "Z"
        _correlation_state["completed_at"] = None
        _correlation_state["result"] = None
        _correlation_state["error"] = None

        asyncio.create_task(_run_correlation_background())

        return {
            "status": "started",
            "message": "Correlation started — processing Splunk events",
            "started_at": _correlation_state["started_at"],
        }

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in refresh_incidents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start correlation: {str(e)}")


@router.get("/api/incidents-refresh/status")
async def refresh_status(_: None = Depends(require_viewer)):
    """Check the status of a background correlation job."""
    if _correlation_state["running"]:
        return {
            "status": "running",
            "message": "Correlation in progress...",
            "started_at": _correlation_state["started_at"],
        }

    if _correlation_state["error"]:
        return {
            "status": "error",
            "message": f"Correlation failed: {_correlation_state['error']}",
            "started_at": _correlation_state["started_at"],
            "completed_at": _correlation_state["completed_at"],
        }

    result = _correlation_state.get("result")
    if result:
        incidents_created = result.get("incidents_created", 0)
        events_found = result.get("events_found", 0)
        events_filtered = result.get("events_filtered", 0)
        events_analyzed = events_found - events_filtered

        if incidents_created > 0:
            message = f"Created {incidents_created} incident{'s' if incidents_created != 1 else ''} from {events_analyzed} event{'s' if events_analyzed != 1 else ''}"
        elif events_found > 0:
            message = f"Analyzed {events_analyzed} events — no new incidents to create"
        else:
            message = "No Splunk events found in the selected time range"

        return {
            "status": "completed",
            "message": message,
            "events_found": events_found,
            "events_filtered": events_filtered,
            "incidents_created": incidents_created,
            "incident_ids": result.get("incident_ids", []),
            "started_at": _correlation_state["started_at"],
            "completed_at": _correlation_state["completed_at"],
        }

    return {
        "status": "idle",
        "message": "No correlation has been run yet",
    }


@router.get("/api/incidents/correlation-settings")
async def get_correlation_settings(_: None = Depends(require_viewer)):
    """Get current incident correlation settings.

    Returns:
        Current interval setting and available options
    """
    try:
        from src.services.background_jobs import get_scheduler, CORRELATION_INTERVALS

        scheduler = get_scheduler()
        current_interval = await scheduler.get_correlation_interval()

        # Get next run time if scheduled
        next_run = None
        try:
            job = scheduler.scheduler.get_job("fetch_and_correlate_alerts")
            if job and job.next_run_time:
                next_run = job.next_run_time.isoformat() + "Z"
        except Exception:
            pass

        return {
            "current_interval": current_interval,
            "available_intervals": list(CORRELATION_INTERVALS.keys()),
            "next_run": next_run,
            "is_enabled": current_interval != "off",
        }

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error getting correlation settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/incidents/correlation-settings")
async def set_correlation_settings(
    interval: str = Query(..., description="Correlation interval: off, 5min, 30min, 1hr, 2hr, 3hr"),
    _: None = Depends(require_operator),
):
    """Set the incident correlation auto-polling interval.

    Args:
        interval: One of 'off', '5min', '30min', '1hr', '2hr', '3hr'
            - 'off': Manual only (use Refresh & Correlate button)
            - '5min': Every 5 minutes
            - '30min': Every 30 minutes
            - '1hr': Every hour
            - '2hr': Every 2 hours
            - '3hr': Every 3 hours

    Returns:
        Updated settings
    """
    try:
        from src.services.background_jobs import get_scheduler, CORRELATION_INTERVALS

        if interval not in CORRELATION_INTERVALS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid interval. Must be one of: {list(CORRELATION_INTERVALS.keys())}"
            )

        scheduler = get_scheduler()
        success = await scheduler.set_correlation_interval(interval)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to update correlation interval")

        # Get next run time if scheduled
        next_run = None
        try:
            job = scheduler.scheduler.get_job("fetch_and_correlate_alerts")
            if job and job.next_run_time:
                next_run = job.next_run_time.isoformat() + "Z"
        except Exception:
            pass

        return {
            "status": "success",
            "current_interval": interval,
            "next_run": next_run,
            "is_enabled": interval != "off",
            "message": f"Correlation interval set to {interval}"
        }

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error setting correlation settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/incidents/{incident_id}", response_model=dict)
async def get_incident(incident_id: int, _: None = Depends(require_viewer)):
    """Get a specific incident with all its events.

    Args:
        incident_id: Incident ID

    Returns:
        Incident details with events
    """
    try:
        from sqlalchemy.orm import selectinload
        async with db.session() as session:
            result = await session.execute(
                select(Incident)
                .options(selectinload(Incident.events))
                .where(Incident.id == incident_id)
            )
            incident = result.scalar_one_or_none()

            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            # Construct response inside session
            return {
                "incident": {
                    "id": incident.id,
                    "title": incident.title,
                    "status": incident.status.value if hasattr(incident.status, "value") else incident.status,
                    "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
                    "start_time": incident.start_time.isoformat() if incident.start_time else None,
                    "end_time": incident.end_time.isoformat() if incident.end_time else None,
                    "created_at": incident.created_at.isoformat() if incident.created_at else None,
                    "updated_at": incident.updated_at.isoformat() if incident.updated_at else None,
                    "root_cause_hypothesis": incident.root_cause_hypothesis,
                    "confidence_score": incident.confidence_score,
                    "affected_services": incident.affected_services,
                    "organizations": incident.organizations,
                    # Network-specific fields
                    "network_id": incident.network_id,
                    "network_name": incident.network_name,
                    "device_config": incident.device_config,
                },
                "events": [
                    {
                        "id": event.id,
                        "source": event.source.value if hasattr(event.source, "value") else event.source,
                        "source_event_id": event.source_event_id,
                        "organization": event.organization,
                        "event_type": event.event_type,
                        "severity": event.severity.value if hasattr(event.severity, "value") else event.severity,
                        "title": event.title,
                        "description": event.description,
                        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
                        "created_at": event.created_at.isoformat() if event.created_at else None,
                        "affected_resource": event.affected_resource,
                        "raw_data": event.raw_data,
                        "ai_cost": event.ai_cost,
                        "token_count": event.token_count,
                    }
                    for event in sorted(incident.events, key=lambda e: e.timestamp)
                ],
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/events", response_model=List[EventResponse])
async def get_events(
    hours: int = Query(default=24, ge=1, le=168),
    source: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    organization: Optional[str] = Query(default=None),
    _: None = Depends(require_viewer),
):
    """Get all events within the specified time range.

    Args:
        hours: Number of hours to look back (default: 24, max: 168)
        source: Filter by source (meraki, thousandeyes)
        severity: Filter by severity (critical, high, medium, low, info)
        organization: Filter by organization name

    Returns:
        List of events
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        async with db.session() as session:
            query = select(Event).where(Event.timestamp >= cutoff_time).order_by(Event.timestamp.desc())

            # Apply filters
            if source:
                query = query.where(Event.source == source)
            if severity:
                query = query.where(Event.severity == severity)
            if organization:
                query = query.where(Event.organization == organization)

            result = await session.execute(query)
            events = result.scalars().all()

            # Construct response inside session
            response = []
            for event in events:
                response.append({
                    "id": event.id,
                    "source": event.source.value if hasattr(event.source, "value") else event.source,
                    "source_event_id": event.source_event_id,
                    "organization": event.organization,
                    "event_type": event.event_type,
                    "severity": event.severity.value if hasattr(event.severity, "value") else event.severity,
                    "title": event.title,
                    "description": event.description,
                    "timestamp": event.timestamp.isoformat() if event.timestamp else None,
                    "created_at": event.created_at.isoformat() if event.created_at else None,
                    "affected_resource": event.affected_resource,
                    "incident_id": event.incident_id,
                    "ai_cost": event.ai_cost,
                    "token_count": event.token_count,
                })

            return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/events/device/{device_identifier}")
async def get_device_events(
    device_identifier: str,
    hours: int = Query(default=168, ge=1, le=720),
    _: None = Depends(require_viewer),
):
    """Get events related to a specific device by serial or name.

    Args:
        device_identifier: Device serial number or name to search for
        hours: Number of hours to look back (default: 168/1 week, max: 720/30 days)

    Returns:
        List of events related to the device with their incident information
    """
    try:
        from sqlalchemy import or_, cast, String
        from sqlalchemy.orm import selectinload

        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        async with db.session() as session:
            # Search in affected_resource, title, and description fields for device name or serial
            # Use LIKE for partial matching to catch variations
            # Description often contains device info like {"deviceName": "MX68 - Garage", "deviceSerial": "..."}
            query = (
                select(Event)
                .options(selectinload(Event.incident))
                .where(Event.timestamp >= cutoff_time)
                .where(
                    or_(
                        Event.affected_resource.ilike(f"%{device_identifier}%"),
                        Event.title.ilike(f"%{device_identifier}%"),
                        Event.description.ilike(f"%{device_identifier}%"),
                    )
                )
                .order_by(Event.timestamp.desc())
                .limit(50)  # Limit to 50 most recent events
            )

            result = await session.execute(query)
            events = result.scalars().all()

            # Construct response with incident info
            response = []
            for event in events:
                event_dict = {
                    "id": event.id,
                    "source": event.source.value if hasattr(event.source, "value") else event.source,
                    "event_type": event.event_type,
                    "severity": event.severity.value if hasattr(event.severity, "value") else event.severity,
                    "title": event.title,
                    "description": event.description,
                    "timestamp": event.timestamp.isoformat() if event.timestamp else None,
                    "affected_resource": event.affected_resource,
                    "incident_id": event.incident_id,
                }

                # Include incident info if linked
                if event.incident:
                    event_dict["incident"] = {
                        "id": event.incident.id,
                        "title": event.incident.title,
                        "status": event.incident.status.value if hasattr(event.incident.status, "value") else event.incident.status,
                        "severity": event.incident.severity.value if hasattr(event.incident.severity, "value") else event.incident.severity,
                    }

                response.append(event_dict)

            return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/incidents/{incident_id}/status")
async def update_incident_status(incident_id: int, status: str, _: None = Depends(require_operator)):
    """Update the status of an incident.

    Args:
        incident_id: Incident ID
        status: New status (open, investigating, resolved, closed)

    Returns:
        Updated incident
    """
    try:
        # Validate status
        valid_statuses = ["open", "investigating", "resolved", "closed"]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        async with db.session() as session:
            result = await session.execute(select(Incident).where(Incident.id == incident_id))
            incident = result.scalar_one_or_none()

            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            # Update status
            incident.status = status

            # If resolved or closed, set end_time if not already set
            if status in ["resolved", "closed"] and not incident.end_time:
                incident.end_time = datetime.utcnow()

            # Context manager will auto-commit

            return {
                "id": incident.id,
                "status": incident.status.value if hasattr(incident.status, "value") else incident.status,
                "end_time": incident.end_time.isoformat() if incident.end_time else None,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel
from typing import List as PyList

class CreateIncidentRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"  # critical, high, medium, low
    network_id: Optional[str] = None
    network_name: Optional[str] = None
    affected_services: Optional[PyList[str]] = None


@router.post("/api/incidents")
async def create_incident(request: CreateIncidentRequest, _: None = Depends(require_operator)):
    """Create a new incident manually.

    Args:
        request: Incident creation request

    Returns:
        Created incident
    """
    try:
        # Map severity string to enum
        severity_map = {
            "critical": EventSeverity.CRITICAL,
            "high": EventSeverity.HIGH,
            "medium": EventSeverity.MEDIUM,
            "low": EventSeverity.LOW,
        }
        severity = severity_map.get(request.severity.lower(), EventSeverity.MEDIUM)

        async with db.session() as session:
            incident = Incident(
                title=request.title,
                root_cause_hypothesis=request.description,
                severity=severity,
                status=IncidentStatus.OPEN,
                start_time=datetime.utcnow(),
                network_id=request.network_id,
                network_name=request.network_name,
                affected_services=request.affected_services,
                event_count=0,
            )

            session.add(incident)
            await session.flush()

            return {
                "id": incident.id,
                "title": incident.title,
                "status": incident.status.value if hasattr(incident.status, "value") else incident.status,
                "severity": incident.severity.value if hasattr(incident.severity, "value") else incident.severity,
                "created_at": incident.created_at.isoformat() if incident.created_at else None,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/incidents/{incident_id}/reassign")
async def reassign_incident(incident_id: int, assignee: str = "", _: None = Depends(require_operator)):
    """Reassign an incident to a different user/team.

    Note: The Incident model doesn't currently have an assignee field.
    This endpoint logs the reassignment for audit purposes and returns success.

    Args:
        incident_id: Incident ID
        assignee: New assignee name/email

    Returns:
        Acknowledgment of reassignment
    """
    try:
        async with db.session() as session:
            result = await session.execute(select(Incident).where(Incident.id == incident_id))
            incident = result.scalar_one_or_none()

            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            # Log the reassignment (since we don't have an assignee field)
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Incident {incident_id} reassigned to: {assignee}")

            return {
                "id": incident.id,
                "message": f"Incident reassigned to {assignee}" if assignee else "Reassignment noted",
                "assignee": assignee,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --------------------------------------------------------------
# AI-POWERED INCIDENT ANALYSIS ENDPOINTS
# --------------------------------------------------------------

class FeedbackRequest(BaseModel):
    rating: int  # 1-5 scale
    feedback: Optional[str] = None


@router.post("/api/incidents/{incident_id}/post-mortem", dependencies=[Depends(require_viewer)])
async def generate_post_mortem(incident_id: int):
    """Generate an AI-powered post-mortem report for an incident.

    Uses Claude to analyze the incident events, chat context, and generate
    a comprehensive post-mortem in Markdown format.

    Args:
        incident_id: Incident ID

    Returns:
        Post-mortem report in Markdown format
    """
    from sqlalchemy.orm import selectinload
    from src.services.multi_provider_ai import generate_text

    try:
        async with db.session() as session:
            # Get incident with events
            result = await session.execute(
                select(Incident)
                .options(selectinload(Incident.events))
                .where(Incident.id == incident_id)
            )
            incident = result.scalar_one_or_none()

            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            # Build context for AI
            events_summary = []
            for event in sorted(incident.events, key=lambda e: e.timestamp):
                events_summary.append(
                    f"- [{event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] "
                    f"[{event.severity.value if hasattr(event.severity, 'value') else event.severity}] "
                    f"{event.title}: {event.description or 'No description'}"
                )

            prompt = f"""Generate a comprehensive post-mortem report for the following incident.

INCIDENT DETAILS:
- Title: {incident.title}
- Severity: {incident.severity.value if hasattr(incident.severity, 'value') else incident.severity}
- Status: {incident.status.value if hasattr(incident.status, 'value') else incident.status}
- Start Time: {incident.start_time.strftime('%Y-%m-%d %H:%M:%S UTC') if incident.start_time else 'Unknown'}
- End Time: {incident.end_time.strftime('%Y-%m-%d %H:%M:%S UTC') if incident.end_time else 'Ongoing'}
- Affected Services: {', '.join(incident.affected_services) if incident.affected_services else 'Not specified'}
- AI Root Cause Hypothesis: {incident.root_cause_hypothesis or 'Not available'}
- Confidence Score: {incident.confidence_score}%

TIMELINE OF EVENTS:
{chr(10).join(events_summary) if events_summary else 'No events recorded'}

Please generate a post-mortem report in Markdown format with the following sections:

# Post-Mortem Report: [Incident Title]

## Executive Summary
Brief 2-3 sentence summary of what happened and the impact.

## Timeline
Chronological breakdown of key events.

## Root Cause Analysis
Detailed analysis of what caused this incident.

## Impact Assessment
What services/users were affected and for how long.

## Resolution
How was the incident resolved?

## Lessons Learned
Key takeaways and what we learned.

## Action Items
Specific, actionable steps to prevent recurrence (include owner and due date suggestions).

---
*Generated by Cisco AIOps Hub on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*
"""

            # Use multi-provider AI
            result = await generate_text(
                prompt=prompt,
                max_tokens=4096,
            )

            if not result:
                raise HTTPException(
                    status_code=503,
                    detail="AI service not configured - please configure an AI provider in Admin > System Config"
                )

            markdown = result["text"]

            return {
                "markdown": markdown,
                "incident_id": incident_id,
                "generated_at": datetime.utcnow().isoformat(),
            }

    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error generating post-mortem: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate post-mortem: {str(e)}")


@router.post("/api/incidents/{incident_id}/feedback", dependencies=[Depends(require_viewer)])
async def submit_incident_feedback(incident_id: int, feedback_data: FeedbackRequest):
    """Submit feedback on the AI analysis accuracy for an incident.

    Args:
        incident_id: Incident ID
        feedback_data: Rating (1-5) and optional feedback text

    Returns:
        Confirmation of feedback submission
    """
    try:
        # Validate rating
        if not 1 <= feedback_data.rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

        async with db.session() as session:
            result = await session.execute(select(Incident).where(Incident.id == incident_id))
            incident = result.scalar_one_or_none()

            if not incident:
                raise HTTPException(status_code=404, detail="Incident not found")

            # Update incident with feedback
            # Note: These fields should be added to the Incident model
            # For now, we store in a JSON field or log for analytics
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"AI Feedback for Incident #{incident_id}: "
                f"rating={feedback_data.rating}, feedback={feedback_data.feedback}"
            )

            # Try to update incident fields if they exist
            try:
                if hasattr(incident, 'ai_accuracy_rating'):
                    incident.ai_accuracy_rating = feedback_data.rating
                if hasattr(incident, 'user_feedback'):
                    incident.user_feedback = feedback_data.feedback
            except Exception:
                pass  # Fields may not exist yet

            return {
                "success": True,
                "incident_id": incident_id,
                "rating": feedback_data.rating,
                "message": "Feedback submitted successfully",
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


# --------------------------------------------------------------
# MERAKI ENDPOINTS — FULLY ASYNC USING meraki[aio]
# --------------------------------------------------------------

import meraki.aio

# Reuse a single async session across requests (best practice)
_async_dashboard_cache: dict = {}

async def get_async_dashboard(organization: str) -> meraki.aio.AsyncDashboardAPI:
    """Cached async dashboard instance per organization"""
    if organization in _async_dashboard_cache:
        return _async_dashboard_cache[organization]
    
    credentials = await credential_manager.get_credentials(organization)
    if "meraki" not in credentials["base_url"].lower():
        raise HTTPException(status_code=400, detail="Not a valid Meraki organization")

    dashboard = meraki.aio.AsyncDashboardAPI(
        api_key=credentials["api_key"],
        base_url=credentials["base_url"],
        suppress_logging=True,
        output_log=False,
        caller="lumen/web-api",
        wait_on_rate_limit=True,
    )
    _async_dashboard_cache[organization] = dashboard
    return dashboard


# ──────────────────────────────────────────────────────────────
# Organizations
# ──────────────────────────────────────────────────────────────


