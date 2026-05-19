import asyncio
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

_APP_PATH = Path(__file__).resolve().parents[1] / "dashboard" / "app.py"
_SPEC = importlib.util.spec_from_file_location("dashboard_app_under_test", _APP_PATH)
dash = importlib.util.module_from_spec(_SPEC)
assert _SPEC and _SPEC.loader
_SPEC.loader.exec_module(dash)


client = TestClient(dash.app)


async def _noop_log(email: str, endpoint: str, tenant_id: str) -> None:
    return None


def test_api_logs_forbidden_for_student(monkeypatch):
    async def fake_auth(_request):
        return {"email": "s@u", "role": "student", "tenant_id": "uni-a"}

    monkeypatch.setattr(dash, "_verify_basic_auth", fake_auth)
    monkeypatch.setattr(dash, "_log_api_access", _noop_log)

    resp = client.get("/api/logs")
    assert resp.status_code == 403
    assert resp.json()["error"] == "forbidden"


def test_teacher_cannot_override_tenant(monkeypatch):
    async def fake_auth(_request):
        return {"email": "t@u", "role": "teacher", "tenant_id": "uni-a"}

    async def fake_rows(*args, **kwargs):
        return []

    monkeypatch.setattr(dash, "_verify_basic_auth", fake_auth)
    monkeypatch.setattr(dash, "_log_api_access", _noop_log)
    monkeypatch.setattr(dash, "_load_latest_results_rows", fake_rows)

    resp = client.get("/api/teacher/summary/cohort?tenant_id=uni-b")
    assert resp.status_code == 200
    assert resp.json()["tenant_id"] == "uni-a"


def test_superadmin_can_override_tenant(monkeypatch):
    async def fake_auth(_request):
        return {"email": "sa@u", "role": "superadmin", "tenant_id": "root"}

    async def fake_rows(*args, **kwargs):
        return []

    monkeypatch.setattr(dash, "_verify_basic_auth", fake_auth)
    monkeypatch.setattr(dash, "_log_api_access", _noop_log)
    monkeypatch.setattr(dash, "_load_latest_results_rows", fake_rows)

    resp = client.get("/api/teacher/summary/cohort?tenant_id=uni-b")
    assert resp.status_code == 200
    assert resp.json()["tenant_id"] == "uni-b"


def test_latest_results_query_scopes_users_tenant(monkeypatch):
    captured = {}

    def fake_pg_fetchall_sync(sql: str, params: tuple = ()):
        captured["sql"] = sql
        captured["params"] = params
        return []

    async def run():
        prev = dash.USE_POSTGRES
        try:
            dash.USE_POSTGRES = True
            monkeypatch.setattr(dash, "_pg_fetchall_sync", fake_pg_fetchall_sync)
            rows = await dash._load_latest_results_rows(None, tenant_id="uni-z")
            assert rows == []
        finally:
            dash.USE_POSTGRES = prev

    asyncio.run(run())

    assert "r.tenant_id = %s" in captured["sql"]
    assert "u.tenant_id = %s" in captured["sql"]
    assert captured["params"][0] == "uni-z"
    assert captured["params"][1] == "uni-z"


def test_teacher_task_summary_uses_taxonomy_patterns(monkeypatch):
    async def fake_auth(_request):
        return {"email": "t@u", "role": "teacher", "tenant_id": "uni-a"}

    async def fake_rows(*args, **kwargs):
        return [
            {
                "github_alias": "s1",
                "student_group": "g1",
                "lab_id": "lab-01",
                "task_id": "task-1",
                "score": "40%",
                "passed": 1,
                "failed": 1,
                "total": 2,
                "timestamp": "2026-05-19T00:00:00Z",
                "details": [
                    {
                        "id": "check-a",
                        "status": "FAIL",
                        "diagnostic": {"failure_taxonomy": "missing_resource"},
                    }
                ],
            }
        ]

    monkeypatch.setattr(dash, "_verify_basic_auth", fake_auth)
    monkeypatch.setattr(dash, "_log_api_access", _noop_log)
    monkeypatch.setattr(dash, "_load_latest_results_rows", fake_rows)

    resp = client.get("/api/teacher/summary/task?lab_id=lab-01&task_id=task-1")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["common_failures"]
    assert "taxonomy:missing_resource" in payload["common_failures"][0]["pattern"]
    assert payload["intervention_suggestions"]
    assert payload["failure_taxonomy_breakdown"]["missing_resource"] == 1


def test_extract_common_failure_keys_legacy_without_taxonomy():
    keys = dash._extract_common_failure_keys(
        {
            "id": "legacy-check",
            "status": "FAIL",
            "short_reason": "Service did not start",
            "details": "timeout after 10s",
        }
    )
    assert keys
    assert keys[0].startswith("legacy-check :: ")
    assert "taxonomy:" not in keys[0]


def test_safe_json_loads_handles_legacy_and_invalid_payloads():
    # Legacy empty/invalid payloads should not break summary endpoints
    assert dash._safe_json_loads("") == []
    assert dash._safe_json_loads(None) == []
    assert dash._safe_json_loads("{not-json}") == []
    assert dash._safe_json_loads([{"id": "c1", "status": "FAIL"}]) == [{"id": "c1", "status": "FAIL"}]
