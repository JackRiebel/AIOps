"""Mock API responses for testing.

This module provides realistic mock responses from various APIs
(Meraki, Splunk, Catalyst, ThousandEyes) for testing agent behavior.
"""

from typing import Dict, Any, List
from datetime import datetime, timedelta


# ============================================================================
# Meraki API Mock Responses
# ============================================================================

MERAKI_ORGANIZATIONS = [
    {
        "id": "org-123456",
        "name": "Test Corporation",
        "url": "https://dashboard.meraki.com/o/abc123/manage/organization/overview",
    },
]

MERAKI_NETWORKS = [
    {
        "id": "L_123456789012345678",
        "organizationId": "org-123456",
        "name": "Headquarters",
        "productTypes": ["appliance", "switch", "wireless", "camera"],
        "timeZone": "America/Los_Angeles",
        "tags": ["production", "main"],
    },
    {
        "id": "L_234567890123456789",
        "organizationId": "org-123456",
        "name": "Branch Office - NYC",
        "productTypes": ["appliance", "wireless"],
        "timeZone": "America/New_York",
        "tags": ["production", "branch"],
    },
    {
        "id": "L_345678901234567890",
        "organizationId": "org-123456",
        "name": "Remote Site - Denver",
        "productTypes": ["appliance"],
        "timeZone": "America/Denver",
        "tags": ["remote"],
    },
]

MERAKI_DEVICES = [
    {
        "serial": "Q2AA-BBCC-DDEE",
        "name": "MX68-HQ-Primary",
        "model": "MX68",
        "networkId": "L_123456789012345678",
        "lanIp": "192.168.1.1",
        "wan1Ip": "203.0.113.10",
        "mac": "00:11:22:33:44:55",
        "tags": ["firewall", "primary"],
    },
    {
        "serial": "Q2FF-GGHH-IIJJ",
        "name": "MS120-HQ-Floor1",
        "model": "MS120-8",
        "networkId": "L_123456789012345678",
        "lanIp": "192.168.1.2",
        "mac": "00:11:22:33:44:56",
        "tags": ["switch", "floor1"],
    },
    {
        "serial": "Q3KK-LLMM-NNOO",
        "name": "MR46-HQ-Lobby",
        "model": "MR46",
        "networkId": "L_123456789012345678",
        "lanIp": "192.168.1.3",
        "mac": "00:11:22:33:44:57",
        "tags": ["wireless", "lobby"],
    },
]

MERAKI_DEVICE_STATUSES = [
    {"serial": "Q2AA-BBCC-DDEE", "name": "MX68-HQ-Primary", "status": "online", "lastReportedAt": "2024-01-15T10:30:00Z"},
    {"serial": "Q2FF-GGHH-IIJJ", "name": "MS120-HQ-Floor1", "status": "online", "lastReportedAt": "2024-01-15T10:29:00Z"},
    {"serial": "Q3KK-LLMM-NNOO", "name": "MR46-HQ-Lobby", "status": "online", "lastReportedAt": "2024-01-15T10:28:00Z"},
]

MERAKI_DEVICE_STATUSES_WITH_OFFLINE = [
    {"serial": "Q2AA-BBCC-DDEE", "name": "MX68-HQ-Primary", "status": "online", "lastReportedAt": "2024-01-15T10:30:00Z"},
    {"serial": "Q2FF-GGHH-IIJJ", "name": "MS120-HQ-Floor1", "status": "offline", "lastReportedAt": "2024-01-14T08:00:00Z"},
    {"serial": "Q3KK-LLMM-NNOO", "name": "MR46-HQ-Lobby", "status": "alerting", "lastReportedAt": "2024-01-15T10:00:00Z"},
]

