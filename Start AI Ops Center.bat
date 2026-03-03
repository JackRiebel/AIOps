@echo off
setlocal EnableDelayedExpansion

:: =============================================================================
:: AI Ops Center - AI-Powered Network Intelligence Platform
:: One-Click Installer & Launcher for Windows
:: =============================================================================
:: This script will:
:: 1. Install Python 3.11+ if not present (via winget or chocolatey)
:: 2. Install Node.js 20+ if not present
:: 3. Generate secure environment configuration
:: 4. Install all dependencies
:: 5. Generate SSL certificates
:: 6. Initialize and migrate database
:: 7. Start backend and frontend servers
:: 8. Open your browser
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
echo          █████╗ ██╗    ██████╗ ██████╗ ███████╗
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
:: CHECK REQUIRED PORTS
:: ============================================================================
echo %BLUE%^>%NC% Checking required ports...

set "PORTS_BLOCKED=0"

:: Check port 8002
netstat -an | findstr ":8002.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %YELLOW%!%NC% Port 8002 is already in use ^(backend^)
    set "PORTS_BLOCKED=1"
)

:: Check port 3000
netstat -an | findstr ":3000.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %YELLOW%!%NC% Port 3000 is already in use ^(frontend^)
    set "PORTS_BLOCKED=1"
)

if %PORTS_BLOCKED% equ 1 (
    echo.
    echo %YELLOW%Some ports are in use. Please close the applications using them or run:%NC%
    echo   netstat -ano ^| findstr :8002
    echo   netstat -ano ^| findstr :3000
    echo.
    set /p "CONTINUE=Continue anyway? [y/N]: "
    if /i not "!CONTINUE!"=="y" (
        echo %RED%X%NC% Cannot start with ports in use
        pause
        exit /b 1
    )
) else (
    echo %GREEN%√%NC% Ports 8002 and 3000 are available
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
echo %BLUE%^>%NC% Installing mcp-remote...
npm install -g mcp-remote >> "%LOG_FILE%" 2>&1
echo %GREEN%√%NC% mcp-remote installed

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
:: SETUP ENVIRONMENT FILE
:: ============================================================================
echo %BLUE%^>%NC% Checking environment configuration...

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
    ) > ".env"

    echo %GREEN%√%NC% Environment file created at .env
    echo %YELLOW%!%NC% Please review .env and add your API keys
) else (
    echo %GREEN%√%NC% Environment file exists
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
)
echo %GREEN%√%NC% Embedding model ready

:: Regenerate encryption key if it was a placeholder
findstr /C:"GENERATE_AFTER_INSTALL" ".env" >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Generating encryption key...
    for /f "delims=" %%K in ('python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"') do set "NEW_KEY=%%K"
    powershell -Command "(Get-Content .env) -replace 'ENCRYPTION_KEY=GENERATE_AFTER_INSTALL', 'ENCRYPTION_KEY=!NEW_KEY!' | Set-Content .env"
    echo %GREEN%√%NC% Encryption key generated
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
    echo %GREEN%√%NC% Node.js dependencies already installed
)
cd "%SCRIPT_DIR%"

:: ============================================================================
:: GENERATE SSL CERTIFICATES
:: ============================================================================
echo %BLUE%^>%NC% Checking SSL certificates...

if not exist "certs" mkdir certs

if exist "certs\key.pem" if exist "certs\cert.pem" (
    echo %GREEN%√%NC% SSL certificates exist
    set "USE_SSL=1"
    goto :ssl_done
)

:: Try to generate with OpenSSL if available
where openssl >nul 2>&1
if %errorlevel% equ 0 (
    echo %BLUE%^>%NC% Generating SSL certificates with OpenSSL...
    openssl req -x509 -newkey rsa:4096 -keyout certs\key.pem -out certs\cert.pem -days 365 -nodes -subj "/CN=localhost" >> "%LOG_FILE%" 2>&1
    if %errorlevel% equ 0 (
        echo %GREEN%√%NC% SSL certificates generated
        set "USE_SSL=1"
        goto :ssl_done
    )
)

:: Try to generate with PowerShell
echo %BLUE%^>%NC% Generating SSL certificates with PowerShell...
powershell -Command "& { $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(1); Export-PfxCertificate -Cert $cert -FilePath 'certs\localhost.pfx' -Password (ConvertTo-SecureString -String 'temp' -Force -AsPlainText); }" >> "%LOG_FILE%" 2>&1

if exist "certs\localhost.pfx" (
    :: Convert PFX to PEM using OpenSSL if available, otherwise skip SSL
    where openssl >nul 2>&1
    if %errorlevel% equ 0 (
        openssl pkcs12 -in certs\localhost.pfx -nocerts -out certs\key.pem -nodes -password pass:temp >> "%LOG_FILE%" 2>&1
        openssl pkcs12 -in certs\localhost.pfx -clcerts -nokeys -out certs\cert.pem -password pass:temp >> "%LOG_FILE%" 2>&1
        del certs\localhost.pfx 2>nul
        echo %GREEN%√%NC% SSL certificates generated
        set "USE_SSL=1"
        goto :ssl_done
    )
)

