"""/start and /help commands."""

import structlog

from aiogram import Router, types
from aiogram.filters import Command

logger = structlog.get_logger()

router = Router(name="start")


@router.message(Command("start"))
async def cmd_start(message: types.Message) -> None:
    """Welcome message."""
    await message.answer(
        "🤖 <b>Freqdash Telegram Bot</b>\n\n"
        "Мониторинг и управление торговыми ботами.\n\n"
        "📋 <b>Команды:</b>\n"
        "/status — общая сводка\n"
        "/portfolio — портфель\n"
        "/bots — список ботов\n"
        "/agent — статус агента\n"
        "/risk — риски\n"
        "/scoring — скоринг\n"
        "/comparison — сравнение\n"
        "/help — эта справка"
    )


@router.message(Command("help"))
async def cmd_help(message: types.Message) -> None:
    """Help text."""
    await message.answer(
        "🤖 <b>Freqdash Telegram Bot</b>\n\n"
        "<b>Команды:</b>\n"
        "/start — приветствие\n"
        "/status — общая сводка (боты, портфель, агент)\n"
        "/portfolio — портфельная сводка\n"
        "/bots — список всех ботов (нажми для деталей)\n"
        "/agent — статус Dashboard Agent, вкл/выкл\n"
        "/risk — риски 4 уровня\n"
        "/scoring — оценка стратегий\n"
        "/comparison — Backtest ↔ Dry-Run ↔ Live\n\n"
        "<b>Inline-кнопки:</b>\n"
        "После /bots нажми на бота — увидишь метрики, конфиг, управление."
    )
