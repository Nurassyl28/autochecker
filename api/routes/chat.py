"""1-1 chat between students and teachers (general, not per-assignment)."""

from fastapi import APIRouter, Depends, HTTPException

from .. import database as db
from ..dependencies import require_any
from ..models import MessageCreate, MessageResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations")
async def list_conversations(user: dict = Depends(require_any)):
    """Return the list of users this user has exchanged messages with, most recent first."""
    rows = await db.fetchall(
        """
        SELECT DISTINCT
            CASE WHEN sender_id = %s THEN receiver_id ELSE sender_id END AS other_id,
            MAX(created_at) AS last_message_at
        FROM chat_messages
        WHERE (sender_id = %s OR receiver_id = %s)
          AND university_id = %s
        GROUP BY other_id
        ORDER BY last_message_at DESC
        """,
        (user["id"], user["id"], user["id"], user["university_id"]),
    )

    # Attach basic user info for each conversation partner
    result = []
    for r in rows:
        partner = await db.fetchone(
            "SELECT id, email, full_name, role FROM users WHERE id = %s",
            (r["other_id"],),
        )
        if partner:
            result.append({"user": dict(partner), "last_message_at": r["last_message_at"]})
    return result


@router.get("/{other_user_id}", response_model=list[MessageResponse])
async def get_messages(
    other_user_id: int,
    limit: int = 50,
    before_id: int = None,
    user: dict = Depends(require_any),
):
    """Get message history between current user and other_user_id."""
    other = await db.fetchone(
        "SELECT id FROM users WHERE id = %s AND university_id = %s",
        (other_user_id, user["university_id"]),
    )
    if not other:
        raise HTTPException(404, "User not found")

    extra = ""
    params: list = [user["id"], other_user_id, user["id"], other_user_id, user["university_id"]]
    if before_id:
        extra = "AND id < %s"
        params.append(before_id)

    rows = await db.fetchall(
        f"""
        SELECT id, sender_id, receiver_id, body, created_at, read_at
        FROM chat_messages
        WHERE (
            (sender_id = %s AND receiver_id = %s) OR
            (sender_id = %s AND receiver_id = %s)
        )
        AND university_id = %s
        {extra}
        ORDER BY created_at DESC
        LIMIT %s
        """,
        tuple(params + [limit]),
    )
    # Mark received messages as read
    await db.execute(
        """
        UPDATE chat_messages SET read_at = NOW()
        WHERE receiver_id = %s AND sender_id = %s AND read_at IS NULL
        """,
        (user["id"], other_user_id),
    )
    return [MessageResponse(**r) for r in reversed(rows)]


@router.post("/{other_user_id}", response_model=MessageResponse, status_code=201)
async def send_message(
    other_user_id: int,
    body: MessageCreate,
    user: dict = Depends(require_any),
):
    other = await db.fetchone(
        "SELECT id FROM users WHERE id = %s AND university_id = %s",
        (other_user_id, user["university_id"]),
    )
    if not other:
        raise HTTPException(404, "User not found")
    if not body.body.strip():
        raise HTTPException(400, "Message body cannot be empty")

    row = await db.execute_returning(
        """
        INSERT INTO chat_messages (university_id, sender_id, receiver_id, body)
        VALUES (%s, %s, %s, %s)
        RETURNING id, sender_id, receiver_id, body, created_at, read_at
        """,
        (user["university_id"], user["id"], other_user_id, body.body.strip()),
    )
    return MessageResponse(**row)


@router.get("/{other_user_id}/unread-count")
async def unread_count(other_user_id: int, user: dict = Depends(require_any)):
    row = await db.fetchone(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE receiver_id = %s AND sender_id = %s AND read_at IS NULL",
        (user["id"], other_user_id),
    )
    return {"unread": row["count"] if row else 0}
