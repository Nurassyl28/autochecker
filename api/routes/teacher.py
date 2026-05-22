"""Teacher routes: view students, submissions, LLM summaries, and assignment management."""

import io
import json
import logging
from typing import Optional

import json as _json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .. import database as db
from ..dependencies import require_teacher
from ..llm.adapter import llm_complete
from ..models import AssignmentCreate, AssignmentResponse, SubmissionResponse, UserResponse
from .admin import _trigger_spec_generation, _extract_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teacher", tags=["teacher"])

_SUMMARY_SYSTEM = """You are an AI teaching assistant. Given a student's submission history,
write a brief (3–5 sentence) instructor summary covering:
- Overall performance (pass rate, score trend)
- Most common mistakes
- Specific interventions the teacher should consider
Be concrete and action-oriented. Write in plain English."""


@router.get("/students")
async def list_students(teacher: dict = Depends(require_teacher)):
    rows = await db.fetchall(
        """
        SELECT
            u.id, u.university_id, u.email, u.role, u.full_name, u.tg_id, u.created_at,
            COUNT(s.id) FILTER (WHERE s.status = 'done')                          AS total_tasks,
            COUNT(s.id) FILTER (WHERE s.status = 'done' AND s.pass_fail = 'pass') AS passed_tasks,
            ROUND(
                COALESCE(AVG(s.score) FILTER (WHERE s.status = 'done' AND s.score IS NOT NULL) * 100, 0)
            )::int                                                                  AS avg_score
        FROM users u
        LEFT JOIN submissions s ON s.student_id = u.id
        WHERE u.university_id = %s AND u.role = 'student'
        GROUP BY u.id
        ORDER BY avg_score DESC, passed_tasks DESC
        """,
        (teacher["university_id"],),
    )
    result = []
    for r in rows:
        d = dict(r)
        total = d["total_tasks"] or 0
        passed = d["passed_tasks"] or 0
        avg = int(d["avg_score"] or 0)
        d["progress"] = round(passed / total * 100) if total > 0 else 0
        d["avg_score"] = avg
        d["passed_tasks"] = passed
        d["total_tasks"] = total
        result.append(d)
    return result


@router.get("/students/{student_id}")
async def get_student_profile(
    student_id: int,
    include_summary: bool = False,
    teacher: dict = Depends(require_teacher),
):
    student = await db.fetchone(
        "SELECT id, university_id, email, role, full_name, tg_id, created_at FROM users WHERE id = %s AND university_id = %s AND role = 'student'",
        (student_id, teacher["university_id"]),
    )
    if not student:
        raise HTTPException(404, "Student not found")

    submissions = await db.fetchall(
        """
        SELECT s.id, s.assignment_id, s.student_id, s.repo_url, s.status,
               s.pass_fail, s.score, s.feedback_json, s.created_at, s.completed_at,
               a.title AS assignment_title
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE s.student_id = %s
        ORDER BY s.created_at DESC
        """,
        (student_id,),
    )

    # LLM summary only when explicitly requested (slow — skipped for mark expand)
    llm_summary = None
    done = [s for s in submissions if s["status"] == "done"]
    if include_summary and done:
        try:
            history = "\n".join(
                f"- {s['assignment_title']}: {s['pass_fail'] or 'N/A'} (score {s['score'] or 0:.0%})"
                for s in done
            )
            llm_summary = await llm_complete(
                system=_SUMMARY_SYSTEM,
                user=f"Student: {student['full_name'] or student['email']}\n\nSubmission history:\n{history}",
            )
        except Exception as exc:
            logger.warning("LLM summary failed for student %s: %s", student_id, exc)
            llm_summary = None

    return {
        "student": dict(student),
        "submissions": [dict(s) for s in submissions],
        "llm_summary": llm_summary,
        "stats": {
            "total": len(submissions),
            "done": len(done),
            "passed": sum(1 for s in done if s["pass_fail"] == "pass"),
            "failed": sum(1 for s in done if s["pass_fail"] == "fail"),
        },
    }


@router.get("/submissions", response_model=list[SubmissionResponse])
async def list_submissions(
    assignment_id: Optional[int] = None,
    pass_fail: Optional[str] = None,
    teacher: dict = Depends(require_teacher),
):
    clauses = ["a.university_id = %s"]
    params: list = [teacher["university_id"]]
    if assignment_id:
        clauses.append("s.assignment_id = %s")
        params.append(assignment_id)
    if pass_fail:
        clauses.append("s.pass_fail = %s")
        params.append(pass_fail)
    where = " AND ".join(clauses)
    rows = await db.fetchall(
        f"""
        SELECT s.id, s.assignment_id, s.student_id, s.repo_url, s.status,
               s.pass_fail, s.score, s.feedback_json, s.created_at, s.completed_at
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE {where}
        ORDER BY s.created_at DESC
        """,
        tuple(params),
    )
    return [SubmissionResponse(**r) for r in rows]


