"""Shared tenant and billing models (public schema)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class MembershipRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class SubscriptionStatus(str, Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"


class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    schema_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("true"))


class TenantMembership(Base):
    __tablename__ = "tenant_memberships"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_tenant_membership_tenant_user"),
        {"schema": "public"},
    )

    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("public.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=MembershipRole.MEMBER.value)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("false"))


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = {"schema": "public"}

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_monthly_cents: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    stripe_price_id: Mapped[str | None] = mapped_column(String(120))
    limits: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("true"))


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = {"schema": "public"}

    tenant_id: Mapped[str] = mapped_column(
        ForeignKey("public.tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("public.plans.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SubscriptionStatus.TRIALING.value,
        index=True,
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(120), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"
    __table_args__ = {"schema": "public"}

    stripe_event_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=sa.text("false"))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))


class BillingAuditLog(Base):
    __tablename__ = "billing_audit_logs"
    __table_args__ = {"schema": "public"}

    tenant_id: Mapped[str | None] = mapped_column(
        ForeignKey("public.tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    level: Mapped[str] = mapped_column(String(20), nullable=False, server_default=sa.text("'info'"))
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
