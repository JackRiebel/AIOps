"""Service for fetching alerts from multiple monitoring sources."""

import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx

from src.models.incident import Event, EventSource, EventSeverity
from src.services.credential_manager import CredentialManager

logger = logging.getLogger(__name__)


class AlertFetcherService:
    """Service to fetch alerts from Meraki, ThousandEyes, and Splunk."""

    def __init__(self):
        self.credential_manager = CredentialManager()

    async def fetch_all_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Fetch alerts from all configured sources.

        Args:
            hours: Number of hours to look back for alerts

        Returns:
            List of normalized alert dictionaries
        """
        alerts = []

        # Get all active organizations
        clusters = await self.credential_manager.list_clusters(active_only=True)
        logger.info(f"Found {len(clusters)} active organizations to check for alerts")

        for cluster in clusters:
            credentials = await self.credential_manager.get_credentials(cluster.name)
            if not credentials:
                logger.warning(f"No credentials found for organization: {cluster.name}")
                continue

            # Determine source type based on URL
            base_url = credentials["base_url"].lower()
            is_thousandeyes = "thousandeyes.com" in base_url
            is_splunk = ":8089" in base_url or "splunk" in base_url

            if is_thousandeyes:
                logger.info(f"Fetching ThousandEyes alerts from '{cluster.name}'...")
                te_alerts = await self._fetch_thousandeyes_alerts(cluster.name, credentials, hours)
                logger.info(f"  → Found {len(te_alerts)} ThousandEyes alerts")
                alerts.extend(te_alerts)
            elif is_splunk:
                logger.info(f"Fetching Splunk alerts from '{cluster.name}'...")
                splunk_alerts = await self._fetch_splunk_alerts(cluster.name, credentials, hours)
                logger.info(f"  → Found {len(splunk_alerts)} Splunk alerts")
                alerts.extend(splunk_alerts)
            else:
                logger.info(f"Fetching Meraki alerts from '{cluster.name}'...")
                meraki_alerts = await self._fetch_meraki_alerts(cluster.name, credentials, hours)
                logger.info(f"  → Found {len(meraki_alerts)} Meraki alerts")
                alerts.extend(meraki_alerts)

        logger.info(f"Total alerts collected: {len(alerts)}")
        return alerts

    async def _fetch_meraki_alerts(
        self, organization: str, credentials: Dict[str, Any], hours: int
    ) -> List[Dict[str, Any]]:
        """Fetch alerts from Meraki Dashboard.

        Args:
            organization: Organization name
            credentials: API credentials
            hours: Hours to look back

        Returns:
            List of normalized alert dictionaries
        """
        alerts = []

        try:
            headers = {
                "X-Cisco-Meraki-API-Key": credentials["api_key"],
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                # Get organization ID
                org_response = await client.get(
                    f"{credentials['base_url']}/organizations", headers=headers
                )

                if org_response.status_code != 200:
                    logger.error(
                        f"Failed to fetch Meraki organizations for {organization}: HTTP {org_response.status_code}"
                    )
                    return alerts

                orgs = org_response.json()
                if not orgs:
                    return alerts

                org_id = orgs[0]["id"]

                # Calculate time range
                t0 = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"

                # Fetch alerts from organization
                # Note: Meraki uses /organizations/{orgId}/alerts/profiles but we'll use appliance uplink statuses
                # and device statuses as proxy for "alerts"

                # 1. Get network-wide alerts (appliance uplink statuses can indicate connectivity issues)
                networks_response = await client.get(
                    f"{credentials['base_url']}/organizations/{org_id}/networks", headers=headers
                )

                if networks_response.status_code == 200:
                    networks = networks_response.json()

                    for network in networks[:10]:  # Limit to first 10 networks for performance
                        # Get devices in network
                        devices_response = await client.get(
                            f"{credentials['base_url']}/networks/{network['id']}/devices",
                            headers=headers,
                        )

                        if devices_response.status_code == 200:
                            devices = devices_response.json()

                            for device in devices:
                                # Check device status - offline/dormant devices are "alerts"
                                if device.get("status") in ["offline", "dormant"]:
                                    alerts.append({
                                        "source": EventSource.MERAKI.value,
                                        "source_event_id": f"device-{device.get('serial')}-{device.get('status')}",
                                        "organization": organization,
                                        "event_type": f"device_{device.get('status')}",
                                        "severity": EventSeverity.HIGH.value if device.get("status") == "offline" else EventSeverity.MEDIUM.value,
                                        "title": f"{device.get('name', 'Unknown Device')} is {device.get('status')}",
                                        "description": f"Device {device.get('name')} (Model: {device.get('model')}) in network {network.get('name')} is {device.get('status')}",
                                        "timestamp": datetime.utcnow(),  # Meraki doesn't provide alert timestamp in device status
                                        "affected_resource": device.get("name", device.get("serial")),
                                        "raw_data": device,
                                    })

                # 2. Get organization-wide alerts if available
                alerts_response = await client.get(
                    f"{credentials['base_url']}/organizations/{org_id}/assurance/alerts",
                    headers=headers,
                    params={"startingAfter": t0},
                )

                if alerts_response.status_code == 200:
                    meraki_alerts = alerts_response.json()
                    for alert in meraki_alerts:
                        # Map Meraki alert severity to our severity
                        severity_map = {
                            "critical": EventSeverity.CRITICAL.value,
                            "warning": EventSeverity.MEDIUM.value,
                            "informational": EventSeverity.INFO.value,
                        }

                        # Extract affected resource (device name) from scope
                        affected_resource = None
                        if alert.get("scope", {}).get("devices"):
                            devices_in_scope = alert["scope"]["devices"]
                            if devices_in_scope and len(devices_in_scope) > 0:
                                first_device = devices_in_scope[0]
                                if isinstance(first_device, dict):
                                    affected_resource = first_device.get("name") or first_device.get("serial")
                                else:
                                    affected_resource = str(first_device)

                        alerts.append({
                            "source": EventSource.MERAKI.value,
                            "source_event_id": alert.get("id"),
                            "organization": organization,
                            "event_type": alert.get("type", "unknown"),
                            "severity": severity_map.get(alert.get("severity", ""), EventSeverity.MEDIUM.value),
                            "title": alert.get("title", "Meraki Alert"),
                            "description": alert.get("description"),
                            "timestamp": datetime.fromisoformat(alert["occurredAt"].replace("Z", "+00:00")) if alert.get("occurredAt") else datetime.utcnow(),
                            "affected_resource": affected_resource,
                            "raw_data": alert,
                        })

        except Exception as e:
            logger.error(f"Error fetching Meraki alerts for {organization}: {e}")

        return alerts

    async def _fetch_thousandeyes_alerts(
        self, organization: str, credentials: Dict[str, Any], hours: int
    ) -> List[Dict[str, Any]]:
        """Fetch alerts from ThousandEyes.

        Args:
            organization: Organization name
            credentials: API credentials
            hours: Hours to look back

        Returns:
            List of normalized alert dictionaries
        """
        alerts = []

        try:
            headers = {
                "Authorization": f"Bearer {credentials['api_key']}",
                "Content-Type": "application/json",
                "Accept": "application/hal+json",
            }

            # Ensure base URL includes /v7 path
            base_url = credentials['base_url'].rstrip('/')
            if not base_url.endswith('/v7'):
                base_url = f"{base_url}/v7"

            # Calculate time range (ThousandEyes window expects string with time unit)
            # Format: number + unit (s=seconds, m=minutes, h=hours, d=days, w=weeks)
            window = f"{hours}h"

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=30.0) as client:
                # Fetch alerts from ThousandEyes v7 API
                alerts_response = await client.get(
                    f"{base_url}/alerts",
                    headers=headers,
                    params={"window": window},
                )

                if alerts_response.status_code != 200:
                    try:
                        error_body = alerts_response.json()
                    except (ValueError, json.JSONDecodeError):
                        error_body = alerts_response.text
                    logger.warning(
                        f"Failed to fetch ThousandEyes alerts for {organization}: HTTP {alerts_response.status_code} - {error_body}. "
                        f"Note: The stored API token may have different permissions or belong to a different account than THOUSANDEYES_OAUTH_TOKEN."
                    )
                    # Continue without ThousandEyes alerts instead of failing completely
                    return []

                te_data = alerts_response.json()
                te_alerts = te_data.get("alerts", [])

                for alert in te_alerts:
                    # Map ThousandEyes alert severity
                    severity_map = {
                        "critical": EventSeverity.CRITICAL.value,
                        "major": EventSeverity.HIGH.value,
                        "minor": EventSeverity.MEDIUM.value,
                        "info": EventSeverity.INFO.value,
                    }

                    # Parse timestamp
                    alert_time = datetime.utcnow()
                    if alert.get("dateStart"):
                        try:
                            # ThousandEyes uses ISO format
                            alert_time = datetime.fromisoformat(alert["dateStart"].replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            pass  # Use default utcnow() if parsing fails

                    alerts.append({
                        "source": EventSource.THOUSANDEYES.value,
                        "source_event_id": str(alert.get("alertId")),
                        "organization": organization,
                        "event_type": alert.get("type", "unknown"),
                        "severity": severity_map.get(alert.get("severity", ""), EventSeverity.MEDIUM.value),
                        "title": alert.get("ruleName", "ThousandEyes Alert"),
                        "description": f"{alert.get('violationCount', 0)} violations detected for {alert.get('testName', 'test')}",
                        "timestamp": alert_time,
                        "affected_resource": alert.get("testName"),
                        "raw_data": alert,
                    })

        except Exception as e:
            logger.error(f"Error fetching ThousandEyes alerts for {organization}: {e}")

        return alerts

    async def _fetch_splunk_alerts(
        self, organization: str, credentials: Dict[str, Any], hours: int
    ) -> List[Dict[str, Any]]:
        """Fetch notable events from Splunk Enterprise.

        Args:
            organization: Organization name
            credentials: API credentials
            hours: Hours to look back

        Returns:
            List of normalized alert dictionaries
        """
        alerts = []

        try:
            # Splunk uses "Splunk {token}" format for token auth
            token = credentials.get("api_key")

            if not token:
                logger.warning(f"Splunk API key not configured for {organization}")
                return []

            # Use Splunk token auth format
            headers = {
                "Authorization": f"Splunk {token}",
                "Content-Type": "application/x-www-form-urlencoded",
            }

            # Calculate time range for Splunk query
            earliest_time = f"-{hours}h"

            async with httpx.AsyncClient(verify=credentials.get("verify_ssl", False), timeout=60.0) as client:
                # Create a search job to fetch notable events
                # Notable events are typically in index=notable or using the notable search command
                search_query = f'search index=notable earliest={earliest_time} | head 100'

                # Create search job
                create_job_response = await client.post(
                    f"{credentials['base_url']}/services/search/jobs",
                    headers=headers,
                    data={"search": search_query, "output_mode": "json"},
                )

                if create_job_response.status_code not in [200, 201]:
                    logger.error(
                        f"Failed to create Splunk search job for {organization}: HTTP {create_job_response.status_code}"
                    )
                    return alerts

                job_data = create_job_response.json()
                job_id = job_data.get("sid")

                if not job_id:
                    logger.error(f"No search job ID returned from Splunk for {organization}")
                    return alerts

                # Poll for job completion (wait up to 30 seconds)
                import asyncio
                max_attempts = 30
                for attempt in range(max_attempts):
                    job_status_response = await client.get(
                        f"{credentials['base_url']}/services/search/jobs/{job_id}",
                        headers=headers,
                        params={"output_mode": "json"},
                    )

                    if job_status_response.status_code == 200:
                        status_data = job_status_response.json()
                        entry = status_data.get("entry", [{}])[0]
                        content = entry.get("content", {})

                        if content.get("isDone"):
                            break

                    await asyncio.sleep(1)

                # Fetch search results
                results_response = await client.get(
                    f"{credentials['base_url']}/services/search/jobs/{job_id}/results",
                    headers=headers,
                    params={"output_mode": "json", "count": 100},
                )

                if results_response.status_code != 200:
                    logger.error(
                        f"Failed to fetch Splunk search results for {organization}: HTTP {results_response.status_code}"
                    )
                    return alerts

                results_data = results_response.json()
                events = results_data.get("results", [])

                for event in events:
                    # Map Splunk severity/urgency to our severity levels
                    severity = event.get("severity", "medium")
                    urgency = event.get("urgency", "medium")

                    # Determine overall severity based on Splunk's urgency or severity fields
                    severity_map = {
                        "critical": EventSeverity.CRITICAL.value,
                        "high": EventSeverity.HIGH.value,
                        "medium": EventSeverity.MEDIUM.value,
                        "low": EventSeverity.LOW.value,
                        "informational": EventSeverity.INFO.value,
                        "info": EventSeverity.INFO.value,
                    }

                    mapped_severity = severity_map.get(
                        urgency.lower() if urgency else severity.lower(),
                        EventSeverity.MEDIUM.value
                    )

                    # Parse timestamp
                    event_time = datetime.utcnow()
                    if event.get("_time"):
                        try:
                            # Splunk returns Unix timestamp
                            event_time = datetime.fromtimestamp(float(event["_time"]))
                        except (ValueError, TypeError, OSError):
                            pass  # Use default utcnow() if parsing fails

                    # Build alert title and description
                    title = event.get("title") or event.get("search_name") or "Splunk Notable Event"
                    description = event.get("description") or event.get("message") or event.get("_raw", "")

                    alerts.append({
                        "source": EventSource.SPLUNK.value,
                        "source_event_id": event.get("event_id") or event.get("_cd", ""),
                        "organization": organization,
                        "event_type": event.get("rule_name") or event.get("correlation_search_name") or "notable",
                        "severity": mapped_severity,
                        "title": title,
                        "description": description[:1000] if description else None,  # Limit description length
                        "timestamp": event_time,
                        "affected_resource": event.get("dest") or event.get("src") or event.get("host"),
                        "raw_data": event,
                    })

                # Clean up search job
                await client.delete(
                    f"{credentials['base_url']}/services/search/jobs/{job_id}",
                    headers=headers,
                )

        except Exception as e:
            logger.error(f"Error fetching Splunk alerts for {organization}: {e}")

        return alerts
