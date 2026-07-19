"""Схемы для Risk Dashboard (/risk)."""

from typing import Optional

from pydantic import BaseModel


class RiskLevel(BaseModel):
    """Уровень риска с визуализацией."""

    status: str  # "green" / "yellow" / "red"
    label: str
    value_pct: float
    fill_pct: float  # 0-100
    description: str
    risk_abs: Optional[float] = None
    position_size: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    open_positions: Optional[int] = None
    loss_pct: Optional[float] = None


class BotRiskData(BaseModel):
    """Данные риска для одного бота."""

    bot_id: str
    bot_name: str
    is_dry_run: bool
    strategy: Optional[str] = None
    exchange: Optional[str] = None
    available: bool
    message: Optional[str] = None
    overall: dict  # {"status": str, "label": str, "score": int}
    balance: dict  # {"total": float, "open_positions": int, ...}
    levels: dict  # {"trade_risk": RiskLevel, "portfolio_risk": RiskLevel, ...}


class RiskDashboardResponse(BaseModel):
    """Ответ дашборда рисков."""

    status: str = "success"
    data: list[BotRiskData]
    total: int
    limit: int
    offset: int
