"""Мост между API-процессом и worker-процессом.

В режиме `embedded` API вызывает мониторы напрямую (in-memory).
В режиме `api` API читает снапшоты из Redis и шлёт RPC-команды воркеру.

Все функции асинхронные и прозрачно работают в обоих режимах.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import structlog

from src.services.bus import (
    HEALTH_PREFIX,
    RATELIMIT_PREFIX,
    bus,
    is_api_only,
)

logger = structlog.get_logger()


@dataclass
class HealthSnapshot:
    """Метрики здоровья бота, совместимые с HealthMetrics (api/bots.py)."""

    api_success_rate: float = 0.0
    sqlite_success_rate: float = 0.0
    api_avg_latency: float = 0.0
    sqlite_avg_latency: float = 0.0
    last_check: Optional[datetime] = None
    state_changed_at: Optional[datetime] = None

    @classmethod
    def from_metrics(cls, metrics) -> "HealthSnapshot":
        return cls(
            api_success_rate=metrics.api_success_rate,
            sqlite_success_rate=metrics.sqlite_success_rate,
            api_avg_latency=metrics.api_avg_latency,
            sqlite_avg_latency=metrics.sqlite_avg_latency,
            last_check=metrics.last_check,
            state_changed_at=metrics.state_changed_at,
        )

    @classmethod
    def from_dict(cls, data: dict) -> "HealthSnapshot":
        def _parse(v):
            if not v:
                return None
            try:
                return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
            except Exception:  # noqa: BLE001
                return None

        return cls(
            api_success_rate=float(data.get("api_success_rate") or 0.0),
            sqlite_success_rate=float(data.get("sqlite_success_rate") or 0.0),
            api_avg_latency=float(data.get("api_avg_latency") or 0.0),
            sqlite_avg_latency=float(data.get("sqlite_avg_latency") or 0.0),
            last_check=_parse(data.get("last_check")),
            state_changed_at=_parse(data.get("state_changed_at")),
        )

    def __bool__(self) -> bool:
        return self.last_check is not None


# ----------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------
async def get_bot_health_snapshot(bot_id: str) -> Optional[HealthSnapshot]:
    """Метрики здоровья бота (api_success_rate, латентность, ...)."""
    if not is_api_only():
        from src.services.health import health_monitor

        metrics = health_monitor.get_metrics(bot_id)
        if metrics is None:
            return None
        return HealthSnapshot.from_metrics(metrics)
    data = await bus.get_snapshot(f"{HEALTH_PREFIX}{bot_id}")
    if not data:
        return None
    return HealthSnapshot.from_dict(data)


async def trigger_health_check(bot_id: str) -> Optional[HealthSnapshot]:
    """Немедленный health-check бота, возвращает свежие метрики."""
    if not is_api_only():
        from src.services.health import health_monitor

        metrics = await health_monitor.trigger_check(bot_id)
        if metrics is None:
            return None
        return HealthSnapshot.from_metrics(metrics)
    resp = await bus.send_command("health_check", {"bot_id": bot_id}, timeout=25.0)
    if not resp or not resp.get("ok"):
        return None
    return HealthSnapshot.from_dict(resp.get("data") or {})


# ----------------------------------------------------------------------
# Rate limits
# ----------------------------------------------------------------------
async def get_active_rate_limits() -> list[dict]:
    """Активные rate limits."""
    if not is_api_only():
        from src.services.log_monitor import log_monitor

        return log_monitor.get_active_rate_limits()
    return await bus.get_snapshots_by_prefix(RATELIMIT_PREFIX)


async def clear_rate_limit(bot_id: str) -> bool:
    """Сбросить rate limit бота."""
    if not is_api_only():
        from src.services.log_monitor import log_monitor

        return log_monitor.clear_rate_limit(bot_id)
    resp = await bus.send_command("clear_rate_limit", {"bot_id": bot_id}, timeout=10.0)
    return bool(resp and resp.get("ok") and resp.get("data", {}).get("cleared"))


# ----------------------------------------------------------------------
# Discovery
# ----------------------------------------------------------------------
async def trigger_discovery_scan() -> dict:
    """Немедленный discovery-скан, возвращает summary."""
    if not is_api_only():
        from src.services.discovery.scheduler import discovery_scheduler

        return await discovery_scheduler.trigger_manual_scan()
    resp = await bus.send_command("discovery_scan", {}, timeout=30.0)
    if not resp or not resp.get("ok"):
        return {"discovered": 0, "new": 0, "updated": 0, "removed": 0, "error": "worker unavailable"}
    return resp.get("data") or {}
