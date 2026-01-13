#!/bin/bash
# =============================================================================
# Lumen - AI-Powered Network Intelligence Platform
# One-Click Installer & Launcher for macOS/Linux
# =============================================================================
# This script will:
# 1. Install Homebrew (macOS) if not present
# 2. Install Python 3.11+ if not present
# 3. Install Node.js 20+ if not present
# 4. Install mkcert for trusted HTTPS certificates
# 5. Generate secure environment configuration
# 6. Install all dependencies
# 7. Initialize and migrate database
# 8. Start backend and frontend servers
# 9. Open your browser
#
# Just double-click this file - no prerequisites needed!
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Log file for debugging
LOG_FILE="$SCRIPT_DIR/data/startup.log"
mkdir -p "$SCRIPT_DIR/data"

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

print_banner() {
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'

    ██╗     ██╗   ██╗███╗   ███╗███████╗███╗   ██╗
    ██║     ██║   ██║████╗ ████║██╔════╝████╗  ██║
    ██║     ██║   ██║██╔████╔██║█████╗  ██╔██╗ ██║
    ██║     ██║   ██║██║╚██╔╝██║██╔══╝  ██║╚██╗██║
    ███████╗╚██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║
    ╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝

EOF
    echo -e "     ${MAGENTA}AI-Powered Network Intelligence Platform${NC}"
    echo ""
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${DIM}  $1${NC}"
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if running as root (we don't want that)
check_not_root() {
    if [ "$EUID" -eq 0 ]; then
        print_error "Please don't run this script as root/sudo"
        print_warning "The script will ask for sudo password only when needed"
        exit 1
    fi
}

# Check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check required ports
check_ports() {
    print_step "Checking required ports..."

    local ports_blocked=0

    if check_port 8002; then
        print_warning "Port 8002 is already in use (backend)"
        print_info "Run: lsof -i :8002 to see what's using it"
        print_info "Or:  kill \$(lsof -t -i :8002) to free it"
        ports_blocked=1
    fi

    if check_port 3000; then
        print_warning "Port 3000 is already in use (frontend)"
        print_info "Run: lsof -i :3000 to see what's using it"
        print_info "Or:  kill \$(lsof -t -i :3000) to free it"
        ports_blocked=1
    fi

    if [ $ports_blocked -eq 1 ]; then
        echo ""
        read -p "$(echo -e ${YELLOW}Would you like to kill processes on these ports? [y/N]: ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if check_port 8002; then
                kill $(lsof -t -i :8002) 2>/dev/null || true
                print_success "Freed port 8002"
            fi
            if check_port 3000; then
                kill $(lsof -t -i :3000) 2>/dev/null || true
                print_success "Freed port 3000"
            fi
            sleep 1
        else
            print_error "Cannot start with ports in use"
            exit 1
        fi
    else
        print_success "Ports 8002 and 3000 are available"
    fi
}

# Install Homebrew on macOS
install_homebrew() {
    if [ "$OS" = "Darwin" ]; then
        if ! command -v brew &> /dev/null; then
            print_step "Installing Homebrew (macOS package manager)..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

            # Add Homebrew to PATH for this session
            if [ "$ARCH" = "arm64" ]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            else
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            print_success "Homebrew installed"
        else
            print_success "Homebrew already installed"
        fi
    fi
}

# Check and install Python
check_install_python() {
    print_step "Checking Python..."

    PYTHON_CMD=""

    # Check for Python 3.10+
    for cmd in python3.12 python3.11 python3.10 python3 python; do
        if command -v $cmd &> /dev/null; then
            version=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
            major=$(echo $version | cut -d. -f1)
            minor=$(echo $version | cut -d. -f2)
            if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
                PYTHON_CMD=$cmd
                print_success "Found Python $version ($cmd)"
                break
            fi
        fi
    done

    if [ -z "$PYTHON_CMD" ]; then
        print_warning "Python 3.10+ not found, installing..."

        if [ "$OS" = "Darwin" ]; then
            brew install python@3.11
            PYTHON_CMD="python3.11"

            if [ "$ARCH" = "arm64" ]; then
                export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
            else
                export PATH="/usr/local/opt/python@3.11/bin:$PATH"
            fi
        elif [ "$OS" = "Linux" ]; then
            if command -v apt-get &> /dev/null; then
                print_step "Installing Python via apt..."
                sudo apt-get update
                sudo apt-get install -y python3.11 python3.11-venv python3-pip
                PYTHON_CMD="python3.11"
            elif command -v dnf &> /dev/null; then
                print_step "Installing Python via dnf..."
                sudo dnf install -y python3.11 python3.11-pip
                PYTHON_CMD="python3.11"
            elif command -v pacman &> /dev/null; then
                print_step "Installing Python via pacman..."
                sudo pacman -S --noconfirm python python-pip
                PYTHON_CMD="python3"
            else
                print_error "Unsupported Linux distribution"
                print_warning "Please install Python 3.10+ manually and run this script again"
                exit 1
            fi
        else
            print_error "Unsupported operating system: $OS"
            exit 1
        fi

        print_success "Python installed"
    fi

    export PYTHON_CMD
}

# Check and install Node.js
check_install_node() {
    print_step "Checking Node.js..."

    if command -v node &> /dev/null; then
        version=$(node --version | sed 's/v//')
        major=$(echo $version | cut -d. -f1)
        if [ "$major" -ge 18 ]; then
            print_success "Found Node.js v$version"
            return 0
        else
            print_warning "Node.js $version is too old, need 18+"
        fi
    else
        print_warning "Node.js not found"
    fi

    print_step "Installing Node.js..."

    if [ "$OS" = "Darwin" ]; then
        brew install node@20
        brew link --overwrite node@20 2>/dev/null || true

        if [ "$ARCH" = "arm64" ]; then
            export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
        else
            export PATH="/usr/local/opt/node@20/bin:$PATH"
        fi
    elif [ "$OS" = "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            print_step "Installing Node.js via NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v dnf &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm nodejs npm
        else
            print_error "Could not install Node.js automatically"
            print_warning "Please install Node.js 18+ manually from https://nodejs.org"
            exit 1
        fi
    fi

    print_success "Node.js installed"
}

# Check and install mkcert for trusted local HTTPS
check_install_mkcert() {
    print_step "Checking mkcert for trusted HTTPS..."

    if command -v mkcert &> /dev/null; then
        print_success "mkcert already installed"
    else
        print_step "Installing mkcert..."

        if [ "$OS" = "Darwin" ]; then
            brew install mkcert nss
        elif [ "$OS" = "Linux" ]; then
            if command -v apt-get &> /dev/null; then
                sudo apt-get install -y libnss3-tools
                curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
                chmod +x mkcert-v*-linux-amd64
                sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
            else
                print_warning "Could not install mkcert automatically"
                print_info "Will use self-signed certificates instead"
                return 1
            fi
        fi

        print_success "mkcert installed"
    fi

    # Install local CA
    print_step "Setting up local certificate authority..."
    mkcert -install 2>/dev/null || true
    print_success "Local CA installed"

    return 0
}

# Generate SSL certificates
generate_ssl_certs() {
    print_step "Checking SSL certificates..."

    mkdir -p certs
    mkdir -p web-ui/certificates

    # Check if certs already exist
    if [ -f "certs/key.pem" ] && [ -f "certs/cert.pem" ]; then
        print_success "Backend SSL certificates exist"
    else
        # Try mkcert first for trusted certs
        if command -v mkcert &> /dev/null; then
            print_step "Generating trusted SSL certificates with mkcert..."
            mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 127.0.0.1 ::1 2>/dev/null
            print_success "Trusted backend certificates generated"
        elif command -v openssl &> /dev/null; then
            print_step "Generating self-signed SSL certificates..."
            openssl req -x509 -newkey rsa:4096 \
                -keyout certs/key.pem \
                -out certs/cert.pem \
                -days 365 \
                -nodes \
                -subj "/CN=localhost" 2>/dev/null
            print_success "Self-signed backend certificates generated"
            print_warning "Browser may show security warning with self-signed certs"
        else
            print_warning "No certificate generator found, running without HTTPS"
            return 1
        fi
    fi

    # Generate frontend certificates too
    if [ -f "web-ui/certificates/localhost.pem" ] && [ -f "web-ui/certificates/localhost-key.pem" ]; then
        print_success "Frontend SSL certificates exist"
    else
        if command -v mkcert &> /dev/null; then
            print_step "Generating frontend SSL certificates..."
            mkcert -key-file web-ui/certificates/localhost-key.pem -cert-file web-ui/certificates/localhost.pem localhost 127.0.0.1 ::1 2>/dev/null
            print_success "Frontend certificates generated"
        fi
    fi

    return 0
}

# Generate secure encryption keys
generate_encryption_key() {
    $PYTHON_CMD -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
}

generate_session_key() {
    $PYTHON_CMD -c "import secrets; print(secrets.token_urlsafe(32))"
}

# Setup or update .env file
setup_env_file() {
    print_step "Checking environment configuration..."

    ENV_FILE="$SCRIPT_DIR/.env"
    ENV_UPDATED=0

    # Create .env if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        print_step "Creating environment configuration file..."

        # Generate secure keys
        ENCRYPTION_KEY=$(generate_encryption_key)
        SESSION_KEY=$(generate_session_key)

        cat > "$ENV_FILE" << EOF
# =============================================================================
# Lumen Configuration
# Generated automatically - customize as needed
# =============================================================================

# Database Configuration (embedded PostgreSQL - no setup required)
# The embedded PostgreSQL server starts automatically
USE_EMBEDDED_POSTGRES=true
# DATABASE_URL is set automatically by the embedded server

# For external PostgreSQL (advanced):
# USE_EMBEDDED_POSTGRES=false
# DATABASE_URL=postgresql://lumen:lumen123@localhost:5432/lumen

# Security Keys (auto-generated - keep these secret!)
ENCRYPTION_KEY=$ENCRYPTION_KEY
SESSION_SECRET_KEY=$SESSION_KEY

# Server Configuration
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=8080
LOG_LEVEL=INFO
ENVIRONMENT=development

# Edit Mode (set to true to allow write operations)
EDIT_MODE_ENABLED=false

# SSL Configuration
VERIFY_SSL=true

# Session Settings
SESSION_TIMEOUT_MINUTES=60

# =============================================================================
# AI Provider Configuration (configure at least one)
# =============================================================================

# Cisco Circuit (recommended - configure via web UI setup wizard)
# CIRCUIT_CLIENT_ID=your_client_id
# CIRCUIT_CLIENT_SECRET=your_client_secret

# Third Party Options:
# Anthropic Claude
# ANTHROPIC_API_KEY=sk-ant-...

# OpenAI GPT
# OPENAI_API_KEY=sk-...

# Google Gemini
# GOOGLE_API_KEY=...

# =============================================================================
# Network API Configuration
# =============================================================================

# Cisco Meraki
# MERAKI_API_KEY=your_meraki_api_key
# MERAKI_BASE_URL=https://api.meraki.com/api/v1

# Cisco Catalyst Center
# CATALYST_BASE_URL=https://your-dnac-server
# CATALYST_USERNAME=admin
# CATALYST_PASSWORD=your_password

# =============================================================================
# Optional Integrations
# =============================================================================

# Splunk
# SPLUNK_HEC_URL=https://splunk:8088
# SPLUNK_HEC_TOKEN=your_token

# ThousandEyes
# THOUSANDEYES_API_TOKEN=your_token

# Redis (for caching - optional)
# REDIS_URL=redis://localhost:6379/0

EOF
        print_success "Environment file created at .env"
        ENV_UPDATED=1
    else
        print_success "Environment file exists"

        # Check for required keys
        if ! grep -q "ENCRYPTION_KEY=" "$ENV_FILE" || grep -q "ENCRYPTION_KEY=$" "$ENV_FILE"; then
            print_step "Adding missing ENCRYPTION_KEY..."
            ENCRYPTION_KEY=$(generate_encryption_key)
            echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_FILE"
            ENV_UPDATED=1
        fi

        if ! grep -q "SESSION_SECRET_KEY=" "$ENV_FILE" || grep -q "SESSION_SECRET_KEY=$" "$ENV_FILE"; then
            print_step "Adding missing SESSION_SECRET_KEY..."
            SESSION_KEY=$(generate_session_key)
            echo "SESSION_SECRET_KEY=$SESSION_KEY" >> "$ENV_FILE"
            ENV_UPDATED=1
        fi

        if ! grep -q "USE_EMBEDDED_POSTGRES=" "$ENV_FILE"; then
            print_step "Adding missing USE_EMBEDDED_POSTGRES..."
            echo "USE_EMBEDDED_POSTGRES=true" >> "$ENV_FILE"
            ENV_UPDATED=1
        fi
    fi

    # Also create web-ui .env.local if missing
    if [ ! -f "$SCRIPT_DIR/web-ui/.env.local" ]; then
        print_step "Creating frontend environment file..."
        cat > "$SCRIPT_DIR/web-ui/.env.local" << EOF
# Backend API URL
BACKEND_URL=https://localhost:8002

# Use API proxy (leave empty)
NEXT_PUBLIC_API_URL=
EOF
        print_success "Frontend environment file created"
    fi

    if [ $ENV_UPDATED -eq 1 ]; then
        print_warning "Please review .env and add your API keys"
    fi
}

# Setup Python virtual environment
setup_venv() {
    print_step "Setting up Python virtual environment..."

    if [ ! -d ".venv" ]; then
        $PYTHON_CMD -m venv .venv
        print_success "Created virtual environment"
    else
        print_success "Virtual environment exists"
    fi

    # Activate it
    source .venv/bin/activate

    # Upgrade pip
    pip install --upgrade pip -q
}

# Install Python dependencies
install_python_deps() {
    print_step "Installing Python dependencies..."
    print_info "This may take a few minutes on first run..."

    pip install -q -r requirements.txt 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERROR|error|Error)" || true

    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        print_warning "Some dependencies may have had issues - checking..."
    fi

    print_success "Python dependencies installed"

    # Check if pgserver needs to download PostgreSQL binaries (first-time only)
    print_step "Checking PostgreSQL binaries..."
    if python3 -c "import pgserver" 2>/dev/null; then
        print_success "PostgreSQL binaries available"
    else
        print_step "Downloading embedded PostgreSQL binaries (first-time only, ~150MB)..."
        python3 -c "import pgserver" 2>&1 | tee -a "$LOG_FILE"
        print_success "PostgreSQL binaries downloaded"
    fi

    # Pre-download the local embedding model (first-time only, ~90MB)
    print_step "Checking local embedding model..."
    if python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/e5-small-v2')" 2>/dev/null; then
        print_success "Embedding model available"
    else
        print_step "Downloading embedding model (first-time only, ~90MB)..."
        python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/e5-small-v2')" 2>&1 | tee -a "$LOG_FILE"
        print_success "Embedding model downloaded"
    fi
}

# Install Node.js dependencies
install_node_deps() {
    print_step "Installing Node.js dependencies..."
    print_info "This may take a few minutes on first run..."

    cd "$SCRIPT_DIR/web-ui"

    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        npm install 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERR!|error)" || true
        print_success "Node.js dependencies installed"
    else
        print_success "Node.js dependencies already installed"
    fi

    cd "$SCRIPT_DIR"
}

# Setup data directory
setup_data_dir() {
    print_step "Setting up data directory..."
    mkdir -p data
    print_success "Data directory ready"
}

# Initialize database (with embedded PostgreSQL)
init_database() {
    print_step "Initializing database..."

    # The embedded PostgreSQL is started automatically by the backend via web_api.py
    # The backend lifespan handler will:
    # 1. Start embedded PostgreSQL if USE_EMBEDDED_POSTGRES=true
    # 2. Set DATABASE_URL to the connection string
    # 3. Run database migrations

    # For standalone init (if needed before backend starts)
    if [ -f "scripts/init_database.py" ]; then
        PYTHONPATH="$SCRIPT_DIR" python scripts/init_database.py 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERROR|Error|error)" || true
    fi

    print_success "Database initialized"
}

