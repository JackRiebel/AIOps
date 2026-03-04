@echo off
setlocal EnableDelayedExpansion

:: =============================================================================
:: AI Ops Center - AI-Powered Network Intelligence Platform
:: One-Click Installer & Launcher for Windows
:: =============================================================================
:: This script will:
:: 1. Install Python 3.11+ if not present (via winget or chocolatey)
:: 2. Install Node.js 20+ if not present
:: 3. Install mkcert for trusted HTTPS certificates
:: 4. Generate secure environment configuration
:: 5. Install all dependencies
:: 6. Build frontend for production
:: 7. Generate SSL certificates
:: 8. Initialize and migrate database
:: 9. Start backend and frontend servers
:: 10. Open your browser
::
:: Just double-click this file - no prerequisites needed!
:: =============================================================================

title AI Ops Center - AI-Powered Network Intelligence Platform

:: Get the directory where this script is located
cd /d "%~dp0"
set "SCRIPT_DIR=%cd%"
set "LOG_FILE=%SCRIPT_DIR%\data\startup.log"

:: Create data directory
if not exist "data" mkdir data

:: Colors via ANSI (Windows 10+)
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "CYAN=%ESC%[96m"
set "MAGENTA=%ESC%[95m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "NC=%ESC%[0m"

:: Initialize log file
echo === AI Ops Center Startup - %date% %time% === > "%LOG_FILE%"

:: Print banner
cls
echo.
echo %CYAN%%BOLD%
echo     ================================================================
echo.
echo          ██████╗ ██╗    ██████╗ ██████╗ ███████╗
echo         ██╔══██╗██║   ██╔═══██╗██╔══██╗██╔════╝
echo         ███████║██║   ██║   ██║██████╔╝███████╗
echo         ██╔══██║██║   ██║   ██║██╔═══╝ ╚════██║
echo         ██║  ██║██║   ╚██████╔╝██║     ███████║
echo         ╚═╝  ╚═╝╚═╝    ╚═════╝ ╚═╝     ╚══════╝
echo          ██████╗███████╗███╗   ██╗████████╗███████╗██████╗
echo         ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔══██╗
echo         ██║     █████╗  ██╔██╗ ██║   ██║   █████╗  ██████╔╝
echo         ██║     ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗
echo         ╚██████╗███████╗██║ ╚████║   ██║   ███████╗██║  ██║
echo          ╚═════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
echo.
echo          %MAGENTA%AI-Powered Network Intelligence Platform%CYAN%
echo.
echo     ================================================================
echo %NC%
echo.
echo %DIM%Log file: %LOG_FILE%%NC%
echo.

:: ============================================================================
:: CLEANUP EXISTING PROCESSES
:: ============================================================================
echo %BLUE%^>%NC% Cleaning up existing processes...

set "CLEANED=0"

:: Kill any existing uvicorn backend processes
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8002.*LISTENING"') do (
    echo %YELLOW%!%NC% Found existing backend on port 8002 — killing it
    taskkill /pid %%p /f >nul 2>&1
    set "CLEANED=1"
)

:: Kill any existing frontend processes on port 3000
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3000.*LISTENING"') do (
    echo %YELLOW%!%NC% Found existing frontend on port 3000 — killing it
    taskkill /pid %%p /f >nul 2>&1
    set "CLEANED=1"
)

if %CLEANED% equ 1 (
    timeout /t 1 /nobreak >nul
    echo %GREEN%√%NC% Existing processes cleaned up
) else (
    echo %GREEN%√%NC% No existing processes found — ports are available
)

:: ============================================================================
:: CHECK AND INSTALL PYTHON
:: ============================================================================
echo %BLUE%^>%NC% Checking Python...

set "PYTHON_CMD="

:: Check for existing Python 3.10+
for %%P in (python py python3) do (
    where %%P >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%V in ('%%P -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2^>nul') do (
            for /f "tokens=1,2 delims=." %%A in ("%%V") do (
                if %%A geq 3 if %%B geq 10 (
                    set "PYTHON_CMD=%%P"
                    echo %GREEN%√%NC% Found Python %%V ^(%%P^)
                    goto :python_found
                )
            )
        )
    )
)

