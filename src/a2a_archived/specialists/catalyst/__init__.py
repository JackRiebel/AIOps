"""
Catalyst Center skill modules for the A2A agent system.

This package organizes Catalyst Center operations into logical modules matching
the official Catalyst Center REST API structure. Each module provides skills
that can be aggregated by the main CatalystAgent.

Modules:
    sites - Site hierarchy management (CRUD, health, membership)
    devices - Network device operations (CRUD, config, sync, enrichment)
    interfaces - Interface management (details, VLANs, statistics)
    clients - Client operations (details, health, proximity)
    issues - Issue management (query, resolve, custom definitions)
    health - Health analytics (site, network, device, client)
    topology - Network topology views (physical, L2, L3, VLAN)
    network_settings - Global settings, credentials, IP pools
    discovery - Network discovery jobs and management
    swim - Software image management (SWIM)
    command_runner - CLI command execution
    templates - Configuration templates
    wireless - Wireless management (SSIDs, profiles, APs)
    sda - SD-Access fabric operations
    compliance - Policy compliance management
    events - Event management and subscriptions
    path_trace - Network path analysis

Official Catalyst Center API Reference:
    https://developer.cisco.com/docs/dna-center/

API Version: 2.3.7.9
"""

from .base import (
    # Base classes
    CatalystSkillModule,
    CatalystAPIClient,
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
    SITE_ID_SCHEMA,
    SITE_NAME_SCHEMA,
    DEVICE_ID_SCHEMA,
    DEVICE_IP_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
    INTERFACE_ID_SCHEMA,
    CLIENT_MAC_SCHEMA,
    ISSUE_ID_SCHEMA,
    TIMESTAMP_SCHEMA,
    TIME_RANGE_SCHEMA,
    OFFSET_SCHEMA,
    LIMIT_SCHEMA,
    DEVICE_FAMILY_SCHEMA,
    REACHABILITY_SCHEMA,
    ISSUE_PRIORITY_SCHEMA,
    ISSUE_STATUS_SCHEMA,
    TOPOLOGY_TYPE_SCHEMA,
    SITE_TYPE_SCHEMA,
    PROJECT_ID_SCHEMA,
    TEMPLATE_ID_SCHEMA,
    DISCOVERY_ID_SCHEMA,
    IMAGE_ID_SCHEMA,
    FABRIC_SITE_SCHEMA,
    VIRTUAL_NETWORK_SCHEMA,
    IP_POOL_SCHEMA,
    SSID_SCHEMA,
    VLAN_ID_SCHEMA,
    FLOW_ANALYSIS_ID_SCHEMA,
)

# Skill modules
from .sites import SitesModule
from .devices import DevicesModule
from .interfaces import InterfacesModule
from .clients import ClientsModule
from .issues import IssuesModule
from .health import HealthModule
from .topology import TopologyModule
from .network_settings import NetworkSettingsModule
from .discovery import DiscoveryModule
from .swim import SwimModule
from .command_runner import CommandRunnerModule
from .templates import TemplatesModule
from .wireless import WirelessModule
from .sda import SDAModule
from .compliance import ComplianceModule
from .events import EventsModule
from .path_trace import PathTraceModule

__all__ = [
    # Base classes and utilities
    "CatalystSkillModule",
    "CatalystAPIClient",
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
    "SITE_ID_SCHEMA",
    "SITE_NAME_SCHEMA",
    "DEVICE_ID_SCHEMA",
    "DEVICE_IP_SCHEMA",
    "DEVICE_SERIAL_SCHEMA",
    "INTERFACE_ID_SCHEMA",
    "CLIENT_MAC_SCHEMA",
    "ISSUE_ID_SCHEMA",
    "TIMESTAMP_SCHEMA",
    "TIME_RANGE_SCHEMA",
    "OFFSET_SCHEMA",
    "LIMIT_SCHEMA",
    "DEVICE_FAMILY_SCHEMA",
    "REACHABILITY_SCHEMA",
    "ISSUE_PRIORITY_SCHEMA",
    "ISSUE_STATUS_SCHEMA",
    "TOPOLOGY_TYPE_SCHEMA",
    "SITE_TYPE_SCHEMA",
    "PROJECT_ID_SCHEMA",
    "TEMPLATE_ID_SCHEMA",
    "DISCOVERY_ID_SCHEMA",
    "IMAGE_ID_SCHEMA",
    "FABRIC_SITE_SCHEMA",
    "VIRTUAL_NETWORK_SCHEMA",
    "IP_POOL_SCHEMA",
    "SSID_SCHEMA",
    "VLAN_ID_SCHEMA",
    "FLOW_ANALYSIS_ID_SCHEMA",
    # Skill modules
    "SitesModule",
    "DevicesModule",
    "InterfacesModule",
    "ClientsModule",
    "IssuesModule",
    "HealthModule",
    "TopologyModule",
    "NetworkSettingsModule",
    "DiscoveryModule",
    "SwimModule",
    "CommandRunnerModule",
    "TemplatesModule",
    "WirelessModule",
    "SDAModule",
    "ComplianceModule",
    "EventsModule",
    "PathTraceModule",
]

# List of all skill modules for easy aggregation
ALL_MODULES = [
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
]
