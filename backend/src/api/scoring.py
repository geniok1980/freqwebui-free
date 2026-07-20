"""Scoring Dashboard API — скоринг ботов (/scoring)."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.bot import Bot
from src.models.metrics import BotMetrics
from src.schemas.scoring import (
    BotScoringData,
    MetricItem,
    ScoringDashboardResponse,
    ScoringGroupData,
)

router = APIRouter()

# Конфигурация групп и метрик
SCORING_GROUPS = {
    "Доходность": {
        "weight_pct": 40.0,
        "metrics": {
            "total_profit_pct": {"label": "Общая прибыль %", "weight_pct": 40.0},
            "annualized_return": {"label": "Годовая доходность %", "weight_pct": 35.0},
            "avg_trade_profit": {"label": "Средняя прибыль на сделку %", "weight_pct": 25.0},
        },
    },
    "Риск": {
        "weight_pct": 30.0,
        "metrics": {
            "max_drawdown": {"label": "Макс. просадка %", "weight_pct": 40.0, "inverse": True},
            "profit_factor": {"label": "Profit Factor", "weight_pct": 35.0},
            "sharpe_ratio": {"label": "Sharpe Ratio", "weight_pct": 25.0},
        },
    },
    "Стабильность": {
        "weight_pct": 20.0,
        "metrics": {
            "win_rate": {"label": "Win Rate %", "weight_pct": 40.0},
            "consecutive_wins": {"label": "Макс. побед подряд", "weight_pct": 30.0},
            "consecutive_losses": {"label": "Макс. убытков подряд", "weight_pct": 30.0, "inverse": True},
        },
    },
    "Эффективность": {
        "weight_pct": 10.0,
        "metrics": {
            "avg_trade_duration": {"label": "Средняя длительность сделки", "weight_pct": 50.0},
            "trades_per_day": {"label": "Сделок в день", "weight_pct": 50.0},
        },
    },
}


def _score_metric(label: str, value: float | None, cfg: dict) -> tuple[float, str, str | None]:
    """Оценить метрику по шкале 0-10."""
    if value is None:
        return 0.0, "N/A", "Нет данных"

    inverse = cfg.get("inverse", False)

    # Оценочные пороги для разных метрик
    thresholds: dict[str, dict[str, list[float]]] = {
        "total_profit_pct": {"positive": [0, 5, 15, 30, 60], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "annualized_return": {"positive": [0, 10, 25, 50, 100], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "avg_trade_profit": {"positive": [0, 0.5, 1.5, 3, 6], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "max_drawdown": {"inverse": [60, 30, 15, 5, 0], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "profit_factor": {"positive": [0, 0.8, 1.2, 1.8, 2.5], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "sharpe_ratio": {"positive": [-1, 0, 0.5, 1.0, 2.0], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "win_rate": {"positive": [0, 35, 50, 65, 80], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "consecutive_wins": {"positive": [0, 3, 6, 10, 15], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "consecutive_losses": {"inverse": [20, 10, 6, 3, 0], "rating": ["Очень плохо", "Плохо", "Средне", "Хорошо", "Отлично"]},
        "avg_trade_duration": {"positive": [0, 0.5, 2, 8, 24], "rating": ["Слишком коротко", "Коротко", "Оптимально", "Длительно", "Слишком длительно"]},
        "trades_per_day": {"positive": [0, 0.2, 0.5, 2, 5], "rating": ["Очень редко", "Редко", "Нормально", "Часто", "Очень часто"]},
    }

    th = thresholds.get(label, {"positive": [0, 1, 2, 3, 5], "rating": ["Плохо", "Ниже среднего", "Средне", "Хорошо", "Отлично"]})

    if inverse:
        thresholds_list = th.get("inverse", [100, 50, 25, 10, 0])
        for i, t in enumerate(thresholds_list):
            if value <= t:
                score = i * 2.5
                rating = th["rating"][i]
                return score, rating, None
    else:
        thresholds_list = th.get("positive", [0, 1, 2, 3, 5])
        for i in range(len(thresholds_list) - 1, -1, -1):
            if value >= thresholds_list[i]:
                score = (i + 1) * 2.0
                rating = th["rating"][i]
                return score, rating, None

    return 0.0, "N/A", None


async def _get_backtest_metrics(db: AsyncSession, strategy_name: str) -> dict:
    """Получить метрики из backtest_results для стратегии."""
    result = await db.execute(
        text("""
            SELECT profit_pct, winrate_pct, max_drawdown_pct, sharpe_ratio, profit_factor,
                   NULL as avg_profit_pct, NULL as avg_trade_duration, total_trades,
                   NULL as annualized_return,
                   NULL as consecutive_wins,
                   NULL as consecutive_losses
            FROM backtest_results
            WHERE strategy_name = :strategy_name
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"strategy_name": strategy_name},
    )
    row = result.fetchone()
    if not row:
        return {}
    cols = [
        "profit_pct", "winrate_pct", "max_drawdown_pct", "sharpe_ratio", "profit_factor",
        "avg_profit_pct", "avg_trade_duration", "total_trades",
        "annualized_return", "consecutive_wins", "consecutive_losses",
    ]
    return {cols[i]: row[i] for i in range(len(cols))}


