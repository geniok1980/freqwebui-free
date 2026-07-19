"""Add SaaS tenant and billing shared tables.

Revision ID: 003
Revises: 002
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("schema_name", sa.String(length=80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("schema_name"),
        schema="public",
    )
    op.create_index("ix_public_tenants_slug", "tenants", ["slug"], unique=False, schema="public")
    op.create_index("ix_public_tenants_schema_name", "tenants", ["schema_name"], unique=False, schema="public")

    op.create_table(
        "tenant_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["public.users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "user_id", name="uq_tenant_membership_tenant_user"),
        schema="public",
    )
    op.create_index(
        "ix_public_tenant_memberships_tenant_id",
        "tenant_memberships",
        ["tenant_id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_public_tenant_memberships_user_id",
        "tenant_memberships",
        ["user_id"],
        unique=False,
        schema="public",
    )

    op.create_table(
        "plans",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("price_monthly_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stripe_price_id", sa.String(length=120), nullable=True),
        sa.Column("limits", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code"),
        schema="public",
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="trialing"),
        sa.Column("stripe_customer_id", sa.String(length=120), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=120), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(), nullable=True),
        sa.Column("current_period_end", sa.DateTime(), nullable=True),
        sa.Column("canceled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["public.plans.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("tenant_id"),
        sa.UniqueConstraint("stripe_subscription_id"),
        schema="public",
    )

    op.create_table(
        "billing_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("stripe_event_id", sa.String(length=120), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("stripe_event_id"),
        schema="public",
    )

    op.execute(
        """
        INSERT INTO public.plans (id, code, name, price_monthly_cents, limits, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'starter', 'Starter', 0, '{"max_bots": 3, "max_members": 1}'::jsonb, now(), now()),
          (gen_random_uuid(), 'pro', 'Pro', 4900, '{"max_bots": 25, "max_members": 5}'::jsonb, now(), now()),
          (gen_random_uuid(), 'enterprise', 'Enterprise', 19900, '{"max_bots": 1000, "max_members": 100}'::jsonb, now(), now())
        ON CONFLICT (code) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO public.tenants (id, name, slug, schema_name, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Default Tenant', 'default', 'public', true, now(), now())
        ON CONFLICT (slug) DO NOTHING
        """
    )

    op.execute(
        """
        INSERT INTO public.tenant_memberships (id, tenant_id, user_id, role, is_default, created_at, updated_at)
        SELECT gen_random_uuid(), t.id, u.id, 'owner', true, now(), now()
        FROM public.tenants t
        JOIN public.users u ON 1=1
        WHERE t.slug = 'default'
          AND NOT EXISTS (
            SELECT 1 FROM public.tenant_memberships m
            WHERE m.tenant_id = t.id AND m.user_id = u.id
          )
        """
    )


def downgrade() -> None:
    op.drop_table("billing_webhook_events", schema="public")
    op.drop_table("subscriptions", schema="public")
    op.drop_table("plans", schema="public")
    op.drop_index("ix_public_tenant_memberships_user_id", table_name="tenant_memberships", schema="public")
    op.drop_index("ix_public_tenant_memberships_tenant_id", table_name="tenant_memberships", schema="public")
    op.drop_table("tenant_memberships", schema="public")
    op.drop_index("ix_public_tenants_schema_name", table_name="tenants", schema="public")
    op.drop_index("ix_public_tenants_slug", table_name="tenants", schema="public")
    op.drop_table("tenants", schema="public")
