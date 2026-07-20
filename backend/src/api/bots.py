"""Bot management API endpoints."""

from datetime import datetime, timezone


def utc_naive_now() -> datetime:
    """UTC timestamp without tzinfo (safe for TIMESTAMP WITHOUT TIME ZONE columns)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
import asyncio
import json
import os
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser
from src.models import get_db
from src.models.bot import Bot, BotEnvironment, HealthState, SourceMode
from src.schemas.bot import (
    BotCredentialsRequest,
    BotCredentialsResponse,
    BotDetailData,
    BotDetailResponse,
    BotHealthData,
    BotHealthResponse,
    BotListResponse,
    BotMetricsData,
    BotMetricsResponse,
    BotResponse,
    BotUpdateRequest,
)
from src.schemas.common import MessageResponse
from src.services.connectors.manager import connector_manager
from src.services.health import health_monitor
from src.services.cache import cache, bot_metrics_key, bot_health_key

router = APIRouter()

_DOCKER_CONFIG_CANDIDATES: list[str] = [
    "/freqtrade/user_data/config.json",
    "/freqtrade/user_data/config/config.json",
    "/freqtrade/user_data/configs/config.json",
]


class BotConfigUpdateRequest(BaseModel):
    config: dict


class BotDeployRequest(BaseModel):
    name: str
    strategy_name: str
    host_port: int = 8081
    dry_run: bool = True


async def _run_cmd(cmd: list[str], stdin: bytes | None = None, timeout: int = 20) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE if stdin is not None else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(input=stdin), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise
    return proc.returncode or 0, (stdout or b"").decode(errors="replace"), (stderr or b"").decode(errors="replace")


async def _docker_exec(container_id: str, args: list[str], stdin: bytes | None = None, timeout: int = 20) -> tuple[int, str, str]:
    return await _run_cmd(["docker", "exec", *([] if stdin is None else ["-i"]), container_id, *args], stdin=stdin, timeout=timeout)


async def _docker_find_config_path(container_id: str) -> str:
    for p in _DOCKER_CONFIG_CANDIDATES:
        code, _, _ = await _docker_exec(container_id, ["test", "-f", p])
        if code == 0:
            return p

    code, _, err = await _docker_exec(container_id, ["sh", "-c", "ls -la /freqtrade/user_data || true"], timeout=10)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Config file not found in container. Tried: {', '.join(_DOCKER_CONFIG_CANDIDATES)}. {err}".strip(),
    )


async def _read_bot_config(bot: Bot) -> tuple[str | None, dict]:
    if bot.environment == BotEnvironment.DOCKER and bot.container_id:
        path = await _docker_find_config_path(bot.container_id)
        code, out, err = await _docker_exec(bot.container_id, ["cat", path], timeout=20)
        if code != 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to read config: {err}".strip())
        try:
            return path, json.loads(out)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Invalid JSON in config: {e}")

    candidates: list[str] = []
    if bot.user_data_path:
        candidates.extend(
            [
                os.path.join(bot.user_data_path, "config.json"),
                os.path.join(bot.user_data_path, "config", "config.json"),
                os.path.join(bot.user_data_path, "configs", "config.json"),
            ]
        )
    for p in candidates:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return p, json.load(f)
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to read config file: {e}")

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config file not found for this bot")


async def _write_bot_config(bot: Bot, config: dict) -> str:
    payload = json.dumps(config, ensure_ascii=False, indent=2).encode("utf-8") + b"\n"
    if len(payload) > 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Config too large (max 1MB)")

    if bot.environment == BotEnvironment.DOCKER and bot.container_id:
        path = await _docker_find_config_path(bot.container_id)
        code, _, err = await _docker_exec(bot.container_id, ["sh", "-c", 'cat > "$1"', "_", path], stdin=payload, timeout=20)
        if code != 0:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to write config: {err}".strip())
        return path

    if bot.user_data_path:
        candidates = [
            os.path.join(bot.user_data_path, "config.json"),
            os.path.join(bot.user_data_path, "config", "config.json"),
            os.path.join(bot.user_data_path, "configs", "config.json"),
        ]
        for p in candidates:
            if p and os.path.exists(os.path.dirname(p)):
                try:
                    with open(p, "wb") as f:
                        f.write(payload)
                    return p
                except Exception as e:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to write config file: {e}")

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bot config is not writable (missing container_id or user_data_path)")


def _dt_to_iso_z(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _sanitize_bot_name(raw: str) -> str:
    name = (raw or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bot name is required")
    if len(name) > 40:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bot name is too long (max 40 chars)")
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]*", name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid bot name. Use letters, digits, '-' and '_' only (must start with letter/digit).",
        )
    return name


def _get_strategies_root() -> str:
    env_path = os.getenv("STRATEGIES_PATH") or os.getenv("DASHBOARD_STRATEGIES_PATH")
    candidates = [
        env_path,
        "/opt/Multibotdashboard/Strategies",
        "/app/Strategies",
        "/opt/MultibotdashboardV5/Strategies",
    ]
    for p in candidates:
        if p and os.path.isdir(p):
            return p
    return "/opt/Multibotdashboard/Strategies"


def _find_strategy_file(strategy_name: str) -> str:
    strategies_root = _get_strategies_root()
    target = f"{strategy_name}.py"
    for root, _, files in os.walk(strategies_root):
        if target in files:
            return os.path.join(root, target)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Strategy file not found: {target}")


def _detect_strategy_class(source_code: str, fallback: str) -> str:
    m = re.search(r"class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*IStrategy\s*\)\s*:", source_code)
    if m:
        return m.group(1)
    return fallback


async def _docker_container_exists(name: str) -> bool:
    code, out, _ = await _run_cmd(["docker", "ps", "-a", "--filter", f"name=^{name}$", "--format", "{{.Names}}"], timeout=10)
    if code != 0:
        return False
    return any(line.strip() == name for line in out.splitlines())


async def _get_freqtrade_image() -> str:
    code, out, _ = await _run_cmd(["docker", "inspect", "freqtrade-bot1", "--format", "{{.Config.Image}}"], timeout=10)
    if code == 0 and out.strip():
        return out.strip()
    return os.getenv("FREQTRADE_DOCKER_IMAGE") or "freqtradeorg/freqtrade:stable"


async def _get_host_user_data_root() -> str:
    fmt = "{{range .Mounts}}{{if eq .Destination \"/freqtrade/user_data\"}}{{.Source}}{{end}}{{end}}"
    code, out, err = await _run_cmd(["docker", "inspect", "freqtrade-bot1", "--format", fmt], timeout=10)
    if code != 0 or not out.strip():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to resolve host user_data path from freqtrade-bot1. {err}".strip(),
        )
    source = out.strip().replace("\\", "/")
    return os.path.dirname(source)


def _get_backend_secrets_root() -> str:
    return os.getenv("FREQTRADE_SECRETS_PATH") or "/opt/freqtrade_secrets"


def _build_default_config(template: dict, *, bot_name: str, strategy_class: str, host_port: int, dry_run: bool) -> dict:
    cfg = json.loads(json.dumps(template))
    cfg["bot_name"] = bot_name
    cfg["strategy"] = strategy_class
    cfg["dry_run"] = bool(dry_run)
    cfg["db_url"] = "sqlite:///user_data/tradesv3.sqlite"
    if isinstance(cfg.get("api_server"), dict):
        cfg["api_server"]["enabled"] = True
        cfg["api_server"]["listen_ip_address"] = "0.0.0.0"
        cfg["api_server"]["listen_port"] = 8080
        if "jwt_secret_key" in cfg["api_server"]:
            cfg["api_server"]["jwt_secret_key"] = f"dev-{bot_name}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        if "ws_token" in cfg["api_server"]:
            cfg["api_server"]["ws_token"] = f"dev-{bot_name}-ws-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    cfg["strategy_path"] = "user_data/strategies"
    cfg["initial_state"] = "running"

    return cfg


def _load_template_config() -> dict:
    backend_root = _get_backend_secrets_root()
    candidates = [
        os.path.join(backend_root, "bot1", "config.json"),
        os.path.join(backend_root, "ftbot1", "config.json"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    return {
        "dry_run": True,
        "dry_run_wallet": 1000,
        "max_open_trades": 1,
        "stake_currency": "USDT",
        "stake_amount": 10,
        "timeframe": "5m",
        "trading_mode": "spot",
        "exchange": {"name": "binance", "key": "", "secret": "", "pair_whitelist": ["BTC/USDT"], "pair_blacklist": []},
        "pairlists": [{"method": "StaticPairList"}],
        "api_server": {"enabled": True, "listen_ip_address": "0.0.0.0", "listen_port": 8080, "username": "freqtrader", "password": "freqtrader"},
        "bot_name": "ftbot",
        "db_url": "sqlite:///user_data/tradesv3.sqlite",
        "strategy": "SampleStrategy",
        "strategy_path": "user_data/strategies",
        "initial_state": "running",
    }


@router.get("/search", response_model=BotListResponse)
async def search_bots(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
) -> BotListResponse:
    """Search bots by name, exchange, or strategy.

    Args:
        q: Search query string.
        limit: Maximum number of results to return.

    Returns:
        List of bots matching the search query.
    """
    # Case-insensitive search across name, exchange, and strategy
    search_term = f"%{q.lower()}%"

    result = await db.execute(
        select(Bot)
        .where(
            (Bot.name.ilike(search_term))
            | (Bot.exchange.ilike(search_term))
            | (Bot.strategy.ilike(search_term))
        )
        .order_by(Bot.name)
        .limit(limit)
    )
    all_bots = list(result.scalars())

    bots = [BotResponse.model_validate(bot) for bot in all_bots]

    return BotListResponse(data=bots)


@router.get("", response_model=BotListResponse)
async def list_bots(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    environment: Optional[BotEnvironment] = Query(None, description="Filter by environment"),
    health_state: Optional[HealthState] = Query(None, description="Filter by health state"),
    exchange: Optional[str] = Query(None, description="Filter by exchange"),
    strategy: Optional[str] = Query(None, description="Filter by strategy"),
    tags: Optional[list[str]] = Query(None, description="Filter by tags"),
) -> BotListResponse:
    """List all registered bots with optional filtering.

    Args:
        environment: Filter by deployment environment (docker, baremetal, etc.)
        health_state: Filter by health state (healthy, degraded, unreachable)
        exchange: Filter by exchange name
        strategy: Filter by strategy name
        tags: Filter by tags (any match)

    Returns:
        List of bots matching filters.
    """
    query = select(Bot)

    # Apply filters
    if environment:
        query = query.where(Bot.environment == environment)
    if health_state:
        query = query.where(Bot.health_state == health_state)
    if exchange:
        query = query.where(Bot.exchange == exchange)
    if strategy:
        query = query.where(Bot.strategy == strategy)

    result = await db.execute(query.order_by(Bot.name))
    all_bots = list(result.scalars())

    # Filter by tags in Python (JSON doesn't support overlap in SQLite)
    if tags:
        all_bots = [bot for bot in all_bots if any(tag in bot.tags for tag in tags)]

    bots = [BotResponse.model_validate(bot) for bot in all_bots]

    return BotListResponse(data=bots)


@router.post("/deploy", response_model=BotDetailResponse)
async def deploy_docker_bot(
    request: BotDeployRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BotDetailResponse:
    if current_user.role.value not in {"admin", "operator"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    bot_name = _sanitize_bot_name(request.name)
    if request.host_port < 1024 or request.host_port > 65535:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid host_port")

    existing = await db.execute(select(Bot).where(Bot.name == bot_name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bot with this name already exists")

    container_name = f"freqtrade-{bot_name}"
    if await _docker_container_exists(container_name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Docker container already exists: {container_name}")

    strategy_file = _find_strategy_file(request.strategy_name)
    with open(strategy_file, "r", encoding="utf-8", errors="replace") as f:
        source = f.read()
    strategy_class = _detect_strategy_class(source, request.strategy_name)

    backend_secrets_root = _get_backend_secrets_root()
    host_user_data_root = await _get_host_user_data_root()

    backend_bot_dir = os.path.join(backend_secrets_root, bot_name)
    backend_strategies_dir = os.path.join(backend_bot_dir, "strategies")
    os.makedirs(backend_strategies_dir, exist_ok=True)

    template = _load_template_config()
    cfg = _build_default_config(
        template,
        bot_name=bot_name,
        strategy_class=strategy_class,
        host_port=request.host_port,
        dry_run=request.dry_run,
    )
    config_path = os.path.join(backend_bot_dir, "config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")

    strategy_dst = os.path.join(backend_strategies_dir, os.path.basename(strategy_file))
    with open(strategy_dst, "w", encoding="utf-8") as f:
        f.write(source)

    host_bot_dir = f"{host_user_data_root}/{bot_name}"

    image = await _get_freqtrade_image()
    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        container_name,
        "--restart",
        "unless-stopped",
        "--label",
        f"com.freqtrade.bot_name={bot_name}",
        "--label",
        f"com.freqtrade.strategy={strategy_class}",
        "-p",
        f"{request.host_port}:8080",
        "-v",
        f"{host_bot_dir}:/freqtrade/user_data",
        image,
        "trade",
        "--config",
        "/freqtrade/user_data/config.json",
        "--strategy",
        strategy_class,
    ]

    code, out, err = await _run_cmd(cmd, timeout=30)
    if code != 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to start container: {err}".strip())
    container_id = out.strip()

    api_url = f"http://localhost:{request.host_port}"
    new_bot = Bot(
        name=bot_name,
        environment=BotEnvironment.DOCKER,
        host="localhost",
        container_id=container_id,
        user_data_path=backend_bot_dir,
        api_url=api_url,
        api_port=request.host_port,
        exchange=(cfg.get("exchange") or {}).get("name"),
        strategy=strategy_class,
        is_dryrun=bool(cfg.get("dry_run", True)),
        health_state=HealthState.UNKNOWN,
        source_mode=SourceMode.AUTO,
        last_seen=utc_naive_now(),
        discovered_at=utc_naive_now(),
        tags=[],
    )
    db.add(new_bot)
    await db.commit()
    await db.refresh(new_bot)

    try:
        await health_monitor.trigger_check(new_bot.id)
    except Exception:
        pass

    return BotDetailResponse(
        data=BotDetailData(
            id=new_bot.id,
            name=new_bot.name,
            environment=new_bot.environment,
            host=new_bot.host,
            api_url=new_bot.api_url,
            health_state=new_bot.health_state,
            source_mode=new_bot.source_mode,
            exchange=new_bot.exchange,
            strategy=new_bot.strategy,
            trading_mode=new_bot.trading_mode,
            is_dryrun=new_bot.is_dryrun,
            tags=new_bot.tags,
            last_seen=new_bot.last_seen,
            container_id=new_bot.container_id,
            user_data_path=new_bot.user_data_path,
            discovered_at=new_bot.discovered_at,
            created_at=new_bot.created_at,
        )
    )


@router.get("/{bot_id}", response_model=BotDetailResponse)
async def get_bot(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BotDetailResponse:
    """Get detailed information about a specific bot.

    Args:
        bot_id: Bot UUID.

    Returns:
        Detailed bot information including connection details.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    return BotDetailResponse(
        data=BotDetailData(
            id=bot.id,
            name=bot.name,
            environment=bot.environment,
            host=bot.host,
            api_url=bot.api_url,
            health_state=bot.health_state,
            source_mode=bot.source_mode,
            exchange=bot.exchange,
            strategy=bot.strategy,
            trading_mode=bot.trading_mode,
            is_dryrun=bot.is_dryrun,
            tags=bot.tags,
            last_seen=bot.last_seen,
            container_id=bot.container_id,
            user_data_path=bot.user_data_path,
            discovered_at=bot.discovered_at,
            created_at=bot.created_at,
        )
    )


