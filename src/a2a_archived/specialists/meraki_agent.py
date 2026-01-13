"""Meraki Network Specialist Agent.

This agent provides skills for interacting with the Meraki Dashboard API,
including network management, device operations, and wireless configuration.

The agent aggregates skills from modular skill modules for full API coverage:
- Organizations (~39 skills)
- Networks (~55 skills)
- Devices (~30 skills)
- Wireless (~50 skills)
- Appliance (~72 skills)
- Switch (~62 skills)
- Camera (~28 skills)
- Sensor (~16 skills)
- Insight (~9 skills)
- SM/MDM (~33 skills)
- Licensing (~14 skills)
"""

import logging
from typing import List, Dict, Any

from ..types import AgentSkill
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
    SmartResponseMixin,
)
from src.services.meraki_api import MerakiAPIClient

# Import all skill modules
from .meraki import (
    OrganizationsModule,
    NetworksModule,
    DevicesModule,
    WirelessModule,
    ApplianceModule,
    SwitchModule,
    CameraModule,
    SensorModule,
    InsightModule,
    SMModule,
    LicensingModule,
)

logger = logging.getLogger(__name__)

# List of all skill modules for aggregation
SKILL_MODULES = [
    OrganizationsModule,
    NetworksModule,
    DevicesModule,
    WirelessModule,
    ApplianceModule,
    SwitchModule,
    CameraModule,
    SensorModule,
    InsightModule,
    SMModule,
    LicensingModule,
]


class MerakiAgent(BaseSpecialistAgent, SmartResponseMixin):
    """Specialist agent for Meraki Dashboard API operations.

    This agent provides full API coverage with 400+ skills across all Meraki products:
    - Organizations: Org management, admins, alerts, config templates, inventory
    - Networks: Network CRUD, clients, events, firmware, webhooks, floor plans
    - Devices: Device management, live tools, reboots, cellular
    - Wireless: SSIDs, RF profiles, bluetooth, air marshal, analytics
    - Appliance: VLANs, firewall, NAT, VPN, traffic shaping, security
    - Switch: Ports, stacks, routing, ACLs, QoS, STP
    - Camera: Quality, video, sense, analytics, snapshots
    - Sensor: Alert profiles, readings, relationships
    - Insight: Media servers, application health
    - SM: MDM devices, users, profiles, target groups
    - Licensing: Co-term, per-device, subscriptions
    """

    AGENT_ID = "meraki-agent"
    AGENT_NAME = "Meraki Network Specialist"
    AGENT_ROLE = "meraki-specialist"
    AGENT_PRIORITY = 6  # Higher priority than other specialists (default is 5)
    AGENT_DESCRIPTION = (
        "Full-featured Meraki Dashboard specialist with 400+ skills for complete API coverage. "
        "Supports all Meraki products: MX appliances, MS switches, MR wireless, MV cameras, "
        "MT sensors, SM (MDM), and licensing."
    )

    def get_skills(self) -> List[AgentSkill]:
        """Get all Meraki skills from modular skill modules.

        Aggregates skills from all skill modules for full API coverage.
        """
        all_skills = []

        # Aggregate skills from all modules
        for module in SKILL_MODULES:
            try:
                module_skills = module.get_skills()
                all_skills.extend(module_skills)
                logger.debug(f"[MerakiAgent] Loaded {len(module_skills)} skills from {module.MODULE_NAME}")
            except Exception as e:
                logger.warning(f"[MerakiAgent] Failed to load skills from {module.MODULE_NAME}: {e}")

        logger.info(f"[MerakiAgent] Total skills available: {len(all_skills)}")
        return all_skills

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a Meraki skill.

        Routes skills to the appropriate module for execution.

        Args:
            skill_id: The skill to execute
            params: Skill parameters
            context: Execution context with credentials

        Returns:
            SkillResult with data or error
        """
        logger.info(f"[MerakiAgent] Executing skill: {skill_id}")

        # Create API client
        if not context.api_key:
            return SkillResult(
                success=False,
                error="No API key available for Meraki"
            )

        try:
            async with MerakiAPIClient(
                api_key=context.api_key,
                base_url=context.base_url or "https://api.meraki.com/api/v1",
            ) as client:
                # Route to the appropriate module
                for module in SKILL_MODULES:
                    if module.handles(skill_id):
                        logger.info(f"[MerakiAgent] Routing {skill_id} to {module.MODULE_NAME}")
                        result = await module.execute(skill_id, client, params, context)

                        # Convert module result to SkillResult if needed
                        if isinstance(result, SkillResult):
                            return result
                        if hasattr(result, 'success'):
                            return result

                        # Wrap raw result in SkillResult
                        return SkillResult(
                            success=True,
                            data=result.data if hasattr(result, 'data') else result,
                            entities_extracted=getattr(result, 'entities', {}),
                        )

                # No module handles this skill
                return SkillResult(
                    success=False,
                    error=f"Unknown skill: {skill_id}"
                )

        except Exception as e:
            logger.error(f"[MerakiAgent] Skill execution error: {e}", exc_info=True)
            return SkillResult(
                success=False,
                error=str(e)
            )
