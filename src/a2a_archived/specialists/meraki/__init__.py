"""
Meraki skill modules for the A2A agent system.

This package organizes 500+ Meraki Dashboard API operations into
logical modules. Each module provides skills that can be aggregated
by the main MerakiAgent.

Modules:
    organizations - Organization management, admins, alerts, licensing
    networks - Network configuration, events, firmware, policies
    devices - Device management, live tools, reboots
    wireless - SSIDs, RF profiles, bluetooth, mesh
    appliance - Firewall, VPN, VLANs, content filtering
    switch - Ports, stacks, routing, ACLs, QoS
    camera - Video settings, quality, analytics
    sensor - Environmental sensors, alerts
    insight - Application monitoring
    sm - Systems Manager (MDM)
    licensing - License management
"""

from .base import (
    MerakiSkillModule,
    SkillDefinition,
    create_skill,
    build_input_schema,
    success_result,
    error_result,
    empty_result,
    api_get,
    api_post,
    api_put,
    api_delete,
    extract_org_entities,
    extract_network_entities,
    extract_device_entities,
    log_skill_start,
    log_skill_success,
    log_skill_error,
    ORG_ID_SCHEMA,
    NETWORK_ID_SCHEMA,
    DEVICE_SERIAL_SCHEMA,
    ORG_AND_NETWORK_SCHEMA,
)

# Import skill modules as they are created
from .organizations import OrganizationsModule
from .networks import NetworksModule
from .devices import DevicesModule
from .wireless import WirelessModule
from .appliance import ApplianceModule
from .switch import SwitchModule
from .camera import CameraModule
from .sensor import SensorModule
from .insight import InsightModule
from .sm import SMModule
from .licensing import LicensingModule

__all__ = [
    # Base classes and utilities
    "MerakiSkillModule",
    "SkillDefinition",
    "create_skill",
    "build_input_schema",
    "success_result",
    "error_result",
    "empty_result",
    "api_get",
    "api_post",
    "api_put",
    "api_delete",
    "extract_org_entities",
    "extract_network_entities",
    "extract_device_entities",
    "log_skill_start",
    "log_skill_success",
    "log_skill_error",
    # Common schemas
    "ORG_ID_SCHEMA",
    "NETWORK_ID_SCHEMA",
    "DEVICE_SERIAL_SCHEMA",
    "ORG_AND_NETWORK_SCHEMA",
    # Skill modules (uncomment as created)
    "OrganizationsModule",
    "NetworksModule",
    "DevicesModule",
    "WirelessModule",
    "ApplianceModule",
    "SwitchModule",
    "CameraModule",
    "SensorModule",
    "InsightModule",
    "SMModule",
    "LicensingModule",
]
