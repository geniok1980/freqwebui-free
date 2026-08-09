"""API scoped-токенов: создание, список, отзыв.

Токен показывается один раз при создании. Скоупы: read (чтение),
read,write (управление ботами), read,write,control (всё).
"""

import hashlib
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.api_token import ApiToken, SCOPES_ALL, TOKEN_PREFIX
from src.models.user import User, UserRole
from src.tenancy import get_current_tenant_id, get_current_tenant_schema, get_current_tenant_slug

router = APIRouter(prefix="/auth/tokens", tags=["auth"])


class TokenCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    scopes: str = Field("read", description="read | read,write | read,write,control")


def _generate_token() -> str:
    return TOKEN_PREFIX + secrets.token_urlsafe(32)


@router.post("")
async def create_api_token(
    payload: TokenCreateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Создать scoped API-токен. Токен возвращается ОДИН раз."""
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create API tokens")

    scopes = ",".join(s.strip() for s in payload.scopes.split(",") if s.strip())
    for s in scopes.split(","):
        if s not in SCOPES_ALL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid scope: {s}")

    raw_token = _generate_token()
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    token = ApiToken(
        name=payload.name.strip(),
        token_hash=token_hash,
        token_prefix=raw_token[: len(TOKEN_PREFIX) + 7],
        scopes=scopes,
        created_by=current_user.username,
        tenant_id=get_current_tenant_id(),
        tenant_slug=get_current_tenant_slug(),
        tenant_schema=get_current_tenant_schema(),
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)

    return {
        "status": "success",
        "data": {
            "id": token.id,
            "name": token.name,
            "token": raw_token,
            "scopes": scopes,
            "warning": "Скопируйте токен — он больше не будет показан",
        },
    }


@router.get("")
async def list_api_tokens(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Список API-токенов (без самих токенов)."""
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can view API tokens")

    result = await db.execute(
        select(ApiToken).order_by(ApiToken.created_at.desc())
    )
    tokens = result.scalars().all()
    return {
        "status": "success",
        "data": [
            {
                "id": t.id,
                "name": t.name,
                "token_prefix": t.token_prefix,
                "scopes": t.scopes,
                "created_by": t.created_by,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
                "revoked": t.revoked,
            }
            for t in tokens
        ],
    }


@router.delete("/{token_id}")
async def revoke_api_token(
    token_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Отозвать API-токен."""
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can revoke API tokens")

    result = await db.execute(select(ApiToken).where(ApiToken.id == token_id))
    token = result.scalar_one_or_none()
    if token is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")

    token.revoked = True
    await db.commit()
    return {"status": "success", "message": f"Token '{token.name}' revoked"}