@router.patch("/{bot_id}", response_model=BotDetailResponse)
async def update_bot(
    bot_id: str,
    update: BotUpdateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BotDetailResponse:
    """Update bot settings.

    Args:
        bot_id: Bot UUID.
        update: Fields to update.

    Returns:
        Updated bot information.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Apply updates
    if update.name is not None:
        bot.name = update.name
    if update.tags is not None:
        bot.tags = update.tags
    if update.source_mode is not None:
        bot.source_mode = update.source_mode

    await db.commit()
    await db.refresh(bot)

    return BotDetailResponse(
        data=BotDetailData(
            id=bot.id,
            name=bot.name,
            environment=bot.environment,
            host=bot.host,
            api_url=bot.api_url,
            health_state=bot.health_state,
            source_mode=bot.source_mode,
            exchange=bot.exchange,
            strategy=bot.strategy,
            trading_mode=bot.trading_mode,
            is_dryrun=bot.is_dryrun,
            tags=bot.tags,
            last_seen=bot.last_seen,
            container_id=bot.container_id,
            user_data_path=bot.user_data_path,
            discovered_at=bot.discovered_at,
            created_at=bot.created_at,
        )
    )


@router.get("/{bot_id}/config")
async def get_bot_config(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if current_user.role.value not in {"admin", "operator"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    path, cfg = await _read_bot_config(bot)
    return {"status": "success", "data": {"path": path, "config": cfg}}


@router.put("/{bot_id}/config")
async def update_bot_config_file(
    bot_id: str,
    payload: BotConfigUpdateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if current_user.role.value not in {"admin", "operator"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()
    if bot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")

    path = await _write_bot_config(bot, payload.config)
    return {"status": "success", "data": {"path": path}}


@router.put("/{bot_id}/credentials", response_model=BotCredentialsResponse)
async def update_bot_credentials(
    bot_id: str,
    request: BotCredentialsRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BotCredentialsResponse:
    """Update API credentials for a bot.

    Updates the username/password used to authenticate with the bot's API.
    After updating, tests the connection to verify the credentials work.

    Args:
        bot_id: Bot UUID.
        request: New credentials.

    Returns:
        Success status and whether API is now available.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.api_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot has no API URL configured",
        )

    # Store credentials (encrypted) - for now just test connection
    from src.services.connectors.api import APIConnector

    connector = APIConnector(
        bot_id=bot.id,
        api_url=bot.api_url,
        username=request.username,
        password=request.password,
    )

    try:
        # Test the connection with new credentials
        health_result = await connector.check_health()
        api_available = health_result.success

        if api_available:
            # Update bot health state
            bot.health_state = HealthState.HEALTHY
            bot.last_seen = utc_naive_now()
            await db.commit()

            # Invalidate cached connector so it gets recreated with new creds
            await connector_manager.invalidate_connector(bot.id)

            # TODO: Store encrypted credentials in bot.credentials_enc
            # For now, credentials need to be stored in config

            return BotCredentialsResponse(
                message="Credentials verified successfully. API connection restored.",
                api_available=True,
            )
        else:
            return BotCredentialsResponse(
                status="error",
                message=f"Credentials rejected: {health_result.error}",
                api_available=False,
            )
    finally:
        await connector.close()


