"""Configuration settings for Meraki Dashboard MCP Server."""

import os
from pathlib import Path
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Get the project root directory (2 levels up from this file)
PROJECT_ROOT = Path(__file__).parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Force load .env immediately on import
load_dotenv(ENV_FILE)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Database Configuration (PostgreSQL only)
    # Embedded PostgreSQL is the default - no external database required
    database_url: str = Field(
        default="",  # Set automatically by embedded PostgreSQL or via DATABASE_URL env var
        description="PostgreSQL connection URL (set automatically when using embedded PostgreSQL)"
    )
    use_embedded_postgres: bool = Field(
        default=True,
        description="Use embedded PostgreSQL server (no external database required)"
    )

    # Meraki Dashboard Configuration
    meraki_api_key: str = Field(
        default="",
        description="Meraki Dashboard API key"
    )
    meraki_org_id: str = Field(
        default="",
        description="Meraki Organization ID (auto-filled in API calls when set)"
    )
    meraki_base_url: str = Field(
        default="https://api.meraki.com/api/v1",
        description="Meraki Dashboard API base URL"
    )
    meraki_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for Meraki Dashboard connections"
    )
    catalyst_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for Catalyst Center connections"
    )
    thousandeyes_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for ThousandEyes connections"
    )
    splunk_verify_ssl: bool = Field(
        default=False,
        description="Verify SSL certificates for Splunk connections (often disabled for self-signed certs)"
    )
    cisco_circuit_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for Cisco Circuit AI connections"
    )
    anthropic_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for Anthropic (Claude) API connections"
    )
    openai_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for OpenAI API connections"
    )
    google_ai_verify_ssl: bool = Field(
        default=True,
        description="Verify SSL certificates for Google AI (Gemini) connections"
    )
    verify_ssl: bool = Field(
        default=True,
        description="Global default: Verify SSL certificates for all external API connections"
    )

    # Security Configuration
    edit_mode_enabled: bool = Field(
        default=False,
        description="Enable write operations (POST/PUT/DELETE)"
    )
    encryption_key: Optional[str] = Field(
        default=None,
        description="Fernet encryption key for credential storage"
    )
    session_secret_key: Optional[str] = Field(
        default=None,
        description="Secret key for session management - REQUIRED in .env"
    )

    def validate_session_secret(self) -> None:
        """Validate session secret is set and not a weak default."""
        weak_defaults = ["change-me-in-production", "changeme", "secret", "password", ""]
        if self.session_secret_key is None or self.session_secret_key.lower() in weak_defaults or len(self.session_secret_key) < 32:
            raise ValueError(
                "SESSION_SECRET_KEY must be set in .env file with a strong random value (at least 32 characters). "
                "Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
    session_timeout_minutes: int = Field(
        default=30,
        description="Session timeout in minutes"
    )

    # Server Configuration
    mcp_server_host: str = Field(
        default="0.0.0.0",
        description="MCP server bind host"
    )
    mcp_server_port: int = Field(
        default=8080,
        description="MCP server port"
    )
    log_level: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"
    )

    # API Configuration
    api_timeout: int = Field(
        default=30,
        description="Meraki Dashboard API request timeout in seconds"
    )
    api_retry_attempts: int = Field(
        default=3,
        description="Number of retry attempts for failed API requests"
    )

    # Redis Configuration (for session persistence and caching)
    redis_url: Optional[str] = Field(
        default=None,
        description="Redis connection URL (e.g., redis://localhost:6379/0)"
    )
    redis_session_ttl: int = Field(
        default=3600,
        description="Session TTL in Redis (seconds)"
    )
    tool_cache_ttl: int = Field(
        default=300,
        description="Tool response cache TTL (seconds)"
    )
    tool_cache_enabled: bool = Field(
        default=True,
        description="Enable tool response caching"
    )

    # AI Conversation Configuration
    conversation_history_limit: int = Field(
        default=20,
        description="Maximum number of conversation messages to include in context"
    )

    # AI Cost Limits
    workflow_ai_cost_cap_usd: float = Field(
        default=5.0,
        description="Maximum AI cost per workflow execution in USD (prevents runaway costs)"
    )
    daily_ai_cost_cap_usd: float = Field(
        default=100.0,
        description="Maximum total AI cost per day in USD across all operations"
    )

    # OAuth 2.0 Configuration (Google)
    google_oauth_client_id: Optional[str] = Field(
        default=None,
        description="Google OAuth 2.0 Client ID"
    )
    google_oauth_client_secret: Optional[str] = Field(
        default=None,
        description="Google OAuth 2.0 Client Secret"
    )
    oauth_redirect_uri: str = Field(
        default="https://localhost:3000/api/auth/oauth/google/callback",
        description="OAuth redirect URI after Google login (should go through frontend proxy)"
    )
    frontend_url: str = Field(
        default="https://localhost:3000",
        description="Frontend URL for OAuth redirects after login"
    )

    # Duo MFA Configuration
    duo_integration_key: Optional[str] = Field(
        default=None,
        description="Duo Security Integration Key (ikey)"
    )
    duo_secret_key: Optional[str] = Field(
        default=None,
        description="Duo Security Secret Key (skey)"
    )
    duo_api_hostname: Optional[str] = Field(
        default=None,
        description="Duo Security API hostname (e.g., api-XXXXXXXX.duosecurity.com)"
    )
    mfa_enabled: bool = Field(
        default=False,
        description="Enable MFA for all users (requires Duo configuration)"
    )

    # AI Configuration
    anthropic_api_key: Optional[str] = Field(
        default=None,
        description="Anthropic API key for Claude AI services"
    )
    openai_api_key: Optional[str] = Field(
        default=None,
        description="OpenAI API key for GPT models"
    )
    google_api_key: Optional[str] = Field(
        default=None,
        description="Google API key for Gemini models"
    )

    # Embedding Configuration
    embedding_provider: str = Field(
        default="local",
        description="Embedding provider: 'local' (e5-small-v2, default) or 'openai' (requires API key)"
    )

    # Cisco Circuit AI Configuration
    cisco_circuit_client_id: Optional[str] = Field(
        default=None,
        description="Cisco Circuit OAuth Client ID"
    )
    cisco_circuit_client_secret: Optional[str] = Field(
        default=None,
        description="Cisco Circuit OAuth Client Secret"
    )
    cisco_circuit_app_key: Optional[str] = Field(
        default=None,
        description="Cisco Circuit App Key for API access"
    )

    # ThousandEyes Configuration
    thousandeyes_oauth_token: Optional[str] = Field(
        default=None,
        description="ThousandEyes OAuth Bearer Token for API access"
    )

    # Webhook Configuration for Live Cards
    meraki_webhook_secret: str = Field(
        default="",
        description="Meraki Dashboard webhook shared secret for signature verification"
    )
    thousandeyes_webhook_secret: str = Field(
        default="",
        description="ThousandEyes webhook authorization token"
    )
    splunk_webhook_token: str = Field(
        default="",
        description="Splunk alert action webhook token"
    )
    live_card_poll_interval: int = Field(
        default=30,
        description="Polling interval in seconds for live cards without webhook support"
    )

    # Notification Settings (for workflow actions)
    slack_webhook_url: str = Field(
        default="",
        description="Default Slack webhook URL for workflow notifications"
    )
    teams_webhook_url: str = Field(
        default="",
        description="Default Microsoft Teams webhook URL for workflow notifications"
    )
    pagerduty_routing_key: str = Field(
        default="",
        description="Default PagerDuty Events API v2 routing key"
    )

    # SMTP Email Settings (for workflow notifications)
    smtp_host: str = Field(
        default="",
        description="SMTP server hostname"
    )
    smtp_port: int = Field(
        default=587,
        description="SMTP server port (587 for TLS, 465 for SSL)"
    )
    smtp_user: str = Field(
        default="",
        description="SMTP authentication username"
    )
    smtp_password: str = Field(
        default="",
        description="SMTP authentication password"
    )
    smtp_from: str = Field(
        default="lumen@example.com",
        description="Default 'From' email address for notifications"
    )

    # Splunk HEC Settings (for workflow logging)
    splunk_hec_url: str = Field(
        default="",
        description="Splunk HTTP Event Collector URL (e.g., https://splunk:8088)"
    )
    splunk_hec_token: str = Field(
        default="",
        description="Splunk HEC authentication token"
    )

    # Webex Settings (for workflow notifications)
    webex_webhook_url: str = Field(
        default="",
        description="Webex Incoming Webhook URL for workflow notifications"
    )
    webex_bot_token: str = Field(
        default="",
        description="Webex Bot token for sending messages (alternative to webhook)"
    )
    webex_room_id: str = Field(
        default="",
        description="Default Webex room/space ID for notifications"
    )

    # CMDB Integration Settings
    cmdb_webhook_url: str = Field(
        default="",
        description="Webhook URL for CMDB updates (e.g., ServiceNow, Freshservice)"
    )
    cmdb_api_key: str = Field(
        default="",
        description="API key for CMDB authentication"
    )

    # Remediation Settings
    quarantine_vlan_id: int = Field(
        default=999,
        description="Default VLAN ID for quarantined devices"
    )

    # Available AI Models (grouped by provider) with cost and performance data
    # Cost is per 1K tokens (input/output)
    # Speed: 1-5 scale (5 = fastest)
    # Capability: 1-5 scale (5 = most capable)
    @property
    def available_models(self) -> dict:
        """Return available AI models grouped by provider with cost and benchmark data."""
        return {
            "anthropic": [
                {
                    "id": "claude-sonnet-4-5-20250929",
                    "name": "Claude Sonnet 4.5",
                    "description": "Best balance of speed and capability",
                    "cost_input_1k": 0.003,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 200000,
                    "best_for": ["coding", "analysis", "general"]
                },
                {
                    "id": "claude-3-5-sonnet-20241022",
                    "name": "Claude 3.5 Sonnet",
                    "description": "Previous generation, fast and capable",
                    "cost_input_1k": 0.003,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 4,
                    "context_window": 200000,
                    "best_for": ["coding", "analysis"]
                },
                {
                    "id": "claude-3-5-haiku-20241022",
                    "name": "Claude 3.5 Haiku",
                    "description": "Fastest, best for simple tasks",
                    "cost_input_1k": 0.0008,
                    "cost_output_1k": 0.004,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 200000,
                    "best_for": ["simple tasks", "quick responses"]
                },
                {
                    "id": "claude-3-opus-20240229",
                    "name": "Claude 3 Opus",
                    "description": "Most capable, slower",
                    "cost_input_1k": 0.015,
                    "cost_output_1k": 0.075,
                    "speed": 2,
                    "capability": 5,
                    "context_window": 200000,
                    "best_for": ["complex reasoning", "research"]
                },
            ],
            "openai": [
                {
                    "id": "gpt-4o",
                    "name": "GPT-4o",
                    "description": "Most capable OpenAI model",
                    "cost_input_1k": 0.005,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 128000,
                    "best_for": ["general", "coding", "vision"]
                },
                {
                    "id": "gpt-4o-mini",
                    "name": "GPT-4o Mini",
                    "description": "Fast and cost-effective",
                    "cost_input_1k": 0.00015,
                    "cost_output_1k": 0.0006,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 128000,
                    "best_for": ["simple tasks", "cost-sensitive"]
                },
                {
                    "id": "gpt-4-turbo",
                    "name": "GPT-4 Turbo",
                    "description": "High capability with faster response",
                    "cost_input_1k": 0.01,
                    "cost_output_1k": 0.03,
                    "speed": 3,
                    "capability": 4,
                    "context_window": 128000,
                    "best_for": ["coding", "analysis"]
                },
                {
                    "id": "o1-preview",
                    "name": "o1 Preview",
                    "description": "Advanced reasoning model",
                    "cost_input_1k": 0.015,
                    "cost_output_1k": 0.06,
                    "speed": 2,
                    "capability": 5,
                    "context_window": 128000,
                    "best_for": ["complex reasoning", "math", "science"]
                },
            ],
            "google": [
                {
                    "id": "gemini-1.5-pro",
                    "name": "Gemini 1.5 Pro",
                    "description": "Most capable Gemini model",
                    "cost_input_1k": 0.00125,
                    "cost_output_1k": 0.005,
                    "speed": 3,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["long context", "analysis"]
                },
                {
                    "id": "gemini-1.5-flash",
                    "name": "Gemini 1.5 Flash",
                    "description": "Fast and efficient",
                    "cost_input_1k": 0.000075,
                    "cost_output_1k": 0.0003,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 1000000,
                    "best_for": ["simple tasks", "cost-sensitive"]
                },
            ],
            "cisco": [
                # === FREE TIER MODELS ===
                {
                    "id": "cisco-gpt-4.1",
                    "name": "GPT-4.1",
                    "description": "Cisco Circuit GPT-4.1 - 120K free tier, 1M pay-as-you-use",
                    "cost_input_1k": 0.002,
                    "cost_output_1k": 0.008,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 120000,
                    "best_for": ["enterprise", "networking", "cisco"],
                    "tier": "free"
                },
                {
                    "id": "cisco-gpt-4o-mini",
                    "name": "GPT-4o Mini",
                    "description": "Fast and efficient via Cisco Circuit - 120K tokens",
                    "cost_input_1k": 0.00015,
                    "cost_output_1k": 0.0006,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 120000,
                    "best_for": ["simple tasks", "cost-sensitive"],
                    "tier": "free"
                },
                {
                    "id": "cisco-gpt-4o",
                    "name": "GPT-4o",
                    "description": "OpenAI GPT-4o via Cisco Circuit - 120K tokens",
                    "cost_input_1k": 0.005,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 120000,
                    "best_for": ["general", "analysis", "reasoning"],
                    "tier": "free"
                },
                # === PREMIUM TIER MODELS ===
                {
                    "id": "cisco-o4-mini",
                    "name": "o4-mini (Premium)",
                    "description": "OpenAI o4-mini reasoning model - 200K tokens",
                    "cost_input_1k": 0.003,
                    "cost_output_1k": 0.012,
                    "speed": 4,
                    "capability": 4,
                    "context_window": 200000,
                    "best_for": ["reasoning", "analysis"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-o3",
                    "name": "o3 (Premium)",
                    "description": "OpenAI o3 advanced reasoning model - 200K tokens",
                    "cost_input_1k": 0.015,
                    "cost_output_1k": 0.060,
                    "speed": 3,
                    "capability": 5,
                    "context_window": 200000,
                    "best_for": ["complex reasoning", "problem solving"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gpt-5",
                    "name": "GPT-5 (Premium)",
                    "description": "OpenAI GPT-5 flagship model - 270K tokens",
                    "cost_input_1k": 0.030,
                    "cost_output_1k": 0.090,
                    "speed": 3,
                    "capability": 5,
                    "context_window": 270000,
                    "best_for": ["complex tasks", "advanced analysis"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gpt-5-chat",
                    "name": "GPT-5 Chat (Premium)",
                    "description": "OpenAI GPT-5 optimized for chat - 120K tokens",
                    "cost_input_1k": 0.020,
                    "cost_output_1k": 0.060,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 120000,
                    "best_for": ["conversation", "chat"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gpt-5-mini",
                    "name": "GPT-5 Mini (Premium)",
                    "description": "OpenAI GPT-5 Mini - 1M token context",
                    "cost_input_1k": 0.005,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["long context", "document analysis"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gpt-5-nano",
                    "name": "GPT-5 Nano (Premium)",
                    "description": "OpenAI GPT-5 Nano fast model - 1M token context",
                    "cost_input_1k": 0.001,
                    "cost_output_1k": 0.004,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 1000000,
                    "best_for": ["fast responses", "simple tasks"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gpt-4.1-mini",
                    "name": "GPT-4.1 Mini (Premium)",
                    "description": "Cisco Circuit GPT-4.1 Mini - 1M token context",
                    "cost_input_1k": 0.001,
                    "cost_output_1k": 0.003,
                    "speed": 5,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["long documents", "cost-effective"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gemini-2.5-flash",
                    "name": "Gemini 2.5 Flash (Premium)",
                    "description": "Google Gemini 2.5 Flash - 1M token context",
                    "cost_input_1k": 0.000075,
                    "cost_output_1k": 0.0003,
                    "speed": 5,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["fast responses", "long context"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-gemini-2.5-pro",
                    "name": "Gemini 2.5 Pro (Premium)",
                    "description": "Google Gemini 2.5 Pro - 1M token context",
                    "cost_input_1k": 0.00125,
                    "cost_output_1k": 0.005,
                    "speed": 4,
                    "capability": 5,
                    "context_window": 1000000,
                    "best_for": ["complex reasoning", "long documents"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-claude-sonnet-4-5",
                    "name": "Claude Sonnet 4.5 (Premium)",
                    "description": "Claude Sonnet 4.5 via Circuit (OpenAI-compatible API - native Claude features like extended thinking unavailable, use direct Anthropic for full capabilities)",
                    "cost_input_1k": 0.003,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["analysis", "coding", "writing"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-claude-sonnet-4",
                    "name": "Claude Sonnet 4 (Premium)",
                    "description": "Claude Sonnet 4 via Circuit (OpenAI-compatible API - native Claude features unavailable, use direct Anthropic for full capabilities)",
                    "cost_input_1k": 0.003,
                    "cost_output_1k": 0.015,
                    "speed": 4,
                    "capability": 4,
                    "context_window": 1000000,
                    "best_for": ["analysis", "coding", "writing"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-claude-opus-4-1",
                    "name": "Claude Opus 4.1 (Premium)",
                    "description": "Claude Opus 4.1 via Circuit (OpenAI-compatible API - native Claude features like extended thinking unavailable, use direct Anthropic for full capabilities)",
                    "cost_input_1k": 0.015,
                    "cost_output_1k": 0.075,
                    "speed": 3,
                    "capability": 4,
                    "context_window": 200000,
                    "best_for": ["complex tasks", "deep analysis"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-claude-opus-4-5",
                    "name": "Claude Opus 4.5 (Premium)",
                    "description": "Claude Opus 4.5 via Circuit (OpenAI-compatible API - native Claude features like extended thinking unavailable, use direct Anthropic for full capabilities)",
                    "cost_input_1k": 0.015,
                    "cost_output_1k": 0.075,
                    "speed": 3,
                    "capability": 4,
                    "context_window": 200000,
                    "best_for": ["complex tasks", "deep analysis"],
                    "tier": "premium"
                },
                {
                    "id": "cisco-claude-haiku-4-5",
                    "name": "Claude Haiku 4.5 (Premium)",
                    "description": "Claude Haiku 4.5 via Circuit (OpenAI-compatible API - native Claude features unavailable, use direct Anthropic for full capabilities)",
                    "cost_input_1k": 0.0008,
                    "cost_output_1k": 0.004,
                    "speed": 5,
                    "capability": 3,
                    "context_window": 200000,
                    "best_for": ["fast responses", "simple tasks"],
                    "tier": "premium"
                },
            ],
        }

    def get_available_models_for_user(self) -> list:
        """Return only models for providers with configured API keys."""
        available = []
        if self.anthropic_api_key:
            for model in self.available_models["anthropic"]:
                available.append({**model, "provider": "anthropic"})
        if self.openai_api_key:
            for model in self.available_models["openai"]:
                available.append({**model, "provider": "openai"})
        if self.google_api_key:
            for model in self.available_models["google"]:
                available.append({**model, "provider": "google"})
        if self.cisco_circuit_client_id and self.cisco_circuit_client_secret:
            for model in self.available_models["cisco"]:
                available.append({**model, "provider": "cisco"})
        return available

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return os.getenv("ENVIRONMENT", "development").lower() == "production"

    def get_encryption_key(self) -> bytes:
        """Get encryption key for credential storage - MUST be set in .env"""
        if self.encryption_key:
            return self.encryption_key.encode()

        # ALWAYS require ENCRYPTION_KEY to be set - no random generation!
        raise ValueError(
            "ENCRYPTION_KEY must be set in .env file. "
            "Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    # Validate critical security settings
    settings.validate_session_secret()
    return settings