# Run database migrations
run_migrations() {
    print_step "Running database migrations..."

    # Run RBAC migration
    if [ -f "scripts/migrate_rbac.py" ]; then
        PYTHONPATH="$SCRIPT_DIR" python scripts/migrate_rbac.py 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERROR|Error|error)" || true
        print_success "RBAC migration complete"
    fi

    # Run Agentic RAG migration
    if [ -f "scripts/migrate_agentic_rag.py" ]; then
        PYTHONPATH="$SCRIPT_DIR" python scripts/migrate_agentic_rag.py 2>&1 | tee -a "$LOG_FILE" | grep -E "(ERROR|Error|error)" || true
        print_success "Agentic RAG migration complete"
    fi
}

# Health check for backend
check_backend_health() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sk "https://localhost:8002/api/health" >/dev/null 2>&1; then
            return 0
        elif curl -sk "http://localhost:8002/api/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    return 1
}

# Health check for frontend
check_frontend_health() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sk "https://localhost:3000" >/dev/null 2>&1; then
            return 0
        elif curl -sk "http://localhost:3000" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    return 1
}

# Start backend server
start_backend() {
    print_step "Starting backend server..."
    log "Starting backend server"

    USE_SSL=$1

    # Set Keras compatibility mode for sentence-transformers
    export TF_USE_LEGACY_KERAS=1

    if [ "$USE_SSL" = "true" ] && [ -f "certs/key.pem" ]; then
        PYTHONPATH="$SCRIPT_DIR" uvicorn src.api.web_api:app \
            --host 0.0.0.0 \
            --port 8002 \
            --ssl-keyfile certs/key.pem \
            --ssl-certfile certs/cert.pem \
            >> "$LOG_FILE" 2>&1 &
        BACKEND_PID=$!
        BACKEND_URL="https://localhost:8002"
    else
        PYTHONPATH="$SCRIPT_DIR" uvicorn src.api.web_api:app \
            --host 0.0.0.0 \
            --port 8002 \
            >> "$LOG_FILE" 2>&1 &
        BACKEND_PID=$!
        BACKEND_URL="http://localhost:8002"
    fi

    print_info "Waiting for backend to be ready..."

    if check_backend_health; then
        print_success "Backend running at $BACKEND_URL"
    else
        print_error "Backend failed to start - check $LOG_FILE for errors"
        print_info "Last 10 lines of log:"
        tail -10 "$LOG_FILE" 2>/dev/null || true
        exit 1
    fi
}

