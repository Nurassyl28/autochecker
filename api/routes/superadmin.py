"""Super-admin routes: platform-level management of universities and their admins."""

import os
import logging

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from .. import database as db
from ..auth import hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/superadmin", tags=["superadmin"])

SUPERADMIN_KEY = os.environ.get("SUPERADMIN_KEY", "")


def _check_key(key: str):
    if not SUPERADMIN_KEY:
        raise HTTPException(503, "Super-admin not configured (set SUPERADMIN_KEY env var)")
    if key != SUPERADMIN_KEY:
        raise HTTPException(401, "Invalid super-admin key")


class UniversityCreate(BaseModel):
    name: str
    slug: str
    admin_email: str
    admin_password: str
    admin_full_name: Optional[str] = None


@router.post("/auth")
async def superadmin_auth(body: dict):
    """Verify super-admin key. Returns ok=true if valid."""
    _check_key(body.get("key", ""))
    return {"ok": True}


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
    body.name = body.name.strip()
    body.slug = body.slug.strip().lower()
    if not body.name or not body.slug:
        raise HTTPException(400, "name and slug are required")

    existing = await db.fetchone("SELECT id FROM universities WHERE slug = %s", (body.slug,))
    if existing:
        raise HTTPException(409, "University with this slug already exists")

    uni = await db.execute_returning(
        "INSERT INTO universities (name, slug) VALUES (%s, %s) RETURNING id, name, slug, created_at",
        (body.name, body.slug),
    )
    # Create admin user for this university
    email_exists = await db.fetchone(
        "SELECT id FROM users WHERE university_id = %s AND email = %s",
        (uni["id"], body.admin_email),
    )
    if email_exists:
        raise HTTPException(409, "Admin email already registered")

    await db.execute(
        """
        INSERT INTO users (university_id, email, password_hash, role, full_name)
        VALUES (%s, %s, %s, 'admin', %s)
        """,
        (uni["id"], body.admin_email, hash_password(body.admin_password), body.admin_full_name or ""),
    )
    logger.info("Created university %s (id=%s) with admin %s", body.name, uni["id"], body.admin_email)
    return {"university": dict(uni), "admin_email": body.admin_email}


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


@router.delete("/universities/{university_id}", status_code=204)
async def delete_university(
    university_id: int,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    await db.execute("DELETE FROM universities WHERE id = %s", (university_id,))


@router.post("/universities/{university_id}/admins", status_code=201)
async def create_university_admin(
    university_id: int,
    body: dict,
    x_superadmin_key: str = Header(..., alias="X-Superadmin-Key"),
):
    _check_key(x_superadmin_key)
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    full_name = (body.get("full_name") or "").strip()
    if not email or not password:
        raise HTTPException(400, "email and password are required")
    uni = await db.fetchone("SELECT id FROM universities WHERE id = %s", (university_id,))
    if not uni:
        raise HTTPException(404, "University not found")
    existing = await db.fetchone(
        "SELECT id FROM users WHERE university_id = %s AND email = %s", (university_id, email)
    )
    if existing:
        raise HTTPException(409, "Email already registered in this university")
    row = await db.execute_returning(
        "INSERT INTO users (university_id, email, password_hash, role, full_name) VALUES (%s, %s, %s, 'admin', %s) RETURNING id, email, role",
        (university_id, email, hash_password(password), full_name),
    )
    return dict(row)
