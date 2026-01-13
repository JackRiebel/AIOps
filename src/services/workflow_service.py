"""Workflow Service - CRUD operations and business logic for AI-enabled workflows."""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.workflow import (
    Workflow, WorkflowExecution,
    WorkflowStatus, TriggerType, ExecutionStatus, RiskLevel, WorkflowMode
)

logger = logging.getLogger(__name__)


# ============================================================================
# Workflow Templates
# ============================================================================

WORKFLOW_TEMPLATES = {
    "device_offline_alert": {
        "name": "Device Offline Alert",
        "description": "Detect and respond to devices going offline",
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=syslog "device offline" OR "connectivity lost"',
        "poll_interval_seconds": 300,
        "conditions": [
            {"field": "event_count", "operator": ">=", "value": 1}
        ],
        "ai_prompt": "Analyze if this is a genuine outage or planned maintenance. Check if multiple devices are affected (possible network-wide issue).",
        "actions": [
            {"tool": "slack_notify", "params": {"channel": "#network-ops"}, "requires_approval": False},
            {"tool": "meraki_get_device", "params": {}, "requires_approval": False},
            {"tool": "meraki_reboot_device", "params": {}, "requires_approval": True}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.7,
    },
    "high_latency_detection": {
        "name": "High Latency Detection",
        "description": "Monitor for network latency spikes",
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=flow latency_ms>100',
        "poll_interval_seconds": 300,
        "conditions": [
            {"field": "latency_ms", "operator": ">", "value": 100}
        ],
        "ai_prompt": "Determine if latency is caused by congestion, device issue, or upstream problem.",
        "actions": [
            {"tool": "slack_notify", "params": {"channel": "#network-ops"}, "requires_approval": False},
            {"tool": "meraki_get_device_uplinks", "params": {}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.7,
    },
    "vpn_tunnel_flap": {
        "name": "VPN Tunnel Flap",
        "description": "Detect unstable VPN tunnels",
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki "VPN tunnel" ("down" OR "flapping")',
        "poll_interval_seconds": 300,
        "conditions": [
            {"field": "event_count", "operator": ">=", "value": 3}
        ],
        "ai_prompt": "Analyze VPN tunnel stability. Check both ends of the tunnel and identify potential causes.",
        "actions": [
            {"tool": "slack_notify", "params": {"channel": "#network-ops"}, "requires_approval": False},
            {"tool": "meraki_get_vpn_status", "params": {}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.8,
    },
    "bandwidth_threshold": {
        "name": "Bandwidth Threshold",
        "description": "Alert when links exceed utilization threshold",
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=flow utilization>80',
        "poll_interval_seconds": 600,
        "conditions": [
            {"field": "utilization", "operator": ">", "value": 80}
        ],
        "ai_prompt": "Analyze bandwidth usage patterns. Identify top consumers and recommend load balancing actions.",
        "actions": [
            {"tool": "slack_notify", "params": {"channel": "#network-ops"}, "requires_approval": False},
            {"tool": "meraki_get_network_traffic", "params": {}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.7,
    },
    "firmware_check": {
        "name": "Firmware Version Check",
        "description": "Detect devices running outdated firmware",
        "trigger_type": "schedule",
        "schedule_cron": "0 6 * * *",  # Daily at 6 AM
        "poll_interval_seconds": 86400,  # 24 hours
        "conditions": [],
        "ai_prompt": "Compare device firmware versions against recommended. Flag any critical security updates.",
        "actions": [
            {"tool": "meraki_list_organization_devices", "params": {}, "requires_approval": False},
            {"tool": "meraki_get_device_firmware", "params": {}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.6,
    },
    "config_drift_detection": {
        "name": "Configuration Drift Detection",
        "description": "Detect unauthorized configuration changes",
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=audit "configuration changed"',
        "poll_interval_seconds": 300,
        "conditions": [
            {"field": "event_count", "operator": ">=", "value": 1}
        ],
        "ai_prompt": "Analyze if this change was authorized and follows security policies.",
        "actions": [
            {"tool": "slack_notify", "params": {"channel": "#security-ops"}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.8,
    },
    "security_policy_audit": {
        "name": "Security Policy Audit",
        "description": "Weekly security configuration audit",
        "trigger_type": "schedule",
        "schedule_cron": "0 0 * * 0",  # Weekly on Sunday at midnight
        "poll_interval_seconds": 604800,  # 7 days
        "conditions": [],
        "ai_prompt": "Review firewall rules for security best practices. Identify any rules that are overly permissive or outdated.",
        "actions": [
            {"tool": "meraki_list_network_l3_firewall_rules", "params": {}, "requires_approval": False}
        ],
        "ai_enabled": True,
        "ai_confidence_threshold": 0.7,
    },
}


# ============================================================================
# Workflow Service Class
# ============================================================================

class WorkflowService:
    """Service for managing workflows and their executions."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # Workflow CRUD
    # -------------------------------------------------------------------------

    async def create_workflow(
        self,
        name: str,
        trigger_type: str,
        created_by: Optional[int] = None,
        organization: Optional[str] = None,
        description: Optional[str] = None,
        splunk_query: Optional[str] = None,
        schedule_cron: Optional[str] = None,
        poll_interval_seconds: int = 300,
        conditions: Optional[List[Dict]] = None,
        actions: Optional[List[Dict]] = None,
        ai_enabled: bool = True,
        ai_prompt: Optional[str] = None,
        ai_confidence_threshold: float = 0.7,
        flow_data: Optional[Dict] = None,
        status: str = "draft",
        template_id: Optional[str] = None,
        auto_execute_enabled: bool = False,
        auto_execute_min_confidence: float = 0.9,
        auto_execute_max_risk: str = "low",
        tags: Optional[List[str]] = None,
        mode: str = "cards",
        cli_code: Optional[str] = None,
        python_code: Optional[str] = None,
    ) -> Workflow:
        """Create a new workflow.

        Args:
            mode: Workflow creation mode - 'cards', 'cli', or 'python'
            cli_code: CLI script content (for CLI mode)
            python_code: Python script content (for Python mode)
        """
        workflow = Workflow(
            name=name,
            description=description,
            status=WorkflowStatus(status),
            trigger_type=TriggerType(trigger_type),
            splunk_query=splunk_query,
            schedule_cron=schedule_cron,
            poll_interval_seconds=poll_interval_seconds,
            conditions=conditions,
            actions=actions,
            ai_enabled=ai_enabled,
            ai_prompt=ai_prompt,
            ai_confidence_threshold=ai_confidence_threshold,
            auto_execute_enabled=auto_execute_enabled,
            auto_execute_min_confidence=auto_execute_min_confidence,
            auto_execute_max_risk=RiskLevel(auto_execute_max_risk),
            flow_data=flow_data,
            created_by=created_by,
            organization=organization,
            template_id=template_id,
            tags=tags,
            workflow_mode=WorkflowMode(mode),
            cli_code=cli_code,
            python_code=python_code,
        )

        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(f"Created workflow: {workflow.id} - {workflow.name}")
        return workflow

    async def create_from_template(
        self,
        template_id: str,
        created_by: Optional[int] = None,
        organization: Optional[str] = None,
        name_override: Optional[str] = None,
    ) -> Workflow:
        """Create a workflow from a template."""
        if template_id not in WORKFLOW_TEMPLATES:
            raise ValueError(f"Unknown template: {template_id}")

        template = WORKFLOW_TEMPLATES[template_id]

        return await self.create_workflow(
            name=name_override or template["name"],
            description=template["description"],
            trigger_type=template["trigger_type"],
            splunk_query=template.get("splunk_query"),
            schedule_cron=template.get("schedule_cron"),
            poll_interval_seconds=template.get("poll_interval_seconds", 300),
            conditions=template.get("conditions"),
            actions=template.get("actions"),
            ai_enabled=template.get("ai_enabled", True),
            ai_prompt=template.get("ai_prompt"),
            ai_confidence_threshold=template.get("ai_confidence_threshold", 0.7),
            created_by=created_by,
            organization=organization,
            template_id=template_id,
        )

    async def get_workflow(self, workflow_id: int) -> Optional[Workflow]:
        """Get a workflow by ID."""
        result = await self.db.execute(
            select(Workflow)
            .where(Workflow.id == workflow_id)
            .options(selectinload(Workflow.executions))
        )
        return result.scalar_one_or_none()

    async def list_workflows(
        self,
        organization: Optional[str] = None,
        status: Optional[str] = None,
        trigger_type: Optional[str] = None,
        created_by: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Workflow]:
        """List workflows with optional filters."""
        query = select(Workflow)

        conditions = []
        if organization:
            conditions.append(Workflow.organization == organization)
        if status:
            conditions.append(Workflow.status == WorkflowStatus(status))
        if trigger_type:
            conditions.append(Workflow.trigger_type == TriggerType(trigger_type))
        if created_by:
            conditions.append(Workflow.created_by == created_by)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(Workflow.updated_at)).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_workflows(self) -> List[Workflow]:
        """Get all workflows without pagination (for import duplicate checking)."""
        query = select(Workflow).order_by(desc(Workflow.updated_at))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_workflow(
        self,
        workflow_id: int,
        **updates
    ) -> Optional[Workflow]:
        """Update a workflow."""
        workflow = await self.get_workflow(workflow_id)
        if not workflow:
            return None

        # Handle enum conversions
        if "status" in updates:
            updates["status"] = WorkflowStatus(updates["status"])
        if "trigger_type" in updates:
            updates["trigger_type"] = TriggerType(updates["trigger_type"])
        if "mode" in updates:
            updates["mode"] = WorkflowMode(updates["mode"])

        for key, value in updates.items():
            if hasattr(workflow, key):
                setattr(workflow, key, value)

        workflow.updated_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(f"Updated workflow: {workflow_id}")
        return workflow

    async def delete_workflow(self, workflow_id: int) -> bool:
        """Delete a workflow and all its executions."""
        workflow = await self.get_workflow(workflow_id)
        if not workflow:
            return False

        await self.db.delete(workflow)
        await self.db.commit()

        logger.info(f"Deleted workflow: {workflow_id}")
        return True

    async def toggle_workflow(self, workflow_id: int) -> Optional[Workflow]:
        """Toggle a workflow between active and paused."""
        workflow = await self.get_workflow(workflow_id)
        if not workflow:
            return None

        if workflow.status == WorkflowStatus.ACTIVE:
            workflow.status = WorkflowStatus.PAUSED
        elif workflow.status in (WorkflowStatus.PAUSED, WorkflowStatus.DRAFT):
            workflow.status = WorkflowStatus.ACTIVE

        workflow.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(f"Toggled workflow {workflow_id} to {workflow.status}")
        return workflow

    async def get_active_workflows(self, organization: Optional[str] = None) -> List[Workflow]:
        """Get all active workflows, optionally filtered by organization."""
        query = select(Workflow).where(Workflow.status == WorkflowStatus.ACTIVE)
        if organization:
            query = query.where(Workflow.organization == organization)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    # -------------------------------------------------------------------------
    # Workflow Execution CRUD
    # -------------------------------------------------------------------------

    async def create_execution(
        self,
        workflow_id: int,
        trigger_data: Optional[Dict] = None,
        trigger_event_count: int = 0,
        ai_analysis: Optional[str] = None,
        ai_confidence: Optional[float] = None,
        ai_risk_level: Optional[str] = None,
        recommended_actions: Optional[List[Dict]] = None,
        requires_approval: bool = True,
        ai_cost_usd: float = 0.0,
        ai_input_tokens: int = 0,
        ai_output_tokens: int = 0,
    ) -> WorkflowExecution:
        """Create a new workflow execution."""
        execution = WorkflowExecution(
            workflow_id=workflow_id,
            status=ExecutionStatus.PENDING_APPROVAL if requires_approval else ExecutionStatus.APPROVED,
            trigger_data=trigger_data,
            trigger_event_count=trigger_event_count,
            ai_analysis=ai_analysis,
            ai_confidence=ai_confidence,
            ai_risk_level=RiskLevel(ai_risk_level) if ai_risk_level else None,
            recommended_actions=recommended_actions,
            requires_approval=requires_approval,
            ai_cost_usd=ai_cost_usd,
            ai_input_tokens=ai_input_tokens,
            ai_output_tokens=ai_output_tokens,
        )

        self.db.add(execution)
        await self.db.commit()
        await self.db.refresh(execution)

        # Update workflow stats
        workflow = await self.get_workflow(workflow_id)
        if workflow:
            workflow.trigger_count += 1
            workflow.last_triggered_at = datetime.utcnow()
            await self.db.commit()

        logger.info(f"Created execution {execution.id} for workflow {workflow_id}")
        return execution

    async def get_execution(self, execution_id: int) -> Optional[WorkflowExecution]:
        """Get an execution by ID."""
        result = await self.db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.id == execution_id)
            .options(selectinload(WorkflowExecution.workflow))
        )
        return result.scalar_one_or_none()

    async def list_executions(
        self,
        workflow_id: Optional[int] = None,
        status: Optional[str] = None,
        organization: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkflowExecution]:
        """List executions with optional filters."""
        query = select(WorkflowExecution).options(selectinload(WorkflowExecution.workflow))

        conditions = []
        if workflow_id:
            conditions.append(WorkflowExecution.workflow_id == workflow_id)
        if status:
            conditions.append(WorkflowExecution.status == ExecutionStatus(status))
        if organization:
            query = query.join(Workflow)
            conditions.append(Workflow.organization == organization)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(WorkflowExecution.created_at)).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_pending_approvals(
        self,
        organization: Optional[str] = None,
        limit: int = 50,
    ) -> List[WorkflowExecution]:
        """Get all executions pending approval."""
        query = (
            select(WorkflowExecution)
            .where(WorkflowExecution.status == ExecutionStatus.PENDING_APPROVAL)
            .options(selectinload(WorkflowExecution.workflow))
        )

        if organization:
            query = query.join(Workflow).where(Workflow.organization == organization)

        query = query.order_by(desc(WorkflowExecution.created_at)).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def approve_execution(
        self,
        execution_id: int,
        approved_by: int,
        modified_actions: Optional[List[Dict]] = None,
    ) -> Optional[WorkflowExecution]:
        """Approve a pending execution."""
        execution = await self.get_execution(execution_id)
        if not execution:
            return None

        if execution.status != ExecutionStatus.PENDING_APPROVAL:
            raise ValueError(f"Execution {execution_id} is not pending approval")

        execution.status = ExecutionStatus.APPROVED
        execution.approved_by = approved_by
        execution.approved_at = datetime.utcnow()

        if modified_actions:
            execution.executed_actions = modified_actions
        else:
            execution.executed_actions = execution.recommended_actions

        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(f"Approved execution {execution_id} by user {approved_by}")
        return execution

    async def reject_execution(
        self,
        execution_id: int,
        rejected_by: int,
        reason: Optional[str] = None,
    ) -> Optional[WorkflowExecution]:
        """Reject a pending execution."""
        execution = await self.get_execution(execution_id)
        if not execution:
            return None

        if execution.status != ExecutionStatus.PENDING_APPROVAL:
            raise ValueError(f"Execution {execution_id} is not pending approval")

        execution.status = ExecutionStatus.REJECTED
        execution.approved_by = rejected_by  # Record who rejected
        execution.approved_at = datetime.utcnow()
        execution.rejection_reason = reason

        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(f"Rejected execution {execution_id} by user {rejected_by}")
        return execution

    async def mark_execution_executing(self, execution_id: int) -> Optional[WorkflowExecution]:
        """Mark an execution as currently executing."""
        execution = await self.get_execution(execution_id)
        if not execution:
            return None

        execution.status = ExecutionStatus.EXECUTING
        execution.executed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(execution)
        return execution

    async def complete_execution(
        self,
        execution_id: int,
        result: Optional[Dict] = None,
        error: Optional[str] = None,
    ) -> Optional[WorkflowExecution]:
        """Mark an execution as completed or failed."""
        execution = await self.get_execution(execution_id)
        if not execution:
            return None

        if error:
            execution.status = ExecutionStatus.FAILED
            execution.error = error
        else:
            execution.status = ExecutionStatus.COMPLETED
            execution.result = result

        execution.completed_at = datetime.utcnow()

        # Update workflow stats
        workflow = await self.get_workflow(execution.workflow_id)
        if workflow:
            if error:
                workflow.failure_count += 1
            else:
                workflow.success_count += 1
            await self.db.commit()

        await self.db.commit()
        await self.db.refresh(execution)

        logger.info(f"Completed execution {execution_id} with status {execution.status}")
        return execution

    # -------------------------------------------------------------------------
    # Stats & Aggregations
    # -------------------------------------------------------------------------

    async def get_workflow_stats(self, organization: Optional[str] = None) -> Dict[str, Any]:
        """Get aggregated workflow statistics."""
        base_query = select(Workflow)
        if organization:
            base_query = base_query.where(Workflow.organization == organization)

        # Count by status
        all_workflows = await self.db.execute(base_query)
        workflows = list(all_workflows.scalars().all())

        status_counts = {
            "active": 0,
            "paused": 0,
            "draft": 0,
            "total": len(workflows),
        }
        total_triggers = 0
        total_successes = 0
        total_failures = 0

        for wf in workflows:
            status_counts[wf.status.value] += 1
            total_triggers += wf.trigger_count
            total_successes += wf.success_count
            total_failures += wf.failure_count

        # Count pending approvals
        pending_query = select(func.count(WorkflowExecution.id)).where(
            WorkflowExecution.status == ExecutionStatus.PENDING_APPROVAL
        )
        if organization:
            pending_query = pending_query.join(Workflow).where(Workflow.organization == organization)
        pending_result = await self.db.execute(pending_query)
        pending_count = pending_result.scalar() or 0

        # Triggered today count
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_query = select(func.count(WorkflowExecution.id)).where(
            WorkflowExecution.created_at >= today_start
        )
        if organization:
            today_query = today_query.join(Workflow).where(Workflow.organization == organization)
        today_result = await self.db.execute(today_query)
        today_count = today_result.scalar() or 0

        return {
            "workflows": status_counts,
            "pending_approvals": pending_count,
            "triggered_today": today_count,
            "total_triggers": total_triggers,
            "total_successes": total_successes,
            "total_failures": total_failures,
            "success_rate": (total_successes / total_triggers * 100) if total_triggers > 0 else 0,
        }

    async def get_templates(self) -> List[Dict[str, Any]]:
        """Get available workflow templates."""
        templates = []
        for template_id, template in WORKFLOW_TEMPLATES.items():
            templates.append({
                "id": template_id,
                "name": template["name"],
                "description": template["description"],
                "trigger_type": template["trigger_type"],
                "ai_enabled": template.get("ai_enabled", True),
                "action_count": len(template.get("actions", [])),
            })
        return templates


# ============================================================================
# Service Factory
# ============================================================================

def get_workflow_service(db: AsyncSession) -> WorkflowService:
    """Factory function to get a WorkflowService instance."""
    return WorkflowService(db)