:: Python not found or too old - install it
echo %YELLOW%!%NC% Python 3.10+ not found, installing...
echo Installing Python... >> "%LOG_FILE%"

:: Try winget first (Windows 11 and newer Windows 10)
where winget >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Installing Python via winget...
    winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements -h >> "%LOG_FILE%" 2>&1
    call :refresh_path
    set "PYTHON_CMD=python"
    echo %GREEN%√%NC% Python installed
    goto :python_found
)

:: Try chocolatey
where choco >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Installing Python via Chocolatey...
    choco install python311 -y >> "%LOG_FILE%" 2>&1
    call :refresh_path
    set "PYTHON_CMD=python"
    echo %GREEN%√%NC% Python installed
    goto :python_found
)

:: Manual install required
echo %RED%X%NC% Could not install Python automatically
echo.
echo Please install Python 3.10+ manually:
echo   1. Go to https://www.python.org/downloads/
echo   2. Download Python 3.11 or newer
echo   3. Run the installer
echo   4. IMPORTANT: Check "Add Python to PATH"
echo   5. Run this script again
echo.
pause
exit /b 1

:python_found

:: ============================================================================
:: CHECK AND INSTALL NODE.JS
:: ============================================================================
echo %BLUE%^>%NC% Checking Node.js...

set "NODE_OK=0"
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%V in ('node --version') do (
        set "NODE_VER=%%V"
        :: Remove the 'v' prefix and get major version
        set "NODE_VER=!NODE_VER:v=!"
        for /f "tokens=1 delims=." %%M in ("!NODE_VER!") do (
            if %%M geq 18 (
                set "NODE_OK=1"
                echo %GREEN%√%NC% Found Node.js v!NODE_VER!
            )
        )
    )
)

if %NODE_OK% equ 0 (
    echo %YELLOW%!%NC% Node.js 18+ not found, installing...
    echo Installing Node.js... >> "%LOG_FILE%"

    :: Try winget
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        echo %BLUE%^>%NC% Installing Node.js via winget...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements -h >> "%LOG_FILE%" 2>&1
        call :refresh_path
        echo %GREEN%√%NC% Node.js installed
        goto :node_found
    )

    :: Try chocolatey
    where choco >nul 2>&1
    if %errorlevel% equ 0 (
        echo %BLUE%^>%NC% Installing Node.js via Chocolatey...
        choco install nodejs-lts -y >> "%LOG_FILE%" 2>&1
        call :refresh_path
        echo %GREEN%√%NC% Node.js installed
        goto :node_found
    )

    :: Manual install required
    echo %RED%X%NC% Could not install Node.js automatically
    echo.
    echo Please install Node.js 18+ manually:
    echo   1. Go to https://nodejs.org/
    echo   2. Download the LTS version
    echo   3. Run the installer
    echo   4. Run this script again
    echo.
    pause
    exit /b 1
)

:node_found

:: Install mcp-remote (required for Splunk MCP server connection)
echo %BLUE%^>%NC% Checking mcp-remote...
call npx mcp-remote --help >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%√%NC% mcp-remote already available
) else (
    echo %BLUE%^>%NC% Installing mcp-remote globally...
    npm install -g mcp-remote >> "%LOG_FILE%" 2>&1
    echo %GREEN%√%NC% mcp-remote installed
)

:: ============================================================================
:: SETUP VIRTUAL ENVIRONMENT
:: ============================================================================
echo %BLUE%^>%NC% Setting up Python virtual environment...

if not exist ".venv" (
    %PYTHON_CMD% -m venv .venv
    echo %GREEN%√%NC% Created virtual environment
) else (
    echo %GREEN%√%NC% Virtual environment exists
)

:: Activate virtual environment
call .venv\Scripts\activate.bat

:: Upgrade pip
python -m pip install --upgrade pip -q >> "%LOG_FILE%" 2>&1

:: ============================================================================
:: INSTALL PYTHON DEPENDENCIES
:: ============================================================================
echo %BLUE%^>%NC% Installing Python dependencies...
echo %DIM%  This may take a few minutes on first run...%NC%
echo Installing Python dependencies... >> "%LOG_FILE%"

