"""Handler for lab selection, VM IP change, and v2 assignment submissions."""

import re

from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from ..database import User, get_server_ip, get_server_ip_owner, set_server_ip
from ..ip_utils import validate_ip
from ..keyboards import get_labs_keyboard, get_tasks_keyboard
from .. import api_client

router = Router()


class ChangeIPStates(StatesGroup):
    waiting_for_new_ip = State()
    waiting_for_repo_url = State()


REPO_URL_RE = re.compile(r"^https?://(www\.)?(github\.com|gitlab\.com)/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$")


@router.callback_query(F.data == "assignments:list")
async def callback_assignments_list(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    """Show v2 API assignments from inline button."""
    await callback.answer()
    await state.clear()
    items = await api_client.list_assignments(db_user.tg_id)
    if not items:
        await callback.message.answer(
            "Нет доступных заданий.\n"
            "Попросите преподавателя добавить задания через веб-панель."
        )
        return
    buttons = []
    for item in items[:20]:
        title = str(item.get("title", "")).strip()
        asgn_id = str(item.get("id", ""))
        buttons.append([InlineKeyboardButton(text=title[:60], callback_data=f"asgn:{asgn_id}")])
    await callback.message.answer(
        "Выберите задание для сдачи:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("lab:"))
async def callback_select_lab(callback: CallbackQuery, db_user: User) -> None:
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
    """Show available v2 assignments via API."""
    await state.clear()
    items = await api_client.list_assignments(db_user.tg_id)
    if not items:
        await message.answer(
            "Нет доступных заданий.\n"
            "Попросите администратора добавить задания через веб-панель."
        )
        return
    buttons = []
    for item in items[:20]:
        title = str(item.get("title", "")).strip()
        asgn_id = str(item.get("id", ""))
        buttons.append([InlineKeyboardButton(text=title[:60], callback_data=f"asgn:{asgn_id}")])
    await message.answer(
        "Выберите задание для сдачи:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("asgn:"))
async def callback_assignment_pick(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    assignment_id = callback.data.split(":", 1)[1].strip()
    await callback.answer()
    await state.set_state(ChangeIPStates.waiting_for_repo_url)
    await state.update_data(assignment_id=assignment_id)
    await callback.message.answer(
        f"Задание ID: <code>{assignment_id}</code>\n"
        "Отправьте ссылку на ваш репозиторий (GitHub):\n"
        "<code>https://github.com/username/repo</code>"
    )


@router.message(ChangeIPStates.waiting_for_repo_url)
async def process_assignment_repo_url(message: Message, db_user: User, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer("Отменено.", reply_markup=get_labs_keyboard(server_ip=server_ip))
        return
    if not REPO_URL_RE.match(text):
        await message.answer(
            "Неверная ссылка. Формат:\n<code>https://github.com/user/repo</code>"
        )
        return

    data = await state.get_data()
    assignment_id_str = str(data.get("assignment_id", "")).strip()
    if not assignment_id_str.isdigit():
        await state.clear()
        await message.answer("Ошибка: не удалось определить задание. Запустите /assignments ещё раз.")
        return

    await state.clear()
    await message.answer("⏳ Сдача принята, проверяю репозиторий...")

    try:
        result = await api_client.submit_assignment(
            tg_id=db_user.tg_id,
            assignment_id=int(assignment_id_str),
            repo_url=text,
        )
        sub_id = result.get("id", "?")
        await message.answer(
            f"✅ Submission #{sub_id} поставлена в очередь.\n"
            "Результат придёт сюда автоматически после проверки."
        )
    except Exception as e:
        err = str(e)
        if "404" in err:
            await message.answer("❌ Задание не найдено или не готово. Попробуйте /assignments ещё раз.")
        elif "409" in err:
            await message.answer("❌ Задание ещё не готово (spec генерируется). Попробуйте чуть позже.")
        else:
            await message.answer(f"❌ Ошибка сдачи: {err[:200]}")


@router.callback_query(F.data == "change_ip")
async def callback_change_ip(callback: CallbackQuery, db_user: User, state: FSMContext) -> None:
    current_ip = await get_server_ip(db_user.tg_id)
    profile = "\n".join([
        "<b>Your profile:</b>",
        f"  GitHub: <code>{db_user.github_alias}</code>",
        f"  Email: <code>{db_user.email}</code>",
        f"  VM IP: <code>{current_ip}</code>" if current_ip else "  VM IP: not set",
    ])
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
    text = message.text.strip() if message.text else ""
    if text.startswith("/"):
        await state.clear()
        server_ip = await get_server_ip(db_user.tg_id)
        await message.answer("Cancelled.", reply_markup=get_labs_keyboard(server_ip=server_ip))
        return

    valid, error_msg = validate_ip(text)
    if not valid:
        await message.answer(error_msg)
        return

    existing_owner = await get_server_ip_owner(text, db_user.tg_id)
    if existing_owner:
        await message.answer("This IP is already registered to another student.")
        return

    await set_server_ip(db_user.tg_id, text)
    await state.clear()
    await message.answer(
        f"VM IP updated to <code>{text}</code>\n\nChoose a lab:",
        reply_markup=get_labs_keyboard(server_ip=text),
    )
