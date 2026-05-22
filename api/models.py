"""Pydantic request/response models."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    university_id: int


# ── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str = ""
    role: str  # admin | teacher | student

class UserResponse(BaseModel):
    id: int
    university_id: int
    email: str
    role: str
    full_name: str
    tg_id: Optional[int]
    created_at: datetime


# ── Assignments ───────────────────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    title: str
    description_text: str  # plain text; PDF is handled via multipart separately

class AssignmentResponse(BaseModel):
    id: int
    university_id: int
    title: str
    description_text: str
    spec_status: str
    llm_spec: Optional[Any]
    created_by: Optional[int]
    created_at: datetime


# ── Submissions ───────────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    assignment_id: int
    repo_url: str

class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    repo_url: str
    status: str
    pass_fail: Optional[str]
    score: Optional[float]
    feedback_json: Optional[Any]
    created_at: datetime
    completed_at: Optional[datetime]


# ── Chat ─────────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    body: str

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    body: str
    created_at: datetime
    read_at: Optional[datetime]


# ── Bot ──────────────────────────────────────────────────────────────────────

class BotSubmitRequest(BaseModel):
    tg_id: int
    assignment_id: int
    repo_url: str

class BotRegisterRequest(BaseModel):
    tg_id: int
    email: str
    full_name: str = ""
