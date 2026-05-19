import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_check_module(monkeypatch):
    monkeypatch.setenv("BOT_TOKEN", "test-token")
    import bot.handlers.check as check_mod

    return importlib.reload(check_mod)


def test_deep_diagnostics_enriches_triggered_checks(monkeypatch):
    check_mod = _load_check_module(monkeypatch)
    checks = [
        {
            "id": "c-fail-1",
            "status": "FAIL",
            "details": "File not found\nExpected: README.md\nGot: missing",
            "short_reason": "Missing file",
            "next_steps": ["Create README.md", "Commit changes"],
            "escalation_state": "triggered",
        }
    ]

    completed = check_mod._run_deep_diagnostics(
        lab_id="lab-01",
        task_id="task-1",
        checks=checks,
        used_attempts_after_run=3,
    )

    assert completed == 1
    diag = checks[0]["diagnostic"]
    assert checks[0]["escalation_state"] == "completed"
    assert diag["version"] == "v1"
    assert diag["attempt_no"] == 3
    assert diag["check_id"] == "c-fail-1"
    assert diag["failure_status"] == "active"
    assert diag["what_failed"] == "Missing file"
    assert diag["why_failed"]
    assert diag["what_to_do_next"] == ["Create README.md", "Commit changes"]
    assert isinstance(diag["evidence_lines"], list) and diag["evidence_lines"]
    assert diag["sources"]["check_data"] == "ok"
    assert diag["sources"]["vm_snapshot"] in {"ok", "failed", "unavailable", "skipped"}
    assert diag["diagnostic_status"] in {"complete", "partial", "degraded", "missing"}
    assert "vm_snapshot" in diag


def test_deep_diagnostics_skips_non_triggered_checks(monkeypatch):
    check_mod = _load_check_module(monkeypatch)
    checks = [
        {"id": "c-pass", "status": "PASS", "details": "", "escalation_state": "none"},
        {"id": "c-eligible", "status": "FAIL", "details": "x", "escalation_state": "eligible"},
    ]

    completed = check_mod._run_deep_diagnostics(
        lab_id="lab-01",
        task_id="task-1",
        checks=checks,
        used_attempts_after_run=2,
    )

    assert completed == 0
    assert "diagnostic" not in checks[0]
    assert "diagnostic" not in checks[1]
