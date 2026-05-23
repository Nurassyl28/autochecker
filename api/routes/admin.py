"""Admin routes: manage users and assignments within their university."""

import asyncio
import io
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status

from .. import database as db
from ..auth import hash_password
from ..dependencies import require_admin
from ..llm.spec_generator import generate_spec
from ..models import AssignmentCreate, AssignmentResponse, SubmissionResponse, UserCreate, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# ── Users ─────────────────────────────────────────────────────────────────────

@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(body: UserCreate, admin: dict = Depends(require_admin)):
    if body.role not in ("admin", "teacher", "student"):
        raise HTTPException(400, "role must be admin, teacher, or student")
    existing = await db.fetchone(
        "SELECT id FROM users WHERE university_id = %s AND email = %s",
        (admin["university_id"], body.email),
    )
    if existing:
        raise HTTPException(409, "Email already registered in this university")
    row = await db.execute_returning(
        """
        INSERT INTO users (university_id, email, password_hash, role, full_name)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, university_id, email, role, full_name, tg_id, created_at
        """,
        (admin["university_id"], body.email, hash_password(body.password), body.role, body.full_name),
    )
    return UserResponse(**row)


@router.get("/users", response_model=list[UserResponse])
async def list_users(role: Optional[str] = None, admin: dict = Depends(require_admin)):
    if role:
        rows = await db.fetchall(
            "SELECT id, university_id, email, role, full_name, tg_id, created_at FROM users WHERE university_id = %s AND role = %s ORDER BY created_at DESC",
            (admin["university_id"], role),
        )
    else:
        rows = await db.fetchall(
            "SELECT id, university_id, email, role, full_name, tg_id, created_at FROM users WHERE university_id = %s ORDER BY role, created_at DESC",
            (admin["university_id"],),
        )
    return [UserResponse(**r) for r in rows]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, admin: dict = Depends(require_admin)):
    row = await db.fetchone(
        "SELECT id, university_id, email, role, full_name, tg_id, created_at FROM users WHERE id = %s AND university_id = %s",
        (user_id, admin["university_id"]),
    )
    if not row:
        raise HTTPException(404, "User not found")
    return UserResponse(**row)


