"""Catalyst Center Specialist Agent.

This agent provides 200+ skills for interacting with Cisco Catalyst Center (DNAC) API,
covering all API domains including site management, device operations, network health,
templates, wireless, SD-Access, compliance, and more.

Organized into modular skill sets matching the official Catalyst Center REST API structure.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..types import AgentSkill
from ..collaboration import ArtifactType
from .base_specialist import (
    BaseSpecialistAgent,
    AgentExecutionContext,
    SkillResult,
    SmartResponseMixin,
)
from src.services.catalyst_api import CatalystCenterClient

# Import all skill modules
from .catalyst import (
    ALL_MODULES,
    CatalystAPIClient,
    CatalystSkillModule,
    SitesModule,
    DevicesModule,
    InterfacesModule,
    ClientsModule,
    IssuesModule,
    HealthModule,
    TopologyModule,
    NetworkSettingsModule,
    DiscoveryModule,
    SwimModule,
    CommandRunnerModule,
    TemplatesModule,
    WirelessModule,
    SDAModule,
    ComplianceModule,
    EventsModule,
    PathTraceModule,
)

logger = logging.getLogger(__name__)


class CatalystAgent(BaseSpecialistAgent, SmartResponseMixin):
    """Specialist agent for Catalyst Center API operations.

    Provides 200+ skills across all Catalyst Center API domains:
    - Sites: Site hierarchy, membership, floors
    - Devices: Inventory, config, sync, modules, chassis
    - Interfaces: VLANs, statistics, routing protocols
    - Clients: Health, proximity, enrichment
    - Issues: Query, resolve, custom definitions
    - Health: Site, network, device, client analytics
    - Topology: Physical, L2, L3, VLAN views
    - Network Settings: DHCP, DNS, NTP, credentials, IP pools
    - Discovery: Network discovery jobs
    - SWIM: Software image management
    - Command Runner: CLI execution on devices
    - Templates: Configuration templates
    - Wireless: SSIDs, profiles, RF, access points
    - SDA: Fabric sites, border/edge devices, virtual networks
    - Compliance: Policy compliance management
    - Events: Event subscriptions and notifications
    - Path Trace: Network path analysis

    Smart Features:
    - Positive framing for no issues ("no issues = stable network")
    - Smart health score interpretation
    - Contextual suggestions when devices unreachable
    """

    AGENT_ID = "catalyst-agent"
    AGENT_NAME = "Catalyst Center Specialist"
    AGENT_ROLE = "catalyst-specialist"
    AGENT_DESCRIPTION = (
        "Specialist for Cisco Catalyst Center (DNA Center) operations providing 200+ skills "
        "across all API domains including site management, device operations, network health, "
        "templates, wireless, SD-Access fabric, compliance, and event management. "
        "Smart features: positive framing when no issues, intelligent health scoring, "
        "and contextual suggestions for troubleshooting."
    )

    # Module registry for skill routing
    _modules: List[CatalystSkillModule] = ALL_MODULES

    def get_skills(self) -> List[AgentSkill]:
        """Get all Catalyst Center skills from all modules."""
        all_skills = []
        for module in self._modules:
            all_skills.extend(module.get_skills())

        logger.info(f"[CatalystAgent] Loaded {len(all_skills)} skills from {len(self._modules)} modules")
        return all_skills

    def _find_module_for_skill(self, skill_id: str) -> Optional[CatalystSkillModule]:
        """Find the module that handles a given skill."""
        for module in self._modules:
            if module.handles(skill_id):
                return module
        return None

    async def execute_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Execute a Catalyst Center skill."""
        logger.info(f"[CatalystAgent] Executing skill: {skill_id}")

        # Check for credentials
        if not context.api_key and not context.entities_from_previous_turns.get("username"):
            return SkillResult(
                success=False,
                error="No credentials available for Catalyst Center"
            )

        try:
            # Create the modular API client
            api_client = CatalystAPIClient(
                base_url=context.base_url or "",
                username=context.entities_from_previous_turns.get("username"),
                password=context.api_secret,
                api_token=context.api_key,
            )

            # Find the appropriate module
            module = self._find_module_for_skill(skill_id)

            if module is None:
                # Fallback to legacy skill handling
                return await self._execute_legacy_skill(skill_id, params, context)

            # Execute via module
            result = await module.execute(skill_id, api_client, params, context)

            # Convert module SkillResult to agent SkillResult
            return self._convert_module_result(skill_id, result, context)

        except Exception as e:
            logger.error(f"[CatalystAgent] Skill execution error: {e}", exc_info=True)
            return SkillResult(
                success=False,
                error=str(e)
            )

    def _convert_module_result(
        self,
        skill_id: str,
        module_result: Any,
        context: AgentExecutionContext
    ) -> SkillResult:
        """Convert module result to agent SkillResult with smart enhancements."""
        if not module_result.success:
            return SkillResult(
                success=False,
                error=module_result.error or "Operation failed"
            )

        data = module_result.data or {}

        # Apply smart framing based on skill type and results
        data = self._apply_smart_framing(skill_id, data)

        # Create artifacts for significant data
        if context.session_id and data:
            self._create_result_artifact(skill_id, data, context)

        # Generate follow-up suggestions
        follow_up = self._generate_follow_up(skill_id, data)

        return SkillResult(
            success=True,
            data=data,
            suggested_follow_up=follow_up,
            entities_extracted=self._extract_entities(skill_id, data),
        )

    def _apply_smart_framing(self, skill_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply smart positive framing to results."""
        # Health-related skills
        if "health" in skill_id:
            score = data.get("health_score", data.get("score", 100))
            if isinstance(score, (int, float)):
                if score >= 90:
                    data["status"] = "excellent"
                    if not data.get("note"):
                        data["note"] = "Network health is excellent. All systems operating optimally."
                elif score >= 70:
                    data["status"] = "good"
                elif score >= 50:
                    data["status"] = "fair"
                else:
                    data["status"] = "needs_attention"

        # Issue-related skills - positive framing when no issues
        if "issues" in skill_id:
            issues = data.get("issues", [])
            if isinstance(issues, list) and len(issues) == 0:
                data["status"] = "healthy"
                data["note"] = self.frame_positive_absence(
                    domain="network",
                    result_type="issues",
                    custom_message="No active issues detected - network is operating normally."
                )

        # Compliance skills
        if "compliance" in skill_id:
            compliance = data.get("compliance", [])
            if isinstance(compliance, list):
                non_compliant = [c for c in compliance if c.get("status") != "COMPLIANT"]
                if len(non_compliant) == 0 and len(compliance) > 0:
                    data["status"] = "excellent"
                    data["note"] = self.frame_positive_absence(
                        domain="security",
                        result_type="issues",
                        custom_message=f"All {len(compliance)} devices are fully compliant."
                    )

        return data

    def _generate_follow_up(self, skill_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Generate contextual follow-up suggestions."""
        # Device-related follow-ups
        if skill_id.startswith("devices_"):
            if data.get("devices"):
                return "Would you like to check device health or see interface details?"

        # Health-related follow-ups
        if "health" in skill_id:
            status = data.get("status", "")
            if status == "excellent":
                return "Network is healthy. Would you like to view topology or run compliance check?"
            elif status in ("fair", "needs_attention"):
                return "Would you like to investigate the issues affecting health?"

        # Issue follow-ups
        if "issues" in skill_id:
            issues = data.get("issues", [])
            if isinstance(issues, list) and len(issues) > 0:
                return "Would you like to see details on any specific issue?"
            elif isinstance(issues, list) and len(issues) == 0:
                return "Network is healthy. Would you like to view device inventory or network topology?"

        # Template follow-ups
        if "templates_" in skill_id:
            if "deploy" in skill_id:
                return "Would you like to check deployment status?"
            return "Would you like to deploy a template or create a new one?"

        # SDA follow-ups
        if "sda_" in skill_id:
            return "Would you like to see other fabric components or virtual networks?"

        return None

    def _extract_entities(self, skill_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract entities from results for context sharing."""
        entities = {}

        # Extract device-related entities
        devices = data.get("devices", [])
        if isinstance(devices, list) and devices:
            entities["device_ids"] = [d.get("id") for d in devices[:20] if d.get("id")]
            entities["device_names"] = [d.get("hostname") or d.get("name") for d in devices[:20]]

        # Extract site entities
        sites = data.get("sites", [])
        if isinstance(sites, list) and sites:
            entities["site_ids"] = [s.get("id") for s in sites[:20] if s.get("id")]
            entities["site_names"] = [s.get("name") for s in sites[:20]]

        # Extract issue entities
        issues = data.get("issues", [])
        if isinstance(issues, list) and issues:
            entities["issue_ids"] = [i.get("issueId") or i.get("id") for i in issues[:20]]

        # Extract template entities
        templates = data.get("templates", [])
        if isinstance(templates, list) and templates:
            entities["template_ids"] = [t.get("templateId") or t.get("id") for t in templates[:20]]

        return entities

    def _create_result_artifact(
        self,
        skill_id: str,
        data: Dict[str, Any],
        context: AgentExecutionContext
    ) -> None:
        """Create artifact for significant results."""
        # Determine artifact type based on skill
        if "health" in skill_id or "compliance" in skill_id or "issues" in skill_id:
            artifact_type = ArtifactType.ANALYSIS_RESULT
        elif "topology" in skill_id:
            artifact_type = ArtifactType.ENVIRONMENT_DATA
        else:
            artifact_type = ArtifactType.ENVIRONMENT_DATA

        self.create_artifact(
            artifact_type=artifact_type,
            data=data,
            session_id=context.session_id,
        )

    async def _execute_legacy_skill(
        self,
        skill_id: str,
        params: Dict[str, Any],
        context: AgentExecutionContext
    ) -> SkillResult:
        """Fallback for any legacy skills not yet in modules."""
        logger.warning(f"[CatalystAgent] Legacy skill requested: {skill_id}")
        return SkillResult(
            success=False,
            error=f"Unknown skill: {skill_id}. Please check available skills."
        )

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate human-readable summary for Catalyst results."""
        data = result.data

        if not isinstance(data, dict):
            return super()._generate_text_summary(skill_id, result)

        # Helper to append note if present
        def with_note(base_text: str, data_dict: dict) -> str:
            note = data_dict.get("note")
            if note:
                return f"{base_text} {note}"
            return base_text

        # Sites
        if skill_id.startswith("sites_"):
            sites = data.get("sites", [])
            if isinstance(sites, list):
                return with_note(f"Found {len(sites)} site(s).", data)

        # Devices
        if skill_id.startswith("devices_"):
            devices = data.get("devices", [])
            if isinstance(devices, list):
                return with_note(f"Found {len(devices)} device(s).", data)
            count = data.get("count", 0)
            return with_note(f"Found {count} device(s).", data)

        # Health
        if "health" in skill_id:
            score = data.get("health_score", data.get("score"))
            status = data.get("status", "")
            if score is not None:
                status_str = f" [{status.upper()}]" if status else ""
                return with_note(f"Health: {score}%{status_str}.", data)

        # Issues
        if "issues" in skill_id:
            issues = data.get("issues", [])
            if isinstance(issues, list):
                if len(issues) == 0:
                    return data.get("note", "No issues found - network is healthy.")
                return f"Found {len(issues)} issue(s)."

        # Templates
        if skill_id.startswith("templates_"):
            templates = data.get("templates", [])
            projects = data.get("projects", [])
            if isinstance(templates, list):
                return f"Found {len(templates)} template(s)."
            if isinstance(projects, list):
                return f"Found {len(projects)} project(s)."
            message = data.get("message")
            if message:
                return message

        # Compliance
        if skill_id.startswith("compliance_"):
            compliance = data.get("compliance", [])
            if isinstance(compliance, list):
                return with_note(f"Found {len(compliance)} compliance record(s).", data)

        # SDA
        if skill_id.startswith("sda_"):
            message = data.get("message")
            if message:
                return message

        # Path Trace
        if skill_id.startswith("pathtrace_"):
            path_traces = data.get("path_traces", [])
            if isinstance(path_traces, list):
                return f"Found {len(path_traces)} path trace(s)."
            message = data.get("message")
            if message:
                return message

        # Wireless
        if skill_id.startswith("wireless_"):
            ssids = data.get("ssids", [])
            profiles = data.get("profiles", [])
            if isinstance(ssids, list):
                return f"Found {len(ssids)} SSID(s)."
            if isinstance(profiles, list):
                return f"Found {len(profiles)} profile(s)."
            message = data.get("message")
            if message:
                return message

        # Generic message handling
        message = data.get("message")
        if message:
            return with_note(message, data)

        return super()._generate_text_summary(skill_id, result)
