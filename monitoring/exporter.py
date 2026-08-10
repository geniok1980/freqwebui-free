"""FreqDash Prometheus exporter.

Собирает метрики платформы FreqDash и всех ботов через REST API
(/api/v1) и отдаёт их в формате Prometheus на /metrics.

Запуск:
    python exporter.py  (порт по умолчанию 9101, env PORT)

Env:
    FREQDASH_BASE_URL   базовый URL API (по умолчанию http://backend:8000/api/v1)
    FREQDASH_USERNAME   логин (admin)
    FREQDASH_PASSWORD   пароль (admin)
    FREQDASH_TENANT     tenant slug (default)
    FREQDASH_API_TOKEN  scoped API-токен (freqdash_...) — если задан, используется вместо логина
    FREQDASH_POLL_SECONDS  интервал опроса API (30)
"""

import os
import time
import urllib.error
import urllib.request
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock, Thread

from prometheus_client import (
    CollectorRegistry,
    Gauge,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

BASE_URL = os.environ.get("FREQDASH_BASE_URL", "http://backend:8000/api/v1").rstrip("/")
USERNAME = os.environ.get("FREQDASH_USERNAME", "admin")
PASSWORD = os.environ.get("FREQDASH_PASSWORD", "admin")
TENANT = os.environ.get("FREQDASH_TENANT", "default")
API_TOKEN = os.environ.get("FREQDASH_API_TOKEN", "")
POLL_SECONDS = int(os.environ.get("FREQDASH_POLL_SECONDS", "30"))
PORT = int(os.environ.get("PORT", "9101"))


class FreqDashClient:
    def __init__(self):
        self.token = None
        self.token_expires = 0.0

    def _login(self):
        if API_TOKEN:
            self.token = API_TOKEN
            return
        body = json.dumps(
            {"username": USERNAME, "password": PASSWORD, "tenant_slug": TENANT}
        ).encode()
        req = urllib.request.Request(
            f"{BASE_URL}/auth/login", data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        self.token = data["data"]["access_token"]
        self.token_expires = time.time() + 3300  # 55 минут (JWT 60 мин)

    def _ensure_token(self):
        if API_TOKEN:
            return
        if not self.token or time.time() > self.token_expires:
            self._login()

    def get(self, path: str):
        self._ensure_token()
        req = urllib.request.Request(
            f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {self.token}"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 401 and not API_TOKEN:
                self._login()
                req = urllib.request.Request(
                    f"{BASE_URL}{path}",
                    headers={"Authorization": f"Bearer {self.token}"},
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode())
            raise


class FreqDashCollector:
    """Периодически опрашивает API и обновляет Prometheus-метрики."""

    def __init__(self):
        self.client = FreqDashClient()
        self.registry = CollectorRegistry()
        self.lock = Lock()
        self.last_error = ""

        self.bots_total = Gauge(
            "freqdash_bots_total", "Количество ботов в платформе",
            registry=self.registry,
        )
        self.bot_info = Info(
            "freqdash_bot", "Метаданные бота",
            registry=self.registry,
        )
        self.bot_health = Gauge(
            "freqdash_bot_health", "Здоровье бота (1 healthy / 0 degraded / -1 unreachable)",
            ["bot_id", "name"], registry=self.registry,
        )
        self.bot_state = Gauge(
            "freqdash_bot_state", "Состояние бота (1 running / 0 stopped)",
            ["bot_id", "name"], registry=self.registry,
        )
        self.bot_equity = Gauge(
            "freqdash_bot_equity", "Equity бота", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_profit_abs = Gauge(
            "freqdash_bot_profit_abs", "Абсолютная прибыль", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_profit_pct = Gauge(
            "freqdash_bot_profit_pct", "Прибыль в процентах", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_open_positions = Gauge(
            "freqdash_bot_open_positions", "Открытые позиции", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_closed_trades = Gauge(
            "freqdash_bot_closed_trades", "Закрытые сделки", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_win_rate = Gauge(
            "freqdash_bot_win_rate", "Win rate (0..1)", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_balance = Gauge(
            "freqdash_bot_balance", "Баланс", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_drawdown = Gauge(
            "freqdash_bot_drawdown", "Просадка", ["bot_id", "name"],
            registry=self.registry,
        )
        self.bot_api_available = Gauge(
            "freqdash_bot_api_available", "Доступность REST API бота (1/0)",
            ["bot_id", "name"], registry=self.registry,
        )
        self.bot_api_success_rate = Gauge(
            "freqdash_bot_api_success_rate", "Success rate REST API бота (0..1)",
            ["bot_id", "name"], registry=self.registry,
        )
        self.bot_api_latency_ms = Gauge(
            "freqdash_bot_api_latency_ms", "Средняя задержка REST API бота, мс",
            ["bot_id", "name"], registry=self.registry,
        )
        self.collector_success = Gauge(
            "freqdash_collector_success", "Успех последнего сбора (1/0)",
            registry=self.registry,
        )

    def _num(self, v):
        try:
            if v is None:
                return float("nan")
            return float(v)
        except (TypeError, ValueError):
            return float("nan")

    def collect_once(self):
        try:
            bots = self.client.get("/bots").get("data", [])
            with self.lock:
                self.bots_total.set(len(bots))
                seen = set()

                for bot in bots:
                    bot_id = bot.get("id", "")
                    name = bot.get("name", bot_id)
                    labels = (bot_id, name)

                    # Базовые метаданные
                    self.bot_info.info({
                        "bot_id": bot_id, "name": name,
                        "environment": bot.get("environment", ""),
                        "exchange": bot.get("exchange", ""),
                        "strategy": bot.get("strategy", ""),
                        "is_dryrun": str(bool(bot.get("is_dryrun"))).lower(),
                    })

                    hs = bot.get("health_state", "unknown")
                    self.bot_health.labels(*labels).set(
                        1 if hs == "healthy" else (0 if hs == "degraded" else -1)
                    )
                    seen.add(bot_id)

                    # Метрики
                    try:
                        m = self.client.get(f"/bots/{bot_id}/metrics").get("data", {})
                        self.bot_equity.labels(*labels).set(self._num(m.get("equity")))
                        self.bot_profit_abs.labels(*labels).set(self._num(m.get("profit_abs")))
                        self.bot_profit_pct.labels(*labels).set(self._num(m.get("profit_pct")))
                        self.bot_open_positions.labels(*labels).set(self._num(m.get("open_positions")))
                        self.bot_closed_trades.labels(*labels).set(self._num(m.get("closed_trades")))
                        wr = m.get("win_rate")
                        self.bot_win_rate.labels(*labels).set(self._num(wr / 100.0 if wr is not None and wr > 1 else wr))
                        self.bot_balance.labels(*labels).set(self._num(m.get("balance")))
                        self.bot_drawdown.labels(*labels).set(self._num(m.get("drawdown")))
                    except Exception:
                        for g in (self.bot_equity, self.bot_profit_abs, self.bot_profit_pct,
                                  self.bot_open_positions, self.bot_closed_trades,
                                  self.bot_win_rate, self.bot_balance, self.bot_drawdown):
                            g.labels(*labels).set(float("nan"))

                    # Здоровье
                    try:
                        h = self.client.get(f"/bots/{bot_id}/health").get("data", {})
                        self.bot_api_available.labels(*labels).set(
                            1 if h.get("api_available") else 0)
                        self.bot_api_success_rate.labels(*labels).set(
                            self._num(h.get("api_success_rate")))
                        self.bot_api_latency_ms.labels(*labels).set(
                            self._num(h.get("api_avg_latency_ms")))
                    except Exception:
                        self.bot_api_available.labels(*labels).set(0)
                        self.bot_api_success_rate.labels(*labels).set(float("nan"))
                        self.bot_api_latency_ms.labels(*labels).set(float("nan"))

                    # Состояние (running/stopped) — только если API доступен
                    try:
                        s = self.client.get(f"/bots/{bot_id}/status").get("data", {})
                        self.bot_state.labels(*labels).set(
                            1 if s.get("state") == "running" else 0)
                    except Exception:
                        self.bot_state.labels(*labels).set(float("nan"))

                self.collector_success.set(1)
                self.last_error = ""
        except Exception as e:  # noqa: BLE001
            self.collector_success.set(0)
            self.last_error = f"{type(e).__name__}: {e}"

    def poll_loop(self):
        while True:
            self.collect_once()
            time.sleep(POLL_SECONDS)


def make_handler(collector: FreqDashCollector):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            if self.path == "/metrics":
                with collector.lock:
                    data = generate_latest(collector.registry)
                self.send_response(200)
                self.send_header("Content-Type", CONTENT_TYPE_LATEST)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            elif self.path == "/health":
                body = json.dumps({
                    "status": "ok",
                    "last_error": collector.last_error,
                    "poll_seconds": POLL_SECONDS,
                }).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):  # noqa: A002, A003
            print(f"[exporter] {format % args}")

    return Handler


def main():
    collector = FreqDashCollector()
    # Первый сбор до старта HTTP — чтобы /metrics сразу отдавал данные
    collector.collect_once()
    Thread(target=collector.poll_loop, daemon=True).start()

    server = ThreadingHTTPServer(("0.0.0.0", PORT), make_handler(collector))
    print(f"[exporter] FreqDash exporter listening on :{PORT}, poll={POLL_SECONDS}s")
    server.serve_forever()


if __name__ == "__main__":
    main()