@router.patch("/users/{user_id}")
async def update_user(user_id: int, body: dict, admin: dict = Depends(require_admin)):
    allowed = {"full_name", "password", "role"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [user_id, admin["university_id"]]
    await db.execute(
        f"UPDATE users SET {set_clause} WHERE id = %s AND university_id = %s",
        tuple(params),
    )
    return {"ok": True}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    await db.execute(
        "DELETE FROM users WHERE id = %s AND university_id = %s",
        (user_id, admin["university_id"]),
    )


# ── Assignments ───────────────────────────────────────────────────────────────

async def _trigger_spec_generation(assignment_id: int, description: str) -> None:
    """Background: call LLM, save spec."""
    try:
        await db.execute(
            "UPDATE assignments SET spec_status = 'generating' WHERE id = %s",
            (assignment_id,),
        )
        spec = await generate_spec(description)
        import json
        await db.execute(
            "UPDATE assignments SET llm_spec = %s::jsonb, spec_status = 'ready' WHERE id = %s",
            (json.dumps(spec), assignment_id),
        )
        logger.info("Spec generated for assignment %s", assignment_id)
    except Exception as exc:
        logger.exception("Spec generation failed for assignment %s: %s", assignment_id, exc)
        await db.execute(
            "UPDATE assignments SET spec_status = 'failed' WHERE id = %s",
            (assignment_id,),
        )


@router.post("/assignments", response_model=AssignmentResponse, status_code=201)
async def create_assignment(
    background_tasks: BackgroundTasks,
    body: AssignmentCreate,
    admin: dict = Depends(require_admin),
):
    row = await db.execute_returning(
        """
        INSERT INTO assignments (university_id, title, description_text, created_by)
        VALUES (%s, %s, %s, %s)
        RETURNING id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at
        """,
        (admin["university_id"], body.title, body.description_text, admin["id"]),
    )
    background_tasks.add_task(_trigger_spec_generation, row["id"], body.description_text)
    return AssignmentResponse(**row)


@router.post("/assignments/upload", response_model=AssignmentResponse, status_code=201)
async def create_assignment_from_file(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
):
    """Create assignment from a file (txt, md, pdf, docx). Text extracted automatically."""
    content = await file.read()
    filename = (file.filename or "").lower()
    description_text = _extract_text(content, filename)
    if not description_text.strip():
        raise HTTPException(400, "Could not extract text from file. Supported: txt, md, pdf, docx")

    row = await db.execute_returning(
        """
        INSERT INTO assignments (university_id, title, description_text, created_by)
        VALUES (%s, %s, %s, %s)
        RETURNING id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at
        """,
        (admin["university_id"], title, description_text, admin["id"]),
    )
    background_tasks.add_task(_trigger_spec_generation, row["id"], description_text)
    return AssignmentResponse(**row)


def _extract_text(data: bytes, filename: str) -> str:
    if filename.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    if filename.endswith(".docx"):
        try:
            import docx as _docx
            doc = _docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""
    # txt, md, and anything else: decode as UTF-8
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


@router.get("/assignments", response_model=list[AssignmentResponse])
async def list_assignments(admin: dict = Depends(require_admin)):
    rows = await db.fetchall(
        "SELECT id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at FROM assignments WHERE university_id = %s ORDER BY created_at DESC",
        (admin["university_id"],),
    )
    return [AssignmentResponse(**r) for r in rows]


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(assignment_id: int, admin: dict = Depends(require_admin)):
    row = await db.fetchone(
        "SELECT id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at FROM assignments WHERE id = %s AND university_id = %s",
        (assignment_id, admin["university_id"]),
    )
    if not row:
        raise HTTPException(404, "Assignment not found")
    return AssignmentResponse(**row)


@router.patch("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
):
    allowed = {"title", "description_text"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [assignment_id, admin["university_id"]]
    await db.execute(
        f"UPDATE assignments SET {set_clause} WHERE id = %s AND university_id = %s",
        tuple(params),
    )
    # Re-generate spec if description changed
    if "description_text" in updates:
        background_tasks.add_task(_trigger_spec_generation, assignment_id, updates["description_text"])

    row = await db.fetchone(
        "SELECT id, university_id, title, description_text, spec_status, llm_spec, created_by, created_at FROM assignments WHERE id = %s",
        (assignment_id,),
    )
    return AssignmentResponse(**row)


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: int, admin: dict = Depends(require_admin)):
    await db.execute(
        "DELETE FROM assignments WHERE id = %s AND university_id = %s",
        (assignment_id, admin["university_id"]),
    )


# ── Classes ───────────────────────────────────────────────────────────────────

@router.get("/classes")
async def list_classes(admin: dict = Depends(require_admin)):
    rows = await db.fetchall(
        """
        SELECT c.id, c.name, c.created_at,
               c.teacher_id,
               u.full_name AS teacher_name, u.email AS teacher_email,
               COUNT(cm.student_id) AS student_count
        FROM classes c
        LEFT JOIN users u ON u.id = c.teacher_id
        LEFT JOIN class_members cm ON cm.class_id = c.id
        WHERE c.university_id = %s
        GROUP BY c.id, u.full_name, u.email
        ORDER BY c.created_at DESC
        """,
        (admin["university_id"],),
    )
    return [dict(r) for r in rows]


@router.post("/classes", status_code=201)
async def create_class(body: dict, admin: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Class name is required")
    teacher_id = body.get("teacher_id")
    student_ids = body.get("student_ids") or []

    if teacher_id:
        teacher = await db.fetchone(
            "SELECT id FROM users WHERE id = %s AND university_id = %s AND role = 'teacher'",
            (teacher_id, admin["university_id"]),
        )
        if not teacher:
            raise HTTPException(404, "Teacher not found")

    row = await db.execute_returning(
        "INSERT INTO classes (university_id, name, teacher_id) VALUES (%s, %s, %s) RETURNING id, name, teacher_id, created_at",
        (admin["university_id"], name, teacher_id),
    )
    class_id = row["id"]

    for sid in student_ids:
        student = await db.fetchone(
            "SELECT id FROM users WHERE id = %s AND university_id = %s AND role = 'student'",
            (sid, admin["university_id"]),
        )
        if student:
            await db.execute(
                "INSERT INTO class_members (class_id, student_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (class_id, sid),
            )

    return dict(row)


@router.get("/classes/{class_id}")
async def get_class(class_id: int, admin: dict = Depends(require_admin)):
    cls = await db.fetchone(
        """
        SELECT c.id, c.name, c.created_at, c.teacher_id,
               u.full_name AS teacher_name, u.email AS teacher_email
        FROM classes c
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE c.id = %s AND c.university_id = %s
        """,
        (class_id, admin["university_id"]),
    )
    if not cls:
        raise HTTPException(404, "Class not found")
    members = await db.fetchall(
        """
        SELECT u.id, u.full_name, u.email
        FROM class_members cm
        JOIN users u ON u.id = cm.student_id
        WHERE cm.class_id = %s
        ORDER BY u.full_name
        """,
        (class_id,),
    )
    result = dict(cls)
    result["students"] = [dict(m) for m in members]
    return result


@router.patch("/classes/{class_id}")
async def update_class(class_id: int, body: dict, admin: dict = Depends(require_admin)):
    cls = await db.fetchone(
        "SELECT id FROM classes WHERE id = %s AND university_id = %s",
        (class_id, admin["university_id"]),
    )
    if not cls:
        raise HTTPException(404, "Class not found")
    allowed = {"name", "teacher_id"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [class_id]
    await db.execute(f"UPDATE classes SET {set_clause} WHERE id = %s", tuple(params))
    return {"ok": True}


@router.post("/classes/{class_id}/members", status_code=201)
async def add_class_members(class_id: int, body: dict, admin: dict = Depends(require_admin)):
    cls = await db.fetchone(
        "SELECT id FROM classes WHERE id = %s AND university_id = %s",
        (class_id, admin["university_id"]),
    )
    if not cls:
        raise HTTPException(404, "Class not found")
    student_ids = body.get("student_ids") or []
    added = 0
    for sid in student_ids:
        student = await db.fetchone(
            "SELECT id FROM users WHERE id = %s AND university_id = %s AND role = 'student'",
            (sid, admin["university_id"]),
        )
        if student:
            await db.execute(
                "INSERT INTO class_members (class_id, student_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (class_id, sid),
            )
            added += 1
    return {"ok": True, "added": added}


@router.delete("/classes/{class_id}/members/{student_id}", status_code=204)
async def remove_class_member(class_id: int, student_id: int, admin: dict = Depends(require_admin)):
    cls = await db.fetchone(
        "SELECT id FROM classes WHERE id = %s AND university_id = %s",
        (class_id, admin["university_id"]),
    )
    if not cls:
        raise HTTPException(404, "Class not found")
    await db.execute(
        "DELETE FROM class_members WHERE class_id = %s AND student_id = %s",
        (class_id, student_id),
    )


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(class_id: int, admin: dict = Depends(require_admin)):
    await db.execute(
        "DELETE FROM classes WHERE id = %s AND university_id = %s",
        (class_id, admin["university_id"]),
    )


# ── All submissions (admin overview) ─────────────────────────────────────────

@router.get("/submissions", response_model=list[SubmissionResponse])
async def list_all_submissions(
    assignment_id: Optional[int] = None,
    status: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    clauses = ["a.university_id = %s"]
    params: list = [admin["university_id"]]
    if assignment_id:
        clauses.append("s.assignment_id = %s")
        params.append(assignment_id)
    if status:
        clauses.append("s.status = %s")
        params.append(status)
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
