"""Student routes: view assignments, submit repos, view feedback."""

import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from .. import database as db
from ..dependencies import require_student
from ..llm.adapter import llm_complete
from ..models import SubmitRequest, SubmissionResponse
from ..worker import process_submission

logger = logging.getLogger(__name__)


class AskLLMRequest(BaseModel):
    question: str

router = APIRouter(prefix="/student", tags=["student"])


@router.get("/assignments")
async def list_assignments(student: dict = Depends(require_student)):
    rows = await db.fetchall(
        "SELECT id, title, description_text, spec_status, created_at FROM assignments WHERE university_id = %s AND spec_status = 'ready' ORDER BY created_at DESC",
        (student["university_id"],),
    )
    return rows


@router.post("/submit", response_model=SubmissionResponse, status_code=202)
async def submit(
    body: SubmitRequest,
    background_tasks: BackgroundTasks,
    student: dict = Depends(require_student),
):
    # Verify assignment belongs to same university and is ready
    assignment = await db.fetchone(
        "SELECT id, spec_status FROM assignments WHERE id = %s AND university_id = %s",
        (body.assignment_id, student["university_id"]),
    )
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if assignment["spec_status"] != "ready":
        raise HTTPException(409, "Assignment spec is not ready yet. Try again in a moment.")

    row = await db.execute_returning(
        """
        INSERT INTO submissions (assignment_id, student_id, repo_url)
        VALUES (%s, %s, %s)
        RETURNING id, assignment_id, student_id, repo_url, status,
                  pass_fail, score, feedback_json, created_at, completed_at
        """,
        (body.assignment_id, student["id"], body.repo_url),
    )
    background_tasks.add_task(process_submission, row["id"])
    return SubmissionResponse(**row)


@router.get("/submissions", response_model=list[SubmissionResponse])
async def my_submissions(student: dict = Depends(require_student)):
    rows = await db.fetchall(
        """
        SELECT id, assignment_id, student_id, repo_url, status,
               pass_fail, score, feedback_json, created_at, completed_at
        FROM submissions WHERE student_id = %s ORDER BY created_at DESC
        """,
        (student["id"],),
    )
    return [SubmissionResponse(**r) for r in rows]


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: int, student: dict = Depends(require_student)):
    row = await db.fetchone(
        """
        SELECT s.id, s.assignment_id, s.student_id, s.repo_url, s.status,
               s.pass_fail, s.score, s.feedback_json, s.created_at, s.completed_at,
               a.title AS assignment_title
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE s.id = %s AND s.student_id = %s
        """,
        (submission_id, student["id"]),
    )
    if not row:
        raise HTTPException(404, "Submission not found")
    return dict(row)


@router.post("/submissions/{submission_id}/ask")
async def ask_llm(
    submission_id: int,
    body: AskLLMRequest,
    student: dict = Depends(require_student),
):
    """Student asks the LLM a question about their submission result."""
    if not body.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    row = await db.fetchone(
        """
        SELECT s.feedback_json, s.pass_fail, s.score, s.status,
               a.title AS assignment_title, a.description_text
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        WHERE s.id = %s AND s.student_id = %s
        """,
        (submission_id, student["id"]),
    )
    if not row:
        raise HTTPException(404, "Submission not found")
    if row["status"] != "done":
        raise HTTPException(409, "Submission is not finished yet")

    feedback = row["feedback_json"] or {}
    system = (
        "You are an AI tutor helping a student understand their assignment result. "
        "Be specific, encouraging, and action-oriented. Answer in 2-4 sentences."
    )
    context = (
        f"Assignment: {row['assignment_title']}\n"
        f"Result: {row['pass_fail']} (score: {row['score']:.0%})\n"
        f"Summary: {feedback.get('summary', '')}\n"
        f"Failed checks:\n" +
        "\n".join(
            f"- {c['id']}: {c.get('feedback', '')}"
            for c in feedback.get("check_results", [])
            if not c.get("passed")
        )
    )
    user_msg = f"Context:\n{context}\n\nStudent question: {body.question}"

    try:
        answer = await llm_complete(system=system, user=user_msg)
    except Exception as exc:
        logger.warning("LLM ask failed for submission %s: %s", submission_id, exc)
        raise HTTPException(503, "LLM service unavailable. Try again later.")

    return {"question": body.question, "answer": answer}
