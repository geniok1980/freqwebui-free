"""Add launch_checklists table for Pre-Launch Checklist (урок 22).

Revision ID: 005_launch_checklist
Revises: 004_billing_audit_logs
Create Date: 2026-07-14
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_launch_checklist"
down_revision: Union[str, None] = "004_billing_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "launch_checklists",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.String(64), nullable=False),
        sa.Column("bot_name", sa.String(100), nullable=True),
        sa.Column("is_complete", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("total_score", sa.Float(), nullable=True),
        sa.Column("decision", sa.String(32), nullable=True),
        sa.Column("state_json", sa.Text(), nullable=True),
        sa.Column("template_version", sa.String(16), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "bot_name", name="uq_checklist_user_bot"),
    )
    op.create_index("ix_launch_checklists_user_id", "launch_checklists", ["user_id"])


def downgrade() -> None:
    op.drop_table("launch_checklists")
