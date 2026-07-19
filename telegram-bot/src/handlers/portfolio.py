"""/status and /portfolio commands — general overview."""

from __future__ import annotations

import structlog

from aiogram import Router, types
from aiogram.filters import Command

from src.api_client import api
from src.formatters import (
    format_portfolio_summary,
    format_exchange_breakdown,
)

logger = structlog.get_logger()

router = Router(name="portfolio")


@router.message(Command("status"))
async def cmd_status(message: types.Message) -> None:
    """Общая сводка: портфель + кол-во ботов + агент."""
    await message.answer_chat_action("typing")
    try:
        summary = await api.portfolio_summary()
        agent_status = await api.agent_status()
        regime = await api.current_regime()
    except Exception as e:
        await message.answer(f"⛔ Ошибка подключения к API: {e}")
        return

    lines = []
    # Portfolio summary
    lines.append(format_portfolio_summary(summary))
    lines.append("")

    # Agent quick status
    enabled = agent_status.get("enabled", False)
    status_icon = "✅" if enabled else "❌"
    regime_name = regime.get("regime", "?")
    lines.append(
        f"🧠 <b>Агент:</b> {status_icon} {'Вкл' if enabled else 'Выкл'}  |  "
        f"Режим: {regime_name}"
    )

    await message.answer("\n".join(lines))


@router.message(Command("portfolio"))
async def cmd_portfolio(message: types.Message) -> None:
    """Полная портфельная сводка + разбивка по биржам."""
    await message.answer_chat_action("typing")
    try:
        summary = await api.portfolio_summary()
        by_exchange = await api.portfolio_by_exchange()
        by_strategy = await api.portfolio_by_strategy()
    except Exception as e:
        await message.answer(f"⛔ Ошибка: {e}")
        return

    parts = [format_portfolio_summary(summary), ""]

    if by_exchange:
        parts.append(format_exchange_breakdown(by_exchange))
        parts.append("")

    if by_strategy:
        parts.append("📊 <b>По стратегиям</b>")
        for s in by_strategy[:5]:
            name = s.get("strategy", "—")
            profit = s.get("profit_pct")
            profit_str = f"{profit:+.2f}%" if profit is not None else "—"
            bots = s.get("bot_count", 0)
            parts.append(f"  <b>{name}</b>: {profit_str} ({bots} бот)")
        if len(by_strategy) > 5:
            parts.append(f"  … и ещё {len(by_strategy) - 5}")

    await message.answer("\n".join(parts))