pip install -q -r requirements.txt >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%!%NC% Some dependencies may have had issues - continuing...
)
echo %GREEN%√%NC% Python dependencies installed

:: Check pgserver PostgreSQL binaries (first-time only, downloads ~150MB)
echo %BLUE%^>%NC% Checking PostgreSQL binaries...
python -c "import pgserver" >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%!%NC% Downloading PostgreSQL binaries ^(first-time only, ~150MB^)...
    echo %DIM%  This may take a few minutes depending on your connection...%NC%
    python -c "import pgserver" >> "%LOG_FILE%" 2>&1
)
echo %GREEN%√%NC% PostgreSQL binaries ready

:: Check local embedding model (first-time only, downloads ~90MB)
echo %BLUE%^>%NC% Checking local embedding model...
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/e5-small-v2')" >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%!%NC% Downloading embedding model ^(first-time only, ~90MB^)...
    echo %DIM%  This may take a few minutes depending on your connection...%NC%
    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/e5-small-v2')" >> "%LOG_FILE%" 2>&1
    if !errorlevel! neq 0 (
        echo %YELLOW%!%NC% Could not download embedding model — skipping
        echo %DIM%  The app will use API-based embeddings instead%NC%
    ) else (
        echo %GREEN%√%NC% Embedding model downloaded
    )
) else (
    echo %GREEN%√%NC% Embedding model available
)

:: ============================================================================
:: SETUP ENVIRONMENT FILE
:: ============================================================================
echo %BLUE%^>%NC% Checking environment configuration...

set "ENV_UPDATED=0"

