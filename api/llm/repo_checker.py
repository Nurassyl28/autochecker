"""Check a student GitHub repo against an LLM-generated spec."""

import json
from .adapter import extract_json, llm_complete, LLM_PROVIDER

SYSTEM_PROMPT = """You are an automated grading assistant for programming assignments.

You receive:
1. A grading spec (JSON) describing what to check in the student's code.
2. A snapshot of the student's repository files.

Return ONLY a JSON object in this exact shape — no markdown, no explanation:

{
  "pass_fail": "pass" | "fail",
  "score": 0.0-1.0,
  "summary": "1-2 sentence summary for the student",
  "check_results": [
    {
      "id": "check_id",
      "passed": true | false,
      "score": 0.0-1.0,
      "feedback": "specific, actionable feedback — what is missing or wrong"
    }
  ],
  "teacher_note": "brief note for the instructor"
}

Rules:
- score = weighted average of individual check scores (use spec weights if provided).
- pass_fail = "pass" if score >= spec.pass_threshold, otherwise "fail".
- Feedback must be specific: quote the missing function name, line, or pattern.
- Never invent checks not listed in the spec.

--- EXAMPLE (pass) ---
Spec: {"pass_threshold": 0.6, "checks": [{"id": "has_main", "description": "main.py exists and defines main()", "weight": 1.0}]}
Repo: ### main.py\ndef main():\n    print("hello")
Response:
{"pass_fail":"pass","score":1.0,"summary":"All requirements met. main() is defined correctly.","check_results":[{"id":"has_main","passed":true,"score":1.0,"feedback":"main() function found in main.py."}],"teacher_note":"Clean submission."}

--- EXAMPLE (fail) ---
Spec: {"pass_threshold": 0.6, "checks": [{"id": "has_main", "description": "main.py exists and defines main()", "weight": 1.0}]}
Repo: ### utils.py\ndef helper():\n    pass
Response:
{"pass_fail":"fail","score":0.0,"summary":"main.py is missing. The assignment requires a main() function in main.py.","check_results":[{"id":"has_main","passed":false,"score":0.0,"feedback":"main.py not found in the repository. Create main.py with a main() function."}],"teacher_note":"Student submitted only utils.py, missing the entry point."}
"""


async def check_repo(spec: dict, repo_snapshot: str) -> dict:
    user_msg = f"Spec:\n{json.dumps(spec, indent=2)}\n\nRepo content:\n{repo_snapshot}"

    if LLM_PROVIDER == "anthropic":
        raw = await _check_anthropic(user_msg)
    else:
        raw = await llm_complete(system=SYSTEM_PROMPT, user=user_msg)

    result = extract_json(raw)
    result.setdefault("pass_fail", "fail")
    result.setdefault("score", 0.0)
    result.setdefault("summary", "")
    result.setdefault("check_results", [])
    result.setdefault("teacher_note", "")
    return result


async def _check_anthropic(user_msg: str) -> str:
    """Use Anthropic with prefill trick to force valid JSON output."""
    from .adapter import get_adapter
    import anthropic as _anthropic

    adapter = get_adapter()
    client = adapter._client  # type: ignore[attr-defined]

    msg = await client.messages.create(
        model=adapter._model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": "{"},  # prefill forces JSON
        ],
    )
    # Model continues from "{" — prepend it back
    return "{" + msg.content[0].text


def build_repo_snapshot(files: list[dict], max_chars: int = 80_000) -> str:
    """Convert {path, content} list into a single string for the LLM."""
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
