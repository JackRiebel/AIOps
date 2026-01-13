#!/bin/bash
# =============================================================================
# Lumen - Backend Restart Script
# =============================================================================
# Quick script to restart the backend server with SSL
# Usage: ./restart-backend.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}=== Lumen Backend Restart ===${NC}"

# Kill existing backend processes
echo -e "${YELLOW}Stopping existing backend processes...${NC}"
pkill -f "uvicorn src.api.web_api" 2>/dev/null || true
sleep 1

# Verify port is free
if lsof -i :8002 >/dev/null 2>&1; then
    echo -e "${RED}Port 8002 still in use. Force killing...${NC}"
    lsof -ti :8002 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Check PostgreSQL
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if pg_isready >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not running!${NC}"
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
        echo -e "${RED}Failed to start PostgreSQL. Please start it manually.${NC}"
        exit 1
    }
    sleep 2
fi

# Find Python 3.11
PYTHON_BIN="/opt/homebrew/bin/python3.11"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN=$(which python3.11 2>/dev/null || which python3 2>/dev/null)
fi

if [ -z "$PYTHON_BIN" ]; then
    echo -e "${RED}Python 3.11 not found!${NC}"
    exit 1
fi

echo -e "${GREEN}Using Python: $PYTHON_BIN${NC}"

# Check for SSL certificates
if [ ! -f "certs/key.pem" ] || [ ! -f "certs/cert.pem" ]; then
    echo -e "${RED}SSL certificates not found in certs/ directory!${NC}"
    echo -e "${YELLOW}Generate them with:${NC}"
    echo "  mkdir -p certs"
    echo "  openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj '/CN=localhost'"
    exit 1
fi

# Start backend with SSL
echo -e "${YELLOW}Starting backend server with SSL on port 8002...${NC}"
PYTHONPATH="$SCRIPT_DIR" "$PYTHON_BIN" -m uvicorn src.api.web_api:app \
    --host 0.0.0.0 \
    --port 8002 \
    --ssl-keyfile certs/key.pem \
    --ssl-certfile certs/cert.pem \
    > /tmp/lumen-backend.log 2>&1 &

BACKEND_PID=$!
echo $BACKEND_PID > /tmp/lumen-backend.pid

# Wait for startup
sleep 3

# Verify backend is running
if lsof -i :8002 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend started successfully (PID: $BACKEND_PID)${NC}"
    echo -e "${GREEN}✓ HTTPS available at: https://localhost:8002${NC}"

    # Test the endpoint
    HEALTH=$(curl -sk https://localhost:8002/api/health 2>/dev/null || echo "failed")
    if [[ "$HEALTH" == *"error"* ]] || [[ "$HEALTH" == *"success"* ]]; then
        echo -e "${GREEN}✓ API responding${NC}"
    else
        echo -e "${YELLOW}⚠ API may still be starting up${NC}"
    fi
else
    echo -e "${RED}✗ Backend failed to start!${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/lumen-backend.log${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}=== Backend Ready ===${NC}"
echo -e "Logs: ${YELLOW}tail -f /tmp/lumen-backend.log${NC}"
echo -e "Stop: ${YELLOW}pkill -f 'uvicorn src.api.web_api'${NC}"
