"""Handler for task check callbacks."""

import asyncio
import functools
import json
import os
import re
from datetime import datetime, timezone

import requests

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from ..database import User, get_attempts_count, get_effective_attempt_limit, add_attempt, save_result, save_diagnostic_events, get_server_ip, get_server_ip_owner, set_server_ip, get_lms_api_key, set_lms_api_key, get_vm_username, set_vm_username
from ..ip_utils import validate_ip
from ..keyboards import get_labs_keyboard, get_tasks_keyboard
from ..runner import run_check
from ..config import (
    ACTIVE_LABS,
    get_task_escalation_thresholds,
    get_tasks_needing_ip,
    get_tasks_needing_lms_key,
    get_tasks_needing_vm_username,
)

router = Router()


AUTOCHECKER_PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKiL0DDQZw7L0Uf1c9cNlREY7IS6ZkIbGVWNsClqGNCZ se-toolkit-autochecker"


async def _persist_result_and_diagnostics(
    *,
    db_user: User,
    lab_id: str,
    task_id: str,
    result,
    passed: int | None,
    failed: int | None,
    total: int | None,
    details_json: str,
) -> None:
    """Persist check result and normalized diagnostic events in one place."""
    await save_result(
        tg_id=db_user.tg_id,
        lab_id=lab_id,
        task_id=task_id,
        score=result.score,
        passed=passed,
        failed=failed,
        total=total,
        details=details_json,
    )
    await save_diagnostic_events(
        tg_id=db_user.tg_id,
        lab_id=lab_id,
        task_id=task_id,
        details=details_json,
    )


async def _send_student_feedback(target, result, task_id: str) -> None:
    """Send student-facing report text/file with safe fallbacks."""
    if result.student_report_path and result.student_report_path.exists():
        try:
            report_text = result.student_report_path.read_text(encoding="utf-8")
            if len(report_text) <= 4000:
                await target.answer(f"<pre>{report_text}</pre>")
            else:
                await target.answer_document(
                    FSInputFile(result.student_report_path, filename="report.txt"),
                    caption=f"Report for {task_id}",
                )
        except (TelegramBadRequest, Exception):
            try:
                await target.answer_document(
                    FSInputFile(result.student_report_path, filename="report.txt"),
                    caption=f"Report for {task_id}",
                )
            except TelegramBadRequest:
                pass
        return

    if result.summary_html_path and result.summary_html_path.exists():
        summary = _parse_summary_html(result.summary_html_path)
        if summary:
            await target.answer(summary)
            return

    if not result.score:
        await target.answer("No results were generated. Check your repository setup.")


def _check_vm_reachable_sync(ip: str) -> tuple[bool, str]:
    """Check if a VM is reachable via SSH through the relay (blocking)."""
    relay_url = os.environ.get("RELAY_URL", "http://dashboard:8000/relay/ssh")
    relay_token = os.environ.get("RELAY_TOKEN", "")
    if not relay_token:
        return True, ""  # skip check if relay not configured
    try:
        resp = requests.post(
            relay_url,
            json={"host": ip, "port": 22, "username": "root",
                  "command": "echo ok", "timeout": 5},
            headers={"Authorization": f"Bearer {relay_token}"},
            timeout=15,
        )
        if resp.status_code == 503:
            return True, ""  # relay worker offline, skip check
        if resp.status_code != 200:
            return False, f"Relay error: {resp.status_code}"
        data = resp.json()
        # SSH connect succeeded (even if auth fails, the VM is reachable)
        if data.get("error") == "timeout":
            return False, "Connection timed out — VM may be down or unreachable."
        return True, ""
    except requests.Timeout:
        return False, "Connection timed out — VM may be down or unreachable."
    except Exception as e:
        return True, ""  # on unexpected errors, don't block the student


