# src/api/web_api.py

# Set Keras compatibility mode BEFORE any imports that might load tensorflow
import os
os.environ["TF_USE_LEGACY_KERAS"] = "1"

import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config.settings import get_settings
from src.services.background_jobs import get_scheduler
import src.middleware.session_auth as session_auth
from src.middleware.audit_logging import AuditLoggingMiddleware
from src.api.utils.errors import register_error_handlers

# Import all routes
from src.api.routes import (
    a2a, admin, canvases, cards, dashboard, health, organizations, security, audit, licenses, docs,
    network, chat, incidents, meraki, thousandeyes, splunk, costs, auth, ai_analysis,
    ai_feedback, ai_sessions, ai_traces, oauth, setup, knowledge, knowledge_feedback, knowledge_analytics,
    agents, agent_chat, websocket, webhooks, metrics, rbac, workflows, actions,
    rag_metrics, activity, wireless, topology, streaming, artifacts, network_changes,
    pending_actions, cross_platform, ai_endpoint_monitor, mcp_monitor, te_metrics
)
from src.api.routes import settings as settings_routes

app_settings = get_settings()

# Configure logging for web API
logging.basicConfig(
    level=getattr(logging, app_settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr),
    ],
    force=True  # Override any existing configuration
)

# Set specific logger levels
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Cisco AIOps Hub",
    description="Intelligent Network Operations",
    version="1.0.0",
)

# CORS Configuration - Restricted to necessary headers for security
# Additional origins can be added via CORS_ORIGINS env var (comma-separated)
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:7001",
    "http://127.0.0.1:7001",
    "https://localhost:3000",
    "https://127.0.0.1:3000",
]
extra_origins = os.environ.get("CORS_ORIGINS", "")
if extra_origins:
    cors_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Cookie",
    ],
    expose_headers=[
        "Content-Length",
        "Content-Type",
    ],
)

# Add session-based authentication middleware
app.add_middleware(session_auth.SessionAuthMiddleware)

# Add audit logging middleware (must come after SessionAuth to access user info)
app.add_middleware(AuditLoggingMiddleware)

