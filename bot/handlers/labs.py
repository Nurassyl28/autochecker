"""Handler for lab selection and VM IP change callbacks."""

import re

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from ..database import User, get_server_ip, get_server_ip_owner, set_server_ip, get_active_assignments, create_assignment_submission
from ..ip_utils import validate_ip
from ..keyboards import get_labs_keyboard, get_tasks_keyboard

router = Router()


class ChangeIPStates(StatesGroup):
    waiting_for_new_ip = State()
    waiting_for_repo_url = State()


REPO_URL_RE = re.compile(r"^https?://(www\.)?(github\.com|gitlab\.com)/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$")


@router.callback_query(F.data.startswith("lab:"))
async def callback_select_lab(callback: CallbackQuery, db_user: User) -> None:
    """Show tasks for the selected lab."""
    lab_id = callback.data.split(":", 1)[1]
    await callback.answer()
    try:
        await callback.message.edit_text(
            "Choose a task to check:",
            reply_markup=await get_tasks_keyboard(db_user.tg_id, lab_id),
        )
    except TelegramBadRequest:
        pass


@router.callback_query(F.data == "back_to_labs")
async def callback_back_to_labs(callback: CallbackQuery, db_user: User) -> None:
    """Return to the lab selection menu."""
    await callback.answer()
    try:
        server_ip = await get_server_ip(db_user.tg_id)
        await callback.message.edit_text(
            "Choose a lab:",
            reply_markup=get_labs_keyboard(server_ip=server_ip),
        )
    except TelegramBadRequest:
        pass


@router.message(Command("assignments"))
async def cmd_assignments(message: Message, db_user: User, state: FSMContext) -> None:
    """Show tenant assignment list for direct submission flow."""
    await state.clear()
    items = await get_active_assignments(db_user.tenant_id)
    if not items:
        await message.answer(
            "Пока нет активных заданий для вашего университета.\n"
            "Попросите администратора добавить задания."
        )
        return
    lines = ["Выберите задание для сдачи:"]
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
    buttons = []
    for item in items[:20]:
        code = str(item.get("code", "")).strip()
        title = str(item.get("title", code)).strip()
        lines.append(f"- {title} (<code>{code}</code>)")
        buttons.append([InlineKeyboardButton(text=title[:60], callback_data=f"asgn:{code}")])
    await message.answer("\n".join(lines), reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons))


@router.callback_query(F.data.startswith("asgn:"))
async def callback_assignment_pick(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    """Start assignment submission by asking repo URL."""
    code = callback.data.split(":", 1)[1].strip().lower()
    await callback.answer()
    await state.set_state(ChangeIPStates.waiting_for_repo_url)
    await state.update_data(assignment_code=code)
    await callback.message.answer(
        f"Вы выбрали задание <code>{code}</code>.\n"
        "Отправьте ссылку на репозиторий (GitHub/GitLab)."
    )


@router.message(ChangeIPStates.waiting_for_repo_url)
async def process_assignment_repo_url(message: Message, db_user: User, state: FSMContext) -> None:
    """Validate repo URL and create queued assignment submission."""
    text = (message.text or "").strip()
    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer("Отменено.\n\nВыберите лабу:", reply_markup=get_labs_keyboard(server_ip=server_ip))
        return
    if not REPO_URL_RE.match(text):
        await message.answer(
            "Неверная ссылка.\n"
            "Отправьте URL в формате:\n"
            "<code>https://github.com/user/repo</code>"
        )
        return
    data = await state.get_data()
    code = str(data.get("assignment_code", "")).strip().lower()
    if not code:
        await state.clear()
        await message.answer("Не удалось определить задание. Запустите /assignments ещё раз.")
        return

    submission_id = await create_assignment_submission(
        tg_id=db_user.tg_id,
        tenant_id=db_user.tenant_id,
        assignment_code=code,
        repo_url=text,
        source="telegram",
    )
    await state.clear()
    await message.answer(
        f"Сдача принята.\n"
        f"Submission ID: <code>{submission_id}</code>\n"
        f"Задание: <code>{code}</code>\n"
        "Проверка будет выполнена асинхронно, результат придёт позже."
    )


@router.callback_query(F.data == "change_ip")
async def callback_change_ip(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    """Show student profile and prompt for new VM IP."""
    current_ip = await get_server_ip(db_user.tg_id)

    # Build profile info
    profile_lines = [
        "<b>Your profile:</b>",
        f"  GitHub: <code>{db_user.github_alias}</code>",
        f"  Email: <code>{db_user.email}</code>",
        f"  VM IP: <code>{current_ip}</code>" if current_ip else "  VM IP: not set",
    ]
    profile = "\n".join(profile_lines)

    if current_ip:
        prompt = (
            f"{profile}\n\n"
            "Send the new IP address (e.g., <code>10.93.25.100</code>),\n"
            "or /start to cancel:"
        )
    else:
        prompt = (
            f"{profile}\n\n"
            "Send your VM IP address (e.g., <code>10.93.25.100</code>),\n"
            "or /start to cancel:"
        )
    await callback.answer()
    await callback.message.edit_text(prompt)
    await state.set_state(ChangeIPStates.waiting_for_new_ip)


@router.message(ChangeIPStates.waiting_for_new_ip)
async def process_change_ip(message: Message, db_user: User, state: FSMContext) -> None:
    """Validate and save the new VM IP, then return to labs menu."""
    text = message.text.strip() if message.text else ""

    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer(
            "Cancelled.\n\nChoose a lab:",
            reply_markup=get_labs_keyboard(server_ip=server_ip),
        )
        return

    valid, error_msg = validate_ip(text)
    if not valid:
        await message.answer(error_msg)
        return

    existing_owner = await get_server_ip_owner(text, db_user.tg_id)
    if existing_owner:
        await message.answer(
            "This IP is already registered to another student.\n"
            "Each student must use their own VM. Please enter your unique VM IP:"
        )
        return

    await set_server_ip(db_user.tg_id, text)
    await state.clear()

    await message.answer(
        f"VM IP updated to <code>{text}</code>\n\nChoose a lab:",
        reply_markup=get_labs_keyboard(server_ip=text),
    )
