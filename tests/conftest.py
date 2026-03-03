"""Shared test fixtures and path setup.

The project targets Python 3.11+ but tests may run on the system Python 3.9.
We pre-populate sys.modules with mocks for all heavy dependencies AND for
src subpackages that contain 3.10+ syntax (e.g. ``X | None``), so those
files are never parsed.

This conftest runs before any test module is collected.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock

# Ensure the project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _make_mock_module(name: str) -> MagicMock:
    """Create a MagicMock that behaves like a module for import purposes."""
    mod = MagicMock()
    mod.__name__ = name
    mod.__path__ = []  # makes it look like a package
    mod.__file__ = f"<mock {name}>"
    mod.__loader__ = None
    mod.__spec__ = None
    mod.__package__ = name
    return mod


# ── Third-party stubs ────────────────────────────────────────────────
_THIRD_PARTY = [
    # ORM / DB
    "sqlalchemy", "sqlalchemy.ext", "sqlalchemy.ext.asyncio",
    "sqlalchemy.ext.declarative", "sqlalchemy.orm",
    "sqlalchemy.orm.attributes", "sqlalchemy.orm.relationships",
    "sqlalchemy.dialects", "sqlalchemy.dialects.postgresql",
    "asyncpg", "pgserver", "pgvector",
    "psycopg2", "aiosqlite", "alembic", "greenlet",
    # Pydantic
    "pydantic", "pydantic.fields", "pydantic.main",
    "pydantic_settings", "pydantic_core",
    # Web framework
    "fastapi", "fastapi.responses", "fastapi.middleware",
    "fastapi.middleware.cors", "fastapi.staticfiles",
    "uvicorn", "starlette", "starlette.requests", "starlette.responses",
    # HTTP
    "httpx", "aiohttp", "aiohttp.web",
    # Cisco SDKs
    "meraki", "catalystcentersdk",
    # AI
    "anthropic", "openai", "google", "google.generativeai",
    # Auth
    "jose", "jose.jwt", "jose.exceptions",
    "passlib", "passlib.context", "passlib.hash",
    "cryptography", "cryptography.fernet",
    "multipart",
    # Config / utils
    "dotenv", "python_dotenv",
    "yaml", "pyyaml",
    "apscheduler", "apscheduler.schedulers", "apscheduler.schedulers.asyncio",
    "rapidfuzz", "rapidfuzz.fuzz",
    "sentence_transformers", "tiktoken",
    # Doc parsing
    "pypdf", "docx",
]

for _name in _THIRD_PARTY:
    if _name not in sys.modules:
        sys.modules[_name] = _make_mock_module(_name)

# ── Pre-stub src subpackages whose files use Python 3.10+ syntax ─────
# By placing mocks in sys.modules, Python never loads/parses the real .py files.
_SRC_STUBS = [
    "src",
    "src.config",
    "src.config.settings",
    "src.config.database",
    "src.models",
    "src.models.workflow",
    "src.models.mfa_challenge",
    "src.models.user",
    "src.services",
    "src.services.config_service",
    "src.services.credential_manager",
    "src.services.meraki_api",
    "src.services.workflow_service",
    "src.services.tool_registry",
    "src.services.auth_service",
    "src.services.oauth_service",
    "src.services.duo_mfa_service",
    "src.api",
    "src.api.dependencies",
    "src.api.routes",
    "src.api.routes.auth",
    "src.api.routes.oauth",
    "src.api.utils",
    "src.api.utils.errors",
]

for _name in _SRC_STUBS:
    if _name not in sys.modules:
        sys.modules[_name] = _make_mock_module(_name)
