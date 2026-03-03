# AI Ops Center

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](requirements.txt)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](web-ui/package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](web-ui/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](requirements.txt)

An AI-powered network operations platform that unifies Cisco Meraki, Catalyst Center, ThousandEyes, and Splunk through natural language. Query, troubleshoot, and take action across your entire infrastructure — through simple conversation.

Powered by Cisco APIs, MCP servers, and multi-provider AI (Anthropic Claude, OpenAI GPT-4o, Google Gemini, Cisco Circuit).

---

## Quick Start

The launcher handles everything — including installing Python and Node.js if needed.

### One-Click Launch

```bash
git clone https://github.com/JackRiebel/AIOps.git
cd AIOps
```

Then double-click the launcher for your platform:
- **macOS / Linux**: `Start AI Ops Center.command`
- **Windows**: `Start AI Ops Center.bat`

The launcher automatically:
- Installs Python 3.11+ and Node.js 20+ (if not present)
- Creates a Python virtual environment and installs dependencies
- Downloads and starts an embedded PostgreSQL database
- Downloads the local embedding model (e5-small-v2)
- Generates SSL certificates (via mkcert or OpenSSL)
- Builds the Next.js frontend
- Starts both backend and frontend servers
- Opens your browser to the setup wizard

### Setup Wizard

On first launch you'll be guided through:
1. **Admin Account** — create your initial username and password
2. **AI Provider** — configure at least one AI provider (Anthropic, OpenAI, Google, or Cisco Circuit)
3. **Integrations** (optional) — connect Meraki, Catalyst Center, ThousandEyes, or Splunk

All configuration can be changed later from **Admin Settings** in the UI.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          AI Ops Center                               │
│                                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────┐ │
│  │    Frontend     │    │    Backend      │    │     Database       │ │
│  │   Next.js 16   │───▶│    FastAPI      │───▶│   PostgreSQL       │ │
│  │   Port 3000    │    │   Port 8002     │    │   (embedded)       │ │
│  │                │    │                  │    │   + pgvector       │ │
│  └────────────────┘    └───────┬──────────┘    └────────────────────┘ │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
     ┌─────────────┐    ┌──────────────┐    ┌────────────────┐
     │ Cisco Meraki │    │   Catalyst   │    │  ThousandEyes  │
     │ Dashboard API│    │    Center    │    │      API       │
     └─────────────┘    └──────────────┘    └────────────────┘
                                │
                                ▼
                         ┌─────────────┐    ┌──────────────┐
                         │   Splunk     │    │  AI Providers │
                         │    API       │    │ Claude / GPT  │
                         └─────────────┘    │ Gemini/Circuit│
                                            └──────────────┘
