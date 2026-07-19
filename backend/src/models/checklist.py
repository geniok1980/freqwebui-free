"""Модель чеклиста предзапуска бота (PreLaunchChecklist)."""

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class LaunchChecklist(Base):
    """Чеклист проверки перед запуском бота."""

    __tablename__ = "launch_checklists"

    user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    bot_name: Mapped[str] = mapped_column(String(200), nullable=False)
    state_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    total_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    decision: Mapped[str | None] = mapped_column(String(50))
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    template_version: Mapped[str | None] = mapped_column(String(16))

    def __repr__(self) -> str:
        return f"<LaunchChecklist {self.bot_name} score={self.total_score}>"
