"""Main entry point for the Telegram bot."""

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.types import BotCommand

from bot.config import BOT_TOKEN
from bot.database import init_db
from bot.middlewares import AuthMiddleware
from bot.handlers import register, start, labs, check, qwen_auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Initializing database...")
    await init_db()

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    dp.message.outer_middleware(AuthMiddleware())
    dp.callback_query.outer_middleware(AuthMiddleware())

    # Order matters: check FSM states first, catch-alls last
    dp.include_router(check.router)
    dp.include_router(qwen_auth.router)
    dp.include_router(register.router)
    dp.include_router(labs.router)
    dp.include_router(start.router)

    await bot.set_my_commands([
        BotCommand(command="start", description="Начать / показать меню"),
        BotCommand(command="assignments", description="Сдать задание (v2)"),
        BotCommand(command="reset", description="Сбросить настройки"),
    ])

    logger.info("Bot started.")
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped.")
    except Exception as e:
        logger.error("Bot crashed: %s", e)
        sys.exit(1)
