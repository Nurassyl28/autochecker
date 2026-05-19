"""Main entry point for the Telegram bot."""

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.types import BotCommand

from bot.config import BOT_TOKEN
from bot.database import (
    init_db,
    fetch_queued_submissions,
    update_submission_status,
    get_user,
    get_server_ip,
    get_vm_username,
    get_lms_api_key,
)
from bot.middlewares import AuthMiddleware
from bot.handlers import register, start, labs, check, qwen_auth
from bot.runner import run_check

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger(__name__)


async def _submission_worker_loop(bot: Bot) -> None:
    """Background worker: process queued assignment submissions."""
    logger.info("Submission worker started")
    while True:
        try:
            queued = await fetch_queued_submissions(limit=5)
            for sub in queued:
                sub_id = int(sub["id"])
                tenant_id = str(sub.get("tenant_id", "default"))
                tg_id = int(sub["tg_id"])
                assignment_code = str(sub.get("assignment_code", "")).strip()
                await update_submission_status(sub_id, "running", tenant_id=tenant_id)

                user = await get_user(tg_id)
                if not user:
                    await update_submission_status(
                        sub_id,
                        "failed",
                        error_message="User not found",
                        tenant_id=tenant_id,
                    )
                    continue

                server_ip = await get_server_ip(tg_id)
                vm_username = await get_vm_username(tg_id)
                lms_api_key = await get_lms_api_key(tg_id)
                result = await run_check(
                    user.github_alias,
                    assignment_code,  # assignment code is treated as lab_id in current runtime
                    None,
                    server_ip=server_ip or None,
                    lms_api_key=lms_api_key or None,
                    vm_username=vm_username or None,
                )
                if result.error_message:
                    await update_submission_status(
                        sub_id,
                        "failed",
                        error_message=result.error_message[:500],
                        tenant_id=tenant_id,
                    )
                    await bot.send_message(
                        tg_id,
                        f"Проверка submission <code>{sub_id}</code> завершилась ошибкой:\n{result.error_message[:700]}",
                    )
                    continue

                score = result.score or "n/a"
                await update_submission_status(
                    sub_id,
                    "done",
                    result_text=score,
                    tenant_id=tenant_id,
                )
                await bot.send_message(
                    tg_id,
                    f"Проверка submission <code>{sub_id}</code> завершена.\nРезультат: <b>{score}</b>",
                )
        except Exception as exc:
            logger.exception("Submission worker iteration failed: %s", exc)
        await asyncio.sleep(5)


async def main() -> None:
    """Initialize and run the bot."""
    # Initialize database
    logger.info("Initializing database...")
    await init_db()

    # Initialize bot and dispatcher
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    dp = Dispatcher()

    # Register middleware (outer so db_user is available during filter evaluation)
    dp.message.outer_middleware(AuthMiddleware())
    dp.callback_query.outer_middleware(AuthMiddleware())

    # Register routers — order matters:
    # check.router first so FSM states (e.g., waiting_for_server_ip) are
    # handled before the catch-all in start.router.
    # register.router handles unregistered users (FSM states),
    # start.router catches /start and unrecognized messages last.
    dp.include_router(check.router)
    dp.include_router(qwen_auth.router)
    dp.include_router(register.router)
    dp.include_router(labs.router)
    dp.include_router(start.router)

    # Set bot command menu
    await bot.set_my_commands([
        BotCommand(command="start", description="Check your labs"),
        BotCommand(command="reset", description="View and reset stored settings"),
    ])

    # Start polling
    logger.info("Starting bot...")
    worker_task = asyncio.create_task(_submission_worker_loop(bot))
    try:
        await dp.start_polling(bot)
    finally:
        worker_task.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot crashed: {e}")
        sys.exit(1)
