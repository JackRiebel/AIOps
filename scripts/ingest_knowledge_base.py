#!/usr/bin/env python3
"""Knowledge Base Ingestion Script.

This script populates the RAG knowledge base with Cisco documentation:
- Meraki Dashboard API (from local OpenAPI spec)
- Catalyst Center API documentation
- Cisco ISE documentation
- General networking best practices

Prerequisites:
- OpenAI API key must be configured in system_config or OPENAI_API_KEY env var
- PostgreSQL with pgvector extension must be running
- Database tables must be created (run migrate_add_knowledge_base.py first)

Usage:
    python scripts/ingest_knowledge_base.py [--openai-key YOUR_KEY]
"""

import asyncio
import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.database import get_db
from src.services.document_ingestion_service import DocumentIngestionService
from src.services.embedding_service import EmbeddingService

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============================================================================
# Comprehensive Cisco Documentation Content
# ============================================================================

MERAKI_BEST_PRACTICES = """# Meraki Dashboard Best Practices Guide

## Network Design Principles

### VLAN Configuration
- Use VLANs to segment traffic by function (management, user, IoT, guest)
- Recommended VLAN ranges:
  - 1-99: Infrastructure and management
  - 100-199: User networks
  - 200-299: IoT devices
  - 300-399: Guest networks
- Always configure native VLAN as non-default (not VLAN 1)
- Enable DHCP snooping on access ports

### Wireless Best Practices
- Use WPA3 Enterprise for corporate SSIDs
- Limit SSID broadcast to 3-4 per AP to minimize overhead
- Enable band steering for dual-band clients
- Configure minimum bitrate of 12 Mbps for 2.4 GHz
- Use DFS channels in 5 GHz where regulations allow
- Enable Fast Roaming (802.11r) for voice clients
- Set appropriate power levels to minimize co-channel interference

### Security Configuration
- Enable AMP (Advanced Malware Protection) on MX appliances
- Configure Content Filtering for appropriate categories
- Use Group Policies for differentiated access
- Enable Intrusion Detection/Prevention on MX
- Configure Geo-IP filtering for known malicious regions
- Set up alerts for security events

## API Usage Guidelines

### Rate Limiting
- Meraki API has a rate limit of 10 requests per second per organization
- Use pagination for large result sets (pageSize parameter)
- Implement exponential backoff for 429 errors
- Cache responses where appropriate

### Authentication
- Use API keys stored securely (never in code)
- Rotate API keys regularly (every 90 days recommended)
- Use read-only keys for monitoring applications
- Audit API key usage via Dashboard

### Common Operations

#### Network Provisioning
1. Create network: POST /organizations/{orgId}/networks
2. Claim devices: POST /networks/{networkId}/devices/claim
3. Configure device: PUT /devices/{serial}
4. Update network settings: PUT /networks/{networkId}

#### Monitoring
- GET /organizations/{orgId}/devices/statuses - All device statuses
- GET /networks/{networkId}/clients - Network clients
- GET /devices/{serial}/lossAndLatencyHistory - Device health
- GET /organizations/{orgId}/uplinksLossAndLatency - WAN health

#### Troubleshooting
- GET /devices/{serial}/liveTools/ping - Ping from device
- GET /devices/{serial}/liveTools/pingDevice - Ping to device
- GET /networks/{networkId}/events - Network events log
- GET /devices/{serial}/switchPorts/statuses - Port statuses

## Meraki Device Types

### MX Security Appliances
- Site-to-site VPN with Auto VPN
- Intrusion Detection/Prevention
- Content Filtering
- Advanced Malware Protection
- SD-WAN capabilities

### MS Switches
- Layer 2 and Layer 3 switching
- PoE and PoE+ support
- Stacking (physical and virtual)
- Access policies and 802.1X

### MR Access Points
- Dual-band (2.4 GHz and 5 GHz)
- MIMO and MU-MIMO
- Bluetooth Low Energy for location
- RF optimization

### MV Cameras
- Cloud-managed security cameras
- Motion search and analytics
- Local storage with cloud sync
- Integration with access control

### MT Sensors
- Environmental monitoring
- Temperature, humidity, door sensors
- Leak detection
- Alert integration

## Troubleshooting Guide

### Connectivity Issues
1. Check device status in Dashboard
2. Verify VLAN configuration
3. Check firewall rules
4. Review event logs
5. Use live tools for diagnosis

### Performance Issues
1. Check client RF health
2. Review channel utilization
3. Check for interference
4. Verify QoS settings
5. Review traffic analytics

### VPN Issues
1. Verify VPN peer configuration
2. Check firewall rules for UDP 500/4500
3. Review NAT settings
4. Check IKE/IPsec parameters
5. Verify routing tables
"""

