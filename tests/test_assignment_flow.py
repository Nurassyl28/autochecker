"""
End-to-end test of the full assignment creation + submission flow.
Mocks the LLM HTTP call so it runs without a real API key.
"""

import json
import sys
import os
import asyncio
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("SKIP: DATABASE_URL not set")
    sys.exit(0)

os.environ.setdefault("JWT_SECRET", "super-secret-key-for-testing-minimum-32-chars")
os.environ.setdefault("LLM_PROVIDER", "openai")
os.environ.setdefault("LLM_API_KEY", "dummy")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "dummy")

MOCK_SPEC = {
    "title": "Frontend Demo",
    "pass_threshold": 0.7,
    "checks": [
        {"id": "c1", "description": "index.html exists", "weight": 0.25,
         "what_to_look_for": "index.html", "pass_criteria": "file present", "fail_criteria": "missing"},
        {"id": "c2", "description": "README.md exists", "weight": 0.25,
         "what_to_look_for": "README.md", "pass_criteria": "file present", "fail_criteria": "missing"},
        {"id": "c3", "description": "CSS file present", "weight": 0.25,
         "what_to_look_for": ".css file", "pass_criteria": "found", "fail_criteria": "missing"},
        {"id": "c4", "description": "JS validation", "weight": 0.25,
         "what_to_look_for": ".js file", "pass_criteria": "found", "fail_criteria": "missing"},
    ]
}

MOCK_CHECK_RESULT = {
    "pass_fail": "pass",
    "score": 0.75,
    "summary": "Good work! 3 of 4 requirements met.",
    "check_results": [
        {"id": "c1", "passed": True,  "score": 0.25, "feedback": "index.html found"},
        {"id": "c2", "passed": True,  "score": 0.25, "feedback": "README.md found"},
        {"id": "c3", "passed": True,  "score": 0.25, "feedback": "style.css found"},
        {"id": "c4", "passed": False, "score": 0.0,  "feedback": "No .js file found"},
    ],
    "teacher_note": "Student needs to add JavaScript form validation."
}


