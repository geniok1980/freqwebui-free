"""FreqDash worker process.

Отдельный процесс для long-running циклов, вынесенных из API:

- discovery_scheduler — периодический скан Docker/FS
- health_monitor — health-чеки ботов (пишет снапшоты в Redis)
- trade_monitor — live-обновления сделок
- log_monitor — детект rate limits (пишет снапшоты в Redis)

Запуск: python -m src.worker  (env FREQDASH_RUN_WORKERS=worker)
"""

import asyncio
import os

import structlog

logger = structlog.get_logger()


async def _handle_health_check(payload: dict) -> dict:
    """RPC: немедленный health-check бота."""
    from src.services.health import health_monitor

    bot_id = payload.get("bot_id")
    if not bot_id:
        return {"error": "bot_id required"}
    metrics = await health_monitor.trigger_check(bot_id)
    if metrics is None:
        return {"error": "bot not found or check failed"}
    return {
        "bot_id": bot_id,
        "api_success_rate": metrics.api_success_rate,
        "sqlite_success_rate": metrics.sqlite_success_rate,
        "api_avg_latency": metrics.api_avg_latency,
        "sqlite_avg_latency": metrics.sqlite_avg_latency,
        "last_check": metrics.last_check.isoformat() if metrics.last_check else None,
        "state_changed_at": metrics.state_changed_at.isoformat() if metrics.state_changed_at else None,
    }


async def _handle_discovery_scan(payload: dict) -> dict:
    """RPC: немедленный discovery-скан."""
    from src.services.discovery.scheduler import discovery_scheduler

    result = await discovery_scheduler.trigger_manual_scan()
    return result


async def _handle_clear_rate_limit(payload: dict) -> dict:
    """RPC: сбросить rate limit бота."""
    from src.services.log_monitor import log_monitor

    bot_id = payload.get("bot_id")
    if not bot_id:
        return {"cleared": False, "error": "bot_id required"}
    cleared = log_monitor.clear_rate_limit(bot_id)
    if cleared:
        await _publish_ws({
            "kind": "global",
            "type": "rate_limit_cleared",
            "bot_id": bot_id,
            "message": f"Rate limit cleared: {bot_id}",
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat() + "Z",
        })
    return {"cleared": cleared}


async def _publish_ws(event: dict) -> None:
    """Опубликовать WS-событие в шину."""
    from src.services.bus import bus

    try:
        await bus.publish_ws(event)
    except Exception as e:  # noqa: BLE001
        logger.debug("WS publish failed", error=str(e))


async def _ws_forwarder() -> None:
    """Пересылает WS-события мониторов в Redis-шину (worker → API).

    Мониторы вызывают ws_manager напрямую; здесь мы перехватываем их
    broadcast'ы через патч (см. _patch_ws_manager) — либо, если патч
    не применён, ничего не делаем. Патч применяется в main().
    """


def _patch_ws_manager() -> None:
    """Подменяет методы ws_manager на публикацию в Redis-шину.

    Мониторы (trade_monitor, log_monitor, health, discovery) шлют события
    через ws_manager.broadcast / broadcast_bot_update. В отдельном процессе
    ws_manager пуст — перехватываем вызовы и уводим их в шину.
    """
    from src.services import websocket as ws_mod
    from src.services.bus import bus

    async def _publish(event: dict) -> None:
        try:
            await bus.publish_ws(event)
        except Exception as e:  # noqa: BLE001
            logger.debug("WS publish failed", error=str(e))

    manager = ws_mod.ws_manager

    async def broadcast(self, message: dict) -> None:
        evt = dict(message)
        evt.setdefault("kind", "global")
        await _publish(evt)

    async def broadcast_bot_update(self, bot_id: str, event_type: str, data: dict) -> None:
        await _publish({
            "kind": "bot_update",
            "type": event_type,
            "bot_id": bot_id,
            "data": data,
            "timestamp": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat(),
        })

    async def broadcast_portfolio_update(self, data: dict) -> None:
        await _publish({
            "kind": "portfolio",
            "type": "portfolio_update",
            "data": data,
            "timestamp": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat(),
        })

    manager.broadcast = broadcast.__get__(manager)
    manager.broadcast_bot_update = broadcast_bot_update.__get__(manager)
    manager.broadcast_portfolio_update = broadcast_portfolio_update.__get__(manager)
    logger.info("ws_manager patched for Redis bus")


async def _snapshot_loop() -> None:
    """Периодически пишет снапшоты health/rate-limits в Redis."""
    from src.services.bus import HEALTH_PREFIX, RATELIMIT_PREFIX, bus
    from src.services.health import health_monitor
    from src.services.log_monitor import log_monitor

    while True:
        try:
            # Health-снапшоты
            for bot_id, metrics in list(health_monitor._metrics.items()):
                await bus.set_snapshot(
                    f"{HEALTH_PREFIX}{bot_id}",
                    {
                        "bot_id": bot_id,
                        "api_success_rate": metrics.api_success_rate,
                        "sqlite_success_rate": metrics.sqlite_success_rate,
                        "api_avg_latency": metrics.api_avg_latency,
                        "sqlite_avg_latency": metrics.sqlite_avg_latency,
                        "last_check": metrics.last_check.isoformat() if metrics.last_check else None,
                        "state_changed_at": metrics.state_changed_at.isoformat() if metrics.state_changed_at else None,
                    },
                )

            # Rate-limit снапшоты
            for rl in log_monitor.get_active_rate_limits():
                await bus.set_snapshot(f"{RATELIMIT_PREFIX}{rl['bot_id']}", rl)
        except Exception as e:  # noqa: BLE001
            logger.debug("Snapshot loop error", error=str(e))

        await asyncio.sleep(15)


async def main() -> None:
    """Запуск worker-процесса."""
    from src.services.bus import bus

    # Плагин WS: мониторы пишут в шину
    _patch_ws_manager()

    # Старт мониторов
    from src.services.discovery.scheduler import discovery_scheduler
    from src.services.health import health_monitor
    from src.services.log_monitor import log_monitor
    from src.services.trade_monitor import trade_monitor

    await discovery_scheduler.start()
    await health_monitor.start()
    await trade_monitor.start()
    await log_monitor.start()
    logger.info("All worker monitors started")

    # Команды от API
    handlers = {
        "health_check": _handle_health_check,
        "discovery_scan": _handle_discovery_scan,
        "clear_rate_limit": _handle_clear_rate_limit,
    }

    try:
        await bus.connect()
        # Снапшоты в фоне
        asyncio.create_task(_snapshot_loop())
        # RPC-обработчик
        await bus.worker_loop(handlers)
    except Exception as e:  # noqa: BLE001
        logger.error("Worker bus loop failed", error=str(e), exc_info=True)
        # Не ронять процесс при недоступном Redis — мониторы продолжают
        # работать, просто без шины/снапшотов
        while True:
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
