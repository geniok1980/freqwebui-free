"""Comparison View API — сравнение backtest/dry_run/live (/comparison)."""

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.bot import Bot
from src.models.metrics import BotMetrics
from src.schemas.comparison import ComparisonResponse, ComparisonRow, ModeData, ToleranceCheck

router = APIRouter()


async def _get_backtest_data(db: AsyncSession) -> dict[str, dict]:
    """Получить все backtest-результаты, сгруппированные по strategy_name."""
    result = await db.execute(
        text("""
            SELECT DISTINCT ON (strategy_name)
                strategy_name, timeframe, timerange,
                profit_pct, total_trades, winrate_pct,
                max_drawdown_pct, NULL as avg_profit_pct, sharpe_ratio,
                profit_factor, NULL as calmar, NULL as total_profit_abs,
                created_at
            FROM backtest_results
            ORDER BY strategy_name, created_at DESC
        """))
    rows = result.fetchall()
    out: dict[str, dict] = {}
    for row in rows:
        out[row[0]] = {
            "strategy_name": row[0],
            "timeframe": row[1],
            "timerange": row[2],
            "profit_pct": float(row[3]) if row[3] else None,
            "total_trades": row[4],
            "win_rate": float(row[5]) if row[5] else None,
            "max_drawdown": float(row[6]) if row[6] else None,
            "avg_profit_pct": float(row[7]) if row[7] else None,
            "sharpe": float(row[8]) if row[8] else None,
            "profit_factor": float(row[9]) if row[9] else None,
            "calmar": float(row[10]) if row[10] else None,
            "total_profit_abs": float(row[11]) if row[11] else None,
            "backtest_date": row[12].isoformat() if row[12] else None,
            "bot_name": f"Backtest: {row[0]}",
        }
    return out


async def _get_bot_metrics_by_strategy(db: AsyncSession) -> dict[str, dict]:
    """Получить последние метрики ботов, сгруппированные по strategy."""
    bots_result = await db.execute(select(Bot))
    bots = list(bots_result.scalars())

    out: dict[str, dict] = {}
    for bot in bots:
        if not bot.strategy:
            continue

        metrics_result = await db.execute(
            select(BotMetrics)
            .where(BotMetrics.bot_id == bot.id)
            .order_by(desc(BotMetrics.timestamp))
            .limit(1)
        )
        metrics = metrics_result.scalar_one_or_none()

        entry = {
            "profit_pct": float(metrics.profit_pct) if metrics and metrics.profit_pct else None,
            "total_trades": (metrics.closed_trades + metrics.open_positions) if metrics else None,
            "win_rate": float(metrics.win_rate) if metrics and metrics.win_rate else None,
            "max_drawdown": float(metrics.drawdown) if metrics and metrics.drawdown else None,
            "avg_profit_pct": None,  # нет в прямом доступе
            "sharpe": None,
            "profit_factor": None,
            "calmar": None,
            "total_profit_abs": float(metrics.profit_abs) if metrics and metrics.profit_abs else None,
            "bot_name": bot.name,
        }

        if bot.is_dryrun:
            if bot.strategy not in out:
                out[bot.strategy] = {}
            out[bot.strategy]["dry_run"] = entry
        else:
            if bot.strategy not in out:
                out[bot.strategy] = {}
            out[bot.strategy]["live"] = entry

    return out


def _check_tolerance(name: str, bt_val: float | None, live_val: float | None, thresholds: dict) -> ToleranceCheck:
    """Проверить допуск между backtest и live."""
    if bt_val is None or live_val is None:
        return ToleranceCheck(
            backtest=round(bt_val or 0, 2),
            live=round(live_val or 0, 2),
            within_tolerance=False,
            status="Нет данных",
            diff_pct=None,
            ratio=None,
        )

    diff_pct = live_val - bt_val
    ratio = live_val / bt_val if bt_val != 0 else None

    th = thresholds.get(name, {"max_diff_pct": 50, "max_ratio": 1.5})

    within = True
    if "max_diff_pct" in th:
        # Для profit: разница в пределах ±max_diff_pct%
        if abs(diff_pct) > th["max_diff_pct"]:
            within = False
    if "max_ratio" in th:
        # Для drawdown: live не должен превышать backtest более чем в max_ratio раз
        if ratio and ratio > th["max_ratio"]:
            within = False
    if "max_diff_abs" in th:
        # Для win_rate: разница в пределах max_diff_abs
        if abs(diff_pct) > th["max_diff_abs"]:
            within = False

    status = "В допуске" if within else "Вне допуска"
    return ToleranceCheck(
        backtest=round(bt_val, 2),
        live=round(live_val, 2),
        within_tolerance=within,
        status=status,
        diff_pct=round(diff_pct, 2),
        ratio=round(ratio, 2) if ratio else None,
    )


