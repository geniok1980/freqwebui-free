"""Configuration loader for the dashboard backend."""

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class ServerConfig(BaseModel):
    """Server configuration."""

    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    cors_origins: list[str] = Field(default_factory=lambda: [
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5000",
    ])


class DatabaseConfig(BaseModel):
    """Database configuration."""

    url: str = "postgresql://dashboard:dashboard@localhost:5432/dashboard"
    pool_size: int = 5
    echo: bool = False


class AnalyticsDatabaseConfig(BaseModel):
    """Analytics database configuration (read-only, separate from main DB)."""

    url: str = "postgresql://analytics:analytics%21@192.168.0.210:5432/freqtrade_analytics"
    pool_size: int = 3
    echo: bool = False


class RedisConfig(BaseModel):
    """Redis cache configuration."""

    enabled: bool = False
    url: str = "redis://localhost:6379/0"


class DockerDiscoveryConfig(BaseModel):
    """Docker discovery configuration."""

    enabled: bool = True
    socket: str = "unix://var/run/docker.sock"
    labels: list[str] = Field(default_factory=lambda: ["com.freqtrade.bot_name"])
    image_patterns: list[str] = Field(
        default_factory=lambda: ["freqtradeorg/freqtrade", "freqtrade/*"]
    )


class FilesystemDiscoveryConfig(BaseModel):
    """Filesystem discovery configuration."""

    enabled: bool = True
    scan_paths: list[str] = Field(default_factory=lambda: ["/opt/freqtrade/*/user_data"])
    patterns: list[str] = Field(
        default_factory=lambda: ["tradesv3.sqlite", "tradesv3.dryrun.sqlite"]
    )


class DiscoveryConfig(BaseModel):
    """Discovery configuration."""

    docker: DockerDiscoveryConfig = Field(default_factory=DockerDiscoveryConfig)
    filesystem: FilesystemDiscoveryConfig = Field(default_factory=FilesystemDiscoveryConfig)
    interval_seconds: int = 60


class HealthConfig(BaseModel):
    """Health check configuration."""

    check_interval_seconds: int = 10
    latency_threshold_ms: float = 5000
    error_rate_threshold: float = 0.3
    recovery_window_seconds: int = 60
    request_timeout_seconds: float = 10.0


class ApiDefaultsConfig(BaseModel):
    """Default API settings for Freqtrade bots."""

    timeout_seconds: int = 5
    username: str = "user"
    password: str = ""  # Override via DASHBOARD_API_DEFAULTS__PASSWORD env


class AuthConfig(BaseModel):
    """Authentication configuration."""

    jwt_secret: str = ""  # REQUIRED: set via JWT_SECRET env or dashboard.yaml
    jwt_algorithm: str = "HS256"
    token_expire_minutes: int = 10080  # 7 days (7 * 24 * 60)
    refresh_expire_days: int = 30  # Extended to 30 days


class LoggingConfig(BaseModel):
    """Logging configuration."""

    level: str = "INFO"
    format: str = "json"
    file: str | None = None


class TenancyConfig(BaseModel):
    enabled: bool = True
    enforce: bool = False
    header_name: str = "X-Tenant-Slug"


class BillingConfig(BaseModel):
    enabled: bool = False
    enforce: bool = False
    provider: str = "wata"
    wata_base_url: str = "https://api.wata.pro/api/h2h"
    wata_api_token: str = ""
    wata_currency: str = "USD"
    wata_public_key_ttl_seconds: int = 3600
    wata_webhook_ips: list[str] = Field(default_factory=lambda: ["62.84.126.140", "51.250.106.150"])
    success_url: str = "http://localhost:5000/billing?checkout=success"
    cancel_url: str = "http://localhost:5000/billing?checkout=cancel"
    portal_return_url: str = "http://localhost:5000/billing"


