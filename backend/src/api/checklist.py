"""Pre-Launch Checklist API — CRUD чеклистов (/checklists)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.checklist import LaunchChecklist
from src.schemas.checklist import (
    ChecklistCreate,
    ChecklistData,
    ChecklistListResponse,
    ChecklistResponse,
    ChecklistUpdate,
)

router = APIRouter()


def _model_to_data(cl: LaunchChecklist) -> ChecklistData:
    """Преобразовать модель в Pydantic схему."""
    return ChecklistData(
        id=cl.id,
        user_id=cl.user_id,
        bot_name=cl.bot_name,
        sections=cl.state_json or {},
        total_score=float(cl.total_score) if cl.total_score else None,
        decision=cl.decision,
        is_complete=cl.is_complete,
        template_version=cl.template_version,
        created_at=cl.created_at,
        updated_at=cl.updated_at,
    )


@router.get("", response_model=ChecklistListResponse)
async def list_checklists(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200, description="Максимальное количество"),
    offset: int = Query(0, ge=0, description="Смещение"),
) -> ChecklistListResponse:
    """Список чеклистов текущего пользователя."""
    # Фильтр по user_id из токена
    query = (
        select(LaunchChecklist)
        .where(LaunchChecklist.user_id == current_user.id)
        .order_by(LaunchChecklist.created_at.desc())
    )

    count_query = (
        select(func.count())
        .select_from(LaunchChecklist)
        .where(LaunchChecklist.user_id == current_user.id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(limit))
    items = list(result.scalars())

    return ChecklistListResponse(
        data=[_model_to_data(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ChecklistResponse, status_code=201)
async def create_checklist(
    body: ChecklistCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistResponse:
    """Создать новый чеклист."""
    checklist = LaunchChecklist(
        user_id=current_user.id,
        bot_name=body.bot_name,
        state_json=body.sections,
        total_score=body.total_score,
        decision=body.decision,
        is_complete=body.is_complete,
        template_version=None,
    )
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)
    return ChecklistResponse(data=_model_to_data(checklist))


@router.put("/{checklist_id}", response_model=ChecklistResponse)
async def update_checklist(
    checklist_id: str,
    body: ChecklistUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChecklistResponse:
    """Обновить чеклист (только свой)."""
    result = await db.execute(
        select(LaunchChecklist).where(
            LaunchChecklist.id == checklist_id,
            LaunchChecklist.user_id == current_user.id,
        )
    )
    checklist = result.scalar_one_or_none()
    if not checklist:
        raise HTTPException(status_code=404, detail="Чеклист не найден")

    update_data = body.model_dump(exclude_unset=True)
    if "sections" in update_data:
        update_data["state_json"] = update_data.pop("sections")

    for key, value in update_data.items():
        setattr(checklist, key, value)

    await db.commit()
    await db.refresh(checklist)
    return ChecklistResponse(data=_model_to_data(checklist))


@router.delete("/{checklist_id}")
async def delete_checklist(
    checklist_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Удалить чеклист (только свой)."""
    result = await db.execute(
        delete(LaunchChecklist).where(
            LaunchChecklist.id == checklist_id,
            LaunchChecklist.user_id == current_user.id,
        )
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Чеклист не найден")

    return {"status": "success", "message": "Чеклист удалён"}