# Start frontend server
start_frontend() {
    print_step "Starting frontend server..."
    log "Starting frontend server"

    cd "$SCRIPT_DIR/web-ui"

    # Check if mkcert root CA exists for trusted HTTPS
    # macOS path
    MKCERT_CA="$HOME/Library/Application Support/mkcert/rootCA.pem"
    # Linux path
    if [ ! -f "$MKCERT_CA" ]; then
        MKCERT_CA="$HOME/.local/share/mkcert/rootCA.pem"
    fi

    if [ -f "$MKCERT_CA" ] && [ -f "certificates/localhost.pem" ]; then
        NODE_EXTRA_CA_CERTS="$MKCERT_CA" npm run dev >> "$LOG_FILE" 2>&1 &
        FRONTEND_URL="https://localhost:3000"
    else
        npm run dev:http >> "$LOG_FILE" 2>&1 &
        FRONTEND_URL="http://localhost:3000"
    fi

    FRONTEND_PID=$!
    cd "$SCRIPT_DIR"

    print_info "Waiting for frontend to be ready..."

    if check_frontend_health; then
        print_success "Frontend running at $FRONTEND_URL"
    else
        print_error "Frontend failed to start - check $LOG_FILE for errors"
        print_info "Last 10 lines of log:"
        tail -10 "$LOG_FILE" 2>/dev/null || true
        exit 1
    fi

    export FRONTEND_URL
}