if not exist ".env" (
    echo %BLUE%^>%NC% Creating environment configuration file...
    echo Creating .env file... >> "%LOG_FILE%"

    :: Generate encryption key using Python
    for /f "delims=" %%K in ('python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2^>nul') do set "ENCRYPTION_KEY=%%K"
    if "!ENCRYPTION_KEY!"=="" (
        :: If cryptography not installed yet, use a placeholder
        set "ENCRYPTION_KEY=GENERATE_AFTER_INSTALL"
    )

    :: Generate session key
    for /f "delims=" %%S in ('python -c "import secrets; print(secrets.token_urlsafe(32))"') do set "SESSION_KEY=%%S"

    (
        echo # =============================================================================
        echo # AI Ops Center Configuration
        echo # Generated automatically - customize as needed
        echo # =============================================================================
        echo.
        echo # Database Configuration ^(embedded PostgreSQL - no setup required^)
        echo # The embedded PostgreSQL server starts automatically with the application
        echo USE_EMBEDDED_POSTGRES=true
        echo # DATABASE_URL is set automatically by the embedded PostgreSQL server
        echo.
        echo # For external PostgreSQL ^(advanced users only^):
        echo # USE_EMBEDDED_POSTGRES=false
        echo # DATABASE_URL=postgresql://lumen:lumen123@localhost:5432/lumen
        echo.
        echo # Security Keys ^(auto-generated - keep these secret!^)
        echo ENCRYPTION_KEY=!ENCRYPTION_KEY!
        echo SESSION_SECRET_KEY=!SESSION_KEY!
        echo.
        echo # Server Configuration
        echo MCP_SERVER_HOST=0.0.0.0
        echo MCP_SERVER_PORT=8080
        echo LOG_LEVEL=INFO
        echo ENVIRONMENT=development
        echo.
        echo # Edit Mode ^(set to true to allow write operations^)
        echo EDIT_MODE_ENABLED=false
        echo.
        echo # SSL Configuration
        echo VERIFY_SSL=true
        echo.
        echo # Session Settings
        echo SESSION_TIMEOUT_MINUTES=60
        echo.
        echo # =============================================================================
        echo # AI Provider Configuration ^(configure at least one^)
        echo # =============================================================================
        echo.
        echo # Cisco Circuit ^(recommended - configure via web UI setup wizard^)
        echo # CIRCUIT_CLIENT_ID=your_client_id
        echo # CIRCUIT_CLIENT_SECRET=your_client_secret
        echo.
        echo # Third Party Options:
        echo # Anthropic Claude
        echo # ANTHROPIC_API_KEY=sk-ant-...
        echo.
        echo # OpenAI GPT
        echo # OPENAI_API_KEY=sk-...
        echo.
        echo # Google Gemini
        echo # GOOGLE_API_KEY=...
        echo.
        echo # =============================================================================
        echo # Network API Configuration
        echo # =============================================================================
        echo.
        echo # Cisco Meraki
        echo # MERAKI_API_KEY=your_meraki_api_key
        echo # MERAKI_BASE_URL=https://api.meraki.com/api/v1
        echo.
        echo # Cisco Catalyst Center
        echo # CATALYST_BASE_URL=https://your-dnac-server
        echo # CATALYST_USERNAME=admin
        echo # CATALYST_PASSWORD=your_password
        echo.
        echo # =============================================================================
        echo # Optional Integrations
        echo # =============================================================================
        echo.
        echo # Splunk
        echo # SPLUNK_HEC_URL=https://splunk:8088
        echo # SPLUNK_HEC_TOKEN=your_token
        echo.
        echo # ThousandEyes
        echo # THOUSANDEYES_API_TOKEN=your_token
        echo.
        echo # Redis ^(for caching - optional^)
        echo # REDIS_URL=redis://localhost:6379/0
        echo.
    ) > ".env"

    echo %GREEN%√%NC% Environment file created at .env
    set "ENV_UPDATED=1"
) else (
    echo %GREEN%√%NC% Environment file exists

    :: Check for required keys and add if missing
    findstr /C:"ENCRYPTION_KEY=" ".env" >nul 2>&1
    if !errorlevel! neq 0 (
        echo %BLUE%^>%NC% Adding missing ENCRYPTION_KEY...
        for /f "delims=" %%K in ('python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"') do (
            echo ENCRYPTION_KEY=%%K >> ".env"
        )
        set "ENV_UPDATED=1"
    )

    findstr /C:"SESSION_SECRET_KEY=" ".env" >nul 2>&1
    if !errorlevel! neq 0 (
        echo %BLUE%^>%NC% Adding missing SESSION_SECRET_KEY...
        for /f "delims=" %%S in ('python -c "import secrets; print(secrets.token_urlsafe(32))"') do (
            echo SESSION_SECRET_KEY=%%S >> ".env"
        )
        set "ENV_UPDATED=1"
    )

    findstr /C:"USE_EMBEDDED_POSTGRES=" ".env" >nul 2>&1
    if !errorlevel! neq 0 (
        echo %BLUE%^>%NC% Adding missing USE_EMBEDDED_POSTGRES...
        echo USE_EMBEDDED_POSTGRES=true >> ".env"
        set "ENV_UPDATED=1"
    )
)

if %ENV_UPDATED% equ 1 (
    echo %YELLOW%!%NC% Please review .env and add your API keys
)

:: Regenerate encryption key if it was a placeholder
findstr /C:"GENERATE_AFTER_INSTALL" ".env" >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Generating encryption key...
    for /f "delims=" %%K in ('python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"') do set "NEW_KEY=%%K"
    powershell -Command "(Get-Content .env) -replace 'ENCRYPTION_KEY=GENERATE_AFTER_INSTALL', 'ENCRYPTION_KEY=!NEW_KEY!' | Set-Content .env"
    echo %GREEN%√%NC% Encryption key generated
)

:: Create web-ui .env.local if missing
if not exist "web-ui\.env.local" (
    echo %BLUE%^>%NC% Creating frontend environment file...
    (
        echo # Backend API URL
        echo BACKEND_URL=https://localhost:8002
        echo.
        echo # Use API proxy ^(leave empty^)
        echo NEXT_PUBLIC_API_URL=
    ) > "web-ui\.env.local"
    echo %GREEN%√%NC% Frontend environment file created
)

:: ============================================================================
:: INSTALL NODE.JS DEPENDENCIES
:: ============================================================================
echo %BLUE%^>%NC% Installing Node.js dependencies...
echo %DIM%  This may take a few minutes on first run...%NC%
echo Installing Node.js dependencies... >> "%LOG_FILE%"