@app.on_event("startup")
async def startup_event():
    # Start embedded PostgreSQL if enabled
    settings = get_settings()
    if settings.use_embedded_postgres:
        try:
            from src.services.embedded_postgres import get_embedded_postgres
            pg = get_embedded_postgres()
            await pg.initialize()
            success = await pg.start()
            if success:
                # Update settings with the connection string from embedded server
                settings.database_url = pg.connection_string
                # IMPORTANT: Also set environment variable so get_config_or_env() uses correct DB
                import os
                os.environ["DATABASE_URL"] = pg.connection_string
                logger.info(f"Embedded PostgreSQL started: {pg._mask_connection_string()}")
            else:
                logger.error("Failed to start embedded PostgreSQL")
                raise RuntimeError("Embedded PostgreSQL failed to start")
        except ImportError as e:
            logger.error(f"pgserver package not installed: {e}")
            raise RuntimeError("pgserver package required for embedded PostgreSQL. Install with: pip install pgserver")
    elif not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL not set and USE_EMBEDDED_POSTGRES is False. "
            "Set DATABASE_URL to a PostgreSQL connection string or enable embedded PostgreSQL."
        )

    # Initialize database and create tables
    from src.config import init_db
    await init_db()
    logger.info("Database initialized")

    scheduler = get_scheduler()
    scheduler.start()

    # Load async settings (correlation interval from database)
    await scheduler.start_async()

    # Initialize A2A Task Manager
    try:
        from src.a2a.task_manager import init_task_manager
        await init_task_manager()
        logger.info("A2A Task Manager initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize A2A Task Manager: {e}")

    # Register specialist agents for multi-agent orchestration
    try:
        from src.a2a.specialists import register_all_specialists
        registered = register_all_specialists()
        logger.info(f"Registered {len(registered)} specialist agents: {registered}")
    except Exception as e:
        logger.warning(f"Failed to register specialist agents: {e}")

    # Start WebSocket hub for live card updates
    try:
        from src.services.websocket_hub import start_websocket_hub
        await start_websocket_hub()
        logger.info("WebSocket hub started for live card updates")
    except Exception as e:
        logger.warning(f"Failed to start WebSocket hub: {e}")

    # Start live card poller for fallback polling
    try:
        from src.services.live_card_poller import start_live_card_poller
        await start_live_card_poller()
        logger.info("Live card poller started for fallback polling")
    except Exception as e:
        logger.warning(f"Failed to start live card poller: {e}")

    # Start workflow scheduler for scheduled/polling workflows
    try:
        from src.services.workflow_scheduler import start_workflow_scheduler
        await start_workflow_scheduler()
        logger.info("Workflow scheduler started for automated workflows")
    except Exception as e:
        logger.warning(f"Failed to start workflow scheduler: {e}")

    # Initialize Web Search Service for CRAG (Corrective RAG)
    web_search_service = None
    try:
        from src.services.web_search_service import init_web_search_service
        settings = get_settings()
        tavily_key = getattr(settings, 'tavily_api_key', None)
        serpapi_key = getattr(settings, 'serpapi_api_key', None)

        if tavily_key or serpapi_key:
            web_search_service = init_web_search_service(
                tavily_api_key=tavily_key,
                serpapi_api_key=serpapi_key,
            )
            logger.info(f"Web search service initialized with providers: {web_search_service.available_providers}")
        else:
            # Initialize with DuckDuckGo fallback only
            web_search_service = init_web_search_service()
            logger.info("Web search service initialized with DuckDuckGo fallback only")
    except Exception as e:
        logger.warning(f"Failed to initialize web search service: {e}")

    # Initialize Agentic RAG pipeline (if enabled)
    try:
        from src.services.agentic_rag import (
            init_agentic_rag_config,
            init_agentic_rag_llm_service,
            init_agentic_rag_orchestrator,
            get_agentic_rag_config,
        )
        from src.config.database import get_async_session
        from src.services.knowledge_service import get_knowledge_service
        from src.services.config_service import ConfigService

        # Initialize LLM service with available API keys
        # Check both .env settings AND database for API keys
        settings = get_settings()
        openai_key = getattr(settings, 'openai_api_key', None) or None
        anthropic_key = getattr(settings, 'anthropic_api_key', None) or None
        google_key = getattr(settings, 'google_api_key', None) or None

        # Also check database for API keys (user may have configured via UI)
        config_service = ConfigService()
        if not openai_key:
            openai_key = await config_service.get_config("openai_api_key")
        if not anthropic_key:
            anthropic_key = await config_service.get_config("anthropic_api_key")
        if not google_key:
            google_key = await config_service.get_config("google_api_key")

        async with get_async_session() as session:
            if openai_key or anthropic_key or google_key:
                llm_service = init_agentic_rag_llm_service(
                    openai_key=openai_key,
                    anthropic_key=anthropic_key,
                    google_key=google_key,
                    default_provider="openai" if openai_key else ("anthropic" if anthropic_key else "google"),
                )

                # Initialize config from database
                config = await init_agentic_rag_config(session)

                if config.enabled:
                    # Initialize orchestrator with web search service
                    knowledge_service = get_knowledge_service()
                    await init_agentic_rag_orchestrator(
                        session=session,
                        llm_service=llm_service,
                        knowledge_service=knowledge_service,
                        web_search_service=web_search_service,
                    )
                    logger.info("Agentic RAG pipeline initialized and enabled")
                else:
                    logger.info("Agentic RAG pipeline initialized but disabled (set agentic_rag_enabled=true to enable)")
            else:
                logger.info("Agentic RAG not initialized: no LLM API keys configured in .env or database")
    except Exception as e:
        logger.warning(f"Failed to initialize Agentic RAG pipeline: {e}")

    logger.info("Cisco AIOps Hub started with full CORS")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler = get_scheduler()
    scheduler.shutdown()

    # Stop A2A Task Manager
    try:
        from src.a2a.task_manager import shutdown_task_manager
        await shutdown_task_manager()
    except Exception as e:
        logger.warning(f"Error stopping A2A Task Manager: {e}")

    # Stop live card poller
    try:
        from src.services.live_card_poller import stop_live_card_poller
        await stop_live_card_poller()
    except Exception as e:
        logger.warning(f"Error stopping live card poller: {e}")

    # Stop workflow scheduler
    try:
        from src.services.workflow_scheduler import stop_workflow_scheduler
        await stop_workflow_scheduler()
        logger.info("Workflow scheduler stopped")
    except Exception as e:
        logger.warning(f"Error stopping workflow scheduler: {e}")

    # Stop WebSocket hub
    try:
        from src.services.websocket_hub import stop_websocket_hub
        await stop_websocket_hub()
    except Exception as e:
        logger.warning(f"Error stopping WebSocket hub: {e}")

    # Stop embedded PostgreSQL if enabled
    settings = get_settings()
    if settings.use_embedded_postgres:
        try:
            from src.services.embedded_postgres import get_embedded_postgres
            pg = get_embedded_postgres()
            await pg.stop()
            logger.info("Embedded PostgreSQL stopped")
        except Exception as e:
            logger.warning(f"Error stopping embedded PostgreSQL: {e}")

