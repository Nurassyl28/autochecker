"""HTTP client for the v2 API — used by bot for assignment submission flow."""

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from .config import API_URL, BOT_TOKEN

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=30)
    return _client


@dataclass
class V2User:
    id: int
    tg_id: int
    email: str
    role: str
    full_name: str
    university_id: int


async def get_me(tg_id: int) -> Optional[V2User]:
    """Return v2 user data if the tg_id is linked, else None."""
    try:
        r = await get_client().get(f"{API_URL}/bot/me", params={"tg_id": tg_id})
        if r.status_code == 200:
            d = r.json()
            return V2User(
                id=d["id"],
                tg_id=d["tg_id"],
                email=d["email"],
                role=d.get("role", "student"),
                full_name=d.get("full_name", ""),
                university_id=d["university_id"],
            )
    except Exception as e:
        logger.warning("get_me(%s) failed: %s", tg_id, e)
    return None


async def register_tg(tg_id: int, email: str, full_name: str = "") -> dict:
    """Register or link tg_id to the v2 user with given email.
    Returns {"ok": True, "user_id": int} or raises on error.
    """
    r = await get_client().post(
        f"{API_URL}/bot/register",
        json={"tg_id": tg_id, "email": email, "full_name": full_name},
    )
    r.raise_for_status()
    return r.json()


async def list_assignments(tg_id: int) -> list[dict]:
    """Return [{id, title}] of available assignments for this student."""
    try:
        r = await get_client().get(f"{API_URL}/bot/assignments", params={"tg_id": tg_id})
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning("list_assignments(%s) failed: %s", tg_id, e)
    return []


async def submit_assignment(tg_id: int, assignment_id: int, repo_url: str) -> dict:
    """Create a submission for the given assignment. Returns submission dict."""
    r = await get_client().post(
        f"{API_URL}/bot/submit",
        json={"tg_id": tg_id, "assignment_id": assignment_id, "repo_url": repo_url},
    )
    r.raise_for_status()
    return r.json()


async def get_submission_status(submission_id: int, tg_id: int) -> Optional[dict]:
    """Poll submission status. Returns dict or None."""
    try:
        r = await get_client().get(
            f"{API_URL}/bot/status/{submission_id}",
            params={"tg_id": tg_id},
        )
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning("get_submission_status(%s) failed: %s", submission_id, e)
    return None
