"""Inline keyboards for Telegram bot."""

from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import InlineKeyboardMarkup


def bot_list_keyboard(bots: list[dict]) -> InlineKeyboardMarkup:
    """Build inline keyboard from bot list."""
    builder = InlineKeyboardBuilder()
    for bot in bots:
        name = bot.get("name", "?")
        bid = bot.get("id", "")
        health = bot.get("health_state", "unknown")
        icon = {"healthy": "🟢", "degraded": "🟡", "unreachable": "🔴"}.get(
            health.lower(), "⚪"
        )
        dry = "🧪" if bot.get("is_dryrun") else "💰"
        builder.button(text=f"{icon} {dry} {name}", callback_data=f"bot:{bid}")
    builder.adjust(1)
    return builder.as_markup()


def bot_detail_keyboard(bot_id: str) -> InlineKeyboardMarkup:
    """Bot detail inline actions."""
    builder = InlineKeyboardBuilder()
    builder.button(text="📊 Метрики", callback_data=f"metrics:{bot_id}")
    builder.button(text="🔧 Конфиг", callback_data=f"config:{bot_id}")
    builder.button(text="🔄 Перезагрузить", callback_data=f"reload:{bot_id}")
    builder.button(text="⏹ Стоп", callback_data=f"stop:{bot_id}")
    builder.button(text="▶️ Старт", callback_data=f"start:{bot_id}")
    builder.button(text="◀️ Назад", callback_data="bots:back")
    builder.adjust(2)
    return builder.as_markup()


def agent_keyboard() -> InlineKeyboardMarkup:
    """Agent control keyboard."""
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Включить агент", callback_data="agent:enable")
    builder.button(text="❌ Выключить агент", callback_data="agent:disable")
    builder.button(text="🔄 Обновить", callback_data="agent:refresh")
    builder.adjust(2)
    return builder.as_markup()


def confirm_keyboard(action: str, bot_id: str) -> InlineKeyboardMarkup:
    """Confirm/cancel inline keyboard."""
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Да", callback_data=f"confirm:{action}:{bot_id}")
    builder.button(text="❌ Нет", callback_data=f"cancel:{action}:{bot_id}")
    builder.adjust(2)
    return builder.as_markup()


def back_keyboard(callback_data: str = "bots:back") -> InlineKeyboardMarkup:
    """Simple back button."""
    builder = InlineKeyboardBuilder()
    builder.button(text="◀️ Назад", callback_data=callback_data)
    return builder.as_markup()
