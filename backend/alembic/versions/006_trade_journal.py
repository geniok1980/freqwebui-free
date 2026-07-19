"""Add trade_journal table for Trading Journal (урок 24).

Revision ID: 006_trade_journal
Revises: 005_launch_checklist
Create Date: 2026-07-14
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_trade_journal"
down_revision: Union[str, None] = "005_launch_checklist"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trade_journal",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.String(64), nullable=False, index=True),
        sa.Column("bot_id", sa.String(64), nullable=True, index=True),
        sa.Column("entry_date", sa.String(10), nullable=False, index=True),
        sa.Column("entry_type", sa.String(16), nullable=False, server_default="daily"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("metrics_json", sa.Text(), nullable=True),
        sa.Column("signals_json", sa.Text(), nullable=True),
        sa.Column("tags", sa.String(200), nullable=True),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_journal_user_date", "trade_journal", ["user_id", "entry_date"])


def downgrade() -> None:
    op.drop_table("trade_journal")
