"""Схемы для Scoring Dashboard (/scoring)."""

from typing import Optional

from pydantic import BaseModel


class MetricItem(BaseModel):
    """Одна метрика в группе скоринга."""

    label: str
    value: Optional[float] = None
    score: float
    rating: str
    weight_pct: float
    detail: Optional[str] = None


class ScoringGroupData(BaseModel):
    """Группа метрик скоринга."""

    name: str
    weight_pct: float
    total_weighted: float
    metrics: list[MetricItem]


class BotScoringData(BaseModel):
    """Данные скоринга для одного бота."""

    bot_id: str
    bot_name: str
    strategy: Optional[str] = None
    exchange: Optional[str] = None
    is_dry_run: bool
    timestamp: str
    total_score: float
    total_percent: float
    groups: dict[str, ScoringGroupData]


class ScoringDashboardResponse(BaseModel):
    """Ответ дашборда скоринга."""

    status: str = "success"
    data: list[BotScoringData]
    total: int
    limit: int
    offset: int
