"""Bot configuration — token & allowed users are loaded from Freqdash API."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class EnvSettings(BaseSettings):
    """Minimal env vars needed to authenticate to the Freqdash API."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    freqdash_api_url: str = "http://backend:8000/api/v1"
    freqdash_username: str = "admin"
    freqdash_password: str = "admin"
    freqdash_tenant_slug: str = "default"
    cache_ttl_seconds: int = 60


env = EnvSettings()


@dataclass
class BotSettings:
    """Runtime Telegram bot settings — loaded from API, not env."""

    bot_token: str
    allowed_user_ids: list[int] = field(default_factory=list)

    @classmethod
    def from_api_settings(cls, api_settings: dict[str, Any]) -> BotSettings:
        """Build from a raw settings dict returned by GET /settings."""
        token = api_settings.get("telegram_bot_token", "")

        raw_users = api_settings.get("telegram_allowed_users", "")
        allowed: list[int] = []
        if raw_users:
            for part in raw_users.split(","):
                part = part.strip()
                if part and part.isdigit():
                    allowed.append(int(part))

        return cls(bot_token=token, allowed_user_ids=allowed)
