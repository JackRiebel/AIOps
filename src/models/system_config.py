"""System configuration model for database-backed settings."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Index

from src.config.database import Base


class SystemConfig(Base):
    """
    Database model for system-wide configuration settings.

    This table stores configuration values that can be managed through the UI,
    replacing the need for .env file entries. Sensitive values are encrypted
    using Fernet encryption before storage.
    """
    __tablename__ = "system_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)  # Encrypted if is_encrypted=True
    is_encrypted = Column(Boolean, default=False, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Create composite index for category lookups
    __table_args__ = (
        Index('idx_system_config_category', 'category'),
    )

    def __repr__(self):
        return f"<SystemConfig(key='{self.key}', category='{self.category}', encrypted={self.is_encrypted})>"


# Configuration metadata - defines all available settings
CONFIG_DEFINITIONS = {
    # Integrations
    "meraki_api_key": {
        "category": "integrations",
        "description": "Meraki Dashboard API key",
        "sensitive": True,
        "env_var": "MERAKI_API_KEY"
    },
    "thousandeyes_oauth_token": {
        "category": "integrations",
        "description": "ThousandEyes OAuth Bearer Token",
        "sensitive": True,
        "env_var": "THOUSANDEYES_OAUTH_TOKEN"
    },
    "thousandeyes_mcp_endpoint": {
        "category": "integrations",
        "description": "ThousandEyes MCP server URL for dashboard access and AI queries",
        "sensitive": False,
        "env_var": "THOUSANDEYES_MCP_ENDPOINT"
    },
    "thousandeyes_mcp_token": {
        "category": "integrations",
        "description": "ThousandEyes MCP token (defaults to OAuth token if not set)",
        "sensitive": True,
        "env_var": "THOUSANDEYES_MCP_TOKEN"
    },
    "splunk_host": {
        "category": "integrations",
        "description": "Splunk HEC host URL",
        "sensitive": False,
        "env_var": "SPLUNK_HOST"
    },
    "splunk_hec_token": {
        "category": "integrations",
        "description": "Splunk HTTP Event Collector token",
        "sensitive": True,
        "env_var": "SPLUNK_HEC_TOKEN"
    },
    "splunk_api_url": {
        "category": "integrations",
        "description": "Splunk REST API URL for queries (port 8089)",
        "sensitive": False,
        "env_var": "SPLUNK_API_URL"
    },
    "splunk_username": {
        "category": "integrations",
        "description": "Splunk username for REST API",
        "sensitive": False,
        "env_var": "SPLUNK_USERNAME"
    },
    "splunk_password": {
        "category": "integrations",
        "description": "Splunk password for REST API",
        "sensitive": True,
        "env_var": "SPLUNK_PASSWORD"
    },
    "splunk_bearer_token": {
        "category": "integrations",
        "description": "Splunk Bearer token (alternative to username/password)",
        "sensitive": True,
        "env_var": "SPLUNK_BEARER_TOKEN"
    },
    "splunk_mcp_endpoint": {
        "category": "integrations",
        "description": "Custom Splunk MCP endpoint URL (defaults to {API URL}/services/mcp)",
        "sensitive": False,
        "env_var": "SPLUNK_MCP_ENDPOINT"
    },
    "splunk_mcp_token": {
        "category": "integrations",
        "description": "Splunk MCP encrypted token (created in Splunk > MCP Server > Create Encrypted Token)",
        "sensitive": True,
        "env_var": "SPLUNK_MCP_TOKEN"
    },
    "catalyst_center_host": {
        "category": "integrations",
        "description": "Catalyst Center (DNAC) host URL",
        "sensitive": False,
        "env_var": "CATALYST_CENTER_HOST"
    },
    "catalyst_center_username": {
        "category": "integrations",
        "description": "Catalyst Center username",
        "sensitive": False,
        "env_var": "CATALYST_CENTER_USERNAME"
    },
    "catalyst_center_password": {
        "category": "integrations",
        "description": "Catalyst Center password",
        "sensitive": True,
        "env_var": "CATALYST_CENTER_PASSWORD"
    },

    # AI Providers
    "anthropic_api_key": {
        "category": "ai",
        "description": "Anthropic API key for Claude AI services",
        "sensitive": True,
        "env_var": "ANTHROPIC_API_KEY"
    },
    "openai_api_key": {
        "category": "ai",
        "description": "OpenAI API key for GPT models",
        "sensitive": True,
        "env_var": "OPENAI_API_KEY"
    },
    "google_api_key": {
        "category": "ai",
        "description": "Google API key for Gemini models",
        "sensitive": True,
        "env_var": "GOOGLE_API_KEY"
    },
    "cisco_circuit_client_id": {
        "category": "ai",
        "description": "Cisco Circuit OAuth Client ID",
        "sensitive": True,
        "env_var": "CISCO_CIRCUIT_CLIENT_ID"
    },
    "cisco_circuit_client_secret": {
        "category": "ai",
        "description": "Cisco Circuit OAuth Client Secret",
        "sensitive": True,
        "env_var": "CISCO_CIRCUIT_CLIENT_SECRET"
    },
    "cisco_circuit_app_key": {
        "category": "ai",
        "description": "Cisco Circuit App Key for API access",
        "sensitive": True,
        "env_var": "CISCO_CIRCUIT_APP_KEY"
    },

    # Authentication
    "google_oauth_client_id": {
        "category": "auth",
        "description": "Google OAuth 2.0 Client ID",
        "sensitive": True,
        "env_var": "GOOGLE_OAUTH_CLIENT_ID"
    },
    "google_oauth_client_secret": {
        "category": "auth",
        "description": "Google OAuth 2.0 Client Secret",
        "sensitive": True,
        "env_var": "GOOGLE_OAUTH_CLIENT_SECRET"
    },
    "oauth_redirect_uri": {
        "category": "auth",
        "description": "OAuth redirect URI after Google login",
        "sensitive": False,
        "env_var": "OAUTH_REDIRECT_URI",
        "default": "https://localhost:8002/api/auth/oauth/google/callback"
    },
    "duo_integration_key": {
        "category": "auth",
        "description": "Duo Security Integration Key (ikey)",
        "sensitive": True,
        "env_var": "DUO_INTEGRATION_KEY"
    },
    "duo_secret_key": {
        "category": "auth",
        "description": "Duo Security Secret Key (skey)",
        "sensitive": True,
        "env_var": "DUO_SECRET_KEY"
    },
    "duo_api_hostname": {
        "category": "auth",
        "description": "Duo Security API hostname",
        "sensitive": False,
        "env_var": "DUO_API_HOSTNAME"
    },
    # Security - Session settings
    "session_secret_key": {
        "category": "security",
        "description": "Secret key for session management",
        "sensitive": True,
        "env_var": "SESSION_SECRET_KEY"
    },
    "session_timeout_minutes": {
        "category": "security",
        "description": "Session timeout in minutes",
        "sensitive": False,
        "env_var": "SESSION_TIMEOUT_MINUTES",
        "default": "30",
        "type": "integer"
    },

    # Permissions - Boolean toggles for system behavior
    "edit_mode_enabled": {
        "category": "permissions",
        "description": "Enable write operations (POST/PUT/DELETE) to network devices",
        "sensitive": False,
        "env_var": "EDIT_MODE_ENABLED",
        "default": "false",
        "type": "boolean"
    },
    "mfa_enabled": {
        "category": "permissions",
        "description": "Require multi-factor authentication for all users",
        "sensitive": False,
        "env_var": "MFA_ENABLED",
        "default": "false",
        "type": "boolean"
    },
    "verify_ssl": {
        "category": "permissions",
        "description": "Global default: Verify SSL certificates for external API connections",
        "sensitive": False,
        "env_var": "VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },

    # Per-service SSL verification overrides
    "meraki_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Meraki Dashboard API calls",
        "sensitive": False,
        "env_var": "MERAKI_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "catalyst_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Catalyst Center API calls",
        "sensitive": False,
        "env_var": "CATALYST_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "thousandeyes_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for ThousandEyes API calls",
        "sensitive": False,
        "env_var": "THOUSANDEYES_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "thousandeyes_agent_types": {
        "category": "integrations",
        "description": "ThousandEyes agent types to display (cloud, enterprise, enterprise-cluster, endpoint, or all)",
        "sensitive": False,
        "env_var": "THOUSANDEYES_AGENT_TYPES",
        "default": "all",
        "type": "select",
        "options": ["all", "cloud", "enterprise", "enterprise-cluster", "endpoint"]
    },
    "splunk_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Splunk API calls (often disabled for self-signed certs)",
        "sensitive": False,
        "env_var": "SPLUNK_VERIFY_SSL",
        "default": "false",
        "type": "boolean"
    },
    "cisco_circuit_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Cisco Circuit AI API calls",
        "sensitive": False,
        "env_var": "CISCO_CIRCUIT_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "anthropic_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Anthropic (Claude) API calls",
        "sensitive": False,
        "env_var": "ANTHROPIC_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "openai_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for OpenAI API calls",
        "sensitive": False,
        "env_var": "OPENAI_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },
    "google_ai_verify_ssl": {
        "category": "ssl",
        "description": "Verify SSL for Google AI (Gemini) API calls",
        "sensitive": False,
        "env_var": "GOOGLE_AI_VERIFY_SSL",
        "default": "true",
        "type": "boolean"
    },

    # Server
    "log_level": {
        "category": "server",
        "description": "Server logging verbosity level",
        "sensitive": False,
        "env_var": "LOG_LEVEL",
        "default": "INFO",
        "type": "select",
        "options": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    },
    "api_timeout": {
        "category": "server",
        "description": "API request timeout in seconds",
        "sensitive": False,
        "env_var": "API_TIMEOUT",
        "default": "30",
        "type": "integer"
    },
    "api_retry_attempts": {
        "category": "server",
        "description": "Number of retry attempts for failed API requests",
        "sensitive": False,
        "env_var": "API_RETRY_ATTEMPTS",
        "default": "3",
        "type": "integer"
    },
}