CATALYST_CENTER_GUIDE = """# Cisco Catalyst Center (DNA Center) Administration Guide

## Overview
Catalyst Center (formerly DNA Center) is Cisco's network management and automation platform for enterprise networks. It provides:
- Network design and provisioning
- Assurance and analytics
- Policy-based automation
- Software image management (SWIM)
- Network security integration

## API Architecture

### Authentication
Catalyst Center uses token-based authentication:
1. POST /dna/system/api/v1/auth/token with Basic Auth
2. Receive X-Auth-Token in response
3. Include token in subsequent requests as X-Auth-Token header
4. Tokens expire after configurable timeout (default 1 hour)

### API Versioning
- Current stable: v2
- Legacy support: v1
- Base URL: https://{dnac-ip}/dna/intent/api/v2/

### Rate Limiting
- Default: 100 requests per minute
- Bulk operations may have lower limits
- Use pagination for large result sets

## Common API Operations

### Device Management

#### Get All Devices
GET /dna/intent/api/v2/network-device
Query Parameters:
- hostname: Filter by hostname
- managementIpAddress: Filter by IP
- family: Filter by device family (Switches, Routers, Wireless Controller)
- type: Filter by device type

#### Get Device Details
GET /dna/intent/api/v2/network-device/{deviceId}

#### Add Device
POST /dna/intent/api/v2/network-device
Body:
{
    "ipAddress": ["10.10.10.1"],
    "snmpVersion": "v3",
    "snmpUserName": "admin",
    "snmpAuthType": "SHA",
    "snmpAuthPassphrase": "password",
    "snmpPrivType": "AES128",
    "snmpPrivPassphrase": "password",
    "cliUserName": "admin",
    "cliPassword": "password",
    "cliEnablePassword": "enable"
}

### Site Hierarchy

#### Get Sites
GET /dna/intent/api/v2/site
Returns site hierarchy (Global > Area > Building > Floor)

#### Create Site
POST /dna/intent/api/v2/site
Body varies by site type (area, building, floor)

### Template Operations

#### Get Templates
GET /dna/intent/api/v2/template-programmer/template

#### Deploy Template
POST /dna/intent/api/v2/template-programmer/template/deploy
Body:
{
    "templateId": "uuid",
    "targetInfo": [{
        "id": "device-uuid",
        "type": "MANAGED_DEVICE_UUID",
        "params": {"key": "value"}
    }]
}

### Software Image Management (SWIM)

#### Get Images
GET /dna/intent/api/v1/image/importation

#### Distribute Image
POST /dna/intent/api/v1/image/distribution

#### Activate Image
POST /dna/intent/api/v1/image/activation/device

### Network Assurance

#### Get Device Health
GET /dna/intent/api/v1/device-health

#### Get Client Health
GET /dna/intent/api/v1/client-health

#### Get Network Health
GET /dna/intent/api/v1/network-health

#### Get Issues
GET /dna/intent/api/v1/issues

## Command Runner

Execute CLI commands on devices:

POST /dna/intent/api/v1/network-device-poller/cli/read-request
Body:
{
    "commands": ["show version", "show ip interface brief"],
    "deviceUuids": ["device-uuid-1", "device-uuid-2"]
}

## Integration Points

### ISE Integration
- pxGrid connection for security policy
- Endpoint profiling data exchange
- SGT (Security Group Tag) synchronization

### Stealthwatch Integration
- Flow data collection
- Encrypted traffic analytics
- Threat intelligence sharing

### ServiceNow Integration
- Incident creation from issues
- Change management workflow
- CMDB synchronization

## Best Practices

### Design Phase
1. Define site hierarchy before adding devices
2. Create IP pools for DHCP automation
3. Establish naming conventions
4. Configure user roles and RBAC

### Day 1 Operations
1. Discovery devices using IP ranges or CDP/LLDP
2. Assign devices to sites
3. Apply network profiles
4. Configure SSIDs for wireless

### Day 2 Operations
1. Monitor health dashboards
2. Address issues proactively
3. Use templates for consistency
4. Maintain software compliance

### Troubleshooting
1. Check task status for async operations
2. Review audit logs for changes
3. Use Path Trace for connectivity issues
4. Leverage AI-driven analytics
"""

