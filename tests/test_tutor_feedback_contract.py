import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from autochecker.engine import build_structured_feedback
from autochecker.spec import CheckSpec


def test_structured_feedback_has_stable_tutor_contract_fields():
    check_spec = CheckSpec.model_validate(
        {
            "id": "c1",
            "type": "file_exists",
            "hint": "Read spec and fix path.",
            "tutoring": {
                "short_reason_template": "Missing required file.",
                "detailed_reason_template": "Expected file was not found in repository.",
                "likely_cause_template": "Wrong file path or filename.",
                "next_steps": ["Create the file.", "Commit and push changes."],
            },
            "escalation": {"enabled": True, "after_failed_attempts": 2},
        }
    )
    out = build_structured_feedback(
        {
            "id": "c1",
            "status": "FAIL",
            "description": "Check file exists",
            "details": "file not found",
        },
        check_spec,
    )

    assert out["status"] == "FAIL"
    assert out["short_reason"] == "Missing required file."
    assert out["detailed_reason"] == "Expected file was not found in repository."
    assert out["likely_cause"] == "Wrong file path or filename."
    assert out["next_steps"] == ["Create the file.", "Commit and push changes."]
    assert out["escalation_state"] == "eligible"

    assert out["what_failed"] == out["short_reason"]
    assert out["why_failed"] == out["likely_cause"]
    assert out["what_to_do_next"] == out["next_steps"]


def test_structured_feedback_normalizes_unexpected_payload_shapes():
    out = build_structured_feedback(
        {
            "id": "c2",
            "status": "skip",
            "description": "Unsupported check",
            "details": "legacy path",
            "hint": None,
            "next_steps": "run the check locally",
            "what_to_do_next": "open logs",
        },
        None,
    )

    assert out["status"] == "ERROR"
    assert out["hint"] == ""
    assert out["next_steps"] == ["run the check locally"]
    assert out["what_to_do_next"] == ["open logs"]
    assert "what_failed" in out
    assert "why_failed" in out
