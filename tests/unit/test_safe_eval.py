"""Tests for the safe expression evaluator in WorkflowExecutor.

Verifies that legitimate workflow condition expressions evaluate correctly
and that known exploit payloads are blocked (return False).

Uses importlib to load ONLY workflow_executor.py (its transitive deps
are pre-stubbed in conftest.py), so we can test on Python 3.9+.
"""
from __future__ import annotations

import importlib
import importlib.util
import sys
from pathlib import Path

import pytest

# ── Load workflow_executor.py directly (bypasses __init__.py chains) ──
_WE_PATH = Path(__file__).resolve().parents[2] / "src" / "services" / "workflow_executor.py"
_spec = importlib.util.spec_from_file_location("workflow_executor", _WE_PATH)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["workflow_executor"] = _mod
_spec.loader.exec_module(_mod)

WorkflowExecutor = _mod.WorkflowExecutor
_DotDict = _mod._DotDict


@pytest.fixture
def executor():
    return WorkflowExecutor()


def _ctx(**overrides):
    """Build a minimal execution context for _evaluate_expression."""
    base = {
        "trigger_data": {},
        "variables": {},
        "step_results": {},
    }
    base.update(overrides)
    return base


# ── Legitimate expressions ───────────────────────────────────────────


class TestLegitimateExpressions:
    def test_empty_expression_returns_true(self, executor):
        assert executor._evaluate_expression("", _ctx()) is True
        assert executor._evaluate_expression("   ", _ctx()) is True

    def test_simple_comparison_gt(self, executor):
        ctx = _ctx(trigger_data={"count": 150})
        assert executor._evaluate_expression("trigger.count > 100", ctx) is True

    def test_simple_comparison_lt(self, executor):
        ctx = _ctx(trigger_data={"count": 50})
        assert executor._evaluate_expression("trigger.count > 100", ctx) is False

    def test_equality_with_js_triple_equals(self, executor):
        ctx = _ctx(trigger_data={"status": "active"})
        assert executor._evaluate_expression("trigger.status === 'active'", ctx) is True

    def test_inequality_with_js_not_equals(self, executor):
        ctx = _ctx(trigger_data={"status": "active"})
        assert executor._evaluate_expression("trigger.status !== 'inactive'", ctx) is True

    def test_boolean_and(self, executor):
        ctx = _ctx(trigger_data={"count": 150, "status": "active"})
        assert executor._evaluate_expression(
            "trigger.count > 100 && trigger.status === 'active'", ctx
        ) is True

    def test_boolean_or(self, executor):
        ctx = _ctx(trigger_data={"severity": "low", "priority": 9})
        assert executor._evaluate_expression(
            "trigger.severity === 'critical' || trigger.priority > 8", ctx
        ) is True

    def test_data_merges_trigger_and_variables(self, executor):
        ctx = _ctx(trigger_data={"a": 1}, variables={"b": 2})
        assert executor._evaluate_expression("data.a == 1 and data.b == 2", ctx) is True

    def test_nested_dict_access(self, executor):
        ctx = _ctx(trigger_data={"network": {"id": "N_123"}})
        assert executor._evaluate_expression("trigger.network.id == 'N_123'", ctx) is True

    def test_length_conversion(self, executor):
        ctx = _ctx(trigger_data={"items": [1, 2, 3]})
        assert executor._evaluate_expression("trigger.items.length > 2", ctx) is True

    def test_not_operator_does_not_mangle_not_equals(self, executor):
        ctx = _ctx(trigger_data={"status": "active"})
        assert executor._evaluate_expression("trigger.status != 'inactive'", ctx) is True

    def test_step_results_access(self, executor):
        ctx = _ctx(step_results={"step1": {"ok": True}})
        assert executor._evaluate_expression("step.step1.ok == True", ctx) is True

    def test_missing_attribute_returns_none(self, executor):
        ctx = _ctx(trigger_data={})
        assert executor._evaluate_expression("trigger.nonexistent == None", ctx) is True


# ── Security exploit payloads — all MUST return False ────────────────


class TestExploitBlocking:
    """Every expression here attempts to escape the sandbox.

    The safe evaluator must reject them (return False from the except
    branch or from simpleeval's own restrictions).
    """

    @pytest.mark.parametrize(
        "payload",
        [
            "__import__('os').system('id')",
            "__import__('subprocess').check_output('id')",
            "().__class__.__bases__[0].__subclasses__()",
            "exec('import os')",
            "eval('1+1')",
            "open('/etc/passwd').read()",
            "getattr(__builtins__, '__import__')('os')",
            "lambda: __import__('os')",
            "[x for x in ().__class__.__bases__[0].__subclasses__() if 'warning' in str(x)]",
            "type('', (), {'__init__': lambda s: __import__('os')})()",
            "globals()",
            "locals()",
            "dir()",
            "vars()",
            "compile('import os', '', 'exec')",
            "''.__class__.__mro__[1].__subclasses__()",
        ],
        ids=[
            "import_os",
            "import_subprocess",
            "class_bases_subclasses",
            "exec",
            "eval",
            "open_file",
            "getattr_builtins",
            "lambda_import",
            "list_comp_subclasses",
            "type_metaclass",
            "globals",
            "locals",
            "dir",
            "vars",
            "compile",
            "mro_subclasses",
        ],
    )
    def test_exploit_blocked(self, executor, payload):
        ctx = _ctx()
        result = executor._evaluate_expression(payload, ctx)
        assert result is False, f"Exploit payload was not blocked: {payload}"


# ── _DotDict unit tests ─────────────────────────────────────────────


class TestDotDict:
    def test_attribute_access(self):
        d = _DotDict({"a": 1, "b": "hello"})
        assert d.a == 1
        assert d.b == "hello"

    def test_missing_key_returns_none(self):
        d = _DotDict({})
        assert d.missing is None

    def test_nested_dict_becomes_dotdict(self):
        d = _DotDict({"nested": {"x": 42}})
        assert d.nested.x == 42

    def test_dict_access_still_works(self):
        d = _DotDict({"key": "value"})
        assert d["key"] == "value"