ISE_ADMINISTRATION_GUIDE = """# Cisco Identity Services Engine (ISE) Administration Guide

## Overview
Cisco ISE provides identity-based network access control, enabling:
- 802.1X authentication
- MAC Authentication Bypass (MAB)
- Guest access management
- BYOD onboarding
- Profiling and posture assessment
- TrustSec (SGT/SXP)

## API Architecture

### ERS API (External RESTful Services)
Base URL: https://{ise-ip}:9060/ers/config/

Authentication: Basic Auth or token-based
Content-Type: application/json or application/xml

### OpenAPI
Base URL: https://{ise-ip}/api/v1/

Modern REST API with comprehensive coverage

### pxGrid
Real-time context sharing via WebSocket
Used for integration with DNA Center, Stealthwatch, Firepower

## Common API Operations

### Network Access Devices

#### Get All NADs
GET /ers/config/networkdevice

#### Create NAD
POST /ers/config/networkdevice
{
    "NetworkDevice": {
        "name": "Switch-1",
        "description": "Access Switch Floor 1",
        "authenticationSettings": {
            "radiusSharedSecret": "secret",
            "enableKeyWrap": false
        },
        "NetworkDeviceIPList": [{
            "ipaddress": "10.10.10.1",
            "mask": 32
        }],
        "NetworkDeviceGroupList": ["Location#All Locations#Building-1"]
    }
}

### Identity Groups

#### Get Identity Groups
GET /ers/config/identitygroup

#### Create Identity Group
POST /ers/config/identitygroup
{
    "IdentityGroup": {
        "name": "Employees",
        "description": "Corporate Employees",
        "parent": "NAC Group:NAC:IdentityGroups:User Identity Groups"
    }
}

### Guest Users

#### Get Guest Users
GET /ers/config/guestuser

#### Create Guest User
POST /ers/config/guestuser
{
    "GuestUser": {
        "guestType": "Contractor",
        "portalId": "portal-uuid",
        "guestInfo": {
            "userName": "guest001",
            "emailAddress": "guest@example.com",
            "password": "Guest123!",
            "enabled": true
        },
        "guestAccessInfo": {
            "validDays": 7,
            "fromDate": "01/15/2024 08:00",
            "toDate": "01/22/2024 17:00"
        }
    }
}

### Authorization Policies

#### Get Authorization Policies
GET /api/v1/policy/network-access/authorization

#### Get Authorization Profile
GET /ers/config/authorizationprofile

### Endpoints

#### Get Endpoints
GET /ers/config/endpoint

#### Create Endpoint (for MAB)
POST /ers/config/endpoint
{
    "ERSEndPoint": {
        "name": "Device-MAC",
        "mac": "00:11:22:33:44:55",
        "profileId": "profile-uuid",
        "staticProfileAssignment": true,
        "groupId": "endpoint-group-uuid"
    }
}

### Profiling

#### Get Profiler Feed
GET /ers/config/profilerprofile

#### Get Endpoint Profiles
GET /api/v1/endpoint/device-type

## Policy Configuration

### Authentication Policy
1. Define allowed protocols (EAP-TLS, PEAP, EAP-FAST)
2. Configure identity sources (AD, LDAP, Internal)
3. Set authentication conditions
4. Define policy rules priority

### Authorization Policy
1. Create authorization profiles (VLAN, dACL, SGT)
2. Define authorization conditions
3. Map conditions to profiles
4. Handle exceptions and fallback

### Profiling Policy
1. Configure probes (RADIUS, DHCP, DNS, HTTP)
2. Define custom profiles if needed
3. Set endpoint identity groups
4. Enable profiling on PSNs

## Integration Points

### Active Directory
- Join ISE to AD domain
- Configure identity source sequence
- Map AD groups to ISE groups

### Catalyst Center (DNA Center)
- pxGrid integration
- Policy synchronization
- SGT mapping

### Firepower/FTD
- pxGrid for user context
- SGT-based policies
- Threat intelligence

## Best Practices

### Deployment
1. Start with Monitor Mode
2. Enable Low Impact Mode
3. Progress to Closed Mode
4. Document exception processes

### Policy Design
1. Use consistent naming conventions
2. Document all policies
3. Test in lab first
4. Use conditions over device-specific rules

### Scalability
1. Distribute PSNs geographically
2. Use node groups for scale
3. Configure load balancing
4. Monitor node health

### Security
1. Enable certificate-based authentication
2. Rotate shared secrets regularly
3. Audit admin access
4. Enable MnT (Monitoring and Troubleshooting)

## Troubleshooting

### RADIUS Issues
1. Check NAD configuration
2. Verify shared secret
3. Review Live Logs
4. Check policy match

### Authentication Failures
1. Verify identity source
2. Check certificates
3. Review supplicant logs
4. Test with different client

### Authorization Issues
1. Check policy conditions
2. Verify profile settings
3. Review authorization flow
4. Check VLAN/ACL deployment
"""

