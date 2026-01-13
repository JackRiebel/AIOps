"""ThousandEyes Monitoring Specialist Agent.

This agent provides 180+ skills for interacting with the ThousandEyes API v7,
covering all API domains including tests, results, agents, alerts, dashboards,
administration, and more.

Organized into modular skill sets matching the official ThousandEyes REST API structure.
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

# Import all skill modules
from .thousandeyes import (
    ALL_MODULES,
    ThousandEyesAPIClient,
    ThousandEyesSkillModule,
    NetworkTestsModule,
    WebTestsModule,
    DNSTestsModule,
    VoiceTestsModule,
    OtherTestsModule,
    TestResultsModule,
    InstantTestsModule,
    AgentsModule,
    EndpointAgentsModule,
    AlertsModule,
    DashboardsModule,
    AdminModule,
    CredentialsModule,
    BGPMonitorsModule,
    LabelsModule,
    EmulationModule,
)

logger = logging.getLogger(__name__)


class ThousandEyesAgent(BaseSpecialistAgent, SmartResponseMixin):
    """Specialist agent for ThousandEyes API operations.

    Provides 180+ skills across all ThousandEyes API domains:
    - Tests: All 12 test types with full CRUD (agent-to-server, http-server, page-load, etc.)
    - Results: Test results for all test types
    - Instant Tests: On-demand test execution
    - Agents: Cloud and Enterprise agent management
    - Endpoint Agents: Endpoint monitoring
    - Alerts: Active alerts, rules, suppression windows
    - Dashboards: Dashboard management, widgets, snapshots
    - Administration: Users, roles, account groups, audit
    - Credentials: Credential management
    - BGP Monitors: BGP monitor operations
    - Labels: Test and agent labeling
    - Emulation: User agent and device emulation

    Smart Features:
    - Positive framing for no alerts ("no alerts = healthy monitoring")
    - Smart health score interpretation
    - Contextual suggestions when agents offline
    """

    AGENT_ID = "thousandeyes-agent"
    AGENT_NAME = "ThousandEyes Monitoring Specialist"
    AGENT_ROLE = "thousandeyes-specialist"
    AGENT_DESCRIPTION = (
        "Specialist for Cisco ThousandEyes monitoring operations providing 180+ skills "
        "across all API domains including tests (12 types), results, alerts, dashboards, "
        "agents, administration, and more. "
        "Smart features: positive framing when no alerts (healthy status), "
        "intelligent health scoring, and contextual suggestions for troubleshooting."
    )

    # Module registry for skill routing
    _modules: List[ThousandEyesSkillModule] = ALL_MODULES

    def get_skills(self) -> List[AgentSkill]:
        """Get all ThousandEyes skills from all modules."""
        all_skills = []
        for module in self._modules:
            all_skills.extend(module.get_skills())

        logger.info(f"[ThousandEyesAgent] Loaded {len(all_skills)} skills from {len(self._modules)} modules")
        return all_skills

    def _find_module_for_skill(self, skill_id: str) -> Optional[ThousandEyesSkillModule]:
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
        """Execute a ThousandEyes skill."""
        logger.info(f"[ThousandEyesAgent] Executing skill: {skill_id}")

        # Check for API key
        if not context.api_key:
            return SkillResult(
                success=False,
                error="No API key available for ThousandEyes"
            )

        try:
            # Create the API client
            api_client = ThousandEyesAPIClient(
                api_token=context.api_key,
                account_group_id=context.entities_from_previous_turns.get("account_group_id"),
            )

            # Find the appropriate module
            module = self._find_module_for_skill(skill_id)

            if module is None:
                return SkillResult(
                    success=False,
                    error=f"Unknown skill: {skill_id}. Please check available skills."
                )

            # Execute via module
            result = await module.execute(skill_id, api_client, params, context)

            # Convert module result to agent SkillResult with smart enhancements
            return self._convert_module_result(skill_id, result, context)

        except Exception as e:
            logger.error(f"[ThousandEyesAgent] Skill execution error: {e}", exc_info=True)
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
        # Alert-related skills - positive framing when no alerts
        if "alerts" in skill_id:
            alerts = data.get("alerts", [])
            if isinstance(alerts, list) and len(alerts) == 0:
                data["status"] = "healthy"
                data["note"] = self.frame_positive_absence(
                    domain="monitoring",
                    result_type="alerts",
                    custom_message="No active alerts - all monitored services are healthy."
                )

        # Agent-related skills - smart status interpretation
        if "agents" in skill_id and not "endpoint" in skill_id:
            agents = data.get("agents", [])
            if isinstance(agents, list):
                online = sum(1 for a in agents if a.get("enabled") == 1 or a.get("status") == "online")
                total = len(agents)
                if total > 0 and online == total:
                    data["status"] = "healthy"
                    data["note"] = "All monitoring agents are online and operational."
                elif total > 0 and online / total >= 0.9:
                    data["status"] = "good"
                elif total > 0:
                    offline_count = total - online
                    data["status"] = "attention_needed"
                    data["note"] = f"{offline_count} agent(s) offline - may affect test coverage."

        # Test results - add interpretation
        if skill_id.startswith("results_"):
            results = data.get("results", [])
            if isinstance(results, list) and results:
                # Calculate averages for network tests
                latencies = [r.get("avgLatency") or r.get("latency") for r in results if r.get("avgLatency") or r.get("latency")]
                if latencies:
                    avg_latency = sum(latencies) / len(latencies)
                    data["metrics"] = data.get("metrics", {})
                    data["metrics"]["avg_latency_ms"] = round(avg_latency, 2)
                    if avg_latency < 50:
                        data["status"] = "excellent"
                    elif avg_latency < 100:
                        data["status"] = "good"
                    elif avg_latency < 200:
                        data["status"] = "fair"
                    else:
                        data["status"] = "attention_needed"

        return data

    def _generate_follow_up(self, skill_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Generate contextual follow-up suggestions."""
        # Test-related follow-ups
        if skill_id.startswith("tests_get_") and "_list" in skill_id:
            tests = data.get("tests", [])
            if isinstance(tests, list) and tests:
                return "Would you like to see results for any of these tests or run an instant test?"
            return "No tests found. Would you like to create a new test?"

        # Results follow-ups
        if skill_id.startswith("results_"):
            status = data.get("status", "")
            if status == "attention_needed":
                return "Performance may need attention. Would you like to see detailed path visualization?"
            return "Would you like to compare results over a different time window?"

        # Alert follow-ups
        if "alerts" in skill_id:
            alerts = data.get("alerts", [])
            if isinstance(alerts, list) and len(alerts) > 0:
                return "Would you like details on any specific alert or create a suppression window?"
            return "Network is healthy. Would you like to review alert rules or check test results?"

        # Agent follow-ups
        if "agents" in skill_id:
            status = data.get("status", "")
            if status == "attention_needed":
                return "Would you like to see which tests are affected by offline agents?"
            return "Would you like to see test assignments or agent details?"

        # Dashboard follow-ups
        if "dashboards" in skill_id:
            return "Would you like to view widget data or create a snapshot?"

        # Admin follow-ups
        if "admin_" in skill_id:
            return "Would you like to view users, roles, or activity logs?"

        return None

    def _extract_entities(self, skill_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract entities from results for context sharing."""
        entities = {}

        # Extract test entities
        tests = data.get("tests", [])
        if isinstance(tests, list) and tests:
            entities["test_ids"] = [t.get("testId") for t in tests[:20] if t.get("testId")]
            entities["test_names"] = [t.get("testName") for t in tests[:20] if t.get("testName")]

        # Extract agent entities
        agents = data.get("agents", data.get("endpoint_agents", []))
        if isinstance(agents, list) and agents:
            entities["agent_ids"] = [a.get("agentId") for a in agents[:20] if a.get("agentId")]
            entities["agent_names"] = [a.get("agentName") for a in agents[:20] if a.get("agentName")]

        # Extract alert entities
        alerts = data.get("alerts", [])
        if isinstance(alerts, list) and alerts:
            entities["alert_ids"] = [a.get("alertId") for a in alerts[:20] if a.get("alertId")]

        # Extract dashboard entities
        dashboards = data.get("dashboards", [])
        if isinstance(dashboards, list) and dashboards:
            entities["dashboard_ids"] = [d.get("dashboardId") for d in dashboards[:20] if d.get("dashboardId")]

        # Extract user entities
        users = data.get("users", [])
        if isinstance(users, list) and users:
            entities["user_ids"] = [u.get("uid") for u in users[:20] if u.get("uid")]

        return entities

    def _create_result_artifact(
        self,
        skill_id: str,
        data: Dict[str, Any],
        context: AgentExecutionContext
    ) -> None:
        """Create artifact for significant results."""
        # Determine artifact type based on skill
        if "alerts" in skill_id or "results" in skill_id or "health" in skill_id:
            artifact_type = ArtifactType.ANALYSIS_RESULT
        else:
            artifact_type = ArtifactType.ENVIRONMENT_DATA

        self.create_artifact(
            artifact_type=artifact_type,
            data=data,
            session_id=context.session_id,
        )

    def _generate_text_summary(self, skill_id: str, result: SkillResult) -> str:
        """Generate human-readable summary for ThousandEyes results."""
        data = result.data

        if not isinstance(data, dict):
            return super()._generate_text_summary(skill_id, result)

        # Helper to append note if present
        def with_note(base_text: str, data_dict: dict) -> str:
            note = data_dict.get("note")
            if note:
                return f"{base_text} {note}"
            return base_text

        # Tests
        if skill_id.startswith("tests_") and ("_list" in skill_id or skill_id.endswith("_list")):
            tests = data.get("tests", [])
            count = data.get("count", len(tests) if isinstance(tests, list) else 0)
            return with_note(f"Found {count} test(s).", data)

        # Single test
        if skill_id.startswith("tests_get_") and "_list" not in skill_id:
            test = data.get("test", {})
            if test:
                return f"Test: {test.get('testName', 'Unknown')} ({test.get('type', 'unknown')} type)"
            return "Test details retrieved."

        # Results
        if skill_id.startswith("results_"):
            results = data.get("results", [])
            count = data.get("count", len(results) if isinstance(results, list) else 0)
            metrics = data.get("metrics", {})
            status = data.get("status", "")
            base = f"Retrieved {count} result(s)."
            if metrics.get("avg_latency_ms"):
                base += f" Avg latency: {metrics['avg_latency_ms']}ms."
            if status:
                base += f" Status: {status}."
            return with_note(base, data)

        # Instant tests
        if skill_id.startswith("instant_"):
            return data.get("message", "Instant test initiated.")

        # Agents
        if skill_id.startswith("agents_") and "agents" in data:
            agents = data.get("agents", [])
            count = data.get("count", len(agents) if isinstance(agents, list) else 0)
            return with_note(f"Found {count} agent(s).", data)

        # Endpoint agents
        if skill_id.startswith("endpoint_"):
            if "endpoint_agents" in data:
                count = data.get("count", 0)
                return with_note(f"Found {count} endpoint agent(s).", data)
            if "results" in data:
                count = data.get("count", 0)
                return f"Retrieved {count} endpoint result(s)."

        # Alerts
        if skill_id.startswith("alerts_"):
            if "alerts" in data:
                alerts = data.get("alerts", [])
                count = data.get("count", len(alerts) if isinstance(alerts, list) else 0)
                if count == 0:
                    return data.get("note", "No active alerts - monitoring is healthy.")
                return f"Found {count} alert(s)."
            if "alert_rules" in data:
                count = data.get("count", 0)
                return f"Found {count} alert rule(s)."
            if "suppression_windows" in data:
                count = data.get("count", 0)
                return f"Found {count} suppression window(s)."

        # Dashboards
        if skill_id.startswith("dashboards_"):
            if "dashboards" in data:
                count = data.get("count", 0)
                return f"Found {count} dashboard(s)."
            if "snapshots" in data:
                count = data.get("count", 0)
                return f"Found {count} snapshot(s)."
            message = data.get("message")
            if message:
                return message

        # Admin
        if skill_id.startswith("admin_"):
            if "users" in data:
                count = data.get("count", 0)
                return f"Found {count} user(s)."
            if "roles" in data:
                count = data.get("count", 0)
                return f"Found {count} role(s)."
            if "account_groups" in data:
                count = data.get("count", 0)
                return f"Found {count} account group(s)."
            if "audit_events" in data:
                count = data.get("count", 0)
                return f"Found {count} audit event(s)."
            if "user" in data:
                user = data.get("user", {})
                return f"User: {user.get('name', user.get('email', 'Unknown'))}"

        # Credentials
        if skill_id.startswith("credentials_"):
            if "credentials" in data:
                count = data.get("count", 0)
                return f"Found {count} credential(s)."
            message = data.get("message")
            if message:
                return message

        # BGP
        if skill_id.startswith("bgp_"):
            if "bgp_monitors" in data:
                count = data.get("count", 0)
                return f"Found {count} BGP monitor(s)."
            if "prefixes" in data:
                count = data.get("count", 0)
                return f"Found {count} prefix(es)."

        # Labels
        if skill_id.startswith("labels_"):
            if "labels" in data:
                count = data.get("count", 0)
                return f"Found {count} label(s)."
            message = data.get("message")
            if message:
                return message

        # Emulation
        if skill_id.startswith("emulation_"):
            if "user_agents" in data:
                count = data.get("count", 0)
                return f"Found {count} user agent(s)."
            if "emulated_devices" in data:
                count = data.get("count", 0)
                return f"Found {count} emulated device(s)."

        # Generic message handling
        message = data.get("message")
        if message:
            return with_note(message, data)

        return super()._generate_text_summary(skill_id, result)
