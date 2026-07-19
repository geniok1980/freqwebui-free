"""Agent command — status, enable/disable, regime."""

from __future__ import annotations

import structlog

from aiogram import Router, types, F
from aiogram.filters import Command

from src.api_client import api
from src.keyboards import agent_keyboard
from src.formatters import format_agent_status, format_trades

logger = structlog.get_logger()

router = Router(name="agent")


@router.message(Command("agent"))
async def cmd_agent(message: types.Message) -> None:
    """Show agent status."""
    await message.answer_chat_action("typing")
    await _show_agent(message)


async def _show_agent(dest: types.Message | types.CallbackQuery) -> None:
    """Show/refresh agent card."""
    try:
        status = await api.agent_status()
        regime = await api.current_regime()
        trades = await api.agent_trades(limit=5)
    except Exception as e:
        text = f"⛔ Ошибка: {e}"
        if isinstance(dest, types.Message):
            await dest.answer(text)
        else:
            await dest.message.answer(text)
        return

    parts = [format_agent_status(status, regime), ""]
    if trades:
        parts.append(format_trades(trades))

    text = "\n".join(parts)

    if isinstance(dest, types.Message):
        await dest.answer(text, reply_markup=agent_keyboard())
    else:
        await dest.message.edit_text(text, reply_markup=agent_keyboard())


@router.callback_query(F.data == "agent:refresh")
async def cb_agent_refresh(callback: types.CallbackQuery) -> None:
    """Refresh agent card."""
    await callback.answer()
    await _show_agent(callback)


@router.callback_query(F.data == "agent:enable")
async def cb_agent_enable(callback: types.CallbackQuery) -> None:
    """Enable agent."""
    await callback.answer()
    await callback.message.answer_chat_action("typing")
    try:
        result = await api.agent_enable()
        await callback.message.answer(
            f"✅ Агент включён. Контейнер: {result.get('container', '—')}"
        )
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка включения: {e}")
    # Refresh the card
    try:
        await _show_agent(callback)
    except Exception:
        pass


@router.callback_query(F.data == "agent:disable")
async def cb_agent_disable(callback: types.CallbackQuery) -> None:
    """Disable agent."""
    await callback.answer()
    await callback.message.answer_chat_action("typing")
    try:
        result = await api.agent_disable()
        await callback.message.answer(
            f"❌ Агент выключен. Контейнер: {result.get('container', '—')}"
        )
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка выключения: {e}")
    try:
        await _show_agent(callback)
    except Exception:
        pass
