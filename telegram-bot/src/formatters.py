"""Format Freqdash API data into Telegram-friendly strings."""

from __future__ import annotations

from datetime import datetime
from typing import Any


def _fmt_num(v: float | None, decimals: int = 2) -> str:
    if v is None:
        return "—"
    return f"{v:,.{decimals}f}"


def _fmt_pct(v: float | None) -> str:
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.2f}%"


def _health_icon(state: str) -> str:
    return {"healthy": "🟢", "degraded": "🟡", "unreachable": "🔴", "unknown": "⚪"}.get(
        state.lower(), "⚪"
    )


def _dry_icon(dry: bool) -> str:
    return "🧪" if dry else "💰"


def format_bot_short(bot: dict) -> str:
    """One-line bot summary."""
    name = bot.get("name", "?")
    health = _health_icon(bot.get("health_state", "unknown"))
    dry = _dry_icon(bot.get("is_dryrun", True))
    strategy = bot.get("strategy", "—")[:20]
    return f"{health} {dry} <b>{name}</b>  |  {strategy}"


def format_bot_detail(bot: dict, metrics: dict, health: dict) -> str:
    """Full bot detail card."""
    name = bot.get("name", "?")
    health_icon = _health_icon(bot.get("health_state", "unknown"))
    dry = _dry_icon(bot.get("is_dryrun", True))
    mode = "🧪 Dry-Run" if bot.get("is_dryrun") else "💰 Live"

    lines = [
        f"{health_icon} <b>{name}</b>",
        f"Стратегия: {bot.get('strategy', '—')}  |  Биржа: {bot.get('exchange', '—')}",
        f"Режим: {mode}  |  Статус: {health_icon} {bot.get('health_state', 'unknown').upper()}",
        "",
    ]

    if metrics:
        equity = _fmt_num(metrics.get("equity"))
        profit_abs = _fmt_num(metrics.get("profit_abs"))
        profit_pct = _fmt_pct(metrics.get("profit_pct"))
        open_pos = metrics.get("open_positions", 0)
        closed = metrics.get("closed_trades", 0)
        win_rate = _fmt_pct(metrics.get("win_rate"))
        drawdown = _fmt_pct(metrics.get("drawdown"))
        balance = _fmt_num(metrics.get("balance"))

        ts = metrics.get("timestamp")
        if ts:
            age = ""
            if isinstance(ts, str):
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    age = f" ({(datetime.utcnow() - dt).seconds // 60}мин назад)"
                except Exception:
                    pass
        else:
            age = ""

        lines += [
            "📊 <b>Метрики</b>" + age,
            f"  Баланс: <code>{balance}</code> USDT",
            f"  P&L: <code>{profit_pct}</code> ({profit_abs} USDT)",
            f"  Открыто: {open_pos}  |  Закрыто: {closed}",
            f"  Win Rate: <code>{win_rate}</code>",
            f"  Просадка: <code>{drawdown}</code>",
            "",
        ]

    if health:
        api_ok = "✅" if health.get("api_available") else "❌"
        sql_ok = "✅" if health.get("sqlite_available") else "❌"
        lines += [
            "🏥 <b>Здоровье</b>",
            f"  API: {api_ok}  |  SQLite: {sql_ok}",
            "",
        ]

    return "\n".join(lines)


def format_portfolio_summary(data: dict) -> str:
    """Portfolio summary card."""
    total_bots = data.get("total_bots", 0)
    healthy = data.get("healthy_bots", 0)
    unreachable = data.get("unreachable_bots", 0)
    balance = _fmt_num(data.get("total_balance"))
    profit_pct = _fmt_pct(data.get("total_profit_pct"))
    profit_abs = _fmt_num(data.get("total_profit_abs"))
    open_pos = data.get("total_open_positions", 0)
    closed = data.get("total_closed_trades", 0)
    win_rate = _fmt_pct(data.get("avg_win_rate"))
    best = data.get("best_performer", "—")
    worst = data.get("worst_performer", "—")

    return (
        f"💼 <b>Портфель</b>\n"
        f"Ботов: {total_bots}  ({healthy} 🟢 | {unreachable} 🔴)\n"
        f"Баланс: <code>{balance}</code> USDT\n"
        f"P&L: <code>{profit_pct}</code> ({profit_abs} USDT)\n"
        f"Открыто: {open_pos}  |  Закрыто: {closed}\n"
        f"Win Rate: <code>{win_rate}</code>\n"
        f"\n"
        f"🏆 Лучший: {best}\n"
        f"⛔ Худший: {worst}"
    )


def format_exchange_breakdown(data: list[dict]) -> str:
    """Exchange breakdown."""
    lines = ["📊 <b>По биржам</b>"]
    for ex in data:
        name = ex.get("exchange", "—")
        profit = _fmt_pct(ex.get("profit_pct"))
        bots = ex.get("bot_count", 0)
        balance = _fmt_num(ex.get("balance"))
        lines.append(f"  <b>{name}</b>: {profit} ({bots} бот, {balance} USDT)")
    return "\n".join(lines)