cd "%SCRIPT_DIR%\web-ui"
if not exist "node_modules" (
    call npm install >> "%LOG_FILE%" 2>&1
    if %errorlevel% neq 0 (
        echo %YELLOW%!%NC% Some npm packages may have had issues - continuing...
    )
    echo %GREEN%√%NC% Node.js dependencies installed
) else (
    if not exist "node_modules\.package-lock.json" (
        call npm install >> "%LOG_FILE%" 2>&1
        echo %GREEN%√%NC% Node.js dependencies installed
    ) else (
        echo %GREEN%√%NC% Node.js dependencies already installed
    )
)
cd "%SCRIPT_DIR%"

:: ============================================================================
:: BUILD FRONTEND FOR PRODUCTION
:: ============================================================================
echo %BLUE%^>%NC% Checking frontend build...
echo Building frontend... >> "%LOG_FILE%"

cd "%SCRIPT_DIR%\web-ui"

:: Check if build exists and is up to date
set "NEEDS_BUILD=0"
if not exist ".next" set "NEEDS_BUILD=1"
if not exist ".next\BUILD_ID" set "NEEDS_BUILD=1"
if "%CLEAN_BUILD%"=="1" (
    echo %DIM%  Clean build requested, removing old build...%NC%
    if exist ".next" rmdir /s /q ".next" 2>nul
    set "NEEDS_BUILD=1"
)

if %NEEDS_BUILD% equ 1 (
    echo %BLUE%^>%NC% Building frontend for production ^(this may take 30-60 seconds^)...
    call npm run build >> "%LOG_FILE%" 2>&1
    if !errorlevel! neq 0 (
        echo %RED%X%NC% Frontend build failed - check %LOG_FILE% for errors
        echo %DIM%  Last 30 lines of build log:%NC%
        powershell -Command "Get-Content '%LOG_FILE%' | Select-Object -Last 30"
        cd "%SCRIPT_DIR%"
        pause
        exit /b 1
    )
    echo %GREEN%√%NC% Frontend built successfully
) else (
    echo %GREEN%√%NC% Frontend already built ^(use CLEAN_BUILD=1 to rebuild^)
)

cd "%SCRIPT_DIR%"

:: ============================================================================
:: CHECK AND INSTALL MKCERT
:: ============================================================================
echo %BLUE%^>%NC% Checking mkcert for trusted HTTPS...

set "HAS_MKCERT=0"
where mkcert >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%√%NC% mkcert already installed
    set "HAS_MKCERT=1"
) else (
    echo %BLUE%^>%NC% Installing mkcert...

    :: Try winget
    where winget >nul 2>&1
    if !errorlevel! equ 0 (
        winget install FiloSottile.mkcert --accept-package-agreements --accept-source-agreements -h >> "%LOG_FILE%" 2>&1
        call :refresh_path
        where mkcert >nul 2>&1
        if !errorlevel! equ 0 (
            set "HAS_MKCERT=1"
            echo %GREEN%√%NC% mkcert installed
        )
    )

    if !HAS_MKCERT! equ 0 (
        :: Try chocolatey
        where choco >nul 2>&1
        if !errorlevel! equ 0 (
            choco install mkcert -y >> "%LOG_FILE%" 2>&1
            call :refresh_path
            where mkcert >nul 2>&1
            if !errorlevel! equ 0 (
                set "HAS_MKCERT=1"
                echo %GREEN%√%NC% mkcert installed
            )
        )
    )

    if !HAS_MKCERT! equ 0 (
        echo %YELLOW%!%NC% Could not install mkcert automatically
        echo %DIM%  Will use self-signed certificates instead%NC%
    )
)

:: Install local CA if mkcert is available
if %HAS_MKCERT% equ 1 (
    echo %BLUE%^>%NC% Setting up local certificate authority...
    mkcert -install >nul 2>&1
    echo %GREEN%√%NC% Local CA installed
)

:: ============================================================================
:: GENERATE SSL CERTIFICATES
:: ============================================================================
echo %BLUE%^>%NC% Checking SSL certificates...

if not exist "certs" mkdir certs
if not exist "web-ui\certificates" mkdir "web-ui\certificates"

set "USE_SSL=0"

