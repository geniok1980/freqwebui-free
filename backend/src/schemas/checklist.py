"""Схемы для PreLaunch Checklist (/checklists)."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChecklistCreate(BaseModel):
    """Запрос на создание чеклиста."""

    bot_name: str
    sections: dict
    total_score: Optional[float] = None
    decision: Optional[str] = None
    is_complete: bool = False


class ChecklistUpdate(BaseModel):
    """Запрос на обновление чеклиста."""

    bot_name: Optional[str] = None
    sections: Optional[dict] = None
    total_score: Optional[float] = None
    decision: Optional[str] = None
    is_complete: Optional[bool] = None


class ChecklistData(BaseModel):
    """Данные чеклиста."""

    id: str
    user_id: str
    bot_name: str
    sections: dict
    total_score: Optional[float] = None
    decision: Optional[str] = None
    is_complete: bool
    template_version: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChecklistResponse(BaseModel):
    """Ответ с одним чеклистом."""

    status: str = "success"
    data: ChecklistData


class ChecklistListResponse(BaseModel):
    """Ответ со списком чеклистов."""

    status: str = "success"
    data: list[ChecklistData]
    total: int
    limit: int
    offset: int