# Open browser
open_browser() {
    print_step "Opening browser..."
    sleep 1

    if [ "$OS" = "Darwin" ]; then
        open "$FRONTEND_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$FRONTEND_URL"
    elif command -v gnome-open &> /dev/null; then
        gnome-open "$FRONTEND_URL"
    fi

    print_success "Browser opened"
}

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${CYAN}Shutting down Lumen...${NC}"

    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Also kill any uvicorn/node processes we started
    pkill -f "uvicorn src.api.web_api" 2>/dev/null || true

    # Note: Embedded PostgreSQL is stopped by the backend's shutdown handler
    # If needed for manual cleanup:
    # python -c "import asyncio; from src.services.embedded_postgres import get_embedded_postgres; asyncio.run(get_embedded_postgres().stop())" 2>/dev/null || true

    print_success "Servers stopped"
    echo "Goodbye!"
}

# Main function
main() {
    clear
    print_banner

    # Set up cleanup trap
    trap cleanup EXIT INT TERM

    # Initialize log
    echo "=== Lumen Startup - $(date) ===" > "$LOG_FILE"
    log "OS: $OS, Arch: $ARCH"

    echo -e "${DIM}Log file: $LOG_FILE${NC}"
    echo ""

    # Pre-flight checks
    check_not_root
    check_ports

    # Install dependencies
    if [ "$OS" = "Darwin" ]; then
        install_homebrew
    fi

    check_install_python
    check_install_node

    # Setup application
    setup_venv

    # Install Python deps first (needed for cryptography library to generate keys)
    install_python_deps

    # Now setup env file (requires cryptography for encryption key generation)
    setup_env_file

    install_node_deps

    # Try to install mkcert for trusted HTTPS
    check_install_mkcert || true

    USE_SSL="false"
    if generate_ssl_certs; then
        USE_SSL="true"
    fi

    setup_data_dir
    init_database
    run_migrations

    # Start servers
    echo ""
    echo -e "${CYAN}${BOLD}Starting servers...${NC}"
    echo ""

    start_backend $USE_SSL
    start_frontend
    open_browser

    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                   ║"
    echo "║                     Lumen is Ready!                               ║"
    echo "║                                                                   ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    echo "║                                                                   ║"
    printf "║   Frontend:  %-52s ║\n" "$FRONTEND_URL"
    printf "║   Backend:   %-52s ║\n" "$BACKEND_URL"
    printf "║   API Docs:  %-52s ║\n" "$BACKEND_URL/docs"
    echo "║                                                                   ║"
    echo "╠═══════════════════════════════════════════════════════════════════╣"
    echo "║                                                                   ║"
    echo "║   First Time Setup:                                               ║"
    echo "║   1. Create your admin account in the browser                     ║"
    echo "║   2. Add Circuit (recommended)                                    ║"
    echo "║      ...or choose a third party: Anthropic, OpenAI, Google        ║"
    echo "║   3. Configure your network credentials (Meraki, etc.)            ║"
    echo "║                                                                   ║"
    echo "║   Press Ctrl+C to stop the servers                                ║"
    echo "║                                                                   ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Keep running and monitor processes
    while true; do
        sleep 5

        if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_warning "Backend process stopped unexpectedly"
            print_info "Check logs: tail -50 $LOG_FILE"
            break
        fi
        if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_warning "Frontend process stopped unexpectedly"
            print_info "Check logs: tail -50 $LOG_FILE"
            break
        fi
    done
}

# Run main
main