@router.delete("/{bot_id}", response_model=MessageResponse)
async def delete_bot(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Remove a bot from the dashboard.

    This does not stop or affect the actual bot - it only removes it
    from dashboard monitoring. The bot may be rediscovered on next scan.

    Args:
        bot_id: Bot UUID.

    Returns:
        Success message.

    Raises:
        404: Bot not found.
    """
    from sqlalchemy import delete
    from src.models.metrics import BotMetrics
    
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    bot_name = bot.name
    
    # FIX: Delete related metrics first to avoid FK constraint errors
    await db.execute(delete(BotMetrics).where(BotMetrics.bot_id == bot_id))
    
    # Clear cache entries
    cache.delete(bot_health_key(bot_id))
    cache.delete(bot_metrics_key(bot_id))
    
    # Now delete the bot
    await db.delete(bot)
    await db.commit()

    return MessageResponse(message=f"Bot '{bot_name}' removed from dashboard")


@router.get("/{bot_id}/metrics", response_model=BotMetricsResponse)
async def get_bot_metrics(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    bypass_cache: bool = Query(False, description="Bypass cache and fetch fresh data"),
) -> BotMetricsResponse:
    """Get current metrics for a bot.

    Fetches real-time profit, balance, and trade metrics using
    the best available data source (API or SQLite).

    Args:
        bot_id: Bot UUID.
        bypass_cache: If True, fetch fresh data ignoring cache.

    Returns:
        Current bot metrics with source indicator.

    Raises:
        404: Bot not found.
    """
    # Check cache first (unless bypassed)
    cache_key = bot_metrics_key(bot_id)
    if not bypass_cache:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return BotMetricsResponse(data=cached_data)

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Get connector and fetch metrics
    connector, source = await connector_manager.get_connector(bot, session=db)

    profit_result = await connector.get_profit()
    balance_result = await connector.get_balance()
    open_trades_result = await connector.get_open_trades()

    # Calculate win rate
    win_rate = None
    if profit_result.success and profit_result.data:
        profit = profit_result.data
        total_closed = profit.winning_trades + profit.losing_trades
        if total_closed > 0:
            win_rate = profit.winning_trades / total_closed

    # Build metrics data
    balance_value = None
    if balance_result.success and balance_result.data:
        balance_value = balance_result.data.stake_currency_balance
        if not balance_value:
            balance_value = balance_result.data.used

    metrics_data = BotMetricsData(
        bot_id=bot.id,
        timestamp=datetime.now(timezone.utc),
        profit_abs=profit_result.data.profit_all_coin if profit_result.success else None,
        profit_pct=profit_result.data.profit_all_percent if profit_result.success else None,
        profit_realized=profit_result.data.profit_closed_coin if profit_result.success else None,
        profit_unrealized=(
            profit_result.data.profit_all_coin - profit_result.data.profit_closed_coin
            if profit_result.success else None
        ),
        open_positions=len(open_trades_result.data) if open_trades_result.success else 0,
        closed_trades=profit_result.data.closed_trade_count if profit_result.success else 0,
        win_rate=win_rate,
        balance=balance_value,
        data_source=source,
        health_state=bot.health_state,
    )

    # Cache the metrics for 30 seconds
    cache.set(cache_key, metrics_data, ttl_seconds=30)

    return BotMetricsResponse(data=metrics_data)


@router.get("/{bot_id}/health", response_model=BotHealthResponse)
async def get_bot_health(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    bypass_cache: bool = Query(False, description="Bypass cache and fetch fresh data"),
) -> BotHealthResponse:
    """Get health status for a bot.

    Returns detailed health metrics including API/SQLite availability,
    success rates, and latency information.

    Args:
        bot_id: Bot UUID.
        bypass_cache: If True, fetch fresh data ignoring cache.

    Returns:
        Bot health status with data source metrics.

    Raises:
        404: Bot not found.
    """
    # Check cache first (unless bypassed)
    cache_key = bot_health_key(bot_id)
    if not bypass_cache:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return BotHealthResponse(data=cached_data)

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Get health metrics
    metrics = health_monitor.get_metrics(bot_id)

    # Determine active source
    _, active_source = await connector_manager.get_connector(bot, session=db)

    if metrics:
        health_data = BotHealthData(
            bot_id=bot.id,
            health_state=bot.health_state,
            source_mode=bot.source_mode,
            active_source=active_source,
            api_available=bool(bot.api_url) and metrics.api_success_rate > 0,
            sqlite_available=bool(bot.user_data_path) and metrics.sqlite_success_rate > 0,
            api_success_rate=metrics.api_success_rate,
            sqlite_success_rate=metrics.sqlite_success_rate,
            api_avg_latency_ms=metrics.api_avg_latency,
            sqlite_avg_latency_ms=metrics.sqlite_avg_latency,
            last_check=metrics.last_check,
            state_changed_at=metrics.state_changed_at,
        )
    else:
        # No metrics yet - return defaults
        health_data = BotHealthData(
            bot_id=bot.id,
            health_state=bot.health_state,
            source_mode=bot.source_mode,
            active_source=active_source,
            api_available=bool(bot.api_url),
            sqlite_available=bool(bot.user_data_path),
            api_success_rate=0.0,
            sqlite_success_rate=0.0,
            api_avg_latency_ms=0.0,
            sqlite_avg_latency_ms=0.0,
        )

    # Cache the health data for 15 seconds (shorter than metrics since health can change faster)
    cache.set(cache_key, health_data, ttl_seconds=15)

    return BotHealthResponse(data=health_data)


@router.post("/{bot_id}/health/check", response_model=BotHealthResponse)
async def trigger_health_check(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BotHealthResponse:
    """Trigger an immediate health check for a bot.

    Forces a health check regardless of the scheduled interval.

    Args:
        bot_id: Bot UUID.

    Returns:
        Updated bot health status.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Invalidate cached data for this bot
    cache.delete(bot_health_key(bot_id))
    cache.delete(bot_metrics_key(bot_id))

    # Trigger immediate check
    metrics = await health_monitor.trigger_check(bot_id)

    # Refresh bot to get updated state
    await db.refresh(bot)

    _, active_source = await connector_manager.get_connector(bot, session=db)

    if metrics:
        return BotHealthResponse(
            data=BotHealthData(
                bot_id=bot.id,
                health_state=bot.health_state,
                source_mode=bot.source_mode,
                active_source=active_source,
                api_available=bool(bot.api_url) and metrics.api_success_rate > 0,
                sqlite_available=bool(bot.user_data_path) and metrics.sqlite_success_rate > 0,
                api_success_rate=metrics.api_success_rate,
                sqlite_success_rate=metrics.sqlite_success_rate,
                api_avg_latency_ms=metrics.api_avg_latency,
                sqlite_avg_latency_ms=metrics.sqlite_avg_latency,
                last_check=metrics.last_check,
                state_changed_at=metrics.state_changed_at,
            )
        )

    return BotHealthResponse(
        data=BotHealthData(
            bot_id=bot.id,
            health_state=bot.health_state,
            source_mode=bot.source_mode,
            active_source=active_source,
            api_available=bool(bot.api_url),
            sqlite_available=bool(bot.user_data_path),
            api_success_rate=0.0,
            sqlite_success_rate=0.0,
            api_avg_latency_ms=0.0,
            sqlite_avg_latency_ms=0.0,
        )
    )


@router.get("/{bot_id}/trades")
async def get_bot_trades(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    is_open: Optional[bool] = Query(None, description="Filter by open/closed status"),
) -> dict:
    """Get trades for a bot.

    Fetches trade history using the best available data source.

    Args:
        bot_id: Bot UUID.
        is_open: Optional filter for open/closed trades.

    Returns:
        List of trades.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Get connector and fetch trades
    connector, source = await connector_manager.get_connector(bot, session=db)

    if is_open is True:
        trades_result = await connector.get_open_trades()
    elif is_open is False:
        trades_result = await connector.get_closed_trades()
    else:
        # Get both and combine
        open_result = await connector.get_open_trades()
        closed_result = await connector.get_closed_trades()

        trades = []
        if open_result.success:
            trades.extend(open_result.data)
        if closed_result.success:
            trades.extend(closed_result.data)

        return {
            "status": "success",
            "data": [
                {
                    "id": t.trade_id,
                    "pair": t.pair,
                    "is_open": t.is_open,
                    "open_date": _dt_to_iso_z(t.open_date),
                    "close_date": _dt_to_iso_z(t.close_date),
                    "open_rate": t.open_rate,
                    "close_rate": t.close_rate,
                    "amount": t.amount,
                    "stake_amount": t.stake_amount,
                    "close_profit": t.profit_ratio,
                    "close_profit_abs": t.profit_abs,
                    "enter_tag": t.enter_tag,
                    "exit_reason": t.exit_reason,
                    "leverage": t.leverage or 1.0,
                    "is_short": t.is_short or False,
                    "data_source": source.value,
                }
                for t in trades
            ],
        }

    if not trades_result.success:
        return {"status": "success", "data": []}

    return {
        "status": "success",
        "data": [
            {
                "id": t.trade_id,
                "pair": t.pair,
                "is_open": t.is_open,
                "open_date": _dt_to_iso_z(t.open_date),
                "close_date": _dt_to_iso_z(t.close_date),
                "open_rate": t.open_rate,
                "close_rate": t.close_rate,
                "amount": t.amount,
                "stake_amount": t.stake_amount,
                "close_profit": t.profit_ratio,
                "close_profit_abs": t.profit_abs,
                "enter_tag": t.enter_tag,
                "exit_reason": t.exit_reason,
                "leverage": t.leverage or 1.0,
                "is_short": t.is_short or False,
                "data_source": source.value,
            }
            for t in trades_result.data
        ],
    }


@router.get("/{bot_id}/status")
async def get_bot_status(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get Freqtrade bot running status.

    Fetches the actual running state (running/stopped) from the Freqtrade API.

    Args:
        bot_id: Bot UUID.

    Returns:
        Bot status information.

    Raises:
        404: Bot not found.
        400: Bot API not available.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.is_api_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot API is not available",
        )

    connector, _ = await connector_manager.get_connector(bot, session=db)
    status_result = await connector.get_status()

    if not status_result.success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to get bot status: {status_result.error}",
        )

    bot_status = status_result.data
    return {
        "status": "success",
        "data": {
            "state": bot_status.state,
            "strategy": bot_status.strategy,
            "exchange": bot_status.exchange,
            "trading_mode": bot_status.trading_mode,
            "is_dryrun": bot_status.is_dryrun,
            "version": bot_status.version,
        },
    }


@router.get("/{bot_id}/performance")
async def get_bot_performance(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get aggregate performance statistics for a bot.

    Calculates win rate, total profit, average duration, etc. from trade history.

    Args:
        bot_id: Bot UUID.

    Returns:
        Performance statistics.

    Raises:
        404: Bot not found.
    """
    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    # Get connector and fetch trades
    connector, source = await connector_manager.get_connector(bot, session=db)
    closed_result = await connector.get_closed_trades()

    if not closed_result.success or not closed_result.data:
        return {
            "status": "success",
            "data": {
                "total_profit": 0.0,
                "total_profit_pct": 0.0,
                "win_rate": 0.0,
                "total_trades": 0,
                "avg_duration_mins": 0.0,
            },
        }

    trades = closed_result.data
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if (t.profit_ratio or 0) > 0)
    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0.0

    total_profit = sum(t.profit_abs or 0 for t in trades)
    total_profit_pct = sum((t.profit_ratio or 0) * 100 for t in trades)

    # Calculate average duration
    durations = []
    for t in trades:
        if t.open_date and t.close_date:
            duration_mins = (t.close_date - t.open_date).total_seconds() / 60
            durations.append(duration_mins)

    avg_duration_mins = sum(durations) / len(durations) if durations else 0.0

    return {
        "status": "success",
        "data": {
            "total_profit": round(total_profit, 8),
            "total_profit_pct": round(total_profit_pct, 2),
            "win_rate": round(win_rate, 1),
            "total_trades": total_trades,
            "avg_duration_mins": round(avg_duration_mins, 1),
        },
    }