NETWORK_TROUBLESHOOTING_GUIDE = """# Network Troubleshooting Guide

## Systematic Troubleshooting Methodology

### 1. Define the Problem
- What is the expected behavior?
- What is the actual behavior?
- When did the problem start?
- What changed recently?
- Who/what is affected?

### 2. Gather Information
- Device logs and status
- Network topology
- Configuration changes
- User reports
- Monitoring data

### 3. Analyze Data
- Compare working vs non-working
- Identify patterns
- Check for common causes
- Review documentation

### 4. Test Hypothesis
- Make one change at a time
- Document all changes
- Verify results
- Prepare rollback plan

### 5. Implement Solution
- Apply fix
- Verify resolution
- Document solution
- Update knowledge base

## Layer-by-Layer Troubleshooting

### Layer 1 (Physical)
- Check cable connections
- Verify link lights
- Test with known good cable
- Check SFP/GBIC seating
- Review port errors (CRC, collisions)

Commands:
- show interfaces status
- show interfaces counters errors
- show inventory

### Layer 2 (Data Link)
- Verify VLAN configuration
- Check trunk status
- Review STP state
- Check MAC address table
- Verify port security

Commands:
- show vlan brief
- show interfaces trunk
- show spanning-tree
- show mac address-table
- show port-security

### Layer 3 (Network)
- Verify IP addressing
- Check routing table
- Test connectivity (ping)
- Trace path
- Review ACLs

Commands:
- show ip interface brief
- show ip route
- ping {destination}
- traceroute {destination}
- show access-lists

### Layer 4+ (Transport/Application)
- Check port connectivity
- Verify NAT translations
- Review firewall rules
- Test application response
- Check DNS resolution

Commands:
- show ip nat translations
- show firewall statistics
- nslookup {hostname}
- telnet {ip} {port}

## Common Issues and Solutions

### No Network Connectivity

#### Symptoms
- Cannot ping gateway
- No DHCP address
- Link light off

#### Checks
1. Physical connection
2. VLAN assignment
3. Port status (shutdown/errdisable)
4. DHCP scope availability
5. Gateway reachability

#### Resolution
1. Verify cable/port
2. Check VLAN membership
3. Clear errdisable if applicable
4. Verify DHCP pool
5. Check default gateway

### Slow Network Performance

#### Symptoms
- High latency
- Packet loss
- Slow file transfers

#### Checks
1. Interface utilization
2. Error counters
3. QoS configuration
4. Duplex mismatch
5. Buffer/queue status

#### Resolution
1. Identify bottleneck
2. Fix duplex issues
3. Apply QoS policy
4. Upgrade bandwidth
5. Optimize routing

### Intermittent Connectivity

#### Symptoms
- Random disconnections
- Periodic packet loss
- Timeouts

#### Checks
1. STP topology changes
2. DHCP lease issues
3. ARP table
4. Routing flaps
5. Environmental factors

#### Resolution
1. Stabilize STP
2. Extend DHCP lease
3. Check for duplicate IPs
4. Address routing issues
5. Check power/temperature

### Wireless Issues

#### Symptoms
- Slow wireless speeds
- Authentication failures
- Roaming problems

#### Checks
1. Signal strength
2. Channel utilization
3. Client capabilities
4. Authentication logs
5. AP load

#### Resolution
1. Adjust AP placement/power
2. Change channels
3. Update client drivers
4. Check RADIUS config
5. Load balance clients

## Meraki-Specific Troubleshooting

### Dashboard Connectivity
1. Check WAN uplink
2. Verify DNS resolution (dashboard.meraki.com)
3. Check firewall for outbound 443
4. Review local status page

### VPN Issues
1. Check Auto VPN status
2. Verify concentrator reachability
3. Review VPN peers
4. Check routing advertisement

### Wireless Problems
1. Check RF analytics
2. Review client events
3. Check SSID configuration
4. Verify VLAN assignment

## Catalyst Center Troubleshooting

### Device Reachability
1. Check management IP
2. Verify SNMP credentials
3. Check SSH/Telnet access
4. Review discovery status

### Provisioning Failures
1. Check task status
2. Review configuration diff
3. Verify template syntax
4. Check device compatibility

### Assurance Issues
1. Verify data collection
2. Check NetFlow/sFlow
3. Review sensor status
4. Check time synchronization
"""

