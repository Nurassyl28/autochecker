"""Current user profile — GET and PATCH /user/me."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import database as db
from ..auth import hash_password, verify_password
from ..dependencies import require_any

router = APIRouter(prefix="/user", tags=["user"])


class UpdateProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None


@router.get("/me")
async def get_me(user: dict = Depends(require_any)):
    row = await db.fetchone(
        "SELECT id, email, role, full_name, tg_id, university_id, created_at FROM users WHERE id = %s",
        (user["id"],),
    )
    return dict(row)


@router.patch("/me")
async def update_me(body: UpdateProfile, user: dict = Depends(require_any)):
    updates: dict = {}

    if body.full_name is not None:
        updates["full_name"] = body.full_name.strip()

    if body.email is not None and body.email.strip():
        existing = await db.fetchone(
            "SELECT id FROM users WHERE email = %s AND id != %s",
            (body.email.strip(), user["id"]),
        )
        if existing:
            raise HTTPException(400, "Email уже используется другим пользователем")
        updates["email"] = body.email.strip().lower()

    if body.new_password:
        if not body.old_password:
            raise HTTPException(400, "Введите старый пароль")
        row = await db.fetchone("SELECT password_hash FROM users WHERE id = %s", (user["id"],))
        if not verify_password(body.old_password, row["password_hash"]):
            raise HTTPException(400, "Неверный старый пароль")
        updates["password_hash"] = hash_password(body.new_password)

    if not updates:
        return {"ok": True}

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    await db.execute(
        f"UPDATE users SET {set_clause} WHERE id = %s",
        (*updates.values(), user["id"]),
    )
    return {"ok": True, "email": updates.get("email")}