async def main():
    from httpx import AsyncClient, ASGITransport
    import api.database as db
    from api.app import app

    await db.init_pool()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ok = []
        fail = []

        def check(label, cond, got=""):
            if cond:
                ok.append(label)
                print(f"  ✅ {label}")
            else:
                fail.append(label)
                print(f"  ❌ {label}  got: {got}")

        # ── 1. Admin login ────────────────────────────────────────────────────
        print("\n── ADMIN AUTH ──")
        r = await client.post("/auth/login",
                               json={"email": "admin@test.com", "password": "admin123"})
        check("Login returns 200", r.status_code == 200, r.status_code)
        token = r.json().get("access_token", "")
        check("Token received", bool(token))
        H = {"Authorization": f"Bearer {token}"}

        # ── 2. Create teacher + student ───────────────────────────────────────
        print("\n── CREATE USERS ──")
        r = await client.post("/admin/users", headers=H,
                               json={"email": "teacher@t.com", "password": "p", "role": "teacher", "full_name": "Ms T"})
        check("Create teacher → 201", r.status_code == 201, r.status_code)
        teacher_id = r.json().get("id")

        r = await client.post("/admin/users", headers=H,
                               json={"email": "student@t.com", "password": "p", "role": "student", "full_name": "John"})
        check("Create student → 201", r.status_code == 201, r.status_code)
        student_id = r.json().get("id")

        # ── 3. Create assignment — LLM spec generation (MOCKED) ───────────────
        print("\n── ASSIGNMENT CREATION + LLM SPEC GENERATION ──")
        with patch("api.routes.admin.generate_spec", new=AsyncMock(return_value=MOCK_SPEC)):
            r = await client.post("/admin/assignments", headers=H, json={
                "title": "Frontend Demo Level 2",
                "description_text": "Build a responsive website with HTML/CSS/JS. Must have index.html, README, CSS, and JS form validation."
            })
            check("Create assignment → 201", r.status_code == 201, r.status_code)
            assign = r.json()
            assign_id = assign.get("id")
            check("Assignment has title", assign.get("title") == "Frontend Demo Level 2")
            check("Spec status starts as pending", assign.get("spec_status") == "pending")

            # Wait for background spec generation
            await asyncio.sleep(0.3)

        # Check spec was saved
        r = await client.get(f"/admin/assignments/{assign_id}", headers=H)
        assign = r.json()
        check("Spec status → ready after LLM", assign.get("spec_status") == "ready", assign.get("spec_status"))
        check("LLM spec saved to DB", assign.get("llm_spec") is not None)
        spec_checks = (assign.get("llm_spec") or {}).get("checks", [])
        check(f"Spec has {len(spec_checks)} checks", len(spec_checks) == 4, len(spec_checks))

        # ── 4. Student logs in and sees assignment ────────────────────────────
        print("\n── STUDENT VIEWS ASSIGNMENT ──")
        r = await client.post("/auth/login",
                               json={"email": "student@t.com", "password": "p"})
        stoken = r.json().get("access_token", "")
        SH = {"Authorization": f"Bearer {stoken}"}

        r = await client.get("/student/assignments", headers=SH)
        check("Student sees assignments → 200", r.status_code == 200, r.status_code)
        assignments = r.json()
        check("Assignment is visible (spec=ready)", any(a["id"] == assign_id for a in assignments))

        # ── 5. Student submits repo — LLM check (MOCKED) ─────────────────────
        print("\n── STUDENT SUBMITS REPO + LLM CHECKING ──")
        mock_files = [
            {"path": "index.html", "content": "<html><body>hello</body></html>"},
            {"path": "README.md", "content": "# My Project"},
            {"path": "style.css", "content": "body { margin: 0; }"},
        ]
        with patch("api.worker._fetch_repo_files", return_value=mock_files), \
             patch("api.worker.check_repo", new=AsyncMock(return_value=MOCK_CHECK_RESULT)), \
             patch("api.worker._push_tg_message", return_value=None):

            r = await client.post("/student/submit", headers=SH,
                                   json={"assignment_id": assign_id,
                                         "repo_url": "https://github.com/student/myrepo"})
            check("Submit → 202 Accepted", r.status_code == 202, r.status_code)
            sub = r.json()
            sub_id = sub.get("id")
            check("Submission status=pending initially", sub.get("status") == "pending")

            await asyncio.sleep(0.5)

        # ── 6. Check submission result ────────────────────────────────────────
        print("\n── SUBMISSION RESULT ──")
        r = await client.get(f"/student/submissions/{sub_id}", headers=SH)
        sub = r.json()
        check("Submission status=done", sub.get("status") == "done", sub.get("status"))
        check("pass_fail=pass", sub.get("pass_fail") == "pass", sub.get("pass_fail"))
        check("Score=0.75", sub.get("score") == 0.75, sub.get("score"))
        fb = sub.get("feedback_json") or {}
        check("Feedback has summary", bool(fb.get("summary")))
        check("Feedback has 4 check_results", len(fb.get("check_results", [])) == 4)

        # ── 6b. Student asks LLM about their submission ───────────────────────
        print("\n── STUDENT ASKS LLM ──")
        with patch("api.routes.student.llm_complete",
                   new=AsyncMock(return_value="You need to add a .js file with a form validation function.")):
            r = await client.post(f"/student/submissions/{sub_id}/ask", headers=SH,
                                   json={"question": "Why did I fail the JS check?"})
            check("Ask LLM → 200", r.status_code == 200, r.status_code)
            ans = r.json()
            check("Answer contains question", ans.get("question") == "Why did I fail the JS check?")
            check("Answer is not empty", bool(ans.get("answer")))

        r = await client.post(f"/student/submissions/{sub_id}/ask", headers=SH,
                               json={"question": ""})
        check("Empty question → 400", r.status_code == 400, r.status_code)

        # ── 7. Teacher sees student profile ───────────────────────────────────
        print("\n── TEACHER SEES STUDENT PROFILE ──")
        r = await client.post("/auth/login",
                               json={"email": "teacher@t.com", "password": "p"})
        ttoken = r.json().get("access_token", "")
        TH = {"Authorization": f"Bearer {ttoken}"}

        with patch("api.routes.teacher.llm_complete",
                   new=AsyncMock(return_value="John performed well. Passed 1/1 submissions. Needs to add JS.")):
            r = await client.get(f"/teacher/students/{student_id}", headers=TH)
            profile = r.json()
            check("Teacher sees student profile → 200", r.status_code == 200, r.status_code)
            check("Stats: 1 total, 1 done, 1 passed",
                  profile["stats"] == {"total": 1, "done": 1, "passed": 1, "failed": 0},
                  profile["stats"])
            check("LLM summary generated for teacher", bool(profile.get("llm_summary")))
            check("Teacher note in submission feedback",
                  "JavaScript" in json.dumps(profile["submissions"]))

        # ── 8. Chat between student and teacher ───────────────────────────────
        print("\n── CHAT ──")
        r = await client.post(f"/chat/{teacher_id}", headers=SH,
                               json={"body": "Why did I fail c4?"})
        check("Student sends message → 201", r.status_code == 201, r.status_code)

        r = await client.post(f"/chat/{student_id}", headers=TH,
                               json={"body": "You need to add a .js file."})
        check("Teacher replies → 201", r.status_code == 201, r.status_code)

        r = await client.get(f"/chat/{teacher_id}", headers=SH)
        msgs = r.json()
        check("Student sees both messages", len(msgs) == 2, len(msgs))
        check("Conversation order correct",
              msgs[0]["sender_id"] == student_id and msgs[1]["sender_id"] == teacher_id)

        r = await client.get("/chat/conversations", headers=SH)
        check("Student has 1 conversation", len(r.json()) == 1, len(r.json()))

        # ── Summary ───────────────────────────────────────────────────────────
        await db.close_pool()
        print(f"\n{'='*50}")
        print(f"PASSED: {len(ok)}/{len(ok)+len(fail)}")
        if fail:
            print(f"FAILED: {fail}")
        print(f"{'='*50}")
        return len(fail) == 0


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
