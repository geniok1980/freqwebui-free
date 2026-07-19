"""/bots command — list all bots with inline keyboards."""

from __future__ import annotations

import structlog

from aiogram import Router, types, F
from aiogram.filters import Command

from src.api_client import api
from src.keyboards import bot_list_keyboard, bot_detail_keyboard
from src.formatters import format_bot_short, format_bot_detail

logger = structlog.get_logger()

router = Router(name="bots")


@router.message(Command("bots"))
async def cmd_bots(message: types.Message) -> None:
    """List all bots."""
    await message.answer_chat_action("typing")
    try:
        bots = await api.list_bots()
    except Exception as e:
        await message.answer(f"⛔ Ошибка загрузки ботов: {e}")
        return

    if not bots:
        await message.answer("🤖 Боты не найдены.")
        return

    header = f"🤖 <b>Боты ({len(bots)})</b>\n\n"
    lines = [format_bot_short(b) for b in bots]
    await message.answer(
        header + "\n".join(lines),
        reply_markup=bot_list_keyboard(bots),
    )


@router.callback_query(F.data.startswith("bot:"))
async def cb_bot_detail(callback: types.CallbackQuery) -> None:
    """Show bot detail."""
    bot_id = callback.data.replace("bot:", "")
    await callback.answer()
    await callback.message.answer_chat_action("typing")

    try:
        bot = await api.get_bot(bot_id)
        metrics = await api.get_bot_metrics(bot_id)
        health = await api.get_bot_health(bot_id)
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка: {e}")
        return

    text = format_bot_detail(bot, metrics, health)
    await callback.message.answer(text, reply_markup=bot_detail_keyboard(bot_id))


@router.callback_query(F.data == "bots:back")
async def cb_bots_back(callback: types.CallbackQuery) -> None:
    """Back to bot list."""
    await callback.answer()
    try:
        bots = await api.list_bots()
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка: {e}")
        return

    header = f"🤖 <b>Боты ({len(bots)})</b>\n\n"
    lines = [format_bot_short(b) for b in bots]
    await callback.message.edit_text(
        header + "\n".join(lines),
        reply_markup=bot_list_keyboard(bots),
    )