```

### Key Design Decisions

- **Embedded PostgreSQL** — zero-config database via `pgserver`, no external DB needed
- **pgvector** — vector similarity search for RAG/knowledge base, runs inside the same Postgres instance
- **Multi-provider AI** — unified interface that converts tool definitions and messages to provider-specific formats (Anthropic, OpenAI, Google, Cisco Circuit)
- **Dynamic tool system** — 1000+ tools across 4 platforms, filtered to 15-25 per request by a semantic tool selector
- **SSE streaming** — real-time AI responses streamed to the frontend
- **WebSocket + polling** — live infrastructure cards with WebSocket primary and polling fallback

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Framer Motion |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2.0, Pydantic |
| **Database** | PostgreSQL (embedded via pgserver) with pgvector |
| **AI Providers** | Anthropic Claude, OpenAI GPT-4o, Google Gemini, Cisco Circuit |
| **Embeddings** | sentence-transformers (e5-small-v2) local, or OpenAI |
| **Auth** | Session-based + JWT, Google OAuth, Duo MFA |
| **Background Jobs** | APScheduler |
| **Visualization** | Recharts, D3, React Force Graph, XY Flow |
| **Code Editor** | Monaco Editor |

---

## Features

### Conversational Network Operations

Ask questions and take action in plain English:

```
"Show me all offline devices across my Meraki orgs"
"What's the WiFi client count trend for the past week?"
"List all critical ThousandEyes alerts"
"Search Splunk for failed login attempts in the last 24 hours"
"Create a new SSID called Guest-WiFi with WPA2 encryption"
```

Multi-provider AI support lets you choose between Claude, GPT-4o, Gemini, or Cisco Circuit per conversation.

### Multi-Platform Integration

| Platform | Capabilities |
|----------|-------------|
| **Cisco Meraki** | Full Dashboard API — organizations, networks, devices, SSIDs, VLANs, clients, security appliances, switches, cameras, sensors |
| **Cisco Catalyst Center** | Enterprise campus — devices, sites, topology, health, compliance, command runner, SDA, SWIM |
| **ThousandEyes** | Synthetic monitoring — tests, agents, alerts, path visualization, endpoint agents |
| **Splunk** | Log analysis — search, KV store, security events, dashboards, correlation |

### Knowledge Base & RAG

Upload internal documentation (PDF, DOCX, text) and query it alongside live infrastructure data:
- Agentic RAG pipeline with corrective retrieval
- Local embeddings (e5-small-v2) or OpenAI embeddings
- Vector search via pgvector
- Web search fallback (Tavily, SerpAPI, DuckDuckGo)

### Incident Management

- Automatic event correlation across platforms
- AI-suggested root cause analysis
- Timeline visualization
- Severity classification and alert deduplication

### Dashboards & Visualization

- Network health overview across all connected organizations
- Device monitoring with real-time status
- Network topology maps (D3 force graph)
- ThousandEyes test results and path analysis
- Splunk log search and security events
- AI cost analytics with per-query breakdowns and ROI tracking

### Workflows & Automation

- Visual workflow builder with drag-and-drop canvas
- Python script editor (Monaco) for custom automation
- Scheduled execution via APScheduler
- Cost caps per workflow and daily limits

### Security & Access Control

- **RBAC** — 4 hierarchical roles (Admin, Editor, Operator, Viewer) with 40+ permissions
- **Authentication** — Local (bcrypt), Google OAuth, Duo MFA
- **Edit mode protection** — write operations require explicit enablement with audit logging
- **Credential encryption** — all API keys encrypted at rest with Fernet
- **Audit trail** — every operation logged with user, IP, timestamp, and outcome
- **SSL/TLS** — HTTPS for both frontend and backend with auto-generated certificates

---

## Manual Installation

For custom configurations or production deployments.

### Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **Git**

PostgreSQL is **not** required — the platform uses an embedded instance by default.

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/JackRiebel/AIOps.git
cd AIOps

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings (see Configuration below)

# Initialize the database
python scripts/init_database.py
```

### Frontend Setup

```bash
cd web-ui

# Install Node.js dependencies
npm install

# Copy frontend environment config
echo 'NEXT_PUBLIC_API_URL=https://localhost:8002' > .env.local

# Build for production
npm run build
```

### Generate SSL Certificates

```bash
# Option 1: mkcert (recommended, creates trusted local CA)
mkcert -install
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1
mkcert -key-file web-ui/certificates/localhost-key.pem -cert-file web-ui/certificates/localhost.pem localhost 127.0.0.1

# Option 2: OpenSSL (self-signed)
mkdir -p certs web-ui/certificates
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj '/CN=localhost'
cp certs/key.pem web-ui/certificates/localhost-key.pem
cp certs/cert.pem web-ui/certificates/localhost.pem
```

### Start the Servers

```bash
# Terminal 1: Backend
source .venv/bin/activate
uvicorn src.api.web_api:app --host 0.0.0.0 --port 8002 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem

# Terminal 2: Frontend
cd web-ui
npm start         # Production (after build)
# or
npm run dev       # Development with hot reload
```

Open **https://localhost:3000** and complete the setup wizard.

---

## Configuration

### Environment Variables

The setup wizard and Admin Settings UI handle most configuration. For manual setup, key variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_EMBEDDED_POSTGRES` | Use bundled PostgreSQL | `true` |
| `DATABASE_URL` | PostgreSQL connection string (if not using embedded) | — |
| `ENCRYPTION_KEY` | Fernet key for credential encryption | Auto-generated |
| `SESSION_SECRET_KEY` | Session signing key (32+ chars) | Auto-generated |

### AI Providers (at least one required)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | OpenAI API key for GPT models |
| `GOOGLE_API_KEY` | Google API key for Gemini models |
| `CISCO_CIRCUIT_CLIENT_ID` | Cisco Circuit OAuth client ID |
| `CISCO_CIRCUIT_CLIENT_SECRET` | Cisco Circuit OAuth client secret |
| `CISCO_CIRCUIT_APP_KEY` | Cisco Circuit application key |

### Network Integrations (optional)

| Variable | Description |
|----------|-------------|
| `MERAKI_API_KEY` | Cisco Meraki Dashboard API key |
| `CATALYST_BASE_URL` | Catalyst Center base URL |
| `CATALYST_USERNAME` | Catalyst Center username |
| `CATALYST_PASSWORD` | Catalyst Center password |
| `THOUSANDEYES_OAUTH_TOKEN` | ThousandEyes OAuth bearer token |
| `SPLUNK_HEC_URL` | Splunk HTTP Event Collector URL |
| `SPLUNK_HEC_TOKEN` | Splunk HEC token |

### Cost Controls

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKFLOW_AI_COST_CAP_USD` | `5.0` | Max AI spend per workflow execution |
| `DAILY_AI_COST_CAP_USD` | `100.0` | Max daily AI spend across all operations |

