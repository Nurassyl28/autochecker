"""Super-admin routes: platform-level management of universities and all their data."""

import os
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Header
from pydantic import BaseModel

from .. import database as db
from ..auth import hash_password
from .admin import _trigger_spec_generation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/superadmin", tags=["superadmin"])

SUPERADMIN_KEY = os.environ.get("SUPERADMIN_KEY", "")


def _check_key(key: str):
    if not SUPERADMIN_KEY:
        raise HTTPException(503, "Super-admin not configured (set SUPERADMIN_KEY env var)")
    if key != SUPERADMIN_KEY:
        raise HTTPException(401, "Invalid super-admin key")


def _sa_header(key: str):
    """Dependency-style helper: extracts and validates key from header."""
    _check_key(key)


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/auth")
async def superadmin_auth(body: dict):
    _check_key(body.get("key", ""))
    return {"ok": True}


# ── Universities ──────────────────────────────────────────────────────────────

class UniversityCreate(BaseModel):
    name: str
    slug: str
    admin_email: str
    admin_password: str
    admin_full_name: Optional[str] = None


@router.get("/universities")
async def list_universities(x_superadmin_key: str = Header(..., alias="X-Superadmin-Key")):
    _check_key(x_superadmin_key)
    rows = await db.fetchall(
        """
        SELECT u.id, u.name, u.slug, u.created_at,
               COUNT(us.id) FILTER (WHERE us.role = 'admin')    AS admin_count,
               COUNT(us.id) FILTER (WHERE us.role = 'teacher')  AS teacher_count,
               COUNT(us.id) FILTER (WHERE us.role = 'student')  AS student_count
        FROM universities u
        LEFT JOIN users us ON us.university_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        """,
        (),
    )
    return [dict(r) for r in rows]


