# Lumen - Network Intelligence Platform

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](requirements.txt)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](web-ui/package.json)

Lumen is an AI-powered network intelligence platform that unifies multi-vendor network management through natural language. It bridges Claude AI with enterprise network infrastructure including Cisco Meraki, Cisco Catalyst Center, ThousandEyes, and Splunk.

## Quick Start (Zero Setup)

The launcher handles **everything** - including installing Python and Node.js if you don't have them!

### One-Click Launch

1. **Download/Clone the repository**
   ```bash
   git clone https://github.com/your-org/lumen.git
   cd lumen
   ```

2. **Double-click the launcher for your platform:**
   - **macOS/Linux**: `Start Lumen.command`
   - **Windows**: `Start Lumen.bat`

3. **That's it!** The launcher automatically:
   - Installs Python 3.11 (if not present)
   - Installs Node.js 20 (if not present)
   - Creates a Python virtual environment
   - Installs all dependencies
   - Generates SSL certificates
   - Initializes the SQLite database
   - Starts both servers
   - Opens your browser to the setup wizard

4. **Complete the setup wizard** to:
   - Create your admin account
   - Configure an AI provider (Anthropic, OpenAI, or Google)

---

## Features

### AI Network Manager

A conversational interface powered by Claude AI for network operations:

- **Natural Language Queries**: Ask questions in plain English
  ```
  "Show me all offline devices"
  "What networks are in the San Francisco office?"
  "List all SSIDs and their security settings"
  "Which switches have high CPU usage?"
  ```

- **Configuration Changes** (with edit mode enabled):
  ```
  "Create a new SSID called Guest-WiFi with WPA2"
  "Reboot the switch in Building A"
  "Update the VLAN on port 12 to VLAN 100"
  ```

- **Multi-Provider AI Support**: Choose between Anthropic Claude, OpenAI GPT-4, Google Gemini, or Cisco AI Assistant

- **Session History**: Persistent chat sessions with full conversation history

- **Cost Tracking**: Real-time tracking of AI token usage and costs per query

### Multi-Platform Integration

Connect and manage networks across vendors from a single dashboard:

| Platform | Capabilities |
|----------|-------------|
| **Cisco Meraki** | Full Dashboard API - networks, devices, SSIDs, VLANs, security appliances, clients, alerts |
| **Cisco Catalyst Center** | DNA Center integration for enterprise campus networks - devices, sites, topology |
| **ThousandEyes** | Synthetic monitoring tests, network path visualization, agent status |
| **Splunk** | Log aggregation, security event correlation, custom searches |

### Incident Timeline

AI-powered incident management with intelligent correlation:

- **Automatic Event Correlation**: Connects related events across platforms
- **Root Cause Analysis**: AI-suggested probable causes
- **Timeline Visualization**: Chronological view of related events
- **Alert Aggregation**: Deduplication of similar alerts
- **Severity Classification**: Automatic priority assignment

### Networks & Devices Dashboard

Unified infrastructure view with:

- **Overview Dashboard**: Health metrics across all organizations
- **Organization Management**: Add/remove connected platforms
- **Network Browser**: Filter, search, and explore networks
- **Device Monitoring**: Real-time status (online/offline/alerting)
- **Network Topology**: Visual topology information
- **Paginated Views**: Handle thousands of devices efficiently

### ThousandEyes Integration

Synthetic monitoring dashboard:

- **Test Results**: View all active ThousandEyes tests
- **Path Visualization**: Network path analysis
- **Agent Status**: Monitor agent health and connectivity
- **Alert Correlation**: Link ThousandEyes alerts to network events

### Splunk Integration

Security and log analysis:

- **Log Search**: Query Splunk logs from the dashboard
- **Security Events**: View correlated security alerts
- **Custom Dashboards**: Create visualizations of log data
- **Incident Linking**: Connect log events to network incidents

### AI Cost Analytics

Track AI operational costs:

- **Per-Query Breakdown**: Cost for each AI interaction
- **Token Usage**: Input/output token metrics
- **Historical Trends**: Cost trends over time
- **Model Comparison**: Compare costs across AI providers
- **Budget Monitoring**: Track against spending limits

### Security & Access Control

Enterprise-grade security features:

#### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, user management, system settings, security configuration |
| **Editor** | View and modify configurations, create/edit networks |
| **Operator** | View and execute operational tasks (reboots, status checks) |
| **Viewer** | Read-only access to all dashboards |

#### Authentication Options

- **Local Authentication**: Username/password with bcrypt hashing
- **Google OAuth**: Single sign-on with Google Workspace
- **Duo MFA**: Two-factor authentication via Duo Security

#### Edit Mode Protection

Write operations require explicit edit mode enablement:
1. Navigate to **Security** settings
2. Toggle **Edit Mode** on
3. Confirm with password/MFA
4. All changes logged to audit trail
5. Auto-disables after timeout

#### Credential Security

- **Fernet Encryption**: All API keys encrypted at rest
- **No Plain Text**: Credentials never in logs or API responses
- **Per-Organization Isolation**: Separate credential storage per org
- **Secure Configuration**: Sensitive settings stored encrypted in database

### System Administration

#### Admin Settings Page

Configure all system settings from the UI (no .env editing required):

