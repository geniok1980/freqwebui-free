"""WebSocket API endpoint for real-time updates."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

import structlog

from src.config import settings
from src.services.websocket import ws_manager

logger = structlog.get_logger()

router = APIRouter()


async def verify_ws_token(token: str) -> tuple[str, str] | None:
    """Verify JWT token from WebSocket connection.

    Args:
        token: JWT token to verify.

    Returns:
        (user_id, tenant_id) if valid, None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            settings.auth.jwt_secret,
            algorithms=[settings.auth.jwt_algorithm],
        )
        user_id: str | None = payload.get("user_id")
        tenant_id: str | None = payload.get("tenant_id")
        if user_id is None or tenant_id is None:
            return None
        return user_id, tenant_id
    except JWTError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT authentication token"),
    channel: str = Query("global", description="Channel to subscribe to"),
):
    """WebSocket endpoint for real-time updates.

    Clients must provide a valid JWT token as a query parameter.

    Channels:
    - global: Receive all updates (dashboard view)
    - bot:{bot_id}: Receive updates for a specific bot

    Message types sent to clients:
    - metrics_update: Bot metrics changed
    - health_update: Bot health status changed
    - trade_update: New trade or trade closed
    - portfolio_update: Portfolio summary changed
    - bot_discovered: New bot discovered
    - bot_removed: Bot removed from monitoring
    """
    # Verify token
    verified = await verify_ws_token(token)
    if not verified:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return
    user_id, tenant_id = verified
    tenant_channel = f"tenant:{tenant_id}:{channel}"

    await ws_manager.connect(websocket, user_id, tenant_channel)

    try:
        while True:
            # Wait for messages from client (ping/pong, channel subscriptions, etc.)
            data = await websocket.receive_json()

            # Handle subscription changes
            if data.get("action") == "subscribe":
                new_channel = data.get("channel")
                if new_channel:
                    scoped_channel = f"tenant:{tenant_id}:{new_channel}"
                    await ws_manager.connect(websocket, user_id, scoped_channel)
                    await websocket.send_json({
                        "type": "subscribed",
                        "channel": scoped_channel,
                    })

            elif data.get("action") == "unsubscribe":
                old_channel = data.get("channel")
                if old_channel and old_channel != tenant_channel:
                    # Remove from specific channel but keep in global
                    scoped_old_channel = f"tenant:{tenant_id}:{old_channel}"
                    if scoped_old_channel in ws_manager._active_connections:
                        if websocket in ws_manager._active_connections[scoped_old_channel]:
                            ws_manager._active_connections[scoped_old_channel].remove(websocket)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "channel": scoped_old_channel,
                    })

            elif data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error("WebSocket error", error=str(e), user_id=user_id)
        ws_manager.disconnect(websocket, user_id)


@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics."""
    return {
        "total_connections": ws_manager.get_connection_count(),
        "global_channel": ws_manager.get_channel_count("global"),
    }
