"""Tests for the MfaChallenge model module.

Since SQLAlchemy Base is mocked (no real DB in unit tests), we test
the module's constants and verify the module loads without errors.
Full model integration tests require a running PostgreSQL instance.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

# ── Load mfa_challenge.py directly ──────────────────────────────────
_MC_PATH = Path(__file__).resolve().parents[2] / "src" / "models" / "mfa_challenge.py"
_spec = importlib.util.spec_from_file_location("mfa_challenge", _MC_PATH)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["mfa_challenge"] = _mod
_spec.loader.exec_module(_mod)

MfaChallenge = _mod.MfaChallenge
MFA_CHALLENGE_TTL_SECONDS = _mod.MFA_CHALLENGE_TTL_SECONDS


class TestMfaChallengeModule:
    def test_ttl_constant_is_five_minutes(self):
        assert MFA_CHALLENGE_TTL_SECONDS == 300

    def test_model_class_exists(self):
        assert MfaChallenge is not None

    def test_module_exports(self):
        assert hasattr(_mod, "MfaChallenge")
        assert hasattr(_mod, "MFA_CHALLENGE_TTL_SECONDS")
