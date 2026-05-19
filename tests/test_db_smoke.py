"""Smoke tests for bot.database core functions (SQLite runtime path)."""

import asyncio
import importlib
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _run(coro):
    return asyncio.run(coro)


def test_database_core_flow_sqlite(tmp_path, monkeypatch):
    db_file = tmp_path / "test_bot.db"
    monkeypatch.setenv("BOT_TOKEN", "test-token")
    monkeypatch.setenv("DB_PATH", str(db_file))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("DEFAULT_TENANT_ID", "default")

    import bot.config as cfg
    import bot.database as dbm

    importlib.reload(cfg)
    importlib.reload(dbm)

    _run(dbm.init_db())

    tg_id = 1001
    _run(
        dbm.upsert_user(
            tg_id=tg_id,
            email="student@example.com",
            github_alias="student-gh",
            tg_username="student_tg",
            student_group="G1",
        )
    )

    user = _run(dbm.get_user(tg_id))
    assert user is not None
    assert user.email == "student@example.com"
    assert user.github_alias == "student-gh"
    assert user.role == "student"
    assert user.tenant_id == "default"

    user_by_email = _run(dbm.get_user_by_email("student@example.com"))
    assert user_by_email is not None
    assert user_by_email.tg_id == tg_id

    user_by_gh = _run(dbm.get_user_by_github("student-gh"))
    assert user_by_gh is not None
    assert user_by_gh.tg_id == tg_id

    _run(dbm.set_server_ip(tg_id, "10.10.10.10"))
    assert _run(dbm.get_server_ip(tg_id)) == "10.10.10.10"

    _run(dbm.set_vm_username(tg_id, "ubuntu"))
    assert _run(dbm.get_vm_username(tg_id)) == "ubuntu"

    _run(dbm.set_lms_api_key(tg_id, "secret-key"))
    assert _run(dbm.get_lms_api_key(tg_id)) == "secret-key"

    # IP ownership check
    assert _run(dbm.get_server_ip_owner("10.10.10.10", exclude_tg_id=9999)) == "student-gh"
    assert _run(dbm.get_server_ip_owner("10.10.10.11", exclude_tg_id=9999)) is None

    lab_id = "lab-01"
    task_id = "task-1"
    assert _run(dbm.get_attempts_count(tg_id, lab_id, task_id)) == 0

    _run(dbm.add_attempt(tg_id, lab_id, task_id))
    _run(dbm.add_attempt(tg_id, lab_id, task_id))
    assert _run(dbm.get_attempts_count(tg_id, lab_id, task_id)) == 2

    _run(dbm.add_attempt_grant(tg_id, lab_id, task_id, amount=3, reason="test"))
    assert _run(dbm.get_attempt_grants(tg_id, lab_id, task_id)) == 3

    _run(
        dbm.save_result(
            tg_id=tg_id,
            lab_id=lab_id,
            task_id=task_id,
            score="100%",
            passed=1,
            failed=0,
            total=1,
            details='[{"id":"x","status":"PASS"}]',
        )
    )
    assert _run(dbm.has_passed_task(tg_id, lab_id, task_id)) is True

    stats = _run(dbm.get_task_stats(tg_id))
    key = f"{lab_id}:{task_id}"
    assert key in stats
    assert stats[key]["attempts"] == 2
    assert stats[key]["granted_attempts"] == 3
    assert stats[key]["remaining"] >= 0

    users = _run(dbm.get_all_users())
    assert len(users) == 1
    assert users[0].tg_id == tg_id

    _run(dbm.log_api_access("student@example.com", "/api/items"))
    summary = _run(dbm.get_api_access_summary("student@example.com"))
    assert summary
    assert summary[0]["endpoint"] == "/api/items"

    _run(dbm.delete_user(tg_id))
    assert _run(dbm.get_user(tg_id)) is None