SD_WAN_GUIDE = """# SD-WAN Implementation Guide

## Meraki SD-WAN Overview

Meraki SD-WAN provides:
- Auto VPN for simplified site-to-site connectivity
- Intelligent path selection
- Application-aware routing
- Cloud-managed configuration

### Auto VPN Configuration

#### Hub-and-Spoke Topology
1. Configure MX at headquarters as VPN concentrator
2. Set hub priority (primary/secondary)
3. Enable Auto VPN on spoke sites
4. Configure VPN subnet advertisement

#### Full Mesh Topology
1. Enable Auto VPN on all sites
2. Set all sites as equal peers
3. Configure direct tunnel policy
4. Optimize for latency or bandwidth

### Traffic Shaping

#### Global Bandwidth Limits
- Set per-SSID limits for wireless
- Configure per-client limits
- Enable SpeedBurst for initial boost

#### Application-Based Shaping
1. Define application categories
2. Set bandwidth allocation per category
3. Configure quality guarantees
4. Enable application prioritization

### Performance Classes

#### Real-Time (Voice/Video)
- Maximum jitter: 30ms
- Maximum latency: 150ms
- Packet loss: <1%

#### Interactive (Business Apps)
- Maximum latency: 200ms
- Packet loss: <2%

#### Bulk (Backups, Updates)
- Best effort delivery
- Use remaining bandwidth

### Uplink Selection

#### Load Balancing
- Round-robin for stateless traffic
- Sticky sessions for stateful
- Bandwidth-based distribution

#### Failover
- Primary/Secondary designation
- Health check configuration
- Automatic failback

### Flow Preferences

Configure application routing:
1. Define flow preference rules
2. Specify application or category
3. Set preferred uplink
4. Configure failover behavior

## Catalyst SD-WAN (Viptela)

### Architecture Components
- vManage: Management and orchestration
- vSmart: Central controller
- vBond: Orchestrator for initial device connection
- vEdge/cEdge: Edge routers

### Policy Types

#### Centralized Policy
- Applied on vSmart
- Affects routing decisions
- Data plane policies

#### Localized Policy
- Applied on edge devices
- QoS and ACL
- Routing protocol parameters

### Common Configurations

#### OMP (Overlay Management Protocol)
- Automatic route advertisement
- Path selection criteria
- Graceful restart settings

#### BFD (Bidirectional Forwarding Detection)
- Fast failure detection
- Configurable intervals
- Per-tunnel or per-session

#### Application-Aware Routing
1. Define SLA classes
2. Set latency/loss/jitter thresholds
3. Configure fallback behavior
4. Monitor application performance

## Best Practices

### Design
1. Plan topology before deployment
2. Size links for peak traffic + growth
3. Consider application requirements
4. Plan for redundancy

### Security
1. Encrypt all overlay traffic
2. Segment sensitive applications
3. Integrate with security tools
4. Monitor for anomalies

### Operations
1. Monitor path performance
2. Review analytics regularly
3. Test failover scenarios
4. Keep firmware current
"""


