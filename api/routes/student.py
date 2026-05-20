"""Student routes: view assignments, submit repos, view feedback."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from .. import database as db
from ..dependencies import require_student
from ..models import SubmitRequest, SubmissionResponse
from ..worker import process_submission

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