async def _check_vm_reachable(ip: str) -> tuple[bool, str]:
    """Async wrapper for VM reachability check."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, functools.partial(_check_vm_reachable_sync, ip)
    )


class CheckStates(StatesGroup):
    waiting_for_server_ip = State()
    waiting_for_vm_username = State()
    waiting_for_lms_key = State()

BLOCK_TAG_RE = re.compile(r"<(/?(h[1-6]|p|div|br|li|ul|ol|tr|hr)[^>]*)>", re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")


def _parse_summary_html(path) -> str | None:
    """Extract plain text from summary.html, preserving line breaks."""
    try:
        html = path.read_text(encoding="utf-8")
        # Add newline before block-level tags
        text = BLOCK_TAG_RE.sub(r"\n", html)
        text = TAG_RE.sub("", text)
        # Collapse multiple blank lines
        lines = [line.strip() for line in text.splitlines()]
        return "\n".join(line for line in lines if line) or None
    except Exception:
        return None


def _parse_results_jsonl(result) -> tuple[int | None, int | None, int | None, list[dict]]:
    """Extract score summary and per-check records from results.jsonl."""
    passed = None
    failed = None
    total = None
    checks: list[dict] = []

    if not result.results_json_path or not result.results_json_path.exists():
        return passed, failed, total, checks

    try:
        with open(result.results_json_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        if lines:
            data = json.loads(lines[0].strip())
            passed = data.get("passed_checks")
            failed = data.get("failed_checks")
            total = data.get("total_checks")

        for line in lines[1:]:
            line = line.strip()
            if line:
                checks.append(json.loads(line))
    except (json.JSONDecodeError, IOError):
        pass

    return passed, failed, total, checks


def _apply_escalation_policy(
    lab_id: str,
    task_id: str,
    checks: list[dict],
    used_attempts_after_run: int,
) -> int:
    """Update escalation_state based on attempt count and spec thresholds.

    Returns number of checks that reached `triggered` state.
    """
    thresholds = get_task_escalation_thresholds(lab_id, task_id)
    if not thresholds:
        return 0

    triggered_count = 0
    for check in checks:
        check_id = (check.get("id") or "").strip()
        threshold = thresholds.get(check_id)
        if not threshold:
            continue

        if check.get("status") == "PASS":
            check["escalation_state"] = "none"
            continue

        if used_attempts_after_run >= threshold:
            check["escalation_state"] = "triggered"
            triggered_count += 1
        else:
            check["escalation_state"] = "eligible"

    return triggered_count


def _infer_likely_cause(status: str, details: str, likely_cause: str) -> str:
    """Infer a concise likely-cause text when the check has none."""
    if likely_cause:
        return likely_cause
    text = f"{status} {details}".lower()
    if "not found" in text or "does not exist" in text:
        return "Missing required file/resource."
    if "timeout" in text:
        return "Service/process did not respond in time."
    if "permission" in text or "denied" in text:
        return "Permission or access configuration issue."
    if "traceback" in text or "error" in text:
        return "Runtime/configuration error during execution."
    return "Requirement is not satisfied by current repository/runtime state."


def _extract_evidence_lines(details: str, max_lines: int = 5) -> list[str]:
    """Extract concise evidence lines from details for diagnostic payload."""
    if not details:
        return []
    lines = [line.strip() for line in details.splitlines() if line.strip()]
    if not lines:
        return []
    return lines[:max_lines]


def _classify_failure_taxonomy(status: str, details: str, likely_cause: str) -> str:
    """Map a failure into a stable taxonomy bucket for analytics."""
    if str(status).upper() == "PASS":
        return "pass"
    text = f"{status} {details} {likely_cause}".lower()
    if "not found" in text or "does not exist" in text or "missing" in text:
        return "missing_resource"
    if "timeout" in text:
        return "timeout"
    if "permission" in text or "denied" in text or "forbidden" in text or "unauthorized" in text:
        return "permission_access"
    if "connection" in text or "refused" in text or "unreachable" in text:
        return "connectivity"
    if "traceback" in text or "exception" in text or "error" in text:
        return "runtime_error"
    return "requirement_mismatch"


def _read_report_excerpt(path, max_chars: int = 1200) -> str:
    """Read a short excerpt from a report file for diagnostics."""
    if not path:
        return ""
    try:
        if not path.exists():
            return ""
        text = path.read_text(encoding="utf-8")
        text = text.strip()
        return text[:max_chars]
    except Exception:
        return ""


def collect_repo_evidence(check: dict) -> dict:
    """Collect repo/check-level evidence from the structured check payload."""
    details = str(check.get("details", "")).strip()
    return {
        "status": "ok",
        "check_id": str(check.get("id", "")).strip(),
        "short_reason": str(check.get("short_reason", "")).strip(),
        "likely_cause": str(check.get("likely_cause", "")).strip(),
        "evidence_text": details[:1500],
        "evidence_lines": _extract_evidence_lines(details),
    }


def collect_log_evidence(student_report_excerpt: str, summary_excerpt: str) -> dict:
    """Collect report/log evidence excerpts produced by the checker."""
    status = "ok" if student_report_excerpt or summary_excerpt else "missing"
    return {
        "status": status,
        "student_report_excerpt": student_report_excerpt,
        "summary_excerpt": summary_excerpt,
    }


def _vm_command_for_taxonomy(taxonomy: str) -> str:
    """Return focused VM probe commands by failure taxonomy."""
    if taxonomy == "missing_resource":
        return "pwd; ls -la; find . -maxdepth 2 -type f | head -n 40"
    if taxonomy in {"timeout", "runtime_error"}:
        return "uname -a; ps aux | head -n 25; ss -lnt 2>/dev/null | head -n 20; docker ps 2>/dev/null | head -n 20"
    if taxonomy in {"permission_access", "connectivity"}:
        return "whoami; id; ip a 2>/dev/null | head -n 30; ip route 2>/dev/null | head -n 20"
    return "whoami; uname -a; pwd; ls -la | head -n 20"


def collect_vm_evidence(server_ip: str, vm_username: str | None, timeout: int = 10, taxonomy: str = "requirement_mismatch") -> dict:
    """Collect minimal VM snapshot via relay SSH with retries and explicit status."""
    relay_token = os.environ.get("RELAY_TOKEN", "")
    if not relay_token:
        return {"status": "unavailable", "reason": "relay_token_missing", "probe_profile": taxonomy}
    if not server_ip:
        return {"status": "skipped", "reason": "server_ip_missing", "probe_profile": taxonomy}

    relay_url = os.environ.get("RELAY_URL", "http://dashboard:8000/relay/ssh")
    username = (vm_username or "autochecker").strip() or "autochecker"
    command = (
        "set -o pipefail; "
        "echo __DIAG_BEGIN__; "
        f"{_vm_command_for_taxonomy(taxonomy)}; "
        "echo __DIAG_END__"
    )

    last_error = ""
    for attempt in range(1, 3):
        try:
            resp = requests.post(
                relay_url,
                json={
                    "host": server_ip,
                    "port": 22,
                    "username": username,
                    "command": command,
                    "timeout": timeout,
                },
                headers={"Authorization": f"Bearer {relay_token}"},
                timeout=timeout + 8,
            )
            if resp.status_code != 200:
                last_error = f"http_{resp.status_code}"
                continue
            data = resp.json()
            if data.get("error"):
                last_error = str(data.get("error"))[:120]
                continue
            stdout = str(data.get("stdout", "")).strip()
            return {
                "status": "ok",
                "attempts": attempt,
                "host": server_ip,
                "username": username,
                "stdout_excerpt": stdout[:1000],
                "probe_profile": taxonomy,
            }
        except requests.Timeout:
            last_error = "timeout"
        except Exception as exc:
            last_error = f"exception:{str(exc)[:80]}"

    return {"status": "failed", "attempts": 2, "host": server_ip, "username": username, "reason": last_error, "probe_profile": taxonomy}


def _derive_diagnostic_status(source_status: dict[str, str]) -> str:
    """Derive a compact overall diagnostic status from source statuses."""
    values = list(source_status.values())
    if values and all(v == "ok" for v in values):
        return "complete"
    if any(v == "ok" for v in values):
        return "partial"
    if any(v in {"failed", "unavailable"} for v in values):
        return "degraded"
    return "missing"


def _run_deep_diagnostics(
    lab_id: str,
    task_id: str,
    checks: list[dict],
    used_attempts_after_run: int,
    *,
    server_ip: str | None = None,
    vm_username: str | None = None,
    student_report_excerpt: str = "",
    summary_excerpt: str = "",
) -> int:
    """Attach structured diagnostics for checks in `triggered` escalation state.

    Returns number of checks that reached `completed`.
    """
    completed = 0
    generated_at = datetime.now(timezone.utc).isoformat()
    for check in checks:
        if check.get("escalation_state") != "triggered":
            continue

        status = str(check.get("status", "ERROR"))
        details = str(check.get("details", ""))
        hint = str(check.get("hint", "")).strip()
        likely = str(check.get("likely_cause", "")).strip()
        next_steps = check.get("next_steps") or []
        if not isinstance(next_steps, list):
            next_steps = []

        inferred = _infer_likely_cause(status, details, likely)
        if not next_steps and hint:
            next_steps = [hint]
        if not next_steps:
            next_steps = [
                "Re-read the failed check requirement and compare it with your current implementation.",
                "Re-run locally and capture logs/output for the failed step.",
                "Apply one focused fix, then run check again.",
            ]

        check_id = str(check.get("id", "")).strip()
        repo_evidence = collect_repo_evidence(check)
        log_evidence = collect_log_evidence(student_report_excerpt, summary_excerpt)
        taxonomy = _classify_failure_taxonomy(status, details, likely)
        vm_snapshot = collect_vm_evidence(server_ip or "", vm_username, taxonomy=taxonomy)
        source_status = {
            "check_data": repo_evidence.get("status", "ok"),
            "student_report": "ok" if log_evidence.get("student_report_excerpt") else "missing",
            "summary_report": "ok" if log_evidence.get("summary_excerpt") else "missing",
            "vm_snapshot": vm_snapshot.get("status", "unknown"),
        }
        diagnostic_status = _derive_diagnostic_status(source_status)

        check["diagnostic"] = {
            "version": "v1",
            "lab_id": lab_id,
            "task_id": task_id,
            "check_id": check_id,
            "generated_at": generated_at,
            "attempt_no": used_attempts_after_run,
            "status": status,
            "failure_taxonomy": taxonomy,
            "failure_status": "active" if status != "PASS" else "none",
            "diagnostic_status": diagnostic_status,
            "what_failed": str(check.get("what_failed") or check.get("short_reason") or "").strip(),
            "root_cause": inferred,
            "why_failed": str(check.get("why_failed") or inferred).strip(),
            "evidence": repo_evidence.get("evidence_text", ""),
            "evidence_lines": repo_evidence.get("evidence_lines", []),
            "recommended_steps": next_steps[:5],
            "what_to_do_next": next_steps[:5],
            "confidence": "medium",
            "sources": source_status,
            "report_context": log_evidence,
            "vm_snapshot": vm_snapshot,
        }
        # Keep taxonomy on the check record as well for easier downstream aggregation.
        check["failure_taxonomy"] = taxonomy
        check["escalation_state"] = "completed"
        completed += 1

    return completed


def _build_details_json(
    lab_id: str,
    task_id: str,
    result,
    used_attempts_after_run: int,
    *,
    server_ip: str | None = None,
    vm_username: str | None = None,
) -> tuple[int | None, int | None, int | None, str, int]:
    """Build DB-ready details JSON with escalation state applied."""
    passed, failed, total, checks = _parse_results_jsonl(result)
    triggered_count = _apply_escalation_policy(lab_id, task_id, checks, used_attempts_after_run)
    student_report_excerpt = _read_report_excerpt(getattr(result, "student_report_path", None))
    summary_excerpt = _read_report_excerpt(getattr(result, "summary_html_path", None))
    completed_count = 0
    if triggered_count > 0:
        completed_count = _run_deep_diagnostics(
            lab_id,
            task_id,
            checks,
            used_attempts_after_run,
            server_ip=server_ip,
            vm_username=vm_username,
            student_report_excerpt=student_report_excerpt,
            summary_excerpt=summary_excerpt,
        )
    details_json = json.dumps(checks, ensure_ascii=False) if checks else ""
    return passed, failed, total, details_json, completed_count


async def _get_attempt_window(tg_id: int, lab_id: str, task_id: str) -> tuple[int, int]:
    """Return (used_attempts, effective_attempt_limit) for a task."""
    attempts = await get_attempts_count(tg_id, lab_id, task_id)
    max_attempts = await get_effective_attempt_limit(tg_id, lab_id, task_id)
    return attempts, max_attempts


@router.message(Command("reset"))
async def cmd_reset(message: Message, db_user: User, state: FSMContext) -> None:
    """Show reset options for stored settings."""
    if db_user is None:
        await message.answer("Please /start to register first.")
        return

    await state.clear()

    any_lab_needs_lms = any(get_tasks_needing_lms_key(lab) for lab in ACTIVE_LABS)

    server_ip = await get_server_ip(db_user.tg_id)
    vm_user = await get_vm_username(db_user.tg_id)
    lms_key = await get_lms_api_key(db_user.tg_id) if any_lab_needs_lms else ""

    lines = ["<b>Your stored settings:</b>\n"]
    buttons = []

    if server_ip:
        lines.append(f"VM IP: <code>{server_ip}</code>")
        buttons.append([InlineKeyboardButton(text="Reset VM IP", callback_data="reset:server_ip")])
    else:
        lines.append("VM IP: <i>not set</i>")

    if vm_user:
        lines.append(f"VM username: <code>{vm_user}</code>")
        buttons.append([InlineKeyboardButton(text="Reset VM username", callback_data="reset:vm_username")])
    else:
        lines.append("VM username: <i>not set</i>")

    if any_lab_needs_lms:
        if lms_key:
            lines.append(f"LMS API key: <code>{lms_key[:6]}...</code>")
            buttons.append([InlineKeyboardButton(text="Reset LMS API key", callback_data="reset:lms_api_key")])
        else:
            lines.append("LMS API key: <i>not set</i>")

    if not buttons:
        lines.append("\nNothing to reset.")

    await message.answer(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None,
    )


@router.callback_query(F.data.startswith("reset:"))
async def callback_reset(callback: CallbackQuery, db_user: User) -> None:
    """Handle reset button press."""
    field = callback.data.split(":", 1)[1]

    if field == "server_ip":
        await set_server_ip(db_user.tg_id, "")
        await callback.answer("VM IP reset. You'll be asked again on next check.", show_alert=True)
    elif field == "vm_username":
        await set_vm_username(db_user.tg_id, "")
        await callback.answer("VM username reset. You'll be asked again on next check.", show_alert=True)
    elif field == "lms_api_key":
        await set_lms_api_key(db_user.tg_id, "")
        await callback.answer("LMS API key reset. You'll be asked again on next check.", show_alert=True)
    else:
        await callback.answer("Unknown setting.", show_alert=True)
        return

    any_lab_needs_lms = any(get_tasks_needing_lms_key(lab) for lab in ACTIVE_LABS)

    # Refresh the message
    server_ip = await get_server_ip(db_user.tg_id)
    vm_user = await get_vm_username(db_user.tg_id)
    lms_key = await get_lms_api_key(db_user.tg_id) if any_lab_needs_lms else ""

    lines = ["<b>Your stored settings:</b>\n"]
    buttons = []

    if server_ip:
        lines.append(f"VM IP: <code>{server_ip}</code>")
        buttons.append([InlineKeyboardButton(text="Reset VM IP", callback_data="reset:server_ip")])
    else:
        lines.append("VM IP: <i>not set</i>")

    if vm_user:
        lines.append(f"VM username: <code>{vm_user}</code>")
        buttons.append([InlineKeyboardButton(text="Reset VM username", callback_data="reset:vm_username")])
    else:
        lines.append("VM username: <i>not set</i>")

    if any_lab_needs_lms:
        if lms_key:
            lines.append(f"LMS API key: <code>{lms_key[:6]}...</code>")
            buttons.append([InlineKeyboardButton(text="Reset LMS API key", callback_data="reset:lms_api_key")])
        else:
            lines.append("LMS API key: <i>not set</i>")

    if not buttons:
        lines.append("\nAll settings cleared.")

    try:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons) if buttons else None,
        )
    except TelegramBadRequest:
        pass


@router.callback_query(F.data.startswith("locked:"))
async def callback_locked(callback: CallbackQuery) -> None:
    """Handle click on a locked task."""
    prereq = callback.data.split(":", 1)[1]
    await callback.answer(f"Pass \"{prereq}\" first.", show_alert=True)


@router.callback_query(F.data.startswith("check:"))
async def callback_check_task(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    """Handle task selection — run check immediately."""
    if db_user is None:
        await callback.answer("Please /start to register first.", show_alert=True)
        return

    parts = callback.data.split(":")
    if len(parts) != 3:
        await callback.answer("Invalid task selection", show_alert=True)
        return

    lab_id = parts[1]
    task_id = parts[2]

    attempts, max_attempts = await _get_attempt_window(db_user.tg_id, lab_id, task_id)
    if attempts >= max_attempts:
        await callback.answer(
            f"No attempts left for {task_id}.",
            show_alert=True
        )
        return

    # For tasks needing a server IP, check if we have one stored
    # agent_eval tasks also need server_ip (SSH to student VM)
    server_ip = ""
    if task_id in get_tasks_needing_ip(lab_id) or task_id in get_tasks_needing_lms_key(lab_id):
        server_ip = await get_server_ip(db_user.tg_id)
        if not server_ip:
            await callback.answer()
            await callback.message.edit_text(
                f"To check <b>{task_id}</b>, I need your VM's IP address.\n\n"
                f"Reply with your VM IP (e.g., <code>10.90.138.42</code>):",
            )
            await state.set_state(CheckStates.waiting_for_server_ip)
            await state.update_data(lab_id=lab_id, task_id=task_id)
            return

    # For tasks needing VM username (agent_eval or __vm_username__ ssh_checks)
    vm_username = ""
    lms_api_key = ""
    if task_id in get_tasks_needing_vm_username(lab_id):
        vm_username = await get_vm_username(db_user.tg_id)
        if not vm_username:
            await callback.answer()
            await callback.message.edit_text(
                f"To check <b>{task_id}</b>, I need your VM username.\n\n"
                f"The autochecker will SSH into your VM to run checks. "
                f"Run this on your VM:\n\n"
                f"<code>whoami</code>\n\n"
                f"Reply with the output:",
            )
            await state.set_state(CheckStates.waiting_for_vm_username)
            await state.update_data(lab_id=lab_id, task_id=task_id)
            return

    # For agent_eval tasks, also need LMS API key
    if task_id in get_tasks_needing_lms_key(lab_id):
        lms_api_key = await get_lms_api_key(db_user.tg_id)
        if not lms_api_key:
            await callback.answer()
            await callback.message.edit_text(
                f"To check <b>{task_id}</b>, I need your <code>LMS_API_KEY</code> "
                f"(the backend API key from your <code>.env.docker.secret</code>).\n\n"
                f"Reply with your LMS_API_KEY:",
            )
            await state.set_state(CheckStates.waiting_for_lms_key)
            await state.update_data(lab_id=lab_id, task_id=task_id)
            return

    await callback.answer()

    has_eval = bool(get_tasks_needing_lms_key(lab_id) & {task_id})
    time_est = "a few minutes" if has_eval else "60 seconds"
    await callback.message.edit_text(
        f"Checking <b>{task_id}</b>...\n\n"
        f"This may take up to {time_est}.",
    )

    # Run the check using github_alias
    result = await run_check(db_user.github_alias, lab_id, task_id, server_ip=server_ip or None, lms_api_key=lms_api_key or None, vm_username=vm_username or None)

    # Record the attempt
    await add_attempt(db_user.tg_id, lab_id, task_id)

    passed, failed, total, details_json, diagnostics_completed = _build_details_json(
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        used_attempts_after_run=attempts + 1,
        server_ip=server_ip or None,
        vm_username=vm_username or None,
    )

    await _persist_result_and_diagnostics(
        db_user=db_user,
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        passed=passed,
        failed=failed,
        total=total,
        details_json=details_json,
    )

    # Handle runner-level error (timeout, script not found)
    if result.error_message:
        await callback.message.edit_text(
            result.error_message,
            reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
        )
        return

    # Build result message
    if result.score:
        status_emoji = "✅" if (failed is not None and failed == 0) else "⚠️"
        score_text = f"\nScore: <b>{result.score}</b>"
    else:
        status_emoji = "⚠️"
        score_text = ""

    await callback.message.edit_text(
        f"{status_emoji} Check complete for <b>{task_id}</b>!{score_text}\n\n"
        f"Attempts used: {attempts + 1}/{max_attempts}",
    )
    if diagnostics_completed > 0:
        await callback.message.answer(
            f"Deep diagnostics completed for {diagnostics_completed} check(s). "
            "Open the report for root cause and fix steps."
        )

    await _send_student_feedback(callback.message, result, task_id)

    # Show tasks menu again
    await callback.message.answer(
        "Choose a task:",
        reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
    )


@router.message(CheckStates.waiting_for_server_ip)
async def process_server_ip(message: Message, db_user: User, state: FSMContext) -> None:
    """Handle server IP input, save it, and run the check."""
    text = message.text.strip() if message.text else ""

    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer(
            "Cancelled.\n\nChoose a lab:",
            reply_markup=get_labs_keyboard(server_ip=server_ip),
        )
        return

    valid, error_msg = validate_ip(text)
    if not valid:
        await message.answer(error_msg)
        return

    # Reachability check for internal IPs via relay
    if text.startswith("10."):
        checking_msg = await message.answer(f"Checking if <code>{text}</code> is reachable...")
        reachable, reach_err = await _check_vm_reachable(text)
        try:
            await checking_msg.delete()
        except TelegramBadRequest:
            pass
        if not reachable:
            await message.answer(
                f"VM <code>{text}</code> is not reachable.\n\n"
                f"{reach_err}\n\n"
                "Please check that:\n"
                "1. Your VM is running\n"
                "2. The IP is correct\n"
                "3. SSH is enabled on the VM\n\n"
                "Enter your VM IP:"
            )
            return

    # Check uniqueness — each student must have their own VM IP
    existing_owner = await get_server_ip_owner(text, db_user.tg_id)
    if existing_owner:
        await message.answer(
            f"This IP is already registered to another student.\n"
            f"Each student must use their own VM. Please enter your unique VM IP:"
        )
        return

    # Save IP and clear FSM state
    await set_server_ip(db_user.tg_id, text)
    data = await state.get_data()
    await state.clear()

    lab_id = data["lab_id"]
    task_id = data["task_id"]

    attempts, max_attempts = await _get_attempt_window(db_user.tg_id, lab_id, task_id)
    if attempts >= max_attempts:
        await message.answer(f"No attempts left for {task_id}.")
        return

    status_msg = await message.answer(
        f"Saved VM IP: <code>{text}</code>\n\n"
        f"Checking <b>{task_id}</b>...\n"
        f"This may take up to 60 seconds.",
    )

    result = await run_check(db_user.github_alias, lab_id, task_id, server_ip=text)

    # Record the attempt
    await add_attempt(db_user.tg_id, lab_id, task_id)

    passed, failed, total, details_json, diagnostics_completed = _build_details_json(
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        used_attempts_after_run=attempts + 1,
        server_ip=text,
        vm_username=None,
    )

    await _persist_result_and_diagnostics(
        db_user=db_user,
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        passed=passed,
        failed=failed,
        total=total,
        details_json=details_json,
    )

    if result.error_message:
        await status_msg.edit_text(
            result.error_message,
            reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
        )
        return

    if result.score:
        status_emoji = "✅" if (failed is not None and failed == 0) else "⚠️"
        score_text = f"\nScore: <b>{result.score}</b>"
    else:
        status_emoji = "⚠️"
        score_text = ""

    await status_msg.edit_text(
        f"{status_emoji} Check complete for <b>{task_id}</b>!{score_text}\n\n"
        f"Attempts used: {attempts + 1}/{max_attempts}",
    )
    if diagnostics_completed > 0:
        await message.answer(
            f"Deep diagnostics completed for {diagnostics_completed} check(s). "
            "Open the report for root cause and fix steps."
        )

    await _send_student_feedback(message, result, task_id)

    await message.answer(
        "Choose a task:",
        reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
    )


@router.message(CheckStates.waiting_for_vm_username)
async def process_vm_username(message: Message, db_user: User, state: FSMContext) -> None:
    """Handle VM username input, save it, then ask for LMS_API_KEY."""
    text = message.text.strip() if message.text else ""

    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer(
            "Cancelled.\n\nChoose a lab:",
            reply_markup=get_labs_keyboard(server_ip=server_ip),
        )
        return

    # Validate: alphanumeric, underscore, hyphen, 1-32 chars
    if not text or not re.match(r'^[a-zA-Z0-9_-]{1,32}$', text):
        await message.answer(
            "Invalid username. Must be 1-32 characters (letters, digits, underscore, hyphen).\n"
            "Run <code>whoami</code> on your VM to check. Try again:"
        )
        return

    await set_vm_username(db_user.tg_id, text)
    data = await state.get_data()

    lab_id = data["lab_id"]
    task_id = data["task_id"]

    # Now check if we also need LMS_API_KEY
    lms_api_key = ""
    if task_id in get_tasks_needing_lms_key(lab_id):
        lms_api_key = await get_lms_api_key(db_user.tg_id)
        if not lms_api_key:
            await state.update_data(lab_id=lab_id, task_id=task_id)
            await state.set_state(CheckStates.waiting_for_lms_key)
            await message.answer(
                f"Saved VM username: <code>{text}</code>\n\n"
                f"Now I need your <code>LMS_API_KEY</code> "
                f"(the backend API key from your <code>.env.docker.secret</code>).\n\n"
                f"Reply with your LMS_API_KEY:",
            )
            return

    await state.clear()

    attempts, max_attempts = await _get_attempt_window(db_user.tg_id, lab_id, task_id)
    if attempts >= max_attempts:
        await message.answer(f"No attempts left for {task_id}.")
        return

    server_ip = await get_server_ip(db_user.tg_id)

    status_msg = await message.answer(
        f"Saved VM username: <code>{text}</code>\n\n"
        f"Checking <b>{task_id}</b>...\n"
        f"This may take a few minutes.",
    )

    result = await run_check(db_user.github_alias, lab_id, task_id, server_ip=server_ip or None, lms_api_key=lms_api_key or None, vm_username=text)

    await add_attempt(db_user.tg_id, lab_id, task_id)

    passed, failed, total, details_json, diagnostics_completed = _build_details_json(
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        used_attempts_after_run=attempts + 1,
        server_ip=server_ip or None,
        vm_username=text,
    )

    await _persist_result_and_diagnostics(
        db_user=db_user,
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        passed=passed,
        failed=failed,
        total=total,
        details_json=details_json,
    )

    if result.error_message:
        await status_msg.edit_text(
            result.error_message,
            reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
        )
        return

    if result.score:
        status_emoji = "✅" if (failed is not None and failed == 0) else "⚠️"
        score_text = f"\nScore: <b>{result.score}</b>"
    else:
        status_emoji = "⚠️"
        score_text = ""

    await status_msg.edit_text(
        f"{status_emoji} Check complete for <b>{task_id}</b>!{score_text}\n\n"
        f"Attempts used: {attempts + 1}/{max_attempts}",
    )
    if diagnostics_completed > 0:
        await message.answer(
            f"Deep diagnostics completed for {diagnostics_completed} check(s). "
            "Open the report for root cause and fix steps."
        )

    await _send_student_feedback(message, result, task_id)

    await message.answer(
        "Choose a task:",
        reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
    )


@router.message(CheckStates.waiting_for_lms_key)
async def process_lms_key(message: Message, db_user: User, state: FSMContext) -> None:
    """Handle LMS API key input, save it, and run the check."""
    text = message.text.strip() if message.text else ""

    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer(
            "Cancelled.\n\nChoose a lab:",
            reply_markup=get_labs_keyboard(server_ip=server_ip),
        )
        return

    if not text or len(text) < 3:
        await message.answer("LMS_API_KEY must be at least 3 characters. Try again:")
        return

    await set_lms_api_key(db_user.tg_id, text)
    data = await state.get_data()
    await state.clear()

    lab_id = data["lab_id"]
    task_id = data["task_id"]

    attempts, max_attempts = await _get_attempt_window(db_user.tg_id, lab_id, task_id)
    if attempts >= max_attempts:
        await message.answer(f"No attempts left for {task_id}.")
        return

    server_ip = await get_server_ip(db_user.tg_id)
    vm_username = await get_vm_username(db_user.tg_id)

    status_msg = await message.answer(
        f"Saved LMS_API_KEY.\n\n"
        f"Checking <b>{task_id}</b>...\n"
        f"This may take a few minutes.",
    )

    result = await run_check(db_user.github_alias, lab_id, task_id, server_ip=server_ip or None, lms_api_key=text, vm_username=vm_username or None)

    await add_attempt(db_user.tg_id, lab_id, task_id)

    passed, failed, total, details_json, diagnostics_completed = _build_details_json(
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        used_attempts_after_run=attempts + 1,
        server_ip=server_ip or None,
        vm_username=vm_username or None,
    )

    await _persist_result_and_diagnostics(
        db_user=db_user,
        lab_id=lab_id,
        task_id=task_id,
        result=result,
        passed=passed,
        failed=failed,
        total=total,
        details_json=details_json,
    )

    if result.error_message:
        await status_msg.edit_text(
            result.error_message,
            reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
        )
        return

    if result.score:
        status_emoji = "✅" if (failed is not None and failed == 0) else "⚠️"
        score_text = f"\nScore: <b>{result.score}</b>"
    else:
        status_emoji = "⚠️"
        score_text = ""

    await status_msg.edit_text(
        f"{status_emoji} Check complete for <b>{task_id}</b>!{score_text}\n\n"
        f"Attempts used: {attempts + 1}/{max_attempts}",
    )
    if diagnostics_completed > 0:
        await message.answer(
            f"Deep diagnostics completed for {diagnostics_completed} check(s). "
            "Open the report for root cause and fix steps."
        )

    await _send_student_feedback(message, result, task_id)

    await message.answer(
        "Choose a task:",
        reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id)
    )
