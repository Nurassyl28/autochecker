"""Telegram bot integration endpoints."""

from fastapi import APIRouter, BackgroundTasks, HTTPException

from .. import database as db
from ..models import BotRegisterRequest, BotSubmitRequest, SubmissionResponse
from ..worker import process_submission

router = APIRouter(prefix="/bot", tags=["bot"])


@router.post("/register")
async def register_tg(body: BotRegisterRequest):
    """Link a Telegram account to a student user by email."""
    user = await db.fetchone(
        "SELECT id, role FROM users WHERE email = %s",
        (body.email,),
    )
    if not user:
        raise HTTPException(404, "No account with that email. Ask your admin to register you first.")
    await db.execute(
        "UPDATE users SET tg_id = %s WHERE id = %s",
        (body.tg_id, user["id"]),
    )
    return {"ok": True, "user_id": user["id"], "role": user["role"]}


@router.post("/submit", response_model=SubmissionResponse, status_code=202)
async def bot_submit(body: BotSubmitRequest, background_tasks: BackgroundTasks):
    """Receive a submission from the Telegram bot."""
    student = await db.fetchone(
        "SELECT id, university_id FROM users WHERE tg_id = %s AND role = 'student'",
        (body.tg_id,),
    )
    if not student:
        raise HTTPException(404, "Student not found. Use /register first.")

    assignment = await db.fetchone(
        "SELECT id, spec_status FROM assignments WHERE id = %s AND university_id = %s",
        (body.assignment_id, student["university_id"]),
    )
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if assignment["spec_status"] != "ready":
        raise HTTPException(409, "Assignment not ready yet")

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


@router.get("/assignments")
async def bot_list_assignments(tg_id: int):
    """Return available assignments for a student identified by tg_id."""
    student = await db.fetchone(
        "SELECT id, university_id FROM users WHERE tg_id = %s AND role = 'student'",
        (tg_id,),
    )
    if not student:
        raise HTTPException(404, "Student not found")
    rows = await db.fetchall(
        "SELECT id, title FROM assignments WHERE university_id = %s AND spec_status = 'ready' ORDER BY created_at DESC",
        (student["university_id"],),
    )
    return rows


@router.get("/status/{submission_id}")
async def submission_status(submission_id: int, tg_id: int):
    """Let the bot poll submission status."""
    student = await db.fetchone(
        "SELECT id FROM users WHERE tg_id = %s",
        (tg_id,),
    )
    if not student:
        raise HTTPException(404, "Student not found")
    row = await db.fetchone(
        "SELECT id, status, pass_fail, score FROM submissions WHERE id = %s AND student_id = %s",
        (submission_id, student["id"]),
    )
    if not row:
        raise HTTPException(404, "Submission not found")
    return dict(row)
