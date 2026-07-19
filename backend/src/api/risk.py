"""Risk Dashboard API — оценка рисков по ботам (/risk)."""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.bot import Bot, HealthState
from src.models.metrics import BotMetrics
from src.schemas.risk import BotRiskData, RiskDashboardResponse, RiskLevel

router = APIRouter()

# Пороги риска по профилям консервативности
RISK_THRESHOLDS = {
    "level_1_per_trade": {"conservative": 1.0, "moderate": 2.0, "aggressive": 3.0},
    "level_2_portfolio": {"conservative": 5.0, "moderate": 10.0, "aggressive": 15.0},
    "level_3_daily": {"conservative": 2.0, "moderate": 5.0, "aggressive": 10.0},
    "level_4_weekly": {"conservative": 10.0, "moderate": 15.0, "aggressive": 20.0},
}

# Используем «moderate» как профиль по умолчанию
DEFAULT_PROFILE = "moderate"


def _risk_status(value_pct: float, threshold: float) -> str:
    """Определить цветовой статус риска."""
    if value_pct <= threshold * 0.5:
        return "green"
    elif value_pct <= threshold:
        return "yellow"
    return "red"


def _make_risk_level(
    key: str,
    value_pct: float,
    fill_pct: float,
    description: str,
    risk_abs: float | None = None,
    position_size: float | None = None,
    stop_loss_pct: float | None = None,
    open_positions: int | None = None,
    loss_pct: float | None = None,
) -> RiskLevel:
    threshold = RISK_THRESHOLDS.get(key, {}).get(DEFAULT_PROFILE, 5.0)
    status = _risk_status(value_pct, threshold)
    label_map = {
        "level_1_per_trade": "Риск на сделку",
        "level_2_portfolio": "Риск портфеля",
        "level_3_daily": "Дневной убыток",
        "level_4_weekly": "Недельный убыток",
    }
    return RiskLevel(
        status=status,
        label=label_map.get(key, key),
        value_pct=round(value_pct, 2),
        fill_pct=round(fill_pct, 1),
        description=description,
        risk_abs=risk_abs,
        position_size=position_size,
        stop_loss_pct=stop_loss_pct,
        open_positions=open_positions,
        loss_pct=loss_pct,
    )


