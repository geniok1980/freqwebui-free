"""API routes and endpoints."""

from fastapi import APIRouter

from src.api.alerts import router as alerts_router
from src.api.auth import router as auth_router
from src.api.backtest import router as backtest_router
from src.api.bots import router as bots_router
from src.api.checklist import router as checklist_router
from src.api.comparison import router as comparison_router
from src.api.discovery import router as discovery_router
from src.api.historic import router as historic_router
from src.api.journal import router as journal_router
from src.api.portfolio import router as portfolio_router
from src.api.risk import router as risk_router
from src.api.scoring import router as scoring_router
from src.api.users import router as users_router
from src.api.agent import router as agent_router
from src.api.deps import require_active_subscription, get_current_active_user
from fastapi import Depends

# Main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(
    alerts_router,
    prefix="/alerts",
    tags=["alerts"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(
    backtest_router,
    prefix="/backtest",
    tags=["backtest"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    bots_router,
    prefix="/bots",
    tags=["bots"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    checklist_router,
    prefix="/checklists",
    tags=["checklists"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    comparison_router,
    prefix="/comparison",
    tags=["comparison"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    discovery_router,
    prefix="/discovery",
    tags=["discovery"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    historic_router,
    prefix="/historic",
    tags=["historic"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    journal_router,
    prefix="/journal",
    tags=["journal"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    portfolio_router,
    prefix="/portfolio",
    tags=["portfolio"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    risk_router,
    prefix="/risk",
    tags=["risk"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    scoring_router,
    prefix="/scoring",
    tags=["scoring"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    users_router,
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)
api_router.include_router(
    agent_router,
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_active_user), Depends(require_active_subscription)],
)

__all__ = ["api_router"]
