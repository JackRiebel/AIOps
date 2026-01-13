"""Workflow AI Service - AI-powered workflow analysis and recommendations.

This service:
- Analyzes trigger events using AI
- Determines if action is truly needed (reduces false positives)
- Recommends specific remediation steps
- Provides confidence scores and risk assessments

Supports multiple AI providers: Anthropic, OpenAI, Google, and Cisco Circuit.
Uses whatever provider is configured in the system settings.
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

from src.config.settings import get_settings
from src.models.workflow import Workflow
from src.services.cost_logger import get_cost_logger
from src.services.prompt_service import get_prompt_template

logger = logging.getLogger(__name__)


# ============================================================================
# System Prompt Template
# ============================================================================

# ============================================================================
# Preset Configurations for Workflow Generation
# ============================================================================

TRIGGER_PRESETS = {
    "device_offline": {
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=meraki:events type="device_offline"',
        "description": "Triggers when any network device goes offline"
    },
    "high_latency": {
        "trigger_type": "splunk_query",
        "splunk_query": "index=meraki sourcetype=meraki:performance latency_ms>{threshold}",
        "description": "Triggers when network latency exceeds a threshold",
        "default_threshold": 100
    },
    "security_event": {
        "trigger_type": "splunk_query",
        "splunk_query": "index=meraki sourcetype=meraki:security",
        "description": "Triggers on security events like firewall blocks or IDS alerts"
    },
    "client_vpn_failure": {
        "trigger_type": "splunk_query",
        "splunk_query": 'index=meraki sourcetype=meraki:events type="vpn" status="failed"',
        "description": "Triggers when VPN connections fail"
    },
    "schedule_daily": {
        "trigger_type": "schedule",
        "schedule_cron": "0 6 * * *",
        "description": "Runs daily at 6 AM"
    },
    "schedule_weekly": {
        "trigger_type": "schedule",
        "schedule_cron": "0 0 * * 0",
        "description": "Runs weekly on Sunday at midnight"
    },
    "manual": {
        "trigger_type": "manual",
        "description": "Manually triggered by user"
    }
}

ACTION_PRESETS = {
    "slack_notify": {
        "tool": "slack_notify",
        "requires_approval": False,
        "description": "Send a notification to Slack"
    },
    "email_alert": {
        "tool": "email_notify",
        "requires_approval": False,
        "description": "Send an email alert"
    },
    "teams_notify": {
        "tool": "teams_notify",
        "requires_approval": False,
        "description": "Send a Microsoft Teams message"
    },
    "reboot_device": {
        "tool": "meraki_reboot_device",
        "requires_approval": True,
        "description": "Reboot the affected network device"
    },
    "collect_diagnostics": {
        "tool": "meraki_get_device_diagnostics",
        "requires_approval": False,
        "description": "Collect diagnostic information from the device"
    },
    "create_incident": {
        "tool": "create_incident",
        "requires_approval": False,
        "description": "Create an incident ticket"
    },
    "disable_port": {
        "tool": "meraki_disable_switch_port",
        "requires_approval": True,
        "description": "Disable a switch port"
    },
    "block_client": {
        "tool": "meraki_block_client",
        "requires_approval": True,
        "description": "Block a network client"
    }
}

# Prompts now loaded from src/config/prompts.yaml via prompt_service
# See: workflow_generation, workflow_analysis


class WorkflowAIService:
    """AI-powered workflow analysis and recommendations.

    Supports multiple AI providers based on system configuration.
    """

    def __init__(self):
        self.max_tokens = 2000
        self.temperature = 0.3  # Lower temp for more consistent analysis

    async def analyze_trigger(
        self,
        workflow: Workflow,
        trigger_events: List[Dict[str, Any]],
        model: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Analyze trigger events and recommend action.

        Args:
            workflow: The workflow configuration
            trigger_events: Events that triggered the workflow
            model: Optional model override (user's preferred model)

        Returns:
            Analysis result with recommendations, or None on error
        """
        try:
            from src.services.multi_provider_ai import generate_text

            # Build the system prompt
            system_prompt = self._build_system_prompt(workflow)

            # Build the user message with events
            user_message = self._build_user_message(trigger_events)

            # Use multi-provider AI
            result = await generate_text(
                prompt=user_message,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                system_prompt=system_prompt,
            )

            if not result:
                logger.warning("No AI provider configured for workflow analysis")
                return None

            # Parse response
            response_text = result["text"]
            analysis = self._parse_response(response_text)

            # Add token usage
            analysis["input_tokens"] = result["input_tokens"]
            analysis["output_tokens"] = result["output_tokens"]
            analysis["cost_usd"] = result["cost_usd"]
            analysis["model_used"] = result["model"]

            # Log cost to database for telemetry
            try:
                cost_logger = get_cost_logger()
                await cost_logger.log_background_job(
                    job_name="workflow_analysis",
                    model=result["model"],
                    input_tokens=result["input_tokens"],
                    output_tokens=result["output_tokens"],
                    job_metadata={"workflow_id": workflow.id, "workflow_name": workflow.name},
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log workflow analysis cost: {cost_error}")

            logger.info(
                f"Workflow {workflow.id} analysis: should_act={analysis.get('should_act')}, "
                f"confidence={analysis.get('confidence')}, risk={analysis.get('risk_level')}"
            )

            return analysis

        except Exception as e:
            logger.error(f"AI analysis failed for workflow {workflow.id}: {e}", exc_info=True)
            return None

    def _build_system_prompt(self, workflow: Workflow) -> str:
        """Build the system prompt with workflow context."""
        # Format available actions
        actions_text = "None specified"
        if workflow.actions:
            actions_list = []
            for action in workflow.actions:
                tool = action.get("tool", "unknown")
                requires_approval = "requires approval" if action.get("requires_approval") else "auto-execute"
                actions_list.append(f"- {tool} ({requires_approval})")
            actions_text = "\n".join(actions_list)

        # Load prompt from centralized registry
        return get_prompt_template("workflow_analysis").format(
            workflow_name=workflow.name,
            workflow_description=workflow.description or "No description provided",
            trigger_type=workflow.trigger_type.value if workflow.trigger_type else "unknown",
            ai_prompt=workflow.ai_prompt or "No custom instructions provided.",
            available_actions=actions_text,
        )

    def _build_user_message(self, trigger_events: List[Dict[str, Any]]) -> str:
        """Build the user message with trigger events."""
        # Limit events to prevent token overflow
        events_to_analyze = trigger_events[:20]

        message_parts = [
            f"**Trigger Events ({len(trigger_events)} total, showing first {len(events_to_analyze)}):**\n"
        ]

        for i, event in enumerate(events_to_analyze, 1):
            # Format event as readable JSON
            event_str = json.dumps(event, indent=2, default=str)
            message_parts.append(f"Event {i}:\n```json\n{event_str}\n```\n")

        message_parts.append(
            "\nAnalyze these events and provide your recommendation in JSON format."
        )

        return "\n".join(message_parts)

    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the AI response into structured format."""
        try:
            # Try to extract JSON from response
            # Handle cases where response might have markdown code blocks
            text = response_text.strip()

            # Remove markdown code blocks if present
            if text.startswith("```"):
                lines = text.split("\n")
                # Remove first and last lines (```json and ```)
                lines = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
                text = "\n".join(lines)

            result = json.loads(text)

            # Ensure required fields
            return {
                "should_act": result.get("should_act", False),
                "confidence": float(result.get("confidence", 0.5)),
                "reasoning": result.get("reasoning", "No reasoning provided"),
                "risk_level": result.get("risk_level", "medium"),
                "estimated_impact": result.get("estimated_impact", "Unknown"),
                "recommended_actions": result.get("recommended_actions", []),
                "investigation_notes": result.get("investigation_notes", ""),
            }

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
            # Return a conservative default
            return {
                "should_act": False,
                "confidence": 0.0,
                "reasoning": f"Failed to parse AI response: {response_text[:200]}",
                "risk_level": "high",
                "estimated_impact": "Unknown - analysis failed",
                "recommended_actions": [],
                "investigation_notes": "Manual review recommended",
            }


    def _build_generation_prompt(self) -> str:
        """Build the system prompt for workflow generation with available triggers/actions."""
        triggers_text = "\n".join(
            f"- {key}: {val['description']}"
            for key, val in TRIGGER_PRESETS.items()
        )
        actions_text = "\n".join(
            f"- {key}: {val['description']} (requires_approval={val['requires_approval']})"
            for key, val in ACTION_PRESETS.items()
        )
        # Load prompt from centralized registry
        return get_prompt_template("workflow_generation").format(triggers=triggers_text, actions=actions_text)

    async def generate_workflow_from_description(
        self,
        description: str,
        organization: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a workflow configuration from a natural language description.

        Args:
            description: Natural language description of the desired workflow
            organization: Optional organization context

        Returns:
            Dictionary containing:
                - workflow: CreateWorkflowRequest-compatible dict
                - confidence: AI confidence in the interpretation (0-1)
                - explanation: Brief explanation of how the request was interpreted
        """
        if not description or len(description.strip()) < 10:
            raise ValueError("Description is too short. Please provide more detail.")

        try:
            from src.services.multi_provider_ai import generate_text

            system_prompt = self._build_generation_prompt()

            # Use multi-provider AI
            result = await generate_text(
                prompt=f"Create a workflow for: {description}",
                max_tokens=2000,
                temperature=0.3,  # Lower temperature for consistent outputs
                system_prompt=system_prompt,
            )

            if not result:
                raise ValueError("No AI provider configured - please configure an AI provider in Admin > System Config")

            response_text = result["text"]

            # Parse JSON from response (handle markdown code blocks)
            text = response_text.strip()
            if "```json" in text:
                json_start = text.find("```json") + 7
                json_end = text.find("```", json_start)
                text = text[json_start:json_end].strip()
            elif "```" in text:
                json_start = text.find("```") + 3
                json_end = text.find("```", json_start)
                text = text[json_start:json_end].strip()

            try:
                parsed_result = json.loads(text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response: {text[:500]}")
                raise ValueError(f"Failed to parse AI response: {e}")

            # Extract metadata
            confidence = parsed_result.pop("confidence", 0.7)
            explanation = parsed_result.pop("explanation", "Workflow generated from your description")

            # Normalize the workflow
            workflow = self._normalize_generated_workflow(parsed_result, organization)

            # Log cost to database for telemetry
            try:
                cost_logger = get_cost_logger()
                await cost_logger.log_background_job(
                    job_name="workflow_generation",
                    model=result["model"],
                    input_tokens=result["input_tokens"],
                    output_tokens=result["output_tokens"],
                    job_metadata={"workflow_name": workflow["name"]},
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log workflow generation cost: {cost_error}")

            logger.info(
                f"Generated workflow '{workflow['name']}' with confidence {confidence}"
            )

            return {
                "workflow": workflow,
                "confidence": confidence,
                "explanation": explanation,
            }

        except Exception as e:
            logger.error(f"Error generating workflow: {e}", exc_info=True)
            raise

    def _normalize_generated_workflow(
        self,
        raw: Dict[str, Any],
        organization: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Normalize and validate the generated workflow."""
        workflow = {
            "name": raw.get("name", "AI Generated Workflow"),
            "description": raw.get("description"),
            "trigger_type": raw.get("trigger_type", "manual"),
            "ai_enabled": raw.get("ai_enabled", True),
            "ai_confidence_threshold": raw.get("ai_confidence_threshold", 0.7),
            "poll_interval_seconds": raw.get("poll_interval_seconds", 300),
        }

        # Add trigger-specific fields
        if workflow["trigger_type"] == "splunk_query":
            workflow["splunk_query"] = raw.get("splunk_query", "")
        elif workflow["trigger_type"] == "schedule":
            workflow["schedule_cron"] = raw.get("schedule_cron", "0 6 * * *")

        # Normalize actions
        actions = raw.get("actions", [])
        normalized_actions = []
        for action in actions:
            if isinstance(action, str):
                preset = ACTION_PRESETS.get(action)
                if preset:
                    normalized_actions.append({
                        "tool": preset["tool"],
                        "params": {},
                        "requires_approval": preset["requires_approval"],
                    })
            elif isinstance(action, dict):
                normalized_actions.append({
                    "tool": action.get("tool", ""),
                    "params": action.get("params", {}),
                    "requires_approval": action.get("requires_approval", False),
                })

        workflow["actions"] = normalized_actions

        if organization:
            workflow["organization"] = organization

        return workflow

    async def generate_workflow_suggestions(
        self,
        description: str,
    ) -> Optional[Dict[str, Any]]:
        """Generate workflow configuration suggestions from a description.

        DEPRECATED: Use generate_workflow_from_description instead.

        Args:
            description: Natural language description of desired workflow

        Returns:
            Suggested workflow configuration
        """
        try:
            result = await self.generate_workflow_from_description(description)
            return result.get("workflow")
        except Exception as e:
            logger.error(f"Failed to generate workflow suggestions: {e}")
            return None

    async def explain_trigger(
        self,
        workflow: Workflow,
        trigger_events: List[Dict[str, Any]],
    ) -> str:
        """Generate a human-readable explanation of trigger events.

        Args:
            workflow: The workflow
            trigger_events: Events that triggered

        Returns:
            Human-readable explanation
        """
        try:
            system_prompt = """You are a network operations assistant.
Provide a brief, clear explanation of these trigger events for a network operator.
Focus on:
- What happened
- Severity/urgency
- Potential impact
Keep it concise (2-3 sentences)."""

            events_summary = json.dumps(trigger_events[:5], indent=2, default=str)

            response = await self.client.messages.create(
                model=self.model,
                max_tokens=300,
                temperature=0.3,
                system=system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Workflow: {workflow.name}\n\nEvents:\n{events_summary}"
                }],
            )

            # Log cost to database for telemetry
            try:
                cost_logger = get_cost_logger()
                await cost_logger.log_background_job(
                    job_name="workflow_explain_trigger",
                    model=self.model,
                    input_tokens=response.usage.input_tokens,
                    output_tokens=response.usage.output_tokens,
                    job_metadata={"workflow_id": workflow.id, "workflow_name": workflow.name},
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log workflow explain trigger cost: {cost_error}")

            return response.content[0].text.strip()

        except Exception as e:
            logger.error(f"Failed to explain trigger: {e}")
            return f"Workflow '{workflow.name}' was triggered by {len(trigger_events)} events."


# ============================================================================
# Global Service Instance
# ============================================================================

_service: Optional[WorkflowAIService] = None


def get_workflow_ai_service() -> WorkflowAIService:
    """Get the global workflow AI service instance."""
    global _service
    if _service is None:
        _service = WorkflowAIService()
    return _service
