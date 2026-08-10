"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api import api_router
from src.api.deps import get_current_active_user, require_active_subscription
from src.config import settings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
        if settings.logging.format == "json"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Set log level
logging.basicConfig(
    level=getattr(logging, settings.logging.level.upper()),
    format="%(message)s",
)

logger = structlog.get_logger()


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown events."""
    # Startup
    logger.info("Starting Freqtrade Dashboard API", port=settings.server.port)

    # Initialize database connection
    # NOTE: Schema is managed by Alembic migrations (run in Docker CMD).
    logger.info("Database connection initialized (alembic-managed)")
    # NOTE: Admin user seeding is handled via Alembic migration 002_seed_admin.
    # No runtime user creation here (keeps startup deterministic).

    # Start discovery service
    from src.services.bus import bus, is_api_only, is_worker
    from src.services.discovery.scheduler import discovery_scheduler

    worker_mode = is_api_only()
    logger.info("Worker mode", mode=os.environ.get("FREQDASH_RUN_WORKERS", "embedded"))

    if not worker_mode:
        await discovery_scheduler.start()
        logger.info("Discovery scheduler started")

        # Start health monitoring
        from src.services.health import health_monitor

        await health_monitor.start()
        logger.info("Health monitor started")

        # Start trade monitoring for live updates
        from src.services.trade_monitor import trade_monitor

        await trade_monitor.start()
        logger.info("Trade monitor started")

        # Start log monitoring for rate limits
        from src.services.log_monitor import log_monitor

        await log_monitor.start()
        logger.info("Log monitor started")
    else:
        # API-only mode: мониторы живут в отдельном worker-процессе.
        # Подключаемся к Redis-шине: слушаем WS-события и ответы RPC.
        await bus.connect()
        from src.services.websocket import ws_manager
        from src.services.bus import bus as _bus

        async def _ws_bridge_handler(event: dict) -> None:
            """Пересылка события из Redis-шины в WebSocket-клиенты."""
            kind = event.get("kind")
            try:
                if kind == "bot_update":
                    await ws_manager.broadcast_bot_update(
                        bot_id=event.get("bot_id", ""),
                        event_type=event.get("type", "update"),
                        data=event.get("data", {}),
                    )
                elif kind == "portfolio":
                    await ws_manager.broadcast_portfolio_update(event.get("data", {}))
                else:
                    await ws_manager.broadcast(event)
            except Exception as e:  # noqa: BLE001
                logger.debug("WS bridge handler error", error=str(e))

        import asyncio as _asyncio

        _asyncio.create_task(_bus.api_ws_bridge(_ws_bridge_handler))
        logger.info("API worker bridge started (WS events + RPC responses)")

    # Start cache service
    from src.services.cache import cache

    await cache.start()
    logger.info("Cache service started")

    # Start Strategy Lab (V6) - initialize ftmanager components
    from src.api.strategy_lab import startup_strategy_lab

    await startup_strategy_lab()
    logger.info("Strategy Lab initialized")

    # Start Finance Data Collectors
    from src.services.finance_collectors import finance_scheduler

    finance_collectors_enabled = not _env_flag("DISABLE_FINANCE_COLLECTORS", False)
    if finance_collectors_enabled:
        await finance_scheduler.start()
        logger.info("Finance Data Collectors started")
    else:
        logger.info("Finance Data Collectors disabled by environment")

    yield

    # Shutdown
    logger.info("Shutting down Freqtrade Dashboard API")

    # Stop Finance Data Collectors
    if finance_collectors_enabled:
        await finance_scheduler.stop()
        logger.info("Finance Data Collectors stopped")

    # Stop Strategy Lab (V6)
    from src.api.strategy_lab import app_state

    if app_state:
        # Clean up any running workflows
        logger.info("Strategy Lab shutting down")
    logger.info("Strategy Lab stopped")

    # Stop cache service
    await cache.stop()
    logger.info("Cache service stopped")

    # Stop log monitor
    if not worker_mode:
        await log_monitor.stop()
        logger.info("Log monitor stopped")

        # Stop trade monitor
        await trade_monitor.stop()
        logger.info("Trade monitor stopped")

        # Stop health monitor
        await health_monitor.stop()
        logger.info("Health monitor stopped")

        # Stop discovery scheduler
        await discovery_scheduler.stop()
        logger.info("Discovery scheduler stopped")
    else:
        # Close Redis bus
        try:
            await bus.close()
        except Exception as e:  # noqa: BLE001
            logger.debug("Bus close error", error=str(e))
        logger.info("API worker bridge stopped")

    # Clean up connector manager
    from src.services.connectors.manager import connector_manager

    await connector_manager.close_all()

    # Clean up analytics DB
    from src.db.analytics import close_analytics_db

    await close_analytics_db()
    logger.info("Analytics DB connection closed")

    # Clean up main DB engine
    from src.models import engine

    await engine.dispose()
    logger.info("Main DB connection closed")


# Create FastAPI application
app = FastAPI(
    title="Freqtrade Multi-Bot Dashboard",
    description="API for monitoring and controlling multiple Freqtrade trading bots",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle uncaught exceptions globally."""
    logger.error(
        "Unhandled exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "error": "Internal server error",
            "data": None,
        },
    )


