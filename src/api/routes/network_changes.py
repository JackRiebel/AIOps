"""
Network Changes API Routes

Endpoints for managing network configuration changes with performance tracking
and rollback capability.
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from src.api.dependencies import require_editor, get_current_active_user
from src.services.network_change_service import (
    get_network_change_service,
    ChangeType,
    ChangeStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/network-changes", tags=["Network Changes"])


# =============================================================================
# Request/Response Models
# =============================================================================


class ApplyChangeRequest(BaseModel):
    """Request to apply a network configuration change."""
    change_type: str = Field(..., description="Type of change: ssid_config, rf_profile, traffic_shaping, etc.")
    setting_path: str = Field(..., description="Path to the setting being changed")
    new_value: dict | str | int | float | bool | list = Field(..., description="New value to apply")
    resource_id: Optional[str] = Field(None, description="Resource identifier (e.g., SSID number)")
    description: str = Field("", description="Human-readable description of the change")
    capture_metrics: bool = Field(True, description="Whether to capture performance metrics before/after")


class RevertChangeRequest(BaseModel):
    """Request to revert a network change."""
    reason: str = Field("", description="Optional reason for reverting")


class MetricsResponse(BaseModel):
    """Network performance metrics snapshot."""
    latency_ms: Optional[float] = None
    packet_loss_percent: Optional[float] = None
    jitter_ms: Optional[float] = None
    throughput_mbps: Optional[float] = None
    client_count: Optional[int] = None
    channel_utilization: Optional[float] = None
    signal_strength_dbm: Optional[float] = None
    connection_success_rate: Optional[float] = None
    captured_at: str


class MetricDeltaResponse(BaseModel):
    """Comparison between before and after metrics."""
    metric_name: str
    before_value: Optional[float]
    after_value: Optional[float]
    delta: Optional[float]
    delta_percent: Optional[float]
    improved: bool


class ChangeRecordResponse(BaseModel):
    """Network change record response."""
    id: str
    network_id: str
    organization_id: str
    change_type: str
    setting_path: str
    previous_value: dict | str | int | float | bool | list | None
    new_value: dict | str | int | float | bool | list | None
    metrics_before: Optional[MetricsResponse] = None
    metrics_after: Optional[MetricsResponse] = None
    applied_at: str
    reverted_at: Optional[str] = None
    user_id: str
    status: str
    description: str
    resource_id: Optional[str] = None


class ChangeComparisonResponse(BaseModel):
    """Full change comparison with metrics and assessment."""
    change: ChangeRecordResponse
    deltas: List[MetricDeltaResponse]
    assessment: dict


class ChangeHistoryResponse(BaseModel):
    """List of network changes."""
    changes: List[ChangeRecordResponse]
    total: int


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/{network_id}/metrics")
async def get_current_metrics(
    network_id: str,
    org_id: str = Query(..., description="Organization/credential ID"),
    metric_types: Optional[str] = Query(None, description="Comma-separated list of metric types"),
    _user=Depends(require_editor),
):
    """
    Get current network performance metrics.

    Returns a snapshot of performance metrics for the specified network,
    useful for capturing baseline before making configuration changes.
    """
    try:
        service = get_network_change_service()

        metric_list = metric_types.split(",") if metric_types else None
        metrics = await service.get_current_metrics(network_id, org_id, metric_list)

        return {
            "success": True,
            "data": metrics.to_dict(),
        }
    except Exception as e:
        logger.error(f"Error getting metrics for {network_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{network_id}/apply", dependencies=[Depends(require_editor)])
async def apply_change(
    network_id: str,
    request: ApplyChangeRequest,
    org_id: str = Query(..., description="Organization/credential ID"),
    user=Depends(get_current_active_user),
):
    """
    Apply a network configuration change with metric tracking.

    Captures performance metrics before the change (if enabled),
    applies the configuration change, and creates a change record
    for potential rollback.
    """
    try:
        # Validate change type
        try:
            change_type = ChangeType(request.change_type)
        except ValueError:
            valid_types = [t.value for t in ChangeType]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid change_type. Must be one of: {valid_types}"
            )

        service = get_network_change_service()

        user_id = str(user.id) if hasattr(user, 'id') else "api-user"

        change = await service.apply_change(
            network_id=network_id,
            org_id=org_id,
            change_type=change_type,
            setting_path=request.setting_path,
            new_value=request.new_value,
            user_id=user_id,
            resource_id=request.resource_id,
            description=request.description,
            capture_metrics=request.capture_metrics,
        )

        return {
            "success": True,
            "message": "Configuration change applied successfully",
            "data": change.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying change to {network_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{change_id}/revert", dependencies=[Depends(require_editor)])
async def revert_change(
    change_id: str,
    request: Optional[RevertChangeRequest] = None,
    user=Depends(get_current_active_user),
):
    """
    Revert a previously applied configuration change.

    Restores the previous configuration value and updates the
    change record status to 'reverted'.
    """
    try:
        service = get_network_change_service()

        change = await service.revert_change(change_id)

        return {
            "success": True,
            "message": "Configuration change reverted successfully",
            "data": change.to_dict(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error reverting change {change_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{change_id}/update-metrics", dependencies=[Depends(require_editor)])
async def update_metrics_after(
    change_id: str,
):
    """
    Capture post-change metrics and update the change record.

    Should be called after waiting for metrics to stabilize
    (typically 2-5 minutes after a configuration change).
    """
    try:
        service = get_network_change_service()

        change = await service.update_metrics_after(change_id)

        # Calculate deltas
        deltas = service.calculate_metric_deltas(change)
        assessment = service.assess_overall_impact(deltas)

        return {
            "success": True,
            "data": {
                "change": change.to_dict(),
                "deltas": [d.to_dict() for d in deltas],
                "assessment": assessment,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating metrics for change {change_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{change_id}")
async def get_change_details(
    change_id: str,
    include_comparison: bool = Query(True, description="Include metric comparison"),
    _user=Depends(require_editor),
):
    """
    Get details of a specific network change.

    Optionally includes metric comparison (before/after deltas)
    and overall impact assessment.
    """
    try:
        service = get_network_change_service()

        change = await service._load_change(change_id)
        if not change:
            raise HTTPException(status_code=404, detail=f"Change not found: {change_id}")

        response = {
            "success": True,
            "data": {
                "change": change.to_dict(),
            },
        }

        if include_comparison and change.metrics_before and change.metrics_after:
            deltas = service.calculate_metric_deltas(change)
            assessment = service.assess_overall_impact(deltas)
            response["data"]["deltas"] = [d.to_dict() for d in deltas]
            response["data"]["assessment"] = assessment

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting change {change_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{network_id}/history")
async def get_change_history(
    network_id: str,
    limit: int = Query(20, ge=1, le=100),
    include_reverted: bool = Query(True),
    _user=Depends(require_editor),
):
    """
    Get change history for a network.

    Returns a list of configuration changes made to the network,
    including their status and any captured metrics.
    """
    try:
        service = get_network_change_service()

        changes = await service.get_change_history(
            network_id=network_id,
            limit=limit,
            include_reverted=include_reverted,
        )

        return {
            "success": True,
            "data": {
                "changes": [c.to_dict() for c in changes],
                "total": len(changes),
            },
        }
    except Exception as e:
        logger.error(f"Error getting history for {network_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{network_id}/comparison/{change_id}")
async def get_change_comparison(
    network_id: str,
    change_id: str,
    _user=Depends(require_editor),
):
    """
    Get full comparison data for a network change card.

    Returns the change details, before/after metrics,
    calculated deltas, and overall assessment for rendering
    a network_change_comparison card.
    """
    try:
        service = get_network_change_service()

        change = await service._load_change(change_id)
        if not change:
            raise HTTPException(status_code=404, detail=f"Change not found: {change_id}")

        if change.network_id != network_id:
            raise HTTPException(status_code=400, detail="Change does not belong to this network")

        # Calculate deltas and assessment
        deltas = service.calculate_metric_deltas(change)
        assessment = service.assess_overall_impact(deltas)

        return {
            "success": True,
            "data": {
                "change": {
                    "id": change.id,
                    "change_type": change.change_type.value,
                    "setting_path": change.setting_path,
                    "previous_value": change.previous_value,
                    "new_value": change.new_value,
                    "description": change.description,
                    "applied_at": change.applied_at,
                    "reverted_at": change.reverted_at,
                    "status": change.status.value,
                },
                "metrics_before": change.metrics_before.to_dict() if change.metrics_before else None,
                "metrics_after": change.metrics_after.to_dict() if change.metrics_after else None,
                "deltas": [d.to_dict() for d in deltas],
                "assessment": assessment,
                "can_revert": change.status == ChangeStatus.APPLIED,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting comparison for {change_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