MERAKI_CLIENTS = [
    {
        "id": "client-1",
        "mac": "aa:bb:cc:dd:ee:f1",
        "description": "John's Laptop",
        "ip": "192.168.1.100",
        "ssid": "Corporate-WiFi",
        "vlan": 10,
        "status": "Online",
    },
    {
        "id": "client-2",
        "mac": "aa:bb:cc:dd:ee:f2",
        "description": "Conference Room TV",
        "ip": "192.168.1.101",
        "ssid": None,  # Wired
        "vlan": 20,
        "status": "Online",
    },
]

MERAKI_UPLINK_STATUSES = [
    {
        "networkId": "L_123456789012345678",
        "serial": "Q2AA-BBCC-DDEE",
        "uplinks": [
            {"interface": "wan1", "status": "active", "ip": "203.0.113.10", "publicIp": "203.0.113.10"},
            {"interface": "wan2", "status": "ready", "ip": "198.51.100.10", "publicIp": "198.51.100.10"},
        ],
    },
]


# ============================================================================
# Splunk API Mock Responses
# ============================================================================

SPLUNK_SEARCH_RESULTS_EMPTY = {
    "results": [],
    "messages": [],
    "init_offset": 0,
    "preview": False,
}

SPLUNK_SEARCH_RESULTS_EVENTS = {
    "results": [
        {
            "_time": "2024-01-15T10:30:00.000+00:00",
            "_raw": "Jan 15 10:30:00 MX68-HQ-Primary vpn_connectivity: VPN tunnel to Branch-NYC established",
            "source": "meraki:api",
            "sourcetype": "meraki:events",
            "host": "MX68-HQ-Primary",
            "index": "network",
        },
        {
            "_time": "2024-01-15T10:25:00.000+00:00",
            "_raw": "Jan 15 10:25:00 MS120-HQ-Floor1 port_status: Port gi1/0/1 transitioned to up",
            "source": "meraki:api",
            "sourcetype": "meraki:events",
            "host": "MS120-HQ-Floor1",
            "index": "network",
        },
        {
            "_time": "2024-01-15T10:20:00.000+00:00",
            "_raw": "Jan 15 10:20:00 MR46-HQ-Lobby client_association: Client aa:bb:cc:dd:ee:f1 associated",
            "source": "meraki:api",
            "sourcetype": "meraki:events",
            "host": "MR46-HQ-Lobby",
            "index": "network",
        },
    ],
    "messages": [],
    "init_offset": 0,
    "preview": False,
}

SPLUNK_SEARCH_RESULTS_SECURITY = {
    "results": [
        {
            "_time": "2024-01-15T09:00:00.000+00:00",
            "_raw": "Security alert: Failed login attempt from 192.168.1.50",
            "source": "auth:logs",
            "sourcetype": "security:events",
            "severity": "medium",
            "category": "authentication",
        },
    ],
    "messages": [],
    "init_offset": 0,
    "preview": False,
}

SPLUNK_ALERTS_EMPTY = []

SPLUNK_ALERTS_WITH_ISSUES = [
    {
        "id": "alert-1",
        "title": "High bandwidth utilization on MX68",
        "severity": "warning",
        "triggered_at": "2024-01-15T08:00:00Z",
        "status": "active",
    },
]


# ============================================================================
# Catalyst Center API Mock Responses
# ============================================================================

CATALYST_DEVICES = [
    {
        "id": "device-uuid-1",
        "hostname": "core-switch-01",
        "managementIpAddress": "10.0.0.1",
        "platformId": "C9300-24T",
        "softwareVersion": "17.9.1",
        "reachabilityStatus": "Reachable",
        "role": "DISTRIBUTION",
        "family": "Switches and Hubs",
    },
    {
        "id": "device-uuid-2",
        "hostname": "access-switch-01",
        "managementIpAddress": "10.0.0.2",
        "platformId": "C9200-48P",
        "softwareVersion": "17.9.1",
        "reachabilityStatus": "Reachable",
        "role": "ACCESS",
        "family": "Switches and Hubs",
    },
]