class Settings(BaseSettings):
    """Application settings loaded from YAML config and environment."""

    server: ServerConfig = Field(default_factory=ServerConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    analytics: AnalyticsDatabaseConfig = Field(default_factory=AnalyticsDatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)
    health: HealthConfig = Field(default_factory=HealthConfig)
    api_defaults: ApiDefaultsConfig = Field(default_factory=ApiDefaultsConfig)
    auth: AuthConfig = Field(default_factory=AuthConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    tenancy: TenancyConfig = Field(default_factory=TenancyConfig)
    billing: BillingConfig = Field(default_factory=BillingConfig)

    class Config:
        env_prefix = "DASHBOARD_"
        env_nested_delimiter = "__"


def load_config(config_path: str | Path | None = None) -> Settings:
    """Load configuration from YAML file with environment variable substitution.

    Args:
        config_path: Path to the YAML configuration file.
                    If None, looks for config in standard locations.

    Returns:
        Settings object with loaded configuration.
    """
    if config_path is None:
        # Search for config in standard locations
        search_paths = [
            Path("config/dashboard.yaml"),
            Path("dashboard.yaml"),
            Path("/app/config/dashboard.yaml"),
            Path.home() / ".config" / "freqtrade-dashboard" / "dashboard.yaml",
        ]
        for path in search_paths:
            if path.exists():
                config_path = path
                break

    config_data: dict[str, Any] = {}

    if config_path and Path(config_path).exists():
        with open(config_path) as f:
            raw_config = f.read()

        # Substitute environment variables (${VAR} syntax)
        for key, value in os.environ.items():
            raw_config = raw_config.replace(f"${{{key}}}", value)

        config_data = yaml.safe_load(raw_config) or {}

    # Override JWT secret from environment if set
    if jwt_secret := os.environ.get("JWT_SECRET"):
        if "auth" not in config_data:
            config_data["auth"] = {}
        config_data["auth"]["jwt_secret"] = jwt_secret

    # Override database URL from environment if set
    if db_url := os.environ.get("DATABASE_URL"):
        if "database" not in config_data:
            config_data["database"] = {}
        config_data["database"]["url"] = db_url

    if "tenancy" not in config_data:
        config_data["tenancy"] = {}
    config_data["tenancy"]["enforce"] = os.environ.get("TENANCY_ENFORCED", "false").lower() in {"1", "true", "yes"}

    if "billing" not in config_data:
        config_data["billing"] = {}
    config_data["billing"]["enforce"] = os.environ.get("BILLING_ENFORCED", "false").lower() in {"1", "true", "yes"}
    config_data["billing"]["provider"] = os.environ.get("BILLING_PROVIDER", "wata")
    config_data["billing"]["wata_base_url"] = os.environ.get(
        "WATA_BASE_URL", config_data["billing"].get("wata_base_url", "https://api.wata.pro/api/h2h")
    )
    config_data["billing"]["wata_api_token"] = os.environ.get("WATA_API_TOKEN", "")
    config_data["billing"]["wata_currency"] = os.environ.get(
        "WATA_CURRENCY", config_data["billing"].get("wata_currency", "USD")
    )
    config_data["billing"]["wata_public_key_ttl_seconds"] = int(
        os.environ.get(
            "WATA_PUBLIC_KEY_TTL_SECONDS",
            config_data["billing"].get("wata_public_key_ttl_seconds", 3600),
        )
    )
    webhook_ips_raw = os.environ.get("WATA_WEBHOOK_IPS")
    if webhook_ips_raw:
        config_data["billing"]["wata_webhook_ips"] = [ip.strip() for ip in webhook_ips_raw.split(",") if ip.strip()]
    config_data["billing"]["success_url"] = os.environ.get(
        "BILLING_SUCCESS_URL",
        os.environ.get(
            "STRIPE_SUCCESS_URL", config_data["billing"].get("success_url", "http://localhost:5000/billing?checkout=success")
        ),
    )
    config_data["billing"]["cancel_url"] = os.environ.get(
        "BILLING_CANCEL_URL",
        os.environ.get(
            "STRIPE_CANCEL_URL", config_data["billing"].get("cancel_url", "http://localhost:5000/billing?checkout=cancel")
        ),
    )
    config_data["billing"]["portal_return_url"] = os.environ.get(
        "BILLING_PORTAL_RETURN_URL",
        os.environ.get("STRIPE_PORTAL_RETURN_URL", config_data["billing"].get("portal_return_url", "http://localhost:5000/billing")),
    )

    return Settings(**config_data)


# Global settings instance
settings = load_config()
