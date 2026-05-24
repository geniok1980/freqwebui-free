"""API dependencies for authentication and authorization."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.user import User, UserRole
from src.models.tenant import Subscription, SubscriptionStatus, Tenant, TenantMembership
from src.config import settings
from src.tenancy import TenantContext, apply_tenant_search_path, set_tenant_context
from src.utils.security import TokenData, decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/token")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get the current authenticated user from JWT token.

    Args:
        token: JWT access token from Authorization header.
        db: Database session.

    Returns:
        Authenticated User object.

    Raises:
        HTTPException: If token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    token_data = TokenData.from_payload(payload)
    if token_data is None:
        raise credentials_exception

    if token_data.token_type != "access":
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if token_data.tenant_id:
        membership_result = await db.execute(
            select(TenantMembership).where(
                TenantMembership.tenant_id == token_data.tenant_id,
                TenantMembership.user_id == user.id,
            )
        )
        membership = membership_result.scalar_one_or_none()
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant membership not found",
            )

        schema_name = token_data.tenant_schema or "public"
        set_tenant_context(
            tenant_id=token_data.tenant_id,
            slug=token_data.tenant_slug,
            schema_name=schema_name,
        )
        await apply_tenant_search_path(db, schema_name)

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Verify user is active (placeholder for future deactivation logic).

    Args:
        current_user: Current authenticated user.

    Returns:
        Active user object.
    """
    # Future: Check if user is deactivated
    return current_user


def require_role(allowed_roles: list[UserRole]):
    """Create a dependency that requires specific roles.

    Args:
        allowed_roles: List of roles allowed to access the endpoint.

    Returns:
        Dependency function that validates user role.
    """

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker


# Common role dependencies
RequireAdmin = Depends(require_role([UserRole.ADMIN]))
RequireOperator = Depends(require_role([UserRole.ADMIN, UserRole.OPERATOR]))
RequireAny = Depends(get_current_active_user)

# Dependency functions for direct use in route parameters
require_admin = require_role([UserRole.ADMIN])
require_operator = require_role([UserRole.ADMIN, UserRole.OPERATOR])

# Type aliases for dependency injection
CurrentUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, RequireAdmin]
OperatorUser = Annotated[User, RequireOperator]


async def get_tenant_context(
    current_user: Annotated[User, Depends(get_current_active_user)],
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TenantContext:
    payload = decode_token(token)
    token_data = TokenData.from_payload(payload or {})
    if token_data is None or not token_data.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context required")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == token_data.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    membership_result = await db.execute(
        select(TenantMembership).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_id == current_user.id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access denied")

    return TenantContext(
        tenant_id=tenant.id,
        slug=tenant.slug,
        schema_name=tenant.schema_name,
        membership_role=membership.role,
    )


async def require_active_subscription(
    tenant_context: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TenantContext:
    if not settings.billing.enforce:
        return tenant_context
    subscription_result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant_context.tenant_id)
    )
    subscription = subscription_result.scalar_one_or_none()
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Subscription required")
    if subscription.status not in {
        SubscriptionStatus.ACTIVE.value,
        SubscriptionStatus.TRIALING.value,
    }:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Subscription inactive")
    return tenant_context
