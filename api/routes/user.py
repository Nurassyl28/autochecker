"""Current user profile — GET and PATCH /user/me."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import database as db
from ..dependencies import require_any

router = APIRouter(prefix="/user", tags=["user"])


class UpdateProfile(BaseModel):
    full_name: str


@router.get("/me")
async def get_me(user: dict = Depends(require_any)):
    row = await db.fetchone(
        "SELECT id, email, role, full_name, tg_id, university_id, created_at FROM users WHERE id = %s",
        (user["id"],),
    )
    return dict(row)


@router.patch("/me")
async def update_me(body: UpdateProfile, user: dict = Depends(require_any)):
    await db.execute(
        "UPDATE users SET full_name = %s WHERE id = %s",
        (body.full_name.strip(), user["id"]),
    )
    return {"ok": True, "full_name": body.full_name.strip()}
