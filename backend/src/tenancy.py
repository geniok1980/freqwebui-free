"""Tenant context helpers and schema management."""

from __future__ import annotations

import re
from contextvars import ContextVar
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_tenant_schema_ctx: ContextVar[str] = ContextVar("tenant_schema", default="public")
_tenant_id_ctx: ContextVar[str | None] = ContextVar("tenant_id", default=None)
_tenant_slug_ctx: ContextVar[str | None] = ContextVar("tenant_slug", default=None)

_VALID_SCHEMA_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


@dataclass
class TenantContext:
    tenant_id: str
    slug: str
    schema_name: str
    membership_role: str


def sanitize_schema_name(schema_name: str) -> str:
    if not _VALID_SCHEMA_RE.match(schema_name):
        raise ValueError(f"Invalid tenant schema: {schema_name}")
    return schema_name


def set_tenant_context(*, tenant_id: str | None, slug: str | None, schema_name: str) -> None:
    _tenant_id_ctx.set(tenant_id)
    _tenant_slug_ctx.set(slug)
    _tenant_schema_ctx.set(sanitize_schema_name(schema_name))


def reset_tenant_context() -> None:
    _tenant_id_ctx.set(None)
    _tenant_slug_ctx.set(None)
    _tenant_schema_ctx.set("public")


def get_current_tenant_schema() -> str:
    return _tenant_schema_ctx.get()


def get_current_tenant_id() -> str | None:
    return _tenant_id_ctx.get()


def get_current_tenant_slug() -> str | None:
    return _tenant_slug_ctx.get()


async def apply_tenant_search_path(session: AsyncSession, schema_name: str | None = None) -> None:
    tenant_schema = sanitize_schema_name(schema_name or get_current_tenant_schema())
    # Keep public as fallback for shared enums/types and shared tables.
    await session.execute(text(f"SET LOCAL search_path TO {tenant_schema}, public"))