# Bot Control Endpoints

@router.post("/{bot_id}/start", response_model=MessageResponse)
async def start_bot(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Start a bot's trading.

    Requires API access and operator/admin role.

    Args:
        bot_id: Bot UUID.

    Returns:
        Success message.

    Raises:
        404: Bot not found.
        400: Bot API not available.
        403: User lacks permission.
    """
    if not current_user.can_control_bots():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to control bots",
        )

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.is_api_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot API is not available",
        )

    connector, _ = await connector_manager.get_connector(bot, session=db)

    # APIConnector has start_bot method
    from src.services.connectors.api import APIConnector
    if not isinstance(connector, APIConnector):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot control requires API connection",
        )

    api_result = await connector.start_bot()

    if not api_result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start bot: {api_result.error}",
        )

    # Invalidate cache after successful action
    cache.delete(bot_metrics_key(bot_id))
    cache.delete(bot_health_key(bot_id))

    return MessageResponse(message=f"Bot '{bot.name}' started successfully")


@router.post("/{bot_id}/stop", response_model=MessageResponse)
async def stop_bot(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Stop a bot's trading.

    Requires API access and operator/admin role.

    Args:
        bot_id: Bot UUID.

    Returns:
        Success message.
    """
    if not current_user.can_control_bots():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to control bots",
        )

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.is_api_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot API is not available",
        )

    connector, _ = await connector_manager.get_connector(bot, session=db)

    from src.services.connectors.api import APIConnector
    if not isinstance(connector, APIConnector):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot control requires API connection",
        )

    api_result = await connector.stop_bot()

    if not api_result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop bot: {api_result.error}",
        )

    # Invalidate cache after successful action
    cache.delete(bot_metrics_key(bot_id))
    cache.delete(bot_health_key(bot_id))

    return MessageResponse(message=f"Bot '{bot.name}' stopped successfully")