# Include all routers
app.include_router(a2a.router, tags=["A2A Protocol"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(auth.router, tags=["Authentication"])
app.include_router(oauth.router, tags=["OAuth & MFA"])
app.include_router(canvases.router, tags=["Canvases"])
app.include_router(cards.router)  # Cards have their own tags
app.include_router(health.router, tags=["Health"])
app.include_router(metrics.router, tags=["Metrics"])
app.include_router(organizations.router, tags=["Organizations"])
app.include_router(security.router, tags=["Security"])
app.include_router(audit.router, tags=["Audit"])
app.include_router(licenses.router, tags=["Licenses"])
app.include_router(docs.router, tags=["Docs"])
app.include_router(network.router, tags=["Network"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(incidents.router, tags=["Incidents"])
app.include_router(workflows.router, tags=["Workflows"])
app.include_router(meraki.router, tags=["Meraki"])
app.include_router(thousandeyes.router, tags=["ThousandEyes"])
app.include_router(splunk.router, tags=["Splunk"])
app.include_router(cross_platform.router, tags=["Cross-Platform"])
app.include_router(costs.router, tags=["Costs"])
app.include_router(settings_routes.router, tags=["Settings"])
app.include_router(ai_analysis.router, tags=["AI Analysis"])
app.include_router(ai_feedback.router, tags=["AI Feedback"])
app.include_router(ai_sessions.router, tags=["AI Sessions"])
app.include_router(ai_traces.router, tags=["AI Traces"])
app.include_router(setup.router, tags=["Setup"])
app.include_router(knowledge.router, tags=["Knowledge Base"])
app.include_router(knowledge_feedback.router, tags=["Knowledge Feedback"])
app.include_router(knowledge_analytics.router, tags=["Knowledge Analytics"])
app.include_router(agents.router, tags=["Agents"])
app.include_router(agent_chat.router, tags=["Multi-Agent Chat"])
app.include_router(websocket.router, tags=["WebSocket"])
app.include_router(webhooks.router, tags=["Webhooks"])
app.include_router(rbac.router, tags=["RBAC"])
app.include_router(actions.router, tags=["Device Actions"])
app.include_router(rag_metrics.router, tags=["RAG Metrics"])
app.include_router(activity.router, tags=["Activity Feed"])
app.include_router(wireless.router, tags=["Wireless Deep Dive"])
app.include_router(topology.router, tags=["Topology & Infrastructure"])
app.include_router(streaming.router, tags=["Streaming Chat"])
app.include_router(artifacts.router, tags=["Canvas Artifacts"])
app.include_router(network_changes.router, tags=["Network Changes"])
app.include_router(pending_actions.router, tags=["Pending Actions"])
app.include_router(ai_endpoint_monitor.router, tags=["AI Assurance"])
app.include_router(mcp_monitor.router, tags=["MCP Monitor"])
app.include_router(te_metrics.router, tags=["ThousandEyes Metrics"])

# Register standardized error handlers
register_error_handlers(app)

@app.get("/")
async def root():
    return {"message": "Cisco AIOps Hub is running!", "status": "victory"}