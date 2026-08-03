"""Backtest results API endpoints.

Maps to the actual DB schema:
  backtest_results (id, bot_id, strategy_name, timeframe, timerange,
                    profit_pct, winrate_pct, max_drawdown_pct,
                    profit_factor, sharpe_ratio, total_trades, created_at)
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.api.deps import get_current_active_user

router = APIRouter(dependencies=[Depends(get_current_active_user)])


def success_response(data: Any) -> dict[str, Any]:
    """Wrap response in standard format."""
    return {"status": "success", "data": data}


def _row_to_dict(row) -> dict:
    """Convert a backtest_results row to the API response dict."""
    return {
        "id": row[0],
        "bot_id": row[1],
        "strategy_name": row[2],
        "timeframe": row[3],
        "timerange": row[4],
        "profit_pct": float(row[5]) if row[5] is not None else None,
        "winrate_pct": float(row[6]) if row[6] is not None else None,
        "max_drawdown_pct": float(row[7]) if row[7] is not None else None,
        "profit_factor": float(row[8]) if row[8] is not None else None,
        "sharpe_ratio": float(row[9]) if row[9] is not None else None,
        "total_trades": row[10],
        "created_at": row[11].isoformat() if row[11] else None,
    }


@router.get("")
async def list_backtest_results(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """List all backtest results sorted by profit."""
    result = await db.execute(
        text("""
            SELECT id, bot_id, strategy_name, timeframe, timerange,
                   profit_pct, winrate_pct, max_drawdown_pct,
                   profit_factor, sharpe_ratio, total_trades, created_at
            FROM backtest_results
            ORDER BY profit_pct DESC NULLS LAST
            LIMIT :limit OFFSET :offset
        """),
        {"limit": limit, "offset": offset}
    )

    rows = [_row_to_dict(r) for r in result.fetchall()]

    return success_response({
        "results": rows,
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    })


@router.get("/summary")
async def get_backtest_summary(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get summary statistics of all backtests."""
    result = await db.execute(
        text("""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN profit_pct > 0 THEN 1 END) as profitable,
                COUNT(CASE WHEN profit_pct <= 0 THEN 1 END) as unprofitable,
                AVG(profit_pct) as avg_profit,
                MAX(profit_pct) as best_profit,
                MIN(profit_pct) as worst_profit,
                AVG(winrate_pct) as avg_winrate,
                SUM(total_trades) as total_trades
            FROM backtest_results
        """)
    )

    row = result.fetchone()
    return success_response({
        "total_strategies": row[0],
        "profitable": row[1],
        "unprofitable": row[2],
        "avg_profit_pct": float(row[3]) if row[3] else 0,
        "best_profit_pct": float(row[4]) if row[4] else 0,
        "worst_profit_pct": float(row[5]) if row[5] else 0,
        "avg_win_rate": float(row[6]) if row[6] else 0,
        "total_trades": row[7] or 0,
    })


@router.get("/{strategy_name}")
async def get_backtest_detail(
    strategy_name: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get detailed backtest result for a specific strategy."""
    result = await db.execute(
        text("""
            SELECT id, bot_id, strategy_name, timeframe, timerange,
                   profit_pct, winrate_pct, max_drawdown_pct,
                   profit_factor, sharpe_ratio, total_trades, created_at
            FROM backtest_results
            WHERE strategy_name = :strategy_name
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"strategy_name": strategy_name}
    )

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Backtest not found: {strategy_name}")

    return success_response(_row_to_dict(row))
