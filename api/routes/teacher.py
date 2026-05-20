"""Teacher routes: view students, submissions, and LLM summaries."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from .. import database as db
from ..dependencies import require_teacher
from ..llm.adapter import llm_complete
from ..models import SubmissionResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teacher", tags=["teacher"])

_SUMMARY_SYSTEM = """You are an AI teaching assistant. Given a student's submission history,
write a brief (3–5 sentence) instructor summary covering:
- Overall performance (pass rate, score trend)
- Most common mistakes
- Specific interventions the teacher should consider
Be concrete and action-oriented. Write in plain English."""


@router.get("/students", response_model=list[UserResponse])
async def list_students(teacher: dict = Depends(require_teacher)):
    rows = await db.fetchall(
        "SELECT id, university_id, email, role, full_name, tg_id, created_at FROM users WHERE university_id = %s AND role = 'student' ORDER BY full_name",
        (teacher["university_id"],),
    )
    return [UserResponse(**r) for r in rows]


@router.get("/students/{student_id}")
async def get_student_profile(student_id: int, teacher: dict = Depends(require_teacher)):
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

    # Build LLM summary from completed submissions
    llm_summary = None
    done = [s for s in submissions if s["status"] == "done"]
    if done:
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


@router.get("/assignments")
async def list_assignments(teacher: dict = Depends(require_teacher)):
    rows = await db.fetchall(
        "SELECT id, title, description_text, spec_status, created_at FROM assignments WHERE university_id = %s ORDER BY created_at DESC",
        (teacher["university_id"],),
    )
    return rows
