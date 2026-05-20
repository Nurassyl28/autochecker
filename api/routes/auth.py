"""Auth endpoints: login."""

from fastapi import APIRouter, HTTPException, status

from .. import database as db
from ..auth import create_access_token, verify_password
from ..models import LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user = await db.fetchone(
        "SELECT id, university_id, email, password_hash, role FROM users WHERE email = %s",
        (body.email,),
    )
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user["id"], user["role"], user["university_id"])
    return LoginResponse(
        access_token=token,
        role=user["role"],
        user_id=user["id"],
        university_id=user["university_id"],
    )
