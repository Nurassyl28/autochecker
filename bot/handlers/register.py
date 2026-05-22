"""Handler for student self-registration."""

import re
from typing import Any

from aiogram import Router, F
from aiogram.filters import CommandStart, BaseFilter
from aiogram.types import Message, CallbackQuery, TelegramObject
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from ..config import ALLOWED_EMAILS
from ..database import User, upsert_user, get_user_by_email
from ..keyboards import get_labs_keyboard
from .. import api_client

router = Router()

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", re.IGNORECASE)
GITHUB_REGEX = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$")


class NotRegistered(BaseFilter):
    async def __call__(self, event: TelegramObject, db_user: Any = None) -> bool:
        return db_user is None


class RegistrationStates(StatesGroup):
    waiting_for_email = State()
    waiting_for_github = State()


not_registered = NotRegistered()


@router.message(CommandStart(), not_registered)
async def cmd_start_unregistered(message: Message, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(RegistrationStates.waiting_for_email)
    await message.answer(
        "Welcome! Please send your university email to register:"
    )


@router.message(RegistrationStates.waiting_for_email)
async def process_email(message: Message, state: FSMContext) -> None:
    email = message.text.strip().lower() if message.text else ""

    if not EMAIL_REGEX.match(email):
        await message.answer("Invalid email format. Try again:")
        return

    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        await message.answer(
            "This email is not in the course roster.\n"
            "Use the email registered with your university.\n\nTry again:"
        )
        return

    existing = await get_user_by_email(email)
    if existing and existing.tg_id != message.from_user.id:
        await state.clear()
        await message.answer(
            "This email is already registered to another Telegram account.\n"
            "Send /start to try with a different email."
        )
        return

    await state.update_data(email=email)
    await state.set_state(RegistrationStates.waiting_for_github)
    await message.answer(
        f"Email: <code>{email}</code>\n\n"
        "Now send your GitHub username (e.g. <code>johndoe</code>):"
    )


@router.message(RegistrationStates.waiting_for_github)
async def process_github(message: Message, state: FSMContext) -> None:
    alias = message.text.strip().lstrip("@") if message.text else ""

    if not alias or not GITHUB_REGEX.match(alias):
        await message.answer(
            "Invalid GitHub username. Use only letters, digits, and hyphens.\n\nTry again:"
        )
        return

    data = await state.get_data()
    email = data["email"]
    tg_username = message.from_user.username or ""
    full_name = message.from_user.full_name or ""

    try:
        await upsert_user(
            tg_id=message.from_user.id,
            email=email,
            github_alias=alias,
            tg_username=tg_username,
            student_group=ALLOWED_EMAILS.get(email, ""),
        )
    except ValueError as e:
        await state.clear()
        await message.answer(f"{e}\n\nSend /start to try again.")
        return

    # Also link this tg_id to v2 API (fire-and-forget, non-blocking)
    try:
        await api_client.register_tg(
            tg_id=message.from_user.id,
            email=email,
            full_name=full_name,
        )
    except Exception:
        pass  # v2 link is best-effort; old lab flow still works via SQLite

    await state.clear()
    await message.answer(
        f"✅ Регистрация завершена!\n\n"
        f"Email: <code>{email}</code>\n"
        f"GitHub: <code>{alias}</code>\n\n"
        "📋 Нажмите <b>Задания</b> чтобы увидеть актуальные задания.",
        reply_markup=get_labs_keyboard(),
    )


@router.message(not_registered)
async def catch_unregistered(message: Message, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(RegistrationStates.waiting_for_email)
    await message.answer(
        "You are not registered yet.\n\nSend your university email to get started:"
    )