@router.get("", response_model=ComparisonResponse)
async def get_comparison(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200, description="Максимальное количество стратегий"),
    offset: int = Query(0, ge=0, description="Смещение"),
) -> ComparisonResponse:
    """Сравнение backtest / dry-run / live для всех стратегий."""
    backtests = await _get_backtest_data(db)
    bot_metrics = await _get_bot_metrics_by_strategy(db)

    all_strategies = set(backtests.keys()) | set(bot_metrics.keys())
    rows: list[ComparisonRow] = []

    tolerance_config = {
        "profit": {"max_diff_pct": 50},
        "win_rate": {"max_diff_abs": 15},
        "drawdown": {"max_ratio": 1.5},
    }

    for strategy_name in sorted(all_strategies):
        bt = backtests.get(strategy_name)
        bm = bot_metrics.get(strategy_name, {})

        # Backtest ModeData
        backtest_md = None
        if bt:
            backtest_md = ModeData(
                profit_pct=bt.get("profit_pct"),
                total_trades=bt.get("total_trades"),
                win_rate=bt.get("win_rate"),
                max_drawdown=bt.get("max_drawdown"),
                avg_profit_pct=bt.get("avg_profit_pct"),
                sharpe=bt.get("sharpe"),
                profit_factor=bt.get("profit_factor"),
                calmar=bt.get("calmar"),
                total_profit_abs=bt.get("total_profit_abs"),
                bot_name=bt.get("bot_name"),
            )

        # Dry-run ModeData
        dry_md = None
        if "dry_run" in bm:
            dr = bm["dry_run"]
            dry_md = ModeData(
                profit_pct=dr.get("profit_pct"),
                total_trades=dr.get("total_trades"),
                win_rate=dr.get("win_rate"),
                max_drawdown=dr.get("max_drawdown"),
                avg_profit_pct=dr.get("avg_profit_pct"),
                sharpe=dr.get("sharpe"),
                profit_factor=dr.get("profit_factor"),
                calmar=dr.get("calmar"),
                total_profit_abs=dr.get("total_profit_abs"),
                bot_name=dr.get("bot_name"),
            )

        # Live ModeData
        live_md = None
        if "live" in bm:
            lv = bm["live"]
            live_md = ModeData(
                profit_pct=lv.get("profit_pct"),
                total_trades=lv.get("total_trades"),
                win_rate=lv.get("win_rate"),
                max_drawdown=lv.get("max_drawdown"),
                avg_profit_pct=lv.get("avg_profit_pct"),
                sharpe=lv.get("sharpe"),
                profit_factor=lv.get("profit_factor"),
                calmar=lv.get("calmar"),
                total_profit_abs=lv.get("total_profit_abs"),
                bot_name=lv.get("bot_name"),
            )

        # Tolerance checks
        bt_ref = bt or {}
        # Use live data if available, fall back to dry_run
        if live_md and bm.get("live"):
            live_ref = bm["live"]
        elif dry_md and bm.get("dry_run"):
            live_ref = bm["dry_run"]
        else:
            live_ref = {}
        tolerances: dict[str, ToleranceCheck] = {}

        if bt_ref and live_ref:
            tolerances["profit"] = _check_tolerance(
                "profit",
                bt_ref.get("profit_pct"),
                live_ref.get("profit_pct"),
                tolerance_config,
            )
            tolerances["win_rate"] = _check_tolerance(
                "win_rate",
                bt_ref.get("win_rate"),
                live_ref.get("win_rate"),
                tolerance_config,
            )
            tolerances["drawdown"] = _check_tolerance(
                "drawdown",
                bt_ref.get("max_drawdown"),
                live_ref.get("max_drawdown"),
                tolerance_config,
            )

        rows.append(ComparisonRow(
            strategy_name=strategy_name,
            timeframe=bt.get("timeframe") if bt else None,
            timerange=bt.get("timerange") if bt else None,
            backtest_date=bt.get("backtest_date") if bt else None,
            backtest=backtest_md,
            dry_run=dry_md,
            live=live_md,
            tolerances=tolerances,
        ))

    # Пагинация
    total = len(rows)
    paginated = rows[offset:offset + limit]

    return ComparisonResponse(
        data=paginated,
        total=total,
        limit=limit,
        offset=offset,
    )
