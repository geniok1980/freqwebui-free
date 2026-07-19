"""Схемы для Trading Journal (/journal)."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class JournalCreate(BaseModel):
    """Запрос на создание записи журнала."""

    bot_id: Optional[str] = None
    entry_date: date
    entry_type: str = "daily"
    title: str
    content_md: Optional[str] = None
    metrics_json: Optional[dict] = None
    signals_json: Optional[dict] = None
    tags: list[str] = []
    is_pinned: bool = False


class JournalUpdate(BaseModel):
    """Запрос на обновление записи журнала."""

    bot_id: Optional[str] = None
    entry_date: Optional[date] = None
    entry_type: Optional[str] = None
    title: Optional[str] = None
    content_md: Optional[str] = None
    metrics_json: Optional[dict] = None
    signals_json: Optional[dict] = None
    tags: Optional[list[str]] = None
    is_pinned: Optional[bool] = None


class JournalTemplateRequest(BaseModel):
    """Запрос на генерацию шаблона записи."""

    bot_id: str


class JournalTemplateResponse(BaseModel):
    """Шаблон записи журнала."""

    title: str
    entry_date: str
    entry_type: str
    content_md: str
    metrics: dict


class ScoreSignalRequest(BaseModel):
    """Запрос на оценку качества сигнала."""

    bot_id: str
    pair: str
    timeframe: str
    signal_type: str
    entry_date: str


class ScoreSignalResponse(BaseModel):
    """Результат оценки сигнала."""

    score: float
    rating: str
    factors: dict


class JournalData(BaseModel):
    """Данные записи журнала."""

    id: str
    user_id: str
    bot_id: Optional[str] = None
    entry_date: date
    entry_type: str
    title: str
    content_md: Optional[str] = None
    metrics_json: Optional[dict] = None
    signals_json: Optional[dict] = None
    tags: list[str]
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JournalResponse(BaseModel):
    """Ответ с одной записью журнала."""

    status: str = "success"
    data: JournalData


class JournalListResponse(BaseModel):
    """Ответ со списком записей журнала."""

    status: str = "success"
    data: list[JournalData]
    total: int
    limit: int
    offset: int