@router.post("/universities", status_code=201)
async def create_university(
    body: UniversityCreate,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    name = body.name.strip()
    slug = body.slug.strip().lower()
    if not name or not slug:
        raise HTTPException(400, "name and slug are required")
    if await db.fetchone("SELECT id FROM universities WHERE slug = %s", (slug,)):
        raise HTTPException(409, "University with this slug already exists")

    uni = await db.execute_returning(
        "INSERT INTO universities (name, slug) VALUES (%s, %s) RETURNING id, name, slug, created_at",
        (name, slug),
    )
    await db.execute(
        "INSERT INTO users (university_id, email, password_hash, role, full_name) VALUES (%s, %s, %s, 'admin', %s)",
        (uni["id"], body.admin_email, hash_password(body.admin_password), body.admin_full_name or ""),
    )
    logger.info("Created university %s (id=%s) with admin %s", name, uni["id"], body.admin_email)
    return {"university": dict(uni), "admin_email": body.admin_email}


@router.delete("/universities/{university_id}", status_code=204)
async def delete_university(
    university_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    await db.execute("DELETE FROM universities WHERE id = %s", (university_id,))


# ── Users inside a university ─────────────────────────────────────────────────

@router.get("/universities/{university_id}/users")
async def list_university_users(
    university_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    rows = await db.fetchall(
        "SELECT id, email, full_name, role, tg_id, created_at FROM users WHERE university_id = %s ORDER BY role, created_at DESC",
        (university_id,),
    )
    return [dict(r) for r in rows]


@router.post("/universities/{university_id}/users", status_code=201)
async def create_university_user(
    university_id: int,
    body: dict,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    full_name = (body.get("full_name") or "").strip()
    role = body.get("role", "student")
    if role not in ("admin", "teacher", "student"):
        raise HTTPException(400, "role must be admin, teacher, or student")
    if not email or not password:
        raise HTTPException(400, "email and password are required")
    if not await db.fetchone("SELECT id FROM universities WHERE id = %s", (university_id,)):
        raise HTTPException(404, "University not found")
    if await db.fetchone("SELECT id FROM users WHERE university_id = %s AND email = %s", (university_id, email)):
        raise HTTPException(409, "Email already registered in this university")
    row = await db.execute_returning(
        "INSERT INTO users (university_id, email, password_hash, role, full_name) VALUES (%s, %s, %s, %s, %s) RETURNING id, email, role, full_name, created_at",
        (university_id, email, hash_password(password), role, full_name),
    )
    return dict(row)


@router.patch("/universities/{university_id}/users/{user_id}")
async def update_university_user(
    university_id: int,
    user_id: int,
    body: dict,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    updates: dict = {}
    if body.get("email"):
        if await db.fetchone("SELECT id FROM users WHERE email = %s AND id != %s", (body["email"], user_id)):
            raise HTTPException(400, "Email already in use")
        updates["email"] = body["email"].strip()
    if body.get("password"):
        updates["password_hash"] = hash_password(body["password"])
    if body.get("full_name") is not None:
        updates["full_name"] = body["full_name"].strip()
    if not updates:
        raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    await db.execute(
        f"UPDATE users SET {set_clause} WHERE id = %s AND university_id = %s",
        (*updates.values(), user_id, university_id),
    )
    return {"ok": True}


@router.delete("/universities/{university_id}/users/{user_id}", status_code=204)
async def delete_university_user(
    university_id: int,
    user_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    await db.execute("DELETE FROM users WHERE id = %s AND university_id = %s", (user_id, university_id))


# ── Classes inside a university ───────────────────────────────────────────────

@router.get("/universities/{university_id}/classes")
async def list_university_classes(
    university_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    rows = await db.fetchall(
        """
        SELECT c.id, c.name, c.created_at,
               u.full_name AS teacher_name, u.email AS teacher_email,
               COUNT(cm.student_id) AS student_count
        FROM classes c
        LEFT JOIN users u ON u.id = c.teacher_id
        LEFT JOIN class_members cm ON cm.class_id = c.id
        WHERE c.university_id = %s
        GROUP BY c.id, u.full_name, u.email
        ORDER BY c.created_at DESC
        """,
        (university_id,),
    )
    return [dict(r) for r in rows]


@router.post("/universities/{university_id}/classes", status_code=201)
async def create_university_class(
    university_id: int,
    body: dict,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Class name is required")
    teacher_id = body.get("teacher_id")
    row = await db.execute_returning(
        "INSERT INTO classes (university_id, name, teacher_id) VALUES (%s, %s, %s) RETURNING id, name, teacher_id, created_at",
        (university_id, name, teacher_id),
    )
    return dict(row)


@router.delete("/universities/{university_id}/classes/{class_id}", status_code=204)
async def delete_university_class(
    university_id: int,
    class_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    await db.execute("DELETE FROM classes WHERE id = %s AND university_id = %s", (class_id, university_id))


# ── Assignments inside a university ──────────────────────────────────────────

@router.get("/universities/{university_id}/assignments")
async def list_university_assignments(
    university_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    rows = await db.fetchall(
        "SELECT id, title, description_text, spec_status, class_id, created_by, created_at FROM assignments WHERE university_id = %s ORDER BY created_at DESC",
        (university_id,),
    )
    return [dict(r) for r in rows]


@router.post("/universities/{university_id}/assignments", status_code=201)
async def create_university_assignment(
    university_id: int,
    body: dict,
    background_tasks: BackgroundTasks,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    title = (body.get("title") or "").strip()
    description = (body.get("description_text") or "").strip()
    if not title or not description:
        raise HTTPException(400, "title and description_text are required")
    class_id = body.get("class_id")
    row = await db.execute_returning(
        """
        INSERT INTO assignments (university_id, title, description_text, class_id)
        VALUES (%s, %s, %s, %s)
        RETURNING id, title, description_text, spec_status, class_id, created_at
        """,
        (university_id, title, description, class_id),
    )
    background_tasks.add_task(_trigger_spec_generation, row["id"], description)
    return dict(row)


@router.delete("/universities/{university_id}/assignments/{assignment_id}", status_code=204)
async def delete_university_assignment(
    university_id: int,
    assignment_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    await db.execute("DELETE FROM assignments WHERE id = %s AND university_id = %s", (assignment_id, university_id))
