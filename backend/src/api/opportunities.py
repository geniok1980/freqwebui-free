"""API сканера возможностей: перспективные пары для торговли."""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import require_operator
from src.services.opportunity_scanner import scan_opportunities

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("")
async def get_opportunities(force: bool = False):
    """Сканер возможностей: импульс, отскок, пробой, тренд. Кэш 5 мин, force — пересканировать."""
    result = await scan_opportunities(force=force)
    if result.get("status") != "success":
        raise HTTPException(status_code=503, detail=result.get("error", "Сканер недоступен"))
    return {"status": "success", "data": result}


@router.post("/refresh")
async def refresh_opportunities(_: Annotated[object, Depends(require_operator)]):
    """Принудительно пересканировать рынок (сброс кэша)."""
    result = await scan_opportunities(force=True)
    if result.get("status") != "success":
        raise HTTPException(status_code=503, detail=result.get("error", "Сканер недоступен"))
    return {"status": "success", "data": result}
