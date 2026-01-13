"""
ThousandEyes skill modules for the A2A agent system.

This package organizes ThousandEyes API v7 operations into logical modules matching
the official ThousandEyes REST API structure. Each module provides skills
that can be aggregated by the main ThousandEyesAgent.

Modules:
    tests_network - Network tests (agent-to-server, agent-to-agent)
    tests_web - Web tests (http-server, page-load, web-transactions, api)
    tests_dns - DNS tests (dns-server, dns-trace, dnssec)
    tests_voice - Voice tests (sip-server, voice)
    tests_other - Other tests (ftp-server, bgp)
    test_results - Test results for all test types
    instant_tests - Instant test execution
    agents - Cloud/Enterprise agent management
    endpoint_agents - Endpoint agent monitoring
    alerts - Alerts, rules, and suppression windows
    dashboards - Dashboard management, widgets, snapshots
    admin - Administration (users, roles, account groups)
    credentials - Credential management
    bgp_monitors - BGP monitor operations
    labels - Test/agent labeling
    emulation - User agent and device emulation

Official ThousandEyes API Reference:
    https://developer.cisco.com/docs/thousandeyes/

API Version: v7
"""

from .base import (
    # Base classes
    ThousandEyesSkillModule,
    ThousandEyesAPIClient,
    # Type definitions
    SkillDefinition,
    SkillResult,
    # Helper functions
    create_skill,
    success_result,
    error_result,
    empty_result,
    # Logging helpers
    log_skill_start,
    log_skill_success,
    log_skill_error,
    # Common schemas
    TEST_ID_SCHEMA,
    AGENT_ID_SCHEMA,
    ALERT_ID_SCHEMA,
    RULE_ID_SCHEMA,
    DASHBOARD_ID_SCHEMA,
    WIDGET_ID_SCHEMA,
    SNAPSHOT_ID_SCHEMA,
    ACCOUNT_GROUP_ID_SCHEMA,
    USER_ID_SCHEMA,
    ROLE_ID_SCHEMA,
    LABEL_ID_SCHEMA,
    CREDENTIAL_ID_SCHEMA,
    WINDOW_ID_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
    START_DATE_SCHEMA,
    END_DATE_SCHEMA,
    WINDOW_SCHEMA,
    ROUND_ID_SCHEMA,
    TEST_NAME_SCHEMA,
    TEST_INTERVAL_SCHEMA,
    TEST_URL_SCHEMA,
    TEST_SERVER_SCHEMA,
    TEST_PORT_SCHEMA,
    TEST_PROTOCOL_SCHEMA,
    TEST_ENABLED_SCHEMA,
    TEST_AGENTS_SCHEMA,
    TEST_ALERT_RULES_SCHEMA,
    DNS_DOMAIN_SCHEMA,
    DNS_SERVER_SCHEMA,
    DNS_RECORD_TYPE_SCHEMA,
    SIP_TARGET_SCHEMA,
    SIP_USER_SCHEMA,
    SIP_AUTH_USER_SCHEMA,
    CODEC_SCHEMA,
    DSCP_SCHEMA,
    BGP_PREFIX_SCHEMA,
    BGP_ASN_SCHEMA,
    ENDPOINT_AGENT_ID_SCHEMA,
)

# Skill modules - imported as they are implemented
from .tests_network import NetworkTestsModule
from .tests_web import WebTestsModule
from .tests_dns import DNSTestsModule
from .tests_voice import VoiceTestsModule
from .tests_other import OtherTestsModule
from .test_results import TestResultsModule
from .instant_tests import InstantTestsModule
from .agents import AgentsModule
from .endpoint_agents import EndpointAgentsModule
from .alerts import AlertsModule
from .dashboards import DashboardsModule
from .admin import AdminModule
from .credentials import CredentialsModule
from .bgp_monitors import BGPMonitorsModule
from .labels import LabelsModule
from .emulation import EmulationModule

__all__ = [
    # Base classes and utilities
    "ThousandEyesSkillModule",
    "ThousandEyesAPIClient",
    "SkillDefinition",
    "SkillResult",
    "create_skill",
    "success_result",
    "error_result",
    "empty_result",
    "log_skill_start",
    "log_skill_success",
    "log_skill_error",
    # Common schemas
    "TEST_ID_SCHEMA",
    "AGENT_ID_SCHEMA",
    "ALERT_ID_SCHEMA",
    "RULE_ID_SCHEMA",
    "DASHBOARD_ID_SCHEMA",
    "WIDGET_ID_SCHEMA",
    "SNAPSHOT_ID_SCHEMA",
    "ACCOUNT_GROUP_ID_SCHEMA",
    "USER_ID_SCHEMA",
    "ROLE_ID_SCHEMA",
    "LABEL_ID_SCHEMA",
    "CREDENTIAL_ID_SCHEMA",
    "WINDOW_ID_SCHEMA",
    "OFFSET_SCHEMA",
    "LIMIT_SCHEMA",
    "START_DATE_SCHEMA",
    "END_DATE_SCHEMA",
    "WINDOW_SCHEMA",
    "ROUND_ID_SCHEMA",
    "TEST_NAME_SCHEMA",
    "TEST_INTERVAL_SCHEMA",
    "TEST_URL_SCHEMA",
    "TEST_SERVER_SCHEMA",
    "TEST_PORT_SCHEMA",
    "TEST_PROTOCOL_SCHEMA",
    "TEST_ENABLED_SCHEMA",
    "TEST_AGENTS_SCHEMA",
    "TEST_ALERT_RULES_SCHEMA",
    "DNS_DOMAIN_SCHEMA",
    "DNS_SERVER_SCHEMA",
    "DNS_RECORD_TYPE_SCHEMA",
    "SIP_TARGET_SCHEMA",
    "SIP_USER_SCHEMA",
    "SIP_AUTH_USER_SCHEMA",
    "CODEC_SCHEMA",
    "DSCP_SCHEMA",
    "BGP_PREFIX_SCHEMA",
    "BGP_ASN_SCHEMA",
    "ENDPOINT_AGENT_ID_SCHEMA",
    # Skill modules
    "NetworkTestsModule",
    "WebTestsModule",
    "DNSTestsModule",
    "VoiceTestsModule",
    "OtherTestsModule",
    "TestResultsModule",
    "InstantTestsModule",
    "AgentsModule",
    "EndpointAgentsModule",
    "AlertsModule",
    "DashboardsModule",
    "AdminModule",
    "CredentialsModule",
    "BGPMonitorsModule",
    "LabelsModule",
    "EmulationModule",
]

# List of all skill modules for easy aggregation
ALL_MODULES = [
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
]
