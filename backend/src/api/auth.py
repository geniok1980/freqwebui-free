"""Authentication API routes."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.user import User, UserRole
from src.models.tenant import Plan, Subscription, Tenant, TenantMembership, SubscriptionStatus
from src.api.deps import get_current_active_user
from src.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter()


class TokenResponse(BaseModel):
    """Token response schema."""

    status: str = "success"
    data: dict


class UserResponse(BaseModel):
    """User info response schema."""

    id: str
    username: str
    role: str
    preferences: dict


class SignupRequest(BaseModel):
    username: str
    password: str
    tenant_name: str
    tenant_slug: str


class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_slug: str


def _normalize_slug(slug: str) -> str:
    value = slug.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,60}[a-z0-9]", value):
        raise HTTPException(status_code=400, detail="Invalid tenant slug")
    return value


def _schema_from_slug(slug: str) -> str:
    return f"tenant_{slug.replace('-', '_')}"


async def _build_token_payload(
    db: AsyncSession,
    user: User,
    tenant: Tenant,
) -> dict:
    membership_result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_id == user.id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=403, detail="User is not a member of this tenant")

    return {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role.value,
        "tenant_id": tenant.id,
        "tenant_slug": tenant.slug,
        "tenant_schema": tenant.schema_name,
        "membership_role": membership.role,
    }


@router.post("/token", response_model=TokenResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_tenant_slug: Annotated[str | None, Header()] = None,
) -> TokenResponse:
    """Authenticate user and return access token.

    Args:
        form_data: OAuth2 form with username and password.
        db: Database session.

    Returns:
        Token response with access and refresh tokens.

    Raises:
        HTTPException: If credentials are invalid.
    """
    tenant_slug = _normalize_slug((x_tenant_slug or "default").strip())
    tenant_result = await db.execute(select(Tenant).where(Tenant.slug == tenant_slug))
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create tokens
    token_data = await _build_token_payload(db, user, tenant)
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 3600,
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login_json(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    tenant_slug = _normalize_slug(payload.tenant_slug)
    tenant_result = await db.execute(select(Tenant).where(Tenant.slug == tenant_slug))
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_result = await db.execute(select(User).where(User.username == payload.username))
    user = user_result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token_data = await _build_token_payload(db, user, tenant)
    return TokenResponse(
        data={
            "access_token": create_access_token(token_data),
            "refresh_token": create_refresh_token(token_data),
            "token_type": "bearer",
            "expires_in": 3600,
        }
    )


@router.post("/signup", response_model=TokenResponse)
async def signup(
    payload: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    slug = _normalize_slug(payload.tenant_slug)
    schema_name = _schema_from_slug(slug)

    tenant_check = await db.execute(select(Tenant).where(Tenant.slug == slug))
    if tenant_check.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Tenant slug already exists")

    user_check = await db.execute(select(User).where(User.username == payload.username))
    if user_check.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password.strip()),
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.flush()

    tenant = Tenant(name=payload.tenant_name.strip(), slug=slug, schema_name=schema_name)
    db.add(tenant)
    await db.flush()

    db.add(
        TenantMembership(
            tenant_id=tenant.id,
            user_id=user.id,
            role="owner",
            is_default=True,
        )
    )

    starter_plan = (await db.execute(select(Plan).where(Plan.code == "starter"))).scalar_one_or_none()
    db.add(
        Subscription(
            tenant_id=tenant.id,
            plan_id=starter_plan.id if starter_plan else None,
            status=SubscriptionStatus.TRIALING.value,
        )
    )

    # Ensure tenant schema exists and has all domain tables.
    await db.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
    rows = await db.execute(
        text(
            """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('alembic_version','tenants','tenant_memberships','plans','subscriptions','billing_webhook_events')
        """
        )
    )
    for (table_name,) in rows.fetchall():
        await db.execute(
            text(
                f'CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}" (LIKE public."{table_name}" INCLUDING ALL)'
            )
        )

    token_data = await _build_token_payload(db, user, tenant)
    return TokenResponse(
        data={
            "access_token": create_access_token(token_data),
            "refresh_token": create_refresh_token(token_data),
            "token_type": "bearer",
            "expires_in": 3600,
        }
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Refresh access token using refresh token.

    Args:
        refresh_token: Valid refresh token.
        db: Database session.

    Returns:
        New token response.

    Raises:
        HTTPException: If refresh token is invalid.
    """
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Create new access token
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    token_data = await _build_token_payload(db, user, tenant)
    new_access_token = create_access_token(token_data)

    return TokenResponse(
        data={
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": 3600,
        }
    )


@router.get("/me")
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> dict:
    """Get current authenticated user information.

    This endpoint is protected and requires a valid access token.

    Returns:
        Current user information.
    """
    return {
        "status": "success",
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role.value,
            "preferences": current_user.preferences,
        },
    }