CATALYST_DEVICES_WITH_ISSUES = [
    {
        "id": "device-uuid-1",
        "hostname": "core-switch-01",
        "managementIpAddress": "10.0.0.1",
        "platformId": "C9300-24T",
        "reachabilityStatus": "Reachable",
    },
    {
        "id": "device-uuid-3",
        "hostname": "problem-switch",
        "managementIpAddress": "10.0.0.3",
        "platformId": "C9200-24P",
        "reachabilityStatus": "Unreachable",
    },
]

CATALYST_ISSUES_EMPTY = []

CATALYST_ISSUES_ACTIVE = [
    {
        "issueId": "issue-uuid-1",
        "name": "Device_Unreachable",
        "description": "Device problem-switch is not reachable",
        "priority": "P1",
        "status": "active",
        "deviceId": "device-uuid-3",
        "category": "Availability",
        "lastOccurredTime": "2024-01-15T09:30:00Z",
    },
]

CATALYST_NETWORK_HEALTH = {
    "healthScore": 95,
    "totalDevices": 10,
    "healthyDevices": 9,
    "unhealthyDevices": 1,
    "monitoredDevices": 10,
}

CATALYST_NETWORK_HEALTH_DEGRADED = {
    "healthScore": 65,
    "totalDevices": 10,
    "healthyDevices": 6,
    "unhealthyDevices": 4,
    "monitoredDevices": 10,
}

CATALYST_SITES = [
    {
        "id": "site-uuid-1",
        "name": "Global/United States/San Francisco",
        "type": "building",
        "parentId": "site-uuid-parent",
    },
    {
        "id": "site-uuid-2",
        "name": "Global/United States/New York",
        "type": "building",
        "parentId": "site-uuid-parent",
    },
]

CATALYST_COMPLIANCE_ALL_COMPLIANT = [
    {"deviceId": "device-uuid-1", "status": "COMPLIANT", "lastChecked": "2024-01-15T10:00:00Z"},
    {"deviceId": "device-uuid-2", "status": "COMPLIANT", "lastChecked": "2024-01-15T10:00:00Z"},
]

CATALYST_COMPLIANCE_MIXED = [
    {"deviceId": "device-uuid-1", "status": "COMPLIANT", "lastChecked": "2024-01-15T10:00:00Z"},
    {"deviceId": "device-uuid-2", "status": "NON_COMPLIANT", "lastChecked": "2024-01-15T10:00:00Z"},
]


# ============================================================================
# ThousandEyes API Mock Responses
# ============================================================================

THOUSANDEYES_TESTS = [
    {
        "testId": 12345,
        "testName": "Corporate Website Monitor",
        "type": "http-server",
        "url": "https://www.example.com",
        "enabled": True,
        "interval": 300,
    },
    {
        "testId": 12346,
        "testName": "API Endpoint Check",
        "type": "http-server",
        "url": "https://api.example.com/health",
        "enabled": True,
        "interval": 60,
    },
]

THOUSANDEYES_AGENTS = [
    {
        "agentId": 1001,
        "agentName": "San Francisco - Agent 1",
        "agentType": "Cloud",
        "location": "San Francisco, CA, US",
        "enabled": True,
        "status": "online",
    },
    {
        "agentId": 1002,
        "agentName": "New York - Agent 1",
        "agentType": "Cloud",
        "location": "New York, NY, US",
        "enabled": True,
        "status": "online",
    },
]

THOUSANDEYES_AGENTS_WITH_OFFLINE = [
    {
        "agentId": 1001,
        "agentName": "San Francisco - Agent 1",
        "agentType": "Cloud",
        "status": "online",
    },
    {
        "agentId": 1003,
        "agentName": "Enterprise Agent - HQ",
        "agentType": "Enterprise",
        "status": "offline",
    },
]

THOUSANDEYES_ALERTS_EMPTY = []