@router.post("/{bot_id}/reload", response_model=MessageResponse)
async def reload_bot_config(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Reload bot configuration.

    Requires API access and operator/admin role.

    Args:
        bot_id: Bot UUID.

    Returns:
        Success message.
    """
    if not current_user.can_control_bots():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to control bots",
        )

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.is_api_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot API is not available",
        )

    connector, _ = await connector_manager.get_connector(bot, session=db)

    from src.services.connectors.api import APIConnector
    if not isinstance(connector, APIConnector):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot control requires API connection",
        )

    api_result = await connector.reload_config()

    if not api_result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reload config: {api_result.error}",
        )

    # Invalidate cache after successful action
    cache.delete(bot_metrics_key(bot_id))
    cache.delete(bot_health_key(bot_id))

    return MessageResponse(message=f"Bot '{bot.name}' configuration reloaded")


@router.post("/{bot_id}/forceexit", response_model=MessageResponse)
async def force_exit_all(
    bot_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Force exit all open trades.

    Requires API access and admin role.

    Args:
        bot_id: Bot UUID.

    Returns:
        Success message.
    """
    if not current_user.can_force_exit():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can force exit trades",
        )

    result = await db.execute(select(Bot).where(Bot.id == bot_id))
    bot = result.scalar_one_or_none()

    if bot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot not found",
        )

    if not bot.is_api_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot API is not available",
        )

    connector, _ = await connector_manager.get_connector(bot, session=db)

    from src.services.connectors.api import APIConnector
    if not isinstance(connector, APIConnector):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bot control requires API connection",
        )

    api_result = await connector.force_exit()

    if not api_result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to force exit: {api_result.error}",
        )

    # Invalidate cache after successful action
    cache.delete(bot_metrics_key(bot_id))
    cache.delete(bot_health_key(bot_id))

    return MessageResponse(message=f"Force exit initiated for all trades on '{bot.name}'")