@router.get("", response_model=ScoringDashboardResponse)
async def get_scoring_dashboard(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200, description="Максимальное количество ботов"),
    offset: int = Query(0, ge=0, description="Смещение"),
) -> ScoringDashboardResponse:
    """Дашборд скоринга: оценка ботов по метрикам эффективности.

    Расчитывает взвешенную оценку по группам: доходность, риск, стабильность, эффективность.
    Данные берутся из bot_metrics и backtest_results.
    """
    from sqlalchemy import func

    bots_result = await db.execute(
        select(Bot).order_by(Bot.name).offset(offset).limit(limit)
    )
    bots = list(bots_result.scalars())

    count_result = await db.execute(select(func.count()).select_from(Bot))
    total = count_result.scalar() or 0

    scoring_data: list[BotScoringData] = []

    for bot in bots:
        # Последняя метрика
        metrics_result = await db.execute(
            select(BotMetrics)
            .where(BotMetrics.bot_id == bot.id)
            .order_by(desc(BotMetrics.timestamp))
            .limit(1)
        )
        metrics = metrics_result.scalar_one_or_none()

        # Backtest-метрики
        bt_metrics = {}
        if bot.strategy:
            bt_metrics = await _get_backtest_metrics(db, bot.strategy)

        # Собираем значения метрик
        metric_values: dict[str, float | None] = {
            "total_profit_pct": float(metrics.profit_pct) if metrics and metrics.profit_pct else float(bt_metrics.get("profit_pct") or 0),
            "annualized_return": float(bt_metrics.get("annualized_return") or 0),
            "avg_trade_profit": float(bt_metrics.get("avg_profit_pct") or 0),
            "max_drawdown": float(metrics.drawdown) if metrics and metrics.drawdown else float(bt_metrics.get("max_drawdown_pct") or 0),
            "profit_factor": float(bt_metrics.get("profit_factor") or 0),
            "sharpe_ratio": float(bt_metrics.get("sharpe_ratio") or 0),
            "win_rate": float(metrics.win_rate) if metrics and metrics.win_rate else float(bt_metrics.get("winrate_pct") or 0),
            "consecutive_wins": float(bt_metrics.get("consecutive_wins") or 0),
            "consecutive_losses": float(bt_metrics.get("consecutive_losses") or 0),
            "avg_trade_duration": float(bt_metrics.get("avg_trade_duration") or 0),
            "trades_per_day": float(bt_metrics.get("total_trades") or 0) / 30.0 if bt_metrics.get("total_trades") else 0.0,
        }

        groups: dict[str, ScoringGroupData] = {}
        total_score = 0.0

        for group_name, group_cfg in SCORING_GROUPS.items():
            group_weight = group_cfg["weight_pct"]
            group_metrics: list[MetricItem] = []
            group_weighted = 0.0

            for metric_key, metric_cfg in group_cfg["metrics"].items():
                value = metric_values.get(metric_key)
                score, rating, detail = _score_metric(metric_key, value, metric_cfg)
                metric_weight = metric_cfg["weight_pct"]
                weighted = score * metric_weight / 100.0
                group_weighted += weighted

                group_metrics.append(MetricItem(
                    label=metric_cfg["label"],
                    value=round(value, 2) if value is not None else None,
                    score=round(score, 1),
                    rating=rating,
                    weight_pct=metric_weight,
                    detail=detail,
                ))

            total_score += group_weighted * group_weight / 100.0

            groups[group_name] = ScoringGroupData(
                name=group_name,
                weight_pct=group_weight,
                total_weighted=round(group_weighted, 2),
                metrics=group_metrics,
            )

        # total_percent = сумма всех взвешенных оценок, нормированная на 100%
        max_possible = 10.0  # каждая метрика максимум 10
        total_percent = round(total_score / max_possible * 100, 1)

        scoring_data.append(BotScoringData(
            bot_id=bot.id,
            bot_name=bot.name,
            strategy=bot.strategy,
            exchange=bot.exchange,
            is_dry_run=bot.is_dryrun,
            timestamp=metrics.timestamp.isoformat() if metrics else datetime.now(timezone.utc).isoformat(),
            total_score=round(total_score, 2),
            total_percent=total_percent,
            groups=groups,
        ))

    return ScoringDashboardResponse(
        data=scoring_data,
        total=total,
        limit=limit,
        offset=offset,
    )