THOUSANDEYES_ALERTS_ACTIVE = [
    {
        "alertId": 5001,
        "testId": 12345,
        "testName": "Corporate Website Monitor",
        "type": "HTTP",
        "severity": "warning",
        "active": True,
        "startTime": "2024-01-15T08:00:00Z",
        "rule": {"expression": "responseTime > 1000"},
    },
]

THOUSANDEYES_TEST_RESULTS = [
    {
        "testId": 12345,
        "roundId": 1705315200,
        "agentId": 1001,
        "responseTime": 245,
        "errorType": None,
        "connectTime": 50,
        "dnsTime": 20,
    },
    {
        "testId": 12345,
        "roundId": 1705315200,
        "agentId": 1002,
        "responseTime": 180,
        "errorType": None,
        "connectTime": 45,
        "dnsTime": 15,
    },
]

THOUSANDEYES_NETWORK_HEALTH = {
    "overallHealth": 98,
    "testsHealthy": 8,
    "testsWarning": 1,
    "testsCritical": 0,
    "agentsOnline": 5,
    "agentsOffline": 0,
}


# ============================================================================
# Helper Functions
# ============================================================================

def get_mock_response(api: str, endpoint: str, scenario: str = "default") -> Any:
    """Get a mock response for a specific API and endpoint.

    Args:
        api: API name (meraki, splunk, catalyst, thousandeyes)
        endpoint: Endpoint name (e.g., "devices", "alerts")
        scenario: Scenario name (default, empty, with_issues, etc.)

    Returns:
        Mock response data
    """
    responses = {
        "meraki": {
            "organizations": {"default": MERAKI_ORGANIZATIONS},
            "networks": {"default": MERAKI_NETWORKS},
            "devices": {"default": MERAKI_DEVICES},
            "device_statuses": {
                "default": MERAKI_DEVICE_STATUSES,
                "with_offline": MERAKI_DEVICE_STATUSES_WITH_OFFLINE,
            },
            "clients": {"default": MERAKI_CLIENTS, "empty": []},
            "uplinks": {"default": MERAKI_UPLINK_STATUSES},
        },
        "splunk": {
            "search": {
                "default": SPLUNK_SEARCH_RESULTS_EVENTS,
                "empty": SPLUNK_SEARCH_RESULTS_EMPTY,
                "security": SPLUNK_SEARCH_RESULTS_SECURITY,
            },
            "alerts": {
                "default": SPLUNK_ALERTS_EMPTY,
                "with_issues": SPLUNK_ALERTS_WITH_ISSUES,
            },
        },
        "catalyst": {
            "devices": {
                "default": CATALYST_DEVICES,
                "with_issues": CATALYST_DEVICES_WITH_ISSUES,
            },
            "issues": {
                "default": CATALYST_ISSUES_EMPTY,
                "active": CATALYST_ISSUES_ACTIVE,
            },
            "network_health": {
                "default": CATALYST_NETWORK_HEALTH,
                "degraded": CATALYST_NETWORK_HEALTH_DEGRADED,
            },
            "sites": {"default": CATALYST_SITES},
            "compliance": {
                "default": CATALYST_COMPLIANCE_ALL_COMPLIANT,
                "mixed": CATALYST_COMPLIANCE_MIXED,
            },
        },
        "thousandeyes": {
            "tests": {"default": THOUSANDEYES_TESTS},
            "agents": {
                "default": THOUSANDEYES_AGENTS,
                "with_offline": THOUSANDEYES_AGENTS_WITH_OFFLINE,
            },
            "alerts": {
                "default": THOUSANDEYES_ALERTS_EMPTY,
                "active": THOUSANDEYES_ALERTS_ACTIVE,
            },
            "test_results": {"default": THOUSANDEYES_TEST_RESULTS},
            "network_health": {"default": THOUSANDEYES_NETWORK_HEALTH},
        },
    }

    api_responses = responses.get(api, {})
    endpoint_responses = api_responses.get(endpoint, {})
    return endpoint_responses.get(scenario, endpoint_responses.get("default"))