# Health check endpoint
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint for container orchestration."""
    return {"status": "healthy", "service": "freqtrade-dashboard"}


# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Include Strategy Lab routes (V6)
from src.api.strategy_lab import router as strategy_lab_router
app.include_router(
    strategy_lab_router,
    prefix="/api/v1",
    tags=["strategy-lab"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include Strategy Versions routes (история версий стратегий + откат)
from src.api.strategy_versions import router as strategy_versions_router
app.include_router(
    strategy_versions_router,
    prefix="/api/v1",
    tags=["strategy-versions"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include Opportunity Scanner routes (сканер возможностей)
from src.api.opportunities import router as opportunities_router
app.include_router(
    opportunities_router,
    prefix="/api/v1",
    tags=["opportunities"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include API tokens routes (scoped-токены)
from src.api.api_tokens import router as api_tokens_router
app.include_router(
    api_tokens_router,
    prefix="/api/v1",
    tags=["auth"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include FinanceData routes (AlexFinanceData integration)
from src.api.finance import router as finance_router
app.include_router(
    finance_router,
    prefix="/api/v1",
    tags=["finance"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include Agent routes (V8 Agent Strategy)
from src.api.agent import router as agent_router
app.include_router(
    agent_router,
    prefix="/api/v1",
    tags=["agent"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include WebSocket routes (directly on app, not under /api/v1)
from src.api.websocket import router as ws_router
# NOTE: WS-роутер НЕ подключается с HTTP-зависимостями (get_current_active_user/
# require_active_subscription) — они ломают WebSocket (OAuth2PasswordBearer требует
# HTTP-request). Аутентификация WS выполняется внутри эндпоинта через verify_ws_token.
app.include_router(
    ws_router,
    prefix="/api/v1",
    tags=["websocket"],
)

# Include Pairlist Selector routes
from src.api.pairlist_selector import router as pairlist_router
app.include_router(
    pairlist_router,
    prefix="/api/v1",
    tags=["pairlist-selector"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include Settings routes (OLD - disabled, using unified settings instead)
# from src.api.settings import router as settings_router
# app.include_router(settings_router, prefix="/api/v1", tags=["settings"])

# Include Unified Settings routes (at /api/v1/settings)
from src.api.unified_settings import router as unified_settings_router
app.include_router(
    unified_settings_router,
    prefix="/api/v1",
    tags=["settings"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

# Include Pairlist Results routes
from src.api.pairlist_results import router as pairlist_results_router
app.include_router(
    pairlist_results_router,
    prefix="/api/v1",
    tags=["pairlist-results"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.server.host,
        port=settings.server.port,
        workers=settings.server.workers,
        reload=True,
    )
