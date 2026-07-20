"""
Discovery orchestrator combining Docker and filesystem discovery.
V9: Added discovery_host_ip setting support
"""

from datetime import datetime, timezone


def utc_naive_now() -> datetime:
    """UTC timestamp without tzinfo (safe for TIMESTAMP WITHOUT TIME ZONE columns)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
from typing import Optional
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.bot import Bot, BotEnvironment, HealthState, SourceMode
from src.models.settings import SystemSetting
from src.services.discovery import DiscoveryResult
from src.services.discovery.docker import DockerDiscovery
from src.services.discovery.filesystem import FilesystemDiscovery
from src.services.websocket import ws_manager

logger = structlog.get_logger()


class DiscoveryOrchestrator:
    """Orchestrates bot discovery from multiple sources."""

    def __init__(self):
        """Initialize discovery orchestrator with all discovery sources."""
        self.docker_discovery = DockerDiscovery()
        self.filesystem_discovery = FilesystemDiscovery()
        self._last_scan: Optional[datetime] = None

    @property
    def last_scan(self) -> Optional[datetime]:
        """Get timestamp of last discovery scan."""
        return self._last_scan

    async def _get_discovery_host(self, db: AsyncSession) -> str:
        """Get discovery host IP from settings. Defaults to localhost."""
        from sqlalchemy import select
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == "discovery_host_ip"))
        setting = result.scalar_one_or_none()
        if setting and setting.value:
            return setting.value
        return "localhost"

    async def discover_all(self, db: AsyncSession) -> dict:
        """Run discovery across all sources and update database.

        Args:
            db: Database session for persisting results.

        Returns:
            Summary of discovery results.
        """
        logger.info("Starting discovery scan")
        self._last_scan = datetime.now(timezone.utc)

        # Get discovery host IP from settings
        discovery_host = await self._get_discovery_host(db)
        logger.info("Using discovery host", host=discovery_host)

        all_results: list[DiscoveryResult] = []

        # Run Docker discovery with host IP
        if await self.docker_discovery.is_available():
            docker_results = await self.docker_discovery.discover(host=discovery_host)
            all_results.extend(docker_results)
            logger.info("Docker discovery found bots", count=len(docker_results))

        # Run filesystem discovery
        if await self.filesystem_discovery.is_available():
            fs_results = await self.filesystem_discovery.discover()
            all_results.extend(fs_results)
            logger.info("Filesystem discovery found bots", count=len(fs_results))

        # Process results and update database
        summary = await self._process_results(db, all_results)

        logger.info(
            "Discovery scan completed",
            discovered=summary["discovered"],
            new=summary["new"],
            updated=summary["updated"],
            removed=summary["removed"],
        )

        return summary

    async def _process_results(
        self, db: AsyncSession, results: list[DiscoveryResult]
    ) -> dict:
        """Process discovery results and sync with database.

        Args:
            db: Database session.
            results: List of discovery results.

        Returns:
            Summary dict with counts.
        """
        summary = {
            "discovered": len(results),
            "new": 0,
            "updated": 0,
            "removed": 0,
            "errors": 0,
        }

        # Get existing bots for comparison
        existing_bots = await db.execute(select(Bot))
        existing_bots = existing_bots.scalars().all()
        
        # Map by container_id and api_url for deduplication
        container_map: dict[str, Bot] = {}
        url_map: dict[str, Bot] = {}
        
        for bot in existing_bots:
            if bot.container_id:
                container_map[bot.container_id] = bot
            if bot.api_url:
                url_map[bot.api_url] = bot

        # Process each discovered result
        processed_ids = set()
        
        for result in results:
            try:
                # Skip if already processed this URL
                if result.api_url and result.api_url in processed_ids:
                    continue
                if result.api_url:
                    processed_ids.add(result.api_url)

                # Check for existing bot
                existing = None
                if result.container_id and result.container_id in container_map:
                    existing = container_map[result.container_id]
                elif result.api_url and result.api_url in url_map:
                    existing = url_map[result.api_url]

                if existing:
                    # Update existing bot
                    await self._update_bot(existing, result, db)
                    summary["updated"] += 1
                else:
                    # Create new bot
                    await self._create_bot(result, db)
                    summary["new"] += 1

            except Exception as e:
                logger.error("Failed to process discovery result", error=str(e))
                summary["errors"] += 1

        # Commit all changes
        await db.commit()

        # Notify via WebSocket
        await ws_manager.broadcast({
            "type": "discovery_complete",
            "data": summary
        })

        return summary

    async def _create_bot(self, result: DiscoveryResult, db: AsyncSession) -> Bot:
        """Create a new bot from discovery result."""
        bot = Bot(
            id=str(uuid4()),
            name=result.name,
            environment=BotEnvironment(result.environment),
            host=result.host,
            container_id=result.container_id,
            user_data_path=result.user_data_path,
            api_url=result.api_url,
            api_port=result.api_port,
            exchange=result.exchange,
            strategy=result.strategy,
            is_dryrun=result.is_dryrun,
            health_state=HealthState.UNKNOWN,
            source_mode=SourceMode.AUTO,
        )
        db.add(bot)
        return bot

    async def _update_bot(self, bot: Bot, result: DiscoveryResult, db: AsyncSession) -> None:
        """Update existing bot with discovery result."""
        # Update fields that may have changed
        if result.host:
            bot.host = result.host
        if result.container_id:
            bot.container_id = result.container_id
        if result.user_data_path:
            bot.user_data_path = result.user_data_path

        # Avoid wiping previously known API URL/port when discovery couldn't extract it.
        if result.api_port is not None:
            bot.api_port = result.api_port

        if result.api_url:
            bot.api_url = result.api_url
        elif bot.api_url is None and result.host and result.api_port is not None:
            bot.api_url = f"http://{result.host}:{result.api_port}"

        if result.exchange:
            bot.exchange = result.exchange
        if result.strategy:
            bot.strategy = result.strategy

        bot.is_dryrun = result.is_dryrun
        bot.last_seen = utc_naive_now()


# Singleton instance for global access
discovery_orchestrator = DiscoveryOrchestrator()
