"""Sample queries for testing agent routing and responses.

This module provides categorized sample queries that test various
aspects of the A2A agent system including routing, multi-domain
detection, follow-up handling, and typo correction.
"""

from typing import Dict, List, Any
from dataclasses import dataclass


@dataclass
class TestQuery:
    """A test query with expected routing and behavior."""
    query: str
    expected_primary_agent: str
    expected_secondary_agents: List[str] = None
    is_multi_domain: bool = False
    is_follow_up: bool = False
    expected_skill: str = None
    description: str = ""

    def __post_init__(self):
        if self.expected_secondary_agents is None:
            self.expected_secondary_agents = []


# ============================================================================
# Single-Domain Queries (route to one agent)
# ============================================================================

MERAKI_QUERIES = [
    TestQuery(
        query="Show me all devices in the network",
        expected_primary_agent="meraki-agent",
        expected_skill="list_devices",
        description="Basic device listing",
    ),
    TestQuery(
        query="What is the status of my MX68?",
        expected_primary_agent="meraki-agent",
        expected_skill="get_device_status",
        description="Device status check",
    ),
    TestQuery(
        query="List all networks in my organization",
        expected_primary_agent="meraki-agent",
        expected_skill="list_networks",
        description="Network listing",
    ),
    TestQuery(
        query="Show me the clients connected to the wireless network",
        expected_primary_agent="meraki-agent",
        expected_skill="get_clients",
        description="Client listing",
    ),
    TestQuery(
        query="What are the uplink statuses?",
        expected_primary_agent="meraki-agent",
        expected_skill="get_uplink_status",
        description="Uplink status check",
    ),
]

SPLUNK_QUERIES = [
    TestQuery(
        query="Search for authentication failures in the last hour",
        expected_primary_agent="splunk-agent",
        expected_skill="search_events",
        description="Security event search",
    ),
    TestQuery(
        query="Show me recent Splunk alerts",
        expected_primary_agent="splunk-agent",
        expected_skill="get_alerts",
        description="Alert listing",
    ),
    TestQuery(
        query="Find all VPN connection events today",
        expected_primary_agent="splunk-agent",
        expected_skill="search_events",
        description="Event search with time",
    ),
    TestQuery(
        query="Check for any security incidents",
        expected_primary_agent="splunk-agent",
        expected_skill="get_alerts",
        description="Security incident check",
    ),
]

CATALYST_QUERIES = [
    TestQuery(
        query="Show me the network health in Catalyst Center",
        expected_primary_agent="catalyst-agent",
        expected_skill="get_network_health",
        description="Network health check",
    ),
    TestQuery(
        query="List all sites in DNA Center",
        expected_primary_agent="catalyst-agent",
        expected_skill="get_sites",
        description="Site listing",
    ),
    TestQuery(
        query="Are there any issues in Catalyst?",
        expected_primary_agent="catalyst-agent",
        expected_skill="get_issues",
        description="Issue check",
    ),
    TestQuery(
        query="Show device compliance status",
        expected_primary_agent="catalyst-agent",
        expected_skill="get_compliance_status",
        description="Compliance check",
    ),
]

THOUSANDEYES_QUERIES = [
    TestQuery(
        query="Show me ThousandEyes test results",
        expected_primary_agent="thousandeyes-agent",
        expected_skill="get_test_results",
        description="Test results",
    ),
    TestQuery(
        query="Are there any ThousandEyes alerts?",
        expected_primary_agent="thousandeyes-agent",
        expected_skill="get_alerts",
        description="Alert check",
    ),
    TestQuery(
        query="List all monitoring agents",
        expected_primary_agent="thousandeyes-agent",
        expected_skill="get_agents",
        description="Agent listing",
    ),
    TestQuery(
        query="What is the network monitoring health?",
        expected_primary_agent="thousandeyes-agent",
        expected_skill="get_network_health",
        description="Monitoring health",
    ),
]


# ============================================================================
# Multi-Domain Queries (should trigger collaborative workflows)
# ============================================================================

MULTI_DOMAIN_QUERIES = [
    TestQuery(
        query="Show me Splunk logs for my Meraki devices",
        expected_primary_agent="meraki-agent",
        expected_secondary_agents=["splunk-agent"],
        is_multi_domain=True,
        description="Meraki + Splunk correlation",
    ),
    TestQuery(
        query="Correlate ThousandEyes alerts with network device status",
        expected_primary_agent="thousandeyes-agent",
        expected_secondary_agents=["meraki-agent"],
        is_multi_domain=True,
        description="ThousandEyes + Meraki correlation",
    ),
    TestQuery(
        query="Check overall health of all systems",
        expected_primary_agent="meraki-agent",
        expected_secondary_agents=["thousandeyes-agent", "catalyst-agent"],
        is_multi_domain=True,
        description="Comprehensive health check",
    ),
    TestQuery(
        query="Troubleshoot the connectivity issue",
        expected_primary_agent="splunk-agent",
        expected_secondary_agents=["meraki-agent", "catalyst-agent"],
        is_multi_domain=True,
        description="Troubleshooting workflow",
    ),
    TestQuery(
        query="What caused this network outage? Investigate the root cause",
        expected_primary_agent="splunk-agent",
        expected_secondary_agents=["meraki-agent", "thousandeyes-agent"],
        is_multi_domain=True,
        description="Root cause analysis",
    ),
    TestQuery(
        query="Generate a comprehensive network report",
        expected_primary_agent="meraki-agent",
        expected_secondary_agents=["catalyst-agent", "thousandeyes-agent", "splunk-agent"],
        is_multi_domain=True,
        description="Full report generation",
    ),
    TestQuery(
        query="Check security status across all network devices",
        expected_primary_agent="meraki-agent",
        expected_secondary_agents=["splunk-agent"],
        is_multi_domain=True,
        description="Security + network check",
    ),
]


