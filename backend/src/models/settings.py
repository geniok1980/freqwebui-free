"""System settings model."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(String(255))