See `.env.example` for the full list of available variables.

---

## API Reference

All endpoints require session authentication (login via `POST /api/auth/login`).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/setup/status` | GET | Setup wizard status (public) |
| `/api/auth/login` | POST | Authenticate and create session |
| `/api/chat` | POST | AI chat with streaming (SSE) |
| `/api/sessions` | GET | List chat sessions |
| `/api/network/organizations` | GET | List connected organizations |
| `/api/incidents` | GET/POST | Incident management |
| `/api/costs/summary` | GET | AI cost analytics |
| `/api/admin/config` | GET/PUT | System configuration |
| `/api/audit/logs` | GET | Audit log entries |
| `/api/knowledge` | GET/POST | Knowledge base documents |
| `/api/workflows` | GET/POST | Workflow management |

Full interactive docs available at **https://localhost:8002/docs** (Swagger UI).

---

## Project Structure

```
├── src/
│   ├── api/
│   │   ├── web_api.py              # FastAPI application entry point
│   │   ├── routes/                  # 36+ API route modules
│   │   └── dependencies.py         # Shared route dependencies
│   ├── config/
│   │   ├── settings.py             # Pydantic settings (env + .env)
│   │   ├── database.py             # SQLAlchemy engine setup
│   │   ├── schema.sql              # Database schema (30+ tables)
│   │   └── prompts.yaml            # AI system prompts
│   ├── models/                     # SQLAlchemy ORM models
│   ├── services/
│   │   ├── unified_chat_service.py # Main AI chat orchestrator
│   │   ├── tool_registry.py        # Tool definition registry
│   │   ├── tool_selector.py        # Semantic tool filtering
│   │   ├── providers/              # AI provider implementations
│   │   ├── tools/                  # Platform tool definitions
│   │   │   ├── meraki/             # Meraki API tools
│   │   │   ├── catalyst/           # Catalyst Center tools
│   │   │   ├── thousandeyes/       # ThousandEyes tools
│   │   │   └── splunk/             # Splunk tools
│   │   ├── agentic_rag/            # RAG pipeline
│   │   └── ...                     # 80+ service modules
│   ├── middleware/                  # Auth, audit, session middleware
│   └── main.py                     # MCP server entry point
├── web-ui/
│   ├── src/app/                    # Next.js pages (App Router)
│   ├── src/components/             # React components
│   ├── src/contexts/               # React contexts (Auth, Theme)
│   └── src/types/                  # TypeScript type definitions
├── scripts/                        # Database migrations and utilities
├── certs/                          # SSL certificates (generated)
├── data/                           # Embedded Postgres data (generated)
├── Start AI Ops Center.command     # macOS/Linux launcher
├── Start AI Ops Center.bat         # Windows launcher
├── requirements.txt                # Python dependencies
└── .env.example                    # Environment variable template
```

---

## Troubleshooting

**Setup wizard not appearing**
- Clear browser cache and cookies
- Check if an admin user already exists (`/api/setup/status` returns `setup_complete: true`)
- Review backend logs in `data/startup.log`

**Cannot connect to an integration**
- Verify API credentials in Admin Settings
- Check network connectivity to the platform
- Review SSL verification settings (disable per-platform if behind a corporate proxy)

**AI responses are slow or failing**
- Verify your AI provider API key is valid
- Check provider status pages (Anthropic, OpenAI, Google)
- Review token usage and costs in the Cost Analytics page

**Port conflicts on startup**
- Backend defaults to port 8002, frontend to port 3000
- The launcher checks for conflicts and offers to kill existing processes
- Manually check with `lsof -i :8002` or `lsof -i :3000`

**Database issues**
- Embedded Postgres data lives in `data/pgdata/`
- To reset: stop the server, delete `data/pgdata/`, and restart
- Logs: check `data/startup.log` for Postgres errors

---

## License

This project is licensed under the Apache License 2.0 — see the [LICENSE](LICENSE) file for details.
