"""API истории версий стратегий: список, исходник, сохранение, откат."""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import require_operator
from src.models import get_db
from src.services.strategy_versions import (
    get_strategies_root,
    get_strategy_version_source,
    list_strategy_versions,
    record_strategy_version,
    restore_strategy_version,
)

router = APIRouter(prefix="/strategy-versions", tags=["strategy-versions"])

class RecordVersionRequest(BaseModel):
    strategy_name: str = Field(..., min_length=1, max_length=255)
    comment: str = Field("", max_length=500)
    created_by: Optional[str] = None


@router.get("")
async def get_versions(
    db: Annotated[AsyncSession, Depends(get_db)],
    strategy_name: Optional[str] = None,
    limit: int = 100,
):
    """Список версий стратегий (новые сверху). Фильтр по strategy_name."""
    items = await list_strategy_versions(db, strategy_name=strategy_name, limit=min(limit, 500))
    return {"status": "success", "data": items}


@router.get("/{version_id}/source")
async def get_version_source(db: Annotated[AsyncSession, Depends(get_db)], version_id: int):
    """Исходный код версии."""
    meta, source = await get_strategy_version_source(db, version_id)
    return {"status": "success", "data": {"meta": meta, "source": source}}


@router.post("")
async def record_version(
    req: RecordVersionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_operator)],
):
    """Зафиксировать текущий файл стратегии как новую версию вручную."""
    strategies_root = get_strategies_root()
    name = req.strategy_name.replace(".py", "")
    target_file = None
    import os

    for root, _, files in os.walk(strategies_root):
        if f"{name}.py" in files:
            target_file = os.path.join(root, f"{name}.py")
            break
    if target_file is None or not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail=f"Стратегия {name}.py не найдена в Strategies/")
    with open(target_file, "r", encoding="utf-8", errors="replace") as f:
        source = f.read()

    result = await record_strategy_version(
        db, name, source, created_by=req.created_by, comment=req.comment or "Ручная фиксация"
    )
    return {"status": "success", "data": result}


@router.post("/{version_id}/restore")
async def restore_version(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_operator)],
    version_id: int,
):
    """Откатить стратегию к указанной версии: файл + копии ботов + рестарт."""
    result = await restore_strategy_version(db, version_id)
    return {"status": "success", "data": result}
