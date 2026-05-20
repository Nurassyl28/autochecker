"""Check a student GitHub repo against an LLM-generated spec."""

import json
from .adapter import extract_json, llm_complete

SYSTEM_PROMPT = """You are an automated grading assistant. You will receive:
1. A grading spec (JSON) describing what to look for in a student's repo.
2. A snapshot of the student's repo content.

Evaluate each check in the spec against the repo content and return a JSON result:

{
  "pass_fail": "pass" | "fail",
  "score": 0.0-1.0,
  "summary": "1-2 sentence overall summary for the student",
  "check_results": [
    {
      "id": "check_id",
      "passed": true | false,
      "score": 0.0-1.0,
      "feedback": "specific feedback for this check"
    }
  ],
  "teacher_note": "brief note for the instructor about common issues or highlights"
}

Rules:
- score = weighted sum of passed checks.
- pass_fail = "pass" if score >= spec.pass_threshold, otherwise "fail".
- Be specific in feedback — tell the student exactly what is missing or wrong.
- Output ONLY valid JSON, no markdown fences.
"""


async def check_repo(spec: dict, repo_snapshot: str) -> dict:
    """
    repo_snapshot: concatenated string of repo file paths and content.
    Returns the grading result dict.
    """
    user_msg = f"Spec:\n{json.dumps(spec, indent=2)}\n\nRepo content:\n{repo_snapshot}"
    raw = await llm_complete(system=SYSTEM_PROMPT, user=user_msg)
    result = extract_json(raw)

    # Ensure required fields have defaults
    result.setdefault("pass_fail", "fail")
    result.setdefault("score", 0.0)
    result.setdefault("summary", "")
    result.setdefault("check_results", [])
    result.setdefault("teacher_note", "")
    return result


def build_repo_snapshot(files: list[dict], max_chars: int = 60_000) -> str:
    """
    Convert a list of {path, content} dicts into a single string for the LLM.
    Truncates if total chars exceed max_chars to stay within context limits.
    """
    parts = []
    total = 0
    for f in files:
        header = f"### {f['path']}\n"
        body = f.get("content", "") or ""
        chunk = header + body + "\n\n"
        if total + len(chunk) > max_chars:
            remaining = max_chars - total
            parts.append(chunk[:remaining] + "\n...[truncated]")
            break
        parts.append(chunk)
        total += len(chunk)
    return "".join(parts)