async def ingest_documentation(openai_key: str):
    """Ingest all documentation into the knowledge base."""

    # Set up embedding service with provided key
    os.environ["OPENAI_API_KEY"] = openai_key

    embedding_service = EmbeddingService(api_key=openai_key)
    ingestion_service = DocumentIngestionService(embedding_service=embedding_service)

    db = get_db()

    documents_to_ingest = [
        {
            "content": MERAKI_BEST_PRACTICES,
            "filename": "meraki_best_practices.md",
            "doc_type": "guide",
            "product": "meraki",
            "title": "Meraki Dashboard Best Practices Guide",
            "description": "Comprehensive guide for Meraki network design, security, API usage, and troubleshooting"
        },
        {
            "content": CATALYST_CENTER_GUIDE,
            "filename": "catalyst_center_guide.md",
            "doc_type": "guide",
            "product": "catalyst",
            "title": "Cisco Catalyst Center Administration Guide",
            "description": "Guide for Catalyst Center (DNA Center) API operations, device management, and automation"
        },
        {
            "content": ISE_ADMINISTRATION_GUIDE,
            "filename": "ise_administration_guide.md",
            "doc_type": "guide",
            "product": "ise",
            "title": "Cisco ISE Administration Guide",
            "description": "Comprehensive guide for ISE deployment, policy configuration, and API operations"
        },
        {
            "content": NETWORK_TROUBLESHOOTING_GUIDE,
            "filename": "network_troubleshooting_guide.md",
            "doc_type": "guide",
            "product": "general",
            "title": "Network Troubleshooting Guide",
            "description": "Systematic troubleshooting methodology and layer-by-layer diagnostics"
        },
        {
            "content": SD_WAN_GUIDE,
            "filename": "sd_wan_guide.md",
            "doc_type": "guide",
            "product": "general",
            "title": "SD-WAN Implementation Guide",
            "description": "Guide for Meraki SD-WAN and Catalyst SD-WAN implementation"
        }
    ]

    async with db.session() as session:
        logger.info("=" * 60)
        logger.info("STARTING KNOWLEDGE BASE INGESTION")
        logger.info("=" * 60)

        # Ingest markdown documentation
        for doc_info in documents_to_ingest:
            try:
                logger.info(f"\nIngesting: {doc_info['filename']}")
                document = await ingestion_service.ingest_markdown_document(
                    session=session,
                    content=doc_info["content"],
                    filename=doc_info["filename"],
                    doc_type=doc_info["doc_type"],
                    product=doc_info["product"],
                    title=doc_info["title"],
                    description=doc_info["description"]
                )
                logger.info(f"  ✓ Created {document.total_chunks} chunks")
            except Exception as e:
                logger.error(f"  ✗ Failed: {e}")

        # Ingest Meraki OpenAPI spec
        meraki_spec_path = "./openapi_specs/meraki_dashboard.json"
        if Path(meraki_spec_path).exists():
            try:
                logger.info(f"\nIngesting: Meraki Dashboard OpenAPI Spec")
                document = await ingestion_service.ingest_openapi_spec(
                    session=session,
                    spec_path=meraki_spec_path,
                    product="meraki",
                    version="1.0"
                )
                logger.info(f"  ✓ Created {document.total_chunks} chunks from API endpoints")
            except Exception as e:
                logger.error(f"  ✗ Failed to ingest OpenAPI spec: {e}")
        else:
            logger.warning(f"  ! Meraki OpenAPI spec not found at {meraki_spec_path}")

        logger.info("\n" + "=" * 60)
        logger.info("INGESTION COMPLETE")
        logger.info("=" * 60)

        # Show summary
        from sqlalchemy import text
        result = await session.execute(text("""
            SELECT
                product,
                doc_type,
                COUNT(*) as doc_count,
                SUM(total_chunks) as total_chunks
            FROM knowledge_documents
            GROUP BY product, doc_type
            ORDER BY product, doc_type
        """))

        rows = result.fetchall()
        if rows:
            logger.info("\nKnowledge Base Summary:")
            logger.info("-" * 50)
            for row in rows:
                logger.info(f"  {row[0]:15} | {row[1]:15} | {row[2]:3} docs | {row[3]:5} chunks")

        # Total stats
        result = await session.execute(text("""
            SELECT COUNT(*) as docs, COALESCE(SUM(total_chunks), 0) as chunks
            FROM knowledge_documents
        """))
        totals = result.fetchone()
        logger.info("-" * 50)
        logger.info(f"  Total: {totals[0]} documents, {totals[1]} chunks")