echo %YELLOW%!%NC% Could not generate SSL certificates - running without HTTPS
echo %DIM%  Install OpenSSL or use WSL for HTTPS support%NC%
set "USE_SSL=0"

:ssl_done

:: Generate frontend certificates if we have OpenSSL and backend certs
if not exist "web-ui\certificates" mkdir "web-ui\certificates"
if %USE_SSL% equ 1 (
    if not exist "web-ui\certificates\localhost.pem" (
        where openssl >nul 2>&1
        if %errorlevel% equ 0 (
            echo %BLUE%^>%NC% Generating frontend SSL certificates...
            openssl req -x509 -newkey rsa:4096 -keyout "web-ui\certificates\localhost-key.pem" -out "web-ui\certificates\localhost.pem" -days 365 -nodes -subj "/CN=localhost" >> "%LOG_FILE%" 2>&1
            if %errorlevel% equ 0 (
                echo %GREEN%√%NC% Frontend certificates generated
            )
        )
    ) else (
        echo %GREEN%√%NC% Frontend SSL certificates exist
    )
)

:: ============================================================================
:: INITIALIZE DATABASE
:: ============================================================================
echo %BLUE%^>%NC% Initializing database schema...
echo Initializing database... >> "%LOG_FILE%"

:: Note: Embedded PostgreSQL starts automatically when the backend starts
:: (managed by FastAPI lifespan in web_api.py)
:: The init_database.py script creates tables if they don't exist

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

:: Wait and check backend health
echo %DIM%  Waiting for backend to be ready...%NC%
set "BACKEND_READY=0"
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    :: Use PowerShell for health check (more reliable than curl on Windows)
    powershell -Command "try { [Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; (Invoke-WebRequest -Uri '%BACKEND_URL%/api/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        set "BACKEND_READY=1"
        goto :backend_check_done
    )
)
:backend_check_done

if %BACKEND_READY% equ 1 (
    echo %GREEN%√%NC% Backend running at %BACKEND_URL%
) else (
    echo %YELLOW%!%NC% Backend may still be starting - check %LOG_FILE% for errors
)

:: ============================================================================
:: START FRONTEND SERVER
:: ============================================================================
echo %BLUE%^>%NC% Starting frontend server...
echo Starting frontend... >> "%LOG_FILE%"

cd "%SCRIPT_DIR%\web-ui"

:: Clear Next.js cache to prevent Turbopack routing issues
if exist ".next" rmdir /s /q ".next" 2>nul
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

:: On Windows, use HTTP mode for frontend to avoid certificate issues
:: The frontend will proxy to the HTTPS backend automatically
:: This is more reliable than trying to set up trusted certs on Windows
start /b "" cmd /c "npm run dev:http" >> "%LOG_FILE%" 2>&1
set "FRONTEND_URL=http://localhost:3000"
cd "%SCRIPT_DIR%"

:: Wait and check frontend health
echo %DIM%  Waiting for frontend to be ready...%NC%
set "FRONTEND_READY=0"
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    :: Use PowerShell for health check
    powershell -Command "try { (Invoke-WebRequest -Uri '!FRONTEND_URL!' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
    if !errorlevel! equ 0 (
        set "FRONTEND_READY=1"
        goto :frontend_check_done
    )
)
:frontend_check_done

if %FRONTEND_READY% equ 1 (
    echo %GREEN%√%NC% Frontend running at !FRONTEND_URL!
) else (
    echo %YELLOW%!%NC% Frontend may still be starting - check %LOG_FILE% for errors
)

:: ============================================================================
:: OPEN BROWSER
:: ============================================================================
echo %BLUE%^>%NC% Opening browser...
timeout /t 2 /nobreak >nul
start !FRONTEND_URL!
echo %GREEN%√%NC% Browser opened

:: ============================================================================
:: READY MESSAGE
:: ============================================================================
echo.
echo %GREEN%%BOLD%
echo     ================================================================
echo.
echo                         AI Ops Center is Ready!
echo.
echo     ================================================================
echo.
echo       Frontend:  !FRONTEND_URL!
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
echo       Press any key to stop the servers and exit...
echo.
echo     ================================================================
echo %NC%

:: Wait for user to press a key
pause >nul

:: ============================================================================
:: CLEANUP
:: ============================================================================
echo.
echo %CYAN%Shutting down AI Ops Center...%NC%

:: Note: Embedded PostgreSQL is stopped automatically by FastAPI shutdown event
:: when the uvicorn process is terminated

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
