"""Add billing audit logs table.

Revision ID: 004_billing_audit_logs
Revises: v6_strategy_lab
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_billing_audit_logs"
down_revision: Union[str, None] = "v6_strategy_lab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "billing_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("event_name", sa.String(length=120), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default=sa.text("'info'")),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="SET NULL"),
        schema="public",
    )
    op.create_index(
        "ix_public_billing_audit_logs_tenant_id",
        "billing_audit_logs",
        ["tenant_id"],
        unique=False,
        schema="public",
    )
    op.create_index(
        "ix_public_billing_audit_logs_event_name",
        "billing_audit_logs",
        ["event_name"],
        unique=False,
        schema="public",
    )


def downgrade() -> None:
    op.drop_index("ix_public_billing_audit_logs_event_name", table_name="billing_audit_logs", schema="public")
    op.drop_index("ix_public_billing_audit_logs_tenant_id", table_name="billing_audit_logs", schema="public")
    op.drop_table("billing_audit_logs", schema="public")