- **AI Providers**: Anthropic, OpenAI, Google, Cisco AI credentials
- **Integrations**: Meraki, Catalyst Center, ThousandEyes, Splunk settings
- **Authentication**: OAuth, MFA, session settings
- **Security**: SSL verification, API timeouts, edit mode defaults

#### Audit Logging

Complete audit trail of all operations:

- **Who**: User who performed the action
- **What**: Detailed description of the operation
- **When**: Timestamp with timezone
- **Where**: IP address and session info
- **Outcome**: Success/failure status

#### Health Monitoring

System health dashboard showing:

- **Backend Status**: API server health
- **Database Connectivity**: PostgreSQL/SQLite status
- **Integration Status**: Connection health for each platform
- **Queue Status**: Background job health

### Visualizations

Data visualization capabilities:

- **Network Topology Maps**: Visual network diagrams
- **Device Health Charts**: Status distribution graphs
- **Trend Analysis**: Historical performance charts
- **Alert Heatmaps**: Temporal alert distribution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Lumen                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │    Web UI     │  │    Backend    │  │      Database     │   │
│  │   (Next.js)   │──│   (FastAPI)   │──│   (PostgreSQL/    │   │
│  │   Port 3000   │  │   Port 8002   │  │     SQLite)       │   │
│  └───────────────┘  └───────┬───────┘  └───────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌────────────┐     ┌────────────┐     ┌────────────────┐
   │   Meraki   │     │  Catalyst  │     │  ThousandEyes  │
   │  Dashboard │     │   Center   │     │      API       │
   └────────────┘     └────────────┘     └────────────────┘
          │                                       │
          └──────────────────┬────────────────────┘
                             ▼
                     ┌────────────┐
                     │   Splunk   │
                     │    API     │
                     └────────────┘
```

### Tech Stack

**Frontend:**
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Lucide React icons

**Backend:**
- FastAPI (Python 3.11+)
- SQLAlchemy ORM
- Pydantic validation
- APScheduler for background jobs

**Database:**
- SQLite (default, zero-config)
- PostgreSQL (production)

**AI Integration:**
- Anthropic Claude API
- OpenAI GPT API
- Google Gemini API
- Cisco AI Assistant API

---

## Manual Installation (Advanced)

For production deployments or custom configurations:

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (optional, SQLite works for small deployments)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/lumen.git
   cd lumen
   ```

2. **Set up the backend**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   python scripts/init_database.py
   ```

3. **Start the backend**
   ```bash
   uvicorn src.api.web_api:app --host 0.0.0.0 --port 8002
   ```

4. **Start the frontend**
   ```bash
   cd web-ui
   npm install
   npm run dev
   ```

5. **Access the application**
   Open http://localhost:3000

---

## Configuration

### Environment Variables

Only two variables are required for bootstrap (others configurable via UI):

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `ENCRYPTION_KEY` | Fernet key for credential encryption | Yes (auto-generated) |

### Database Configuration

**SQLite (Default)**
```
DATABASE_URL=sqlite:///./data/lumen.db
```

**PostgreSQL**
```
DATABASE_URL=postgresql://user:password@localhost:5432/lumen
```

### Generating Encryption Key

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## API Reference

### Authentication
All API endpoints require session authentication. Login via `/api/auth/login`.

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/organizations` | GET/POST | List/create organizations |
| `/api/network/chat` | POST | AI chat interface |
| `/api/network/list` | POST | List networks/devices |
| `/api/incidents` | GET/POST | Incident management |
| `/api/audit/logs` | GET | Audit log entries |
| `/api/security/config` | GET/PUT | Security settings |
| `/api/costs/summary` | GET | AI cost analytics |
| `/api/admin/config` | GET/PUT | System configuration |

### Full API Documentation
Visit `http://localhost:8002/docs` for interactive OpenAPI documentation.

---

## Troubleshooting

### Common Issues

**Cannot connect to organization**
- Verify API credentials are correct
- Check network connectivity to the platform
- Ensure SSL verification settings match your environment

**AI responses are slow**
- Check AI provider API status
- Review token usage in Cost Analytics
- Consider using a smaller context window

**Devices show as offline**
- Refresh the page to update status
- Check the specific organization's API connectivity
- Review audit logs for API errors

**Setup wizard not appearing**
- Clear browser cache and cookies
- Check if admin user already exists in database
- Review backend logs for errors

### Logs

Backend logs are output to stdout. For production, configure logging to your preferred destination.

---

## Security Considerations

1. **HTTPS**: Always use HTTPS in production (auto-generated certs for development)
2. **Secrets**: Never commit `.env` files or encryption keys to source control
3. **Access**: Use role-based access control to limit permissions
4. **Audit**: Review audit logs regularly for suspicious activity
5. **Updates**: Keep dependencies updated for security patches

---

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Anthropic](https://anthropic.com) - Claude AI
- [Cisco Meraki](https://meraki.cisco.com) - Dashboard API
- [Cisco Catalyst Center](https://www.cisco.com/c/en/us/products/cloud-systems-management/dna-center/index.html) - DNA Center API
- [ThousandEyes](https://www.thousandeyes.com) - Network Intelligence
- [Splunk](https://www.splunk.com) - Data Platform
