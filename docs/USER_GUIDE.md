# Lumen User Guide

Welcome to **Lumen** - an AI-powered network intelligence platform for monitoring, analyzing, and managing your network infrastructure. Lumen integrates with Cisco Meraki, Splunk, ThousandEyes, and Catalyst Center to provide unified visibility, intelligent incident correlation, and automated workflows.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Chat & AI Features](#chat--ai-features)
4. [Network Management](#network-management)
5. [Topology Visualizations](#topology-visualizations)
6. [Incident Management](#incident-management)
7. [Workflow Automation](#workflow-automation)
8. [Canvas](#canvas)
9. [Knowledge Base](#knowledge-base)
10. [Security Monitoring](#security-monitoring)
11. [Splunk Integration](#splunk-integration)
12. [ThousandEyes Integration](#thousandeyes-integration)
13. [Cost Management](#cost-management)
14. [Audit & Compliance](#audit--compliance)
15. [Health Monitoring](#health-monitoring)
16. [Admin Settings](#admin-settings)
17. [User Management & RBAC](#user-management--rbac)
18. [Licenses](#licenses)
19. [API Reference](#api-reference)
20. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Initial Setup

When you first access Lumen, you'll be guided through the setup wizard at `/setup`:

1. **Welcome Screen**: Overview of Lumen's capabilities
2. **Meraki Configuration**: Enter your Meraki Dashboard API key
   - API keys are generated in the Meraki Dashboard under **Organization > API & Webhooks**
   - The key requires organization-level read access at minimum
3. **Organization Selection**: Choose which Meraki organizations to monitor
4. **Optional Integrations**: Configure additional services:
   - **Splunk**: For security event correlation and log analysis
   - **ThousandEyes**: For internet and cloud path monitoring
   - **Catalyst Center**: For campus network management
5. **Admin Account**: Create your first administrator account
6. **AI Configuration**: Select your preferred AI model (Claude, OpenAI, or local)

### Authentication

Lumen uses secure session-based authentication:

- **Login**: Navigate to `/login` and enter your credentials
- **Session Duration**: Sessions persist across browser restarts
- **Multi-Factor Authentication**: Optional Duo MFA integration available
- **Password Requirements**: Minimum 8 characters with complexity requirements

### First-Time Navigation

After logging in, you'll see:
- **Left Sidebar**: Navigation menu with all major sections
- **Top Bar**: Search, notifications, user profile, and AI session toggle
- **Main Content Area**: Dashboard by default

---

## Dashboard

The main dashboard (`/`) provides an at-a-glance view of your entire network infrastructure.

### Dashboard Widgets

#### Network Health Card
- **Online/Offline Counts**: Real-time device status across all organizations
- **Status Indicators**: Color-coded health (green/yellow/red)
- **Quick Stats**: Total devices, networks, and organizations

#### Recent Incidents Card
- **Active Incidents**: Unresolved issues requiring attention
- **Severity Levels**: Critical, High, Medium, Low indicators
- **Quick Links**: Click to view incident details

#### AI Session Status
- **Active Session**: Shows if an AI analysis session is running
- **Token Usage**: Current session token consumption
- **Cost Tracking**: Estimated cost for the current session

#### Active Automations Widget
- **Running Workflows**: List of enabled workflow automations
- **Trigger Types**: Schedule, Event, or Manual triggers
- **Recent Executions**: Last 5 workflow runs with status
- **Quick Access**: Link to workflow management page

#### Security Overview
- **Threat Alerts**: Recent security events from Splunk
- **Client Health**: Anomalous client behavior detection
- **Configuration Risks**: Identified security misconfigurations

### Dashboard Actions
- **Global Search**: Search devices, networks, incidents, and knowledge base
- **Refresh**: Manually refresh all dashboard data
- **Export**: Download dashboard data as JSON or CSV

---

## Chat & AI Features

Lumen's AI-powered chat interface provides natural language interaction with your network infrastructure.

### Accessing Chat

The chat interface is available from multiple locations:
- **Main Chat Page** (`/chat`): Full-screen chat experience
- **Floating Chat Widget**: Available on all pages via the chat icon
- **Device Context**: Right-click any device for contextual AI analysis

### Chat Capabilities

#### Network Queries
Ask questions about your network in natural language:
- "What devices are offline right now?"
- "Show me the top 10 clients by bandwidth usage"
- "Which access points have the most client connections?"
- "List all VLANs configured on the Downtown network"

#### Troubleshooting Assistance
Get AI-powered troubleshooting help:
- "Why is the MX68 at Branch Office showing high latency?"
- "Help me troubleshoot intermittent connectivity on VLAN 100"
- "What could cause the switch port Gi1/0/24 to go down repeatedly?"

#### Configuration Recommendations
Receive best-practice guidance:
- "What are the recommended security settings for guest WiFi?"
- "Should I enable STP on this switch topology?"
- "How should I configure QoS for voice traffic?"

#### Security Analysis
Analyze security posture:
- "Are there any suspicious login attempts in the last 24 hours?"
- "Show me clients with unusual traffic patterns"
- "What firewall rules are allowing traffic from untrusted sources?"

### AI Session Management

#### Session Context
AI sessions maintain context across conversations:
- **Conversation History**: Previous questions and answers are remembered
- **Network State**: Point-in-time snapshots of network data
- **Investigation Continuity**: Multi-step troubleshooting maintains context

#### Starting a New Session
Click the "New Session" button to:
- Clear conversation history
- Reset context for a fresh start
- Optionally preserve key findings

#### Session Summary
At any time, request a session summary:
- Key findings and insights
- Actions taken during the session
- Recommendations for follow-up

### Live Data Cards

The AI can present real-time data in visual cards:

#### Device Cards
- Device status and uptime
- Interface utilization
- Client connections
- Recent alerts

#### Network Cards
- VLAN configuration maps
- Routing tables
- Traffic statistics
- Health scores

#### Security Cards
- Threat intelligence summaries
- Compliance status
- Vulnerability assessments

### AI Models

Lumen supports multiple AI providers:
- **Claude (Anthropic)**: Default, excellent for technical analysis
- **OpenAI GPT-4**: Alternative with strong reasoning
- **Local Models**: Ollama integration for air-gapped environments

Configure AI preferences in **Admin > AI Settings**.

---

## Network Management

### Networks Page (`/networks`)

The Networks page provides comprehensive network management capabilities.

#### Network List View
- **Organization Grouping**: Networks organized by Meraki organization
- **Search & Filter**: Find networks by name, type, or tags
- **Status Indicators**: Real-time health status per network
- **Quick Stats**: Device counts, client counts per network

#### Network Details
Click any network to view:
- **Overview Tab**: General information, tags, timezone
- **Devices Tab**: All devices in the network with status
- **Clients Tab**: Connected clients with details
- **Topology Tab**: Visual network topology
- **Settings Tab**: Network configuration

#### Network Actions
- **Refresh**: Update network data from Meraki
- **Export Clients**: Download client list as CSV
- **AI Analysis**: Request AI analysis of network health

### Network Page (`/network`)

The single network view provides detailed device management.

#### Device Inventory
- **Device List**: All devices with model, serial, status
- **Filtering**: By device type (MX, MS, MR, MV, etc.)
- **Sorting**: By name, status, last seen, model
- **Selection**: Multi-select for bulk actions

#### Device Details Panel
Select a device to view:
- **General Info**: Model, serial, MAC, firmware
- **Status**: Online/offline, last check-in time
- **Interfaces**: Port status and utilization
- **Clients**: Connected clients (for APs and switches)
- **Alerts**: Recent device-specific alerts

#### Device Actions
- **Reboot**: Restart the device (requires admin)
- **Blink LED**: Locate device physically
- **AI Analyze**: Deep AI analysis of device health
- **View in Meraki**: Open device in Meraki Dashboard

### Wireless Management

#### Access Point Details
- **Radio Information**: 2.4GHz and 5GHz/6GHz band status
- **Channel & Power**: Current settings and recommendations
- **Client Distribution**: Clients per radio band
- **RF Environment**: Interference and utilization

#### SSID Management
- **Active SSIDs**: List of enabled SSIDs per network
- **Client Counts**: Connections per SSID
- **Security Settings**: Authentication type per SSID

---

## Topology Visualizations

Lumen provides interactive network topology visualizations.

### Visualizations Page (`/visualizations`)

#### Organization Topology
View the hub-spoke VPN topology across your organization:
- **Hub Sites**: Central MX appliances
- **Spoke Sites**: Branch office connections
- **VPN Status**: Real-time tunnel status
- **Traffic Flows**: Inter-site traffic visualization

#### Network Topology
Detailed topology for individual networks:
- **Hierarchical Layout**: Gateway > Switches > APs > Clients
- **Device Icons**: Type-specific icons with status colors
- **Connection Lines**: Physical and logical connections
- **Interactive**: Click, drag, zoom, and pan

### Topology Features

#### Navigation
- **Zoom**: Mouse wheel or buttons to zoom in/out
- **Pan**: Click and drag to move the view
- **Fit View**: Button to fit all devices in viewport
- **Layout**: Switch between hierarchical, radial, or force-directed

#### Device Interaction
- **Hover**: Show device tooltip with key info
- **Click**: Select device to show details panel
- **Right-Click**: Context menu with actions
- **Double-Click**: Focus and zoom on device

#### Visual Indicators
- **Green**: Device online and healthy
- **Yellow**: Device alerting or degraded
- **Red**: Device offline or critical
- **Gray**: Device status unknown
- **Pulsing**: Active incident affecting device

#### Filtering
- **Device Types**: Show/hide specific device types
- **Status Filter**: Show only offline or alerting devices
- **Search**: Highlight devices matching search term

### Performance Topology

View performance overlays on the topology:
- **Latency Heat Map**: Color-coded latency between devices
- **Utilization**: Interface utilization percentages
- **Packet Loss**: Loss indicators on connections

---

## Incident Management

The Incidents page (`/incidents`) provides centralized incident tracking and correlation.

### Incident List

#### Viewing Incidents
- **Status Tabs**: Open, Investigating, Resolved, All
- **Severity Filters**: Critical, High, Medium, Low
- **Time Range**: Filter by incident start time
- **Source Filter**: Meraki, Splunk, ThousandEyes, Workflow

#### Incident Cards
Each incident displays:
- **Title**: AI-generated descriptive title
- **Severity**: Color-coded severity indicator
- **Status**: Current investigation status
- **Affected**: Devices, networks, or users impacted
- **Timeline**: Start time and duration
- **Source**: Integration that detected the issue

### Incident Details

Click an incident to view full details:

#### Summary Section
- **Root Cause Analysis**: AI-determined likely cause
- **Impact Assessment**: Scope of affected resources
- **Recommended Actions**: AI-suggested remediation steps

#### Timeline
Chronological event timeline:
- Detection time and source
- Related events correlated together
- Status changes and updates
- Resolution details

#### Affected Resources
- Devices directly impacted
- Networks affected
- Users/clients impacted
- Services degraded

#### AI Analysis
- Detailed technical analysis
- Similar past incidents
- Prevention recommendations
- Confidence score for root cause

### Incident Correlation

Lumen correlates events from multiple sources into unified incidents.

#### Correlation Sources
- **Meraki Alerts**: Device status changes, connectivity issues
- **Splunk Events**: Security alerts, log anomalies
- **ThousandEyes**: Internet path failures, SaaS outages
- **Workflow Actions**: Automated monitoring detections

#### Correlation Settings
Access correlation settings from the gear icon:

- **Auto-Correlation**: Enable/disable automatic correlation
- **Correlation Interval**: How often to run correlation
  - Off (manual only)
  - Every 5 minutes
  - Every 30 minutes
  - Every hour
  - Every 2 hours
  - Every 3 hours
- **Manual Refresh**: Click "Refresh & Correlate" button

#### How Correlation Works
1. **Event Collection**: Gather events from all configured sources
2. **Time Windowing**: Group events within correlation windows
3. **Entity Matching**: Match events affecting same devices/networks
4. **AI Analysis**: Use AI to determine relationships and root cause
5. **Incident Creation**: Create or update incidents with findings

### Incident Actions

#### Status Updates
- **Acknowledge**: Mark as being investigated
- **Resolve**: Close the incident with resolution notes
- **Escalate**: Increase severity and notify stakeholders

#### AI Actions
- **Analyze**: Request detailed AI analysis
- **Suggest Actions**: Get remediation recommendations
- **Find Similar**: Search for similar past incidents

---

## Workflow Automation

The Workflows page (`/workflows`) enables automated network operations.

### Workflow Canvas

The visual workflow builder uses a drag-and-drop canvas:

#### Node Types

**Trigger Nodes** (Start workflows)
- **Schedule**: Run at specified intervals (5min, hourly, daily, etc.)
- **Event**: Triggered by network events (device down, alert, etc.)
- **Manual**: Start manually from UI or API

**Action Nodes** (Perform operations)
- **Monitor Network Health**: Check overall network status
- **Monitor Device Status**: Check specific device health
- **Send Notification**: Send email, Slack, or webhook notifications
- **Create Incident**: Generate an incident in Lumen
- **Run API Call**: Execute custom Meraki API operations
- **Execute Script**: Run custom Python scripts

**AI Nodes** (Intelligent decisions)
- **AI Analysis**: Analyze data with AI and make decisions
- **Confidence Threshold**: Branch based on AI confidence level
- **Custom Prompt**: Run custom AI prompts

**Logic Nodes** (Control flow)
- **Condition**: Branch based on data values
- **Delay**: Wait specified time before continuing
- **Loop**: Iterate over collections

#### Building Workflows

1. **Create New**: Click "New Workflow" button
2. **Add Trigger**: Drag a trigger node to the canvas
3. **Add Actions**: Connect action nodes to the trigger
4. **Configure Nodes**: Click nodes to set parameters
5. **Add Conditions**: Use condition nodes for branching logic
6. **Save**: Click "Save" to store the workflow

#### Workflow Connections
- **Drag from Output**: Pull connection from node output port
- **Connect to Input**: Drop connection on target node input
- **Multiple Outputs**: Condition nodes have true/false outputs
- **Multiple Inputs**: Nodes can receive from multiple sources

### Workflow Management

#### Workflow List
- **Name**: Workflow identifier
- **Status**: Active, Paused, or Draft
- **Trigger Type**: Schedule, Event, or Manual
- **Last Run**: Most recent execution time
- **Next Run**: Scheduled next execution

#### Workflow Actions
- **Enable/Disable**: Toggle workflow active state
- **Run Now**: Manually trigger the workflow
- **Edit**: Open in canvas editor
- **Duplicate**: Create a copy of the workflow
- **Delete**: Remove the workflow

### Workflow Execution

#### Execution History
View past workflow runs:
- **Start Time**: When execution began
- **Duration**: How long it took
- **Status**: Success, Failed, or Running
- **Nodes Executed**: Which nodes ran

#### Execution Details
Click an execution to view:
- **Node-by-Node Results**: Output from each node
- **Error Messages**: Details if workflow failed
- **Data Flow**: Data passed between nodes
- **AI Decisions**: AI node reasoning and confidence

### Example Workflows

#### Device Health Monitor
```
Schedule (5min) → Monitor Device Status → Condition (offline?)
    → [Yes] → AI Analysis → Create Incident
    → [No] → End
```

#### Security Alert Handler
```
Event (Splunk Alert) → AI Analysis → Condition (confidence > 70%?)
    → [Yes] → Create Incident → Send Notification
    → [No] → Log Event → End
```

#### Daily Health Report
```
Schedule (Daily 8am) → Monitor Network Health → AI Analysis
    → Generate Report → Send Email
```

---

## Canvas

The Canvas page (`/canvas`) provides a free-form diagramming and documentation space.

### Canvas Features

#### Drawing Tools
- **Shapes**: Rectangles, circles, diamonds
- **Connections**: Lines and arrows between shapes
- **Text**: Labels and annotations
- **Images**: Upload and place images
- **Icons**: Network device icons

#### Canvas Operations
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Space + drag to pan the view
- **Select**: Click to select, Shift+click for multi-select
- **Group**: Select multiple and group together
- **Align**: Alignment tools for precise positioning

### Canvas Modes

#### Diagram Mode
Create network diagrams:
- Import topology from Meraki
- Add custom annotations
- Document network architecture
- Export as PNG or SVG

#### Whiteboard Mode
Collaborative planning:
- Freeform drawing
- Sticky notes
- Real-time collaboration (if enabled)

### Saving Canvases
- **Auto-Save**: Changes saved automatically
- **Named Canvases**: Create multiple named canvases
- **Export**: Download canvas as image or JSON
- **Share**: Generate shareable links (admin permission required)

---

## Knowledge Base

The Knowledge Base (`/knowledge`) provides AI-enhanced documentation search.

### Document Management

#### Uploading Documents
1. Click "Upload" button
2. Select files (PDF, Word, Markdown, Text)
3. Documents are processed and indexed automatically
4. Wait for "Processing Complete" status

#### Supported Formats
- **PDF**: Technical datasheets, manuals
- **Word**: .docx and .doc files
- **Markdown**: .md files
- **Text**: .txt files
- **HTML**: Web pages (via URL)

#### Document Library
- **Search**: Full-text search across all documents
- **Filter**: By type, upload date, category
- **Preview**: Quick preview without download
- **Download**: Retrieve original document

### RAG-Powered Search

The knowledge base uses Retrieval Augmented Generation (RAG):

#### How It Works
1. **Query**: Enter a natural language question
2. **Retrieval**: System finds relevant document chunks
3. **Augmentation**: AI uses retrieved context
4. **Generation**: AI generates answer with citations

#### Search Features
- **Semantic Search**: Understands meaning, not just keywords
- **Multi-Document**: Searches across all uploaded documents
- **Citations**: Shows which documents informed the answer
- **Confidence**: Indicates answer reliability

### Knowledge Categories

Organize documents by category:
- **Product Datasheets**: Hardware specifications
- **Configuration Guides**: Setup instructions
- **Best Practices**: Recommended configurations
- **Troubleshooting**: Common issues and solutions
- **Policies**: Network and security policies

### Knowledge Analytics

View usage statistics:
- **Popular Queries**: Most searched topics
- **Document Usage**: Which documents are referenced most
- **Query Success Rate**: How often queries find useful results
- **Feedback**: User ratings of answers

---

## Security Monitoring

The Security page (`/security`) provides security posture visibility.

### Security Dashboard

#### Threat Overview
- **Active Threats**: Current security incidents
- **Threat Trends**: Chart of threats over time
- **Severity Distribution**: Breakdown by severity level

#### Client Security
- **Suspicious Clients**: Clients with anomalous behavior
- **Blocked Clients**: Clients denied access
- **Quarantined Clients**: Clients isolated for investigation

### Security Features

#### Intrusion Detection
View IDS/IPS events from Meraki MX:
- **Event Type**: Attack signature matched
- **Source/Destination**: Traffic endpoints
- **Action Taken**: Blocked or alerted
- **Severity**: Threat severity level

#### Content Filtering
Monitor content filtering activity:
- **Blocked Categories**: Web categories being blocked
- **Top Blocked Sites**: Most frequently blocked URLs
- **User Activity**: Which users trigger blocks

#### Malware Detection
Track malware events:
- **Files Scanned**: Total files analyzed
- **Malware Detected**: Malicious files found
- **Action Taken**: Blocked, quarantined, or logged

### Security Reports

Generate security reports:
- **Executive Summary**: High-level security posture
- **Detailed Events**: All security events in period
- **Compliance**: Compliance status against frameworks
- **Recommendations**: AI-generated security improvements

---

## Splunk Integration

The Splunk page (`/splunk`) provides deep integration with Splunk Enterprise or Splunk Cloud.

### Configuration

Configure Splunk in Admin Settings:
- **Splunk URL**: Your Splunk instance URL
- **Authentication**: Username/password or API token
- **SSL Verification**: Enable/disable certificate verification
- **Index**: Default index to search

### Splunk Features

#### Alert Integration
- **Incoming Alerts**: Splunk alerts pushed to Lumen
- **Alert Correlation**: Splunk alerts correlated with network events
- **Custom Searches**: Run ad-hoc Splunk searches

#### Log Analysis
- **Recent Logs**: View recent log entries
- **Search**: Run custom SPL queries
- **Visualizations**: Charts and tables from search results

#### Event Correlation
Correlate Splunk events with network data:
- **IP Matching**: Match log IPs to Meraki clients
- **Timeline**: Combined timeline of network and log events
- **Root Cause**: AI analysis combining both sources

### Splunk Insights

AI-powered insights from Splunk data:
- **Anomaly Detection**: Unusual patterns in logs
- **Security Insights**: Potential security issues
- **Performance Insights**: Performance-related log patterns

---

## ThousandEyes Integration

The ThousandEyes page (`/thousandeyes`) provides internet and cloud monitoring visibility.

### Configuration

Configure ThousandEyes in Admin Settings:
- **API Token**: Your ThousandEyes API token
- **Account Group**: Optional account group filter

### ThousandEyes Features

#### Agent Status
View Enterprise Agent health:
- **Agent List**: All agents with status
- **Connectivity**: Agent connectivity status
- **Tests Assigned**: Tests running on each agent

#### Test Results
Monitor test performance:
- **HTTP Tests**: Web server monitoring
- **Network Tests**: Latency, loss, jitter
- **DNS Tests**: DNS resolution monitoring
- **Path Visualization**: Network path analysis

#### Outage Detection
Track internet and SaaS outages:
- **Active Outages**: Current detected outages
- **Affected Services**: Which services are impacted
- **Impact Assessment**: How outages affect your network

### ThousandEyes Correlation

Correlate ThousandEyes with network data:
- **Path Issues**: Match path problems to network topology
- **Service Impact**: Understand how outages affect users
- **Root Cause**: Determine if issues are internal or external

---

## Cost Management

The Costs page (`/costs`) tracks AI usage and costs across the platform.

### Cost Dashboard

#### Usage Summary
- **Total Tokens**: Tokens consumed in period
- **Total Cost**: Estimated cost in period
- **By Model**: Breakdown by AI model used
- **By Feature**: Breakdown by feature (chat, analysis, etc.)

#### Cost Trends
- **Daily Usage**: Chart of daily token consumption
- **Cost Projection**: Estimated monthly cost
- **Budget Alerts**: Warnings when approaching limits

### Cost Details

#### Session Costs
View costs by AI session:
- **Session ID**: Unique session identifier
- **Duration**: Session length
- **Tokens Used**: Input and output tokens
- **Cost**: Estimated cost for session

#### Feature Costs
View costs by feature:
- **Chat**: Conversational AI costs
- **Analysis**: Device and network analysis
- **Incidents**: Incident correlation and analysis
- **Workflows**: Workflow AI node costs
- **Knowledge**: RAG query costs

### Cost Controls

#### Budget Settings
- **Monthly Budget**: Set spending limits
- **Alert Thresholds**: Get notified at percentages
- **Auto-Pause**: Optionally pause AI at limit

#### Optimization Tips
- Use appropriate AI models for tasks
- Leverage caching for repeated queries
- Batch similar analyses together

---

## Audit & Compliance

The Audit page (`/audit`) provides comprehensive audit logging for compliance.

### Audit Log

#### Viewing Logs
- **Time Range**: Filter by date/time
- **Action Type**: Filter by action category
- **User**: Filter by user who performed action
- **Resource**: Filter by affected resource

#### Log Entry Details
Each log entry shows:
- **Timestamp**: When the action occurred
- **User**: Who performed the action
- **Action**: What was done
- **Resource**: What was affected
- **Details**: Additional context
- **IP Address**: Source IP of the action
- **User Agent**: Browser/client information

### Audit Categories

#### Authentication Events
- Login attempts (success/failure)
- Logout events
- Password changes
- MFA events

#### Configuration Changes
- Settings modifications
- Integration credential changes
- User permission changes
- Workflow modifications

#### Data Access
- Network data queries
- Report generation
- Data exports
- API access

#### Administrative Actions
- User creation/deletion
- Role assignments
- System configuration changes

### Compliance Features

#### Export
- **CSV Export**: Download logs as CSV
- **JSON Export**: Download logs as JSON
- **Date Range**: Specify export period

#### Retention
- **Retention Period**: Configurable log retention
- **Archival**: Option to archive old logs

---

## Health Monitoring

The Health page (`/health`) provides system health visibility.

### System Health

#### Service Status
Monitor Lumen component health:
- **API Server**: Backend API status
- **Database**: PostgreSQL connection status
- **Redis Cache**: Cache connectivity
- **Background Jobs**: Scheduler status

#### Integration Health
Monitor external service connectivity:
- **Meraki API**: Connection status and rate limits
- **Splunk**: Connection and authentication status
- **ThousandEyes**: API connectivity status
- **AI Provider**: AI service availability

### Health Checks

#### Automatic Checks
- Health checks run every 60 seconds
- Status history maintained for trending
- Alerts generated on status changes

#### Manual Checks
- Click "Check Now" to run immediate health check
- View detailed response from each service
- Test individual integrations

### Health Metrics

#### Response Times
- API response time trends
- Database query performance
- External API latency

#### Resource Usage
- Memory utilization
- CPU usage
- Active connections

---

## Admin Settings

The Admin page (`/admin`) provides system configuration for administrators.

### Integration Settings

#### Meraki Configuration
- **API Key**: Meraki Dashboard API key
- **Organizations**: Select organizations to monitor
- **Rate Limiting**: Configure API rate limits
- **SSL Verification**: Enable/disable certificate verification

#### Splunk Configuration
- **URL**: Splunk instance URL
- **Authentication**: Username/password or token
- **Index**: Default search index
- **SSL Verification**: Certificate verification setting

#### ThousandEyes Configuration
- **API Token**: ThousandEyes API bearer token
- **Account Group**: Optional account group filter

#### Catalyst Center Configuration
- **URL**: Catalyst Center instance URL
- **Username**: API username
- **Password**: API password
- **SSL Verification**: Certificate verification setting

### AI Settings

#### Model Selection
- **Primary Model**: Default AI model for all features
- **Chat Model**: Model for conversational AI
- **Analysis Model**: Model for deep analysis tasks

#### Provider Configuration
- **Anthropic (Claude)**: API key and model selection
- **OpenAI**: API key and model selection
- **Ollama (Local)**: URL for local model server

#### Cost Controls
- **Budget Limits**: Monthly spending caps
- **Usage Alerts**: Notification thresholds

### System Settings

#### Authentication
- **Session Timeout**: Idle session expiration
- **Password Policy**: Complexity requirements
- **MFA Settings**: Duo MFA configuration

#### Notifications
- **Email Settings**: SMTP configuration
- **Slack Integration**: Webhook URL
- **Webhook Endpoints**: Custom notification endpoints

#### Maintenance
- **Database Backup**: Manual backup trigger
- **Cache Clear**: Clear Redis cache
- **Log Level**: Adjust logging verbosity

---

## User Management & RBAC

### User Management

#### Viewing Users
Navigate to Admin > Users to see:
- **User List**: All system users
- **Status**: Active/inactive status
- **Role**: Assigned role
- **Last Login**: Most recent login time

#### Creating Users
1. Click "Add User"
2. Enter email address
3. Set temporary password
4. Assign role
5. User receives welcome email

#### User Actions
- **Edit**: Modify user details
- **Reset Password**: Force password reset
- **Disable**: Deactivate user account
- **Delete**: Remove user (admin only)

### Role-Based Access Control (RBAC)

#### Built-in Roles

**Admin**
- Full system access
- User management
- Integration configuration
- All read/write operations

**Operator**
- Network management
- Incident management
- Workflow management
- No admin settings access

**Viewer**
- Read-only access to dashboards
- View incidents and reports
- No configuration changes

#### Custom Roles
Create custom roles with specific permissions:
- **Resources**: Which resources can be accessed
- **Actions**: What actions are permitted
- **Scope**: Limit to specific organizations/networks

### Permissions

#### Permission Categories
- **Dashboard**: View dashboard widgets
- **Networks**: Manage networks and devices
- **Incidents**: Create, update, resolve incidents
- **Workflows**: Create and manage workflows
- **Knowledge**: Upload and manage documents
- **Admin**: Access admin settings
- **Audit**: View audit logs

---

## Licenses

The Licenses page (`/licenses`) provides Meraki license visibility.

### License Dashboard

#### License Summary
- **Total Licenses**: Count by license type
- **Expiring Soon**: Licenses expiring within 90 days
- **Expired**: Currently expired licenses
- **Coverage**: License coverage percentage

#### License List
View all licenses:
- **Device**: Associated device serial
- **Type**: License tier (Enterprise, Advanced, etc.)
- **State**: Active, expiring, expired
- **Expiration**: Expiration date
- **Duration**: License term length

### License Alerts
- Automatic alerts for expiring licenses
- Configurable warning thresholds (30, 60, 90 days)
- Email notifications to administrators

---

## API Reference

Lumen exposes a comprehensive REST API for programmatic access.

### Authentication
All API requests require authentication:
```
Authorization: Bearer <session_token>
```

Or use API keys (configure in Admin Settings):
```
X-API-Key: <api_key>
```

### Core Endpoints

#### Health
- `GET /api/health` - System health check
- `GET /api/health/detailed` - Detailed component health

#### Organizations
- `GET /api/organizations` - List configured organizations
- `GET /api/organizations/{org_id}` - Get organization details

#### Networks
- `GET /api/meraki/networks` - List all networks
- `GET /api/meraki/networks/{network_id}` - Get network details
- `GET /api/meraki/networks/{network_id}/devices` - List network devices

#### Devices
- `GET /api/meraki/devices/{serial}` - Get device details
- `GET /api/meraki/devices/{serial}/clients` - Get device clients

#### Incidents
- `GET /api/incidents` - List incidents
- `GET /api/incidents/{id}` - Get incident details
- `POST /api/incidents` - Create incident
- `PUT /api/incidents/{id}` - Update incident
- `POST /api/incidents/correlate` - Run correlation

#### Chat
- `POST /api/chat` - Send chat message
- `GET /api/chat/sessions` - List chat sessions
- `GET /api/chat/sessions/{id}` - Get session history

#### Workflows
- `GET /api/workflows` - List workflows
- `GET /api/workflows/{id}` - Get workflow details
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/{id}` - Update workflow
- `POST /api/workflows/{id}/run` - Execute workflow

#### Knowledge
- `GET /api/knowledge/documents` - List documents
- `POST /api/knowledge/documents` - Upload document
- `POST /api/knowledge/search` - Search knowledge base

### Swagger Documentation
Full interactive API documentation is available at `/api/docs` (Swagger UI).

---

## Troubleshooting

### Common Issues

#### "No credentials found"
**Cause**: Integration not configured or credentials invalid
**Solution**:
1. Navigate to Admin > Settings
2. Verify the integration is configured
3. Check that API keys are valid and not expired
4. Test connection using the "Test" button

#### "Failed to load topology"
**Cause**: Meraki API access issues
**Solution**:
1. Verify Meraki API key has organization access
2. Check network connectivity to api.meraki.com
3. Verify API key permissions include network/device read access
4. Check Meraki API rate limits haven't been exceeded

#### "No organizations configured"
**Cause**: No Meraki organizations selected
**Solution**:
1. Navigate to Admin > Settings > Meraki
2. Ensure API key is valid
3. Select at least one organization to monitor
4. Save settings

#### "AI request failed"
**Cause**: AI provider issues or configuration
**Solution**:
1. Check Admin > AI Settings for valid API key
2. Verify AI provider service is available
3. Check cost limits haven't been exceeded
4. Try switching to alternate AI model

#### "Splunk connection failed"
**Cause**: Splunk connectivity or authentication issues
**Solution**:
1. Verify Splunk URL is correct
2. Check username/password or token validity
3. If using SSL, try toggling SSL verification
4. Ensure Splunk instance is accessible from Lumen server

#### "Workflow execution failed"
**Cause**: Workflow configuration or runtime error
**Solution**:
1. Check workflow execution history for error details
2. Verify all nodes are properly configured
3. Check that required integrations are connected
4. Review AI node confidence thresholds

### Getting Help

#### Built-in Resources
- **This Documentation**: Comprehensive feature guide
- **Health Page**: Check system status
- **Audit Logs**: Review error details

#### AI Assistance
Use the chat interface for troubleshooting help:
- Describe the issue in natural language
- AI can analyze logs and suggest solutions
- Request step-by-step troubleshooting guides

#### Log Files
Server logs are located at:
- **Application Logs**: `logs/lumen.log`
- **Error Logs**: `logs/error.log`
- **Access Logs**: `logs/access.log`

### Performance Optimization

#### Slow Dashboard
- Reduce number of dashboard widgets
- Increase refresh intervals
- Check database performance

#### High AI Costs
- Use haiku model for simple queries
- Enable response caching
- Batch similar analyses

#### API Rate Limits
- Implement request throttling
- Cache frequently accessed data
- Use bulk API endpoints where available

---

## Keyboard Shortcuts

### Global
- `Ctrl/Cmd + K`: Open global search
- `Ctrl/Cmd + /`: Open chat
- `Escape`: Close modals and panels

### Topology
- `+`/`-`: Zoom in/out
- `F`: Fit view
- `Arrow Keys`: Navigate between devices

### Canvas
- `Space + Drag`: Pan canvas
- `Delete`: Remove selected element
- `Ctrl/Cmd + C/V`: Copy/paste elements
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + S`: Save canvas

### Chat
- `Enter`: Send message
- `Shift + Enter`: New line
- `Up Arrow`: Edit last message

---

*Lumen - Network Intelligence Powered by AI*

For additional support, please contact your system administrator or refer to the project repository.