def format_agent_status(status: dict, regime: dict) -> str:
    """Agent status card."""
    enabled = status.get("enabled", False)
    running = status.get("container_running", False)
    paper = status.get("paper_trading", True)
    today_trades = status.get("today_trades", 0)
    today_wins = status.get("today_wins", 0)
    win_rate = _fmt_pct(status.get("today_win_rate"))
    regime_name = regime.get("regime", "unknown")
    btc_price = _fmt_num(regime.get("btc_price"))

    status_icon = "✅" if enabled else "❌"
    container_icon = "🟢" if running else "🔴"
    paper_icon = "📄" if paper else "💰"

    return (
        f"🧠 <b>Dashboard Agent</b>\n"
        f"Статус: {status_icon} {'Включён' if enabled else 'Выключен'}\n"
        f"Контейнер: {container_icon} {'Running' if running else 'Stopped'}\n"
        f"Режим: {paper_icon} {'Paper' if paper else 'Live'}\n"
        f"\n"
        f"📈 <b>Режим рынка:</b> {regime_name}\n"
        f"BTC: <code>{btc_price}</code> USDT\n"
        f"\n"
        f"📊 <b>Сегодня:</b>\n"
        f"  Сделок: {today_trades}\n"
        f"  Побед: {today_wins}\n"
        f"  Win Rate: <code>{win_rate}</code>"
    )


def format_trades(trades: list[dict], limit: int = 5) -> str:
    """Recent agent trades."""
    if not trades:
        return "📭 Нет сделок"

    lines = ["📋 <b>Последние сделки</b>"]
    for t in trades[:limit]:
        pair = t.get("pair", "—")
        direction = t.get("direction", "—")
        direction_icon = "🟢 LONG" if direction == "long" else "🔴 SHORT"
        confidence = _fmt_pct(t.get("confidence", 0) * 100 if isinstance(t.get("confidence"), float) and t.get("confidence") <= 1 else t.get("confidence", 0))
        profit = t.get("final_profit")
        profit_str = f" | {_fmt_pct(profit)}" if profit is not None else ""
        lines.append(f"  {direction_icon} {pair} [{confidence}]{profit_str}")
    if len(trades) > limit:
        lines.append(f"  … и ещё {len(trades) - limit}")
    return "\n".join(lines)


def format_risk(data: list[dict]) -> str:
    """Risk dashboard summary."""
    if not data:
        return "📭 Нет данных по рискам"

    lines = ["⚠️ <b>Риски</b>\n"]
    for item in data:
        name = item.get("bot_name", item.get("bot_id", "?"))
        levels = item.get("levels", {})
        lines.append(f"<b>{name}</b>")
        for level_key in ("per_trade", "total_portfolio", "daily_loss", "weekly_loss"):
            level = levels.get(level_key, {})
            label = level.get("label", level_key)
            value = level.get("value", "—")
            if isinstance(value, float):
                value = f"{value:.1%}"
            lines.append(f"  {label}: <code>{value}</code>")
        lines.append("")
    return "\n".join(lines)


def format_scoring(data: list[dict]) -> str:
    """Scoring dashboard."""
    if not data:
        return "📭 Нет данных по скорингу"

    lines = ["🏅 <b>Скоринг стратегий</b>\n"]
    for item in sorted(data, key=lambda x: x.get("total_score", 0), reverse=True):
        name = item.get("bot_name", "?")
        score = item.get("total_score", 0)
        dry = "🧪" if item.get("is_dry_run") else "💰"
        lines.append(f"  {dry} <b>{name}</b>: <code>{score:.1f}</code>/10")
    return "\n".join(lines)


def format_comparison(data: list[dict]) -> str:
    """Backtest ↔ Dry ↔ Live comparison."""
    if not data:
        return "📭 Нет данных для сравнения"

    lines = ["📊 <b>Backtest ↔ Dry-Run ↔ Live</b>\n"]
    for item in data[:5]:
        sname = item.get("strategy_name", "?")
        lines.append(f"<b>{sname}</b>")
        bt = item.get("backtest") or {}
        dr = item.get("dry_run") or {}
        lv = item.get("live") or {}

        def _fmt_mode(m: dict) -> str:
            profit = _fmt_pct(m.get("profit_pct"))
            trades = m.get("total_trades", "—")
            wr = _fmt_pct(m.get("win_rate"))
            return f"P&L {profit} | {trades} trades | WR {wr}"

        if bt:
            lines.append(f"  🧪 Backtest:  {_fmt_mode(bt)}")
        if dr:
            lines.append(f"  📄 Dry-Run:   {_fmt_mode(dr)}")
        if lv:
            lines.append(f"  💰 Live:      {_fmt_mode(lv)}")
        lines.append("")
    if len(data) > 5:
        lines.append(f"… и ещё {len(data) - 5} стратегий")
    return "\n".join(lines)
