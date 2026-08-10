"""Redis event bus for worker/API separation.

Связывает отдельный worker-процесс (discovery/trade/log/health мониторы)
с API-процессом (HTTP + WebSocket):

- Канал `freqdash:ws` — события для WebSocket (worker → API).
- Канал `freqdash:cmd` / `freqdash:resp` — RPC-команды (API → worker):
  health_check, discovery_scan, clear_rate_limit.
- JSON-снапшоты (`freqdash:health:{bot_id}`, `freqdash:ratelimit:{bot_id}`) —
  состояние, которое API читает вместо in-memory мониторов.

Режимы (env FREQDASH_RUN_WORKERS):
- `embedded` (по умолчанию) — мониторы в API-процессе, шина не используется.
- `worker` — процесс воркера запускает мониторы, публикует в шину.
- `api` — API-процесс без мониторов: читает снапшоты, шлёт RPC, мостит WS.
"""

import asyncio
import json
import os
import uuid
from typing import Any, Awaitable, Callable, Optional

import structlog

logger = structlog.get_logger()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

WS_CHANNEL = "freqdash:ws"
CMD_CHANNEL = "freqdash:cmd"
RESP_CHANNEL = "freqdash:resp"

HEALTH_PREFIX = "freqdash:health:"
RATELIMIT_PREFIX = "freqdash:ratelimit:"
DISCOVERY_STATUS_KEY = "freqdash:discovery:status"

SNAPSHOT_TTL = 600  # секунд


def run_mode() -> str:
    """Текущий режим запуска."""
    return os.environ.get("FREQDASH_RUN_WORKERS", "embedded").strip().lower()


def is_worker() -> bool:
    return run_mode() == "worker"


def is_api_only() -> bool:
    return run_mode() == "api"


class EventBus:
    """Redis pub/sub + RPC + снапшоты."""

    def __init__(self) -> None:
        self._redis: Any = None
        self._pending: dict[str, asyncio.Future] = {}

    async def connect(self) -> None:
        if self._redis is not None:
            return
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        # Проверка соединения
        await self._redis.ping()

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    # ------------------------------------------------------------------
    # Публикация событий (worker → API для WebSocket)
    # ------------------------------------------------------------------
    async def publish_ws(self, event: dict) -> None:
        """Опубликовать WS-событие (kind: bot_update | global | portfolio)."""
        if self._redis is None:
            await self.connect()
        await self._redis.publish(WS_CHANNEL, json.dumps(event, default=str))

    # ------------------------------------------------------------------
    # RPC: API → worker
    # ------------------------------------------------------------------
    async def send_command(
        self, cmd_type: str, payload: Optional[dict] = None, timeout: float = 20.0
    ) -> Optional[dict]:
        """Отправить команду воркеру и дождаться ответа."""
        if self._redis is None:
            await self.connect()
        cmd_id = uuid.uuid4().hex
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[cmd_id] = fut
        await self._redis.publish(
            CMD_CHANNEL,
            json.dumps({"id": cmd_id, "type": cmd_type, "payload": payload or {}}),
        )
        try:
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            logger.warning("RPC timeout", cmd_type=cmd_type, cmd_id=cmd_id)
            return None
        finally:
            self._pending.pop(cmd_id, None)

    async def _listen_responses(self) -> None:
        """API: слушает ответы на RPC-команды."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(RESP_CHANNEL)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    resp = json.loads(message["data"])
                    fut = self._pending.pop(resp.get("id"), None)
                    if fut is not None and not fut.done():
                        fut.set_result(resp)
                except Exception:  # noqa: BLE001
                    continue
        finally:
            await pubsub.unsubscribe(RESP_CHANNEL)

    # ------------------------------------------------------------------
    # Worker: обработка команд
    # ------------------------------------------------------------------
    async def worker_loop(
        self,
        handlers: dict[str, Callable[[dict], Awaitable[Any]]],
    ) -> None:
        """Worker: слушает команды от API и отвечает в канал resp."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CMD_CHANNEL)
        logger.info("Worker command loop started")
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    cmd = json.loads(message["data"])
                    handler = handlers.get(cmd.get("type"))
                    if handler is None:
                        continue
                    result = await handler(cmd.get("payload") or {})
                    await self._redis.publish(
                        RESP_CHANNEL,
                        json.dumps({"id": cmd["id"], "ok": True, "data": result}, default=str),
                    )
                except Exception as e:  # noqa: BLE001
                    logger.error("Worker command error", error=str(e), exc_info=True)
                    try:
                        await self._redis.publish(
                            RESP_CHANNEL,
                            json.dumps(
                                {"id": cmd.get("id"), "ok": False, "error": str(e)},
                                default=str,
                            ),
                        )
                    except Exception:  # noqa: BLE001
                        pass
        finally:
            await pubsub.unsubscribe(CMD_CHANNEL)

    # ------------------------------------------------------------------
    # API: мост WS-событий → ws_manager
    # ------------------------------------------------------------------
    async def api_ws_bridge(self, handler: Callable[[dict], Awaitable[None]]) -> None:
        """API: слушает WS-события от воркера и передаёт в handler."""
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(WS_CHANNEL)
        logger.info("API WS bridge started")
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    event = json.loads(message["data"])
                    await handler(event)
                except Exception:  # noqa: BLE001
                    continue
        finally:
            await pubsub.unsubscribe(WS_CHANNEL)

    # ------------------------------------------------------------------
    # Снапшоты состояния (worker пишет, API читает)
    # ------------------------------------------------------------------
    async def set_snapshot(self, key: str, data: dict, ttl: int = SNAPSHOT_TTL) -> None:
        if self._redis is None:
            await self.connect()
        await self._redis.set(key, json.dumps(data, default=str), ex=ttl)

    async def get_snapshot(self, key: str) -> Optional[dict]:
        if self._redis is None:
            await self.connect()
        raw = await self._redis.get(key)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:  # noqa: BLE001
            return None

    async def get_snapshots_by_prefix(self, prefix: str) -> list[dict]:
        if self._redis is None:
            await self.connect()
        out: list[dict] = []
        async for key in self._redis.scan_iter(match=prefix + "*"):
            snap = await self.get_snapshot(key)
            if snap:
                out.append(snap)
        return out

    async def delete_key(self, key: str) -> None:
        if self._redis is None:
            await self.connect()
        await self._redis.delete(key)


# Singleton
bus = EventBus()
