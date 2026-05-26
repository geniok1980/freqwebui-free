"""Bot discovery services for Docker and filesystem scanning."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import os
from typing import Optional


@dataclass
class DiscoveryResult:
    """Result from a discovery scan for a single bot."""

    environment: str  # docker, baremetal
    name: str
    host: Optional[str] = None
    container_id: Optional[str] = None
    user_data_path: Optional[str] = None
    api_url: Optional[str] = None
    api_port: Optional[int] = None
    api_available: bool = False
    sqlite_path: Optional[str] = None
    sqlite_available: bool = False
    config_data: Optional[dict] = None
    labels: dict = field(default_factory=dict)
    exchange: Optional[str] = None
    strategy: Optional[str] = None
    is_dryrun: bool = True


class BaseDiscovery(ABC):
    """Abstract base class for bot discovery implementations."""

    @abstractmethod
    async def discover(self) -> list[DiscoveryResult]:
        """Discover Freqtrade bots.

        Returns:
            List of discovered bots.
        """
        pass


def map_user_data_path_for_backend(user_data_path: str | None) -> str | None:
    if not user_data_path:
        return None

    normalized = user_data_path.replace("\\", "/")

    mount_root = os.getenv("DASHBOARD_FREQTRADE_SECRETS_MOUNT", "/opt/freqtrade_secrets").rstrip("/")
    marker = "/secrets/freqtrade/"
    idx = normalized.lower().find(marker)
    if idx != -1:
        suffix = normalized[idx + len(marker) :].lstrip("/")
        if suffix:
            return f"{mount_root}/{suffix}"

    return user_data_path

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if this discovery method is available.

        Returns:
            True if discovery method can be used.
        """
        pass