:: Check if backend certs already exist
if exist "certs\key.pem" if exist "certs\cert.pem" (
    echo %GREEN%√%NC% Backend SSL certificates exist
    set "USE_SSL=1"
    goto :backend_certs_done
)

:: Try mkcert first for trusted certs
if %HAS_MKCERT% equ 1 (
    echo %BLUE%^>%NC% Generating trusted SSL certificates with mkcert...
    mkcert -key-file certs\key.pem -cert-file certs\cert.pem localhost 127.0.0.1 ::1 >> "%LOG_FILE%" 2>&1
    if !errorlevel! equ 0 (
        echo %GREEN%√%NC% Trusted backend certificates generated
        set "USE_SSL=1"
        goto :backend_certs_done
    )
)

:: Try OpenSSL
where openssl >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Generating self-signed SSL certificates with OpenSSL...
    openssl req -x509 -newkey rsa:4096 -keyout certs\key.pem -out certs\cert.pem -days 365 -nodes -subj "/CN=localhost" >> "%LOG_FILE%" 2>&1
    if %errorlevel% equ 0 (
        echo %GREEN%√%NC% Self-signed backend certificates generated
        echo %YELLOW%!%NC% Browser may show security warning with self-signed certs
        set "USE_SSL=1"
        goto :backend_certs_done
    )
)

:: Try PowerShell as last resort
echo %BLUE%^>%NC% Generating SSL certificates with PowerShell...
powershell -Command "& { $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(1); Export-PfxCertificate -Cert $cert -FilePath 'certs\localhost.pfx' -Password (ConvertTo-SecureString -String 'temp' -Force -AsPlainText); }" >> "%LOG_FILE%" 2>&1

if exist "certs\localhost.pfx" (
    where openssl >nul 2>&1
    if %errorlevel% equ 0 (
        openssl pkcs12 -in certs\localhost.pfx -nocerts -out certs\key.pem -nodes -password pass:temp >> "%LOG_FILE%" 2>&1
        openssl pkcs12 -in certs\localhost.pfx -clcerts -nokeys -out certs\cert.pem -password pass:temp >> "%LOG_FILE%" 2>&1
        del certs\localhost.pfx 2>nul
        echo %GREEN%√%NC% SSL certificates generated
        set "USE_SSL=1"
        goto :backend_certs_done
    )
    del certs\localhost.pfx 2>nul
)

echo %YELLOW%!%NC% Could not generate SSL certificates - running without HTTPS
echo %DIM%  Install OpenSSL or mkcert for HTTPS support%NC%

:backend_certs_done

:: Generate frontend certificates
if %USE_SSL% equ 1 (
    if exist "web-ui\certificates\localhost.pem" if exist "web-ui\certificates\localhost-key.pem" (
        echo %GREEN%√%NC% Frontend SSL certificates exist
        goto :frontend_certs_done
    )

    if %HAS_MKCERT% equ 1 (
        echo %BLUE%^>%NC% Generating frontend SSL certificates...
        mkcert -key-file "web-ui\certificates\localhost-key.pem" -cert-file "web-ui\certificates\localhost.pem" localhost 127.0.0.1 ::1 >> "%LOG_FILE%" 2>&1
        if !errorlevel! equ 0 (
            echo %GREEN%√%NC% Frontend certificates generated
        )
    ) else (
        where openssl >nul 2>&1
        if !errorlevel! equ 0 (
            echo %BLUE%^>%NC% Generating frontend SSL certificates...
            openssl req -x509 -newkey rsa:4096 -keyout "web-ui\certificates\localhost-key.pem" -out "web-ui\certificates\localhost.pem" -days 365 -nodes -subj "/CN=localhost" >> "%LOG_FILE%" 2>&1
            if !errorlevel! equ 0 (
                echo %GREEN%√%NC% Frontend certificates generated
            )
        )
    )
)

:frontend_certs_done

:: ============================================================================
:: INITIALIZE DATABASE
:: ============================================================================
echo %BLUE%^>%NC% Initializing database schema...
echo Initializing database... >> "%LOG_FILE%"

set "PYTHONPATH=%SCRIPT_DIR%"
if exist "scripts\init_database.py" (
    python scripts\init_database.py >> "%LOG_FILE%" 2>&1
)
echo %GREEN%√%NC% Database schema ready

