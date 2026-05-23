"""
Background submission processor.

Flow:
  1. Mark submission as 'processing'
  2. Fetch assignment llm_spec
  3. Read student repo via GitHub API
  4. Call LLM to evaluate
  5. Save result
  6. Push result to student via Telegram bot API
"""

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone

import requests

from . import database as db
from .llm.repo_checker import build_repo_snapshot, check_repo

logger = logging.getLogger(__name__)

TG_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")


def _compute_repo_hash(files: list[dict]) -> str:
    """SHA256 of sorted file paths + contents. Changes if any file changes."""
    h = hashlib.sha256()
    for f in sorted(files, key=lambda x: x["path"]):
        h.update(f["path"].encode())
        h.update(f["content"].encode())
    return h.hexdigest()


def _parse_github_url(url: str) -> tuple[str, str] | None:
    """Extract (owner, repo) from a GitHub URL."""
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", url.strip())
    if m:
        return m.group(1), m.group(2)
    return None


def _file_priority(path: str) -> int:
    """Lower number = fetched first. Puts student source files before tests/configs."""
    lower = path.lower()
    name = lower.split("/")[-1]
    # Skip student test files — they don't show implementation
    if name.startswith("test_") or name.endswith("_test.py"):
        return 99
    depth = path.count("/")
    if depth == 0 and lower.endswith(".py"):   # root-level .py → highest priority
        return 0
    if lower.endswith(".py"):
        return 1 + depth
    if lower.endswith((".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs")):
        return 10 + depth
    if name in ("readme.md", "requirements.txt", "dockerfile", "docker-compose.yml"):
        return 20
    return 50


def _fetch_repo_files(owner: str, repo: str) -> list[dict]:
    """Return list of {path, content} dicts, prioritised by relevance."""
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    api = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
    resp = requests.get(api, headers=headers, timeout=30)
    if resp.status_code != 200:
        return []

    skipped_exts = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".ttf", ".zip", ".pdf", ".pyc"}
    blobs = [
        item for item in resp.json().get("tree", [])
        if item["type"] == "blob" and not any(item["path"].endswith(e) for e in skipped_exts)
    ]
    # Sort by priority so we fetch the most relevant files first
    blobs.sort(key=lambda x: _file_priority(x["path"]))

    files = []
    for item in blobs:
        path: str = item["path"]
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}"
        try:
            r = requests.get(raw_url, headers=headers, timeout=15)
            if r.status_code == 200:
                files.append({"path": path, "content": r.text[:10_000]})
        except Exception:
            continue
        if len(files) >= 40:  # cap: 40 prioritised files is enough
            break
    return files


def _push_tg_message(tg_id: int, text: str) -> None:
    if not TG_BOT_TOKEN or not tg_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage",
            json={"chat_id": tg_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
    except Exception as e:
        logger.warning("TG push failed for tg_id=%s: %s", tg_id, e)


def _format_tg_message(submission: dict, result: dict, assignment_title: str) -> str:
    pf = result.get("pass_fail", "fail").upper()
    score_pct = round((result.get("score") or 0) * 100)
    summary = result.get("summary", "")
    icon = "✅" if pf == "PASS" else "❌"
    lines = [
        f"{icon} <b>{assignment_title}</b>",
        f"Result: <b>{pf}</b> ({score_pct}%)",
        "",
        summary,
    ]
    # Add per-check feedback (failed checks only)
    failed_checks = [c for c in result.get("check_results", []) if not c.get("passed")]
    if failed_checks:
        lines.append("\n<b>Issues to fix:</b>")
        for c in failed_checks[:5]:
            lines.append(f"• {c.get('feedback', '')}")
    return "\n".join(lines)


async def process_submission(submission_id: int) -> None:
    """Main async worker entry point. Called as a FastAPI background task."""
    # Mark as processing
    await db.execute(
        "UPDATE submissions SET status = 'processing' WHERE id = %s",
        (submission_id,),
    )

    try:
        # Load submission + assignment + student
        row = await db.fetchone(
            """
            SELECT s.id, s.repo_url, s.student_id,
                   a.title AS assignment_title, a.llm_spec,
                   u.tg_id
            FROM submissions s
            JOIN assignments a ON a.id = s.assignment_id
            JOIN users u ON u.id = s.student_id
            WHERE s.id = %s
            """,
            (submission_id,),
        )
        if not row:
            return

        spec = row["llm_spec"]
        if not spec:
            await _fail(submission_id, "Assignment spec not ready yet.")
            return

        # Read repo
        parsed = _parse_github_url(row["repo_url"])
        if not parsed:
            await _fail(submission_id, "Invalid GitHub URL.", row.get("tg_id"))
            return
        owner, repo = parsed
        files = await _run_sync(_fetch_repo_files, owner, repo)
        if not files:
            await _fail(submission_id, "Could not read repository. Check that it is public.", row.get("tg_id"))
            return

        repo_hash = _compute_repo_hash(files)

        # Cache: reuse result only if repo CONTENT is identical (same hash)
        cached = await db.fetchone(
            """SELECT feedback_json FROM submissions
               WHERE assignment_id = (SELECT assignment_id FROM submissions WHERE id = %s)
                 AND repo_hash = %s AND status = 'done' AND id != %s
               ORDER BY completed_at DESC LIMIT 1""",
            (submission_id, repo_hash, submission_id),
        )
        if cached and cached["feedback_json"]:
            result = cached["feedback_json"]
            if isinstance(result, str):
                result = json.loads(result)
            logger.info("Reusing cached result for submission %s (hash=%s)", submission_id, repo_hash[:8])
        else:
            snapshot = build_repo_snapshot(files)
            result = await check_repo(spec, snapshot)

        feedback_json = json.dumps(result)
        now = datetime.now(timezone.utc)
        await db.execute(
            """
            UPDATE submissions
            SET status = 'done', pass_fail = %s, score = %s,
                feedback_json = %s::jsonb, completed_at = %s, repo_hash = %s
            WHERE id = %s
            """,
            (result["pass_fail"], result.get("score"), feedback_json, now, repo_hash, submission_id),
        )

        tg_id = row.get("tg_id")
        if tg_id:
            msg = _format_tg_message(row, result, row["assignment_title"])
            await _run_sync(_push_tg_message, tg_id, msg)

    except Exception as exc:
        logger.exception("process_submission(%s) failed: %s", submission_id, exc)
        await db.execute(
            "UPDATE submissions SET status = 'error' WHERE id = %s",
            (submission_id,),
        )


async def _fail(submission_id: int, reason: str, tg_id: int | None = None) -> None:
    await db.execute(
        "UPDATE submissions SET status = 'error' WHERE id = %s",
        (submission_id,),
    )
    if tg_id:
        _push_tg_message(tg_id, f"❌ Submission failed: {reason}")


async def _run_sync(fn, *args):
    """Run a sync blocking function in a thread pool."""
    import asyncio
    return await asyncio.get_running_loop().run_in_executor(None, fn, *args)
