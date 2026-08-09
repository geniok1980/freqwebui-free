"""Opportunity Scanner: поиск перспективных пар для торговли.

Берёт топ-монеты по капитализации (из crypto_prices в БД), тянет дневные
свечи с Bybit (public API, без ключа), считает индикаторы (RSI, EMA, объём)
и классифицирует по категориям: импульс, отскок от перепроданности,
пробой, восходящий тренд. Результат кэшируется на CACHE_TTL секунд.
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

BYBIT_KLINE_URL = "https://api.bybit.com/v5/market/kline"
INTERVAL = "D"          # дневные свечи
KLINE_LIMIT = 60        # 60 свечей хватает для RSI/EMA50
MAX_SYMBOLS = 60        # сколько топ-монет сканировать
CACHE_TTL = 300         # 5 минут
TIMEOUT = 8.0

_cache: dict[str, Any] = {"ts": 0, "data": None}

# Bybit symbol -> Freqtrade pair
def _to_pair(symbol: str) -> str:
    s = symbol.upper()
    if s.endswith("USDT") and len(s) > 5:
        return f"{s[:-4]}/USDT"
    return f"{s}/USDT"


async def _fetch_kline(symbol: str) -> Optional[list[list[str]]]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                BYBIT_KLINE_URL,
                params={
                    "category": "spot",
                    "symbol": symbol,
                    "interval": INTERVAL,
                    "limit": KLINE_LIMIT,
                },
            )
            data = resp.json()
            if data.get("retCode") != 0:
                return None
            return data.get("result", {}).get("list")
    except Exception as e:
        logger.debug("kline failed %s: %s", symbol, e)
        return None


def _rsi(closes: list[float], period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    gains, losses = 0.0, 0.0
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        if diff >= 0:
            gains += diff
        else:
            losses -= diff
    if losses == 0:
        return 100.0
    avg_gain, avg_loss = gains / period, losses / period
    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = max(diff, 0.0)
        loss = max(-diff, 0.0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def _ema(values: list[float], period: int) -> Optional[float]:
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    ema = sum(values[:period]) / period
    for v in values[period:]:
        ema = v * k + ema * (1 - k)
    return ema


def _analyze(symbol: str, raw: list[list[str]]) -> Optional[dict]:
    """raw: свечи Bybit, в списке новые СВЕРХУ (list[0] — последняя)."""
    try:
        # переворачиваем: старые -> новые
        candles = list(reversed(raw))
        closes = [float(c[4]) for c in candles]
        opens = [float(c[1]) for c in candles]
        volumes = [float(c[5]) for c in candles]
        if len(closes) < 25:
            return None

        last_close = closes[-1]
        prev_close = closes[-2]
        change_1d = (last_close / prev_close - 1) * 100 if prev_close else 0.0
        change_7d = (last_close / closes[-8] - 1) * 100 if len(closes) >= 8 and closes[-8] else 0.0

        rsi = _rsi(closes)
        ema20 = _ema(closes, 20)
        ema50 = _ema(closes, 50) if len(closes) >= 50 else None
        vol_avg20 = sum(volumes[-21:-1]) / 20 if len(volumes) >= 21 else 1.0
        vol_ratio = volumes[-1] / vol_avg20 if vol_avg20 > 0 else 0.0
        high20 = max(closes[-20:]) if len(closes) >= 20 else max(closes)

        categories = []
        score = 0.0

        # 1) Импульс: сильный рост за день при повышенном объёме
        if change_1d >= 3.0 and vol_ratio >= 1.3:
            categories.append("momentum")
            score += change_1d * 0.3
        # 2) Отскок от перепроданности: RSI был <30 и теперь зелёная свеча
        if rsi is not None and rsi < 38 and closes[-1] > opens[-1] and change_1d > 0:
            categories.append("oversold_bounce")
            score += (38 - rsi) * 0.5
        # 3) Пробой: новый максимум за 20 дней на объёме
        if last_close >= high20 * 0.999 and vol_ratio >= 1.5 and change_1d > 0:
            categories.append("breakout")
            score += 3.0
        # 4) Восходящий тренд: цена выше EMA50, рост за неделю
        if ema50 is not None and last_close > ema50 and change_7d >= 5.0:
            categories.append("trend_up")
            score += 2.0

        if not categories:
            return None

        return {
            "symbol": symbol,
            "pair": _to_pair(symbol),
            "price": round(last_close, 6),
            "change_1d_pct": round(change_1d, 2),
            "change_7d_pct": round(change_7d, 2),
            "rsi": round(rsi, 1) if rsi is not None else None,
            "vol_ratio": round(vol_ratio, 2),
            "above_ema50": bool(ema50 is not None and last_close > ema50),
            "ema50": round(ema50, 6) if ema50 is not None else None,
            "categories": categories,
            "score": round(score, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.debug("analyze failed %s: %s", symbol, e)
        return None


async def scan_opportunities(force: bool = False) -> dict:
    """Сканирование рынка. Кэш 5 минут, force сбрасывает."""
    now = time.time()
    if not force and _cache["data"] is not None and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]

    # 1. Топ-монеты по капитализации из БД crypto_prices
    symbols = await _top_symbols()
    if not symbols:
        result = {"status": "error", "error": "Нет данных о ценах в БД", "items": [], "scanned": 0}
        _cache["ts"] = now
        _cache["data"] = result
        return result

    # 2. Параллельно тянем свечи
    sem = asyncio.Semaphore(10)
    async def bounded(sym):
        async with sem:
            return sym, await _fetch_kline(sym)

    tasks = [bounded(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 3. Анализ
    items = []
    for sym, raw in results:
        if isinstance(raw, Exception) or not raw:
            continue
        item = _analyze(sym, raw)
        if item:
            items.append(item)

    items.sort(key=lambda x: -x["score"])
    result = {
        "status": "success",
        "items": items,
        "scanned": len(symbols),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    _cache["ts"] = now
    _cache["data"] = result
    logger.info("Opportunity scan: %d/%d symbols, %d opportunities", len(items), len(symbols), len(items))
    return result


async def _top_symbols(limit: int = MAX_SYMBOLS) -> list[str]:
    """Топ-N монет по market_cap из БД crypto_prices (БД financial_data)."""
    import asyncpg

    from src.tenancy import get_current_tenant_schema

    tenant_schema = get_current_tenant_schema()
    host = os.getenv("FINANCE_DB_HOST") or os.getenv("DB_HOST") or "postgres"
    port = int(os.getenv("FINANCE_DB_PORT") or os.getenv("DB_PORT") or "5432")
    user = os.getenv("FINANCE_DB_USER") or os.getenv("DB_USER") or "dashboard"
    password = os.getenv("FINANCE_DB_PASSWORD") or os.getenv("DB_PASSWORD") or "dashboard"
    database = os.getenv("FINANCE_DB_NAME") or "financial_data"
    try:
        pool = await asyncpg.create_pool(
            host=host, port=port, user=user, password=password, database=database,
            server_settings={"search_path": f"{tenant_schema},public"},
        )
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT DISTINCT ON (coin_id) symbol, market_cap
                    FROM crypto_prices
                    ORDER BY coin_id, timestamp DESC
                    """
                )
        finally:
            await pool.close()
        ranked = sorted(rows, key=lambda r: -(r["market_cap"] or 0))
        symbols = []
        for r in ranked[:limit]:
            base = (r["symbol"] or "").upper().replace("-", "").replace("/", "").replace("USDT", "")
            if not base:
                continue
            symbols.append(base + "USDT")
        return symbols
    except Exception as e:
        logger.warning("top_symbols failed: %s", e)
        return []