async def _fetch_live_data(api_url: str, username: str = "", password: str = "") -> dict | None:
    """Запросить реальные данные из REST API бота (Freqtrade)."""
    try:
        auth = (username, password) if username and password else None
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            resp = await client.get(
                f"{api_url.rstrip('/')}/api/v1/profit",
                auth=auth,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


@router.get("", response_model=RiskDashboardResponse)
async def get_risk_dashboard(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200, description="Максимальное количество ботов"),
    offset: int = Query(0, ge=0, description="Смещение"),
) -> RiskDashboardResponse:
    """Дашборд рисков: агрегированные показатели по всем ботам.

    Для live-ботов запрашивает актуальные данные через REST API бота.
    Для dry-run использует последнюю запись из bot_metrics.
    """
    # Получаем всех ботов
    bots_result = await db.execute(
        select(Bot).order_by(Bot.name).offset(offset).limit(limit)
    )
    bots = list(bots_result.scalars())

    # Считаем общее количество
    from sqlalchemy import func
    count_result = await db.execute(select(func.count()).select_from(Bot))
    total = count_result.scalar() or 0

    risk_data: list[BotRiskData] = []

    for bot in bots:
        # Получаем последнюю метрику из bot_metrics
        metrics_result = await db.execute(
            select(BotMetrics)
            .where(BotMetrics.bot_id == bot.id)
            .order_by(desc(BotMetrics.timestamp))
            .limit(1)
        )
        metrics = metrics_result.scalar_one_or_none()

        available = True
        message: str | None = None
        profit_pct = 0.0
        drawdown_pct = 0.0
        balance_total = 0.0
        open_positions = 0
        closed_trades = 0
        win_rate = 0.0

        if not bot.is_dryrun:
            # Live бот — пробуем запросить через API
            live_data = await _fetch_live_data(bot.api_url or "")
            if live_data:
                profit_pct = float(live_data.get("profit_all_percent", 0) or 0)
                closed_trades = int(live_data.get("closed_trade_count", 0) or 0)
                winning = int(live_data.get("winning_trades", 0) or 0)
                losing = int(live_data.get("losing_trades", 0) or 0)
                if winning + losing > 0:
                    win_rate = round(winning / (winning + losing) * 100, 1)
                open_positions = int(live_data.get("trade_count", 0) or 0) - closed_trades
                balance_total = float(live_data.get("profit_all_coin", 0) or 0)
            else:
                available = False
                message = "Бот недоступен через REST API"

        if metrics:
            if bot.is_dryrun or not available:
                profit_pct = float(metrics.profit_pct or 0)
                drawdown_pct = float(metrics.drawdown or 0)
                balance_total = float(metrics.balance or 0)
                open_positions = metrics.open_positions
                closed_trades = metrics.closed_trades
                win_rate = float(metrics.win_rate or 0)
        elif not bot.is_dryrun and available:
            # Нет метрик, но есть live-данные — используем их
            pass
        elif not available:
            message = message or "Нет данных"

        # Расчёт уровней риска
        trade_risk_value = 1.5  # значение по умолчанию
        trade_risk = _make_risk_level(
            "level_1_per_trade",
            value_pct=trade_risk_value,
            fill_pct=min(trade_risk_value / 3.0 * 100, 100),
            description=f"Риск на одну сделку: {trade_risk_value}%",
            open_positions=open_positions,
        )

        portfolio_risk_value = float(open_positions) * 1.5 if open_positions else 0.0
        portfolio_risk = _make_risk_level(
            "level_2_portfolio",
            value_pct=portfolio_risk_value,
            fill_pct=min(portfolio_risk_value / 15.0 * 100, 100),
            description=f"Открыто позиций: {open_positions}",
            open_positions=open_positions,
        )

        daily_loss_value = abs(profit_pct) if profit_pct < 0 else 0.0
        daily_loss = _make_risk_level(
            "level_3_daily",
            value_pct=daily_loss_value,
            fill_pct=min(daily_loss_value / 10.0 * 100, 100),
            description=f"Дневной P&L: {profit_pct:.2f}%",
            loss_pct=profit_pct,
        )

        weekly_loss_value = abs(profit_pct) * 1.5 if profit_pct < 0 else 0.0
        weekly_loss = _make_risk_level(
            "level_4_weekly",
            value_pct=weekly_loss_value,
            fill_pct=min(weekly_loss_value / 20.0 * 100, 100),
            description=f"Недельный P&L (оценка): {(profit_pct * 1.5):.2f}%",
            loss_pct=profit_pct * 1.5 if profit_pct < 0 else None,
        )

        # Общая оценка
        worst_status = "green"
        for rl in [trade_risk, portfolio_risk, daily_loss, weekly_loss]:
            if rl.status == "red":
                worst_status = "red"
                break
            elif rl.status == "yellow":
                worst_status = "yellow"

        overall_score = 100
        if worst_status == "red":
            overall_score = 30
        elif worst_status == "yellow":
            overall_score = 60

        overall_label_map = {
            "green": "Низкий риск",
            "yellow": "Средний риск",
            "red": "Высокий риск",
        }

        risk_data.append(BotRiskData(
            bot_id=bot.id,
            bot_name=bot.name,
            is_dry_run=bot.is_dryrun,
            strategy=bot.strategy,
            exchange=bot.exchange,
            available=available,
            message=message,
            overall={
                "status": worst_status,
                "label": overall_label_map.get(worst_status, "Неизвестно"),
                "score": overall_score,
            },
            balance={
                "total": round(balance_total, 2),
                "open_positions": open_positions,
                "closed_trades": closed_trades,
                "win_rate": round(win_rate, 1),
                "profit_pct": round(profit_pct, 2),
                "drawdown_pct": round(drawdown_pct, 2),
            },
            levels={
                "level_1_per_trade": trade_risk,
                "level_2_portfolio": portfolio_risk,
                "level_3_daily": daily_loss,
                "level_4_weekly": weekly_loss,
            },
        ))

    return RiskDashboardResponse(
        data=risk_data,
        total=total,
        limit=limit,
        offset=offset,
    )
