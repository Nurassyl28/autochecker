"""Telegram bot integration endpoints."""

from fastapi import APIRouter, BackgroundTasks, HTTPException

from .. import database as db
from ..auth import hash_password
from ..models import BotRegisterRequest, BotSubmitRequest, SubmissionResponse
from ..worker import process_submission

router = APIRouter(prefix="/bot", tags=["bot"])


@router.get("/me")
async def bot_me(tg_id: int):
    """Return user info for a given tg_id, or 404 if not registered."""
    user = await db.fetchone(
        "SELECT id, university_id, email, role, tg_id, full_name FROM users WHERE tg_id = %s",
        (tg_id,),
    )
    if not user:
        raise HTTPException(404, "Not registered")
    return dict(user)


@router.post("/register")
async def register_tg(body: BotRegisterRequest):
    """Link a Telegram account to a student user by email.
    If the user doesn't exist yet, creates one as a student.
    """
    # Find the first university (for auto-created users)
    univ = await db.fetchone("SELECT id FROM universities ORDER BY id LIMIT 1")
    if not univ:
        raise HTTPException(500, "No university configured. Ask your admin to run init_v2.py.")

    university_id = univ["id"]
    email = body.email.lower().strip()

    user = await db.fetchone(
        "SELECT id, role, tg_id FROM users WHERE email = %s",
        (email,),
    )

    if user:
        # User exists — check if tg_id is taken by someone else
        if user["tg_id"] and user["tg_id"] != body.tg_id:
            raise HTTPException(409, "This email is already linked to a different Telegram account.")
        await db.execute(
            "UPDATE users SET tg_id = %s WHERE id = %s",
            (body.tg_id, user["id"]),
        )
        return {"ok": True, "user_id": user["id"], "role": user["role"], "created": False}
    else:
        # Auto-create student account
        full_name = getattr(body, "full_name", "") or ""
        row = await db.execute_returning(
            """INSERT INTO users (university_id, email, password_hash, role, tg_id, full_name)
               VALUES (%s, %s, %s, 'student', %s, %s)
               RETURNING id, role""",
            (university_id, email, hash_password("changeme"), body.tg_id, full_name),
        )
        return {"ok": True, "user_id": row["id"], "role": "student", "created": True}


@router.post("/submit", response_model=SubmissionResponse, status_code=202)
async def bot_submit(body: BotSubmitRequest, background_tasks: BackgroundTasks):
    """Receive a submission from the Telegram bot."""
    student = await db.fetchone(
        "SELECT id, university_id FROM users WHERE tg_id = %s AND role = 'student'",
        (body.tg_id,),
    )
    if not student:
        raise HTTPException(404, "Student not found. Use /start to register first.")

    assignment = await db.fetchone(
        "SELECT id, spec_status FROM assignments WHERE id = %s AND university_id = %s",
        (body.assignment_id, student["university_id"]),
    )
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if assignment["spec_status"] != "ready":
        raise HTTPException(409, "Assignment is not ready for submissions yet")

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
        """SELECT id, title FROM assignments
           WHERE university_id = %s AND spec_status = 'ready'
           ORDER BY created_at DESC""",
        (student["university_id"],),
    )
    return [dict(r) for r in rows]


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
