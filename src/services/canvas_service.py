"""
Canvas service for managing artifacts.

This module provides business logic for creating, updating, and
detecting artifacts from tool results.
"""

import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy import select, and_

from src.config.database import get_db
from src.models.canvas import CanvasArtifact, ArtifactType

logger = logging.getLogger(__name__)


@dataclass
class ArtifactSpec:
    """Specification for creating an artifact."""
    type: ArtifactType
    title: str
    content: Dict[str, Any]
    description: Optional[str] = None
    render_config: Optional[Dict] = None
    raw_content: Optional[str] = None


class CanvasService:
    """Service for managing canvas artifacts."""

    def __init__(self):
        self.db = get_db()

    async def create_artifact(
        self,
        session_id: int,
        spec: ArtifactSpec,
        conversation_id: Optional[int] = None,
        source_tool: Optional[str] = None,
        source_message_id: Optional[str] = None,
    ) -> CanvasArtifact:
        """Create a new canvas artifact.

        Args:
            session_id: AI session ID
            spec: Artifact specification
            conversation_id: Optional conversation ID
            source_tool: Tool that generated this artifact
            source_message_id: Message ID that triggered this artifact

        Returns:
            Created CanvasArtifact
        """
        async with self.db.session() as session:
            artifact = CanvasArtifact(
                session_id=session_id,
                conversation_id=conversation_id,
                artifact_type=spec.type,
                title=spec.title,
                description=spec.description,
                content=spec.content,
                raw_content=spec.raw_content,
                source_tool=source_tool,
                source_message_id=source_message_id,
                render_config=spec.render_config,
            )
            session.add(artifact)
            await session.commit()
            await session.refresh(artifact)
            return artifact

    async def update_artifact(
        self,
        artifact_id: int,
        updates: Dict[str, Any],
        create_version: bool = True
    ) -> Optional[CanvasArtifact]:
        """Update an artifact, optionally creating a new version.

        Args:
            artifact_id: ID of artifact to update
            updates: Dictionary of fields to update
            create_version: If True, create new version instead of in-place update

        Returns:
            Updated or new CanvasArtifact, or None if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(CanvasArtifact).where(CanvasArtifact.id == artifact_id)
            )
            artifact = result.scalar_one_or_none()

            if not artifact:
                return None

            if create_version:
                # Create new version
                new_artifact = CanvasArtifact(
                    session_id=artifact.session_id,
                    conversation_id=artifact.conversation_id,
                    artifact_type=artifact.artifact_type,
                    title=updates.get("title", artifact.title),
                    description=updates.get("description", artifact.description),
                    content=updates.get("content", artifact.content),
                    raw_content=updates.get("raw_content", artifact.raw_content),
                    source_tool=artifact.source_tool,
                    source_message_id=artifact.source_message_id,
                    render_config=updates.get("render_config", artifact.render_config),
                    version=artifact.version + 1,
                    parent_id=artifact.id,
                )
                session.add(new_artifact)
                await session.commit()
                await session.refresh(new_artifact)
                return new_artifact
            else:
                # In-place update
                for key, value in updates.items():
                    if hasattr(artifact, key):
                        setattr(artifact, key, value)
                await session.commit()
                await session.refresh(artifact)
                return artifact

    async def get_artifact(self, artifact_id: int) -> Optional[CanvasArtifact]:
        """Get an artifact by ID."""
        async with self.db.session() as session:
            result = await session.execute(
                select(CanvasArtifact).where(CanvasArtifact.id == artifact_id)
            )
            return result.scalar_one_or_none()

    async def get_session_artifacts(
        self,
        session_id: int,
        include_all_versions: bool = False
    ) -> List[CanvasArtifact]:
        """Get all artifacts for a session.

        Args:
            session_id: AI session ID
            include_all_versions: If False, only return latest versions

        Returns:
            List of artifacts
        """
        async with self.db.session() as session:
            query = select(CanvasArtifact).where(
                CanvasArtifact.session_id == session_id
            )

            if not include_all_versions:
                # Get only artifacts that are not parents of other artifacts
                subquery = select(CanvasArtifact.parent_id).where(
                    CanvasArtifact.parent_id.isnot(None)
                )
                query = query.where(~CanvasArtifact.id.in_(subquery))

            query = query.order_by(CanvasArtifact.created_at.desc())
            result = await session.execute(query)
            return list(result.scalars().all())

    async def delete_artifact(self, artifact_id: int) -> bool:
        """Delete an artifact and its versions.

        Args:
            artifact_id: ID of artifact to delete

        Returns:
            True if deleted, False if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(CanvasArtifact).where(CanvasArtifact.id == artifact_id)
            )
            artifact = result.scalar_one_or_none()

            if not artifact:
                return False

            await session.delete(artifact)
            await session.commit()
            return True

    def detect_artifact_from_tool_result(
        self,
        tool_name: str,
        tool_result: Dict[str, Any]
    ) -> Optional[ArtifactSpec]:
        """Detect if a tool result should become an artifact.

        Args:
            tool_name: Name of the tool that was executed
            tool_result: The tool's result data

        Returns:
            ArtifactSpec if result should become artifact, None otherwise
        """
        # Handle failed results
        if not tool_result or not tool_result.get("success", True):
            return None

        data = tool_result.get("data", tool_result)

        # Network lists -> Data table
        if tool_name in ["list_networks", "get_networks"]:
            networks = data if isinstance(data, list) else data.get("networks", [])
            if networks:
                return ArtifactSpec(
                    type=ArtifactType.DATA_TABLE,
                    title="Networks",
                    content={
                        "columns": ["name", "id", "type", "timeZone"],
                        "rows": networks,
                    },
                    render_config={"style": "compact"}
                )

        # Device lists -> Device cards or data table
        if tool_name in ["list_devices", "get_devices_in_network", "get_devices"]:
            devices = data if isinstance(data, list) else data.get("devices", [])
            if devices:
                if len(devices) <= 6:
                    return ArtifactSpec(
                        type=ArtifactType.DEVICE_CARDS,
                        title="Devices",
                        content={"devices": devices},
                        render_config={"layout": "grid", "columns": 3}
                    )
                else:
                    return ArtifactSpec(
                        type=ArtifactType.DATA_TABLE,
                        title="Devices",
                        content={
                            "columns": ["name", "model", "serial", "mac", "status"],
                            "rows": devices,
                        },
                    )

        # Network topology
        if tool_name == "get_network_topology":
            if "nodes" in data or "edges" in data:
                return ArtifactSpec(
                    type=ArtifactType.TOPOLOGY,
                    title="Network Topology",
                    content=data,
                    render_config={"layout": "hierarchical"}
                )

        # Client lists
        if tool_name in ["get_device_clients", "list_clients", "get_network_clients"]:
            clients = data if isinstance(data, list) else data.get("clients", [])
            if clients:
                return ArtifactSpec(
                    type=ArtifactType.DATA_TABLE,
                    title="Connected Clients",
                    content={
                        "columns": ["description", "ip", "mac", "vlan", "status"],
                        "rows": clients,
                    },
                )

        # Performance/metrics data -> Charts
        if "performance" in tool_name or "metrics" in tool_name:
            return ArtifactSpec(
                type=ArtifactType.CHART,
                title="Performance Metrics",
                content=data,
                render_config={"chart_type": "line"}
            )

        # Splunk query results
        if tool_name in ["run_splunk_query", "splunk_search"]:
            results = data if isinstance(data, list) else data.get("results", [])
            if results:
                return ArtifactSpec(
                    type=ArtifactType.DATA_TABLE,
                    title="Splunk Results",
                    content={
                        "columns": list(results[0].keys()) if results else [],
                        "rows": results,
                    },
                )

        # ThousandEyes test results
        if "thousandeyes" in tool_name:
            if isinstance(data, list) and data:
                return ArtifactSpec(
                    type=ArtifactType.DATA_TABLE,
                    title="ThousandEyes Results",
                    content={
                        "columns": list(data[0].keys()) if data else [],
                        "rows": data,
                    },
                )

        return None

    # Rendering helpers for frontend

    def render_data_table(self, content: Dict) -> Dict:
        """Render data as a table structure for frontend."""
        data = content.get("rows", content.get("data", []))
        columns = content.get("columns")

        if not columns and data:
            columns = list(data[0].keys()) if isinstance(data[0], dict) else []

        return {
            "type": "data_table",
            "columns": columns,
            "rows": data,
            "totalRows": len(data),
        }

    def render_device_cards(self, content: Dict) -> Dict:
        """Render devices as card grid."""
        devices = content.get("devices", [])
        return {
            "type": "device_cards",
            "devices": [
                {
                    "id": d.get("serial") or d.get("id"),
                    "name": d.get("name", "Unknown"),
                    "model": d.get("model", ""),
                    "status": d.get("status", "unknown"),
                    "mac": d.get("mac", ""),
                    "lanIp": d.get("lanIp", ""),
                    "publicIp": d.get("publicIp", ""),
                }
                for d in devices
            ]
        }

    def render_topology(self, content: Dict) -> Dict:
        """Render network topology as graph."""
        return {
            "type": "topology",
            "nodes": content.get("nodes", []),
            "edges": content.get("edges", []),
            "layout": content.get("layout", "hierarchical"),
        }

    def render_chart(self, content: Dict) -> Dict:
        """Render chart data."""
        return {
            "type": "chart",
            "chartType": content.get("chart_type", "line"),
            "data": content.get("data", {}),
            "options": content.get("options", {}),
        }


# Singleton instance
_canvas_service: Optional[CanvasService] = None


def get_canvas_service() -> CanvasService:
    """Get the singleton CanvasService instance."""
    global _canvas_service
    if _canvas_service is None:
        _canvas_service = CanvasService()
    return _canvas_service