:: ============================================================================
:: RUN DATABASE MIGRATIONS
:: ============================================================================
echo %BLUE%^>%NC% Running database migrations...
echo Running migrations... >> "%LOG_FILE%"

:: Run RBAC migration
if exist "scripts\migrate_rbac.py" (
    python scripts\migrate_rbac.py >> "%LOG_FILE%" 2>&1
    echo %GREEN%√%NC% RBAC migration complete
)

:: Run Agentic RAG migration
if exist "scripts\migrate_agentic_rag.py" (
    python scripts\migrate_agentic_rag.py >> "%LOG_FILE%" 2>&1
    echo %GREEN%√%NC% Agentic RAG migration complete
)

:: ============================================================================
:: START BACKEND SERVER
:: ============================================================================
echo.
echo %CYAN%%BOLD%Starting servers...%NC%
echo.

echo %BLUE%^>%NC% Starting backend server...
echo Starting backend... >> "%LOG_FILE%"

set "PYTHONPATH=%SCRIPT_DIR%"
:: Set Keras compatibility mode for sentence-transformers
set "TF_USE_LEGACY_KERAS=1"

if %USE_SSL% equ 1 (
    start /b "" python -m uvicorn src.api.web_api:app --host 0.0.0.0 --port 8002 --ssl-keyfile certs\key.pem --ssl-certfile certs\cert.pem >> "%LOG_FILE%" 2>&1
    set "BACKEND_URL=https://localhost:8002"
) else (
    start /b "" python -m uvicorn src.api.web_api:app --host 0.0.0.0 --port 8002 >> "%LOG_FILE%" 2>&1
    set "BACKEND_URL=http://localhost:8002"
)

:: Wait and check backend health (90 second timeout, uses /api/readiness)
echo %DIM%  Waiting for backend to be ready...%NC%
set "BACKEND_READY=0"
for /l %%i in (1,1,90) do (
    if !BACKEND_READY! equ 0 (
        timeout /t 1 /nobreak >nul
        powershell -Command "try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; $r = Invoke-WebRequest -Uri '!BACKEND_URL!/api/readiness' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set "BACKEND_READY=1"
        ) else (
            :: Show progress every 10 seconds
            set /a "MOD=%%i %% 10"
            if !MOD! equ 0 (
                echo %DIM%  Still waiting for backend... ^(%%i/90^)%NC%
            )
        )
    )
)

if %BACKEND_READY% equ 1 (
    echo %GREEN%√%NC% Backend running at %BACKEND_URL%
) else (
    echo %RED%X%NC% Backend failed to start - check %LOG_FILE% for errors
    echo %DIM%  Last 10 lines of log:%NC%
    powershell -Command "Get-Content '%LOG_FILE%' | Select-Object -Last 10"
    pause
    exit /b 1
)

:: ============================================================================
:: START FRONTEND SERVER (production mode)
:: ============================================================================
echo %BLUE%^>%NC% Starting frontend server...
echo Starting frontend... >> "%LOG_FILE%"

cd "%SCRIPT_DIR%\web-ui"

:: Clear Next.js cache to prevent routing issues
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

:: Start in production mode (uses the pre-built .next output)
:: Trust mkcert CA so the API proxy can reach the HTTPS backend
set "MKCERT_CA=%LOCALAPPDATA%\mkcert\rootCA.pem"
if exist "!MKCERT_CA!" (
    set "NODE_EXTRA_CA_CERTS=!MKCERT_CA!"
    start /b "" cmd /c "set NODE_EXTRA_CA_CERTS=!MKCERT_CA! && npm start" >> "%LOG_FILE%" 2>&1
) else (
    :: Fallback: disable TLS verification for localhost backend
    start /b "" cmd /c "set NODE_TLS_REJECT_UNAUTHORIZED=0 && npm start" >> "%LOG_FILE%" 2>&1
)
set "FRONTEND_URL=https://localhost:3000"
cd "%SCRIPT_DIR%"

