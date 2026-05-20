"""Generate a checking spec from a task description using LLM."""

from .adapter import extract_json, llm_complete

SYSTEM_PROMPT = """You are an automated grading spec generator for student GitHub repositories.
Given a task description, produce a JSON spec that will be used to evaluate student submissions.
The spec MUST be valid JSON and contain exactly these fields:

{
  "title": "short title",
  "pass_threshold": 0.7,
  "checks": [
    {
      "id": "unique_id",
      "description": "what to check",
      "weight": 1.0,
      "what_to_look_for": "exact files/patterns/content to find in the repo",
      "pass_criteria": "what makes this check pass",
      "fail_criteria": "what makes this check fail"
    }
  ]
}

Rules:
- Produce 5–15 checks depending on task complexity.
- Weights must sum to approximately 1.0 (normalize if needed).
- Be specific: name files, functions, patterns, or structures that should exist.
- Do not include markdown fences or extra text — output ONLY valid JSON.
"""


async def generate_spec(description: str) -> dict:
    """Call LLM to generate a checking spec from a task description."""
    raw = await llm_complete(
        system=SYSTEM_PROMPT,
        user=f"Task description:\n\n{description}",
    )
    spec = extract_json(raw)
    # Normalize weights to sum to 1.0
    checks = spec.get("checks", [])
    total_weight = sum(c.get("weight", 1.0) for c in checks)
    if total_weight > 0:
        for c in checks:
            c["weight"] = round(c.get("weight", 1.0) / total_weight, 4)
    spec["checks"] = checks
    return spec
