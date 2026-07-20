"""Unified Settings API"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import get_db, SystemSetting
from src.api.deps import get_current_active_user

router = APIRouter(prefix="/settings/unified", dependencies=[Depends(get_current_active_user)])

DEFAULT_SETTINGS = {
    "refresh_interval": "30",
    "theme": "dark",
    "notifications_enabled": "true",
    "dashboard_layout": "grid",
    "alert_critical": "true",
    "alert_warning": "true",
    "alert_info": "false",
    "discovery_host_ip": "",
    "api_username": "",
    "api_password": "",
}

@router.get("")
async def get_all_settings(session: AsyncSession = Depends(get_db)):
    result = await session.execute(select(SystemSetting))
    db_settings = {s.key: s.value for s in result.scalars().all()}
    settings = DEFAULT_SETTINGS.copy()
    settings.update(db_settings)
    return {"settings": settings}

@router.post("/batch")
async def update_settings(settings: Dict[str, Any], session: AsyncSession = Depends(get_db)):
    for key, value in settings.items():
        result = await session.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            session.add(SystemSetting(key=key, value=str(value), description=f"Setting: {key}"))
    await session.commit()
    return {"updated": list(settings.keys())}