async def get_openai_key_from_admin_user():
    """Try to get OpenAI key from admin user's encrypted storage."""
    try:
        from sqlalchemy import select, text
        from cryptography.fernet import Fernet
        from src.config.settings import get_settings

        db = get_db()
        settings = get_settings()

        async with db.session() as session:
            # Get admin user's encrypted OpenAI key
            result = await session.execute(
                text("SELECT user_openai_api_key FROM users WHERE username = 'admin' AND user_openai_api_key IS NOT NULL")
            )
            row = result.fetchone()

            if row and row[0]:
                # Decrypt the key
                encryption_key = settings.get_encryption_key()
                cipher = Fernet(encryption_key)
                decrypted_key = cipher.decrypt(row[0].encode()).decode()
                return decrypted_key
    except Exception as e:
        logger.warning(f"Could not get OpenAI key from admin user: {e}")

    return None


async def main():
    parser = argparse.ArgumentParser(description="Ingest Cisco documentation into RAG knowledge base")
    parser.add_argument("--openai-key", help="OpenAI API key for embeddings")
    args = parser.parse_args()

    # Try to get OpenAI key from various sources
    openai_key = args.openai_key or os.getenv("OPENAI_API_KEY")

    if not openai_key:
        # Try to get from system_config table
        try:
            from src.services.config_service import get_effective_config
            openai_key = get_effective_config("openai_api_key")
        except Exception:
            pass

    if not openai_key:
        # Try to get from admin user's encrypted key
        logger.info("Checking admin user for OpenAI API key...")
        openai_key = await get_openai_key_from_admin_user()

    if not openai_key:
        print("ERROR: OpenAI API key required for generating embeddings.")
        print("\nProvide it via one of:")
        print("  1. --openai-key argument")
        print("  2. OPENAI_API_KEY environment variable")
        print("  3. Configure in System Settings UI")
        print("  4. User's AI Settings (stores encrypted key for admin user)")
        sys.exit(1)

    await ingest_documentation(openai_key)


if __name__ == "__main__":
    asyncio.run(main())
