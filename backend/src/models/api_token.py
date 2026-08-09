"""API token model — scoped access tokens for humans and agents.

Токен выдаётся один раз при создании (виден только тогда), в БД хранится
sha256-хэш. Скоупы: read (только чтение), read,write (управление ботами),
read,write,control (всё, включая force-операции).
"""

import sqlalchemy as sa
from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base

SCOPE_READ = "read"
SCOPE_WRITE = "write"
SCOPE_CONTROL = "control"
SCOPES_ALL = [SCOPE_READ, SCOPE_WRITE, SCOPE_CONTROL]

TOKEN_PREFIX = "freqdash_"


class ApiToken(Base):
    __tablename__ = "api_tokens"
    __table_args__ = {"schema": "public"}

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    token_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    scopes: Mapped[str] = mapped_column(String(50), nullable=False, default=SCOPE_READ)
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    tenant_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tenant_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tenant_schema: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_used_at: Mapped[sa.DateTime | None] = mapped_column(sa.DateTime, nullable=True)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<ApiToken {self.token_prefix} scopes={self.scopes} revoked={self.revoked}>"

    @property
    def scope_list(self) -> list[str]:
        return [s.strip() for s in (self.scopes or "").split(",") if s.strip()]

    def has_scope(self, scope: str) -> bool:
        return scope in self.scope_list

    @property
    def role_value(self) -> str:
        """Роль, соответствующая скоупам: read → readonly, +write → operator, +control → admin."""
        if self.has_scope(SCOPE_CONTROL):
            return "admin"
        if self.has_scope(SCOPE_WRITE):
            return "operator"
        return "readonly"