# ============================================================================
# Follow-Up Queries (should use context from previous query)
# ============================================================================

FOLLOW_UP_QUERIES = [
    TestQuery(
        query="interesting",
        expected_primary_agent=None,  # Should use last agent
        is_follow_up=True,
        description="Reaction - interesting",
    ),
    TestQuery(
        query="tell me more",
        expected_primary_agent=None,
        is_follow_up=True,
        description="Request for more info",
    ),
    TestQuery(
        query="what about the other devices?",
        expected_primary_agent=None,
        is_follow_up=True,
        description="Pronoun reference",
    ),
    TestQuery(
        query="cool",
        expected_primary_agent=None,
        is_follow_up=True,
        description="Short reaction",
    ),
    TestQuery(
        query="why?",
        expected_primary_agent=None,
        is_follow_up=True,
        description="Question follow-up",
    ),
    TestQuery(
        query="expand on that",
        expected_primary_agent=None,
        is_follow_up=True,
        description="Expansion request",
    ),
]


# ============================================================================
# Queries with Typos (should be corrected)
# ============================================================================

TYPO_QUERIES = [
    {
        "original": "Show me Splnk events",
        "corrected_contains": "splunk",
        "description": "Splunk typo",
    },
    {
        "original": "Merkai device status",
        "corrected_contains": "meraki",
        "description": "Meraki typo",
    },
    {
        "original": "Catalist Center health",
        "corrected_contains": "catalyst",
        "description": "Catalyst typo",
    },
    {
        "original": "ThousndEyes alerts",
        "corrected_contains": "thousandeyes",
        "description": "ThousandEyes typo",
    },
]


# ============================================================================
# Time-Based Queries (should infer time ranges)
# ============================================================================

TIME_BASED_QUERIES = [
    {
        "query": "Show me recent events",
        "expected_time_range": "-24h",
        "description": "Recent = 24 hours",
    },
    {
        "query": "Events from the last hour",
        "expected_time_range": "-1h",
        "description": "Last hour",
    },
    {
        "query": "What happened today?",
        "expected_time_range": "-24h",
        "description": "Today = 24 hours",
    },
    {
        "query": "Show me this week's alerts",
        "expected_time_range": "-7d",
        "description": "This week = 7 days",
    },
    {
        "query": "Events from the past month",
        "expected_time_range": "-30d",
        "description": "Past month = 30 days",
    },
]


# ============================================================================
# Edge Case Queries
# ============================================================================

EDGE_CASE_QUERIES = [
    {
        "query": "",
        "should_fail": True,
        "description": "Empty query",
    },
    {
        "query": "asdfghjkl",
        "should_route_to": "clarification-agent",
        "description": "Gibberish query",
    },
    {
        "query": "?",
        "is_follow_up": True,
        "description": "Single character",
    },
    {
        "query": "Show me the device named 'Test Device (Special)' in network \"Main/Office\"",
        "expected_primary_agent": "meraki-agent",
        "description": "Special characters in query",
    },
]


# ============================================================================
# Helper Functions
# ============================================================================

def get_all_single_domain_queries() -> List[TestQuery]:
    """Get all single-domain test queries."""
    return MERAKI_QUERIES + SPLUNK_QUERIES + CATALYST_QUERIES + THOUSANDEYES_QUERIES


def get_queries_by_agent(agent_id: str) -> List[TestQuery]:
    """Get test queries for a specific agent."""
    agent_queries = {
        "meraki-agent": MERAKI_QUERIES,
        "splunk-agent": SPLUNK_QUERIES,
        "catalyst-agent": CATALYST_QUERIES,
        "thousandeyes-agent": THOUSANDEYES_QUERIES,
    }
    return agent_queries.get(agent_id, [])


def get_multi_domain_queries() -> List[TestQuery]:
    """Get all multi-domain test queries."""
    return MULTI_DOMAIN_QUERIES


def get_follow_up_queries() -> List[TestQuery]:
    """Get all follow-up test queries."""
    return FOLLOW_UP_QUERIES
