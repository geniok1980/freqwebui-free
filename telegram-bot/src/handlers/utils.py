"""Utility commands: risk, scoring, comparison."""

from __future__ import annotations

import structlog

from aiogram import Router, types
from aiogram.filters import Command

from src.api_client import api
from src.formatters import format_risk, format_scoring, format_comparison

logger = structlog.get_logger()

router = Router(name="utils")


@router.message(Command("risk"))
async def cmd_risk(message: types.Message) -> None:
    """Risk dashboard."""
    await message.answer_chat_action("typing")
    try:
        data = await api.risk()
    except Exception as e:
        await message.answer(f"⛔ Ошибка: {e}")
        return

    text = format_risk(data)
    await message.answer(text)


@router.message(Command("scoring"))
async def cmd_scoring(message: types.Message) -> None:
    """Scoring dashboard."""
    await message.answer_chat_action("typing")
    try:
        data = await api.scoring()
    except Exception as e:
        await message.answer(f"⛔ Ошибка: {e}")
        return

    text = format_scoring(data)
    await message.answer(text)


@router.message(Command("comparison"))
async def cmd_comparison(message: types.Message) -> None:
    """Backtest ↔ Dry ↔ Live comparison."""
    await message.answer_chat_action("typing")
    try:
        data = await api.comparison()
    except Exception as e:
        await message.answer(f"⛔ Ошибка: {e}")
        return

    text = format_comparison(data)
    await message.answer(text)
