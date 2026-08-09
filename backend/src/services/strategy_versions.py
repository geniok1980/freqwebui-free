"""Сервис истории версий стратегий: запись, список, откат.

Версия фиксируется при каждом изменении стратегии (деплой бота, загрузка
через UI). Откат восстанавливает файл в Strategies/, обновляет копии у всех
ботов, использующих эту стратегию, и перезапускает их контейнеры.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

STRATEGY_VERSIONS_TABLE = "strategy_versions"


def checksum_of(source: str) -> str:
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def get_strategies_root() -> str:
    """Путь к каталогу Strategies/ внутри контейнера backend."""
    candidates = []
    env_path = os.getenv("STRATEGIES_PATH") or os.getenv("DASHBOARD_STRATEGIES_PATH")
    if env_path:
        candidates.append(env_path)
    candidates.extend(
        [
            "/opt/Multibotdashboard/Strategies",
            "/app/Strategies",
            "/opt/MultibotdashboardV5/Strategies",
        ]
    )
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return candidates[0]


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


async def record_strategy_version(
    db: AsyncSession,
    strategy_name: str,
    source: str,
    bot_id: Optional[str] = None,
    created_by: Optional[str] = None,
    comment: Optional[str] = None,
) -> dict:
    """Сохранить новую версию стратегии. Вызывать при каждом изменении кода."""
    strategy_name = strategy_name.replace(".py", "")

    row = await db.execute(
        text(
            f"SELECT COALESCE(MAX(version), 0) FROM {STRATEGY_VERSIONS_TABLE} "
            "WHERE strategy_name = :name"
        ),
        {"name": strategy_name},
    )
    next_version = int(row.scalar() or 0) + 1

    await db.execute(
        text(
            f"INSERT INTO {STRATEGY_VERSIONS_TABLE} "
            "(strategy_name, version, source, checksum, bot_id, created_by, comment, created_at) "
            "VALUES (:name, :version, :source, :checksum, :bot_id, :created_by, :comment, NOW())"
        ),
        {
            "name": strategy_name,
            "version": next_version,
            "source": source,
            "checksum": checksum_of(source),
            "bot_id": bot_id,
            "created_by": created_by,
            "comment": comment,
        },
    )
    await db.commit()
    logger.info("Strategy version recorded: %s v%d (%s)", strategy_name, next_version, comment)
    return {"strategy_name": strategy_name, "version": next_version}


async def list_strategy_versions(
    db: AsyncSession,
    strategy_name: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Список версий, новые сверху."""
    sql = (
        f"SELECT id, strategy_name, version, bot_id, created_by, comment, created_at "
        f"FROM {STRATEGY_VERSIONS_TABLE} "
    )
    params: dict = {}
    if strategy_name:
        sql += "WHERE strategy_name = :name "
        params["name"] = strategy_name.replace(".py", "")
    sql += "ORDER BY created_at DESC, id DESC LIMIT :limit"
    params["limit"] = limit

    rows = await db.execute(text(sql), params)
    result = []
    for r in rows.fetchall():
        result.append(
            {
                "id": r.id,
                "strategy_name": r.strategy_name,
                "version": r.version,
                "bot_id": r.bot_id,
                "created_by": r.created_by,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )
    return result


async def get_strategy_version_source(db: AsyncSession, version_id: int) -> tuple[dict, str]:
    row = await db.execute(
        text(
            f"SELECT id, strategy_name, version, source, created_by, comment, created_at "
            f"FROM {STRATEGY_VERSIONS_TABLE} WHERE id = :vid"
        ),
        {"vid": version_id},
    )
    r = row.fetchone()
    if r is None:
        raise HTTPException(status_code=404, detail="Версия не найдена")
    meta = {
        "id": r.id,
        "strategy_name": r.strategy_name,
        "version": r.version,
        "created_by": r.created_by,
        "comment": r.comment,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
    return meta, r.source


async def restore_strategy_version(
    db: AsyncSession,
    version_id: int,
    created_by: Optional[str] = None,
) -> dict:
    """Откат стратегии к указанной версии.

    1. Восстанавливает файл в Strategies/<name>.py
    2. Обновляет копии у всех ботов, у которых лежит стратегия с таким именем
    3. Перезапускает контейнеры затронутых ботов
    """
    meta, source = await get_strategy_version_source(db, version_id)
    strategy_name = meta["strategy_name"]

    # 1. Файл исходника
    strategies_root = get_strategies_root()
    # ищем существующий файл (учитывая family-подкаталоги)
    target_file = None
    for root, _, files in os.walk(strategies_root):
        if f"{strategy_name}.py" in files:
            target_file = os.path.join(root, f"{strategy_name}.py")
            break
    if target_file is None:
        target_file = os.path.join(strategies_root, f"{strategy_name}.py")
    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(source)
    logger.info("Strategy %s restored from v%d -> %s", strategy_name, meta["version"], target_file)

    # 2. Копии у ботов: secrets/<bot>/strategies/<name>.py
    bot_dirs = await _find_bot_strategy_dirs(db, strategy_name)
    restarted = []
    for bot_id, strategies_dir in bot_dirs:
        dst = os.path.join(strategies_dir, f"{strategy_name}.py")
        if os.path.exists(strategies_dir):
            with open(dst, "w", encoding="utf-8") as f:
                f.write(source)
            restarted.append(bot_id)

    # 3. Перезапуск затронутых ботов
    if restarted:
        await _restart_bot_containers(db, restarted)

    # Фиксируем сам факт отката новой версией (audit-след)
    await record_strategy_version(
        db,
        strategy_name,
        source,
        bot_id=",".join(restarted) if restarted else None,
        created_by=created_by,
        comment=f"Откат к версии #{meta['version']} ({meta.get('comment') or ''})",
    )

    return {
        "strategy_name": strategy_name,
        "restored_version": meta["version"],
        "updated_bots": restarted,
        "file": target_file,
    }


async def _find_bot_strategy_dirs(db: AsyncSession, strategy_name: str) -> list[tuple[str, str]]:
    """Найти каталоги стратегий ботов, где лежит <strategy_name>.py.

    Ищем по user_data_path у ботов и сканируем secrets/<bot>/strategies/.
    """
    from src.models.bot import Bot

    rows = await db.execute(select(Bot.id, Bot.name, Bot.user_data_path, Bot.strategy))
    dirs: list[tuple[str, str]] = []
    for r in rows.fetchall():
        bot_id, name, user_data_path, strategy = r.id, r.name, r.user_data_path, r.strategy
        candidates = []
        if user_data_path:
            candidates.append(os.path.join(user_data_path, "strategies"))
            candidates.append(os.path.join(user_data_path, "strategies", f"{strategy_name}.py"))
        # secrets/<bot>/strategies
        for base in ("/app/secrets", "/opt/Multibotdashboard/secrets", "/root/freqdash/secrets"):
            candidates.append(os.path.join(base, name, "strategies"))
        for cand in candidates:
            fpath = cand if cand.endswith(".py") else os.path.join(cand, f"{strategy_name}.py")
            if os.path.exists(fpath):
                dirs.append((bot_id, os.path.dirname(fpath)))
                break
    return dirs


async def _restart_bot_containers(db: AsyncSession, bot_ids: list[str]) -> None:
    """Перезапуск контейнеров ботов (docker restart freqtrade-<name>)."""
    import asyncio

    from src.models.bot import Bot

    rows = await db.execute(select(Bot.name).where(Bot.id.in_(bot_ids)))
    names = [r.name for r in rows.fetchall()]
    for name in names:
        container = f"freqtrade-{name}"
        proc = await asyncio.create_subprocess_exec(
            "docker", "restart", container,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            logger.warning("Failed to restart %s: %s", container, err.decode()[:200])
        else:
            logger.info("Restarted bot container %s", container)
