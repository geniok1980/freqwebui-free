"""Схемы для Comparison View (/comparison)."""

from typing import Optional

from pydantic import BaseModel


class ModeData(BaseModel):
    """Данные режима торговли (backtest/dry_run/live)."""

    profit_pct: Optional[float] = None
    total_trades: Optional[int] = None
    win_rate: Optional[float] = None
    max_drawdown: Optional[float] = None
    avg_profit_pct: Optional[float] = None
    sharpe: Optional[float] = None
    profit_factor: Optional[float] = None
    calmar: Optional[float] = None
    total_profit_abs: Optional[float] = None
    bot_name: Optional[str] = None


class ToleranceCheck(BaseModel):
    """Проверка допусков между режимами."""

    backtest: float
    live: float
    within_tolerance: bool
    status: str
    diff_pct: Optional[float] = None
    ratio: Optional[float] = None


class ComparisonRow(BaseModel):
    """Строка сравнения для одной стратегии."""

    strategy_name: str
    timeframe: Optional[str] = None
    timerange: Optional[str] = None
    backtest_date: Optional[str] = None
    backtest: Optional[ModeData] = None
    dry_run: Optional[ModeData] = None
    live: Optional[ModeData] = None
    tolerances: dict[str, ToleranceCheck]


class ComparisonResponse(BaseModel):
    """Ответ сравнения."""

    status: str = "success"
    data: list[ComparisonRow]
    total: int
    limit: int
    offset: int
