"""Splunk log insight generation service.

This service fetches Splunk logs, uses AI to categorize them into
summary insight cards, and stores them in the database.

Supports multiple AI providers: Anthropic, OpenAI, Google, and Cisco Circuit.
Uses whatever provider the user has configured in their AI settings.

NO cross-platform enrichment happens here - that's the Incidents page's job.
"""

import logging
import re
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
from sqlalchemy import select, delete

from src.models.splunk_insight import SplunkLogInsight
from src.config.database import Database, get_settings
from src.services.credential_manager import CredentialManager
from src.services.cost_logger import get_cost_logger
from src.services.ai_service import get_provider_from_model, get_model_costs

logger = logging.getLogger(__name__)


class SplunkInsightService:
    """Generate and manage Splunk log insight cards.

    Supports multiple AI providers based on user configuration.
    """

    # Default search - simple query, AI will filter out irrelevant events
    DEFAULT_MERAKI_SEARCH = 'search index=* | head 100'

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str = None,
        client_id: str = None,
        client_secret: str = None,
        app_key: str = None,
    ):
        """Initialize with multi-provider support.

        Args:
            provider: AI provider (anthropic, openai, google, cisco)
            model: Model ID to use
            api_key: API key for Anthropic/OpenAI/Google
            client_id: OAuth client ID for Cisco Circuit
            client_secret: OAuth client secret for Cisco Circuit
            app_key: App key for Cisco Circuit
        """
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.client_id = client_id
        self.client_secret = client_secret
        self.app_key = app_key

        # Initialize provider-specific client
        self._client = None
        if provider == "anthropic" and api_key:
            from anthropic import Anthropic
            self._client = Anthropic(api_key=api_key)
        elif provider == "openai" and api_key:
            import openai
            self._client = openai.OpenAI(api_key=api_key)
        elif provider == "google" and api_key:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self._client = genai
        elif provider == "cisco" and client_id and client_secret:
            # Cisco Circuit uses OAuth - we'll get tokens on demand
            self._client = None  # Token will be fetched in _categorize_logs_with_ai

        settings = get_settings()
        self.db = Database(settings.database_url)
        self.credential_manager = CredentialManager()

    async def generate_insights(
        self,
        organization: str,
        search_query: str = None,
        time_range: str = "-24h",
        max_logs: int = 100,
    ) -> List[int]:
        """Generate insight cards from Splunk logs.

        Args:
            organization: Splunk organization name
            search_query: SPL search query
            time_range: Time range (e.g., "-24h", "-7d")
            max_logs: Maximum logs to analyze

        Returns:
            List of created insight IDs
        """
        # Use default Meraki search if no query provided
        if not search_query:
            search_query = self.DEFAULT_MERAKI_SEARCH

        logger.info("=" * 60)
        logger.info("SPLUNK LOG INSIGHT GENERATION")
        logger.info(f"Organization: {organization}")
        logger.info(f"Query: {search_query}")
        logger.info(f"Time Range: {time_range}")
        logger.info("=" * 60)

        # Step 1: Fetch Splunk logs
        logger.info("Step 1: Fetching Splunk logs...")
        logs = await self._fetch_splunk_logs(organization, search_query, time_range, max_logs)
        logger.info(f"  -> Found {len(logs)} logs")

        if not logs:
            logger.info("No logs found - clearing old insights for this org/query")
            await self._clear_old_insights(organization, search_query, time_range)
            return []

        # Step 2: Use AI to categorize logs into insight cards
        logger.info("Step 2: AI categorizing logs into insight cards...")
        insights = await self._categorize_logs_with_ai(logs, organization, search_query, time_range)
        logger.info(f"  -> Generated {len(insights)} insight categories")

        if not insights:
            return []

        # Step 3: Save to database
        logger.info("Step 3: Saving insights to database...")
        insight_ids = await self._save_insights(insights, organization, search_query, time_range)
        logger.info(f"  -> Saved {len(insight_ids)} insights")

        logger.info("=" * 60)
        return insight_ids

    async def get_insights(
        self,
        organization: Optional[str] = None,
        search_query: Optional[str] = None,
        time_range: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get stored insights from database.

        Args:
            organization: Optional organization filter
            search_query: Optional query filter
            time_range: Optional time range filter
            limit: Maximum number of insights to return

        Returns:
            List of insight dictionaries
        """
        async with self.db.session() as session:
            query = select(SplunkLogInsight).order_by(SplunkLogInsight.created_at.desc()).limit(limit)

            if organization:
                query = query.where(SplunkLogInsight.organization == organization)
            if search_query:
                query = query.where(SplunkLogInsight.search_query == search_query)
            if time_range:
                query = query.where(SplunkLogInsight.time_range == time_range)

            result = await session.execute(query)
            insights = result.scalars().all()

            return [insight.to_dict() for insight in insights]

    async def delete_insights(
        self,
        organization: Optional[str] = None,
        search_query: Optional[str] = None,
        time_range: Optional[str] = None,
    ) -> int:
        """Delete insights from database.

        Args:
            organization: Optional organization filter
            search_query: Optional query filter
            time_range: Optional time range filter

        Returns:
            Number of insights deleted
        """
        async with self.db.session() as session:
            query = delete(SplunkLogInsight)

            if organization:
                query = query.where(SplunkLogInsight.organization == organization)
            if search_query:
                query = query.where(SplunkLogInsight.search_query == search_query)
            if time_range:
                query = query.where(SplunkLogInsight.time_range == time_range)

            result = await session.execute(query)
            return result.rowcount

    async def _fetch_splunk_logs(
        self,
        organization: str,
        search_query: str,
        time_range: str,
        max_logs: int,
    ) -> List[Dict[str, Any]]:
        """Fetch logs from Splunk."""
        logs = []

        # Try system_config first
        from src.services.config_service import ConfigService
        config_service = ConfigService()

        api_url = await config_service.get_config("splunk_api_url")
        bearer_token = await config_service.get_config("splunk_bearer_token")
        username = await config_service.get_config("splunk_username")
        password = await config_service.get_config("splunk_password")

        credentials = None
        if api_url and (bearer_token or (username and password)):
            credentials = {
                "base_url": api_url,
                "api_key": bearer_token,
                "username": username,
                "password": password,
                "verify_ssl": False,
            }
        else:
            # Fall back to clusters table
            credentials = await self.credential_manager.get_credentials(organization)

        if not credentials:
            logger.warning(f"No Splunk credentials found in system_config or clusters")
            return logs

        try:
            token = credentials.get("api_key")
            username = credentials.get("username")
            password = credentials.get("password")

            if not token and not (username and password):
                logger.warning("No Splunk credentials available")
                return logs

            # Build auth headers - prefer token, fall back to basic auth
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
            }

            if token:
                # Splunk uses "Splunk {token}" format for token auth
                headers["Authorization"] = f"Splunk {token}"
            elif username and password:
                # Use basic auth
                import base64
                auth_string = base64.b64encode(f"{username}:{password}".encode()).decode()
                headers["Authorization"] = f"Basic {auth_string}"

            async with httpx.AsyncClient(
                verify=credentials.get("verify_ssl", False),
                timeout=60.0
            ) as client:
                # Create search job - insert earliest time BEFORE any pipe commands
                # so "search index=* | head 100" becomes "search index=* earliest=-24h | head 100"
                if "|" in search_query:
                    # Insert earliest before the first pipe
                    parts = search_query.split("|", 1)
                    full_query = f"{parts[0].strip()} earliest={time_range} | {parts[1].strip()}"
                else:
                    full_query = f"{search_query} earliest={time_range}"
                logger.info(f"  Creating search job: {full_query[:100]}...")

                create_response = await client.post(
                    f"{credentials['base_url']}/services/search/jobs",
                    headers=headers,
                    data={"search": full_query, "output_mode": "json"},
                )

                if create_response.status_code not in [200, 201]:
                    logger.error(f"  Failed to create search job: {create_response.status_code}")
                    return logs

                job_data = create_response.json()
                job_id = job_data.get("sid")
                if not job_id:
                    return logs

                # Poll for completion
                for _ in range(30):
                    status_response = await client.get(
                        f"{credentials['base_url']}/services/search/jobs/{job_id}",
                        headers=headers,
                        params={"output_mode": "json"},
                    )
                    if status_response.status_code == 200:
                        status_data = status_response.json()
                        entry = status_data.get("entry", [{}])[0]
                        if entry.get("content", {}).get("isDone"):
                            break
                    await asyncio.sleep(1)

                # Fetch results
                results_response = await client.get(
                    f"{credentials['base_url']}/services/search/jobs/{job_id}/results",
                    headers=headers,
                    params={"output_mode": "json", "count": max_logs},
                )

                if results_response.status_code == 200:
                    results_data = results_response.json()
                    logs = results_data.get("results", [])

                # Clean up job
                await client.delete(
                    f"{credentials['base_url']}/services/search/jobs/{job_id}",
                    headers=headers,
                )

        except Exception as e:
            logger.error(f"Error fetching Splunk logs: {e}")

        return logs

    async def _categorize_logs_with_ai(
        self,
        logs: List[Dict[str, Any]],
        organization: str,
        search_query: str,
        time_range: str,
    ) -> List[Dict[str, Any]]:
        """Use AI to categorize logs into insight cards.

        Supports multiple providers: Anthropic, OpenAI, Google, and Cisco Circuit.
        """
        if not logs:
            return []

        # Prepare log summaries for AI
        log_samples = []
        for i, log in enumerate(logs[:50]):  # Limit to 50 for AI context
            raw = log.get("_raw", json.dumps(log))
            log_samples.append(f"[{i+1}] {raw[:500]}")

        prompt = f"""Analyze these {len(logs)} Splunk log entries and create 3-8 insight cards.
Each card should represent a distinct category or pattern found in the logs.

IMPORTANT FILTERING RULES:
- PRIORITIZE actual network/syslog events (VPN, DHCP, VLAN, wireless, firewall, client activity)
- INCLUDE Meraki device events that have deviceSerial, networkId, or clientMac
- EXCLUDE API metadata like "connection test", "health check", "API response statistics"
- EXCLUDE license inventory or configuration sync events (unless they indicate problems)
- If an event looks like internal monitoring/healthcheck from THIS dashboard, skip it

For each card, determine:
1. title: Short descriptive title (e.g., "VLAN Mismatch Violations", "VPN Connection Issues")
2. severity: critical, high, medium, low, or info
3. count: Estimated number of logs in this category
4. description: 1-2 sentence description of what this category represents and any action needed
5. examples: 2-3 example log messages from this category (exact text from logs)
6. source_system: The likely source system (meraki, thousandeyes, catalyst, splunk, or unknown)

LOG ENTRIES:
{chr(10).join(log_samples)}

Respond in JSON format:
{{
  "insights": [
    {{
      "title": "string",
      "severity": "critical|high|medium|low|info",
      "count": number,
      "description": "string",
      "examples": ["string", "string"],
      "source_system": "meraki|thousandeyes|catalyst|splunk|unknown"
    }}
  ]
}}
"""

        try:
            response_text = ""
            input_tokens = 0
            output_tokens = 0

            if self.provider == "anthropic":
                response = self._client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}],
                )
                response_text = response.content[0].text
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens

            elif self.provider == "openai":
                response = self._client.chat.completions.create(
                    model=self.model,
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}],
                )
                response_text = response.choices[0].message.content
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens

            elif self.provider == "google":
                model = self._client.GenerativeModel(self.model)
                response = model.generate_content(prompt)
                response_text = response.text
                # Google doesn't provide detailed token counts in the same way
                input_tokens = len(prompt) // 4  # Rough estimate
                output_tokens = len(response_text) // 4

            elif self.provider == "cisco":
                response_text, input_tokens, output_tokens = await self._call_cisco_circuit(prompt)

            else:
                logger.error(f"Unknown provider: {self.provider}")
                return []

            # Calculate cost using model-specific pricing
            cost_input, cost_output = get_model_costs(self.model)
            ai_cost = (input_tokens / 1000 * cost_input) + (output_tokens / 1000 * cost_output)

            # Log cost to database for telemetry
            try:
                cost_logger = get_cost_logger()
                asyncio.create_task(
                    cost_logger.log_background_job(
                        job_name="splunk_insight_categorization",
                        model=self.model,
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        job_metadata={"log_count": len(logs), "provider": self.provider},
                    )
                )
            except Exception as cost_error:
                logger.warning(f"Failed to log splunk insight cost: {cost_error}")

            # Parse JSON
            json_match = re.search(r"```json\n?(.*?)\n?```", response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)

            result = json.loads(response_text.strip())
            insights = result.get("insights", [])

            # Add cost tracking to each insight
            cost_per_insight = ai_cost / len(insights) if insights else 0
            tokens_per_insight = (input_tokens + output_tokens) // len(insights) if insights else 0

            for insight in insights:
                insight["ai_cost"] = cost_per_insight
                insight["token_count"] = tokens_per_insight

            return insights

        except Exception as e:
            logger.error(f"Error categorizing logs with AI ({self.provider}): {e}")
            return []

    async def _call_cisco_circuit(self, prompt: str) -> tuple[str, int, int]:
        """Call Cisco Circuit API for AI completion.

        Returns:
            Tuple of (response_text, input_tokens, output_tokens)
        """
        import base64
        import time

        TOKEN_URL = "https://id.cisco.com/oauth2/default/v1/token"
        CHAT_BASE_URL = "https://chat-ai.cisco.com/openai/deployments"
        API_VERSION = "2025-04-01-preview"

        # Get the model endpoint (strip cisco- prefix if present)
        api_model = self.model[6:] if self.model.startswith("cisco-") else self.model
        chat_url = f"{CHAT_BASE_URL}/{api_model}/chat/completions?api-version={API_VERSION}"

        # Get OAuth token
        credentials = f"{self.client_id}:{self.client_secret}"
        basic_auth = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient(verify=get_settings().cisco_circuit_verify_ssl, timeout=120.0) as client:
            # Get access token
            token_response = await client.post(
                TOKEN_URL,
                headers={
                    "Authorization": f"Basic {basic_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data="grant_type=client_credentials",
            )

            if token_response.status_code != 200:
                raise Exception(f"Cisco token request failed: {token_response.status_code}")

            access_token = token_response.json()["access_token"]

            # Call chat API
            response = await client.post(
                chat_url,
                headers={
                    "Content-Type": "application/json",
                    "api-key": access_token,
                },
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "user": json.dumps({"appkey": self.app_key}) if self.app_key else None,
                    "max_tokens": 4096,
                },
            )

            if response.status_code != 200:
                raise Exception(f"Cisco Circuit API error: {response.status_code} - {response.text}")

            result = response.json()
            response_text = result["choices"][0]["message"]["content"]
            input_tokens = result.get("usage", {}).get("prompt_tokens", 0)
            output_tokens = result.get("usage", {}).get("completion_tokens", 0)

            return response_text, input_tokens, output_tokens

    async def _clear_old_insights(
        self,
        organization: str,
        search_query: str,
        time_range: str,
    ):
        """Clear old insights for this org/query combination."""
        async with self.db.session() as session:
            await session.execute(
                delete(SplunkLogInsight).where(
                    SplunkLogInsight.organization == organization,
                    SplunkLogInsight.search_query == search_query,
                    SplunkLogInsight.time_range == time_range,
                )
            )

    async def _save_insights(
        self,
        insights: List[Dict[str, Any]],
        organization: str,
        search_query: str,
        time_range: str,
    ) -> List[int]:
        """Save insights to database."""
        # First clear old insights for this query
        await self._clear_old_insights(organization, search_query, time_range)

        insight_ids = []
        valid_severities = {"critical", "high", "medium", "low", "info"}

        async with self.db.session() as session:
            for insight_data in insights:
                # Normalize severity to lowercase string
                severity_raw = insight_data.get("severity", "info").lower()
                severity = severity_raw if severity_raw in valid_severities else "info"

                insight = SplunkLogInsight(
                    organization=organization,
                    search_query=search_query,
                    time_range=time_range,
                    title=insight_data.get("title", "Unknown"),
                    severity=severity,
                    description=insight_data.get("description"),
                    log_count=insight_data.get("count", 0),
                    examples=insight_data.get("examples", []),
                    source_system=insight_data.get("source_system", "unknown"),
                    ai_cost=insight_data.get("ai_cost"),
                    token_count=insight_data.get("token_count"),
                )
                session.add(insight)
                await session.flush()
                await session.refresh(insight)
                insight_ids.append(insight.id)

        return insight_ids