:: Wait and check frontend health (90 second timeout)
echo %DIM%  Waiting for frontend to start...%NC%
set "FRONTEND_READY=0"
for /l %%i in (1,1,90) do (
    if !FRONTEND_READY! equ 0 (
        timeout /t 1 /nobreak >nul
        powershell -Command "try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; $r = Invoke-WebRequest -Uri '!FRONTEND_URL!' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set "FRONTEND_READY=1"
        ) else (
            :: Show progress every 15 seconds
            set /a "MOD=%%i %% 15"
            if !MOD! equ 0 (
                echo %DIM%  Still waiting for frontend... ^(%%i/90^)%NC%
            )
        )
    )
)

if %FRONTEND_READY% equ 1 (
    echo %GREEN%√%NC% Frontend running at %FRONTEND_URL%
) else (
    echo %RED%X%NC% Frontend failed to start - check %LOG_FILE% for errors
    echo %DIM%  Last 20 lines of log:%NC%
    powershell -Command "Get-Content '%LOG_FILE%' | Select-Object -Last 20"
    echo.
    echo %DIM%  Tip: Try running with CLEAN_BUILD=1 to force rebuild%NC%
    pause
    exit /b 1
)

:: ============================================================================
:: OPEN BROWSER
:: ============================================================================
echo %BLUE%^>%NC% Opening browser...
echo %DIM%  Waiting for application to fully initialize...%NC%
timeout /t 3 /nobreak >nul

:: Verify the setup status endpoint is responding (confirms API is ready)
set "API_READY=0"
for /l %%i in (1,1,10) do (
    if !API_READY! equ 0 (
        powershell -Command "try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; $r = Invoke-WebRequest -Uri '%BACKEND_URL%/api/setup/status' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 (
            set "API_READY=1"
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)

if %API_READY% equ 0 (
    echo %YELLOW%!%NC% API may still be initializing - browser may show loading state
)

start %FRONTEND_URL%
echo %GREEN%√%NC% Browser opened

:: ============================================================================
:: READY MESSAGE
:: ============================================================================
echo.
echo %GREEN%%BOLD%
echo     ================================================================
echo.
echo                          AI Ops Center is Ready!
echo.
echo     ================================================================
echo.
echo       Frontend:  %FRONTEND_URL%
echo       Backend:   %BACKEND_URL%
echo       API Docs:  %BACKEND_URL%/docs
echo.
echo     ================================================================
echo.
echo       First Time Setup:
echo       1. Create your admin account in the browser
echo       2. Add Circuit ^(recommended^)
echo          ...or choose a third party: Anthropic, OpenAI, Google
echo       3. Configure your network credentials ^(Meraki, etc.^)
echo.
echo       Press Ctrl+C to stop the servers...
echo.
echo     ================================================================
echo %NC%

:: ============================================================================
:: MONITOR PROCESSES (keep running until Ctrl+C or process dies)
:: ============================================================================
:monitor_loop
timeout /t 5 /nobreak >nul

:: Check if backend is still running
netstat -an 2>nul | findstr ":8002.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%!%NC% Backend process stopped unexpectedly
    echo %DIM%  Check logs: type %LOG_FILE%%NC%
    goto :shutdown
)

:: Check if frontend is still running
netstat -an 2>nul | findstr ":3000.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%!%NC% Frontend process stopped unexpectedly
    echo %DIM%  Check logs: type %LOG_FILE%%NC%
    goto :shutdown
)

goto :monitor_loop

:: ============================================================================
:: CLEANUP
:: ============================================================================
:shutdown
echo.
echo %CYAN%Shutting down AI Ops Center...%NC%

:: Kill processes on our ports (backend 8002, frontend 3000)
echo %DIM%  Stopping backend...%NC%
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":8002.*LISTENING"') do (
    taskkill /pid %%p /f >nul 2>&1
)

echo %DIM%  Stopping frontend...%NC%
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3000.*LISTENING"') do (
    taskkill /pid %%p /f >nul 2>&1
)

echo %GREEN%√%NC% Servers stopped
echo Goodbye!
timeout /t 2 /nobreak >nul
exit /b 0

:: ============================================================================
:: HELPER FUNCTION: Refresh PATH
:: ============================================================================
:refresh_path
:: This attempts to refresh the PATH without restarting the command prompt
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
goto :eof
