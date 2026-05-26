"""Connector manager for intelligent data source selection."""

import glob
import os
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models.bot import Bot, SourceMode
from src.models.settings import SystemSetting
from src.services.connectors.api import APIConnector
from src.services.connectors.base import BaseConnector, ConnectorResult
from src.services.connectors.sqlite import SQLiteConnector
from src.services.health import health_monitor

logger = structlog.get_logger()


def find_sqlite_db(user_data_path: str) -> Optional[str]:
    """Find the Freqtrade SQLite database file.

    Freqtrade databases can have various names like:
    - tradesv3.sqlite
    - tradesv3-strategy-dryrun.sqlite
    - strategy_dryrun.sqlite

    Args:
        user_data_path: Path to user_data directory.

    Returns:
        Path to SQLite database or None if not found.
    """
    if not user_data_path or not os.path.isdir(user_data_path):
        return None

    # Try standard name first
    standard_path = os.path.join(user_data_path, "tradesv3.sqlite")
    if os.path.exists(standard_path):
        return standard_path

    # Search for any sqlite files that look like trade databases
    patterns = [
        os.path.join(user_data_path, "tradesv3*.sqlite"),
        os.path.join(user_data_path, "*.sqlite"),
        os.path.join(user_data_path, "dbs", "*.sqlite"),
        os.path.join(user_data_path, "data", "*.sqlite"),
    ]

    candidates: list[tuple[str, float]] = []

    for pattern in patterns:
        for path in glob.glob(pattern):
            # Skip archive directories
            if "/archive/" in path:
                continue
            # Get modification time for sorting
            try:
                mtime = os.path.getmtime(path)
                candidates.append((path, mtime))
            except OSError:
                pass

    if not candidates:
        return None

    # Sort by modification time (newest first) and return the most recent
    candidates.sort(key=lambda x: x[1], reverse=True)
    selected = candidates[0][0]

    logger.debug(
        "Found SQLite database",
        path=selected,
        candidates_count=len(candidates),
    )

    return selected


