"""UI Canvas Card Generator Agent.

Enterprise-grade specialist for generating canvas UI cards and visualizations.
All cards use polling-based live data updates with Cisco-style design.

Card Categories:
- Health & Status: NetworkHealthCard, DeviceStatusCard, ComplianceCard
- Topology: TopologyMapCard, VLANDiagramCard, PathTraceCard
- Traffic & Performance: BandwidthCard, PerformanceCard, TrafficFlowCard
- Events & Alerts: AlertTimelineCard
- Clients: ClientDistributionCard
"""

import logging
from typing import List, Dict, Any

from ..types import AgentSkill
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
)
from .ui import SKILL_MODULES

logger = logging.getLogger(__name__)


# Map skill IDs to their modules for routing
_SKILL_MODULE_MAP: Dict[str, Any] = {}
for module in SKILL_MODULES:
    for skill in module.get_skills():
        _SKILL_MODULE_MAP[skill.id] = module


class UIAgent(BaseSpecialistAgent):
    """Enterprise specialist agent for generating canvas UI cards.

    This agent generates polling-based, Cisco-style visualization cards
    for network dashboards. All cards feature:
    - Live polling with configurable intervals
    - Pause/resume/refresh controls
    - Consistent enterprise design
    - Error handling with retry

    Available Card Skills:
    - generate-network-health-card: Network health dashboard with gauges
    - generate-device-status-card: Device status grid with filtering
    - generate-compliance-card: Compliance scores by category
    - generate-topology-card: Interactive network topology map
    - generate-vlan-diagram-card: VLAN structure visualization
    - generate-path-trace-card: Hop-by-hop path visualization
    - generate-bandwidth-card: Interface utilization and top talkers
    - generate-traffic-flow-card: Traffic flow Sankey diagram
    - generate-performance-card: Latency/loss/jitter gauges
    - generate-alert-timeline-card: Alert timeline with severity filtering
    - generate-client-distribution-card: Client breakdown by SSID/VLAN
    """

    AGENT_ID = "ui-agent"
    AGENT_NAME = "Canvas UI Generator"
    AGENT_ROLE = "ui-specialist"
    AGENT_DESCRIPTION = (
        "Enterprise-grade specialist for generating canvas UI cards and visualizations. "
        "Supports polling-based live data, Cisco-style design, and enterprise card types "
        "including network health, topology, bandwidth, performance, and alerts."
    )

    def get_skills(self) -> List[AgentSkill]:
        """Get all enterprise UI generation skills."""
        skills = []
        for module in SKILL_MODULES:
            skills.extend(module.get_skills())
        return skills

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a UI generation skill."""
        logger.info(f"[UIAgent] Executing skill: {skill_id}")

        try:
            # Route to appropriate module
            if skill_id in _SKILL_MODULE_MAP:
                module = _SKILL_MODULE_MAP[skill_id]
                logger.info(f"[UIAgent] Routing to module: {module.__name__}")
                card_response = await module.execute(skill_id, params, context)
                return SkillResult(
                    success=card_response.success,
                    data=card_response.data,
                    error=card_response.error,
                )
            else:
                return SkillResult(
                    success=False,
                    error=f"Unknown skill: {skill_id}. Available skills: {list(_SKILL_MODULE_MAP.keys())}"
                )

        except Exception as e:
            logger.error(f"[UIAgent] Skill execution error: {e}", exc_info=True)
            return SkillResult(
                success=False,
                error=str(e)
            )

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate human-readable summary for UI agent results."""
        data = result.data

        if "card" in data:
            card = data["card"]
            card_type = card.get("card_type", card.get("type", "unknown"))
            title = card.get("title", "Untitled")
            polling = card.get("polling_interval", 0)
            if polling:
                return f"Generated {card_type} card: {title} (polling every {polling // 1000}s)"
            return f"Generated {card_type} card: {title}"

        return super()._generate_text_summary(skill_id, result)