@router.get("/submissions/{submission_id}")
async def get_submission_detail(submission_id: int, teacher: dict = Depends(require_teacher)):
    row = await db.fetchone(
        """
        SELECT s.*, a.title AS assignment_title, u.email AS student_email, u.full_name AS student_name
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN users u ON u.id = s.student_id
        WHERE s.id = %s AND a.university_id = %s
        """,
        (submission_id, teacher["university_id"]),
    )
    if not row:
        raise HTTPException(404, "Submission not found")
    return dict(row)


class GradeBody(BaseModel):
    score: float      # 0.0 – 1.0
    pass_fail: str    # "pass" | "fail"
    comment: str = ""


@router.patch("/submissions/{submission_id}/grade")
async def grade_submission(
    submission_id: int,
    body: GradeBody,
    teacher: dict = Depends(require_teacher),
):
    """Teacher manually sets score and pass/fail on a submission."""
    if body.pass_fail not in ("pass", "fail"):
        raise HTTPException(400, "pass_fail must be 'pass' or 'fail'")
    if not (0.0 <= body.score <= 1.0):
        raise HTTPException(400, "score must be between 0.0 and 1.0")

    row = await db.fetchone(
        """SELECT s.id FROM submissions s
           JOIN assignments a ON a.id = s.assignment_id
           WHERE s.id = %s AND a.university_id = %s""",
        (submission_id, teacher["university_id"]),
    )
    if not row:
        raise HTTPException(404, "Submission not found")

    existing = await db.fetchone("SELECT feedback_json FROM submissions WHERE id = %s", (submission_id,))
    fb = existing["feedback_json"] or {}
    if body.comment.strip():
        fb["teacher_comment"] = body.comment.strip()
    fb["graded_by_teacher"] = True

    await db.execute(
        """UPDATE submissions
           SET score = %s, pass_fail = %s, status = 'done',
               feedback_json = %s::jsonb, completed_at = COALESCE(completed_at, %s)
           WHERE id = %s""",
        (body.score, body.pass_fail, _json.dumps(fb), datetime.now(timezone.utc), submission_id),
    )
    return {"ok": True, "submission_id": submission_id, "score": body.score, "pass_fail": body.pass_fail}


@router.get("/assignments")
async def list_assignments(teacher: dict = Depends(require_teacher)):
    rows = await db.fetchall(
        "SELECT id, title, description_text, spec_status, llm_spec, created_by, created_at FROM assignments WHERE university_id = %s ORDER BY created_at DESC",
        (teacher["university_id"],),
    )
    return rows


@router.post("/assignments", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    background_tasks: BackgroundTasks,
    body: AssignmentCreate,
    teacher: dict = Depends(require_teacher),
):
    row = await db.execute_returning(
        """
        INSERT INTO assignments (university_id, title, description_text, created_by)
        VALUES (%s, %s, %s, %s)
        RETURNING id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at
        """,
        (teacher["university_id"], body.title, body.description_text, teacher["id"]),
    )
    background_tasks.add_task(_trigger_spec_generation, row["id"], body.description_text)
    return AssignmentResponse(**row)


@router.post("/assignments/upload", response_model=AssignmentResponse, status_code=201)
async def create_assignment_from_file(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    file: UploadFile = File(...),
    teacher: dict = Depends(require_teacher),
):
    """Create assignment from txt, md, pdf, or docx file."""
    content = await file.read()
    filename = (file.filename or "").lower()
    description_text = _extract_text(content, filename)
    if not description_text.strip():
        raise HTTPException(400, "Could not extract text. Supported: txt, md, pdf, docx")
    row = await db.execute_returning(
        """
        INSERT INTO assignments (university_id, title, description_text, created_by)
        VALUES (%s, %s, %s, %s)
        RETURNING id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at
        """,
        (teacher["university_id"], title, description_text, teacher["id"]),
    )
    background_tasks.add_task(_trigger_spec_generation, row["id"], description_text)
    return AssignmentResponse(**row)


@router.patch("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    teacher: dict = Depends(require_teacher),
):
    allowed = {"title", "description_text"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [assignment_id, teacher["university_id"]]
    await db.execute(
        f"UPDATE assignments SET {set_clause} WHERE id = %s AND university_id = %s",
        tuple(params),
    )
    if "description_text" in updates:
        background_tasks.add_task(_trigger_spec_generation, assignment_id, updates["description_text"])
    row = await db.fetchone(
        "SELECT id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at FROM assignments WHERE id = %s",
        (assignment_id,),
    )
    return AssignmentResponse(**row)


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: int, teacher: dict = Depends(require_teacher)):
    await db.execute(
        "DELETE FROM assignments WHERE id = %s AND university_id = %s",
        (assignment_id, teacher["university_id"]),
    )
