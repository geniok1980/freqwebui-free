"""Bot management: reload, stop, start with confirmation."""

from __future__ import annotations

import structlog

from aiogram import Router, types, F

from src.api_client import api
from src.keyboards import confirm_keyboard, back_keyboard
from src.formatters import format_bot_short

logger = structlog.get_logger()

router = Router(name="management")


async def _get_bot_name(bot_id: str) -> str:
    """Fetch bot name by id."""
    try:
        bot = await api.get_bot(bot_id)
        return bot.get("name", bot_id)
    except Exception:
        return bot_id


@router.callback_query(F.data.startswith("reload:"))
async def cb_reload(callback: types.CallbackQuery) -> None:
    """Confirm reload."""
    bot_id = callback.data.replace("reload:", "")
    name = await _get_bot_name(bot_id)
    await callback.answer()
    await callback.message.answer(
        f"🔄 Перезагрузить <b>{name}</b>?",
        reply_markup=confirm_keyboard("reload", bot_id),
    )


@router.callback_query(F.data.startswith("stop:"))
async def cb_stop(callback: types.CallbackQuery) -> None:
    """Confirm stop."""
    bot_id = callback.data.replace("stop:", "")
    name = await _get_bot_name(bot_id)
    await callback.answer()
    await callback.message.answer(
        f"⏹ Остановить <b>{name}</b>?",
        reply_markup=confirm_keyboard("stop", bot_id),
    )


@router.callback_query(F.data.startswith("start:"))
async def cb_start(callback: types.CallbackQuery) -> None:
    """Confirm start."""
    bot_id = callback.data.replace("start:", "")
    name = await _get_bot_name(bot_id)
    await callback.answer()
    await callback.message.answer(
        f"▶️ Запустить <b>{name}</b>?",
        reply_markup=confirm_keyboard("start", bot_id),
    )


@router.callback_query(F.data.startswith("confirm:"))
async def cb_confirm(callback: types.CallbackQuery) -> None:
    """Execute confirmed action."""
    parts = callback.data.split(":")
    if len(parts) < 3:
        await callback.answer("Неверный запрос")
        return
    action, bot_id = parts[1], parts[2]
    await callback.answer()

    name = await _get_bot_name(bot_id)
    await callback.message.answer_chat_action("typing")

    actions = {
        "reload": ("🔄 Перезагрузка", api.reload_bot),
        "stop": ("⏹ Остановка", api.stop_bot),
        "start": ("▶️ Запуск", api.start_bot),
    }

    if action not in actions:
        await callback.message.answer("⛔ Неизвестное действие")
        return

    label, method = actions[action]
    try:
        result = await method(bot_id)
        status = result.get("status", "success")
        msg = result.get("message", result.get("detail", ""))
        await callback.message.answer(f"{label} <b>{name}</b> — {status}\n{msg}")
    except Exception as e:
        await callback.message.answer(f"⛔ {label} не удалась: {e}")


@router.callback_query(F.data.startswith("cancel:"))
async def cb_cancel(callback: types.CallbackQuery) -> None:
    """Cancel action."""
    await callback.answer("Отменено")
    await callback.message.delete()


@router.callback_query(F.data.startswith("metrics:"))
async def cb_metrics(callback: types.CallbackQuery) -> None:
    """Show raw metrics."""
    bot_id = callback.data.replace("metrics:", "")
    await callback.answer()
    await callback.message.answer_chat_action("typing")
    try:
        metrics = await api.get_bot_metrics(bot_id)
        bot = await api.get_bot(bot_id)
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка: {e}")
        return

    name = bot.get("name", bot_id)
    if not metrics:
        await callback.message.answer(f"📊 <b>{name}</b>\nНет данных метрик")
        return

    lines = [f"📊 <b>{name}</b>"]
    for k, v in metrics.items():
        if isinstance(v, float):
            lines.append(f"  {k}: {v:.4f}")
        elif v is not None:
            lines.append(f"  {k}: {v}")
    await callback.message.answer(
        "\n".join(lines), reply_markup=back_keyboard(f"bot:{bot_id}")
    )


@router.callback_query(F.data.startswith("config:"))
async def cb_config(callback: types.CallbackQuery) -> None:
    """Show bot config (condensed)."""
    bot_id = callback.data.replace("config:", "")
    await callback.answer()
    await callback.message.answer_chat_action("typing")
    try:
        data = await api.get_bot_config(bot_id)
        config = data.get("config", data)
        bot = await api.get_bot(bot_id)
    except Exception as e:
        await callback.message.answer(f"⛔ Ошибка: {e}")
        return

    name = bot.get("name", bot_id)
    lines = [f"🔧 <b>{name} — config</b>"]

    if isinstance(config, dict):
        keys_show = [
            "strategy", "timeframe", "stake_amount", "stake_currency",
            "max_open_trades", "dry_run", "trading_mode", "exchange.name",
        ]
        for key in keys_show:
            if "." in key:
                parts_k = key.split(".")
                val = config
                for p in parts_k:
                    if isinstance(val, dict):
                        val = val.get(p)
                if val is not None:
                    lines.append(f"  {key}: {val}")
            else:
                val = config.get(key)
                if val is not None:
                    lines.append(f"  {key}: {val}")
        if "exchange" in config and isinstance(config["exchange"], dict):
            ex = config["exchange"]
            pairs = ex.get("pair_whitelist", [])
            if pairs:
                shown = pairs[:10]
                lines.append(f"  pairs ({len(pairs)}): {' '.join(shown)}")
                if len(pairs) > 10:
                    lines.append(f"    … и ещё {len(pairs) - 10}")
    else:
        lines.append(f"  {str(config)[:500]}")

    await callback.message.answer(
        "\n".join(lines), reply_markup=back_keyboard(f"bot:{bot_id}")
    )
