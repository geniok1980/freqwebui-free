"""Модель торгового журнала (TradingJournal)."""

from datetime import date

from sqlalchemy import Boolean, Date, String, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class TradeJournal(Base):
    """Запись в торговом журнале."""

    __tablename__ = "trade_journal"

    user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    bot_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False, default="daily")
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content_md: Mapped[str | None] = mapped_column(Text)
    metrics_json: Mapped[dict | None] = mapped_column(JSONB)
    signals_json: Mapped[dict | None] = mapped_column(JSONB)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        server_default="'{}'::varchar[]",
        nullable=False,
        default=list,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<TradeJournal {self.title} [{self.entry_type}]>"