class ConnectorManager:
    """Manages connectors and data source selection for bots.

    Provides intelligent source selection based on:
    - User preference (manual override)
    - Health state (automatic failover)
    - Data availability
    """

    def __init__(self):
        """Initialize connector manager."""
        self._api_connectors: dict[str, APIConnector] = {}
        self._sqlite_connectors: dict[str, SQLiteConnector] = {}

    async def get_connector(
        self, bot: Bot, session: AsyncSession | None = None
    ) -> tuple[BaseConnector, SourceMode]:
        """Get the best available connector for a bot.

        Args:
            bot: Bot instance to get connector for.

        Returns:
            Tuple of (connector, actual_source_mode).
        """
        # Check manual override
        if bot.source_mode == SourceMode.API:
            connector = await self._get_api_connector(bot, session=session)
            if connector:
                return connector, SourceMode.API

        if bot.source_mode == SourceMode.SQLITE:
            connector = await self._get_sqlite_connector(bot)
            if connector:
                return connector, SourceMode.SQLITE

        # Auto mode - use health metrics to decide
        return await self._select_auto_source(bot, session=session)

    async def _select_auto_source(
        self, bot: Bot, session: AsyncSession | None = None
    ) -> tuple[BaseConnector, SourceMode]:
        """Select best source automatically based on health.

        In AUTO mode, API is preferred when available (real-time data).
        SQLite is used as a fallback when API is unavailable.

        Args:
            bot: Bot to select source for.

        Returns:
            Tuple of (connector, selected_source).
        """
        # Prefer API first in auto mode (real-time data)
        api_connector = await self._get_api_connector(bot, session=session)
        if api_connector:
            metrics = health_monitor.get_metrics(bot.id)
            api_available = metrics is None or metrics.api_available

            if api_available:
                return api_connector, SourceMode.API

            logger.debug(
                "API unhealthy, falling back to SQLite when available",
                bot_id=bot.id,
                api_error=metrics.last_api_error if metrics else None,
            )
            sqlite_connector = await self._get_sqlite_connector(bot)
            if sqlite_connector:
                return sqlite_connector, SourceMode.SQLITE
            return api_connector, SourceMode.API

        # API not available - try SQLite
        sqlite_connector = await self._get_sqlite_connector(bot)
        if sqlite_connector:
            return sqlite_connector, SourceMode.SQLITE

        # Nothing available - create a new API connector for error handling
        return await self._create_api_connector(bot, session=session), SourceMode.API

    async def _get_api_connector(
        self, bot: Bot, session: AsyncSession | None = None
    ) -> Optional[APIConnector]:
        """Get or create API connector for bot."""
        if not bot.api_url:
            return None

        if session is not None and bot.id in self._api_connectors:
            username, password = await self._load_api_credentials(session)
            existing = self._api_connectors[bot.id]
            if existing.username != username or existing.password != password:
                await existing.close()
                del self._api_connectors[bot.id]

        if bot.id not in self._api_connectors:
            self._api_connectors[bot.id] = await self._create_api_connector(
                bot, session=session
            )

        return self._api_connectors[bot.id]

    async def _load_api_credentials(
        self, session: AsyncSession
    ) -> tuple[str | None, str | None]:
        username_result = await session.execute(
            select(SystemSetting).where(SystemSetting.key == "api_username")
        )
        password_result = await session.execute(
            select(SystemSetting).where(SystemSetting.key == "api_password")
        )

        username_setting = username_result.scalar_one_or_none()
        password_setting = password_result.scalar_one_or_none()

        username = (username_setting.value or "").strip() if username_setting else ""
        password = (password_setting.value or "").strip() if password_setting else ""

        if not username:
            username = (settings.api_defaults.username or "").strip()
        if not password:
            password = (settings.api_defaults.password or "").strip()

        return (username or None, password or None)

    async def _create_api_connector(
        self, bot: Bot, session: AsyncSession | None = None
    ) -> APIConnector:
        """Create new API connector for bot."""
        if session is not None:
            username, password = await self._load_api_credentials(session)
        else:
            username = settings.api_defaults.username
            password = settings.api_defaults.password

        timeout = settings.api_defaults.timeout_seconds

        logger.debug(
            "Creating API connector",
            bot_id=bot.id,
            api_url=bot.api_url,
            username=username,
        )

        return APIConnector(
            bot_id=bot.id,
            api_url=bot.api_url or "",
            username=username,
            password=password,
            timeout=float(timeout),
        )

    async def _get_sqlite_connector(self, bot: Bot) -> Optional[SQLiteConnector]:
        """Get or create SQLite connector for bot."""
        from src.services.discovery import map_user_data_path_for_backend

        user_data_path = map_user_data_path_for_backend(bot.user_data_path)
        if not user_data_path:
            return None

        # Find the actual SQLite database file
        db_path = find_sqlite_db(user_data_path)

        if not db_path:
            logger.debug(
                "No SQLite database found",
                bot_id=bot.id,
                user_data_path=user_data_path,
            )
            return None

        if bot.id not in self._sqlite_connectors:
            self._sqlite_connectors[bot.id] = SQLiteConnector(
                bot_id=bot.id,
                db_path=db_path,
            )
            logger.info(
                "Created SQLite connector",
                bot_id=bot.id,
                db_path=db_path,
            )

        return self._sqlite_connectors[bot.id]

    async def execute_with_fallback(
        self,
        bot: Bot,
        operation: str,
        **kwargs,
    ) -> tuple[ConnectorResult, SourceMode]:
        """Execute operation with automatic fallback.

        Args:
            bot: Bot to execute operation on.
            operation: Method name to call on connector.
            **kwargs: Arguments to pass to the method.

        Returns:
            Tuple of (result, source_used).
        """
        connector, source = await self.get_connector(bot)

        # Try primary source
        method = getattr(connector, operation, None)
        if method is None:
            return ConnectorResult(
                success=False,
                error=f"Unknown operation: {operation}",
            ), source

        result = await method(**kwargs)

        if result.success:
            return result, source

        # Try fallback if primary failed
        fallback_connector = None
        fallback_source = None

        if source == SourceMode.API:
            fallback_connector = await self._get_sqlite_connector(bot)
            fallback_source = SourceMode.SQLITE
        else:
            fallback_connector = await self._get_api_connector(bot)
            fallback_source = SourceMode.API

        if fallback_connector:
            fallback_method = getattr(fallback_connector, operation, None)
            if fallback_method:
                fallback_result = await fallback_method(**kwargs)
                if fallback_result.success:
                    logger.info(
                        "Connector fallback successful",
                        bot_id=bot.id,
                        operation=operation,
                        primary_source=source.value,
                        fallback_source=fallback_source.value,
                    )
                    return fallback_result, fallback_source

        # Both failed - return original error
        return result, source

    async def close_all(self) -> None:
        """Close all connectors."""
        for connector in self._api_connectors.values():
            await connector.close()
        self._api_connectors.clear()

        for connector in self._sqlite_connectors.values():
            await connector.close()
        self._sqlite_connectors.clear()

    async def close_bot_connectors(self, bot_id: str) -> None:
        """Close connectors for a specific bot.

        Args:
            bot_id: Bot UUID.
        """
        if bot_id in self._api_connectors:
            await self._api_connectors[bot_id].close()
            del self._api_connectors[bot_id]

        if bot_id in self._sqlite_connectors:
            await self._sqlite_connectors[bot_id].close()
            del self._sqlite_connectors[bot_id]

    async def invalidate_connector(self, bot_id: str) -> None:
        """Invalidate cached connector to force recreation with new credentials.

        Args:
            bot_id: Bot UUID.
        """
        if bot_id in self._api_connectors:
            await self._api_connectors[bot_id].close()
            del self._api_connectors[bot_id]
            logger.info("Invalidated API connector", bot_id=bot_id)


# Singleton instance
connector_manager = ConnectorManager()
