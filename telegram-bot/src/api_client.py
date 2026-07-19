"""HTTP client for Freqdash Dashboard API with JWT auth."""

from __future__ import annotations

import structlog
from datetime import datetime, timedelta
from typing import Any

import httpx

from src.config import env

logger = structlog.get_logger()


class FreqdashAPIError(Exception):
    def __init__(self, status: int, detail: str = "") -> None:
        self.status = status
        self.detail = detail
        super().__init__(f"[{status}] {detail}")


class FreqdashClient:
    """Async HTTP client with automatic JWT refresh."""

    def __init__(self) -> None:
        self._base_url = env.freqdash_api_url.rstrip("/")
        self._username = env.freqdash_username
        self._password = env.freqdash_password
        self._tenant_slug = env.freqdash_tenant_slug
        self._token: str | None = None
        self._token_expires: datetime | None = None
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(15.0, connect=5.0),
        )

    async def login(self) -> str:
        """Authenticate and store JWT token."""
        logger.info("authenticating to freqdash api", url=self._base_url)
        resp = await self._client.post(
            "/auth/login",
            json={
                "username": self._username,
                "password": self._password,
                "tenant_slug": self._tenant_slug,
            },
        )
        if resp.is_error:
            raise FreqdashAPIError(resp.status_code, resp.text)

        body = resp.json()
        data = body.get("data", body)
        self._token = data.get("access_token") or data.get("token")
        if not self._token:
            raise FreqdashAPIError(0, "no access_token in login response")

        expires_in = data.get("expires_in", 3600)
        self._token_expires = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        logger.info("authenticated successfully")
        return self._token

    async def _ensure_token(self) -> None:
        if not self._token or (
            self._token_expires and datetime.utcnow() >= self._token_expires
        ):
            await self.login()

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    async def _request(
        self, method: str, path: str, **kwargs: Any
    ) -> dict[str, Any]:
        await self._ensure_token()
        resp = await self._client.request(
            method,
            path,
            headers=self._headers(),
            **kwargs,
        )
        if resp.status_code == 401:
            logger.warning("token expired, re-authenticating")
            await self.login()
            resp = await self._client.request(
                method, path, headers=self._headers(), **kwargs
            )
        if resp.is_error:
            raise FreqdashAPIError(resp.status_code, resp.text)
        return resp.json()

    async def get(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> dict[str, Any]:
        return await self._request("PUT", path, **kwargs)

    # ── Bots ──

    async def list_bots(self) -> list[dict[str, Any]]:
        body = await self.get("/bots")
        return body.get("data", [])

    async def get_bot(self, bot_id: str) -> dict[str, Any]:
        body = await self.get(f"/bots/{bot_id}")
        return body.get("data", body)

    async def get_bot_metrics(self, bot_id: str) -> dict[str, Any]:
        try:
            body = await self.get(f"/bots/{bot_id}/metrics")
            return body.get("data", body)
        except FreqdashAPIError:
            return {}

    async def get_bot_health(self, bot_id: str) -> dict[str, Any]:
        try:
            body = await self.get(f"/bots/{bot_id}/health")
            return body.get("data", body)
        except FreqdashAPIError:
            return {}

    async def get_bot_config(self, bot_id: str) -> dict[str, Any]:
        body = await self.get(f"/bots/{bot_id}/config")
        return body.get("data", body)

    async def reload_bot(self, bot_id: str) -> dict[str, Any]:
        return await self.post(f"/bots/{bot_id}/reload")

    async def stop_bot(self, bot_id: str) -> dict[str, Any]:
        return await self.post(f"/bots/{bot_id}/stop")

    async def start_bot(self, bot_id: str) -> dict[str, Any]:
        return await self.post(f"/bots/{bot_id}/start")

    # ── Portfolio ──

    async def portfolio_summary(self) -> dict[str, Any]:
        body = await self.get("/portfolio/summary")
        return body.get("data", body)

    async def portfolio_by_exchange(self) -> list[dict[str, Any]]:
        body = await self.get("/portfolio/by-exchange")
        return body.get("data", [])

    async def portfolio_by_strategy(self) -> list[dict[str, Any]]:
        body = await self.get("/portfolio/by-strategy")
        return body.get("data", [])

    # ── Agent ──

    async def agent_status(self) -> dict[str, Any]:
        try:
            return await self.get("/agent/status")
        except FreqdashAPIError:
            return {}

    async def agent_config(self) -> dict[str, Any]:
        try:
            return await self.get("/agent/config")
        except FreqdashAPIError:
            return {}

    async def agent_enable(self) -> dict[str, Any]:
        return await self.post("/agent/enable")

    async def agent_disable(self) -> dict[str, Any]:
        return await self.post("/agent/disable")

    async def current_regime(self) -> dict[str, Any]:
        try:
            return await self.get("/agent/regime/current")
        except FreqdashAPIError:
            return {"regime": "unknown"}

    async def agent_trades(self, limit: int = 10) -> list[dict[str, Any]]:
        try:
            body = await self.get(f"/agent/trades?limit={limit}")
            return body if isinstance(body, list) else body.get("data", [])
        except FreqdashAPIError:
            return []

    # ── Scoring / Risk / Comparison ──

    async def scoring(self, bot_id: str | None = None) -> list[dict[str, Any]]:
        path = "/scoring" + (f"?bot_id={bot_id}" if bot_id else "")
        body = await self.get(path)
        return body.get("data", [])

    async def risk(self) -> list[dict[str, Any]]:
        body = await self.get("/risk")
        return body.get("data", [])

    async def comparison(
        self, strategy_name: str | None = None
    ) -> list[dict[str, Any]]:
        path = "/comparison" + (f"?strategy_name={strategy_name}" if strategy_name else "")
        body = await self.get(path)
        return body.get("data", [])

    async def close(self) -> None:
        await self._client.aclose()


# Singleton
api = FreqdashClient()
