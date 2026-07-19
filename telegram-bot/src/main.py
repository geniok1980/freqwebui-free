"""Telegram bot entry point — hot-reloads settings from Freqdash API."""

from __future__ import annotations

import asyncio
import structlog

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from src.config import env, BotSettings
from src.api_client import api
from src.middlewares import AllowedUsersMiddleware
from src.handlers import start, portfolio, bots, agent, management, utils

logger = structlog.get_logger()

POLL_INTERVAL = 30  # seconds between settings checks


async def fetch_bot_settings() -> BotSettings:
    """Fetch Telegram settings from Freqdash API."""
    raw = await api.get("/settings")
    settings_data = raw.get("settings", raw)
    return BotSettings.from_api_settings(settings_data)


def _validate_token(token: str) -> bool:
    """Basic telegram token format check (bot_api:hash)."""
    if not token:
        return False
    parts = token.split(":")
    return len(parts) == 2 and parts[0].isdigit() and len(parts[1]) > 20


async def settings_watcher(
    dp: Dispatcher,
    allowed_middleware: AllowedUsersMiddleware,
    token_holder: list[str],
    poll_interval: int = POLL_INTERVAL,
) -> None:
    """Background task: poll /settings, update allowed_ids on the fly.

    When the bot token changes, calls ``dp.stop()`` to exit the polling
    loop cleanly so ``main()`` can restart with the new token.
    """
    while True:
        await asyncio.sleep(poll_interval)
        try:
            cfg = await fetch_bot_settings()
        except Exception as e:
            logger.warning("settings poll failed", error=str(e))
            continue

        # 1. Allowed users — apply immediately
        new_ids: set[int] = set(cfg.allowed_user_ids)
        if new_ids != allowed_middleware.allowed_ids:
            old_count = len(allowed_middleware.allowed_ids)
            allowed_middleware.allowed_ids = new_ids
            logger.info(
                "allowed users updated live",
                old=old_count,
                new=len(new_ids),
            )

        # 2. Token changed — signal main loop to restart
        if cfg.bot_token and token_holder and cfg.bot_token != token_holder[0]:
            logger.info("telegram bot token changed, restarting polling")
            token_holder[0] = cfg.bot_token
            dp.stop()
            return  # watcher done


async def main() -> None:
    """Start the bot with dynamic settings reload."""
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # 1. Authenticate to API
    logger.info("starting telegram bot", api_url=env.freqdash_api_url)
    try:
        await api.login()
        logger.info("authenticated to freqdash api")
    except Exception as e:
        logger.critical("cannot authenticate to freqdash api", error=str(e))
        await asyncio.Future()  # sleep forever

    # 2. Create dispatcher + middleware once
    allowed_mid = AllowedUsersMiddleware()

    dp = Dispatcher()
    dp.include_routers(
        start.router,
        portfolio.router,
        bots.router,
        agent.router,
        management.router,
        utils.router,
    )
    dp.message.middleware(allowed_mid)
    dp.callback_query.middleware(allowed_mid)

    # Mutable holder — watcher updates token_holder[0] on change
    token_holder: list[str] = [""]

    while True:
        # 3. Fetch current settings
        try:
            cfg = await fetch_bot_settings()
        except Exception as e:
            logger.critical("cannot fetch bot settings, retry in 60s", error=str(e))
            await asyncio.sleep(60)
            continue

        if not cfg.bot_token or not _validate_token(cfg.bot_token):
            logger.critical(
                "telegram_bot_token is empty or invalid in Freqdash Settings. "
                "Go to web UI → Settings → Telegram Bot and set it."
            )
            await asyncio.sleep(30)
            continue

        # 4. Apply settings
        allowed_mid.allowed_ids = set(cfg.allowed_user_ids)
        token_holder[0] = cfg.bot_token

        logger.info(
            "starting polling",
            token_valid=True,
            allowed_users=len(allowed_mid.allowed_ids),
        )

        # 5. Create bot and start polling
        bot = Bot(
            token=cfg.bot_token,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )

        # Watcher task — raises TokenChanged when settings change
        watcher = asyncio.create_task(
            settings_watcher(dp, allowed_mid, token_holder)
        )

        try:
            await dp.start_polling(bot)
        except Exception:
            logger.info("polling stopped (may be token change)")
        finally:
            watcher.cancel()
            try:
                await watcher
            except asyncio.CancelledError:
                pass
            await bot.session.close()

        # Loop back with new token/whitelist


if __name__ == "__main__":
    asyncio.run(main())
